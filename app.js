const letters = ["A", "B", "C", "D", "E", "F"];
const tabs = ["gabarito", "aulas", "comentarios", "caderno", "erro"];

const users = [
  { username: "aluno", password: "aluno123", role: "student", label: "Aluno" },
  { username: "admin", password: "admin123", role: "admin", label: "Administrador" }
];

const defaultQuestions = [
  {
    id: 1,
    grade: "7º ano",
    subject: "Matemática",
    topic: "Frações",
    difficulty: "Fácil",
    text: "Qual é o resultado de 3/4 + 1/4?",
    options: ["1", "3/8", "2", "4/8"],
    correct: 0,
    explanation: "Como os denominadores são iguais, somamos os numeradores: 3 + 1 = 4. Então 4/4 = 1.",
    solutionVideo: "https://www.youtube.com/watch?v=CbE4Q4r8wJQ",
    lessons: [
      { title: "Operações com frações", url: "https://pt.khanacademy.org/math/arithmetic/fraction-arithmetic" }
    ]
  },
  {
    id: 2,
    grade: "9º ano",
    subject: "Física",
    topic: "Velocidade média",
    difficulty: "Média",
    text: "Se um corpo percorre 100 m em 20 s, sua velocidade média é:",
    options: ["2 m/s", "4 m/s", "5 m/s", "10 m/s"],
    correct: 2,
    explanation: "Aplicamos v = Δs/Δt. Então v = 100/20 = 5 m/s.",
    solutionVideo: "https://www.youtube.com/watch?v=i8N0k8J4xjQ",
    lessons: [{ title: "Movimento e velocidade", url: "https://pt.khanacademy.org/science/physics/one-dimensional-motion" }]
  }
];

const storage = {
  questionBank: "questionBank",
  lessonsBank: "lessonsBank",
  comments: "question_comments",
  notes: "question_notes",
  reports: "question_reports",
  session: "user_session"
};

function seedQuestionBank() {
  const existing = localStorage.getItem(storage.questionBank);
  if (!existing) {
    localStorage.setItem(storage.questionBank, JSON.stringify(defaultQuestions));
  }
}

function loadQuestionBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storage.questionBank) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadObject(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(storage.session) || "null");
  } catch {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem(storage.session, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(storage.session);
}

seedQuestionBank();
let questions = loadQuestionBank();
const answers = new Map();
let activeTabByQuestion = Object.fromEntries(questions.map((q) => [q.id, "gabarito"]));
const comments = loadObject(storage.comments);
const notes = loadObject(storage.notes);
const reports = loadObject(storage.reports);

const loginSection = document.getElementById("loginSection");
const studentSection = document.getElementById("studentSection");
const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const topLoginBtn = document.getElementById("topLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminLinkBtn = document.getElementById("adminLinkBtn");
const welcomeText = document.getElementById("welcomeText");

const gradeFilter = document.getElementById("gradeFilter");
const subjectFilter = document.getElementById("subjectFilter");
const difficultyFilter = document.getElementById("difficultyFilter");
const searchFilter = document.getElementById("searchFilter");
const stats = document.getElementById("stats");
const questionsList = document.getElementById("questionsList");

function uniqueValues(key) {
  return [...new Set(questions.map((q) => q[key]))].filter(Boolean);
}

function fillSelect(select, values) {
  const current = select.value;
  select.innerHTML = `<option value="">Todos</option>${values
    .map((value) => `<option value="${value}">${value}</option>`)
    .join("")}`;
  select.value = values.includes(current) ? current : "";
}

function refreshFilters() {
  fillSelect(gradeFilter, uniqueValues("grade"));
  fillSelect(subjectFilter, uniqueValues("subject"));
  fillSelect(difficultyFilter, uniqueValues("difficulty"));
}

function filteredQuestions() {
  const search = searchFilter.value.toLowerCase().trim();

  return questions.filter((q) => {
    const byGrade = !gradeFilter.value || q.grade === gradeFilter.value;
    const bySubject = !subjectFilter.value || q.subject === subjectFilter.value;
    const byDifficulty = !difficultyFilter.value || q.difficulty === difficultyFilter.value;
    const bySearch =
      !search ||
      q.text.toLowerCase().includes(search) ||
      (q.topic || "").toLowerCase().includes(search) ||
      q.subject.toLowerCase().includes(search);

    return byGrade && bySubject && byDifficulty && bySearch;
  });
}

function updateStats() {
  const totalAnswered = answers.size;
  const hits = [...answers.values()].filter((entry) => entry.correct).length;
  const accuracy = totalAnswered ? Math.round((hits / totalAnswered) * 100) : 0;

  stats.innerHTML = `
    <p><strong>Respondidas:</strong> ${totalAnswered}</p>
    <p><strong>Acertos:</strong> ${hits}</p>
    <p><strong>Aproveitamento:</strong> ${accuracy}%</p>
  `;
}

function answerQuestion(questionId) {
  const selected = document.querySelector(`input[name="q_${questionId}"]:checked`);
  if (!selected) {
    alert("Selecione uma alternativa antes de responder.");
    return;
  }

  const question = questions.find((q) => q.id === questionId);
  const selectedIndex = Number(selected.value);
  answers.set(questionId, { selectedIndex, correct: selectedIndex === question.correct });
  renderQuestions();
  updateStats();
}

function setActiveTab(questionId, tab) {
  if (!tabs.includes(tab)) {
    return;
  }
  activeTabByQuestion[questionId] = tab;
  renderQuestions();
}

function addComment(questionId) {
  const input = document.getElementById(`comment_input_${questionId}`);
  const value = input.value.trim();
  if (!value) {
    return;
  }

  comments[questionId] = comments[questionId] || [];
  comments[questionId].push(value);
  saveObject(storage.comments, comments);
  renderQuestions();
}

function saveNote(questionId) {
  const input = document.getElementById(`note_input_${questionId}`);
  notes[questionId] = input.value;
  saveObject(storage.notes, notes);
  alert("Anotação salva.");
}

function reportError(questionId) {
  const input = document.getElementById(`report_input_${questionId}`);
  const value = input.value.trim();
  if (!value) {
    return;
  }

  reports[questionId] = reports[questionId] || [];
  reports[questionId].push({ message: value, createdAt: new Date().toISOString() });
  saveObject(storage.reports, reports);
  renderQuestions();
}

function youtubeEmbedUrl(url) {
  if (!url) {
    return "";
  }
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  const id = watchMatch?.[1] || shortMatch?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

function renderTabContent(q, tab) {
  if (tab === "gabarito") {
    const answer = answers.get(q.id);
    if (!answer) {
      return "<p class='muted'>Responda a questão para liberar o gabarito comentado.</p>";
    }
    const embed = youtubeEmbedUrl(q.solutionVideo);
    return `
      <h4>Gabarito comentado</h4>
      <p><strong>Resposta correta:</strong> ${letters[q.correct] || q.correct + 1}</p>
      <p><strong>Explicação:</strong> ${q.explanation || "Sem explicação cadastrada."}</p>
      ${
        embed
          ? `<div class="video-wrapper"><iframe src="${embed}" title="Vídeo questão ${q.id}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
          : "<p class='muted'>Sem vídeo cadastrado.</p>"
      }
    `;
  }

  if (tab === "aulas") {
    const lessons = Array.isArray(q.lessons) ? q.lessons : [];
    if (!lessons.length) {
      return "<p class='muted'>Sem aulas cadastradas para esta questão.</p>";
    }
    return `<h4>Aulas</h4><ul class="list">${lessons
      .map((lesson) => `<li><a href="${lesson.url}" target="_blank" rel="noopener noreferrer">${lesson.title}</a></li>`)
      .join("")}</ul>`;
  }

  if (tab === "comentarios") {
    const list = comments[q.id] || [];
    return `
      <h4>Comentários</h4>
      <textarea id="comment_input_${q.id}" placeholder="Escreva aqui..."></textarea>
      <div class="inline-actions"><button class="primary-btn" onclick="addComment(${q.id})">Salvar comentário</button></div>
      ${list.length ? `<ul class="list">${list.map((item) => `<li>${item}</li>`).join("")}</ul>` : "<p class='muted'>Nenhum comentário.</p>"}
    `;
  }

  if (tab === "caderno") {
    return `
      <h4>Caderno</h4>
      <textarea id="note_input_${q.id}" placeholder="Suas anotações...">${notes[q.id] || ""}</textarea>
      <div class="inline-actions"><button class="primary-btn" onclick="saveNote(${q.id})">Salvar anotação</button></div>
    `;
  }

  const list = reports[q.id] || [];
  return `
    <h4>Notificar erro</h4>
    <textarea id="report_input_${q.id}" placeholder="Descreva o erro..."></textarea>
    <div class="inline-actions"><button class="primary-btn" onclick="reportError(${q.id})">Enviar</button></div>
    ${list.length ? `<p><strong>Notificações enviadas:</strong> ${list.length}</p>` : "<p class='muted'>Nenhuma notificação ainda.</p>"}
  `;
}

function renderQuestions() {
  const list = filteredQuestions();
  if (!list.length) {
    questionsList.innerHTML = "<p>Nenhuma questão encontrada para os filtros informados.</p>";
    return;
  }

  questionsList.innerHTML = list
    .map((q) => {
      const answer = answers.get(q.id);
      const activeTab = activeTabByQuestion[q.id] || "gabarito";

      return `
        <article class="question">
          <div class="question-head">
            <div class="meta">${q.grade} · ${q.subject} · ${q.topic || "Sem assunto"} · ${q.difficulty}</div>
          </div>
          <div class="question-body">
            <p>${q.text}</p>
            <div class="options">
              ${q.options
                .map(
                  (option, idx) => `
                    <label class="option-item">
                      <span class="option-letter">${letters[idx] || idx + 1}</span>
                      <input type="radio" name="q_${q.id}" value="${idx}" ${answer && answer.selectedIndex === idx ? "checked" : ""} />
                      <span>${option}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
            <button class="primary-btn" onclick="answerQuestion(${q.id})">Responder</button>
          </div>
          <div class="question-tabs">
            <div class="tab-buttons">
              <button class="tab-btn ${activeTab === "gabarito" ? "active" : ""}" onclick="setActiveTab(${q.id}, 'gabarito')">Gabarito Comentado</button>
              <button class="tab-btn ${activeTab === "aulas" ? "active" : ""}" onclick="setActiveTab(${q.id}, 'aulas')">Aulas</button>
              <button class="tab-btn ${activeTab === "comentarios" ? "active" : ""}" onclick="setActiveTab(${q.id}, 'comentarios')">Comentários</button>
              <button class="tab-btn ${activeTab === "caderno" ? "active" : ""}" onclick="setActiveTab(${q.id}, 'caderno')">Caderno</button>
              <button class="tab-btn ${activeTab === "erro" ? "active" : ""}" onclick="setActiveTab(${q.id}, 'erro')">Notificar Erro</button>
            </div>
            <div class="tab-panel">${renderTabContent(q, activeTab)}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function showLogin() {
  loginSection.classList.remove("hidden");
  usernameInput.focus();
}

function applyAuthUI(session) {
  const logged = Boolean(session);
  topLoginBtn.classList.toggle("hidden", logged);
  logoutBtn.classList.toggle("hidden", !logged);
  loginSection.classList.toggle("hidden", !logged);
  welcomeText.textContent = logged ? `Logado como: ${session.username}` : "Visitante";
  adminLinkBtn.classList.toggle("hidden", !logged || session.role !== "admin");

  if (logged) {
    studentSection.classList.remove("hidden");
  }
}

function onLogin(event) {
  event.preventDefault();
  loginFeedback.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    loginFeedback.textContent = "Usuário ou senha inválidos.";
    return;
  }

  setSession(user);
  applyAuthUI(user);
  loginForm.reset();
}

function onLogout() {
  clearSession();
  applyAuthUI(null);
}

[gradeFilter, subjectFilter, difficultyFilter, searchFilter].forEach((el) => el.addEventListener("input", renderQuestions));

loginForm.addEventListener("submit", onLogin);
topLoginBtn.addEventListener("click", showLogin);
logoutBtn.addEventListener("click", onLogout);

questions = loadQuestionBank();
activeTabByQuestion = Object.fromEntries(questions.map((q) => [q.id, "gabarito"]));
refreshFilters();
updateStats();
renderQuestions();
applyAuthUI(getSession());

window.answerQuestion = answerQuestion;
window.setActiveTab = setActiveTab;
window.addComment = addComment;
window.saveNote = saveNote;
window.reportError = reportError;
