# Futebol

Fundação mobile-first da aplicação Futebol, servida sob `/futebol/`.

## Fase 3 — Groups & Players

A página autenticada lista os grupos acessíveis via RLS e seu elenco. É possível criar um grupo pela RPC `create_group`; seu owner pode editar nome, esporte e quantidade por time. Owner/admin cadastram e editam jogadores (nome, apelido, nível de 1 a 5 em passos de 0,5, posição, goleiro e ativo). Membros possuem leitura. Desativar/reativar preserva o cadastro e o histórico; não existe exclusão de jogador pela interface.

Carregamento, primeira utilização, erros e nova tentativa são explícitos. Erros do servidor não são exibidos literalmente. A sessão é isolada por usuário e formulários são reinicializados ao trocar de jogador. Updates exigem uma linha retornada para não anunciar sucesso quando a RLS bloqueia a operação. As permissões visuais são conveniência; a autorização permanece no banco.

Partidas, sorteio e fases 4+ não foram implementados. A configuração PWA e `/futebol/` foi preservada. Consulte `supabase/SECURITY_ADVISOR.md` para a disposição da Fase 2B.2C.

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
