# Banco de Questões (MVP estático)

Projeto estático para GitHub Pages com duas áreas:
- `/index.html` (Aluno)
- `/admin.html` (Admin)

## Credenciais seed
- Aluno: `aluno / aluno123`
- Admin: `admin / admin123`

## Estrutura

```txt
/data
  questions.seed.json
  topics.seed.json
/src
  constants.js
  storage.js
  ui.js
  app.js
  admin.js
/styles
  styles.css
index.html
admin.html
```

## Modelo de questão

```json
{
  "id": "q_x",
  "grade": "7EF|8EF|9EF|1EM",
  "subject": "math|physics",
  "difficulty": "easy|medium|hard",
  "topicId": "string",
  "statement": "string",
  "options": ["string", "string"],
  "correctIndex": 0,
  "explanation": "string",
  "status": "published|draft",
  "createdAt": "ISOString",
  "updatedAt": "ISOString",
  "comments": []
}
```

## Persistência localStorage
- `qb_currentUser`
- `qb_questionBank`
- `qb_topicsBank`
- `qb_seedVersion`
- `bq_attempts`
- `bq_notebook`

## Funcionalidades

### Aluno (`index.html`)
- Dashboard com Respondidas, Acertos e Aproveitamento (%), calculado via `bq_attempts`.
- Mensagem de início: **Comece respondendo questões.** quando não há tentativas.
- Top 3 tópicos mais fracos por taxa de erro.
- Revisão imediata das últimas 10 questões erradas com botão **Refazer**.
- Aba **Questões** com filtros: série, disciplina, dificuldade, tópico e busca.
- Fluxo de resposta com confirmar/travar alternativas/feedback/explicação.
- Aba **Caderno de erros** com notas editáveis e status (`pending`/`mastered`).

### Admin (`admin.html`)
- Login admin obrigatório.
- CRUD de questões com validações:
  - campos obrigatórios,
  - mínimo de 2 alternativas,
  - índice da correta dentro do range.
- Lista de questões com resumo e ações editar/excluir.
- Moderação de comentários (responder, ocultar, reabrir).
- Botão **Reset seed** para restaurar os dados de exemplo.

## Rodar local

```bash
python3 -m http.server 4173
```

Abra:
- `http://localhost:4173/index.html`
- `http://localhost:4173/admin.html`
