import { COMMENT_STATUS, DIFFICULTIES, GRADES, SUBJECTS } from './constants.js';
import {
  addReply,
  addTrainingPlan,
  authenticate,
  getAdminSelectedStudentId,
  getAttempts,
  getCurrentUser,
  getNotebook,
  getTrainingPlans,
  getUsersByRole,
  initStorageFromSeeds,
  loadQuestionBank,
  loadTopicsBank,
  loadUsers,
  logout,
  resetToSeed,
  saveQuestionBank,
  setAdminSelectedStudentId,
  setCommentStatus,
  setCurrentUser,
  upsertUser
} from './storage.js';
import { difficultyCode, difficultyLabel, formatDate, safeText, subjectCode, subjectLabel, uid } from './ui.js';

const adminState = {
  editingId: null,
  editingUserId: null,
  selectedThread: null,
  selectedUserId: null,
  activePanel: 'dashboard',
  notebookFilter: { status: 'all', search: '' },
  highlightedQuestionId: null,
  dashGradeFilter: 'all'
};

function ensureAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    document.querySelector('#adminApp').innerHTML = '<div class="blocked">Acesso negado. <a href="./index.html">Voltar</a></div>';
    return false;
  }
  document.querySelector('#sessionInfo').textContent = `Logado como ${user.username} (admin)`;
  return true;
}

function setActivePanel(panelId) {
  adminState.activePanel = panelId;
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== panelId));
  document.querySelectorAll('[data-panel]').forEach((item) => item.classList.toggle('active', item.dataset.panel === panelId));
}

function populateFormSelects() {
  document.querySelector('#qGrade').innerHTML = GRADES.map((g) => `<option value="${g}">${g}</option>`).join('');
  document.querySelector('#qSubject').innerHTML = SUBJECTS.map((label) => `<option value="${subjectCode(label)}">${label}</option>`).join('');
  document.querySelector('#qDifficulty').innerHTML = DIFFICULTIES.map((label) => `<option value="${difficultyCode(label)}">${label}</option>`).join('');
  const topics = loadTopicsBank();
  document.querySelector('#qTopic').innerHTML = topics.map((topic) => `<option value="${topic.id}">${safeText(topic.label)}</option>`).join('');
}

function renderQuestionsList() {
  const topics = loadTopicsBank();
  const topicMap = new Map(topics.map((t) => [t.id, t.label]));
  const html = loadQuestionBank()
    .map((q) => {
      const highlighted = adminState.highlightedQuestionId === q.id ? 'question-row-highlight' : '';
      return `<tr class="${highlighted}" data-question-id="${q.id}">
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
      </tr>`;
    })
    .join('');
  document.querySelector('#questionsTableBody').innerHTML = html;

  if (adminState.highlightedQuestionId) {
    const row = document.querySelector(`tr[data-question-id="${adminState.highlightedQuestionId}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
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
    id: adminState.editingId ?? uid('q'),
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

function fillQuestionForm(question) {
  adminState.editingId = question.id;
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

function resetQuestionForm() {
  adminState.editingId = null;
  document.querySelector('#questionForm').reset();
  document.querySelector('#qCorrectIndex').value = '0';
  document.querySelector('#qStatus').value = 'published';
  document.querySelector('#formTitle').textContent = 'Nova questão';
}

function collectStudents() {
  return getUsersByRole('student').sort((a, b) => a.username.localeCompare(b.username));
}

function buildStatsForAttempts(attempts, questionsMap, topicsMap) {
  const answered = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;

  const topicAgg = new Map();
  attempts.forEach((a) => {
    const q = questionsMap.get(a.questionId);
    if (!q?.topicId) return;
    const prev = topicAgg.get(q.topicId) ?? { topicId: q.topicId, label: topicsMap.get(q.topicId) ?? q.topicId, total: 0, errors: 0 };
    prev.total += 1;
    if (!a.isCorrect) prev.errors += 1;
    topicAgg.set(q.topicId, prev);
  });

  const weakTopics = [...topicAgg.values()]
    .filter((x) => x.total > 0)
    .map((x) => ({ ...x, errorRate: Math.round((x.errors / x.total) * 100) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, 10);

  return { answered, correct, rate, weakTopics };
}

function renderDashboard() {
  const questions = loadQuestionBank();
  const attempts = getAttempts();
  const users = loadUsers();
  const students = users.filter((u) => u.role === 'student');
  const topicsMap = new Map(loadTopicsBank().map((t) => [t.id, t.label]));
  const questionsMap = new Map(questions.map((q) => [q.id, q]));

  const published = questions.filter((q) => (q.status ?? 'published') !== 'draft').length;
  const draft = questions.length - published;
  const activeUsers = new Set(attempts.map((a) => a.userId).filter(Boolean)).size;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const globalRate = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;

  const cards = [
    ['Total de questões', questions.length],
    ['Publicadas', published],
    ['Rascunho', draft],
    ['Total de usuários', users.length],
    ['Usuários ativos', activeUsers],
    ['Total de tentativas', attempts.length],
    ['% acerto global', `${globalRate}%`]
  ];

  document.querySelector('#adminDashboardCards').innerHTML = cards
    .map(([title, value]) => `<article class="stat-card"><p>${title}</p><strong>${value}</strong></article>`)
    .join('');

  const renderCountList = (target, entries, formatter = (k) => k) => {
    document.querySelector(target).innerHTML = entries.length
      ? entries.map(([key, value]) => `<li>${safeText(formatter(key))}: <strong>${value}</strong></li>`).join('')
      : '<li class="muted">Sem dados.</li>';
  };

  const countBy = (arr, picker) => {
    const map = new Map();
    arr.forEach((item) => {
      const key = picker(item) ?? '-';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  renderCountList('#dashByGrade', countBy(questions, (q) => q.grade));
  renderCountList('#dashBySubject', countBy(questions, (q) => q.subject), subjectLabel);
  renderCountList('#dashByDifficulty', countBy(questions, (q) => q.difficulty), difficultyLabel);

  const attemptsForTopic = adminState.dashGradeFilter === 'all'
    ? attempts
    : attempts.filter((a) => questionsMap.get(a.questionId)?.grade === adminState.dashGradeFilter);

  const globalWeakTopics = buildStatsForAttempts(attemptsForTopic, questionsMap, topicsMap).weakTopics;
  document.querySelector('#dashWorstTopics').innerHTML = globalWeakTopics.length
    ? globalWeakTopics
        .slice(0, 10)
        .map((t) => `<li>${safeText(t.label)} — erro ${t.errorRate}% (${t.errors}/${t.total})</li>`)
        .join('')
    : '<li class="muted">Sem dados suficientes ainda.</li>';

  const qAgg = new Map();
  attempts.forEach((a) => {
    const prev = qAgg.get(a.questionId) ?? { questionId: a.questionId, total: 0, errors: 0 };
    prev.total += 1;
    if (!a.isCorrect) prev.errors += 1;
    qAgg.set(a.questionId, prev);
  });

  const topWorstQuestions = [...qAgg.values()]
    .filter((x) => x.total > 0)
    .map((x) => ({ ...x, errorRate: Math.round((x.errors / x.total) * 100) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, 10);

  document.querySelector('#dashWorstQuestions').innerHTML = topWorstQuestions.length
    ? topWorstQuestions
        .map((x) => {
          const q = questionsMap.get(x.questionId);
          if (!q) return '';
          return `<div class="review-item">
            <p><strong>${safeText(q.statement.slice(0, 110))}${q.statement.length > 110 ? '...' : ''}</strong></p>
            <small>${q.grade} • ${subjectLabel(q.subject)} • erro ${x.errorRate}% (${x.errors}/${x.total})</small>
          </div>`;
        })
        .join('')
    : '<p class="muted">Sem dados.</p>';

  const worstUsers = students
    .map((student) => {
      const at = getAttempts(student.username);
      const ans = at.length;
      const cor = at.filter((x) => x.isCorrect).length;
      const rate = ans ? Math.round((cor / ans) * 100) : 0;
      return { student, answered: ans, correct: cor, rate };
    })
    .filter((r) => r.answered >= 5)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 10);

  document.querySelector('#dashWorstUsers').innerHTML = worstUsers.length
    ? `<table class="table"><thead><tr><th>username</th><th>turma</th><th>respondidas</th><th>acertos</th><th>aproveitamento</th></tr></thead><tbody>
      ${worstUsers
        .map(
          (r) => `<tr><td>${safeText(r.student.username)}</td><td>${r.student.gradeLevel ?? '—'}</td><td>${r.answered}</td><td>${r.correct}</td><td>${r.rate}%</td></tr>`
        )
        .join('')}
      </tbody></table>`
    : '<p class="muted">Sem dados suficientes ainda.</p>';
}

function renderUsersPanel() {
  const users = loadUsers().sort((a, b) => a.username.localeCompare(b.username));
  const students = users.filter((u) => u.role === 'student');

  if (!adminState.selectedUserId && students.length) {
    adminState.selectedUserId = students[0].username;
  }

  document.querySelector('#usersList').innerHTML = users.length
    ? users
        .map(
          (user) => `<button class="thread-item ${adminState.selectedUserId === user.username ? 'active-user' : ''}" data-action="select-user" data-user-id="${user.username}">
            <strong>${safeText(user.username)}</strong>
            <span>${user.role} • ${user.status} • ${user.gradeLevel ?? 'sem turma'}</span>
            <span>Último login: ${user.lastLoginAt ? formatDate(user.lastLoginAt) : 'nunca'}</span>
          </button>`
        )
        .join('')
    : '<p class="muted">Nenhum usuário encontrado.</p>';

  const notebookStudentSelect = document.querySelector('#notebookStudentSelect');
  notebookStudentSelect.innerHTML = '<option value="">Selecione aluno</option>' + students.map((s) => `<option value="${s.username}">${safeText(s.username)} (${s.gradeLevel ?? 'sem turma'})</option>`).join('');
  notebookStudentSelect.value = adminState.selectedUserId ?? '';

  const container = document.querySelector('#userInspectionDetails');
  if (!adminState.selectedUserId) {
    container.innerHTML = '<p class="muted">Selecione um usuário para inspecionar.</p>';
    return;
  }

  const selected = users.find((u) => u.username === adminState.selectedUserId);
  if (!selected) {
    container.innerHTML = '<p class="muted">Usuário não encontrado.</p>';
    return;
  }

  const questions = loadQuestionBank();
  const questionsMap = new Map(questions.map((q) => [q.id, q]));
  const topicsMap = new Map(loadTopicsBank().map((t) => [t.id, t.label]));
  const attempts = getAttempts(adminState.selectedUserId).sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
  const stats = buildStatsForAttempts(attempts, questionsMap, topicsMap);
  const topics = loadTopicsBank();

  const trainingHistory = getTrainingPlans(selected.username).slice(0, 5);

  container.innerHTML = `
    <h3>Inspeção: ${safeText(selected.username)}</h3>
    <p><strong>Turma:</strong> ${selected.gradeLevel ?? 'sem turma'} • <strong>Status:</strong> ${selected.status}</p>
    <p><strong>Respondidas:</strong> ${stats.answered} | <strong>Acertos:</strong> ${stats.correct} | <strong>Aproveitamento:</strong> ${stats.rate}%</p>
    <h4>Tópicos mais fracos</h4>
    <ul>
      ${stats.weakTopics.length
        ? stats.weakTopics.slice(0, 5).map((t) => `<li>${safeText(t.label)} — erro ${t.errorRate}% (${t.errors}/${t.total})</li>`).join('')
        : '<li class="muted">Sem dados.</li>'}
    </ul>
    <h4>Tentativas recentes (20)</h4>
    <div>
      ${attempts.slice(0, 20).map((a) => {
        const q = questionsMap.get(a.questionId);
        return `<div class="review-item">
          <p><strong>${safeText(q?.statement?.slice(0, 90) ?? a.questionId)}${q?.statement?.length > 90 ? '...' : ''}</strong></p>
          <small>${formatDate(a.answeredAt)} • ${a.isCorrect ? '✅ Acerto' : '❌ Erro'}</small>
        </div>`;
      }).join('') || '<p class="muted">Sem tentativas.</p>'}
    </div>
    <button class="btn-secondary" data-action="go-notebook">Ver caderno</button>

    <hr />
    <h4>GERAR TREINO</h4>
    <div class="question-form">
      <select id="trainingTopic">
        ${topics.map((t) => `<option value="${t.id}">${safeText(t.label)}</option>`).join('')}
      </select>
      <select id="trainingQty">
        <option value="10">10</option><option value="15">15</option><option value="20">20</option>
      </select>
      <div class="actions-row">
        <input id="trainingEasy" type="number" min="0" value="3" placeholder="Fáceis" />
        <input id="trainingMedium" type="number" min="0" value="5" placeholder="Médias" />
        <input id="trainingHard" type="number" min="0" value="2" placeholder="Difíceis" />
      </div>
      <button class="btn-primary" data-action="generate-training" data-user-id="${safeText(selected.username)}">Gerar treino</button>
      <p id="trainingFeedback" class="muted"></p>
    </div>

    <h4>Treinos recentes</h4>
    <div>
      ${trainingHistory.length ? trainingHistory.map((plan) => `<div class="review-item"><p><strong>${safeText(plan.topic)}</strong> (${plan.qty} questões)</p><small>${formatDate(plan.createdAt)} • ID: ${plan.id}</small></div>`).join('') : '<p class="muted">Sem treinos gerados.</p>'}
    </div>
  `;
}

function pickQuestionsForTraining({ userId, topic, qty, distribution }) {
  const user = loadUsers().find((u) => u.username === userId);
  const questions = loadQuestionBank();
  const recentQuestionIds = new Set(getAttempts(userId).sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt)).slice(0, 30).map((a) => a.questionId));

  const byDiff = {
    easy: questions.filter((q) => q.topicId === topic && q.difficulty === 'easy' && q.status !== 'draft'),
    medium: questions.filter((q) => q.topicId === topic && q.difficulty === 'medium' && q.status !== 'draft'),
    hard: questions.filter((q) => q.topicId === topic && q.difficulty === 'hard' && q.status !== 'draft')
  };

  if (user?.gradeLevel) {
    Object.keys(byDiff).forEach((k) => {
      byDiff[k] = byDiff[k].filter((q) => q.grade === user.gradeLevel);
    });
  }

  const chosen = [];
  for (const diff of ['easy', 'medium', 'hard']) {
    const need = distribution[diff];
    if (!need) continue;

    const preferred = byDiff[diff].filter((q) => !recentQuestionIds.has(q.id));
    const fallback = byDiff[diff];
    const pool = [...preferred, ...fallback.filter((q) => preferred.every((p) => p.id !== q.id))];

    for (const q of pool) {
      if (chosen.length >= qty || chosen.filter((x) => x.id === q.id).length) continue;
      chosen.push(q);
      if (chosen.filter((x) => x.difficulty === diff).length >= need) break;
    }
  }

  if (chosen.length < qty) {
    const extraPool = questions.filter((q) => q.topicId === topic && q.status !== 'draft' && (!user?.gradeLevel || q.grade === user.gradeLevel));
    for (const q of extraPool) {
      if (chosen.length >= qty) break;
      if (chosen.some((x) => x.id === q.id)) continue;
      chosen.push(q);
    }
  }

  return chosen.slice(0, qty).map((q) => q.id);
}

function renderNotebookPanel() {
  const container = document.querySelector('#adminNotebookList');
  if (!adminState.selectedUserId) {
    container.innerHTML = '<p class="muted">Selecione um usuário em Usuários.</p>';
    return;
  }

  setAdminSelectedStudentId(adminState.selectedUserId);

  const statusFilter = adminState.notebookFilter.status;
  const search = adminState.notebookFilter.search.toLowerCase();
  const questionsMap = new Map(loadQuestionBank().map((q) => [q.id, q]));

  const rows = getNotebook(adminState.selectedUserId)
    .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
    .filter((item) => {
      if (!search) return true;
      const q = questionsMap.get(item.questionId);
      const hay = `${item.whatIErred} ${item.ruleInsight} ${q?.statement ?? ''}`.toLowerCase();
      return hay.includes(search);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  container.innerHTML = rows.length
    ? rows
        .map((item) => {
          const q = questionsMap.get(item.questionId);
          return `<article class="card notebook-item">
            <h4>${safeText(q?.statement ?? item.questionId)}</h4>
            <p class="meta">${q ? `${q.grade} • ${subjectLabel(q.subject)} • ${difficultyLabel(q.difficulty)}` : 'Questão removida'} • status: ${item.status}</p>
            <label>O que eu errei?</label>
            <textarea readonly>${safeText(item.whatIErred)}</textarea>
            <label>Regra / insight</label>
            <textarea readonly>${safeText(item.ruleInsight)}</textarea>
            <button class="btn-secondary" data-action="open-question" data-question-id="${item.questionId}">Abrir questão</button>
          </article>`;
        })
        .join('')
    : '<p class="muted">Nenhum item no caderno para os filtros selecionados.</p>';
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
          ({ question, comment, topic }) => `<button class="thread-item" data-question-id="${question.id}" data-comment-id="${comment.id}">
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
  if (!adminState.selectedThread) {
    panel.innerHTML = '<p class="muted">Selecione um comentário para ver detalhes.</p>';
    return;
  }

  const question = loadQuestionBank().find((q) => q.id === adminState.selectedThread.questionId);
  const comment = question?.comments.find((c) => c.id === adminState.selectedThread.commentId);
  if (!question || !comment) {
    adminState.selectedThread = null;
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
    addReply(adminState.selectedThread.questionId, adminState.selectedThread.commentId, {
      author: { username: 'admin', role: 'admin' },
      text
    });
    renderCommentsPanel();
  });

  panel.querySelector('#reopenBtn').addEventListener('click', () => {
    setCommentStatus(adminState.selectedThread.questionId, adminState.selectedThread.commentId, COMMENT_STATUS.open);
    renderCommentsPanel();
  });

  panel.querySelector('#hideBtn').addEventListener('click', () => {
    setCommentStatus(adminState.selectedThread.questionId, adminState.selectedThread.commentId, COMMENT_STATUS.hidden);
    renderCommentsPanel();
  });
}

function refreshAdminViews() {
  renderQuestionsList();
  renderDashboard();
  renderUsersPanel();
  renderNotebookPanel();
  renderCommentsPanel();
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
    resetQuestionForm();
    refreshAdminViews();
  });

  document.querySelector('#questionsTableBody').addEventListener('click', (event) => {
    const id = event.target.dataset.id;
    if (!id) return;
    const bank = loadQuestionBank();

    if (event.target.dataset.action === 'delete') {
      saveQuestionBank(bank.filter((item) => item.id !== id));
      refreshAdminViews();
    }

    if (event.target.dataset.action === 'edit') {
      const target = bank.find((item) => item.id === id);
      if (target) fillQuestionForm(target);
    }
  });

  document.querySelector('#newQuestionBtn').addEventListener('click', () => resetQuestionForm());

  document.querySelector('#resetSeedBtn').addEventListener('click', async () => {
    await resetToSeed();
    populateFormSelects();
    resetQuestionForm();
    adminState.highlightedQuestionId = null;
    refreshAdminViews();
  });
}

function bindUsers() {
  document.querySelector('#usersList').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="select-user"]');
    if (!btn) return;
    adminState.selectedUserId = btn.dataset.userId;
    setAdminSelectedStudentId(adminState.selectedUserId);

    const selected = loadUsers().find((u) => u.username === adminState.selectedUserId);
    adminState.editingUserId = selected?.id ?? null;
    if (selected) {
      document.querySelector('#uUsername').value = selected.username;
      document.querySelector('#uPassword').value = selected.password;
      document.querySelector('#uRole').value = selected.role;
      document.querySelector('#uStatus').value = selected.status;
      document.querySelector('#uGradeLevel').value = selected.gradeLevel ?? '';
    }

    renderUsersPanel();
    renderNotebookPanel();
  });

  document.querySelector('#userInspectionDetails').addEventListener('click', (event) => {
    if (event.target.dataset.action === 'go-notebook') {
      setActivePanel('notebook');
      renderNotebookPanel();
    }

    if (event.target.dataset.action === 'generate-training') {
      const userId = event.target.dataset.userId;
      const topic = document.querySelector('#trainingTopic').value;
      const qty = Number(document.querySelector('#trainingQty').value);
      const distribution = {
        easy: Number(document.querySelector('#trainingEasy').value || 0),
        medium: Number(document.querySelector('#trainingMedium').value || 0),
        hard: Number(document.querySelector('#trainingHard').value || 0)
      };

      const sum = distribution.easy + distribution.medium + distribution.hard;
      const feedback = document.querySelector('#trainingFeedback');
      if (sum !== qty) {
        feedback.textContent = 'A soma de fáceis/médias/difíceis deve ser igual à quantidade.';
        return;
      }

      const questionIds = pickQuestionsForTraining({ userId, topic, qty, distribution });
      if (!questionIds.length) {
        feedback.textContent = 'Não foi possível montar treino com os filtros informados.';
        return;
      }

      const created = addTrainingPlan(userId, {
        id: uid('tp'),
        createdAt: new Date().toISOString(),
        topic,
        qty,
        distribution,
        questionIds
      });

      feedback.innerHTML = `Treino criado com sucesso.<br/>${safeText(topic)} (${qty} questões) • F:${distribution.easy} M:${distribution.medium} D:${distribution.hard}<br/><a href="./index.html?trainingPlanId=${created.id}" target="_blank">Abrir treino como aluno</a>`;
      renderUsersPanel();
    }
  });

  document.querySelector('#userForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.querySelector('#uUsername').value.trim();
    const password = document.querySelector('#uPassword').value.trim();
    const role = document.querySelector('#uRole').value;
    const status = document.querySelector('#uStatus').value;
    const gradeLevel = document.querySelector('#uGradeLevel').value || null;
    const feedback = document.querySelector('#userFormFeedback');

    if (!username || !password) {
      feedback.textContent = 'Usuário e senha são obrigatórios.';
      return;
    }

    const saved = upsertUser({
      id: adminState.editingUserId,
      username,
      password,
      role,
      status,
      gradeLevel
    });

    adminState.editingUserId = saved.id;
    adminState.selectedUserId = saved.username;
    setAdminSelectedStudentId(saved.username);
    feedback.textContent = 'Usuário salvo com sucesso.';
    renderUsersPanel();
    renderNotebookPanel();
    renderDashboard();
  });
}

function bindNotebookPanel() {
  document.querySelector('#notebookStudentSelect').addEventListener('change', (event) => {
    adminState.selectedUserId = event.target.value || null;
    setAdminSelectedStudentId(adminState.selectedUserId);
    renderUsersPanel();
    renderNotebookPanel();
  });

  document.querySelector('#notebookStatusFilter').addEventListener('change', (event) => {
    adminState.notebookFilter.status = event.target.value;
    renderNotebookPanel();
  });

  document.querySelector('#notebookSearchFilter').addEventListener('input', (event) => {
    adminState.notebookFilter.search = event.target.value.trim();
    renderNotebookPanel();
  });

  document.querySelector('#adminNotebookList').addEventListener('click', (event) => {
    if (event.target.dataset.action === 'open-question') {
      adminState.highlightedQuestionId = event.target.dataset.questionId;
      setActivePanel('questions');
      renderQuestionsList();
    }
  });
}

function bindComments() {
  document.querySelector('#commentFilter').addEventListener('change', renderCommentsPanel);
  document.querySelector('#commentList').addEventListener('click', (event) => {
    const button = event.target.closest('.thread-item');
    if (!button) return;
    adminState.selectedThread = {
      questionId: button.dataset.questionId,
      commentId: button.dataset.commentId
    };
    renderSelectedThread();
  });
}

function bindMenu() {
  document.querySelectorAll('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => setActivePanel(button.dataset.panel));
  });

  document.querySelector('#dashGradeFilter').addEventListener('change', (event) => {
    adminState.dashGradeFilter = event.target.value;
    renderDashboard();
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

  adminState.selectedUserId = getAdminSelectedStudentId();

  populateFormSelects();
  resetQuestionForm();

  bindQuestionCrud();
  bindComments();
  bindUsers();
  bindNotebookPanel();
  bindMenu();

  refreshAdminViews();
  setActivePanel('dashboard');
}

init();
