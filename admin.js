const ADMIN_USER = { username: "admin", password: "admin123", role: "admin", label: "Administrador" };

const storage = {
  questionBank: "questionBank",
  lessonsBank: "lessonsBank",
  reports: "question_reports",
  session: "user_session"
};

const adminLoginSection = document.getElementById("adminLoginSection");
const adminAppSection = document.getElementById("adminAppSection");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginFeedback = document.getElementById("adminLoginFeedback");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const menuButtons = [...document.querySelectorAll(".admin-menu button")];
const dashboardStats = document.getElementById("dashboardStats");

const questionForm = document.getElementById("questionForm");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const cancelQuestionBtn = document.getElementById("cancelQuestionBtn");
const questionsAdminList = document.getElementById("questionsAdminList");
const importJson = document.getElementById("importJson");
const importBtn = document.getElementById("importBtn");
const importFeedback = document.getElementById("importFeedback");

const lessonForm = document.getElementById("lessonForm");
const newLessonBtn = document.getElementById("newLessonBtn");
const cancelLessonBtn = document.getElementById("cancelLessonBtn");
const lessonsAdminList = document.getElementById("lessonsAdminList");

const reportsList = document.getElementById("reportsList");

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(storage.session) || "null");
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(storage.session, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(storage.session);
}

function getQuestionBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storage.questionBank) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQuestionBank(data) {
  localStorage.setItem(storage.questionBank, JSON.stringify(data));
}

function getLessonsBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storage.lessonsBank) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLessonsBank(data) {
  localStorage.setItem(storage.lessonsBank, JSON.stringify(data));
}

function getReports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storage.reports) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseLessons(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, url] = line.split("|").map((part) => part.trim());
      return { title, url };
    })
    .filter((lesson) => lesson.title && lesson.url);
}

function showAdminApp(enabled) {
  adminLoginSection.classList.toggle("hidden", enabled);
  adminAppSection.classList.toggle("hidden", !enabled);
}

function activateTab(tabName) {
  menuButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  ["dashboard", "questoes", "aulas", "erros"].forEach((name) => {
    document.getElementById(`tab-${name}`).classList.toggle("hidden", name !== tabName);
  });
}

function renderDashboard() {
  const questions = getQuestionBank();
  const lessons = getLessonsBank();
  const reports = getReports();
  const totalReports = Object.values(reports).reduce((sum, list) => sum + list.length, 0);

  dashboardStats.innerHTML = `
    <article class="card"><h3>${questions.length}</h3><p>Questões cadastradas</p></article>
    <article class="card"><h3>${lessons.length}</h3><p>Aulas cadastradas</p></article>
    <article class="card"><h3>${totalReports}</h3><p>Erros reportados</p></article>
  `;
}

function openQuestionForm(question = null) {
  questionForm.classList.remove("hidden");
  questionForm.reset();
  document.getElementById("questionId").value = question?.id ?? "";
  document.getElementById("qGrade").value = question?.grade ?? "";
  document.getElementById("qSubject").value = question?.subject ?? "";
  document.getElementById("qTopic").value = question?.topic ?? "";
  document.getElementById("qDifficulty").value = question?.difficulty ?? "";
  document.getElementById("qText").value = question?.text ?? "";
  document.getElementById("qOptions").value = (question?.options || []).join("\n");
  document.getElementById("qCorrect").value = question?.correct ?? 0;
  document.getElementById("qExplanation").value = question?.explanation ?? "";
  document.getElementById("qVideo").value = question?.solutionVideo ?? "";
  document.getElementById("qLessons").value = (question?.lessons || [])
    .map((lesson) => `${lesson.title} | ${lesson.url}`)
    .join("\n");
}

function closeQuestionForm() {
  questionForm.classList.add("hidden");
  questionForm.reset();
}

function renderQuestionsAdmin() {
  const questions = getQuestionBank();

  questionsAdminList.innerHTML = questions.length
    ? questions
        .map(
          (q) => `
      <article class="admin-item">
        <div>
          <strong>#${q.id} · ${q.grade} · ${q.subject}</strong>
          <p>${q.topic} · ${q.difficulty}</p>
          <p>${q.text}</p>
        </div>
        <div class="inline-actions">
          <button class="tab-btn" onclick="editQuestion(${q.id})">Editar</button>
          <button class="tab-btn" onclick="deleteQuestion(${q.id})">Excluir</button>
        </div>
      </article>
    `
        )
        .join("")
    : "<p class='muted'>Nenhuma questão cadastrada.</p>";
}

function handleQuestionSubmit(event) {
  event.preventDefault();

  const questions = getQuestionBank();
  const id = Number(document.getElementById("questionId").value);
  const options = document
    .getElementById("qOptions")
    .value.split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const correct = Number(document.getElementById("qCorrect").value);

  if (options.length < 2 || Number.isNaN(correct) || correct < 0 || correct >= options.length) {
    alert("Revise alternativas e índice da correta.");
    return;
  }

  const payload = {
    id: id || Math.max(...questions.map((q) => q.id), 0) + 1,
    grade: document.getElementById("qGrade").value.trim(),
    subject: document.getElementById("qSubject").value.trim(),
    topic: document.getElementById("qTopic").value.trim(),
    difficulty: document.getElementById("qDifficulty").value.trim(),
    text: document.getElementById("qText").value.trim(),
    options,
    correct,
    explanation: document.getElementById("qExplanation").value.trim(),
    solutionVideo: document.getElementById("qVideo").value.trim(),
    lessons: parseLessons(document.getElementById("qLessons").value)
  };

  const index = questions.findIndex((q) => q.id === payload.id);
  if (index >= 0) {
    questions[index] = payload;
  } else {
    questions.push(payload);
  }

  saveQuestionBank(questions);
  closeQuestionForm();
  renderQuestionsAdmin();
  renderDashboard();
}

function editQuestion(id) {
  const question = getQuestionBank().find((q) => q.id === id);
  if (question) {
    openQuestionForm(question);
  }
}

function deleteQuestion(id) {
  if (!confirm("Deseja excluir esta questão?")) {
    return;
  }

  const next = getQuestionBank().filter((q) => q.id !== id);
  saveQuestionBank(next);
  renderQuestionsAdmin();
  renderDashboard();
}

function handleImport() {
  try {
    const parsed = JSON.parse(importJson.value);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON precisa ser um array.");
    }

    const current = getQuestionBank();
    let nextId = Math.max(...current.map((q) => q.id), 0) + 1;
    const normalized = parsed.map((q) => ({
      id: q.id || nextId++,
      grade: q.grade || "",
      subject: q.subject || "",
      topic: q.topic || "",
      difficulty: q.difficulty || "",
      text: q.text || "",
      options: Array.isArray(q.options) ? q.options : [],
      correct: Number(q.correct || 0),
      explanation: q.explanation || "",
      solutionVideo: q.solutionVideo || "",
      lessons: Array.isArray(q.lessons) ? q.lessons : []
    }));

    saveQuestionBank([...current, ...normalized]);
    importJson.value = "";
    importFeedback.textContent = `${normalized.length} questão(ões) importada(s).`;
    renderQuestionsAdmin();
    renderDashboard();
  } catch (error) {
    importFeedback.textContent = `Erro: ${error.message}`;
  }
}

function openLessonForm(lesson = null) {
  lessonForm.classList.remove("hidden");
  lessonForm.reset();
  document.getElementById("lessonId").value = lesson?.id ?? "";
  document.getElementById("lessonTitle").value = lesson?.title ?? "";
  document.getElementById("lessonTopic").value = lesson?.topic ?? "";
  document.getElementById("lessonUrl").value = lesson?.url ?? "";
}

function closeLessonForm() {
  lessonForm.classList.add("hidden");
  lessonForm.reset();
}

function renderLessonsAdmin() {
  const lessons = getLessonsBank();
  lessonsAdminList.innerHTML = lessons.length
    ? lessons
        .map(
          (lesson) => `
      <article class="admin-item">
        <div>
          <strong>${lesson.title}</strong>
          <p>${lesson.topic}</p>
          <a href="${lesson.url}" target="_blank" rel="noopener noreferrer">${lesson.url}</a>
        </div>
        <div class="inline-actions">
          <button class="tab-btn" onclick="editLesson(${lesson.id})">Editar</button>
          <button class="tab-btn" onclick="deleteLesson(${lesson.id})">Excluir</button>
        </div>
      </article>
    `
        )
        .join("")
    : "<p class='muted'>Nenhuma aula cadastrada.</p>";
}

function handleLessonSubmit(event) {
  event.preventDefault();

  const lessons = getLessonsBank();
  const id = Number(document.getElementById("lessonId").value);
  const payload = {
    id: id || Math.max(...lessons.map((l) => l.id), 0) + 1,
    title: document.getElementById("lessonTitle").value.trim(),
    topic: document.getElementById("lessonTopic").value.trim(),
    url: document.getElementById("lessonUrl").value.trim()
  };

  const index = lessons.findIndex((l) => l.id === payload.id);
  if (index >= 0) {
    lessons[index] = payload;
  } else {
    lessons.push(payload);
  }

  saveLessonsBank(lessons);
  closeLessonForm();
  renderLessonsAdmin();
  renderDashboard();
}

function editLesson(id) {
  const lesson = getLessonsBank().find((l) => l.id === id);
  if (lesson) {
    openLessonForm(lesson);
  }
}

function deleteLesson(id) {
  if (!confirm("Excluir aula?")) {
    return;
  }

  saveLessonsBank(getLessonsBank().filter((l) => l.id !== id));
  renderLessonsAdmin();
  renderDashboard();
}

function renderReports() {
  const reports = getReports();
  const questions = getQuestionBank();
  const questionById = Object.fromEntries(questions.map((q) => [q.id, q]));

  const rows = Object.entries(reports).flatMap(([questionId, list]) =>
    list.map((item) => ({
      questionId,
      message: item.message,
      createdAt: item.createdAt,
      text: questionById[questionId]?.text || "Questão removida"
    }))
  );

  reportsList.innerHTML = rows.length
    ? rows
        .map(
          (r) => `
      <article class="admin-item">
        <div>
          <strong>Questão #${r.questionId}</strong>
          <p>${r.text}</p>
          <p><strong>Erro:</strong> ${r.message}</p>
          <p class="muted">${new Date(r.createdAt).toLocaleString("pt-BR")}</p>
        </div>
      </article>
    `
        )
        .join("")
    : "<p class='muted'>Nenhum erro reportado.</p>";
}

function onAdminLogin(event) {
  event.preventDefault();
  adminLoginFeedback.textContent = "";

  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (username !== ADMIN_USER.username || password !== ADMIN_USER.password) {
    adminLoginFeedback.textContent = "Credenciais inválidas.";
    return;
  }

  setSession(ADMIN_USER);
  showAdminApp(true);
  initializeAdmin();
}

function onAdminLogout() {
  clearSession();
  showAdminApp(false);
}

function initializeAdmin() {
  activateTab("dashboard");
  renderDashboard();
  renderQuestionsAdmin();
  renderLessonsAdmin();
  renderReports();
}

menuButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

adminLoginForm.addEventListener("submit", onAdminLogin);
adminLogoutBtn.addEventListener("click", onAdminLogout);
newQuestionBtn.addEventListener("click", () => openQuestionForm());
cancelQuestionBtn.addEventListener("click", closeQuestionForm);
questionForm.addEventListener("submit", handleQuestionSubmit);
importBtn.addEventListener("click", handleImport);
newLessonBtn.addEventListener("click", () => openLessonForm());
cancelLessonBtn.addEventListener("click", closeLessonForm);
lessonForm.addEventListener("submit", handleLessonSubmit);

const session = getSession();
if (session?.role === "admin") {
  showAdminApp(true);
  initializeAdmin();
} else {
  showAdminApp(false);
}

window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
window.editLesson = editLesson;
window.deleteLesson = deleteLesson;
