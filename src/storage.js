import { COMMENT_STATUS, GRADES, SEED_VERSION, STORAGE_KEYS, USERS } from './constants.js';

let inMemoryQuestions = [];
let inMemoryTopics = [];
let inMemoryLessons = [];

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeReply(reply) {
  return {
    id: reply?.id ?? newId('rep'),
    author: {
      username: reply?.author?.username ?? 'admin',
      role: reply?.author?.role ?? 'admin'
    },
    createdAt: reply?.createdAt ?? nowIso(),
    text: String(reply?.text ?? '').trim()
  };
}

function normalizeComment(comment) {
  return {
    id: comment?.id ?? newId('cmt'),
    author: {
      username: comment?.author?.username ?? 'anônimo',
      role: comment?.author?.role ?? 'student'
    },
    createdAt: comment?.createdAt ?? nowIso(),
    text: String(comment?.text ?? '').trim(),
    status: [COMMENT_STATUS.open, COMMENT_STATUS.answered, COMMENT_STATUS.hidden].includes(comment?.status)
      ? comment.status
      : COMMENT_STATUS.open,
    replies: Array.isArray(comment?.replies)
      ? comment.replies.map(normalizeReply).filter((reply) => reply.text)
      : []
  };
}

function normalizeQuestion(question) {
  const createdAt = question?.createdAt ?? nowIso();
  return {
    id: String(question?.id ?? newId('q')),
    grade: question?.grade ?? '7EF',
    subject: question?.subject ?? 'math',
    difficulty: question?.difficulty ?? 'easy',
    topicId: question?.topicId ?? '',
    statement: String(question?.statement ?? '').trim(),
    options: Array.isArray(question?.options)
      ? question.options.map((o) => String(o ?? '').trim()).filter(Boolean)
      : [],
    correctIndex: Number.isInteger(question?.correctIndex) ? question.correctIndex : 0,
    explanation: String(question?.explanation ?? '').trim(),
    status: question?.status === 'draft' ? 'draft' : 'published',
    createdAt,
    updatedAt: question?.updatedAt ?? createdAt,
    comments: Array.isArray(question?.comments) ? question.comments.map(normalizeComment).filter((c) => c.text) : []
  };
}

function normalizeAttempt(attempt) {
  return {
    id: attempt?.id ?? Date.now(),
    userId: String(attempt?.userId ?? ''),
    questionId: String(attempt?.questionId ?? ''),
    selectedIndex: Number(attempt?.selectedIndex ?? -1),
    isCorrect: Boolean(attempt?.isCorrect),
    answeredAt: attempt?.answeredAt ?? nowIso()
  };
}

function normalizeNotebookItem(item) {
  return {
    userId: String(item?.userId ?? ''),
    questionId: String(item?.questionId ?? ''),
    grade: item?.grade ? String(item.grade) : null,
    subject: item?.subject ? String(item.subject) : null,
    difficulty: item?.difficulty ? String(item.difficulty) : null,
    topicId: item?.topicId ? String(item.topicId) : null,
    status: item?.status === 'mastered' ? 'mastered' : 'pending',
    whatIErred: String(item?.whatIErred ?? ''),
    ruleInsight: String(item?.ruleInsight ?? ''),
    updatedAt: item?.updatedAt ?? nowIso()
  };
}

function normalizeUser(user) {
  return {
    id: String(user?.id ?? newId('usr')),
    username: String(user?.username ?? '').trim(),
    password: String(user?.password ?? ''),
    role: user?.role === 'admin' ? 'admin' : 'student',
    status: user?.status === 'blocked' ? 'blocked' : 'active',
    gradeLevel: GRADES.includes(user?.gradeLevel) ? user.gradeLevel : null,
    createdAt: user?.createdAt ?? nowIso(),
    lastLoginAt: user?.lastLoginAt ?? null
  };
}

function normalizeTrainingPlan(plan) {
  return {
    id: String(plan?.id ?? newId('tp')),
    createdAt: plan?.createdAt ?? nowIso(),
    topic: String(plan?.topic ?? ''),
    qty: Number(plan?.qty ?? 0),
    distribution: {
      easy: Number(plan?.distribution?.easy ?? 0),
      medium: Number(plan?.distribution?.medium ?? 0),
      hard: Number(plan?.distribution?.hard ?? 0)
    },
    questionIds: Array.isArray(plan?.questionIds) ? plan.questionIds.map(String) : []
  };
}

function normalizeLesson(lesson) {
  return {
    id: String(lesson?.id ?? newId('lesson')),
    title: String(lesson?.title ?? '').trim(),
    url: String(lesson?.url ?? '').trim(),
    topic: String(lesson?.topic ?? '').trim(),
    subject: String(lesson?.subject ?? '').trim(),
    grade: String(lesson?.grade ?? '').trim()
  };
}

function normalizeTopic(topic) {
  const name = String(topic?.name ?? topic?.label ?? topic?.id ?? '').trim();
  const gradeFromLegacy = Array.isArray(topic?.grades) && topic.grades.length === 1 ? String(topic.grades[0]) : 'all';
  const grade = String(topic?.grade ?? gradeFromLegacy ?? 'all').trim() || 'all';
  return {
    id: String(topic?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')).trim(),
    name,
    label: name,
    subject: String(topic?.subject ?? '').trim(),
    grade,
    status: topic?.status === 'inactive' ? 'inactive' : 'active'
  };
}

export async function ensureTopicsSeedLoaded() {
  const existing = parseJson(localStorage.getItem(STORAGE_KEYS.topicsBank), null);
  if (Array.isArray(existing) && existing.length) {
    inMemoryTopics = existing.map(normalizeTopic);
    return inMemoryTopics;
  }

  const topicsRes = await fetch('./data/topics.seed.json');
  const topicsSeed = await topicsRes.json();
  const normalized = Array.isArray(topicsSeed) ? topicsSeed.map(normalizeTopic) : [];
  saveTopicsBank(normalized);
  return normalized;
}

export async function initTopicsFromSeed() {
  return ensureTopicsSeedLoaded();
}

function ensureUsersSeeded() {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.users), null);
  if (Array.isArray(stored) && stored.length) return;
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(USERS.map(normalizeUser)));
}

export async function initStorageFromSeeds() {
  ensureUsersSeeded();
  await ensureTopicsSeedLoaded();

  const shouldReset = localStorage.getItem(STORAGE_KEYS.version) !== SEED_VERSION;
  const hasBank = !!localStorage.getItem(STORAGE_KEYS.questionBank);
  const hasTopics = !!localStorage.getItem(STORAGE_KEYS.topicsBank);
  const hasLessons = !!localStorage.getItem(STORAGE_KEYS.lessons);

  if (!shouldReset && hasBank && hasTopics && hasLessons) {
    inMemoryQuestions = loadQuestionBank();
    inMemoryTopics = getTopics();
    inMemoryLessons = getLessons();
    return;
  }

  const [questionsRes, topicsRes, lessonsRes] = await Promise.all([
    fetch('./data/questions.seed.json'),
    fetch('./data/topics.seed.json'),
    fetch('./data/lessons.seed.json')
  ]);

  const [questionsSeed, topicsSeed, lessonsSeed] = await Promise.all([questionsRes.json(), topicsRes.json(), lessonsRes.json()]);
  inMemoryQuestions = questionsSeed.map((q) => normalizeQuestion({ ...q, createdAt: nowIso(), updatedAt: nowIso() }));
  inMemoryTopics = Array.isArray(topicsSeed) ? topicsSeed.map(normalizeTopic) : [];
  inMemoryLessons = Array.isArray(lessonsSeed) ? lessonsSeed.map(normalizeLesson) : [];

  saveQuestionBank(inMemoryQuestions);
  saveTopicsBank(inMemoryTopics);
  saveLessons(inMemoryLessons);
  localStorage.setItem(STORAGE_KEYS.version, SEED_VERSION);
}

export function resetToSeed() {
  localStorage.removeItem(STORAGE_KEYS.questionBank);
  localStorage.removeItem(STORAGE_KEYS.topicsBank);
  localStorage.removeItem(STORAGE_KEYS.lessons);
  localStorage.removeItem(STORAGE_KEYS.version);
  return initStorageFromSeeds();
}

export function loadQuestionBank() {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.questionBank), inMemoryQuestions);
  return Array.isArray(stored) ? stored.map(normalizeQuestion) : [];
}

export function saveQuestionBank(bank) {
  const normalized = Array.isArray(bank) ? bank.map(normalizeQuestion) : [];
  inMemoryQuestions = normalized;
  localStorage.setItem(STORAGE_KEYS.questionBank, JSON.stringify(normalized));
  return normalized;
}

export function saveQuestionsBulk(questions = []) {
  const current = loadQuestionBank();
  const usedIds = new Set(current.map((q) => q.id));

  const normalizedIncoming = (Array.isArray(questions) ? questions : []).map((question) => {
    let id = String(question?.id ?? newId('q'));
    while (usedIds.has(id)) id = newId('q');
    usedIds.add(id);
    return { ...question, id };
  });

  return saveQuestionBank([...normalizedIncoming, ...current]);
}

export function loadTopicsBank() {
  return getTopics();
}

export function saveTopicsBank(topics) {
  const normalized = Array.isArray(topics) ? topics.map(normalizeTopic).filter((topic) => topic.id && topic.name) : [];
  inMemoryTopics = normalized;
  localStorage.setItem(STORAGE_KEYS.topicsBank, JSON.stringify(normalized));
}

export function getTopics(options = {}) {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.topicsBank), inMemoryTopics);
  const list = Array.isArray(stored) ? stored.map(normalizeTopic).filter((topic) => topic.id && topic.name) : [];
  inMemoryTopics = list;
  if (options.activeOnly) return list.filter((topic) => topic.status === 'active');
  return list;
}

export function createTopic(topic) {
  const all = getTopics();
  const normalized = normalizeTopic(topic);
  all.push(normalized);
  saveTopicsBank(all);
  return normalized;
}

export function saveTopic(topic) {
  return createTopic(topic);
}

export function updateTopic(id, patch = {}) {
  const all = getTopics();
  const index = all.findIndex((topic) => topic.id === id);
  if (index < 0) return null;
  const updated = normalizeTopic({ ...all[index], ...patch, id });
  all[index] = updated;
  saveTopicsBank(all);
  return updated;
}

export function setTopicStatus(id, status) {
  return updateTopic(id, { status });
}

export function toggleTopicStatus(id, status) {
  return setTopicStatus(id, status);
}

export function deleteTopic(id) {
  saveTopicsBank(getTopics().filter((topic) => topic.id !== id));
}

export function loadUsers() {
  ensureUsersSeeded();
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.users), []);
  return Array.isArray(stored) ? stored.map(normalizeUser).filter((u) => u.username) : [];
}

export function saveUsers(users) {
  const normalized = Array.isArray(users) ? users.map(normalizeUser).filter((u) => u.username) : [];
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(normalized));
  return normalized;
}

export function upsertUser(userPatch) {
  const all = loadUsers();
  const index = all.findIndex((u) => u.id === userPatch?.id || u.username === userPatch?.username);
  const merged = normalizeUser({ ...(index >= 0 ? all[index] : {}), ...userPatch });

  if (index >= 0) all[index] = merged;
  else all.push(merged);

  saveUsers(all);
  return merged;
}

export function getUsersByRole(role) {
  return loadUsers().filter((u) => u.role === role);
}

export function getUserById(idOrUsername) {
  return loadUsers().find((u) => u.id === idOrUsername || u.username === idOrUsername) ?? null;
}

export function getQuestionById(id) {
  return loadQuestionBank().find((question) => question.id === id) ?? null;
}

export function addComment(questionId, comment) {
  const bank = loadQuestionBank();
  const qIndex = bank.findIndex((question) => question.id === questionId);
  if (qIndex < 0) return null;

  const normalizedComment = normalizeComment(comment);
  bank[qIndex].comments = [...(bank[qIndex].comments ?? []), normalizedComment];
  bank[qIndex].updatedAt = nowIso();
  saveQuestionBank(bank);
  return normalizedComment;
}

export function addReply(questionId, commentId, reply) {
  const bank = loadQuestionBank();
  const question = bank.find((q) => q.id === questionId);
  if (!question) return null;
  const comment = question.comments.find((item) => item.id === commentId);
  if (!comment) return null;

  comment.replies.push(normalizeReply(reply));
  comment.status = COMMENT_STATUS.answered;
  question.updatedAt = nowIso();
  saveQuestionBank(bank);
  return comment;
}

export function setCommentStatus(questionId, commentId, status) {
  const bank = loadQuestionBank();
  const question = bank.find((q) => q.id === questionId);
  if (!question) return null;
  const comment = question.comments.find((item) => item.id === commentId);
  if (!comment) return null;

  comment.status = status;
  question.updatedAt = nowIso();
  saveQuestionBank(bank);
  return comment;
}

export function getAttempts(userId) {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.attempts), []);
  const list = Array.isArray(stored) ? stored.map(normalizeAttempt) : [];
  if (!userId) return list;
  return list.filter((item) => item.userId === userId);
}

export function addAttempt(attempt) {
  const list = getAttempts();
  const normalized = normalizeAttempt(attempt);
  list.push(normalized);
  localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(list));
  return normalized;
}

export function getNotebook(userId) {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.notebook), []);
  const list = Array.isArray(stored) ? stored.map(normalizeNotebookItem) : [];
  if (!userId) return list;
  return list.filter((item) => item.userId === userId);
}

export function upsertNotebookItem(userId, questionId, patch = {}) {
  const all = getNotebook();
  const index = all.findIndex((item) => item.userId === userId && item.questionId === questionId);
  const question = getQuestionById(questionId);
  const questionMeta = question
    ? {
        grade: question.grade,
        subject: question.subject,
        difficulty: question.difficulty,
        topicId: question.topicId
      }
    : {};

  const nextItem = normalizeNotebookItem({
    userId,
    questionId,
    ...questionMeta,
    ...(index >= 0 ? all[index] : {}),
    ...patch,
    updatedAt: nowIso()
  });

  if (index >= 0) all[index] = nextItem;
  else all.push(nextItem);

  localStorage.setItem(STORAGE_KEYS.notebook, JSON.stringify(all));
  return nextItem;
}

export function ensureReportsInit() {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.reports), null);
  if (Array.isArray(stored)) return stored;
  const legacy = parseJson(localStorage.getItem('bq_question_reports'), null);
  if (Array.isArray(legacy)) {
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(legacy));
    return legacy;
  }
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify([]));
  return [];
}

export function getReports() {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.reports), ensureReportsInit());
  return Array.isArray(stored) ? stored : [];
}

export function addReport(report) {
  const all = getReports();
  const normalized = {
    id: report?.id ?? newId('rep'),
    questionId: String(report?.questionId ?? ''),
    questionMeta: {
      grade: String(report?.questionMeta?.grade ?? ''),
      subject: String(report?.questionMeta?.subject ?? ''),
      topic: String(report?.questionMeta?.topic ?? ''),
      difficulty: String(report?.questionMeta?.difficulty ?? ''),
      preview: String(report?.questionMeta?.preview ?? '').trim()
    },
    type: String(report?.type ?? 'outro'),
    message: String(report?.message ?? '').trim(),
    createdAt: report?.createdAt ?? nowIso(),
    createdBy: {
      username: String(report?.createdBy?.username ?? ''),
      role: String(report?.createdBy?.role ?? 'student')
    },
    status: ['open', 'resolved', 'ignored'].includes(report?.status) ? report.status : 'open',
    adminNote: String(report?.adminNote ?? '').trim(),
    resolvedAt: report?.resolvedAt ?? null,
    resolvedBy: report?.resolvedBy
      ? {
          username: String(report.resolvedBy.username ?? ''),
          role: String(report.resolvedBy.role ?? 'admin')
        }
      : null
  };

  all.unshift(normalized);
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(all));
  return normalized;
}

export function updateReport(reportId, patch = {}) {
  const all = getReports();
  const index = all.findIndex((report) => report.id === reportId);
  if (index < 0) return null;
  const merged = { ...all[index], ...patch };
  all[index] = merged;
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(all));
  return merged;
}

export function setReportStatus(reportId, status, adminNote = '', resolvedBy = null) {
  const patch = {
    status,
    adminNote: String(adminNote ?? '').trim()
  };
  if (status === 'resolved' || status === 'ignored') {
    patch.resolvedAt = nowIso();
    patch.resolvedBy = resolvedBy;
  }
  if (status === 'open') {
    patch.resolvedAt = null;
    patch.resolvedBy = null;
  }
  return updateReport(reportId, patch);
}

export function deleteReport(reportId) {
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(getReports().filter((item) => item.id !== reportId)));
}


export function getTrainingPlans(userId) {
  const map = parseJson(localStorage.getItem(STORAGE_KEYS.trainingPlans), {});
  const plans = Array.isArray(map?.[userId]) ? map[userId] : [];
  return plans.map(normalizeTrainingPlan);
}

export function addTrainingPlan(userId, plan) {
  const map = parseJson(localStorage.getItem(STORAGE_KEYS.trainingPlans), {});
  const current = Array.isArray(map[userId]) ? map[userId] : [];
  const normalized = normalizeTrainingPlan(plan);
  map[userId] = [normalized, ...current];
  localStorage.setItem(STORAGE_KEYS.trainingPlans, JSON.stringify(map));
  return normalized;
}

export function getTrainingPlanById(planId) {
  const map = parseJson(localStorage.getItem(STORAGE_KEYS.trainingPlans), {});
  for (const [userId, plans] of Object.entries(map)) {
    const found = (Array.isArray(plans) ? plans : []).find((p) => p.id === planId);
    if (found) return { userId, ...normalizeTrainingPlan(found) };
  }
  return null;
}

export function getLessons() {
  const stored = parseJson(localStorage.getItem(STORAGE_KEYS.lessons), inMemoryLessons);
  const lessons = Array.isArray(stored) ? stored.map(normalizeLesson).filter((lesson) => lesson.title && lesson.url && lesson.topic) : [];
  inMemoryLessons = lessons;
  return lessons;
}

export function saveLessons(lessons) {
  const normalized = Array.isArray(lessons) ? lessons.map(normalizeLesson).filter((lesson) => lesson.title && lesson.url && lesson.topic) : [];
  inMemoryLessons = normalized;
  localStorage.setItem(STORAGE_KEYS.lessons, JSON.stringify(normalized));
  return normalized;
}

export function saveLesson(lesson) {
  const all = getLessons();
  const normalized = normalizeLesson(lesson);
  all.unshift(normalized);
  saveLessons(all);
  return normalized;
}

export function updateLesson(lessonId, patch) {
  const all = getLessons();
  const index = all.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  const updated = normalizeLesson({ ...all[index], ...patch, id: lessonId });
  all[index] = updated;
  saveLessons(all);
  return updated;
}

export function deleteLesson(lessonId) {
  saveLessons(getLessons().filter((lesson) => lesson.id !== lessonId));
}

export function getAdminSelectedStudentId() {
  return localStorage.getItem(STORAGE_KEYS.adminSelectedStudentId) || null;
}

export function setAdminSelectedStudentId(studentId) {
  if (!studentId) {
    localStorage.removeItem(STORAGE_KEYS.adminSelectedStudentId);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.adminSelectedStudentId, studentId);
}

export function authenticate(username, password) {
  const users = loadUsers();
  const found = users.find((user) => user.username === username && user.password === password);
  if (!found || found.status === 'blocked') return null;

  found.lastLoginAt = nowIso();
  saveUsers(users);
  return { id: found.id, username: found.username, role: found.role, gradeLevel: found.gradeLevel };
}

export function getCurrentUser() {
  return parseJson(localStorage.getItem(STORAGE_KEYS.currentUser), null);
}

export function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}
