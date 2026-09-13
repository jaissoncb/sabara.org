# Fase 8 — hardening e auditoria de release

**Classificação: NOT READY.** Data da conclusão local: 13/09/2026. O checkpoint entrega correções, testes e evidências; não autoriza publicação. O bloqueador de integridade do banco permanece reproduzível e não foi corrigido por determinação explícita do usuário.

## 1. Estado inicial e escopo

Repositório: `D:\Projetos\Futebol\sabara.org`; branch `codex/futebol-mvp`; base/HEAD inicial local e remoto `09a41d302c9a649266ec68e644407dc645ce1383`. Working tree limpa no início original, modificada somente pelo trabalho preservado da Fase 8 na retomada. Foram lidos AGENTS.override.md, README, relatórios das Fases 3–7, migrations, testes e fontes relevantes. AGENTS.override.md foi relido na retomada.

Main local permanece `0855969c79576149daf3c880e6429f2e0ffc2cff`; origin/main analisado em `6286335e9cb96eb140c2683ab609da0760b440e7`. Não houve merge, rebase, cherry-pick, alteração do site raiz, workflow ou configuração Pages. Não houve deploy ou alteração remota de banco/Auth/SMTP/secrets.

As seis versões locais foram comparadas às migrations remotas por leitura de metadados e reaplicadas exclusivamente no Docker local:

- `20260911113852_initial_schema`
- `20260911113856_security_functions_and_grants`
- `20260911113900_row_level_security`
- `20260911152916_harden_auto_rls_event_trigger`
- `20260911200324_backfill_existing_auth_profiles`
- `20260912195435_save_match_draw`

Nenhuma migration, RLS, grant, schema, tipo gerado ou configuração Supabase foi alterado. O reset local e as fixtures de teste não são operações remotas.

## 2. Problemas encontrados e correções

| Problema | Correção e evidência |
| --- | --- |
| Player/Group form aceitava submits repetidos antes do próximo render e permitia trocar/fechar formulário durante a gravação | Guarda síncrona por ref, fieldset desabilitado, aria-busy, navegação/grupos/edição bloqueados enquanto grava. Regressão envia dois submits no mesmo ciclo e exige uma chamada. |
| Navegar para Conta/hash durante save podia desmontar o retry | Routes conserva a tela de origem durante tentativa pendente/incerta e corrige a rota; bloqueio vinculado ao usuário autenticado. E2E perde uma resposta realmente concluída no servidor, tenta Conta e repete payload/UUID idênticos. |
| Exceção lançada pelo client Auth/restauração de sessão podia interromper a interação | Ações devolvem mensagem simples; bootstrap conserva aplicação utilizável, sem erro interno exposto. Mensagem do callback/restauração também chega à tela de login. |
| Atualização automática da PWA podia recarregar edição | Worker novo espera; aviso e confirmação explícita para atualizar. Update desabilitado durante gravação/incerteza; falha de atualização tem mensagem. Testado entre dois builds reais. |
| Falta do chunk de partidas não tinha recuperação localizada | Error boundary mantém elenco/navegação e oferece recarregar. E2E aborta o arquivo JS efetivo, com service workers bloqueados somente nesse cenário. |
| Drop em jogador propagava para o time e podia aplicar outro movimento | stopPropagation no drop do jogador; mouse real testa troca. DataTransfer recebe identificação para compatibilidade do drag nativo. |
| Movimento para outro time tinha apenas drag nativo | Botão de movimento reutiliza a mesma regra de domínio; seleção/troca/titular-reserva utilizáveis por toque ou teclado. Sem biblioteca de drag adicional. |
| Tablist não implementava navegação de tabs | Grupos agora são botões normais com aria-pressed e sequência natural de Tab. |
| Foco se perdia após troca/avanço; erros tinham anúncio de sucesso | Foco em títulos/resultado/detalhe e erros de formulário; role alert para erros, status para confirmação; seleção informa aria-pressed. |
| Nomes acessíveis de selects incorporavam opções | Nomes explícitos Times/Nível/Posição. Labels dos demais campos mantidos. |
| Telas estreitas, nomes longos, alvos de ajuste/fechar pequenos | Formulários em uma coluna até 430px, conteúdo quebra linhas, headings/actions flexíveis, alvos de ajuste/fechar com 44px, labels de participantes com 48px, inputs de 16px. |
| Copy de fundação dizia que partidas viriam depois e expunha termos técnicos | Textos refletem grupos/sorteios/histórico atuais. Estado local, save, retry e incerteza explicados; código/versão/diferença entre médias substituem termos de infraestrutura. |
| Rejeição de service-role literal não detectava JWT legado | Ambiente rejeita JWT cujo role não seja anon. Verificação do build também rejeita sb_secret com valor e JWTs privilegiados/de sessão, sem imprimir credenciais. Scanner não é uma garantia genérica contra todo tipo de segredo. |
| Detalhe conferia contagens, mas podia mostrar escalação inválida | Confere unicidade, presença, índices, sequência de runs, associação e invariantes de titulares/reservas/goleiros. Regressões rejeitam grafos corrompidos. Essa defesa não corrige o bypass no banco. |

Foi removido o componente legado inacessível de DrawPanel, preservando a exportação de GameFlow. Ele já não participava do fluxo publicado; sua remoção não foi anunciada como economia relevante de bundle. A guarda de sorteio também impede repetição antes de um render.

## 3. BLOCKER de integridade

As permissões de escrita direta em matches/match_players/teams/team_assignments/draw_runs, combinadas com policies que permitem gerenciamento de partidas draft e drawn, permitem a owner/admin contornar `save_match_draw`. A RPC valida o grafo transacional enviado, mas seus invariantes não são obrigatórios para toda escrita autorizada pelo banco.

Reprodução: `node supabase/tests/audit-phase8-integrity.mjs`, com Docker local no PATH. O script verifica socket Docker local, cria fixture em transação, salva grafo válido pela RPC como owner e escreve diretamente como admin. Obtém `GAP:[2, 0, 2, 1]`: dois jogadores tornados reservas, zero run accepted, duas partidas drawn e uma delas sem times. Faz rollback integral e não altera schema. A possibilidade do owner decorre das mesmas permissões/policies; a reprodução executável exercita concretamente admin.

**Não publicar enquanto essa escrita direta puder invalidar o grafo.** Em trabalho futuro explicitamente autorizado, tornar obrigatória a integridade para todas as escritas (por exemplo, restringir DML às operações necessárias e usar a RPC como fronteira transacional), revisar compatibilidade com o modelo atual e converter a reprodução em testes que exijam rejeição. Nenhuma solução de banco foi implementada nesta execução.

Os 222 pgTAP existentes aprovam constraints, RLS e contrato previsto, mas não cobriam essa composição de permissões. O PASS da reprodução significa que o problema foi demonstrado, não que o banco passou um critério de release. Advisors sem ERROR também não garantem invariantes de negócio.

Na limpeza sintética foi observado que excluir grupo com partidas diretamente pode esbarrar na FK histórica de jogadores. O runner apaga primeiro suas partidas, depois grupos e usuários. Não existe exclusão de grupo/jogador na UI atual; revisar cascades antes de introduzir exclusão ou usar esse caminho operacional. Nenhum FK foi alterado.

## 4. E2E real e qualidade dos testes

Runner mínimo em Node + Playwright + axe-core, usando build de produção, Auth local, Data API local e Postgres local. Não há mock de persistência. Apenas a indisponibilidade de Web Share é simulada para evitar uma share sheet nativa incompletável em headless; a escrita/leitura de clipboard é real nos browsers Chromium testados. Falhas de rede abortam requisições reais; o cenário principal de retry primeiro exige HTTP 200 do backend e somente então perde a resposta.

Chrome e Edge: **24 cenários PASS em cada browser**, com fixtures removidas. Cenários A–H cobertos:

- Owner: login inválido/válido, create_group, 12 cadastros reais, seleção/configuração, dois times com reservas, rerolls, mouse/teclado, save, histórico, detalhe, clipboard e outra partida.
- Admin: cadastro de jogador e save de três times incompletos; ajustes exclusivos do owner ausentes.
- Member: elenco/histórico/detalhe somente leitura, controles de escrita ausentes.
- Retry: double-click gera uma chamada inicial, perda real de resposta após commit, tentativa conservada ao navegar, segunda chamada idêntica e exatamente uma partida.
- Snapshots: altera depois nome/apelido/nível/goleiro/posição no cadastro real; reload/detalhe conserva snapshots antigos.
- Rerolls: três runs sequenciais, apenas último accepted; assignments persistidos comparados integralmente ao payload real capturado.
- Ajustes: drag de mouse, troca por Enter, reserva de linha realmente promovida, tentativa de colocar único goleiro na reserva rejeitada e goleiro permanece em quadra; assignment_source manual confirmado.
- Isolamento: outsider autenticado recebe lista vazia para sete recursos com UUIDs de grupo conhecidos pela Data API.
- Rede: Auth, elenco, histórico e assignments do detalhe falham/retry recupera; sorteio local offline funciona com elenco carregado, save falha e retry online recupera.
- Datas/horários: histórico real ordena 23:59, 00:00 e horários ausentes no mesmo dia; datas não usam conversão UTC.
- PWA e chunk offline: descritos adiante.

Fixtures têm UUIDs/usuários sintéticos próprios, assertions de limpeza e finally. Mesmo falha antes de criar usuário não gera SQL `IN ()`. Nenhum secret é impresso; apenas chave pública local entra no build. Hostnames não locais são bloqueados no contexto de navegador; endpoint/versões/socket são verificados antes das fixtures. Prontidão consulta health e raiz da Data API: consultar groups como anon retorna corretamente 401, não é sinal de indisponibilidade.

Não há skips permanentes novos ou sleeps fixos de estabilização. Esperas usam elementos/eventos/predicados com limite; a pausa curta entre polls é uma espera por condição. Axe aguarda conclusão de animações finitas via Animation.finished. Testes de unidade usam mocks para contratos/estados de UI, e E2E/pgTAP/concorrência complementam a evidência que esses mocks não poderiam fornecer. Seeds fixas tornam a suíte de domínio determinística; fixtures E2E aleatórias não dependem de uma composição específica de jogadores de linha.

## 5. Mobile e acessibilidade

As larguras **320, 360, 390, 430, 768 e 1280** foram exercitadas com home/login/cadastro/recuperação/nova senha, workspace, ajustes de grupo, formulário de jogador, participantes, resultado de três times, histórico e detalhe. São **72 capturas e execuções de axe por browser aprovado**, com WCAG 2 A/AA e 2.1 AA; zero violações nas telas avaliadas e zero overflow horizontal no estado estável.

A falha de contraste inicial em 360px ocorreu enquanto a animação de entrada alterava a opacidade. No estado final, após aguardar a animação real, não reapareceu. Foi corrigida a sincronização do teste; não foi feita alteração artificial de cor para esse falso positivo transiente.

Chrome/Edge usam hasTouch nos quatro viewports pequenos e taps reais nos controles alternativos. Mouse e Enter foram exercitados separadamente. Nomes sintéticos longos, inclusive texto semelhante a HTML, são renderizados como texto e quebram linhas. Capturas de 320px/result e 390px/form foram inspecionadas visualmente, além da revisão de CSS/DOM/foco/labels/headings/landmarks e controles nativos. Não existem tabindex positivos nem widget tab incompleto após a correção.

Foco e anúncios foram revisados no código e na interação de navegador; não foi executada avaliação com leitor de tela humano. Axe não certifica conformidade integral, ordem de leitura de todos os leitores, conforto de uso ou ergonomia física. Uma região extensa de resultado ainda usa aria-live polite; verificar verbosidade em leitor real antes da publicação.

## 6. PWA e falhas offline

Base, scope e start_url permanecem `/futebol/`, `/futebol/` e `/futebol/#/`. Navigate fallback só cobre `/futebol/`. Não há cache de chamadas Auth/Data API ou fila automática de gravação. Shell funciona offline; entrar/buscar/gravar depende de rede, e o aplicativo informa falhas.

Foi testada registration real, worker ativo/controller, manifest, reload de rota hash offline e navegação para uma raiz sentinela fora do scope: sem controller. A sentinela verifica isolamento do worker, não substitui teste funcional do site principal. A montagem Pages separadamente compara arquivos reais da raiz byte a byte.

O teste de atualização constrói duas versões a partir da fonte, trocando somente a representação da chave pública do mesmo Supabase LOCAL. Nenhum arquivo gerado é editado manualmente. O novo worker fica waiting enquanto há rascunho; cancelar a confirmação conserva edição; gravação em andamento e resultado incerto desabilitam update; abandono explícito libera a ação; aceitar atualização provoca reload consciente da nova versão.

Dados locais e payload de retry ainda vivem em memória. beforeunload protege tentativa saving/error onde o navegador permite esse aviso; não garante recuperação após encerramento forçado do sistema. Reload consciente descarta rascunho e avisa. Persistência durável de rascunho/tentativa fica para decisão futura; não foi adicionada nesta fase.

## 7. Segurança, RLS e Auth

RLS permanece habilitada; grants, políticas e funções não mudaram. Isolamento de leitura e restrições de member foram aprovados nos testes locais, sem alegação de que isso resolve o BLOCKER de DML owner/admin. Client continua tipado, PKCE e callback limpo antes do router; não usa service role. Campos de nomes/snapshots usam escape React/texto, sem injeção HTML demonstrada.

`pnpm audit --prod --json`: **zero vulnerabilidades conhecidas**, 16 dependências de produção/transitivas reportadas nessa execução. Playwright 1.62.1 e axe-core 4.11.0 somente em devDependencies e ausentes nos módulos do bundle. workbox-window 7.4.1 é dependência de build usada pelo registro PWA; o runtime gerado pequeno está medido abaixo. Nenhuma dependência principal de produção foi adicionada.

Scanner de artefato no verify-build bloqueia padrões de chaves sb_secret com valor e JWTs cujo role não seja anon; três testes Node usam somente valores sintéticos, incluindo garantia de erro sem valor secreto. Ambiente também rejeita service-role/JWT legado não anon. Isso complementa a obrigação de fornecer exclusivamente variáveis públicas; não é autorização para usar segredo no frontend.

Login/erro de rede são E2E reais locais. Cadastro, recovery e PKCE possuem cobertura de unidade/rotas; entrega real de e-mail, redirect allowlist, confirmação, rate limits e SMTP de produção **não foram validados nem alterados**. Não declarar Auth/SMTP remoto pronto por causa de sucesso local.

## 8. Data, horário e locale

Data inicial é composta por getFullYear/getMonth/getDate locais; date-only é formatada por componentes, sem new Date(date-only)/toISOString. Horário vazio vira null; meia-noite permanece 00:00. Ordenação: match_date DESC, match_time DESC NULLS LAST, created_at DESC, id DESC; paginação de 50, somente drawn.

Quatro regressões adicionais executam o formatter real em processos separados, com UTC, America/Los_Angeles e Pacific/Kiritimati: instantes próximos de meia-noite produzem o dia local correto sem alterar timezone global do runner. E2E de 390px usa Kiritimati e outros viewports usam Los Angeles. Datas exibidas como 02/01/2026 e campos/ordenação de 23:59/00:00 foram conferidos. A apresentação do date input nativo segue locale do navegador; isso não muda o valor ISO enviado.

## 9. Performance antes/depois

Valores abaixo são do reporter Vite no build padrão da base e da fonte final, em kB decimais. O auditor adicional lê bytes do arquivo realmente emitido e gzip; seu JSON informa separadamente renderedLength de módulos antes da minificação final, que não deve ser confundido com contribuição comprimida por biblioteca.

| Artefato | Antes | Depois | gzip antes | gzip depois |
| --- | ---: | ---: | ---: | ---: |
| JS inicial | 500,01 | 503,89 | 144,27 | 145,25 |
| MatchWorkspace lazy | 30,05 | 31,86 | 9,41 | 9,89 |
| CSS | 12,59 | 13,90 | 3,36 | 3,63 |
| Registro PWA lazy | — | 1,15 | — | 0,60 |
| workbox-window lazy | — | 5,65 | — | 2,20 |

Precache: 11 entradas/592,85 KiB antes; 12/606,11 KiB depois. Principais módulos por renderedLength: React DOM client ~529.605, GoTrueClient ~109.046 e router ~93.098 caracteres; conjunto SDK Supabase ~372.397. Essas medidas intermediárias explicam a composição, não somam ao tamanho gzip.

**Decisão: aceitar o warning de 500kB, sem elevar limite ou fragmentar vendor apenas para escondê-lo.** O incremento compra proteções efetivas; não foi demonstrada economia significativa por uma mudança simples e segura. Client SDK agrega Auth/PostgREST e também Storage/Realtime/Phoenix por sua arquitetura. Trocar SDK/client, atualizar versões ou refazer carregamento de autenticação extrapolaria a correção mínima sem benefício medido. MatchWorkspace continua lazy; Web Share/drag não ganharam bibliotecas novas.

Listas usam keys, histórico é paginado e leituras por grupo/status; chamadas de roster/membership/grupo são paralelas. Detalhe busca snapshots em cinco recursos, não players atuais. Há buscas lineares por jogador em listas/teams e reconstrução de mapas por render, mas com dois/três times e páginas de 50 não foi observado gargalo que justificasse refatoração ampla. Benchmark em CPU/rede de celular físico e cargas grandes permanece recomendado; não há alegação de Lighthouse/Core Web Vitals aprovado.

## 10. origin/main — somente leitura

Entrou um commit desde main local: `6286335 Organize repository and local workflow`. Afeta `.gitattributes`, `.gitignore`, `.nojekyll`, README raiz, robots.txt, style.css e remove quatro assets antigos (`icon-180.png`, `icon-32.png`, `sabara-logo.jpg`, `sabara-s.jpg`). Não altera app Futebol, migrations, CNAME, index.html, 404 ou workflows.

Comparando áreas da branch Futebol com o delta externo, a sobreposição é `.gitignore` (adição em ambas as linhas de trabalho), com risco real de conflito add/add. Preservar a união: regras externas de ferramentas/backups/OS e regras Futebol de node_modules/dist/coverage/_site/.env, conservando exceção .env.example. Não escolher silenciosamente uma versão.

Integração futura recomendada, somente após corrigir blockers e autorização: atualizar main no workspace responsável pelo site principal, integrar a branch Futebol em branch de revisão, resolver .gitignore por união, conservar mudanças externas do site raiz e seus assets, montar/verificar o artefato conjunto e então solicitar/publicar sob autorização própria. A montagem atual copia uma lista fixa de arquivos raiz e ainda não incorpora robots.txt/.nojekyll do commit externo; revisar preservação desses novos arquivos na integração. Isso não foi antecipado com alteração de arquivo compartilhado nesta fase.

Workflow atual gera preview e só habilita deploy em push para main com ENABLE_PAGES_DEPLOY=true. Push da branch Futebol não autoriza nem aciona esse job de deploy. O workflow não fornece VITE_SUPABASE_URL/PUBLISHABLE_KEY ao passo de build; .env.local é ignorado. Portanto o artefato CI padrão não tem configuração Auth. **BLOCKER adicional de publicação:** preparar e validar build de release com variáveis públicas explícitas antes de habilitar Pages. Nenhuma variável, secret ou workflow foi alterado.

## 11. Checklist de release

| Área | Classificação | Critério/pendência |
| --- | --- | --- |
| Fluxo funcional, histórico e snapshots | PASS local | Cenários A–H e regressões; não certifica produção. |
| Retry, concorrência, resposta perdida | PASS local | Mesmo UUID/payload, grafo único, rollback/espera entre transações. |
| Integridade global das escritas no banco | **BLOCKER** | DML direto owner/admin contorna invariantes da RPC. Exige mudança futura autorizada e regressões de rejeição. |
| RLS/isolamento | PASS parcial | Leitura outsider/member protegida; DML autorizado com integridade insuficiente é o blocker acima. |
| Configuração do artefato Pages | **BLOCKER** | CI sem variáveis públicas do Supabase; validar build configurado antes de publicar. |
| Mobile 320–1280 e alternativas touch | PASS emulado | Sem overflow, controles sem dependência de drag. |
| Acessibilidade | PASS automatizado / RECOMENDADO físico | Axe estável sem violações; leitor de tela, verbosidade e teclado virtual ainda precisam teste humano. |
| PWA | PASS local / RECOMENDADO físico | Scope/offline/update waiting/consciente; instalação e retomada reais pendentes. |
| Segurança de credenciais/build | PASS nas verificações | Scanner limitado a padrões conhecidos, ambiente público, audit prod sem advisories. |
| Auth e SMTP de produção | RECOMENDADO antes de publicar | Validar confirmação/recovery/redirects/entrega e limites no domínio real; não testado nesta fase. |
| Compartilhamento | PASS clipboard / RECOMENDADO nativo | Web Share sheet real em Android/iOS e permissão/negação de clipboard físicos pendentes. |
| Performance | RECOMENDADO | Warning aceito explicitamente; medir rede/CPU física, sem mudança artificial de chunks. |
| Browsers | PASS Chrome/Edge; LIMITAÇÃO Firefox/Safari | Edge é também Chromium, não prova outro engine. Firefox instalado mas spawn UNKNOWN; Safari/iOS não exercitado. |
| Domínio /futebol/ e Pages | PASS estrutural / RECOMENDADO produção | Base/manifest/montagem local; domínio/HTTPS/callbacks/deploy real não testados. |
| Divergência main | RECOMENDADO, integração obrigatória antes de publicar | Conservar site principal e novos arquivos; conflito .gitignore provável. Nenhuma integração realizada. |
| Rollback | RECOMENDADO | Guardar artefato/commit e variáveis públicas da versão anterior; reconstruir/republicar sob autorização, testar downgrade do worker. Nenhum rollback/deploy executado. |
| Draft durável e aviso ao sair de edição local | PÓS-V1 / decisão de produto | Dados em memória; navegação normal fora de save ainda pode descartar draft. Persistência/confirm geral não adicionadas. |
| Exclusões/cascades | PÓS-V1, revisar antes de expor exclusão | Ordem de cleanup local necessária; UI não oferece exclusão. |
| Observabilidade | PÓS-V1 | Sem telemetria nova. Planejar códigos/correlação sem tokens, senhas ou PII; erros privados não viram copy. |

## 12. Validação final e limites

| Verificação | Resultado |
| --- | --- |
| Install --frozen-lockfile | PASS; lock consistente, dependências principais preservadas. |
| Supabase db reset --local | PASS; seis migrations existentes reaplicadas. |
| pgTAP | PASS: 222 testes em seis arquivos. |
| Concorrência/retry real | PASS: quatro cenários. |
| Contrato frontend -> save_match_draw local | PASS: payload real, três rerolls, ajustes, snapshots, reservas e retry; rollback fixtures. |
| Reprodução blocker | CONFIRMADO, rollback completo; não é aceite de release. |
| Frontend | PASS: 136 testes, 15 arquivos, sem skips; base original 127/14. |
| Segurança do bundle específica | PASS: três testes Node, sem skips. |
| E2E Chrome | PASS: 24 cenários; 72 telas/axe/capturas, fixtures removidas. |
| E2E Edge | PASS: 24 cenários; 72 telas/axe/capturas, fixtures removidas. |
| Firefox | NÃO EXECUTADO: browser instalado, launch recusado com spawn UNKNOWN. Fixtures removidas. |
| Lint e typecheck | PASS, zero warnings de lint. |
| Build/PWA e auditoria bundle | PASS com warning de tamanho aceito; resultado final do artefato conferido após E2E. |
| Montagem Pages local | PASS; arquivos raiz conferidos byte a byte, Futebol em /futebol/, sem deploy. |
| Advisors locais | Zero WARN/ERROR; dois INFO unused_index (team_assignments_group_player_idx e team_assignments_participant_fk_idx). Não remover com base em workload sintético. |
| Diff --check e revisão | PASS; fontes/diff e relatório revisados antes do checkpoint. |

Incidentes de ferramenta foram tratados explicitamente: sandbox EPERM em caches/build exigiu execução local autorizada; a revisão automática interrompeu a criação do auditor por limite de uso e o arquivo estava ausente na retomada, sendo depois criado integralmente. Uma execução logo após reset não alcançou a tela de grupo; repetição completa passou e o runner ganhou checagem de prontidão. A checagem inicialmente consultou tabela bloqueada a anon (401 esperado), foi corrigida para a raiz Data API. Falha de cleanup `IN ()` sem fixtures foi corrigida. Erro de contraste transitório foi reavaliado com sincronização real. Falhas intermediárias não foram contadas como testes aprovados; as execuções finais e limites estão discriminados acima.

Não foram testados dispositivo físico, teclado virtual, safe area, zoom/ergonomia reais, share sheet, leitores de tela, Safari/WebKit, retomada após encerramento pelo OS ou SMTP/HTTPS/callbacks de produção. Nenhuma alteração de Auth local/remoto foi usada para facilitar E2E; usuários são fixtures inseridas no banco exclusivamente local.

## 13. Arquivos e checkpoint

Criados:

- `apps/futebol/PHASE_8_REPORT.md`
- `apps/futebol/scripts/audit-bundle.mjs`
- `apps/futebol/scripts/bundle-security.mjs`
- `apps/futebol/scripts/test-bundle-security.mjs`
- `apps/futebol/scripts/test-e2e.mjs`
- `apps/futebol/src/PwaUpdate.tsx`
- `apps/futebol/src/draw/local-date.test.ts`
- `apps/futebol/src/groups/MatchModuleBoundary.tsx`
- `supabase/tests/audit-phase8-integrity.mjs`

Modificados: README, package.json, pnpm-lock.yaml, scripts/verify-build.mjs; src/App.tsx; AuthProvider e seu teste; bootstrap/auth-pkce e teste; config/environment e teste; DrawPanel/GameFlow; GroupDashboard e teste; MatchHistory; match-service e teste; styles.css; vite-env.d.ts; vite.config.ts, todos em apps/futebol.

Capturas, JSON de bundle/E2E, dist e _site são artefatos ignorados, não arquivos de fonte commitados. O checkpoint autorizado compreende estes arquivos de hardening/teste/relatório e push para origin/codex/futebol-mvp, mesmo com os blockers documentados. SHA e igualdade de HEAD local/remoto são confirmados na resposta final; o SHA do próprio relatório é o commit que o contém. Não houve trabalho em outra fase.

**Ação restante:** autorizar separadamente a correção de integridade no banco, validar configuração pública de release e testes físicos/produção, e revisar integração com main antes de qualquer publicação. Recomendação final permanece **NOT READY**.

Referências técnicas consultadas: [comportamentos de service worker](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors), [auto update e perda de estado](https://vite-pwa-org.netlify.app/guide/auto-update), [build Vite](https://vite.dev/guide/build), [chunking Rolldown](https://rolldown.rs/reference/OutputOptions.codeSplitting). A evidência de funcionamento desta aplicação vem dos testes locais acima.
