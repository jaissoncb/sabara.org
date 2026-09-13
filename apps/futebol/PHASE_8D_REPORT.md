# Fase 8D — Integração de main e validação do site combinado

Data: 2026-09-13. Branch: `codex/futebol-mvp`.
**READY FOR FINAL RELEASE PREPARATION**, condicionado à conclusão do CI do checkpoint integrado. Esta classificação aprova a preparação da etapa final; não autoriza merge em main ou publicação.

## Preflight e origem da integração

Repositório: `D:\Projetos\Futebol\sabara.org`, remote `jaissoncb/sabara.org`.
HEAD e origin/Futebol antes da integração: `06405f25b4c891fd7651c0e3ccd296d6e03ba53a`.
Working tree inicialmente limpa. Main local: `0855969c79576149daf3c880e6429f2e0ffc2cff`.
Após `git fetch origin`, origin/main permaneceu `6286335e9cb96eb140c2683ab609da0760b440e7`.
Merge-base: `0855969c79576149daf3c880e6429f2e0ffc2cff`.
Único commit incorporado de main: `6286335`, **Organize repository and local workflow**. Seu diff foi revisto integralmente antes da integração. Não houve avanço adicional de main.

Relidos AGENTS.override.md, relatórios 8/8B/8C, workflow, prepare-pages, arquivos raiz e regras Git das duas linhas. O delta Futebol desde a base comum não modificava o site raiz; a única sobreposição era a adição de `.gitignore`.

GitHub CLI instalada em `C:\Program Files\GitHub CLI\gh.exe`: versão 2.100.0. PATH da sessão não a encontrava; foi usada pelo caminho absoluto, sem reinstalação ou mudança de sistema. `gh auth status` confirmou jaissoncb ativo via keyring. Consultas GitHub usaram API autenticada e não imprimiram tokens ou valores das duas variables públicas.

Preflight GitHub: repository variables `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` presentes; `ENABLE_PAGES_DEPLOY` ausente. Run 34758520783, tentativa 2, SHA da Fase 8C, conclusão success, build success e deploy skipped.
Pages API: `build_type=legacy`, source main, path `/`, equivalente a **Deploy from a branch / main / (root)**; domínio sabara.org, HTTPS enforced, status built. Environment relevante `github-pages`, já observado na etapa anterior e preservado no workflow.

Sete migrations em arquivos, histórico Docker local e metadata remota do projeto Futebol Brasil correspondem:

- 20260911113852_initial_schema
- 20260911113856_security_functions_and_grants
- 20260911113900_row_level_security
- 20260911152916_harden_auto_rls_event_trigger
- 20260911200324_backfill_existing_auth_profiles
- 20260912195435_save_match_draw
- 20260913081632_harden_save_match_draw

Somente metadata remota foi consultada. Correspondência de versões não certifica ausência de drift manual. Nenhum arquivo de banco mudou nesta fase; pgTAP não foi repetido.

## Merge e conflito

Estratégia: `git merge --no-ff --no-commit origin/main`, executado dentro de codex/futebol-mvp, com commit adiado até a validação. Merge normal, sem rebase, squash, cherry-pick, force-push ou mudança de main.

Único conflito: `.gitignore` add/add. Resolvido por união semântica, preservando todas as regras das duas versões:

- Main: .DS_Store, Thumbs.db, Desktop.ini, .idea/, .vscode/, .local-backup/, .repo-sync/, .tools/ e *.log.
- Futebol: _site/, apps/futebol/node_modules/, dist/, coverage/, **/.env e **/.env.*.
- Exceção explícita: !**/.env.example; o template existente continua versionado.

Não foram escolhidos ours/theirs para o conflito; não havia duplicações de regras a remover. Comentários foram agrupados para explicar sua finalidade.

`.gitattributes` preservada conforme main: `* text=auto eol=lf` e tratamento binary de ico/jpg/jpeg/png. Inspeção de git ls-files --eol e diff confirmou ausência de alteração de blobs Futebol por normalização. Alguns arquivos de trabalho já possuíam EOL misto/CRLF antes do merge; nenhuma conversão massiva foi introduzida. Conteúdo textual de main foi comparado desconsiderando somente CRLF versus LF; binários foram comparados byte a byte.

## Preservação integral da raiz

Índice integrado corresponde a origin/main em index.html, style.css, README.md, 404.html, CNAME, favicon.ico, robots.txt, .nojekyll, .gitattributes e todo assets/.
index.html, 404.html, CNAME e favicon não sofreram mudanças em relação à branch inicial. CSS/README atuais de main foram incorporados integralmente, sem edição adicional. Robots permite `/`; .nojekyll existe como arquivo vazio.

Seis assets atuais de main conservados byte a byte: apple-touch-icon.png, favicon-32.png, icon-512.png, sabara-logo.png, sabara-s.png e sabara-sbr.png.
Quatro removidos por main permanecem removidos: icon-180.png, icon-32.png, sabara-logo.jpg e sabara-s.jpg. Nenhum deles é referenciado pelos HTML/CSS atuais.

Referências locais HTML/CSS examinadas: favicon.ico, assets/favicon-32.png, assets/apple-touch-icon.png, style.css e assets/sabara-logo.png. Todos existem e respondem no servidor local. Nenhum index Futebol substituiu o index raiz; navegação raiz continua Sabará.

## Build, prepare-pages e artefato

prepare-pages.mjs e ci-pages.yml permaneceram inalterados. A allowlist opcional existente copiou os arquivos reais robots.txt e .nojekyll após o merge. Montagem pelo processo estabelecido, sem edição manual de dist/_site.

Sete arquivos raiz e seis assets foram comparados byte a byte entre fonte integrada e _site. O próprio prepare-pages também compara todos os arquivos Futebol copiados.

```text
_site/
  index.html
  style.css
  404.html
  CNAME
  favicon.ico
  robots.txt
  .nojekyll
  assets/ (seis arquivos atuais de main)
  futebol/
    index.html
    assets/
    icons/
    manifest.webmanifest
    sw.js
    workbox-*.js
```

Build normal de produção com as duas repository variables públicas capturadas por subprocesso gh e transmitidas somente em memória ao processo de build. URL HTTPS validada para o projeto esperado, chave sb_publishable_ pública; nenhum valor registrado neste relatório ou em arquivo de configuração. Não houve obtenção de chaves administrativas. O bundle gerado contém intencionalmente a configuração pública do browser e está ignorado pelo Git.

`pnpm build` executou tsc, Vite e verify-build com PASS. Verificador repetido programaticamente com o mesmo ambiente: PASS. Scanner de todos os arquivos textuais gerados: PASS nos padrões conhecidos. VITE_EXTRA_SECRET sintética injetada e nome/valor ausentes do artefato. Scanner não garante detecção de qualquer segredo possível.

Base `/futebol/`; manifest id/scope `/futebol/`, start_url `/futebol/#/`; registro /futebol/sw.js com scope /futebol/; fallback restrito ao app. Worker não controla `/`. PWA 12 entradas de precache, 606,91 KiB; JS inicial 504,71 kB, gzip 145,58 kB. Warning >500 kB preservado conforme decisão anterior, sem mudar limite/chunking.

## Validação local executada

| Check | Resultado |
| --- | --- |
| pnpm test | PASS: 164 testes, 16 arquivos, sem skips |
| pnpm test:bundle-security | PASS: três testes Node |
| node --test scripts/prepare-pages.test.mjs | PASS: três testes Node, opcionais presentes/ausentes e preservação de preview inválido |
| pnpm lint | PASS, zero warnings |
| pnpm typecheck | PASS |
| pnpm test:e2e existente | PASS: 24 cenários Chrome, fixtures sintéticas removidas |
| Build release público real / verify-build / scanner | PASS |
| VITE_EXTRA_SECRET sintética | PASS: nome/valor não incorporados |
| Raiz integrada versus main | PASS, conteúdo textual equivalente e binários idênticos |
| Referências locais HTML/CSS | PASS, arquivos existentes e recursos HTTP carregados |
| Montagem real _site | PASS, sete arquivos raiz, seis assets e app preservados byte a byte |
| Site combinado Chrome 390px e 1280px | PASS: raiz, app, assets, hash, refresh, manifest, worker, offline e isolamento da raiz |
| git diff --check / cached --check / revisão integral | PASS antes do checkpoint |

Runner E2E existente exercitou Auth/Data API/Postgres exclusivamente locais: owner/admin/member/outsider, cadastros/sorteio/ajustes/save, resposta realmente commitada perdida e retry idempotente, histórico/snapshots, clipboard, rede, seis viewports/axe, PWA/offline/update consciente e erro de chunk. Nenhum teste autenticado foi enviado a produção.

Verificação complementar serviu o _site real em loopback e usou Chrome com requisições externas bloqueadas. Em 390/1280 px: `/` tem título Sabará, h1 SABARÁ, logo decodificado e CSS atual com gradiente; recursos locais/robots respondem; `/futebol/` e `/futebol/#/` abrem o app configurado; refresh online/offline preserva o shell; manifest/worker respondem sob Futebol; worker ativo tem scope exato /futebol/; retorno à raiz após instalar o worker tem controller null, sem redirecionamento e sem HTTP local >=400.

Capturas, helper de verificação, JSON e demais saídas estão em coverage/ ignorado. Primeira captura visual ocorreu durante animação de entrada, sem demonstrar regressão; sincronização passou a aguardar Animation.finished antes da captura, sem alteração de CSS/produto. Dist foi reconstruído em modo release após o E2E, que produz variantes locais para testar update.

## Comparação com o site publicado

GET somente leitura de https://sabara.org/ e seus recursos. Os dez recursos consultados responderam com sucesso e correspondem ao conteúdo atual de main: index, CSS, robots, favicon e seis assets. Textos comparados normalizando somente CRLF/LF, binários byte a byte; hashes registrados no JSON local ignorado.

A raiz do artefato integrado mantém esse conteúdo. Diferença esperada: o artefato contém adicionalmente `/futebol/` e a PWA do app. Nenhum conteúdo foi publicado. A ferramenta web não abriu o domínio; comparação efetiva foi feita por GET no script local, sem depender desse resultado de ferramenta.

## CI e identificação dos checkpoints

O CI integrado será observado após o push autorizado somente para origin/codex/futebol-mvp, sem commit vazio ou mudança de workflow. Resultado e run ID efetivamente observados serão acrescentados após sua conclusão, sem alegar PASS antecipado.

O SHA do merge será registrado após concluir o commit. O SHA do checkpoint final que contém este relatório pode ser obtido com `git log -1 --format=%H -- apps/futebol/PHASE_8D_REPORT.md`; o identificador literal e igualdade HEAD/origin serão confirmados na resposta final, depois das operações. Nenhum commit é reescrito para incluir o próprio hash.

## Limites e próxima autorização

Nenhuma mudança desta fase em fonte Futebol, dependências/lockfile, banco/schema/migrations, workflow, CNAME, DNS, Supabase/Auth/SMTP, repository variables/secrets, ENABLE_PAGES_DEPLOY, Pages source ou environments. Main local/remota permanecem nos SHAs de preflight. Dist/_site/coverage não são versionados. As únicas alterações locais de fonte são a união de .gitignore, o delta já existente incorporado de main e este relatório.

Continuam pendentes: decisão/migração autorizada de Pages source para GitHub Actions, autorização de merge da branch em main e autorização explícita de deploy. Pages atualmente publica main automaticamente; ENABLE_PAGES_DEPLOY protege apenas o workflow Futebol, não o publisher legacy. Não integrar em main antes de decidir essa transição.

Limites herdados: Auth/SMTP/callbacks/entrega de e-mail em produção, dispositivos físicos, share sheet nativa, leitores de tela humanos, Safari/WebKit/outro engine, desempenho físico e estratégia operacional de rollback ainda exigem a preparação final apropriada. Metadados de migrations e testes locais não recertificam toda a infraestrutura de produção.

Parar após integração, validação, push Futebol e CI. Nenhum deploy realizado ou autorizado nesta fase.
