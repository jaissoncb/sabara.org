# Fase 4 — Engine de Sorteio

## Requisitos recuperados e limites

Fontes: solicitação inicial preservada na tarefa `Criar Site Parte1` (11/09/2026, mensagem com o prompt inicial e roadmap), correção do usuário sobre reservas nessa mesma tarefa, migrations existentes, `src/groups/` e `PHASE_3_REPORT.md`. O roadmap não estava versionado; este relatório registra os requisitos relevantes recuperados, sem modificar decisões das fases anteriores.

- O organizador escolhe explicitamente 2 ou 3 times. A quantidade nunca é inferida do elenco.
- Todos os participantes pertencem exatamente a um time. Tamanhos diferem no máximo em um jogador.
- Exemplos obrigatórios: 10/2 → 5/5; 11/2 → 6/5; 12/2 → 6/6; 13/2 → 7/6; 14/3 → 5/5/4; 15/3 → 5/5/5; 16/3 → 6/5/5; 17/3 → 6/6/5; 18/3 → 6/6/6.
- Times incompletos são válidos. Não criar jogador fictício nem selecionar empréstimo automaticamente.
- Reservas pertencem ao próprio time. O suporte estrutural do engine indica os reservas iniciais, sem controles interativos.
- Distribuir primeiro um goleiro por time enquanto houver goleiros; adicionais entram na distribuição restante. O primeiro goleiro começa em quadra.
- Nível de 1 a 5 em passos de 0,5, incluindo goleiros. Posição preferida não influencia o algoritmo inicial.
- Equilíbrio por média de nível, não somente soma; muitas soluções candidatas e escolha aleatória entre as melhores. Cada execução possui seed e versão.
- Grupos, elegibilidade e autorização continuam pertencendo ao fluxo existente. Somente owner/admin acessam a prévia; member continua com leitura do elenco.

O roadmap original coloca engine/testes na Fase 4, fluxo de jogo na 5, reroll/ajustes/reservas interativas na 6 e persistência/histórico/compartilhamento na 7. A solicitação atual acrescenta UI mínima para usar a engine: foi implementada somente uma prévia temporária dentro do grupo, com seleção do elenco ativo, escolha 2/3 e cards de conferência. Não há criação de partida, salvamento, resultado esportivo, reroll avançado, drag-and-drop ou mudança de reserva pela UI.

## Arquitetura e regras técnicas

`src/draw/engine.ts` é um domínio puro, sem React, Supabase, rede ou aleatoriedade global. Recebe IDs elegíveis, níveis, goleiros, quantidade de times, jogadores em quadra e seed. Retorna times, reservas, soma, média, contagem de goleiros, déficit em quadra, balanceScore, seed e algorithmVersion. Não modifica a entrada. Ordenação canônica por ID mantém reprodução mesmo quando a lista visual muda de ordem.

São gerados 400 candidatos válidos com Fisher–Yates e PRNG de quatro palavras inicializado pela seed. Tamanhos-alvo e prioridade dos goleiros são garantias estruturais; não podem ser sacrificados para melhorar o score. O score é a diferença entre maior e menor média, com peso centralizado em `DRAW_TUNING`. A shortlist contém até dez composições distintas de menor score; permutações dos mesmos times são deduplicadas. A escolha final é aleatória entre essas opções. É uma heurística limitada, sem promessa de ótimo global; swaps não foram necessários para esta primeira versão.

A UI gera uma seed nova de 128 bits com Web Crypto. Os testes controlam a seed. Não há fallback silencioso para fonte de baixa qualidade caso Web Crypto falhe. Reservas são escolhidos aleatoriamente após a avaliação dos candidatos, preservando um goleiro em quadra: nível não é critério para escolher banco. Por esse motivo o score mede a média do elenco, sem otimizar a escalação inicial de quadra.

Decisão técnica onde o requisito não fixava mínimo: exigir pelo menos um jogador por time, para não produzir time vazio; não exigir times completos. O limite de 1 a 20 em quadra segue o schema existente. Entradas inválidas produzem `DrawInputError` com mensagem previsível.

`DrawPanel.tsx` faz a adaptação do elenco existente ao domínio, filtra ativos do grupo, controla seleção/loading/erro/vazio e renderiza a prévia. Mudanças no elenco, configuração ou grupo reinicializam o formulário; fechar descarta o resultado. A UI cede um ciclo antes do cálculo e bloqueia alterações enquanto calcula. O módulo é carregado separadamente por `React.lazy` no dashboard. Não foram adicionadas dependências.

## Arquivos

Criados:
- `src/draw/engine.ts`
- `src/draw/engine.test.ts`
- `src/draw/DrawPanel.tsx`
- `src/draw/DrawPanel.test.tsx`
- `PHASE_4_REPORT.md`

Modificados:
- `src/groups/GroupDashboard.tsx`: integração isolada do módulo.
- `src/styles.css`: estilos de seleção/cards responsivos, apenas Futebol.
- `README.md`: estado da Fase 4.

## Validação

- pgTAP local: 118/118, cinco arquivos, PASS. Nenhuma alteração de banco necessária.
- Frontend: 79/79, oito arquivos. Preservados os 29 anteriores; adicionados 42 de engine e oito de UI.
- Engine: exemplos 10/2 a 18/3, mínimo e insuficiência, goleiros 0/1/menor/igual/maior/todos, extremos e níveis iguais, métricas por média, 100 execuções mantendo invariantes, variedade entre seeds, reprodução, reordenação da entrada, imutabilidade, reservas sem seleção por nível e entradas inválidas.
- UI: papéis owner/admin/member, filtro de grupo e ativos, selecionar/limpar, 5/5/4, reservas no time, invalidação de resultado, mudança de elenco/grupo, falha de Web Crypto sem detalhes internos, recuperação e loading.
- Lint e typecheck: PASS, zero warnings. Build/PWA: PASS; 11 entradas no precache e verificação de base, manifest, scope e service worker limitada a `/futebol/`. Pacote principal 499,84 kB e módulo de sorteio separado 7,43 kB; nenhum warning final de tamanho. Suíte específica da engine executada separadamente: 42/42 PASS. `git diff --check`: PASS.
- Inspeção no navegador com dados fictícios e conteúdo limitado a 390 px: seleção 14/3, três cards, goleiros separados, avisos e quebra de texto legíveis. Não foi um teste em dispositivo físico; instalação PWA manual permanece fora desta validação.
- Benchmark local Node 24.19.0, 50 execuções após cinco de aquecimento: medianas 1,49/2,02/2,84/6,03 ms para 10/18/30/60 jogadores; p95 2,53/3,53/4,62/7,93 ms. Não equivale a benchmark em celular. pnpm disponível: 11.19.0.
- Prévia temporária removida antes do commit; nenhum dado real usado nessa inspeção.

## Segurança e encerramento

Nenhuma migration, schema, RLS, Auth, secret ou configuração remota alterada. A engine não persiste dados: seed e versão ficam no retorno para integração futura, não em `draw_runs` nesta fase. Os dados do elenco continuam vindo do serviço sujeito às RLS existentes.

Branch `codex/futebol-mvp`, base `4af731ce5014f53c97a0bbb05b51e1b9c301767d`. Main permanece em `0855969c79576149daf3c880e6429f2e0ffc2cff`. Site raiz, arquivos compartilhados e workflows preservados. O push desta branch executa somente CI; o job de deploy exige main e trava adicional. Nenhum merge ou deploy executado. SHA do commit e confirmação de push serão informados na entrega, após as operações.
