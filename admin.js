const STORAGE = {
  questionBank: "questionBank",
  currentUser: "currentUser"
};

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

const deniedSection = document.getElementById("deniedSection");
const adminSection = document.getElementById("adminSection");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const newQuestionBtn = document.getElementById("newQuestionBtn");
const resetSeedBtn = document.getElementById("resetSeedBtn");
const questionForm = document.getElementById("questionForm");
const cancelQuestionBtn = document.getElementById("cancelQuestionBtn");
const adminQuestionsList = document.getElementById("adminQuestionsList");

function ensureSeedQuestions() {
  const raw = localStorage.getItem(STORAGE.questionBank);
  if (!raw) {
    localStorage.setItem(STORAGE.questionBank, JSON.stringify(SEED_QUESTIONS));
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.currentUser) || "null");
  } catch {
    return null;
  }
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE.currentUser);
}

function getQuestionBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE.questionBank) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQuestionBank(questions) {
  localStorage.setItem(STORAGE.questionBank, JSON.stringify(questions));
}

function checkAdminAccess() {
  const user = getCurrentUser();
  const isAdmin = user?.role === "admin";

  deniedSection.classList.toggle("hidden", isAdmin);
  adminSection.classList.toggle("hidden", !isAdmin);

  return isAdmin;
}

function renderQuestions() {
  const questions = getQuestionBank();
  adminQuestionsList.innerHTML = questions.length
    ? questions
        .map(
          (q) => `
      <article class="admin-item">
        <div>
          <strong>#${q.id} · ${q.grade} · ${q.subject} · ${q.difficulty}</strong>
          <p>${q.text}</p>
          <p class="muted">Alternativas: ${q.options.length} | Correta: ${q.correct}</p>
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

function openForm(question = null) {
  questionForm.classList.remove("hidden");
  questionForm.reset();

  document.getElementById("questionId").value = question?.id ?? "";
  document.getElementById("qGrade").value = question?.grade ?? "";
  document.getElementById("qSubject").value = question?.subject ?? "";
  document.getElementById("qDifficulty").value = question?.difficulty ?? "";
  document.getElementById("qText").value = question?.text ?? "";
  document.getElementById("qOptions").value = (question?.options || []).join("\n");
  document.getElementById("qCorrect").value = question?.correct ?? 0;
  document.getElementById("qExplanation").value = question?.explanation ?? "";
}

function closeForm() {
  questionForm.classList.add("hidden");
  questionForm.reset();
}

function onSaveQuestion(event) {
  event.preventDefault();

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
    id,
    grade: document.getElementById("qGrade").value.trim(),
    subject: document.getElementById("qSubject").value.trim(),
    difficulty: document.getElementById("qDifficulty").value.trim(),
    text: document.getElementById("qText").value.trim(),
    options,
    correct,
    explanation: document.getElementById("qExplanation").value.trim(),
    comments: []
  };

  const bank = getQuestionBank();
  if (id) {
    const index = bank.findIndex((item) => item.id === id);
    if (index >= 0) {
      const currentComments = Array.isArray(bank[index].comments) ? bank[index].comments : [];
      bank[index] = { ...payload, comments: currentComments };
    }
  } else {
    payload.id = Math.max(...bank.map((q) => q.id), 0) + 1;
    bank.push(payload);
  }

  saveQuestionBank(bank);
  closeForm();
  renderQuestions();
}

function editQuestion(id) {
  const question = getQuestionBank().find((item) => item.id === id);
  if (question) {
    openForm(question);
  }
}

function deleteQuestion(id) {
  if (!confirm("Deseja excluir esta questão?")) {
    return;
  }

  const bank = getQuestionBank().filter((item) => item.id !== id);
  saveQuestionBank(bank);
  renderQuestions();
}

function resetSeed() {
  if (!confirm("Isso vai restaurar apenas as 3 questões fixas. Continuar?")) {
    return;
  }

  saveQuestionBank(SEED_QUESTIONS);
  closeForm();
  renderQuestions();
}

adminLogoutBtn.addEventListener("click", () => {
  clearCurrentUser();
  window.location.href = "index.html";
});

newQuestionBtn.addEventListener("click", () => openForm());
cancelQuestionBtn.addEventListener("click", closeForm);
questionForm.addEventListener("submit", onSaveQuestion);
resetSeedBtn.addEventListener("click", resetSeed);

ensureSeedQuestions();
if (checkAdminAccess()) {
  renderQuestions();
}

window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
