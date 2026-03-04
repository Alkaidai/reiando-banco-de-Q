import { COMMENT_STATUS, DIFFICULTIES, GRADES, SUBJECTS } from './constants.js';
import {
  addAttempt,
  addComment,
  authenticate,
  getAttempts,
  getCurrentUser,
  getNotebook,
  initStorageFromSeeds,
  loadQuestionBank,
  loadTopicsBank,
  logout,
  setCurrentUser,
  upsertNotebookItem
} from './storage.js';
import { difficultyLabel, formatDate, safeText, subjectLabel } from './ui.js';

const state = {
  answers: {},
  filters: { grade: '', subject: '', difficulty: '', topicId: '', search: '' }
};

function currentUserId() {
  return getCurrentUser()?.username ?? '';
}

function getTopicLabel(topics, topicId) {
  return topics.find((topic) => topic.id === topicId)?.label ?? '—';
}

function filteredQuestions() {
  return loadQuestionBank().filter((q) => {
    if (q.status !== 'published') return false;
    if (state.filters.grade && q.grade !== state.filters.grade) return false;
    if (state.filters.subject && q.subject !== state.filters.subject) return false;
    if (state.filters.difficulty && q.difficulty !== state.filters.difficulty) return false;
    if (state.filters.topicId && q.topicId !== state.filters.topicId) return false;
    if (state.filters.search) {
      const needle = state.filters.search.toLowerCase();
      const hay = `${q.statement} ${q.options.join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function dashboardMetrics() {
  const userId = currentUserId();
  const attempts = getAttempts(userId);
  const answered = attempts.length;
  const correct = attempts.filter((item) => item.isCorrect).length;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;
  return { attempts, answered, correct, rate };
}

function weakestTopics(attempts) {
  const questions = new Map(loadQuestionBank().map((q) => [q.id, q]));
  const topicMap = new Map(loadTopicsBank().map((t) => [t.id, t.label]));
  const agg = new Map();

  attempts.forEach((attempt) => {
    const question = questions.get(attempt.questionId);
    if (!question?.topicId) return;
    const key = question.topicId;
    const item = agg.get(key) ?? { topicId: key, label: topicMap.get(key) ?? key, total: 0, errors: 0 };
    item.total += 1;
    if (!attempt.isCorrect) item.errors += 1;
    agg.set(key, item);
  });

  return [...agg.values()]
    .filter((item) => item.total > 0)
    .map((item) => ({ ...item, errorRate: Math.round((item.errors / item.total) * 100) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, 3);
}

function renderTopbar() {
  const user = getCurrentUser();
  document.querySelector('#adminLink').classList.toggle('hidden', user?.role !== 'admin');
  document.querySelector('#sessionInfo').textContent = user
    ? `Logado como ${user.username} (${user.role === 'admin' ? 'admin' : 'aluno'})`
    : 'Não autenticado';
}

function renderDashboard() {
  const userId = currentUserId();
  const { attempts, answered, correct, rate } = dashboardMetrics();
  const hasData = attempts.length > 0;

  document.querySelector('#statAnswered').textContent = String(answered);
  document.querySelector('#statCorrect').textContent = String(correct);
  document.querySelector('#statRate').textContent = `${rate}%`;
  document.querySelector('#dashboardEmpty').classList.toggle('hidden', hasData);

  const weak = weakestTopics(attempts);
  document.querySelector('#weakTopics').innerHTML = weak.length
    ? weak
        .map(
          (item, idx) =>
            `<li>${idx + 1}. ${safeText(item.label)} — erro ${item.errorRate}% (${item.errors}/${item.total})</li>`
        )
        .join('')
    : '<li class="muted">Sem dados suficientes.</li>';

  const questionsById = new Map(loadQuestionBank().map((q) => [q.id, q]));
  const wrongLatest = attempts
    .filter((a) => !a.isCorrect)
    .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
    .slice(0, 10);

  document.querySelector('#reviewNow').innerHTML = wrongLatest.length
    ? wrongLatest
        .map((attempt) => {
          const q = questionsById.get(attempt.questionId);
          if (!q) return '';
          return `<div class="review-item">
            <p><strong>${safeText(q.statement.slice(0, 95))}${q.statement.length > 95 ? '...' : ''}</strong></p>
            <small>${formatDate(attempt.answeredAt)} • ${safeText(q.grade)} • ${safeText(subjectLabel(q.subject))}</small>
            <button class="btn-secondary" data-action="refazer" data-question-id="${q.id}">Refazer</button>
          </div>`;
        })
        .join('')
    : '<p class="muted">Nenhuma questão errada até agora.</p>';

  document.querySelector('#dashboardData').classList.toggle('hidden', !userId || !hasData);
}

function renderQuestions() {
  const questions = filteredQuestions();
  const topics = loadTopicsBank();

  const html = questions.length
    ? questions
        .map((q, idx) => {
          const answer = state.answers[q.id];
          const locked = !!answer;
          const visibleComments = (q.comments ?? []).filter((c) => c.status !== COMMENT_STATUS.hidden);
          return `
            <article class="question-card" id="question-${q.id}" data-qid="${q.id}">
              <header>
                <h3>${idx + 1}. ${safeText(q.statement)}</h3>
                <p class="meta">${q.grade} • ${subjectLabel(q.subject)} • ${difficultyLabel(q.difficulty)} • ${safeText(getTopicLabel(topics, q.topicId))}</p>
              </header>
              <div class="options">
                ${q.options
                  .map((option, optionIndex) => {
                    const checked = answer?.selectedIndex === optionIndex ? 'checked' : '';
                    const disabled = locked ? 'disabled' : '';
                    let className = '';
                    if (locked && optionIndex === q.correctIndex) className = 'option-correct';
                    if (locked && answer?.selectedIndex === optionIndex && !answer.isCorrect) className = 'option-wrong';
                    return `<label class="option ${className}"><input type="radio" name="opt_${q.id}" value="${optionIndex}" ${checked} ${disabled}/> ${safeText(option)}</label>`;
                  })
                  .join('')}
              </div>
              <div class="actions-row">
                <button class="btn-primary" ${locked ? 'disabled' : ''} data-action="confirm">Confirmar</button>
                ${answer ? `<span class="feedback ${answer.isCorrect ? 'ok' : 'error'}">${answer.isCorrect ? 'Acertou!' : 'Errou'}</span>` : ''}
              </div>
              ${answer ? `<div class="explanation"><strong>Explicação:</strong> ${safeText(q.explanation)}</div>` : ''}
              <section class="comments">
                <h4>Comentários</h4>
                <div class="comment-list">
                  ${
                    visibleComments.length
                      ? visibleComments
                          .map(
                            (comment) => `
                      <div class="comment-item">
                        <p><strong>${safeText(comment.author.username)}</strong> • ${formatDate(comment.createdAt)} • ${comment.status}</p>
                        <p>${safeText(comment.text)}</p>
                        ${(comment.replies ?? [])
                          .map(
                            (reply) => `<div class="reply"><strong>${safeText(reply.author.username)}:</strong> ${safeText(reply.text)} <small>${formatDate(reply.createdAt)}</small></div>`
                          )
                          .join('')}
                      </div>`
                          )
                          .join('')
                      : '<p class="muted">Nenhum comentário ainda.</p>'
                  }
                </div>
                <textarea data-role="comment-input" placeholder="Escreva seu comentário"></textarea>
                <button class="btn-secondary" data-action="comment">Enviar</button>
              </section>
            </article>`;
        })
        .join('')
    : '<p class="muted">Nenhuma questão encontrada com os filtros atuais.</p>';

  document.querySelector('#questionsList').innerHTML = html;
}

function renderNotebook() {
  const userId = currentUserId();
  const container = document.querySelector('#notebookList');
  if (!userId) {
    container.innerHTML = '<p class="muted">Faça login para usar o caderno de erros.</p>';
    return;
  }

  const notebook = getNotebook(userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const questions = new Map(loadQuestionBank().map((q) => [q.id, q]));

  container.innerHTML = notebook.length
    ? notebook
        .map((item) => {
          const q = questions.get(item.questionId);
          if (!q) return '';
          return `<article class="card notebook-item" data-question-id="${q.id}">
            <h4>${safeText(q.statement)}</h4>
            <p class="meta">${q.grade} • ${subjectLabel(q.subject)} • ${difficultyLabel(q.difficulty)} • status: ${item.status}</p>
            <label>O que eu errei?</label>
            <textarea data-field="whatIErred">${safeText(item.whatIErred)}</textarea>
            <label>Regra / insight</label>
            <textarea data-field="ruleInsight">${safeText(item.ruleInsight)}</textarea>
            <div class="actions-row">
              <button class="btn-secondary" data-action="save-notes">Salvar</button>
              <button class="btn-secondary" data-action="refazer">Refazer</button>
              <button class="btn-primary" data-action="mastered">Marcar como dominado</button>
            </div>
          </article>`;
        })
        .join('')
    : '<p class="muted">Seu caderno está vazio. Erre uma questão para começar.</p>';
}

function activateTab(tabId) {
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.student-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== tabId));
}

function scrollToQuestion(questionId) {
  activateTab('panel-questions');
  state.answers[questionId] = undefined;
  delete state.answers[questionId];
  renderQuestions();
  const el = document.querySelector(`#question-${questionId}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindTabs() {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.tab);
      if (button.dataset.tab === 'panel-notebook') renderNotebook();
      if (button.dataset.tab === 'panel-dashboard') renderDashboard();
    });
  });
}

function bindFilters() {
  ['grade', 'subject', 'difficulty', 'topicId', 'search'].forEach((key) => {
    document.querySelector(`#filter${key.charAt(0).toUpperCase()}${key.slice(1)}`).addEventListener('input', (e) => {
      state.filters[key] = e.target.value.trim();
      renderQuestions();
    });
  });
}

function hydrateSelects() {
  const topics = loadTopicsBank();
  const topicSelect = document.querySelector('#filterTopicId');
  topicSelect.innerHTML = '<option value="">Todos os tópicos</option>' + topics.map((t) => `<option value="${t.id}">${safeText(t.label)}</option>`).join('');
}

function bindQuestionActions() {
  document.querySelector('#questionsList').addEventListener('click', (event) => {
    const card = event.target.closest('.question-card');
    if (!card) return;
    const questionId = card.dataset.qid;
    const question = loadQuestionBank().find((q) => q.id === questionId);
    if (!question) return;

    if (event.target.dataset.action === 'confirm') {
      const userId = currentUserId();
      if (!userId) {
        alert('Faça login para registrar seu progresso.');
        return;
      }
      const picked = card.querySelector(`input[name="opt_${questionId}"]:checked`);
      if (!picked) return;
      const selectedIndex = Number(picked.value);
      const isCorrect = selectedIndex === question.correctIndex;

      state.answers[questionId] = { selectedIndex, isCorrect };

      addAttempt({
        id: Date.now(),
        userId,
        questionId,
        selectedIndex,
        isCorrect,
        answeredAt: new Date().toISOString()
      });

      if (!isCorrect) {
        upsertNotebookItem(userId, questionId, { status: 'pending' });
      }

      renderQuestions();
      renderDashboard();
      renderNotebook();
    }

    if (event.target.dataset.action === 'comment') {
      const user = getCurrentUser();
      if (!user) {
        alert('Faça login para comentar.');
        return;
      }
      const textarea = card.querySelector('[data-role="comment-input"]');
      const text = textarea.value.trim();
      if (!text) return;
      addComment(questionId, {
        author: { username: user.username, role: user.role },
        text,
        status: COMMENT_STATUS.open,
        replies: []
      });
      renderQuestions();
    }
  });
}

function bindNotebookActions() {
  document.querySelector('#notebookList').addEventListener('click', (event) => {
    const item = event.target.closest('.notebook-item');
    if (!item) return;
    const questionId = item.dataset.questionId;
    const userId = currentUserId();
    if (!userId) return;

    if (event.target.dataset.action === 'save-notes') {
      upsertNotebookItem(userId, questionId, {
        whatIErred: item.querySelector('[data-field="whatIErred"]').value.trim(),
        ruleInsight: item.querySelector('[data-field="ruleInsight"]').value.trim()
      });
      renderNotebook();
      return;
    }

    if (event.target.dataset.action === 'mastered') {
      upsertNotebookItem(userId, questionId, {
        status: 'mastered',
        whatIErred: item.querySelector('[data-field="whatIErred"]').value.trim(),
        ruleInsight: item.querySelector('[data-field="ruleInsight"]').value.trim()
      });
      renderNotebook();
      return;
    }

    if (event.target.dataset.action === 'refazer') {
      scrollToQuestion(questionId);
    }
  });
}

function bindDashboardActions() {
  document.querySelector('#reviewNow').addEventListener('click', (event) => {
    if (event.target.dataset.action === 'refazer') {
      scrollToQuestion(event.target.dataset.questionId);
    }
  });
}

function bindAuth() {
  document.querySelector('#loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.querySelector('#username').value.trim();
    const password = document.querySelector('#password').value.trim();
    const user = authenticate(username, password);
    const feedback = document.querySelector('#loginFeedback');
    if (!user) {
      feedback.textContent = 'Usuário ou senha inválidos.';
      return;
    }
    setCurrentUser(user);
    feedback.textContent = '';
    renderTopbar();
    renderDashboard();
    renderNotebook();
  });

  document.querySelector('#logoutBtn').addEventListener('click', () => {
    logout();
    renderTopbar();
    renderDashboard();
    renderNotebook();
  });
}

function populateSelects() {
  document.querySelector('#filterGrade').innerHTML = '<option value="">Todas as séries</option>' + GRADES.map((g) => `<option value="${g}">${g}</option>`).join('');
  document.querySelector('#filterSubject').innerHTML = '<option value="">Todas as disciplinas</option>' + SUBJECTS.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');
  document.querySelector('#filterDifficulty').innerHTML = '<option value="">Todas as dificuldades</option>' + DIFFICULTIES.map((d) => `<option value="${d.value}">${d.label}</option>`).join('');
}

async function init() {
  await initStorageFromSeeds();
  populateSelects();
  hydrateSelects();
  bindTabs();
  bindFilters();
  bindQuestionActions();
  bindNotebookActions();
  bindDashboardActions();
  bindAuth();
  renderTopbar();
  renderQuestions();
  renderDashboard();
  renderNotebook();
  activateTab('panel-dashboard');
}

init();
