# Banco de Questões Escolar

MVP web para 7º, 8º e 9º ano do Ensino Fundamental e 1º ano do Ensino Médio, com foco em Matemática e Física.

## Funcionalidades

- login de usuário (aluno/admin) com botão **Login** no topo;
- filtros por série, disciplina, dificuldade e termo;
- resolução com aba de gabarito comentado;
- vídeo de resolução embutido no gabarito comentado;
- abas por questão: aulas, comentários, caderno e notificar erro;
- área administrativa para cadastrar novas questões;
- estatísticas básicas de desempenho.

## Credenciais de teste

- Aluno: `aluno` / `aluno123`
- Admin: `admin` / `admin123`

## Área de administração

Com usuário admin é exibido um formulário para cadastrar:

- série, disciplina, assunto e dificuldade;
- enunciado;
- alternativas (uma por linha);
- índice da alternativa correta (começando em 0);
- explicação textual;
- URL de vídeo no YouTube;
- aulas no formato `Título | URL`.

As novas questões ficam salvas no navegador (`localStorage`).

## Como usar

1. Abra `index.html` no navegador (ou rode `python -m http.server 4173` e acesse `http://localhost:4173`).
2. Clique no botão **Login** no topo e faça login.
3. Filtre, responda e navegue nas abas da questão.
4. Se for admin, use a área de administração para cadastrar questões.

## Estrutura

- `index.html`: login, app principal e formulário admin.
- `styles.css`: estilos de layout, abas, vídeo e formulários.
- `app.js`: regras de autenticação, renderização de questões e persistência local.
