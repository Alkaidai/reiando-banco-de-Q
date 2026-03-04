import { COMMENT_STATUS, DIFFICULTIES, GRADES, SUBJECTS } from './constants.js';
import {
  addComment,
  authenticate,
  getCurrentUser,
  initStorageFromSeeds,
  loadQuestionBank,
  loadTopicsBank,
  logout,
  setCurrentUser
} from './storage.js';
import { difficultyLabel, formatDate, safeText, subjectLabel } from './ui.js';

const state = {
  answers: {},
  filters: { grade: '', subject: '', difficulty: '', topicId: '', search: '' }
};

function getTopicLabel(topics, topicId) {
  return topics.find((topic) => topic.id === topicId)?.label ?? '—';
}

function stats(questions) {
  const values = Object.values(state.answers);
  const answered = values.length;
  const correct = values.filter((item) => item.isCorrect).length;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;
  return { answered, correct, rate, total: questions.length };
}

function renderTopbar() {
  const user = getCurrentUser();
  document.querySelector('#adminLink').classList.toggle('hidden', user?.role !== 'admin');
  document.querySelector('#sessionInfo').textContent = user
    ? `Logado como ${user.username} (${user.role === 'admin' ? 'admin' : 'aluno'})`
    : 'Não autenticado';
}

function applyFilters(questions) {
  return questions.filter((q) => {
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

function renderStats(questions) {
  const s = stats(questions);
  document.querySelector('#statAnswered').textContent = String(s.answered);
  document.querySelector('#statCorrect').textContent = String(s.correct);
  document.querySelector('#statRate').textContent = `${s.rate}%`;
}

function renderQuestions() {
  const questions = applyFilters(loadQuestionBank());
  const topics = loadTopicsBank();
  renderStats(questions);

  const html = questions.length
    ? questions
        .map((q, idx) => {
          const answer = state.answers[q.id];
          const locked = !!answer;
          const visibleComments = (q.comments ?? []).filter((c) => c.status !== COMMENT_STATUS.hidden);
          return `
            <article class="question-card" data-qid="${q.id}">
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
      const picked = card.querySelector(`input[name="opt_${questionId}"]:checked`);
      if (!picked) return;
      const selectedIndex = Number(picked.value);
      state.answers[questionId] = { selectedIndex, isCorrect: selectedIndex === question.correctIndex };
      renderQuestions();
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
  });

  document.querySelector('#logoutBtn').addEventListener('click', () => {
    logout();
    renderTopbar();
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
  bindFilters();
  bindQuestionActions();
  bindAuth();
  renderTopbar();
  renderQuestions();
}

init();
