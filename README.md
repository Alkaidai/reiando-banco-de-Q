# Banco de Questões (MVP estático)

Projeto estático para GitHub Pages com duas áreas:
- `/index.html` (Aluno)
- `/admin.html` (Admin)

## Credenciais seed
- Aluno: `aluno / aluno123`
- Admin: `admin / admin123`

## Estrutura

```txt
/assets
  /images
/data
  questions.seed.json
  topics.seed.json
  lessons.seed.json
/src
  constants.js
  storage.js
  ui.js
  lessons.js
  app.js
  admin.js
/styles
  main.css
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
- `bq_trainingPlans`
- `bq_users`
- `bq_admin_selectedStudentId`

## Funcionalidades

### Aluno (`index.html`)
- Estado de autenticação com `#loginView` e `#appView` (visitante vê só login; logado vê dashboard/questões/caderno).
- Dashboard com Respondidas, Acertos e Aproveitamento (%), calculado via `bq_attempts`.
- Mensagem de início: **Comece respondendo questões.** quando não há tentativas.
- Top 3 tópicos mais fracos por taxa de erro.
- Revisão imediata das últimas 10 questões erradas com botão **Refazer**.
- Aba **Questões** com filtros: série, disciplina, dificuldade, tópico e busca.
- Card de questão com abas internas: Gabarito comentado, Aulas, Comentários, Caderno e Notificar erro.
- Fluxo de resposta com confirmar/travar alternativas/feedback/explicação.
- Aba **Caderno de erros** com notas editáveis e status (`pending`/`mastered`).
- Na aba **Notificar erro**, aluno pode enviar report com tipo e descrição para triagem do admin.

### Admin (`admin.html`)
- Login admin obrigatório.
- Dashboard com visão geral: total de questões, publicadas/rascunho, distribuições por série/disciplina/dificuldade, usuários, tentativas e acerto global.
- Ranking global: tópicos mais errados e questões com maior % de erro.
- Aba **Usuários** com inspeção individual (respondidas, acertos, aproveitamento, tópicos fracos e tentativas recentes).
- Aba **Caderno** para inspeção do notebook do usuário selecionado, com filtros e atalho para abrir questão.
- CRUD de questões com validações:
  - campos obrigatórios,
  - mínimo de 2 alternativas,
  - índice da correta dentro do range.
- Aba **Tópicos** com CRUD completo (criar/editar/desativar/excluir) persistido em `localStorage`.
- Aba **Erros reportados** com triagem completa (open/resolved/ignored), nota do admin e atalho para abrir a questão.
- Lista de questões com resumo e ações editar/excluir.
- Moderação de comentários (responder, ocultar, reabrir).
- Botão **Reset seed** para restaurar os dados de exemplo.

## Rodar local

```bash
python -m http.server 4173
```

Abra:
- `http://localhost:4173/index.html`
- `http://localhost:4173/admin.html`


## Logo
Coloque a logo em `assets/images/logo-cade-o-xis.png` para aparecer no topo do aluno e admin.

## Cadastro de aulas (Admin)
- Acesse `http://localhost:4173/admin.html` com `admin / admin123`.
- Abra a aba **Aulas**.
- Preencha título, link, disciplina, série e tópico.
- Clique em **Salvar aula** para persistir no `localStorage`.
- As aulas cadastradas passam a aparecer na aba **Aulas** das questões na área do aluno.
