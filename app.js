const USERS = [
  { username: "aluno", password: "aluno123", role: "student" },
  { username: "admin", password: "admin123", role: "admin" }
];

const SEED_QUESTIONS = [
  {
    id: 1,
    grade: "7º ano",
    subject: "Matemática",
    difficulty: "Fácil",
    text: "Quanto é 2/3 + 1/3?",
    options: ["1", "2", "1/3", "3"],
    correct: 0,
    explanation: "Somando frações de mesmo denominador: 2/3 + 1/3 = 3/3 = 1.",
    comments: []
  },
  {
    id: 2,
    grade: "8º ano",
    subject: "Matemática",
    difficulty: "Média",
    text: "Resolva: 3x - 6 = 12",
    options: ["x = 2", "x = 6", "x = 4", "x = 8"],
    correct: 1,
    explanation: "3x = 18, então x = 6.",
    comments: []
  },
  {
    id: 3,
    grade: "1º ano EM",
    subject: "Física",
    difficulty: "Média",
    text: "Qual a unidade de energia no SI?",
    options: ["Watt", "Pascal", "Joule", "Newton"],
    correct: 2,
    explanation: "A unidade de energia no SI é o joule (J).",
    comments: []
  }
];

const STORAGE = {
  questionBank: "questionBank",
  currentUser: "currentUser"
};

function ensureSeedQuestions() {
  const raw = localStorage.getItem(STORAGE.questionBank);
  if (!raw) {
    localStorage.setItem(STORAGE.questionBank, JSON.stringify(SEED_QUESTIONS));
  }
}

function getQuestionBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE.questionBank) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.currentUser) || "null");
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem(STORAGE.currentUser, JSON.stringify({ username: user.username, role: user.role }));
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE.currentUser);
}

ensureSeedQuestions();
let questions = getQuestionBank();
const answers = new Map();

const sessionInfo = document.getElementById("sessionInfo");
const adminBtn = document.getElementById("adminBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginSection = document.getElementById("loginSection");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");

const gradeFilter = document.getElementById("gradeFilter");
const subjectFilter = document.getElementById("subjectFilter");
const searchFilter = document.getElementById("searchFilter");
const stats = document.getElementById("stats");
const questionsList = document.getElementById("questionsList");

function fillFilter(select, values) {
  const current = select.value;
  select.innerHTML = `<option value="">Todos</option>${values
    .map((value) => `<option value="${value}">${value}</option>`)
    .join("")}`;
  select.value = values.includes(current) ? current : "";
}

function refreshFilters() {
  fillFilter(gradeFilter, [...new Set(questions.map((q) => q.grade))]);
  fillFilter(subjectFilter, [...new Set(questions.map((q) => q.subject))]);
}

function filteredQuestions() {
  const term = searchFilter.value.toLowerCase().trim();

  return questions.filter((q) => {
    const gradeOk = !gradeFilter.value || q.grade === gradeFilter.value;
    const subjectOk = !subjectFilter.value || q.subject === subjectFilter.value;
    const searchOk = !term || q.text.toLowerCase().includes(term) || q.subject.toLowerCase().includes(term);
    return gradeOk && subjectOk && searchOk;
  });
}

function updateStats() {
  const total = answers.size;
  const correct = [...answers.values()].filter((value) => value).length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  stats.innerHTML = `<p><strong>Respondidas:</strong> ${total}</p><p><strong>Acertos:</strong> ${correct}</p><p><strong>Aproveitamento:</strong> ${score}%</p>`;
}

function answerQuestion(id) {
  const checked = document.querySelector(`input[name="q_${id}"]:checked`);
  if (!checked) {
    alert("Selecione uma alternativa.");
    return;
  }

  const question = questions.find((item) => item.id === id);
  answers.set(id, Number(checked.value) === question.correct);
  renderQuestions();
  updateStats();
}

function renderQuestions() {
  const list = filteredQuestions();
  if (!list.length) {
    questionsList.innerHTML = "<p>Nenhuma questão encontrada.</p>";
    return;
  }

  questionsList.innerHTML = list
    .map((q) => {
      const answered = answers.has(q.id);
      const correct = answers.get(q.id);

      return `
        <article class="question">
          <div class="question-head"><div class="meta">${q.grade} · ${q.subject} · ${q.difficulty}</div></div>
          <div class="question-body">
            <p>${q.text}</p>
            <div class="options">
              ${q.options
                .map(
                  (option, idx) => `
                    <label class="option-item">
                      <input type="radio" name="q_${q.id}" value="${idx}" />
                      <span>${option}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
            <button class="primary-btn" onclick="answerQuestion(${q.id})">Responder</button>
            ${
              answered
                ? `<p class="${correct ? "ok" : "error-text"}">${correct ? "✅ Acertou" : "❌ Errou"}</p><p>${q.explanation}</p>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function applySessionUI() {
  const user = getCurrentUser();
  const logged = Boolean(user);
  sessionInfo.textContent = logged ? `${user.username} (${user.role})` : "Visitante";
  showLoginBtn.classList.toggle("hidden", logged);
  logoutBtn.classList.toggle("hidden", !logged);
  adminBtn.classList.toggle("hidden", !logged || user.role !== "admin");
}

function onLoginSubmit(event) {
  event.preventDefault();
  loginError.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  const user = USERS.find((item) => item.username === username && item.password === password);

  if (!user) {
    loginError.textContent = "Usuário ou senha inválidos.";
    return;
  }

  setCurrentUser(user);
  loginSection.classList.add("hidden");
  loginForm.reset();
  applySessionUI();
}

showLoginBtn.addEventListener("click", () => {
  loginSection.classList.toggle("hidden");
  if (!loginSection.classList.contains("hidden")) {
    usernameInput.focus();
  }
});

logoutBtn.addEventListener("click", () => {
  clearCurrentUser();
  applySessionUI();
});

[gradeFilter, subjectFilter, searchFilter].forEach((element) => {
  element.addEventListener("input", renderQuestions);
});

loginForm.addEventListener("submit", onLoginSubmit);

refreshFilters();
updateStats();
renderQuestions();
applySessionUI();

window.answerQuestion = answerQuestion;
