# Futebol

Fundação mobile-first da aplicação Futebol, servida sob `/futebol/`.

## Fase 3 — Groups & Players

A página autenticada lista os grupos acessíveis via RLS e seu elenco. É possível criar um grupo pela RPC `create_group`; seu owner pode editar nome, esporte e quantidade por time. Owner/admin cadastram e editam jogadores (nome, apelido, nível de 1 a 5 em passos de 0,5, posição, goleiro e ativo). Membros possuem leitura. Desativar/reativar preserva o cadastro e o histórico; não existe exclusão de jogador pela interface.

Carregamento, primeira utilização, erros e nova tentativa são explícitos. Erros do servidor não são exibidos literalmente. A sessão é isolada por usuário e formulários são reinicializados ao trocar de jogador. Updates exigem uma linha retornada para não anunciar sucesso quando a RLS bloqueia a operação. As permissões visuais são conveniência; a autorização permanece no banco.

A Fase 7 conclui persistência, histórico por grupo e compartilhamento textual. Owner/admin configuram o jogo, sorteiam e ajustam times/titulares/reservas, preservando as regras das Fases 4–6. “Salvar e aceitar sorteio” grava o grafo inteiro pela RPC transacional `save_match_draw`, sem inserts sequenciais do frontend. A conclusão usa `drawn`, não `completed`.

Cada tentativa conserva UUID e payload para retry após falha ou timeout de 20 segundos, sem assumir rollback. A edição fica bloqueada até sucesso ou abandono explícito com aviso de possível gravação já concluída. Todos os rerolls do mesmo contexto são registrados; somente o último é aceito. Mudanças de configuração/participantes invalidam a sequência anterior. A escalação final distingue `draw`/`manual` por comparação com o último sorteio-base.

Owner/admin/member consultam partidas salvas, seus snapshots, times, reservas e histórico de seeds/versões/scores. O histórico mostra apenas `drawn`, em ordem decrescente de data/hora, com páginas de 50 partidas. Membros não recebem controles de escrita. Compartilhamento usa Web Share API e fallback clipboard, somente texto do resultado salvo — sem link público, token, placar, gols ou exclusão. Consulte `PHASE_7_REPORT.md` para decisões, testes e limites. A configuração PWA e `/futebol/` foi preservada. Consulte `supabase/SECURITY_ADVISOR.md` para a disposição da Fase 2B.2C.

## Requisitos

- Node.js 22 ou superior
- pnpm 11

## Comandos

```sh
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/test-draw-contract.mjs
```

## Ambiente público

Copie `.env.example` para `.env.local` e preencha somente:

```sh
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

Nunca coloque uma `service_role` ou `sb_secret_...` no frontend. Arquivos `.env*`, exceto o exemplo, são ignorados pelo Git.

O client usa PKCE, persiste e renova sessões válidas e desativa a detecção automática do callback. O bootstrap troca `?code=...` por sessão e limpa a URL antes de montar o `HashRouter`.

## Tipos do banco

Os tipos são gerados a partir do banco local e integrados ao client. Atualize-os sempre que o schema mudar:

```sh
pnpm dlx supabase@2.117.0 gen types typescript --local --schema public > apps/futebol/src/lib/supabase/database.types.ts
```

Não edite `database.types.ts` manualmente; a fonte da verdade são as migrations aplicadas localmente.

O teste de contrato requer Node >=22.18, Docker local e as seis migrations aplicadas. Ele usa o payload real do frontend contra a RPC local e faz rollback integral das fixtures; nunca usa credenciais ou endpoints remotos.
