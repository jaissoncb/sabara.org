# Futebol

Fundação mobile-first da aplicação Futebol, servida sob `/futebol/`.

## Fase 3 — Groups & Players

A página autenticada lista os grupos acessíveis via RLS e seu elenco. É possível criar um grupo pela RPC `create_group`; seu owner pode editar nome, esporte e quantidade por time. Owner/admin cadastram e editam jogadores (nome, apelido, nível de 1 a 5 em passos de 0,5, posição, goleiro e ativo). Membros possuem leitura. Desativar/reativar preserva o cadastro e o histórico; não existe exclusão de jogador pela interface.

Carregamento, primeira utilização, erros e nova tentativa são explícitos. Erros do servidor não são exibidos literalmente. A sessão é isolada por usuário e formulários são reinicializados ao trocar de jogador. Updates exigem uma linha retornada para não anunciar sucesso quando a RLS bloqueia a operação. As permissões visuais são conveniência; a autorização permanece no banco.

A Fase 7 conclui persistência, histórico por grupo e compartilhamento textual. Owner/admin configuram o jogo, sorteiam e ajustam times/titulares/reservas, preservando as regras das Fases 4–6. “Salvar e aceitar sorteio” grava o grafo inteiro pela RPC transacional `save_match_draw`, sem inserts sequenciais do frontend. A conclusão usa `drawn`, não `completed`.

Cada tentativa conserva UUID e payload para retry após falha ou timeout de 20 segundos, sem assumir rollback. A edição fica bloqueada até sucesso ou abandono explícito com aviso de possível gravação já concluída. Todos os rerolls do mesmo contexto são registrados; somente o último é aceito. Mudanças de configuração/participantes invalidam a sequência anterior. A escalação final distingue `draw`/`manual` por comparação com o último sorteio-base.

Owner/admin/member consultam partidas salvas, seus snapshots, times, reservas e histórico de seeds/versões/scores. O histórico mostra apenas `drawn`, em ordem decrescente de data/hora, com páginas de 50 partidas. Membros não recebem controles de escrita. Compartilhamento usa Web Share API e fallback clipboard, somente texto do resultado salvo — sem link público, token, placar, gols ou exclusão. Consulte `PHASE_7_REPORT.md` para decisões, testes e limites. A configuração PWA e `/futebol/` foi preservada. Consulte `supabase/SECURITY_ADVISOR.md` para a disposição da Fase 2B.2C.

## Requisitos

- Node.js 22.18 ou superior (scripts Node importam o validador TypeScript sem dependência adicional)
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
pnpm test:e2e
pnpm test:bundle-security
pnpm test:release-build
node --test ../../scripts/prepare-pages.test.mjs
node --test ../../scripts/release-workflow.test.mjs
node ../../scripts/test-publication-local.mjs
node scripts/audit-bundle.mjs
```

## Fase 8 — hardening e auditoria de release

O checkpoint está **NOT READY**: escritas diretas permitidas a owner/admin podem contornar os invariantes da RPC de partidas. Consulte `PHASE_8_REPORT.md` para a reprodução, resultados e pendências. Nenhuma migration ou configuração remota foi alterada nesta fase.

O E2E usa Auth, Data API e Postgres **locais**, após reset e pgTAP. Requer Docker no PATH, CLI Supabase 2.117.0 e Chrome instalado; `E2E_CHANNEL=msedge` seleciona Edge. `E2E_BROWSER=firefox`/`webkit` exige o navegador correspondente do Playwright. Playwright e axe-core são ferramentas de desenvolvimento. As fixtures possuem usuários sintéticos e são removidas em `finally`, inclusive nas falhas. Capturas/resultado ficam em `coverage/e2e/<navegador>/`; a medição do build fica em `coverage/bundle-audit.json`, todos ignorados pelo Git.

A PWA apresenta atualizações para confirmação; uma tentativa de save pendente ou incerta bloqueia a atualização e a navegação para Conta/outro grupo. Rascunhos locais ainda dependem da memória desta tela: confirme e salve antes de fechar ou recarregar.

## Ambiente público

Copie `.env.example` para `.env.local` e preencha somente:

```sh
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

Nunca coloque uma `service_role` ou `sb_secret_...` no frontend. Arquivos `.env*`, exceto o exemplo, são ignorados pelo Git.

## Fase 8C — contrato de build e Pages

`pnpm build` exige as duas variáveis públicas válidas antes de emitir o app. URL deve usar HTTPS e não conter credenciais/query/fragmento ou placeholders. A chave preferida é `sb_publishable_...`; JWT legado com `role=anon` continua aceito para compatibilidade, inclusive no E2E local. Não há verificação criptográfica ou garantia de que URL/chave pertencem ao mesmo projeto. Valores ausentes podem continuar desabilitando a integração defensivamente no desenvolvimento, mas nunca aprovam um build de release.

O workflow fornece `vars.VITE_SUPABASE_URL` e `vars.VITE_SUPABASE_PUBLISHABLE_KEY` somente ao passo de build. Configure-as como repository variables públicas em uma etapa separada; o CI falhará enquanto faltarem. Nenhuma credencial de banco, CLI, SMTP, Resend ou service-role é necessária para o build. Não colocar outros secrets em variáveis `VITE_*`.

`pnpm test:release-build` é reproduzível sem produção: usa fixtures públicas sintéticas, exige falha dos builds negativos, gera um build HTTPS configurado, verifica que `VITE_EXTRA_SECRET` sintética não entra no bundle e monta `_site`. O resultado sintético serve para validação, **não para publicação**. O verificador standalone exige o mesmo ambiente público usado no build e nunca imprime os valores.

Para E2E contra Supabase exclusivamente local, o runner usa `vite build --mode local-test`; somente esse modo e o desenvolvimento aceitam HTTP em loopback. Para conferir esse artefato com o mesmo ambiente local, use `node scripts/verify-build.mjs --local`. O build normal mantém HTTPS obrigatório. O nome `local` é reservado pelo Vite e não é usado como mode.

A montagem Pages usa allowlist de arquivos raiz, copia `assets/` integralmente e compara os bytes das cópias, mantendo Futebol somente em `_site/futebol/`. `robots.txt` e `.nojekyll` são preservados quando presentes; não são inventados nesta branch. Testes em fixtures cobrem a futura integração. Outros arquivos públicos novos precisam de revisão da allowlist.

O scanner bloqueia padrões conhecidos de Supabase secret/service-role, JWT não anon identificável, tokens GitHub/Resend, URLs Postgres com senha e private keys. Literais usados para rejeição, como `"service_role"`, não são por si só credenciais. O scanner não detecta qualquer secret possível e não substitui a allowlist, revisão ou RLS.

Release permanece **NOT READY**: confirmar/configurar as variables reais, confirmar Pages source, integrar `origin/main` preservando a raiz e obter autorização de deploy. O workflow automático de Pages pela branch pode operar independentemente de `ENABLE_PAGES_DEPLOY`; revisar a source antes de merge em main. Nenhuma dessas operações faz parte da implementação local 8C. Consulte `PHASE_8C_REPORT.md`.

O client usa PKCE, persiste e renova sessões válidas e desativa a detecção automática do callback. O bootstrap troca `?code=...` por sessão e limpa a URL antes de montar o `HashRouter`.

## Fase 8E — preparação de release manual (sem publicação)

O workflow mantém CI em push main/Futebol e pull_request: lint, typecheck,
testes, segurança, build e montagem. Push **não autoriza PACKAGE nem DEPLOY**;
`ENABLE_PAGES_DEPLOY` não é mais usado e não deve ser criado.

Uma release futura exige `workflow_dispatch` executado em `refs/heads/main`.
`expected_sha` é obrigatório: exatamente os 40 caracteres do SHA do próprio
run (`github.sha`). Outra branch, SHA vazio/incorreto ou variante desconhecida
falha antes do build/package. Não se faz checkout do input como ref arbitrária.
`site_variant` é choice `full` (default: raiz + `/futebol/`) ou `root-only`
(somente a raiz, para rollback frontend).

BUILD produz `pages-preview` e `root-rollback`, ambos convencionais, validados,
com `.nojekyll`, retenção de 90 dias e ID/digest/SHA no log e summary.
Root-only reutiliza a mesma allowlist e assets da raiz; seu staging fica em
`apps/futebol/coverage/root-rollback`, sem app/fontes/configuração privada.
O pacote root-only reflete **a raiz do SHA desse run**, não recupera uma raiz
antiga automaticamente. Preservar o artifact e verificar os hashes aprovados
antes da troca de source; rollback do frontend nunca reverte migrations.

PACKAGE só roda no dispatch validado em main. Exige ID único e digest de conteúdo
do BUILD, baixa exclusivamente o artifact selecionado do mesmo run e compara
seu digest de conteúdo imutável. Valida novamente raiz/hidden/scanner
e, em full, configuração pública/PWA com o verificador existente. Não recompila.
Usa `actions/upload-pages-artifact@v5.0.0`, `include-hidden-files: true`, nome
`github-pages`, e registra o ID antes da fronteira de publicação. Uploads
convencionais continuam `actions/upload-artifact@v4`; deployment continua
`actions/deploy-pages@v4`. A v5.0.0 suporta o input hidden oficialmente e usa
internamente upload-artifact v7, preservando o formato tar de Pages.

O único hidden permitido em qualquer conteúdo publicável é `/.nojekyll`.
O validador rejeita todos os demais dotfiles/diretórios (inclusive vazios),
`.env*`, `.git*`, caches/editor, symlinks e entradas fora da allowlist. Também
exige robots/.nojekyll e compara os bytes raiz com a fonte. Incluir hidden
no upload não amplia essa allowlist. O scanner de credenciais é complementar.

DEPLOY depende de PACKAGE e usa somente `github-pages` já pronto, sem checkout,
download ou rebuild. Apenas DEPLOY referencia o environment `github-pages`,
com permissions contents read/pages write/id-token write e serialização.
**Required reviewer ainda precisa ser configurado sob autorização separada**:
sem essa regra, dispatch válido pode seguir do PACKAGE direto ao DEPLOY.
Não executar dispatch até existir a aprovação protegida e Pages source Actions.
Inspecionar o tar exato (ID/digest/tamanho/SHA/variant) antes de aprovar o job.

Nesta preparação, PACKAGE/DEPLOY reais são skipped na branch. A matriz
push/dispatch é testada localmente contra as condições exatas do YAML; não
há dispatch remoto/publicação. `test-publication-local.mjs` testa full/root-only,
transporte com os flags tar da Action oficial e servidor/Chrome local, sem upload
ou chamada de Auth de produção. No Windows esse teste requer GNU tar do Git;
o E2E funcional existente continua exclusivamente Docker local.

Settings Pages/source/environment/variables, PR, merge main e publicação exigem
autorizações posteriores. Este checkpoint prepara os controles, não encerra a
Fase 8E e não cria relatório final.

## Tipos do banco

Os tipos são gerados a partir do banco local e integrados ao client. Atualize-os sempre que o schema mudar:

```sh
pnpm dlx supabase@2.117.0 gen types typescript --local --schema public > apps/futebol/src/lib/supabase/database.types.ts
```

Não edite `database.types.ts` manualmente; a fonte da verdade são as migrations aplicadas localmente.

O teste de contrato requer Node >=22.18, Docker local e as seis migrations aplicadas. Ele usa o payload real do frontend contra a RPC local e faz rollback integral das fixtures; nunca usa credenciais ou endpoints remotos.
