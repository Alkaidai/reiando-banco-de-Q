# Banco de Questões Escolar (Etapa 1)

Projeto estático (sem build) para GitHub Pages com:

- área do aluno em `/` (`index.html`)
- área admin separada em `/admin.html`

## Login e roles

- `aluno` / `aluno123` => `role: "student"`
- `admin` / `admin123` => `role: "admin"`

A sessão é salva em `localStorage["currentUser"]` com formato:

```json
{ "username": "admin", "role": "admin" }
```

## Banco de questões

As questões ficam em `localStorage["questionBank"]`.

- O app sempre garante seed com **3 questões fixas** quando estiver vazio.
- Cada questão já inclui estrutura para futuro: `comments: []`.

## Área do aluno (`index.html` + `app.js`)

- login;
- filtros;
- resolução e desempenho;
- botão **Admin** no topo somente para `role=admin`.

## Área admin (`admin.html` + `admin.js`)

- acesso permitido somente para `role=admin`.
- para não admin: tela **Acesso negado** + link voltar.
- CRUD de questões:
  - listar
  - criar
  - editar
  - excluir
- botão **Reset para exemplos** (restaura as 3 questões fixas).

## Rodar localmente

```bash
python -m http.server 4173
```

Abrir:

- `http://localhost:4173/`
- `http://localhost:4173/admin.html`
