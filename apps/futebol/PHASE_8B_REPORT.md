# Fase 8B — Hardening do banco para release

Data: 2026-09-13. Escopo: Futebol, implementação e validação LOCAL.
**Release: NOT READY.** A sétima migration ainda exige aplicação remota
separadamente autorizada; o blocker de configuração pública do build/deploy
da Fase 8 permanece. Nenhum workflow, secret, Auth ou site principal mudou.

## Causa raiz e arquitetura

Na Fase 8, a RPC validava o grafo, mas SECURITY INVOKER dependia de grants
diretos de authenticated. Owner/admin conseguiam contorná-la: colocar todos
os jogadores na reserva, retirar o accepted de todos os runs e inserir uma
partida drawn sem grafo. A reprodução anterior produzia `GAP:[2, 0, 2, 1]`.
RLS limitava o grupo/role, mas não assegurava invariantes entre várias linhas.

A fronteira escolhida é `public.save_match_draw(uuid,jsonb)` SECURITY DEFINER,
owner explícito `postgres`, `search_path=pg_catalog`. Assinatura, retorno UUID,
normalização, comparação lógica, advisory lock, validações e contrato do
frontend permanecem. Todas as referências da aplicação e chamadas/tipos
comuns do catálogo são qualificadas. Não há SQL dinâmico nem objetos
temporários na RPC; COALESCE/NULLIF/LEAST são construções SQL.

INVOKER não poderia continuar funcionando após retirar os grants de escrita
do caller. DEFINER permite executar exclusivamente o salvamento transacional
validado. A autorização explícita substitui a dependência da RLS para as
escritas privilegiadas; RLS permanece protegendo as leituras do cliente.

Nova migration: `supabase/migrations/20260913081632_harden_save_match_draw.sql`,
criada pela Supabase CLI. As seis migrations anteriores não foram editadas.
Não há alteração de default privileges, schema funcional, índices ou dados.

## Grants e policies antes/depois

Estado de authenticated antes: SELECT nas cinco tabelas; INSERT/UPDATE de
colunas específicas; DELETE de tabela exceto draw_runs. A sexta migration
também concedia INSERT de matches.id. Depois: SELECT preservado,
INSERT/UPDATE/DELETE de tabela e INSERT/UPDATE efetivos de TODAS as colunas
negados. O REVOKE de tabela retira também os grants correspondentes de coluna
no PostgreSQL; os testes verificam o resultado efetivo, não só ACL textual.

| Tabela | INSERT anterior | UPDATE anterior | DELETE anterior | Depois |
| --- | --- | --- | --- | --- |
| matches | id, grupo/configuração/status/creator | nome/data/hora/configuração/status | sim | SELECT via RLS |
| match_players | links, presença e snapshots | attendance_status | sim | SELECT via RLS |
| teams | links, índice/nome/cor | índice/nome/cor | sim | SELECT via RLS |
| team_assignments | links, reserva/origem | time/reserva/origem | sim | SELECT via RLS |
| draw_runs | links, número/seed/algoritmo/score/accepted | accepted | não | SELECT via RLS |

Removidas exatamente 14 policies de escrita: matches insert_managers,
update_managers, delete_owner; match_players/teams/team_assignments cada
insert_managers, update_managers, delete_managers; draw_runs insert_managers
e update_managers. As cinco policies SELECT de authenticated com
`private.is_group_member(group_id)` e RLS habilitada foram preservadas.

EXECUTE da RPC: authenticated permitido; PUBLIC, anon e service_role negados;
owner conserva seus privilégios. `has_function_privilege`,
`has_table_privilege` e `has_column_privilege` confirmam o estado local,
incluindo privilégios herdados/PUBLIC efetivos. Anon não ganhou acesso.
Postgres/service_role são identidades privilegiadas de infraestrutura,
com BYPASSRLS/privilégios administrativos; não representam o cliente normal.
Negar EXECUTE a service_role não retira seus privilégios administrativos
diretos. Nenhuma chave privilegiada entra no frontend.

## Identidade, autorização e concorrência

Ator deriva exclusivamente de `auth.uid()`; UID nulo falha com 42501.
`public.group_members` é consultada diretamente para o grupo alvo e ator,
exigindo role de aplicação owner/admin. Member/outsider/cross-group falham.
Created_by deriva do ator; payloads com user_id, owner_id, created_by, role,
status ou campos estranhos nos filhos são rejeitados. Nenhum header/GUC
adicional é usado como autorização. GUCs JWT nos testes são simulação local
da identidade entregue pelo Auth/Data API, não um contrato público novo.

A linha de membership é adquirida com **FOR SHARE**, mantida até o fim da
transação. Esse lock conflita tanto com UPDATE de role quanto DELETE;
FOR KEY SHARE seria insuficiente para demotion de uma coluna não chave.
Os testes usam duas sessões reais READ COMMITTED e observam
`pg_blocking_pids`, sem usar sleep fixo como prova de ordenação:

- Save adquire primeiro: demotion/removal espera, save completa, a mudança
  pode então fazer commit. Uma nova tentativa após revogação falha.
- Mudança adquire primeiro e faz commit: save espera, a consulta com lock
  reavalia a linha alterada/ausente e nega autorização; nenhuma partida surge.
- Mudança adquire primeiro e faz rollback: save espera e depois conclui
  com a membership admin ainda válida.

## Retry, isolamento e integridade

O advisory lock transacional por hash do UUID permanece. Mesmo ator com
mesmo conteúdo lógico retorna o mesmo UUID, sem duplicar; ordem de arrays e
campos opcionais normalizados conservam equivalência. Divergência nunca
sobrescreve e mantém o erro 22023. Resposta perdida depois de COMMIT,
concorrentes equivalentes/divergentes e primeiro escritor com rollback foram
reexecutados contra PostgreSQL real.

Antes de reconstruir um grafo existente, a RPC exige mesmo grupo e creator.
Outro ator/grupo recebe somente `40001: match id unavailable; retry in a fresh
transaction`, igual à indisponibilidade do INSERT, sem UUID/conteúdo retornado.
Testes procuram nomes, seeds e IDs dos jogadores originais nas respostas e
confirmam que o retry do owner continua válido. O erro genérico não transforma
UUID conhecido em autorização nem divulga o conteúdo; UUIDs não devem ser
tratados como segredo ou mecanismo de autorização.

Todas as validações funcionais anteriores permanecem: grafo completo,
participantes únicos/presentes, snapshots e tipos/skill, dois/três times,
assignments completos, origem draw/manual, titulares/reservas, cobertura de
goleiros, tamanhos equilibrados, runs contíguos com exatamente um accepted
no último run e status drawn só ao terminar. Falha tardia faz rollback total.
Não se afirma que o banco reexecuta o motor ou certifica a procedência de
snapshots, scores, seeds ou ajustes manuais fornecidos ao contrato válido.

O auditor da Fase 8 agora exige 42501 nas mesmas três corrupções para owner
e admin. Depois delas retorna `INTEGRITY:[0, 1, 1, 0]`, conserva o retry
equivalente do grafo inteiro e confirma rollback das oito categorias de
fixtures. Erro inesperado ou DML que apenas retorna zero sem negar permissão
não é aceito como sucesso da regressão. Outros testes cobrem INSERT/UPDATE/
DELETE em cada uma das cinco tabelas para owner/admin/member/outsider.

Shadowing foi exercitado com tabelas e função temporárias homônimas: a RPC
usa os objetos qualificados. Um domínio artificial pg_temp.uuid faz a função
confiável auth.uid() do Supabase rejeitar a chamada com 42P13, sem escrita.
Isso é uma falha fechada, não uma identidade alternativa. O Auth não foi
alterado; removido esse domínio artificial, o save passa mesmo com os outros
objetos temporários. A API normal não fornece criação de objetos SQL ao caller.

## Dados existentes, auditoria e rollback

`supabase/audits/drawn_match_integrity.sql` é uma consulta READ-ONLY preparada
para uma futura etapa autorizada. Requer identidade de infraestrutura que
veja todos os grupos; retorna apenas match_id/group_id e razões estruturais,
sem reparar dados nem atestar procedência do motor. Verifica configuração,
times/índices, participantes/presença, links e cobertura dos assignments,
isolamento de grupo, sequência/accepted dos runs, titulares/reservas/goleiros
e tamanhos de time. Zero linhas significa apenas ausência de violações
detectadas; histórico de migrations não prova ausência de alteração manual.
**Não executada remotamente.**

O teste local de upgrade reconstrói transacionalmente a fronteira antiga
exata (RPC/grants/14 policies), cria um grafo válido e dois drawn inválidos,
aplica a sétima migration e compara: auditor antes=2, depois=2, partidas=3.
O válido mantém retry; os inválidos são detectados e preservados. Todo o
ensaio, inclusive reconstrução do schema anterior, é revertido por ROLLBACK,
com fixtures zero e fronteira endurecida confirmada ao final.

A migration não apaga/repara registros. Antes de aplicação remota futura,
executar a auditoria sob autorização própria e revisar qualquer resultado.
Preferir correção progressiva mantendo DML fechado se surgir defeito.
Reverter somente o commit de código não reverte uma migration aplicada.
Eventual reversão de schema exige nova migration revisada/autorizada,
restaurando definição/grants/policies anteriores de forma consistente;
restaurar DML reabre o blocker da Fase 8 e conserva NOT READY. Não há rollback
automático ou reset remoto, e nenhuma reversão foi executada nesta fase.

## Frontend, advisors e riscos

Revisão de `src/matches/match-service.ts`: save exclusivamente por RPC;
histórico/detalhe por SELECT nas cinco tabelas. Nenhuma fonte de produção,
tipo gerado, dependência, lockfile ou UX foi alterada. A única mudança no
runner E2E é exigir sete versões de migration no preflight local.
Owner/admin save, member read-only, histórico/detalhe/snapshots, outsider e
retry passaram na API real local e no navegador Chrome.

Advisors locais CLI 2.117.0: zero WARN/ERROR, dois INFO unused_index:
team_assignments_group_player_idx e team_assignments_participant_fk_idx.
Índices preservados; carga sintética não justifica removê-los. Não ocorreu
finding 0029 local. `supabase/SECURITY_ADVISOR.md` documenta DEFINER intencional
e os controles compensatórios para eventual finding remoto da RPC.
A disposição anterior de create_group permanece; advisors/ACL/Auth remotos
não foram recertificados nesta etapa.

Riscos/limites: a fronteira privilegiada exige manter autorização e referências
qualificadas em mudanças futuras; transações longas podem prolongar espera
de membership e UUID, e workflows novos com vários locks exigem revisão de
ordem/deadlocks. A prova de ordenação corresponde ao READ COMMITTED da API;
clientes SQL com snapshots antigos devem tratar falhas transacionais/retry.
Operações privilegiadas e cascades de exclusão do grupo não foram retiradas
por esta correção mínima; exclusão não está exposta na UI e exige revisão
antes de um fluxo futuro. Dados inválidos antigos não são reparados.
Sucesso local não certifica produção, SMTP, dispositivos físicos ou outro
engine de navegador. O warning Vite de chunk inicial 503,89 kB segue a decisão
documentada da Fase 8, sem ocultá-lo por mudança artificial do limite.

## Validação executada

| Check | Resultado final |
| --- | --- |
| Supabase db reset --local | PASS, sete migrations reaplicadas |
| pgTAP completo | PASS, 541 assertions em sete arquivos |
| Concorrência/retry PostgreSQL real | PASS, 12 cenários, incluindo seis orderings de demotion/removal |
| Contrato frontend real | PASS, 12 participantes, três runs, ajustes/reservas/snapshots/retry; rollback |
| Auditor de corrupção | PASS, seis tentativas owner/admin negadas com 42501; grafo preservado; rollback |
| Upgrade com dados existentes | PASS, válido preservado, dois inválidos detectados sem reparo; rollback |
| Advisors locais | PASS, zero WARN/ERROR e dois INFO documentados |
| db lint --local public,private | PASS, sem erros |
| Frontend pnpm test | PASS, 136 testes em 15 arquivos, sem skips |
| Bundle security | PASS, três testes Node |
| E2E Chrome | PASS, 24 cenários, mobile/axe/PWA/update/offline; fixtures removidas |
| Lint / typecheck | PASS, zero warnings de lint |
| Build/PWA | PASS; base/scope /futebol/, scanner de credenciais, 12 precache/606,11 KiB |
| Build padrão depois das variantes E2E | PASS, gerado pela fonte, sem edição manual de dist |
| Diff --check / revisão integral | PASS antes do checkpoint |

Comandos locais: `pnpm dlx supabase@2.117.0 db reset --local`,
`test db --local supabase/tests/database`,
`db advisors --local --type all --level info --fail-on error`,
`db lint --local --schema public,private --fail-on error`;
`node supabase/tests/save-match-draw-concurrency.mjs`,
`node supabase/tests/hardening-upgrade.mjs`,
`node supabase/tests/audit-phase8-integrity.mjs`,
`node apps/futebol/scripts/test-draw-contract.mjs`;
no app: `pnpm test`, `pnpm test:bundle-security`, `pnpm test:e2e`,
`pnpm lint`, `pnpm typecheck`, `pnpm build`; `git diff --check`.

Falhas intermediárias de preparação/asserções não foram contadas como PASS:
fixtures antigas passaram a usar postgres local para continuar testando
constraints independentemente de grants; o teste de domínio uuid passou a
exigir falha fechada de auth.uid() em vez de sucesso indevido. As execuções
finais completas acima passaram. A revisão automática inicialmente rejeitou
o reset local; reavaliou a mesma operação com a autorização explícita da seção
17 do pedido e permitiu sua execução exclusivamente no Docker local.

## Arquivos e checkpoint Git

Criados:

- apps/futebol/PHASE_8B_REPORT.md
- supabase/migrations/20260913081632_harden_save_match_draw.sql
- supabase/tests/database/07_graph_write_boundary.test.sql
- supabase/tests/hardening-upgrade.mjs
- supabase/audits/drawn_match_integrity.sql

Modificados:

- apps/futebol/scripts/test-e2e.mjs
- supabase/SECURITY_ADVISOR.md
- supabase/tests/audit-phase8-integrity.mjs
- supabase/tests/database/02_rls_security.test.sql
- supabase/tests/database/06_save_match_draw.test.sql
- supabase/tests/save-match-draw-concurrency.mjs

Branch: `codex/futebol-mvp`. Base local/origin conferida:
`26d5afbe5c341dfbb4cc39b7ea4894b31f739a98`. O SHA do checkpoint que inclui
este relatório é o commit que o contém; obter com
`git log -1 --format=%H -- apps/futebol/PHASE_8B_REPORT.md`.
O SHA literal, push, igualdade HEAD local/remoto e working tree limpa são
confirmados na resposta final, pois a confirmação ocorre depois do commit.
Artefatos coverage/dist são ignorados e não incluídos no checkpoint.

Main e site principal preservados; seis migrations anteriores intactas.
Nenhum merge/rebase/deploy, db push real, SQL remoto, link, migration repair,
db pull, alteração Auth/SMTP/secrets ou aplicação remota foi autorizado aqui.
Push somente para origin/codex/futebol-mvp após todos os checks locais PASS.

## Histórico e dry-run remoto após checkpoint

Para respeitar a ordem expressa no pedido, este relatório é commitado ANTES
dessas consultas. No checkpoint, o resultado pós-push está pendente de
execução; a confirmação efetivamente observada é registrada na resposta final.
O histórico remoto anteriormente lido contém as seis versões da base, mas
será relido por metadata após o push, sem SQL remoto de dados/auditoria.

Dry-run prescrito e suportado pela CLI 2.117.0:
`pnpm dlx supabase@2.117.0 db push --linked --dry-run --skip-vault`.
Usa o vínculo local já existente, sem executar link ou enviar secrets ao Vault.
Critério: exatamente UMA migration pendente,
`20260913081632_harden_save_match_draw.sql`, sem aplicação. Qualquer divergência
ou impossibilidade será relatada, não contornada com repair/pull/push real.

Parar após checkpoint, leitura de metadata e dry-run. A aplicação remota da
sétima migration exige autorização separada e auditoria dos dados existentes;
a configuração pública do build/deploy continua sendo blocker independente.
**NOT READY** permanece o status de release.
