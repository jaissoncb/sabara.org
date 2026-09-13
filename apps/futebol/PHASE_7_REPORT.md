# Fase 7 — Persistência, histórico e compartilhamento

## Escopo e fontes

Requisitos recuperados das instruções atuais do usuário, `AGENTS.override.md`, relatórios das Fases 4/5/6, GameFlow, serviços existentes e contrato real de `20260912195435_save_match_draw.sql`. Preflight: branch `codex/futebol-mvp`, HEAD/origin `67744085a06c9f16988c13f3586a26c040e29fea`, working tree limpa. As seis migrations já estavam aplicadas local/remotamente.

Esta entrega conclui o frontend da Fase 7. A migration/RPC aprovada não foi modificada; nenhuma migration nova foi criada. Não há placar/gols, exclusão, URL pública, token público, QR, acesso anon ou integração externa de WhatsApp.

## Fluxo e persistência

| Responsabilidade | Implementação |
| --- | --- |
| Criar/salvar partida | UUID criado no cliente antes da primeira chamada; somente RPC `save_match_draw(uuid,jsonb)` |
| Configuração | Nome/horário opcionais, data, 2/3 times e quantidade em quadra em `matches` |
| Participantes | Todos os jogadores do resultado final enviados a `match_players`; presença definida pela RPC |
| Snapshots | Nome, apelido, nível, goleiro e posição preferida capturados na primeira tentativa de salvar |
| Resultado | Times e escalação final aceita em `teams`/`team_assignments` |
| Seed/versão/score | Cada execução preservada em `draw_runs`; precisão persistida do score segue numeric(8,3) |
| Ajustes manuais | Fonte `manual` somente se time ou titular/reserva final diferir do último draw-base |
| Histórico | Por grupo, somente `drawn`, data/hora/created_at/id decrescentes; páginas de 50 |
| Detalhe | Configuração, snapshots, titulares/reservas, origem manual e dados de todos os sorteios |
| Compartilhamento | Texto do detalhe salvo, Web Share API prioritária e fallback clipboard |
| Permissões | Owner/admin salvam; owner/admin/member leem; RLS/grants existentes continuam autoridades |
| Aceitar/finalizar | Ação explícita “Salvar e aceitar sorteio”; somente o último run accepted e partida drawn |

O estado técnico `draft` e a atualização final para `drawn` pertencem à transação existente da RPC. O frontend não executa inserts diretos para salvar o grafo, não anuncia sucesso antecipadamente e não usa `completed`.

`match-service.ts` exige que a resposta válida seja exatamente o UUID solicitado. Resposta ausente/divergente, erro de servidor, erro de rede e timeout não são considerados confirmação de sucesso nem prova de rollback. A requisição recebe AbortSignal com timeout de 20 segundos; abortar a espera não implica que a transação remota foi desfeita.

## Retry, estado e UX

- UUID/payload são preparados uma única vez e preservados em memória durante a tentativa. Retry usa o mesmo objeto lógico e a mesma chave, inclusive se o elenco carregado mudar depois da primeira chamada.
- Ref síncrona bloqueia double-submit antes do próximo render. Saving, erro incerto, retry e saved são distintos.
- Após falha, edição/reroll/drag ficam bloqueados. “Abandonar tentativa e editar” exige confirmação e recomenda verificar o histórico, pois a partida pode ter sido salva. Abandonar explicitamente libera uma nova tentativa; pode criar outra partida se a anterior já tiver concluído. Nunca reutilizar a chave antiga para conteúdo divergente nem assumir que não houve commit.
- Troca de grupo/criação de grupo ficam bloqueadas durante saving/erro incerto; formulários de grupo já abertos também bloqueiam submit. Recargas do elenco não desmontam o fluxo. Beforeunload solicita aviso enquanto a resposta estiver pendente/incerta.
- Após sucesso, os snapshots congelados continuam na tela e os controles de edição permanecem desabilitados. A UI informa “Partida salva e sorteio aceito”, abre o detalhe e oferece “Ver partida salva”. Não há outro botão de salvar aquele resultado.
- “Criar outra partida” inicia uma sessão nova somente após um sucesso. Abrir/fechar o histórico mantém o draft atual montado. Voltar do detalhe recarrega a lista.

Limite consciente: tentativas não são armazenadas em localStorage/IndexedDB. O retry é garantido dentro da sessão montada. Confirmar saída/recarregar/encerrar o aplicativo pode perder o estado local; antes de recriar, consultar o histórico. O aviso beforeunload depende do suporte do navegador. Não existe fila offline ou promessa de salvamento offline.

## Sequência de sorteios e ajustes

Cada draw bem-sucedido acrescenta um run, numerado de 1 a N na ordem real. Reroll não apaga runs anteriores. O payload aceita somente N; todos os anteriores ficam accepted=false. A seed, versão e score são os da engine, mesmo após alterações manuais da escalação.

Regra de invalidação: qualquer mudança efetiva da configuração do formulário (inclusive nome/data/horário) ou da seleção descarta a sequência anterior. Visitar as etapas sem alterações preserva a sequência; acionar Sortear novamente gera mais um run. Mudança de elegibilidade, nível ou goleiro de participantes selecionados invalida a prévia e exige revisar/sortear novamente. Mudança de nome/apelido não afeta a engine e será snapshotada no momento do primeiro save. A ordem visual do elenco não altera a identidade do contexto.

`assignment_source` compara, por jogador, time e condição titular/reserva final com o último draw. Alterar e depois voltar ao slot original resulta em `draw`; não se marca `manual` apenas porque houve uma interação anterior. Reservas continuam pertencendo ao time final. A engine e `adjustments.ts` não foram alterados.

## Histórico, snapshots e compartilhamento

Consultas incluem group_id e match_id explícitos, além das RLS. O detalhe lê `matches`, `match_players`, `teams`, `team_assignments` e `draw_runs`; nunca consulta `players` para reconstruir partidas antigas. Atualizações futuras no elenco não mudam nomes, níveis, goleiros ou posições históricos.

Erros de leitura, histórico vazio, loading e retry são explícitos. Detalhes sem times/participantes/assignments completos ou sem exatamente um run final aceito não são apresentados como um resultado válido. Não há controles de alteração/exclusão no detalhe, para nenhum papel.

O texto inclui nome, data/horário disponíveis, quantidade/configuração de times, titulares, reservas e indicação de goleiro. Web Share não envia URL. Falha da API nativa tenta copiar; cancelamento explícito não copia silenciosamente. Clipboard ausente/negado mostra erro claro e mantém o detalhe.

## Arquivos desta entrega frontend

Criados:

- `src/matches/draw-payload.ts` e `draw-payload.test.ts`
- `src/matches/match-service.ts` e `match-service.test.ts`
- `src/matches/share-result.ts` e `share-result.test.ts`
- `src/matches/MatchHistory.tsx` e `MatchHistory.test.tsx`
- `src/matches/MatchWorkspace.tsx`
- `src/matches/GameFlow.persistence.test.tsx`
- `src/matches/test-fixtures.ts` (somente testes)
- `scripts/test-draw-contract.mjs`
- `PHASE_7_REPORT.md`

Modificados:

- `src/draw/GameFlow.tsx`
- `src/groups/GroupDashboard.tsx` e `GroupDashboard.test.tsx`
- `src/lib/supabase/database.types.ts` (adição gerada pela CLI local para a RPC)
- `src/styles.css`
- `README.md`

Sem dependências novas, mudanças em workflows/arquivos compartilhados, migrations, RLS, RPC, Auth ou site raiz.

## Validação efetivamente executada

- `pnpm test`: 127/127 PASS, 14 arquivos, sem skips. Preservadas regressões da engine Fase 4, fluxo Fase 5 e ajustes/reservas/goleiros Fase 6.
- `pnpm exec vitest run src/matches`: 36/36 PASS, cinco arquivos. Mais um teste de integração de retry/recarga/troca de grupo em GroupDashboard na suíte completa.
- Cobertura: payload/configuração/snapshots, UUID antes da chamada, resposta inválida, timeout, erro/retry com mesma chave/conteúdo, double-submit, abandono explícito, sucesso, sequência de rerolls/invalidação, fonte manual/draw por time e slot, loading/vazio/ordenação/paginação/detalhe, member read-only, owner/admin, snapshots contra elenco atual, Web Share/cópia/cancelamento/erros.
- `pnpm dlx supabase@2.117.0 test db --local supabase/tests/database`: 222/222 PASS, seis arquivos. RLS/grants owner/admin/member/anon, isolamento/cross-group, função invoker/ACL, constraints e atomicidade/idempotência aprovados.
- `node supabase/tests/save-match-draw-concurrency.mjs`: 4/4 PASS (perda de resposta com commit real, concorrência equivalente, divergente e recuperação após rollback).
- `node apps/futebol/scripts/test-draw-contract.mjs`: PASS. Payload real do frontend gerado pela engine, três runs, swaps de time/titular-reserva, snapshots, reservas e retry reordenado aceitos pela RPC LOCAL. Doze jogadores sintéticos e todo o grafo revertidos por ROLLBACK. Nenhum endpoint/credential remoto utilizado. Requer Node >=22.18 e Docker local; ambiente executado Node 24.19.0.
- Lint: PASS, zero warnings. Typecheck: PASS.
- Build/PWA: PASS, 11 entradas de precache; base, manifest, scope e service worker limitados a `/futebol/`. Módulo MatchWorkspace separado; nenhuma alteração de deploy. Aviso não bloqueante do Vite: bundle principal de 500,01 kB, ligeiramente acima de 500 kB; sem refactor fora do escopo.
- `git diff --check`: PASS; revisão integral do diff, incluindo arquivos novos, realizada antes do commit.
- Histórico remoto consultado somente por metadados: exatamente as seis migrations previstas, incluindo `20260912195435_save_match_draw`; sem nova pendência. Nenhum SQL remoto ou db push nesta entrega frontend.

Web Share/clipboard e interações mobile foram testados com mocks/jsdom, não em dispositivo físico. O contrato real foi validado no Postgres local; não foi criada partida de teste remota nem executado teste funcional contra dados reais. A geração local de tipos retornou um MaxListenersExceededWarning interno, mas terminou com sucesso e o resultado corresponde ao contrato aprovado.

## Segurança, Git e encerramento

A sexta migration e sua validação/aplicação remota foram concluídas na subetapa anterior, sob autorização separada. Esta entrega frontend não modificou Supabase remoto, Auth ou políticas. Os avisos remotos já registrados sobre `create_group` SECURITY DEFINER e proteção contra senhas vazadas não foram corrigidos automaticamente.

Branch `codex/futebol-mvp`, base `67744085a06c9f16988c13f3586a26c040e29fea`. Main local permanece `0855969c79576149daf3c880e6429f2e0ffc2cff`. `origin/main` avançou externamente para `6286335e9cb96eb140c2683ab609da0760b440e7`; não foi incorporada por merge/rebase. Site raiz intacto no diff desta branch.

Commit/push desta entrega foram autorizados; o SHA final e igualdade HEAD/origin/working tree limpa serão confirmados na mensagem de encerramento após o checkpoint. O push da branch executa CI; o job de deploy continua condicionado a main e à trava existente. Nenhum merge, rebase, deploy ou início da próxima fase.
