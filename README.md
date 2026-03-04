# Banco de Questões Escolar

Projeto estático (HTML/CSS/JS) compatível com GitHub Pages, com separação real entre área do aluno e painel administrativo.

## Rotas

- Aluno: `/` (arquivo `index.html`)
- Admin: `/admin.html`

## Login de teste

- Aluno: `aluno` / `aluno123`
- Admin: `admin` / `admin123`

## Área do aluno (`index.html`)

- filtros por série, disciplina, dificuldade e busca;
- resolução de questões;
- abas por questão: gabarito comentado (com vídeo), aulas, comentários, caderno e notificar erro;
- desempenho básico;
- se logado como admin, mostra botão **Admin** no topo para abrir `/admin.html`.

## Área administrativa (`admin.html`)

- login admin obrigatório (`admin/admin123`);
- menu com: **Dashboard | Questões | Aulas | Erros reportados**;
- **Questões (CRUD completo)**:
  - listar;
  - nova questão;
  - editar;
  - excluir;
  - persistência em `localStorage["questionBank"]`;
- importação JSON simples de questões (textarea + botão Importar);
- **Aulas (CRUD)** com persistência em `localStorage["lessonsBank"]`;
- visualização de erros reportados pelos alunos (`localStorage["question_reports"]`).

## Persistência local

- `questionBank`: banco principal de questões;
- `lessonsBank`: banco de aulas;
- `question_comments`: comentários por questão;
- `question_notes`: caderno por questão;
- `question_reports`: erros reportados;
- `user_session`: sessão de login.

## Execução local

Abra `index.html` direto no navegador ou rode:

```bash
python -m http.server 4173
```

Depois acesse:

- `http://localhost:4173/`
- `http://localhost:4173/admin.html`
