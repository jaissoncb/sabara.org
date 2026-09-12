# Fase 5 — Fluxo de jogo, participantes e resultado

## Entrega

Owner e admin agora criam um jogo temporário dentro do grupo em três etapas: configuração, participantes e resultado. A configuração aceita nome e horário opcionais, data, 2 ou 3 times e quantidade de jogadores em quadra. A segunda etapa lista somente os jogadores ativos do grupo, tem seleção total/limpeza, contador, estado vazio e retorno à configuração.

O resultado reutiliza diretamente `src/draw/engine.ts`, sem alterar suas regras, seed ou versão. Os cards mostram nome/data do jogo, tamanho, soma, média, goleiros, quem começa em quadra, reserva inicial e a necessidade de empréstimo quando um time não alcança a quantidade em quadra. É possível voltar aos participantes ou à configuração com os dados mantidos.

Não existe escrita no Supabase: o jogo e o resultado ficam somente no estado do componente e a interface deixa isso explícito. Não há placar, gols, reroll, drag-and-drop, mudanças interativas de reservas, persistência, histórico ou compartilhamento.

## Arquivos

Criado:

- `src/draw/GameFlow.tsx`
- `PHASE_5_REPORT.md`

Modificados:

- `src/draw/DrawPanel.tsx`
- `src/draw/DrawPanel.test.tsx`
- `src/styles.css`
- `README.md`

## Validação

- Typecheck, lint, build/PWA e `git diff --check` executados localmente.
- Vitest: 75 testes ativos aprovados em oito arquivos. Oito testes da prévia substituída ficaram marcados como legado; os novos testes cobrem roles, configuração, seleção, 5/5/4, goleiros, aviso de empréstimo, retorno para edição, estado vazio e falha de aleatoriedade sem expor detalhe técnico.

## Limites e segurança

Não houve migration, alteração de schema/RLS/Auth, escrita no Supabase remoto, mudança no site raiz, arquivo compartilhado, `main`, merge ou deploy. A Fase 6 permanece responsável por novo sorteio e ajustes interativos; a Fase 7, por salvar jogos, histórico e compartilhamento.
