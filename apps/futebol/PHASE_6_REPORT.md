# Fase 6 — Reroll, ajustes interativos, reservas e drag-and-drop

## Entrega

O resultado local do jogo agora pode ser ajustado sem persistência. “Novo sorteio” gera uma seed Web Crypto nova e chama novamente a engine da Fase 4 para todos os times; quando há alteração manual, a interface pede confirmação e descarta esses ajustes somente após confirmação.

Os cards separam “Em quadra” e “Reservas”. O organizador pode arrastar um jogador sobre outro para trocar seus times ou usar comandos acessíveis: seleciona um jogador e aciona “Trocar com selecionado”; no mesmo time, seleciona titular ou reserva e aciona “Trocar titular/reserva”. Soltar sobre um card tenta uma movimentação simples, que é aceita apenas se a distribuição continuar válida; em qualquer outro caso a interface explica que o ajuste foi recusado, sem perder ou duplicar jogadores.

`src/draw/adjustments.ts` é a camada pura de edição local. Ela preserva participantes únicos, reservas pertencentes ao próprio time, diferença máxima de um jogador entre times, a quantidade de pessoas em quadra quando há elenco suficiente e um goleiro em quadra em cada time que possua goleiro. Quando o sorteio original não consegue distribuir goleiros a todos os times, a UI indica claramente o time sem goleiro disponível. Métricas de soma, média e goleiros são recalculadas após cada ajuste; a UI identifica o resultado ajustado e deixa explícito que não reotimiza o balanceamento.

Nenhum dado é salvo. Não há histórico, aceite, compartilhamento, placar ou gols.

## Arquivos

Criados:

- `src/draw/adjustments.ts`
- `src/draw/adjustments.test.ts`
- `src/draw/local-date.ts`
- `PHASE_6_REPORT.md`

Modificados:

- `src/draw/GameFlow.tsx`
- `src/draw/DrawPanel.test.tsx`
- `src/styles.css`
- `README.md`

Os oito testes pulados da prévia removida foram resolvidos: os casos exclusivos da UI anterior foram removidos, e os comportamentos relevantes foram reescritos para o fluxo atual. Não permanecem skips legados.

## Validação

- Testes específicos: `pnpm exec vitest run src/draw/adjustments.test.ts src/draw/DrawPanel.test.tsx` — 19/19 PASS.
- Lint: `pnpm lint` — PASS, zero warnings.
- Typecheck: `pnpm typecheck` — PASS.
- Suíte frontend completa: `pnpm test` — 90/90 PASS em nove arquivos.
- Build/PWA: `pnpm build` — PASS; 11 entradas de precache e base, manifest e service worker confirmados sob `/futebol/`.
- `git diff --check` — PASS. Revisão integral do diff: engine da Fase 4 e os fluxos existentes das Fases 4/5 preservados.
- pgTAP não se aplica: esta fase não altera banco, migrations, RLS ou serviços Supabase.

## Revisão corretiva

Após a entrega inicial, `swapPlayers` passou a transferir também o slot ocupado: o jogador recebido assume reserva ou titularidade exatamente onde o jogador trocado estava. Uma movimentação simples promove uma reserva quando necessário para manter o número de titulares. A cobertura de goleiros é agora global: há goleiro em quadra em todos os times quando possível e, se houver menos goleiros que times, os ajustes não podem reduzir a quantidade máxima de times cobertos. Trocas válidas de goleiros continuam permitidas.

O fluxo limpa a seleção local depois de um ajuste bem-sucedido e antes de um reroll, evitando comandos posteriores contra o `teamIndex` anterior. A data padrão foi corrigida para `YYYY-MM-DD` por campos locais de `Date`, sem a conversão UTC de `toISOString`.

Foram acrescentados testes explícitos para os quatro pares de slots (titular/reserva), cobertura de goleiros suficiente e insuficiente, tentativa de concentração por troca ou movimento, troca válida de goleiros, limpeza de seleção e data local. Testes específicos desta revisão: 19/19 PASS.

## Limites e segurança

A engine da Fase 4 não foi modificada. Nenhuma migration, schema, RLS, Auth, secret ou operação no Supabase remoto foi realizada. O site raiz, `main`, arquivos compartilhados, merge e deploy permanecem fora do escopo.
