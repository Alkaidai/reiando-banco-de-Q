const letters = ["A", "B", "C", "D", "E"];
const tabs = ["gabarito", "aulas", "comentarios", "caderno", "erro"];

const questions = [
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
    grade: "8º ano",
    subject: "Matemática",
    topic: "Equação do 1º grau",
    difficulty: "Média",
    text: "Resolva: 2x + 5 = 17.",
    options: ["x = 5", "x = 6", "x = 7", "x = 8"],
    correct: 1,
    explanation: "Isolando x: 2x = 17 - 5 = 12, logo x = 6.",
    solutionVideo: "https://www.youtube.com/watch?v=7f8s6fG3v4Q",
    lessons: [
      { title: "Introdução a equações", url: "https://pt.khanacademy.org/math/algebra/one-variable-linear-equations" }
    ]
  },
  {
    id: 3,
    grade: "9º ano",
    subject: "Física",
    topic: "Velocidade média",
    difficulty: "Média",
    text: "Se um corpo percorre 100 m em 20 s, sua velocidade média é:",
    options: ["2 m/s", "4 m/s", "5 m/s", "10 m/s"],
    correct: 2,
    explanation: "Aplicamos v = Δs/Δt. Então v = 100/20 = 5 m/s.",
    solutionVideo: "https://www.youtube.com/watch?v=i8N0k8J4xjQ",
    lessons: [
      { title: "Movimento e velocidade", url: "https://pt.khanacademy.org/science/physics/one-dimensional-motion" }
    ]
  },
  {
    id: 4,
    grade: "1º ano EM",
    subject: "Física",
    topic: "Leis de Newton",
    difficulty: "Difícil",
    text: "Qual é a unidade de força no SI?",
    options: ["Watt", "Joule", "Pascal", "Newton"],
    correct: 3,
    explanation: "No SI, força é medida em newton (N).",
    solutionVideo: "https://www.youtube.com/watch?v=kKKM8Y-u7ds",
    lessons: [
      { title: "Força e Leis de Newton", url: "https://pt.khanacademy.org/science/physics/forces-newtons-laws" }
    ]
  }
];

const answers = new Map();
const activeTabByQuestion = Object.fromEntries(questions.map((q) => [q.id, "gabarito"]));

const storage = {
  comments: "question_comments",
  notes: "question_notes",
  reports: "question_reports"
};

const comments = loadObject(storage.comments);
const notes = loadObject(storage.notes);
const reports = loadObject(storage.reports);

const gradeFilter = document.getElementById("gradeFilter");
const subjectFilter = document.getElementById("subjectFilter");
const difficultyFilter = document.getElementById("difficultyFilter");
const searchFilter = document.getElementById("searchFilter");
const questionsList = document.getElementById("questionsList");
const stats = document.getElementById("stats");

function loadObject(key) {
  try {
    const data = localStorage.getItem(key);
    const parsed = data ? JSON.parse(data) : {};
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uniqueValues(key) {
  return [...new Set(questions.map((q) => q[key]))];
}

function fillSelect(select, values) {
  select.innerHTML = `<option value="">Todos</option>${values
    .map((value) => `<option value="${value}">${value}</option>`)
    .join("")}`;
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
      q.topic.toLowerCase().includes(search) ||
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
    alert("Digite um comentário antes de salvar.");
    return;
  }

  comments[questionId] = comments[questionId] || [];
  comments[questionId].push(value);
  saveObject(storage.comments, comments);
  renderQuestions();
}

function saveNote(questionId) {
  const textarea = document.getElementById(`note_input_${questionId}`);
  notes[questionId] = textarea.value;
  saveObject(storage.notes, notes);
  alert("Anotação salva com sucesso.");
}

function reportError(questionId) {
  const input = document.getElementById(`report_input_${questionId}`);
  const value = input.value.trim();

  if (!value) {
    alert("Descreva o erro antes de enviar.");
    return;
  }

  reports[questionId] = reports[questionId] || [];
  reports[questionId].push({ message: value, createdAt: new Date().toISOString() });
  saveObject(storage.reports, reports);
  renderQuestions();
}

function renderTabContent(q, tab) {
  if (tab === "gabarito") {
    const answer = answers.get(q.id);
    if (!answer) {
      return "<p class='muted'>Responda a questão para liberar o gabarito comentado.</p>";
    }

    const status = answer.correct ? "✅ Você acertou." : "❌ Você errou.";
    return `
      <h4>Gabarito comentado</h4>
      <p><strong>Resposta correta:</strong> ${letters[q.correct]}</p>
      <p>${status}</p>
      <p><strong>Explicação:</strong> ${q.explanation}</p>
      <p><a href="${q.solutionVideo}" target="_blank" rel="noopener noreferrer">▶ Ver vídeo de resolução</a></p>
    `;
  }

  if (tab === "aulas") {
    return `
      <h4>Aulas do assunto (${q.topic})</h4>
      <ul class="list">
        ${q.lessons
          .map(
            (lesson) =>
              `<li><a href="${lesson.url}" target="_blank" rel="noopener noreferrer">${lesson.title}</a></li>`
          )
          .join("")}
      </ul>
    `;
  }

  if (tab === "comentarios") {
    const questionComments = comments[q.id] || [];
    return `
      <h4>Comentários</h4>
      <textarea id="comment_input_${q.id}" placeholder="Escreva um comentário sobre esta questão..."></textarea>
      <div class="inline-actions">
        <button class="primary-btn" onclick="addComment(${q.id})">Salvar comentário</button>
      </div>
      ${
        questionComments.length
          ? `<ul class="list">${questionComments.map((c) => `<li>${c}</li>`).join("")}</ul>`
          : "<p class='muted'>Nenhum comentário ainda.</p>"
      }
    `;
  }

  if (tab === "caderno") {
    return `
      <h4>Caderno de anotação</h4>
      <p class="muted">Use este espaço para registrar fórmulas, dúvidas e atalhos.</p>
      <textarea id="note_input_${q.id}" placeholder="Minhas anotações...">${notes[q.id] || ""}</textarea>
      <div class="inline-actions">
        <button class="primary-btn" onclick="saveNote(${q.id})">Salvar anotação</button>
      </div>
    `;
  }

  const questionReports = reports[q.id] || [];
  return `
    <h4>Notificar erro</h4>
    <p class="muted">Ex.: enunciado incompleto, alternativa incorreta, erro de digitação.</p>
    <textarea id="report_input_${q.id}" placeholder="Descreva o erro encontrado..."></textarea>
    <div class="inline-actions">
      <button class="primary-btn" onclick="reportError(${q.id})">Enviar notificação</button>
    </div>
    ${
      questionReports.length
        ? `<p><strong>Notificações enviadas nesta questão:</strong> ${questionReports.length}</p>`
        : "<p class='muted'>Nenhuma notificação enviada ainda.</p>"
    }
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
            <div class="meta">${q.grade} · ${q.subject} · ${q.topic} · ${q.difficulty}</div>
          </div>

          <div class="question-body">
            <p>${q.text}</p>
            <div class="options">
              ${q.options
                .map(
                  (option, idx) => `
                    <label class="option-item">
                      <span class="option-letter">${letters[idx]}</span>
                      <input type="radio" name="q_${q.id}" value="${idx}" ${
                        answer && answer.selectedIndex === idx ? "checked" : ""
                      } />
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

[gradeFilter, subjectFilter, difficultyFilter, searchFilter].forEach((element) => {
  element.addEventListener("input", renderQuestions);
});

fillSelect(gradeFilter, uniqueValues("grade"));
fillSelect(subjectFilter, uniqueValues("subject"));
fillSelect(difficultyFilter, uniqueValues("difficulty"));

updateStats();
renderQuestions();

window.answerQuestion = answerQuestion;
window.setActiveTab = setActiveTab;
window.addComment = addComment;
window.saveNote = saveNote;
window.reportError = reportError;
