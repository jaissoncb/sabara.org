# Fase 2B.2C e Fase 3

Data: 2026-09-12. Branch: `codex/futebol-mvp`.

## Entrega

Retomada das alterações não commitadas da execução anterior, preservando a implementação. Grupos: listagem, seleção, criação atômica e ajustes pelo owner. Jogadores: listagem por grupo, cadastro, edição, nível, posição, goleiro e desativação/reativação. Owner/admin gerenciam o elenco; member lê. Estados loading, empty, erro e nova tentativa. Formulários preservam entradas em erro e reinicializam ao trocar de jogador. Trocar usuário reinicializa o workspace. Nenhuma dependência adicionada.

A autorização permanece nas RLS e grants existentes. A RPC não recebe identidade do cliente. Updates usam retorno de uma linha para detectar operações bloqueadas por RLS. Não foram adicionadas migrations, policies ou permissões. Não há engine de sorteio ou funcionalidades da Fase 4.

## Validação

- pgTAP local: 118 verificações aprovadas em cinco arquivos. Casos de isolamento, papéis, ownership, entradas inválidas, identidade ausente e rollback quando a segunda inserção falha.
- Frontend: testes de componentes com serviços simulados e testes de serviço com client simulado, incluindo criação/edição, controles por papel, desativação, erro, nova tentativa, troca de formulário e update sem linha visível. Não foram criados usuários ou dados de teste no remoto.
- Lint e typecheck aprovados.
- Build aprovado; verificação automatizada de base, manifest, scope e service worker em `/futebol/` aprovada. Instalação PWA manual em dispositivo não foi executada.
- `git diff --check` aprovado.
- Consultas remotas somente leitura: definição/ACL de `create_group`, plano da organização, Advisors e migrations.

## Segurança e migrations

Ver [disposição detalhada](../../supabase/SECURITY_ADVISOR.md). `SECURITY DEFINER` mantido intencionalmente; não é necessário ampliar permissões para silenciar o Advisor. Plano Free confirmado: proteção contra senhas vazadas indisponível, finding conhecido e não bloqueante. Security Advisor com dois warnings aceitos/conhecidos e nenhum erro. Performance Advisor com 12 INFO de índices não usados, nenhum warning/erro.

Arquivos de migrations, banco local e remoto contêm as mesmas cinco versões: `20260911113852`, `20260911113856`, `20260911113900`, `20260911152916`, `20260911200324`.

## Arquivos

Criados:

- `apps/futebol/src/groups/GroupDashboard.tsx`
- `apps/futebol/src/groups/GroupDashboard.test.tsx`
- `apps/futebol/src/groups/group-service.ts`
- `apps/futebol/src/groups/group-service.test.ts`
- `apps/futebol/PHASE_3_REPORT.md`
- `supabase/SECURITY_ADVISOR.md`
- `supabase/tests/database/05_group_creation_abuse.test.sql`

Modificados:

- `apps/futebol/src/App.tsx`
- `apps/futebol/src/App.test.tsx`
- `apps/futebol/src/styles.css`
- `apps/futebol/README.md`
- `supabase/tests/database/01_schema_contract.test.sql`

## Limites preservados

Main e site raiz não alterados. Nenhuma escrita no Supabase remoto, Auth ou billing. Nenhum deploy ou merge. Commit/push limitados a `origin/codex/futebol-mvp`; hash e estado final são informados na entrega após a operação. Encerramento antes da Fase 4.
