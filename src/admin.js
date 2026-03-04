import { COMMENT_STATUS, DIFFICULTIES, GRADES, SUBJECTS } from './constants.js';
import {
  addReply,
  authenticate,
  getCurrentUser,
  initStorageFromSeeds,
  loadQuestionBank,
  loadTopicsBank,
  logout,
  resetToSeed,
  saveQuestionBank,
  setCommentStatus,
  setCurrentUser
} from './storage.js';
import { difficultyLabel, formatDate, safeText, subjectLabel, uid } from './ui.js';

let editingId = null;
let selectedThread = null;

function ensureAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    document.querySelector('#adminApp').innerHTML = '<div class="blocked">Acesso negado. <a href="./index.html">Voltar</a></div>';
    return false;
  }
  document.querySelector('#sessionInfo').textContent = `Logado como ${user.username} (admin)`;
  return true;
}

function populateFormSelects() {
  document.querySelector('#qGrade').innerHTML = GRADES.map((g) => `<option value="${g}">${g}</option>`).join('');
  document.querySelector('#qSubject').innerHTML = SUBJECTS.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');
  document.querySelector('#qDifficulty').innerHTML = DIFFICULTIES.map((d) => `<option value="${d.value}">${d.label}</option>`).join('');
  const topics = loadTopicsBank();
  document.querySelector('#qTopic').innerHTML = topics.map((topic) => `<option value="${topic.id}">${safeText(topic.label)}</option>`).join('');
}

function renderQuestionsList() {
  const topics = loadTopicsBank();
  const topicMap = new Map(topics.map((t) => [t.id, t.label]));
  const html = loadQuestionBank()
    .map(
      (q) => `
      <tr>
        <td>${q.grade}</td>
        <td>${subjectLabel(q.subject)}</td>
        <td>${difficultyLabel(q.difficulty)}</td>
        <td>${safeText(topicMap.get(q.topicId) ?? '-')}</td>
        <td>${safeText(q.statement.slice(0, 80))}${q.statement.length > 80 ? '...' : ''}</td>
        <td>${q.status}</td>
        <td>
          <button data-action="edit" data-id="${q.id}" class="btn-secondary">Editar</button>
          <button data-action="delete" data-id="${q.id}" class="btn-danger">Excluir</button>
        </td>
      </tr>`
    )
    .join('');
  document.querySelector('#questionsTableBody').innerHTML = html;
}

function validateQuestion(payload) {
  if (!payload.statement) return 'Enunciado é obrigatório.';
  if (payload.options.length < 2) return 'Informe no mínimo 2 alternativas.';
  if (payload.options.some((o) => !o)) return 'Todas as alternativas preenchidas devem ter texto.';
  if (payload.correctIndex < 0 || payload.correctIndex >= payload.options.length) return 'Índice da alternativa correta inválido.';
  return null;
}

function getFormData() {
  const options = document.querySelector('#qOptions').value.split('\n').map((item) => item.trim()).filter(Boolean);
  return {
    id: editingId ?? uid('q'),
    grade: document.querySelector('#qGrade').value,
    subject: document.querySelector('#qSubject').value,
    difficulty: document.querySelector('#qDifficulty').value,
    topicId: document.querySelector('#qTopic').value,
    statement: document.querySelector('#qStatement').value.trim(),
    options,
    correctIndex: Number(document.querySelector('#qCorrectIndex').value),
    explanation: document.querySelector('#qExplanation').value.trim(),
    status: document.querySelector('#qStatus').value,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: []
  };
}

function fillForm(question) {
  editingId = question.id;
  document.querySelector('#qGrade').value = question.grade;
  document.querySelector('#qSubject').value = question.subject;
  document.querySelector('#qDifficulty').value = question.difficulty;
  document.querySelector('#qTopic').value = question.topicId;
  document.querySelector('#qStatement').value = question.statement;
  document.querySelector('#qOptions').value = question.options.join('\n');
  document.querySelector('#qCorrectIndex').value = String(question.correctIndex);
  document.querySelector('#qExplanation').value = question.explanation;
  document.querySelector('#qStatus').value = question.status;
  document.querySelector('#formTitle').textContent = 'Editar questão';
}

function resetForm() {
  editingId = null;
  document.querySelector('#questionForm').reset();
  document.querySelector('#qCorrectIndex').value = '0';
  document.querySelector('#qStatus').value = 'published';
  document.querySelector('#formTitle').textContent = 'Nova questão';
}

function bindQuestionCrud() {
  document.querySelector('#questionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = getFormData();
    const error = validateQuestion(payload);
    const feedback = document.querySelector('#formFeedback');
    if (error) {
      feedback.textContent = error;
      return;
    }

    const bank = loadQuestionBank();
    const existing = bank.find((item) => item.id === payload.id);
    if (existing) {
      payload.createdAt = existing.createdAt;
      payload.comments = existing.comments ?? [];
      const idx = bank.findIndex((item) => item.id === payload.id);
      bank[idx] = payload;
    } else {
      bank.unshift(payload);
    }
    saveQuestionBank(bank);
    feedback.textContent = 'Questão salva com sucesso.';
    resetForm();
    renderQuestionsList();
    renderCommentsPanel();
  });

  document.querySelector('#questionsTableBody').addEventListener('click', (event) => {
    const id = event.target.dataset.id;
    if (!id) return;
    const bank = loadQuestionBank();

    if (event.target.dataset.action === 'delete') {
      saveQuestionBank(bank.filter((item) => item.id !== id));
      renderQuestionsList();
      renderCommentsPanel();
    }

    if (event.target.dataset.action === 'edit') {
      const target = bank.find((item) => item.id === id);
      if (target) fillForm(target);
    }
  });

  document.querySelector('#newQuestionBtn').addEventListener('click', () => resetForm());

  document.querySelector('#resetSeedBtn').addEventListener('click', async () => {
    await resetToSeed();
    populateFormSelects();
    renderQuestionsList();
    renderCommentsPanel();
    resetForm();
  });
}

function listComments() {
  const filter = document.querySelector('#commentFilter').value;
  const questions = loadQuestionBank();
  const topics = new Map(loadTopicsBank().map((t) => [t.id, t.label]));
  const rows = [];

  questions.forEach((question) => {
    (question.comments ?? []).forEach((comment) => {
      if (filter !== 'all' && comment.status !== filter) return;
      rows.push({ question, comment, topic: topics.get(question.topicId) ?? '-' });
    });
  });

  return rows;
}

function renderCommentsPanel() {
  const items = listComments();
  document.querySelector('#commentList').innerHTML = items.length
    ? items
        .map(
          ({ question, comment, topic }) => `
        <button class="thread-item" data-question-id="${question.id}" data-comment-id="${comment.id}">
          <strong>${safeText(comment.text.slice(0, 60))}${comment.text.length > 60 ? '...' : ''}</strong>
          <span>${safeText(comment.author.username)} • ${formatDate(comment.createdAt)}</span>
          <span>${question.grade} • ${subjectLabel(question.subject)} • ${safeText(topic)}</span>
          <span>Status: ${comment.status}</span>
        </button>`
        )
        .join('')
    : '<p class="muted">Sem comentários para este filtro.</p>';

  renderSelectedThread();
}

function renderSelectedThread() {
  const panel = document.querySelector('#threadDetails');
  if (!selectedThread) {
    panel.innerHTML = '<p class="muted">Selecione um comentário para ver detalhes.</p>';
    return;
  }

  const question = loadQuestionBank().find((q) => q.id === selectedThread.questionId);
  const comment = question?.comments.find((c) => c.id === selectedThread.commentId);
  if (!question || !comment) {
    selectedThread = null;
    panel.innerHTML = '<p class="muted">Comentário não encontrado.</p>';
    return;
  }

  panel.innerHTML = `
    <h4>Thread selecionada</h4>
    <p><strong>Questão:</strong> ${safeText(question.statement)}</p>
    <div class="comment-item">
      <p><strong>${safeText(comment.author.username)}</strong> • ${formatDate(comment.createdAt)} • ${comment.status}</p>
      <p>${safeText(comment.text)}</p>
      ${(comment.replies ?? [])
        .map((reply) => `<div class="reply"><strong>${safeText(reply.author.username)}:</strong> ${safeText(reply.text)} <small>${formatDate(reply.createdAt)}</small></div>`)
        .join('')}
    </div>
    <textarea id="replyText" placeholder="Responder comentário"></textarea>
    <div class="actions-row">
      <button class="btn-primary" id="replyBtn">Responder</button>
      <button class="btn-secondary" id="reopenBtn">Reabrir</button>
      <button class="btn-danger" id="hideBtn">Ocultar</button>
    </div>
  `;

  panel.querySelector('#replyBtn').addEventListener('click', () => {
    const text = panel.querySelector('#replyText').value.trim();
    if (!text) return;
    addReply(selectedThread.questionId, selectedThread.commentId, {
      author: { username: 'admin', role: 'admin' },
      text
    });
    renderCommentsPanel();
  });

  panel.querySelector('#reopenBtn').addEventListener('click', () => {
    setCommentStatus(selectedThread.questionId, selectedThread.commentId, COMMENT_STATUS.open);
    renderCommentsPanel();
  });

  panel.querySelector('#hideBtn').addEventListener('click', () => {
    setCommentStatus(selectedThread.questionId, selectedThread.commentId, COMMENT_STATUS.hidden);
    renderCommentsPanel();
  });
}

function bindComments() {
  document.querySelector('#commentFilter').addEventListener('change', renderCommentsPanel);
  document.querySelector('#commentList').addEventListener('click', (event) => {
    const button = event.target.closest('.thread-item');
    if (!button) return;
    selectedThread = {
      questionId: button.dataset.questionId,
      commentId: button.dataset.commentId
    };
    renderSelectedThread();
  });
}

function bindMenu() {
  document.querySelectorAll('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.panel;
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== target));
      document.querySelectorAll('[data-panel]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
}

function bindAuth() {
  document.querySelector('#adminLoginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.querySelector('#adminUser').value.trim();
    const password = document.querySelector('#adminPass').value.trim();
    const user = authenticate(username, password);
    const feedback = document.querySelector('#adminLoginFeedback');
    if (!user || user.role !== 'admin') {
      feedback.textContent = 'Credenciais admin inválidas.';
      return;
    }
    setCurrentUser(user);
    feedback.textContent = '';
    location.reload();
  });

  document.querySelector('#logoutBtn').addEventListener('click', () => {
    logout();
    location.reload();
  });
}

function showLoginOrPanel() {
  const user = getCurrentUser();
  document.querySelector('#loginBlock').classList.toggle('hidden', !!user);
  document.querySelector('#adminApp').classList.toggle('hidden', !user);
}

async function init() {
  await initStorageFromSeeds();
  bindAuth();
  showLoginOrPanel();
  if (!getCurrentUser()) return;
  if (!ensureAdmin()) return;

  populateFormSelects();
  resetForm();
  renderQuestionsList();
  bindQuestionCrud();

  bindComments();
  renderCommentsPanel();

  bindMenu();
}

init();
