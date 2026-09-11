# Supabase local

Esta pasta contém toda a fundação de banco da aplicação Futebol. Ela não está ligada a um projeto remoto e não deve ser aplicada ao remoto antes da revisão da Fase 2A.

## Validação local

Com Node.js 22+, Docker em execução e a CLI oficial:

```sh
pnpm dlx supabase@2.117.0 start
pnpm dlx supabase@2.117.0 db reset --local
pnpm dlx supabase@2.117.0 test db --local supabase/tests/database
```

O `db reset --local` prova que as migrations constroem o banco do zero. Os testes pgTAP verificam o contrato, grants, criação atômica e isolamento RLS.

## Decisões de integridade

- `create_group` cria o grupo e o membership `owner` na mesma transação, sempre a partir de `auth.uid()`.
- Helpers RLS ficam no schema não exposto `private`, têm `search_path` fixo e evitam consultar `group_members` por uma policy recursiva.
- Nome, apelido, nível, posição e indicador de goleiro são copiados para `match_players`; alterações futuras no cadastro não reescrevem o histórico.
- `group_id` foi repetido nas tabelas filhas de partidas para permitir foreign keys compostas que impeçam cruzar UUIDs de grupos ou jogos diferentes.
- Um usuário que ainda possui um grupo como criador não pode ser removido de `auth.users`; o grupo deve ser transferido ou removido conscientemente. Memberships de outros usuários acompanham a exclusão da conta.
- Excluir um grupo remove seus dados dependentes. Excluir uma partida remove participantes, times, atribuições e sorteios daquela partida. O autor de uma partida pode ficar nulo para preservar o histórico.
- Jogadores não recebem grant de `DELETE`; devem ser desativados com `active = false`. Referências históricas também impedem a exclusão direta.
- `draw_runs` não recebe grant de `DELETE`, e apenas `accepted` pode ser atualizado pelo cliente após a inserção.
- `anon` e `PUBLIC` não recebem acesso às tabelas nem à RPC. Não existe endpoint público de presença nesta fase.
