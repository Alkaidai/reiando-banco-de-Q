import { COMMENT_STATUS, DIFFICULTIES, GRADES, SUBJECTS } from './constants.js';
import {
  addAttempt,
  addComment,
  addReport,
  addTrainingPlan,
  authenticate,
  getAttempts,
  getCurrentUser,
  getNotebook,
  getTopics,
  getTrainingPlanById,
  getStudentDashboardMeta,
  initStorageFromSeeds,
  loadQuestionBank,
  logout,
  saveStudentDashboardMeta,
  setCurrentUser,
  upsertNotebookItem
} from './storage.js';
import { getLessonsForQuestion, loadLessons, renderLessons } from './lessons.js';
import { difficultyCode, difficultyLabel, formatDate, optionLetter, roleLabel, safeText, showToast, statusLabel, subjectCode, subjectLabel, uid } from './ui.js';

const state = {
  answers: {},
  activeQuestionTab: {},
  filters: { grade: '', subject: '', difficulty: '', topicId: '', search: '' },
  notebookFilters: { grade: '', subject: '', difficulty: '', topicId: '', status: '' },
  training: {
    plan: null,
    questionIds: []
  },
  recommendation: {
    lastCreatedPlanId: null
  }
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
  return topics.find((topic) => topic.id === topicId)?.name ?? '—';
}

function filteredQuestions() {
  let questions = loadQuestionBank().filter((q) => q.status !== 'draft');

  if (state.training.plan) {
    const onlyTraining = new Set(state.training.questionIds);
    questions = questions.filter((q) => onlyTraining.has(q.id));
    return state.training.questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean);
  }

  return questions.filter((q) => {
    if (state.filters.grade && q.grade !== state.filters.grade) return false;
    if (state.filters.subject && q.subject !== subjectCode(state.filters.subject)) return false;
    if (state.filters.difficulty && q.difficulty !== difficultyCode(state.filters.difficulty)) return false;
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


function summarizeFilters(filters, topicsMap) {
  const parts = [];
  if (filters.grade) parts.push(filters.grade);
  if (filters.subject) parts.push(subjectLabel(subjectCode(filters.subject)));
  if (filters.difficulty) parts.push(difficultyLabel(difficultyCode(filters.difficulty)));
  if (filters.topicId) parts.push(topicsMap.get(filters.topicId) ?? filters.topicId);
  if (filters.search) parts.push(`Busca: "${filters.search}"`);
  return parts.length ? parts.join(' • ') : 'Sem filtros salvos.';
}

function applyFilters(nextFilters, options = {}) {
  state.filters = {
    grade: String(nextFilters?.grade ?? ''),
    subject: String(nextFilters?.subject ?? ''),
    difficulty: String(nextFilters?.difficulty ?? ''),
    topicId: String(nextFilters?.topicId ?? ''),
    search: String(nextFilters?.search ?? '')
  };

  document.querySelector('#filterGrade').value = state.filters.grade;
  document.querySelector('#filterSubject').value = state.filters.subject;
  document.querySelector('#filterDifficulty').value = state.filters.difficulty;
  document.querySelector('#filterTopicId').value = state.filters.topicId;
  document.querySelector('#filterSearch').value = state.filters.search;

  if (options.persist !== false) saveStudentDashboardMeta(currentUserId(), { lastFilters: state.filters });
  if (options.renderQuestions !== false) renderQuestions();
}

function generateTrainingFromTopic(topicId) {
  const user = currentUser();
  if (!user || !topicId) return;
  const recommendation = getRecommendedTrainingData(getAttempts(user.username));
  const fallbackDistribution = { easy: 3, medium: 5, hard: 2 };

  const target = recommendation?.topicId === topicId
    ? recommendation
    : { topicId, distribution: fallbackDistribution };

  const questionIds = pickRecommendedQuestions({
    userId: user.username,
    topicId,
    qty: 10,
    distribution: target.distribution,
    gradeLevel: user.gradeLevel ?? null
  });

  if (!questionIds.length) {
    showToast('Não foi possível gerar treino para este tópico.');
    return;
  }

  const created = addTrainingPlan(user.username, {
    id: uid('tp'),
    createdAt: new Date().toISOString(),
    topic: topicId,
    qty: 10,
    distribution: target.distribution,
    questionIds
  });

  state.recommendation.lastCreatedPlanId = created.id;
  showToast('Treino criado com sucesso');
  renderDashboard();
}

function weakestTopics(attempts) {
  const questions = new Map(loadQuestionBank().map((q) => [q.id, q]));
  const topicMap = new Map(getTopics().map((t) => [t.id, t.name]));
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
    .slice(0, 5);
}

function getRecommendedTrainingData(attempts) {
  const questionsMap = new Map(loadQuestionBank().map((q) => [q.id, q]));
  const topicsMap = new Map(getTopics().map((t) => [t.id, t.name]));
  const agg = new Map();

  attempts.forEach((attempt) => {
    const q = questionsMap.get(attempt.questionId);
    if (!q?.topicId) return;
    const prev = agg.get(q.topicId) ?? {
      topicId: q.topicId,
      label: topicsMap.get(q.topicId) ?? q.topicId,
      total: 0,
      errors: 0
    };
    prev.total += 1;
    if (!attempt.isCorrect) prev.errors += 1;
    agg.set(q.topicId, prev);
  });

  const eligible = [...agg.values()]
    .filter((x) => x.total >= 3)
    .map((x) => ({ ...x, errorRate: Math.round((x.errors / x.total) * 100) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors);

  if (!eligible.length) return null;

  return {
    ...eligible[0],
    qty: 10,
    distribution: { easy: 3, medium: 5, hard: 2 }
  };
}

function pickRecommendedQuestions({ userId, topicId, qty, distribution, gradeLevel }) {
  const questions = loadQuestionBank().filter((q) => q.status !== 'draft');
  const recentQuestionIds = new Set(
    getAttempts(userId)
      .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
      .slice(0, 30)
      .map((a) => a.questionId)
  );

  const base = questions.filter((q) => q.topicId === topicId && (!gradeLevel || q.grade === gradeLevel));

  const byDifficulty = {
    easy: base.filter((q) => q.difficulty === 'easy'),
    medium: base.filter((q) => q.difficulty === 'medium'),
    hard: base.filter((q) => q.difficulty === 'hard')
  };

  const chosen = [];
  for (const diff of ['easy', 'medium', 'hard']) {
    const need = distribution[diff];
    if (!need) continue;

    const preferred = byDifficulty[diff].filter((q) => !recentQuestionIds.has(q.id));
    const fallback = byDifficulty[diff];
    const pool = [...preferred, ...fallback.filter((q) => !preferred.some((p) => p.id === q.id))];

    for (const q of pool) {
      if (chosen.length >= qty) break;
      if (chosen.some((x) => x.id === q.id)) continue;
      const currentDiffCount = chosen.filter((x) => x.difficulty === diff).length;
      if (currentDiffCount >= need) continue;
      chosen.push(q);
    }
  }

  if (chosen.length < qty) {
    const fallbackPool = [...base.filter((q) => !recentQuestionIds.has(q.id)), ...base];
    for (const q of fallbackPool) {
      if (chosen.length >= qty) break;
      if (chosen.some((x) => x.id === q.id)) continue;
      chosen.push(q);
    }
  }

  return chosen.slice(0, qty).map((q) => q.id);
}

function renderAuthState() {
  const user = currentUser();
  const loggedIn = !!user;

  document.querySelector('#loginView').classList.toggle('hidden', loggedIn);
  document.querySelector('#appView').classList.toggle('hidden', !loggedIn);

  document.querySelector('#adminLink').classList.toggle('hidden', user?.role !== 'admin');
  document.querySelector('#headerLoginBtn').classList.toggle('hidden', loggedIn);
  document.querySelector('#logoutBtn').classList.toggle('hidden', !loggedIn);

  document.querySelector('#headerUserState').textContent = user
    ? `Logado como ${user.username} (${roleLabel(user.role)})`
    : 'Visitante';
}

function renderTrainingHeader() {
  const el = document.querySelector('#trainingModeBanner');
  if (!el) return;

  if (!state.training.plan) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  const total = state.training.questionIds.length;
  const answered = state.training.questionIds.filter((qid) => state.answers[qid]).length;
  const correct = state.training.questionIds.filter((qid) => state.answers[qid]?.isCorrect).length;
  const errors = answered - correct;
  const rate = answered ? Math.round((correct / answered) * 100) : 0;

  const done = answered >= total && total > 0;

  el.classList.remove('hidden');
  el.innerHTML = done
    ? `<strong>Treino concluído</strong> — Acertos: ${correct} | Erros: ${errors} | ${rate}%`
    : `<strong>Modo Treino</strong> — Plano ${safeText(state.training.plan.id)} • ${answered}/${total} respondidas`;
}

function renderRecommendation(attempts) {
  const container = document.querySelector('#recommendedTrainingContent');
  const user = currentUser();
  if (!container || !user) return;

  const recommendation = getRecommendedTrainingData(attempts);
  if (!recommendation) {
    container.innerHTML = '<p class="muted">Responda mais algumas questões para receber um treino recomendado.</p>';
    return;
  }

  const startButton = state.recommendation.lastCreatedPlanId
    ? `<a class="btn-primary" href="./index.html?trainingPlanId=${state.recommendation.lastCreatedPlanId}">Começar treino</a>`
    : '';

  container.innerHTML = `
    <p><strong>${safeText(recommendation.label)}</strong></p>
    <p>Taxa de erro: <strong>${recommendation.errorRate}%</strong> (${recommendation.errors}/${recommendation.total})</p>
    <p>Distribuição: 3F / 5M / 2D</p>
    <div class="actions-row">
      <button class="btn-primary" data-action="generate-recommended-training" data-topic-id="${recommendation.topicId}">Gerar treino agora</button>
      ${startButton}
    </div>
  `;
}

function renderDashboard() {
  const userId = currentUserId();
  const { attempts, answered, correct, rate } = dashboardMetrics();
  const notebook = getNotebook(userId);
  const pendingCount = notebook.filter((item) => item.status === 'pending').length;
  const meta = getStudentDashboardMeta(userId);
  const hasData = attempts.length > 0;

  document.querySelector('#statAnswered').textContent = String(answered);
  document.querySelector('#statRate').textContent = `${rate}%`;
  document.querySelector('#statStreak').textContent = `${meta.streak} dia${meta.streak === 1 ? '' : 's'}`;
  document.querySelector('#statPending').textContent = String(pendingCount);

  document.querySelector('#dashboardEmpty').classList.toggle('hidden', hasData || pendingCount > 0);
  document.querySelector('#dashboardData').classList.remove('hidden');

  renderRecommendation(attempts);

  const topicsMap = new Map(getTopics().map((t) => [t.id, t.name]));
  document.querySelector('#lastFiltersSummary').textContent = summarizeFilters(meta.lastFilters, topicsMap);

  const weak = weakestTopics(attempts);
  document.querySelector('#weakTopics').innerHTML = weak.length
    ? weak
        .map(
          (item, idx) => `<div class="review-item">
            <p><strong>${idx + 1}. ${safeText(item.label)}</strong></p>
            <small>Erro ${item.errorRate}% (${item.errors}/${item.total})</small>
            <div class="actions-row">
              <button class="btn-secondary" data-action="generate-recommended-training" data-topic-id="${item.topicId}">Gerar treino</button>
            </div>
          </div>`
        )
        .join('')
    : '<p class="muted">Sem dados suficientes.</p>';

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

  const recent = [...attempts]
    .sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime())
    .slice(0, 20);

  document.querySelector('#recentHistory').innerHTML = recent.length
    ? recent
        .map((attempt) => {
          const q = questionsById.get(attempt.questionId);
          const icon = attempt.isCorrect ? '✅' : '❌';
          return `<div class="history-item">
            <span class="history-icon">${icon}</span>
            <div>
              <p><strong>${safeText(q?.statement?.slice(0, 90) ?? 'Questão removida')}${q?.statement?.length > 90 ? '...' : ''}</strong></p>
              <small>${formatDate(attempt.answeredAt)} • ${safeText(q?.grade ?? '-')} • ${safeText(subjectLabel(q?.subject ?? '-'))}</small>
            </div>
          </div>`;
        })
        .join('')
    : '<p class="muted">Sem tentativas recentes.</p>';
}

function questionTabPanel(tab, question, answer, user, notebookItem) {
  const visibleComments = (question.comments ?? []).filter((c) => c.status !== COMMENT_STATUS.hidden);

  if (tab === 'gabarito') {
    if (!answer) return '<p class="muted">Responda a questão para liberar o gabarito comentado.</p>';
    return `<p><strong>Resposta correta:</strong> (${optionLetter(question.correctIndex)}) ${safeText(question.options[question.correctIndex])}</p>
      <p>${safeText(question.explanation)}</p>`;
  }

  if (tab === 'aulas') return `<div data-role="lessons-panel" data-question-id="${question.id}"></div>`;

  if (tab === 'comentarios') {
    if (!user) return '<p class="muted">Faça login para visualizar e enviar comentários.</p>';
    return `<div class="comment-list">
      ${visibleComments.length
        ? visibleComments
            .map(
              (comment) => `<div class="comment-item">
                <p><strong>${safeText(comment.author.username)}</strong> • ${formatDate(comment.createdAt)} • ${statusLabel(comment.status)}</p>
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
    return `<label>Tipo do problema</label>
      <select data-role="report-type">
        <option value="enunciado">Enunciado</option>
        <option value="gabarito">Gabarito</option>
        <option value="alternativas">Alternativas</option>
        <option value="explicacao">Explicação</option>
        <option value="outro">Outro</option>
      </select>
      <label>Descreva o problema</label>
      <textarea data-role="report-description" placeholder="Descreva o problema"></textarea>
      <button class="btn-danger" data-action="report-error">Enviar</button>
      <p class="muted" data-role="report-feedback"></p>`;
  }

  return '';
}

function renderQuestions() {
  const questions = filteredQuestions();
  const topics = getTopics();
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

  const questionById = new Map(questions.map((q) => [q.id, q]));
  document.querySelectorAll('[data-role="lessons-panel"]').forEach((container) => {
    const question = questionById.get(container.dataset.questionId);
    renderLessons(container, getLessonsForQuestion(question));
  });

  renderTrainingHeader();
}

function notebookItemMeta(item, question) {
  return {
    grade: item.grade ?? question?.grade ?? '',
    subject: item.subject ?? question?.subject ?? '',
    difficulty: item.difficulty ?? question?.difficulty ?? '',
    topicId: item.topicId ?? question?.topicId ?? ''
  };
}

function notebookTopicLabel(topicId) {
  return getTopics().find((topic) => topic.id === topicId)?.name ?? topicId ?? '—';
}

function filteredNotebookItems(items, questionsById) {
  return items.filter((item) => {
    const question = questionsById.get(item.questionId);
    const meta = notebookItemMeta(item, question);
    if (state.notebookFilters.grade && meta.grade !== state.notebookFilters.grade) return false;
    if (state.notebookFilters.subject && meta.subject !== subjectCode(state.notebookFilters.subject)) return false;
    if (state.notebookFilters.difficulty && meta.difficulty !== difficultyCode(state.notebookFilters.difficulty)) return false;
    if (state.notebookFilters.topicId && meta.topicId !== state.notebookFilters.topicId) return false;
    if (state.notebookFilters.status && item.status !== state.notebookFilters.status) return false;
    return true;
  });
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
  const filtered = filteredNotebookItems(notebook, questions);

  container.innerHTML = filtered.length
    ? filtered
        .map((item) => {
          const q = questions.get(item.questionId);
          if (!q) return '';
          const meta = notebookItemMeta(item, q);
          return `<article class="card notebook-item" data-question-id="${q.id}">
            <h4>${safeText(q.statement)}</h4>
            <p class="meta">${safeText(meta.grade)} • ${subjectLabel(meta.subject)} • ${difficultyLabel(meta.difficulty)} • ${safeText(notebookTopicLabel(meta.topicId))} • Status: ${statusLabel(item.status)}</p>
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
    : '<p class="muted">Nenhum item com os filtros atuais.</p>';
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
      saveStudentDashboardMeta(currentUserId(), { lastFilters: state.filters });
      renderQuestions();
      renderDashboard();
    });
  });
}

function bindNotebookFilters() {
  ['grade', 'subject', 'difficulty', 'topicId', 'status'].forEach((key) => {
    document.querySelector(`#notebookFilter${key.charAt(0).toUpperCase()}${key.slice(1)}`).addEventListener('input', (event) => {
      state.notebookFilters[key] = event.target.value.trim();
      renderNotebook();
    });
  });
}

function hydrateSelects() {
  const topics = getTopics({ activeOnly: true });
  const topicSelect = document.querySelector('#filterTopicId');
  topicSelect.innerHTML = '<option value="">Todos os tópicos</option>' + topics.map((t) => `<option value="${t.id}">${safeText(t.name)}</option>`).join('');

  const notebookTopicSelect = document.querySelector('#notebookFilterTopicId');
  notebookTopicSelect.innerHTML = '<option value="">Todos os tópicos</option>' + topics.map((t) => `<option value="${t.id}">${safeText(t.name)}</option>`).join('');
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

      if (!isCorrect) upsertNotebookItem(user.username, questionId, { status: 'pending' });

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
      const message = card.querySelector('[data-role="report-description"]')?.value.trim() ?? '';
      if (!message) return;
      const topics = getTopics();
      const topicName = topics.find((t) => t.id === question.topicId)?.name ?? question.topicId;
      addReport({
        questionId,
        questionMeta: {
          grade: question.grade,
          subject: question.subject,
          topic: topicName,
          difficulty: question.difficulty,
          preview: question.statement.slice(0, 120)
        },
        type,
        message,
        createdAt: new Date().toISOString(),
        createdBy: { username: user.username, role: user.role },
        status: 'open'
      });
      const feedback = card.querySelector('[data-role="report-feedback"]');
      if (feedback) feedback.textContent = '';
      const textarea = card.querySelector('[data-role="report-description"]');
      if (textarea) textarea.value = '';
      showToast('Erro reportado. Obrigado!');
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

    if (event.target.dataset.action === 'refazer') scrollToQuestion(questionId);
  });
}

function bindDashboardActions() {
  document.querySelector('#reviewNow').addEventListener('click', (event) => {
    if (event.target.dataset.action === 'refazer') scrollToQuestion(event.target.dataset.questionId);
  });

  document.querySelector('#weakTopics').addEventListener('click', (event) => {
    if (event.target.dataset.action !== 'generate-recommended-training') return;
    generateTrainingFromTopic(event.target.dataset.topicId);
  });

  document.querySelector('#recommendedTrainingContent').addEventListener('click', (event) => {
    if (event.target.dataset.action !== 'generate-recommended-training') return;
    generateTrainingFromTopic(event.target.dataset.topicId);
  });

  document.querySelector('#continueTrainingBtn').addEventListener('click', () => {
    const meta = getStudentDashboardMeta(currentUserId());
    applyFilters(meta.lastFilters, { persist: false, renderQuestions: true });
    activateTab('panel-questions');
  });

  document.querySelector('#newTrainingBtn').addEventListener('click', () => {
    applyFilters({ grade: '', subject: '', difficulty: '', topicId: '', search: '' });
    activateTab('panel-questions');
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
    applyFilters(getStudentDashboardMeta(user.username).lastFilters, { persist: false, renderQuestions: false });
    renderDashboard();
    renderQuestions();
    renderNotebook();
    activateTab('panel-dashboard');
  });

  document.querySelector('#logoutBtn').addEventListener('click', () => {
    logout();
    state.answers = {};
    state.activeQuestionTab = {};
    state.recommendation.lastCreatedPlanId = null;
    renderAuthState();
    activateTab('panel-dashboard');
  });
}

function populateSelects() {
  document.querySelector('#filterGrade').innerHTML = '<option value="">Todas as séries</option>' + GRADES.map((g) => `<option value="${g}">${g}</option>`).join('');
  document.querySelector('#filterSubject').innerHTML = '<option value="">Todas as disciplinas</option>' + SUBJECTS.map((label) => `<option value="${label}">${label}</option>`).join('');
  document.querySelector('#filterDifficulty').innerHTML = '<option value="">Todas as dificuldades</option>' + DIFFICULTIES.map((label) => `<option value="${label}">${label}</option>`).join('');

  document.querySelector('#notebookFilterGrade').innerHTML = '<option value="">Todas as séries</option>' + GRADES.map((g) => `<option value="${g}">${g}</option>`).join('');
  document.querySelector('#notebookFilterSubject').innerHTML = '<option value="">Todas as disciplinas</option>' + SUBJECTS.map((label) => `<option value="${label}">${label}</option>`).join('');
  document.querySelector('#notebookFilterDifficulty').innerHTML = '<option value="">Todas as dificuldades</option>' + DIFFICULTIES.map((label) => `<option value="${label}">${label}</option>`).join('');
}

function initTrainingModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const trainingPlanId = params.get('trainingPlanId');
  if (!trainingPlanId) return;

  const plan = getTrainingPlanById(trainingPlanId);
  if (!plan) return;

  state.training.plan = plan;
  state.training.questionIds = plan.questionIds;
  document.querySelector('#trainingModeBanner')?.classList.remove('hidden');
}

async function init() {
  await initStorageFromSeeds();
  await loadLessons();
  initTrainingModeFromUrl();
  populateSelects();
  hydrateSelects();
  bindTabs();
  bindFilters();
  bindNotebookFilters();
  bindQuestionActions();
  bindNotebookActions();
  bindDashboardActions();
  bindAuth();

  renderAuthState();
  const user = currentUser();
  if (user) applyFilters(getStudentDashboardMeta(user.username).lastFilters, { persist: false, renderQuestions: false });
  renderDashboard();
  renderQuestions();
  renderNotebook();
  activateTab('panel-dashboard');
}

init();
