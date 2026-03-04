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
Chaves prefixadas com `qb_`:
- `qb_currentUser`
- `qb_questionBank`
- `qb_topicsBank`
- `qb_seedVersion`

## Funcionalidades

### Aluno (`index.html`)
- Cards de desempenho (respondidas, acertos, %).
- Filtros: série, disciplina, dificuldade, tópico e busca.
- Responder questão com botão confirmar, travando opções após resposta.
- Feedback de acerto/erro + explicação pós-resposta.
- Comentários por questão.
- Botão **Admin** aparece apenas se `role=admin`.

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
