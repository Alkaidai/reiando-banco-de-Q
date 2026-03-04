# Banco de Questões Escolar

MVP web de questões para 7º, 8º e 9º ano do Ensino Fundamental e 1º ano do Ensino Médio, com foco em Matemática e Física.

## Funcionalidades

- filtro por série, disciplina, dificuldade e busca por termo;
- questão com cabeçalho de série + assunto;
- resolução com feedback no gabarito comentado;
- aba **Gabarito Comentado** com explicação em texto e link de vídeo de resolução;
- aba **Aulas** com links dos assuntos abordados;
- aba **Comentários** por questão;
- aba **Caderno** para anotações por questão;
- aba **Notificar Erro** para registrar problemas da questão;
- estatísticas gerais de desempenho.

## Persistência local

As informações abaixo são salvas no `localStorage` do navegador:

- comentários;
- anotações (caderno);
- notificações de erro.

## Como usar

1. Abra `index.html` no navegador.
2. Filtre as questões.
3. Responda e abra as abas conforme necessidade.
4. Use comentários, caderno e notificação de erro para cada questão.

## Estrutura

- `index.html`: layout e áreas da tela.
- `styles.css`: estilos dos cards, alternativas e abas.
- `app.js`: dados de questões, filtros, respostas, abas e persistência local.
