# Fase 8C — Contrato de build e preparação de Pages

Data: 2026-09-13. Escopo: implementação e validação local, commit/push somente na branch Futebol.
**Release: NOT READY.** O blocker de aceitação local de build sem configuração foi corrigido. A publicação ainda depende das repository variables reais, confirmação da source Pages, integração autorizada de origin/main e aprovação específica de deploy.

## Preflight e retomada

Repositório: `D:\Projetos\Futebol\sabara.org`. Branch: `codex/futebol-mvp`.
Base local/origin: `233f14130dfe3012ff87b8a30d586e6b791a33d0`; working tree inicialmente limpa.
Main local: `0855969c79576149daf3c880e6429f2e0ffc2cff`.
Main remota confirmada por leitura: `6286335e9cb96eb140c2683ab609da0760b440e7`.
As sete versões de migrations em arquivos, histórico Docker local READ ONLY e metadata remota correspondem. Nenhuma migration/schema/configuração de banco foi alterada. Correspondência de histórico não é uma auditoria de drift completo.

AGENTS.override.md foi relido antes da implementação e na retomada. Foram preservadas todas as mudanças da execução interrompida; nenhuma reinicialização, reset, clean, merge, rebase ou cherry-pick. A autorização vigente inclui implementação, testes, commit e push de Futebol; não inclui settings, integração de main ou deploy.

## Blocker original e solução

O workflow não fornecia configuração Supabase. `getSupabaseEnvironment` retornava null quando faltava qualquer valor; a UI desabilitava autenticação, mas `pnpm build` terminava com sucesso porque o verificador não exigia configuração emitida.

As regras agora ficam em `src/config/public-environment.ts`, usadas pelo runtime, Vite e verificador. `environment.ts` lê explicitamente apenas `import.meta.env.VITE_SUPABASE_URL` e `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`, além dos indicadores padrão DEV/MODE para a exceção local. Não passa `import.meta.env` inteiro nem configura `process.env` inteiro como define.

O callback de configuração Vite exige os dois valores antes de gerar qualquer bundle, inclusive quando Vite é chamado diretamente. O comando normal permanece `tsc -b && vite build && node scripts/verify-build.mjs`; falha de configuração interrompe o fluxo antes de montagem/upload. TypeScript pode atualizar seu cache local antes da validação Vite, sem emitir artefato publicável.

## Configuração pública e secrets

Somente estas configurações Supabase são necessárias:

- `VITE_SUPABASE_URL`: URL pública do projeto, sem hardcode real.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave pública apropriada ao browser.

URL e publishable/anon não são credenciais administrativas. Auth, grants e RLS continuam responsáveis pela autorização dos dados. Senha Postgres, service_role, sb_secret, access token CLI, SMTP, Resend e chaves administrativas nunca pertencem a essas variáveis ou ao bundle. Nenhum valor real de URL/chave é registrado neste relatório.

## Validações e compatibilidade

- Release exige valores presentes e não vazios, URL válida e HTTPS.
- URL rejeita username/password, query/fragmento e hosts de exemplo/reservados conhecidos.
- Publishable key exige prefixo público e pelo menos 20 caracteres do alfabeto permitido no sufixo; rejeita placeholders conhecidos, sufixo de um único caractere repetido, formatos arbitrários, sb_secret e service_role.
- Compatibilidade JWT anon foi deliberadamente mantida: o E2E existente usa a chave anon local e testa atualização para publishable local. Só payload com role exatamente anon é aceito; JWT malformed, sem role, authenticated, admin e service_role são rejeitados.
- Trata-se de validação de classes/formato. Não verifica assinatura, autenticidade, expiração ou que URL/chave correspondam ao mesmo projeto.
- Mensagens identificam somente nomes das variáveis; os testes negativos conferem ausência dos valores nos logs.
- Desenvolvimento conserva retorno null defensivo para configuração ausente/parcial. Isso não aprova release.

## Modo local-test e PWA

HTTP é permitido apenas em localhost, 127.0.0.1 e IPv6 loopback, mediante opção local explícita. No app/Vite, a exceção de build só é selecionada por `--mode local-test`; HTTP remoto falha mesmo com opção local. O build normal continua HTTPS obrigatório.

O primeiro nome de mode, local, foi recusado pelo próprio Vite por conflitar com .env.local. Foi corrigido para local-test, sem enfraquecer asserts. O E2E reiniciado passou integralmente e verifica os dois builds reais usados na atualização com `verify-build.mjs --local` e o ambiente público local correspondente.

Preservados: base `/futebol/`, HashRouter, manifest id/scope `/futebol/`, start_url `/futebol/#/`, registro `/futebol/sw.js` com scope `/futebol/`, fallback restrito ao app, precache do shell e limpeza de caches antigos. Não há cache Auth/Data API nem fila de escrita offline.

Worker novo espera; cancelar update mantém edição. Save pendente/incerto bloqueia update. Aceitar atualização é consciente e recarrega o app. Configuração muda por novo build e ativação da versão nova, não por consulta runtime aos settings GitHub. Refresh hash/offline e raiz sem controle do worker passaram em navegador real local.

## Verificação de artefato e scanner

O verificador exige o mesmo ambiente público do build. Confere HTML e referências existentes, entrada JS sob `/futebol/assets/`, manifest/ícones, worker/fallback e registro com scope do app. Usa o parser TypeScript já instalado como ferramenta de desenvolvimento para encontrar os valores públicos esperados nos literais emitidos da entrada JS e conferir o scope literal do construtor Workbox. Rejeita ausência/divergência, registro com scope raiz e emissão desses valores em outros arquivos textuais. Logs informam presença e classificação, nunca URL/chave.

Scanner ampliado: sb_secret com valor, padrões service_role de credencial, JWT não anon identificável, padrões GitHub/Resend, private keys e URL Postgres com senha. Literais de rejeição como service_role e sb_secret_ não representam automaticamente uma credencial. Scanner não detecta qualquer segredo possível, não certifica uma chave, e pode ter falsos positivos; allowlist e revisão continuam necessárias.

O teste de build injeta `VITE_EXTRA_SECRET` sintética e exige que nome/valor não existam nos arquivos emitidos. Nenhuma variável administrativa é necessária ao build. Testes de scanner usam somente strings sintéticas.

## Workflow final

No passo Build Futebol, env contém exatamente:

```yaml
VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

Repository variables foram escolhidas porque os valores são públicos e o job build não usa environment. Foram adicionados testes de bundle-security e montagem Pages antes do build/upload. Nenhuma variable/secret foi criada ou modificada.

Trava de deploy integralmente preservada: push, refs/heads/main, ENABLE_PAGES_DEPLOY igual a true, dependência de build, permissões Pages/OIDC e environment github-pages. Push Futebol não satisfaz a condição de branch e não executa esse deploy. Ausência de repository variables deve causar CI vermelho por configuração, sem upload de preview inválido.

## Montagem Pages

Allowlist obrigatória: index.html, style.css, 404.html, CNAME e favicon.ico. Assets raiz são copiados integralmente, evitando eliminar conteúdo público existente. Allowlist opcional: robots.txt e .nojekyll, copiados byte a byte somente quando existirem. Nenhum deles foi criado na raiz atual; não houve cópia manual de main.

Futebol é copiado exclusivamente de apps/futebol/dist para `_site/futebol/`. Todos os arquivos raiz/assets e arquivos do app são comparados byte a byte após montagem. Arquivos privados/unlisted não são copiados. Entradas não regulares/symlinks são rejeitadas; o destino absoluto `_site` é conferido antes de sua reconstrução. Os inputs essenciais e scanner app são conferidos antes de substituir preview existente.

Fixtures testam raiz distinta do app, CNAME, asset aninhado, exclusão de arquivo não listado, opcionais presentes/ausentes e rejeição de credencial privilegiada preservando preview anterior. Diretórios temporários de fixture são verificados antes da remoção.

Estrutura final esperada e conferida:

```text
_site/
  index.html
  style.css
  404.html
  CNAME
  favicon.ico
  assets/
  futebol/
    index.html
    assets/
    icons/
    manifest.webmanifest
    sw.js
    workbox-*.js
```

A raiz ainda é a versão desta branch, anterior ao commit externo. A montagem sintética local não deve ser publicada: valida empacotamento, não acesso a produção. Dist/_site/coverage são ignorados pelo Git, gerados da fonte sem edição manual.

## Testes e resultados locais

| Verificação | Resultado |
| --- | --- |
| pnpm test final | PASS: 164 testes, 16 arquivos, sem skips |
| Contrato público/release específico | PASS: 28 casos adicionais, incluídos na suíte frontend |
| pnpm test:bundle-security final | PASS: três testes Node, cobrindo vários padrões sintéticos |
| prepare-pages fixtures finais | PASS: três testes Node |
| pnpm lint | PASS, zero warnings |
| pnpm typecheck | PASS |
| E2E Chrome completo | PASS: 24 cenários; fixtures removidas |
| Release sem/invalid configuration | PASS: onze builds normais rejeitados e logs sem valores |
| Release HTTPS público sintético | PASS: pnpm build, verify-build, scanner e exclusão de VITE_EXTRA_SECRET |
| Verificador em cópias isoladas do artefato | PASS: rejeita scope raiz e ausência da configuração pública esperada |
| Montagem Pages real local | PASS: raiz/assets + Futebol, sem upload/deploy |
| Diff/revisão | git diff --check e revisão integral antes do checkpoint |

Os onze builds negativos abrangem ambos ausentes, URL ausente, chave ausente, placeholder, chave inválida, chave privada, HTTP loopback em release, HTTP remoto, URL com credenciais, service_role literal e JWT privilegiado. Vazio/whitespace, outros placeholders e demais JWTs também possuem testes do validador compartilhado.

O E2E usa Auth/Data API/Postgres exclusivamente Docker locais: owner/admin/member/outsider, cadastro de jogadores, sorteio/ajustes/persistência, resposta realmente commitada perdida, retry idempotente, histórico/snapshots após atualização/refresh, clipboard, falhas de rede e recuperação. Mobile/axe: 320, 360, 390, 430, 768 e 1280 pixels. PWA: instalação do worker, offline, raiz sem controller e atualização waiting/confirmada. Resultado/capturas em coverage/e2e/chromium ignorados pelo Git.

Falhas de sandbox em caches/edições foram resolvidas com execução local autorizada; não são bugs do app nem testes aprovados. A tentativa E2E com mode reservado falhou antes das fixtures e foi corrigida; somente a execução final de 24 cenários conta como PASS. Não houve reset/push/migration de banco, nem alteração Auth para facilitar testes. Fixtures locais de E2E foram criadas e removidas pelo runner existente. Não foi necessário repetir pgTAP porque banco não mudou.

## Main, Pages e pendências

A auditoria anterior identificou um commit externo após a base comum: 6286335, Organize repository and local workflow. Adiciona .gitattributes/.gitignore/.nojekyll/robots.txt, atualiza README/style.css raiz e remove quatro assets antigos. Não muda Futebol, banco, CNAME, index, 404 ou workflows. Conflito previsto .gitignore add/add deve ser resolvido por união durante integração autorizada; não foi alterado nesta etapa.

GitHub registra workflow automático pages-build-deployment, deployment de main nesse SHA, environment github-pages com política main. A raiz respondeu HTTP 200 e /futebol/ HTTP 404 na auditoria. Isso indica publicação pela branch, mas source exata requer confirmação administrativa; endpoint Pages indisponível sem autenticação adequada. ENABLE_PAGES_DEPLOY protege somente o workflow Futebol e não impede o publisher automático pela branch. Revisar source antes do merge para evitar publicação involuntária ou artefato incompleto.

Passos separados ainda necessários:

1. Usuário confirmar/configurar as duas repository variables públicas reais, sem chaves administrativas, e observar CI configurado.
2. Confirmar Pages source, Actions/environment/políticas e preservar o site publicado antes de qualquer mudança de settings.
3. Autorizar integração de origin/main; manter mudanças raiz/assets, unir .gitignore e conferir opcionais/allowlist no artefato integrado.
4. Validar release real, guardar artefato/configuração de rollback e autorizar merge/publicação separadamente.
5. Somente após aprovação própria, habilitar/executar o evento de deploy. Mudar a variable não inicia uma execução por si só; workflow atual não possui workflow_dispatch.

Limites: não foram validados produção Auth/SMTP/callbacks/entrega de e-mail, dispositivo físico, share sheet nativa, leitores de tela humanos, Safari/WebKit ou outro engine nesta etapa. Chrome/axe e emulação não certificam esses ambientes. Scanner e validação estrutural não garantem ausência de qualquer secret ou autenticidade das fixtures públicas. O warning de tamanho do chunk Vite permanece aceito conforme Fase 8, sem ocultar limite ou refatorar SDK.

Rollback futuro: republicar último artefato aprovado, preservando a raiz atual. Como Futebol ainda não está publicado, fallback inicial inclui o site atual de main. Não reverter migration nem resetar banco por rollback frontend. PWA pode manter versão cacheada; eventual retirada/manutenção precisa tratar worker e caminho Futebol especificamente, sob autorização.

## Arquivos e checkpoint

Criados: PHASE_8C_REPORT.md; src/config/public-environment.ts e seu teste; scripts/build-environment.mjs; scripts/test-release-build.mjs; ../../scripts/prepare-pages.test.mjs.

Modificados: README Futebol; package.json (script e requisito Node >=22.18 para importar TypeScript nativamente, sem dependências/lockfile); environment.ts e teste; vite.config.ts; verify-build.mjs; bundle-security.mjs e teste; test-e2e.mjs; ../../scripts/prepare-pages.mjs; ../../.github/workflows/ci-pages.yml.

Commit/push foram autorizados somente para codex/futebol-mvp após PASS local. Este relatório integra o checkpoint; obter seu SHA com `git log -1 --format=%H -- apps/futebol/PHASE_8C_REPORT.md`. SHA literal, igualdade local/remoto, working tree e CI pós-push são confirmados na resposta final, após as operações. CI remoto pós-checkpoint não é contado como PASS local nem pressuposto verde enquanto faltarem variables.

Main, site raiz, .gitignore, CNAME, DNS, GitHub settings/variables/secrets/environment, Supabase remoto/Auth e migrations não foram modificados. Nenhum merge/rebase/deploy ou outra fase. **NOT READY permanece até as pendências de publicação serem concluídas sob autorização.**

Referências oficiais: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Vite environment](https://vite.dev/guide/env-and-mode), [GitHub variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). O índice changelog Supabase não pôde ser obtido pela ferramenta web (content-type) nem por GET (timeout); a classificação pública/privada foi conferida na documentação oficial acessível.
