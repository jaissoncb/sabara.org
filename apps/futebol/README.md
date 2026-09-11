# Futebol

Fundação mobile-first da aplicação Futebol, servida sob `/futebol/`.

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
