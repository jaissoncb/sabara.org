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

O Auth ainda não é inicializado nesta fase. Quando a Fase 2 adicionar o Supabase JS, o callback PKCE será consumido em `src/bootstrap/auth-pkce.ts` antes da montagem do `HashRouter`.
