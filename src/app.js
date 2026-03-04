import { COMMENT_STATUS, DIFFICULTIES, GRADES, SUBJECTS } from './constants.js';
import {
  addAttempt,
  addComment,
  addQuestionReport,
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
import { difficultyLabel, formatDate, optionLetter, safeText, subjectLabel } from './ui.js';

const state = {
  answers: {},
  activeQuestionTab: {},
  filters: { grade: '', subject: '', difficulty: '', topicId: '', search: '' }
};

const QUESTION_TABS = {
  gabarito: 'Gabarito comentado',
  aulas: 'Aulas',
  comentarios: 'Comentários',
  caderno: 'Caderno',
  erro: 'Notificar erro'
};

function currentUser() {
  return getCurrentUser();
}

function currentUserId() {
  return currentUser()?.username ?? '';
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
  const attempts = getAttempts(currentUserId());
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
    const prev = agg.get(question.topicId) ?? {
      topicId: question.topicId,
      label: topicMap.get(question.topicId) ?? question.topicId,
      total: 0,
      errors: 0
    };
    prev.total += 1;
    if (!attempt.isCorrect) prev.errors += 1;
    agg.set(question.topicId, prev);
  });

  return [...agg.values()]
    .filter((item) => item.total > 0)
    .map((item) => ({ ...item, errorRate: Math.round((item.errors / item.total) * 100) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, 3);
}

function renderAuthState() {
  const user = currentUser();
  const loggedIn = !!user;

  document.querySelector('#loginView').classList.toggle('hidden', loggedIn);
  document.querySelector('#appView').classList.toggle('hidden', !loggedIn);

  document.querySelector('#adminLink').classList.toggle('hidden', user?.role !== 'admin');
  document.querySelector('#headerLoginBtn').classList.toggle('hidden', loggedIn);
  document.querySelector('#logoutBtn').classList.toggle('hidden', !loggedIn);

  const headerUserState = document.querySelector('#headerUserState');
  headerUserState.textContent = user
    ? `Logado como ${user.username} (${user.role === 'admin' ? 'admin' : 'aluno'})`
    : 'Visitante';
}

function renderDashboard() {
  const { attempts, answered, correct, rate } = dashboardMetrics();
  const hasData = attempts.length > 0;

  document.querySelector('#statAnswered').textContent = String(answered);
  document.querySelector('#statCorrect').textContent = String(correct);
  document.querySelector('#statRate').textContent = `${rate}%`;

  document.querySelector('#dashboardEmpty').classList.toggle('hidden', hasData);
  document.querySelector('#dashboardData').classList.toggle('hidden', !hasData);

  const weak = weakestTopics(attempts);
  document.querySelector('#weakTopics').innerHTML = weak.length
    ? weak
        .map((item, idx) => `<li>${idx + 1}. ${safeText(item.label)} — erro ${item.errorRate}% (${item.errors}/${item.total})</li>`)
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
}

function questionTabPanel(tab, question, answer, user, notebookItem) {
  const visibleComments = (question.comments ?? []).filter((c) => c.status !== COMMENT_STATUS.hidden);

  if (tab === 'gabarito') {
    if (!answer) return '<p class="muted">Responda a questão para liberar o gabarito comentado.</p>';
    return `<p><strong>Resposta correta:</strong> (${optionLetter(question.correctIndex)}) ${safeText(question.options[question.correctIndex])}</p>
      <p>${safeText(question.explanation)}</p>`;
  }

  if (tab === 'aulas') {
    return '<p class="muted">Aulas deste tópico em breve.</p>';
  }

  if (tab === 'comentarios') {
    if (!user) return '<p class="muted">Faça login para visualizar e enviar comentários.</p>';
    return `<div class="comment-list">
      ${visibleComments.length
        ? visibleComments
            .map(
              (comment) => `<div class="comment-item">
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
        : '<p class="muted">Nenhum comentário ainda.</p>'}
      </div>
      <textarea data-role="comment-input" placeholder="Escreva seu comentário"></textarea>
      <button class="btn-secondary" data-action="comment">Enviar comentário</button>`;
  }

  if (tab === 'caderno') {
    if (!user) return '<p class="muted">Faça login para usar o caderno.</p>';
    if (!notebookItem) {
      return `<p class="muted">Essa questão ainda não está no seu caderno.</p>
      <button class="btn-secondary" data-action="add-notebook">Adicionar ao caderno</button>`;
    }
    return `<label>O que eu errei?</label>
      <textarea data-role="whatIErred">${safeText(notebookItem.whatIErred)}</textarea>
      <label>Regra / insight</label>
      <textarea data-role="ruleInsight">${safeText(notebookItem.ruleInsight)}</textarea>
      <div class="actions-row">
        <button class="btn-secondary" data-action="save-notebook">Salvar no caderno</button>
        <button class="btn-primary" data-action="mark-mastered">Marcar como dominado</button>
      </div>`;
  }

  if (tab === 'erro') {
    if (!user) return '<p class="muted">Faça login para notificar erro.</p>';
    return `<label>Tipo</label>
      <select data-role="report-type">
        <option value="enunciado">Enunciado</option>
        <option value="alternativa">Alternativa</option>
        <option value="gabarito">Gabarito</option>
        <option value="outro">Outro</option>
      </select>
      <label>Descrição</label>
      <textarea data-role="report-description" placeholder="Descreva o problema"></textarea>
      <button class="btn-danger" data-action="report-error">Enviar notificação</button>
      <p class="muted" data-role="report-feedback"></p>`;
  }

  return '';
}

function renderQuestions() {
  const questions = filteredQuestions();
  const topics = loadTopicsBank();
  const user = currentUser();
  const notebookByQuestionId = new Map(getNotebook(currentUserId()).map((n) => [n.questionId, n]));

  const html = questions.length
    ? questions
        .map((q, idx) => {
          const answer = state.answers[q.id];
          const locked = !!answer;
          const activeTab = state.activeQuestionTab[q.id] ?? 'gabarito';
          const notebookItem = notebookByQuestionId.get(q.id);

          return `<article class="question-card" id="question-${q.id}" data-qid="${q.id}">
            <header>
              <h3>${idx + 1}. ${safeText(q.statement)}</h3>
              <p class="meta">${q.grade} • ${subjectLabel(q.subject)} • ${difficultyLabel(q.difficulty)} • ${safeText(getTopicLabel(topics, q.topicId))}</p>
            </header>

            <div class="options">
              ${q.options
                .map((option, optionIndex) => {
                  const checked = answer?.selectedIndex === optionIndex ? 'checked' : '';
                  const disabled = locked ? 'disabled' : '';
                  const isSelected = answer?.selectedIndex === optionIndex;
                  let className = isSelected ? 'option-selected' : '';
                  if (locked && optionIndex === q.correctIndex) className = 'option-correct';
                  if (locked && answer?.selectedIndex === optionIndex && !answer.isCorrect) className = 'option-wrong';
                  return `<label class="option ${className}">
                    <input type="radio" name="opt_${q.id}" value="${optionIndex}" ${checked} ${disabled} />
                    <span class="option-letter">(${optionLetter(optionIndex)})</span>
                    <span>${safeText(option)}</span>
                  </label>`;
                })
                .join('')}
            </div>

            <div class="actions-row">
              <button class="btn-primary" ${locked ? 'disabled' : ''} data-action="confirm">Confirmar</button>
              ${answer ? `<span class="feedback ${answer.isCorrect ? 'ok' : 'error'}">${answer.isCorrect ? '✅ Acertou' : '❌ Errou'}</span>` : ''}
            </div>

            <div class="question-tabs">
              ${Object.entries(QUESTION_TABS)
                .map(([key, label]) => {
                  const isActive = activeTab === key;
                  const isBlocked = key === 'gabarito' && !answer;
                  return `<button class="question-tab-btn ${isActive ? 'active' : ''}" data-action="question-tab" data-tab="${key}" ${isBlocked ? 'title="Responda para liberar"' : ''}>${label}${isBlocked ? ' 🔒' : ''}</button>`;
                })
                .join('')}
            </div>

            <div class="question-tab-panel">
              ${questionTabPanel(activeTab, q, answer, user, notebookItem)}
            </div>
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

  const notebook = getNotebook(userId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
  delete state.answers[questionId];
  renderQuestions();
  const el = document.querySelector(`#question-${questionId}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindTabs() {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.tab);
      if (button.dataset.tab === 'panel-dashboard') renderDashboard();
      if (button.dataset.tab === 'panel-notebook') renderNotebook();
    });
  });
}

function bindFilters() {
  ['grade', 'subject', 'difficulty', 'topicId', 'search'].forEach((key) => {
    document.querySelector(`#filter${key.charAt(0).toUpperCase()}${key.slice(1)}`).addEventListener('input', (event) => {
      state.filters[key] = event.target.value.trim();
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
    const user = currentUser();
    if (!question) return;

    if (event.target.dataset.action === 'confirm') {
      if (!user) return;
      const picked = card.querySelector(`input[name="opt_${questionId}"]:checked`);
      if (!picked) return;

      const selectedIndex = Number(picked.value);
      const isCorrect = selectedIndex === question.correctIndex;
      state.answers[questionId] = { selectedIndex, isCorrect };
      state.activeQuestionTab[questionId] = 'gabarito';

      addAttempt({
        id: Date.now(),
        userId: user.username,
        questionId,
        selectedIndex,
        isCorrect,
        answeredAt: new Date().toISOString()
      });

      if (!isCorrect) {
        upsertNotebookItem(user.username, questionId, { status: 'pending' });
      }

      renderQuestions();
      renderDashboard();
      renderNotebook();
      return;
    }

    if (event.target.dataset.action === 'question-tab') {
      const tab = event.target.dataset.tab;
      if (tab === 'gabarito' && !state.answers[questionId]) return;
      state.activeQuestionTab[questionId] = tab;
      renderQuestions();
      return;
    }

    if (event.target.dataset.action === 'comment') {
      if (!user) return;
      const textarea = card.querySelector('[data-role="comment-input"]');
      const text = textarea?.value.trim();
      if (!text) return;
      addComment(questionId, {
        author: { username: user.username, role: user.role },
        text,
        status: COMMENT_STATUS.open,
        replies: []
      });
      renderQuestions();
      return;
    }

    if (event.target.dataset.action === 'add-notebook') {
      if (!user) return;
      upsertNotebookItem(user.username, questionId, { status: 'pending' });
      state.activeQuestionTab[questionId] = 'caderno';
      renderQuestions();
      renderNotebook();
      return;
    }

    if (event.target.dataset.action === 'save-notebook' || event.target.dataset.action === 'mark-mastered') {
      if (!user) return;
      const whatIErred = card.querySelector('[data-role="whatIErred"]')?.value.trim() ?? '';
      const ruleInsight = card.querySelector('[data-role="ruleInsight"]')?.value.trim() ?? '';
      upsertNotebookItem(user.username, questionId, {
        whatIErred,
        ruleInsight,
        ...(event.target.dataset.action === 'mark-mastered' ? { status: 'mastered' } : {})
      });
      renderQuestions();
      renderNotebook();
      return;
    }

    if (event.target.dataset.action === 'report-error') {
      if (!user) return;
      const type = card.querySelector('[data-role="report-type"]')?.value ?? 'outro';
      const description = card.querySelector('[data-role="report-description"]')?.value.trim() ?? '';
      if (!description) return;
      addQuestionReport({
        userId: user.username,
        questionId,
        type,
        description,
        createdAt: new Date().toISOString()
      });
      const feedback = card.querySelector('[data-role="report-feedback"]');
      if (feedback) feedback.textContent = 'Notificação enviada com sucesso.';
      const textarea = card.querySelector('[data-role="report-description"]');
      if (textarea) textarea.value = '';
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
  document.querySelector('#headerLoginBtn').addEventListener('click', () => {
    document.querySelector('#username')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

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
    renderAuthState();
    renderDashboard();
    renderQuestions();
    renderNotebook();
    activateTab('panel-dashboard');
  });

  document.querySelector('#logoutBtn').addEventListener('click', () => {
    logout();
    state.answers = {};
    state.activeQuestionTab = {};
    renderAuthState();
    activateTab('panel-dashboard');
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

  renderAuthState();
  renderDashboard();
  renderQuestions();
  renderNotebook();
  activateTab('panel-dashboard');
}

init();
