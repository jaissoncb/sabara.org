# Security Advisor disposition

## `public.create_group(text, smallint, text)`

**Disposition:** accepted / intentional security finding.

`create_group` permanece `SECURITY DEFINER` porque cria um grupo e seu primeiro membership `owner` na mesma transação. A autorização normal das duas tabelas depende desse membership: a policy de `groups` só permite acesso a membros, enquanto a policy de `group_members` só permite inserções feitas por um owner já existente. No instante de criação, nenhum dos dois registros existe.

Converter a função para `SECURITY INVOKER` exigiria conceder `INSERT` direto em `groups` e criar exceções de bootstrap nas policies, ou ampliar as permissões de `group_members`. Isso aumentaria a superfície pública e criaria autorização circular/artificiosa apenas para eliminar o warning. A função privilegiada, pequena e transacional é a fronteira mais estreita.

A atomicidade é uma propriedade da transação, não de `SECURITY DEFINER`: uma RPC invoker também seria atômica. A elevação é necessária aqui para o INSERT/RETURNING do grupo sem grant/policy de INSERT e sem membership para SELECT, e para o INSERT do primeiro owner, que a policy normal deliberadamente proíbe. Uma alternativa baseada em `created_by = auth.uid()` poderia ser desenhada, mas abriria caminhos diretos de criação de grupos sem membership e exigiria novos controles para preservar o contrato atual. Não oferece o mesmo comportamento com RLS mais simples.

Controles verificados:

- `search_path` fixo em `pg_catalog`;
- referências a `public.groups` e `public.group_members` qualificadas;
- owner explícito `postgres`;
- `PUBLIC` e `anon` sem `EXECUTE`;
- somente `authenticated` recebe `EXECUTE` além do owner da função;
- identidade derivada exclusivamente de `auth.uid()`;
- assinatura sem parâmetro UUID ou outro identificador de usuário;
- validação de todos os valores controlados pelo cliente;
- falha em qualquer inserção reverte toda a chamada;
- `authenticated` não possui `INSERT` direto em `groups`;
- pgTAP cobre usuário anônimo, ownership automático, rollback e isolamento entre usuários/grupos.

## Proteção contra senhas vazadas

Em 2026-09-12, a consulta read-only da organização confirmou `plan: free`. A [documentação Supabase](https://supabase.com/docs/guides/auth/password-security) limita leaked-password protection a Pro e superiores. Finding conhecido e não bloqueante para o MVP. Nenhum upgrade, compra, billing ou configuração de Auth foi alterado.

## Evidência final — 2026-09-12

- Definição remota confere com a migration; ACL explícita `{postgres=X/postgres,authenticated=X/postgres}`.
- Security Advisor: dois WARN, `authenticated_security_definer_function_executable` (aceito intencionalmente) e `auth_leaked_password_protection` (limitação do Free); nenhum ERROR.
- Performance Advisor: 12 INFO de `unused_index`; nenhum WARN/ERROR. Índices de integridade e consultas foram preservados, pois ausência de uso neste estágio não comprova redundância.
- Cinco migrations idênticas nos arquivos, banco local e remoto: `20260911113852`, `20260911113856`, `20260911113900`, `20260911152916`, `20260911200324`.
- Nenhuma migration nova necessária; nenhuma escrita remota nesta fase.
- pgTAP: 118 verificações, incluindo falha da segunda inserção com rollback do grupo, identidade ausente, entradas inválidas e tentativa de criar owner diretamente.

Referências: [finding 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [funções e privilégios](https://supabase.com/docs/guides/database/functions), [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
