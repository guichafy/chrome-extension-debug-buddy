# Performance em Chromium real

A suíte de performance carrega o build de produção da extensão em Chromium completo, com um perfil novo por teste. Ela cobre o custo de abrir respostas e criar regras, o crescimento do histórico e a integridade da gravação. Os cenários longos usam tempo real e os limites originais do produto: 10 minutos por sessão e 50MiB estimados pelo recorder. Nenhum cenário altera o relógio ou chama os controles de limite exclusivos de testes unitários.

## Executar

Todos os comandos npm partem de `app/`:

```bash
cd app
npm ci
npx playwright install chromium
npm run build
npm run typecheck:performance
npm run perf:smoke
npm run perf
```

`perf:smoke` executa somente a gravação curta real. `perf` executa os cenários de UI e as gravações curtas, excluindo `@soak`. O build é uma etapa explícita: os comandos de teste carregam `dist/` e não recompilam a extensão.

No Linux sem display, instale as dependências com `npx playwright install --with-deps chromium` e use `xvfb-run --auto-servernum npm run perf`. O launcher utiliza Chromium completo com `headless: false`; o binário headless-shell não carrega esta extensão.

```bash
# Suíte completa, incluindo 10min + 30min reais e limite de tamanho.
npm run perf:soak

# Cenários longos isolados.
npm run perf:soak -- recording.spec.ts --grep 'autostop real'
npm run perf:soak -- recording.spec.ts --grep '30 minutos'
npm run perf:soak -- recording.spec.ts --grep '50MiB'
```

A execução completa precisa de mais de 40 minutos de gravação, além do cenário de tamanho, inicialização e verificações. Reserve até 65 minutos. Execute uma única suíte por máquina e evite outros benchmarks simultâneos.

## O que é medido

| Cenário | Carga e verificações |
| --- | --- |
| UI: respostas grandes | JSON de aproximadamente 10KiB, 100KiB, 1MiB e 5MiB, com histórico de 1.000 requisições; cinco ciclos Response → menu → editor; contadores de parse/inserção HTML durante updates de outras requests. |
| UI: histórico | 10.000 e 50.000 requisições com uma resposta de 100KiB. Os dados são semeados no IndexedDB para isolar o custo da UI. |
| UI durante captura | 10.000 registros semeados e body de 5MiB enquanto fetches reais chegam a cada 50ms, com gravação ativa. |
| Formatos e ciclo de vida | Texto Unicode, HTML, imagem, JSON inválido, body indisponível, JSON grande sem MIME, mesma quantidade de bytes com densidade diferente de tokens; cópia/download integrais, fechar/reabrir inspector, trocar rota, recarregar e entrypoint estreito sidepanel.html. Este último não simula o host nativo do Chrome. |
| Side Panel nativo | Abertura por gesto real com chrome.sidePanel.open, contexto SIDE_PANEL sem aba correspondente, mensagens ao vivo e ressincronização do IndexedDB ao fechar/reabrir. |
| Gravação curta | 96 requests HTTP reais, até oito concorrentes, com payload determinístico e 20ms de latência no servidor local. |
| Checkpoint contínuo | Após a rajada inicial, 60 requests sequenciais com pausas de 30ms; o período medido precisa durar pelo menos 3s e produzir um checkpoint antes de parar. |
| Stop com rede em voo | O servidor segura quatro respostas (abaixo do teto HTTP/1.1 de seis conexões por origem) até stopDebugging concluir; elas são liberadas e precisam completar. As respostas entregues após detach são omissões previstas, separadas da janela capturada. |
| Autostop de tempo | Uma request a cada 5s, aproximadamente; um evento real depois dos 10min confirma o encerramento com `hardLimitReason: time`. |
| Sessões sucessivas | Três sessões completas de pelo menos 10min na mesma instância da extensão. Confere isolamento, persistência e ausência de sessões abertas ao final. |
| Limite de tamanho | Depois da captura de rede, mensagens reais de console de 32KiB fazem a sessão atingir 50MiB. Há um teto de 1.900 mensagens para limitar a carga. |

Os cenários de gravação comparam o ledger independente do servidor com as respostas recebidas pelo navegador, os IDs capturados pelo background, os registros do IndexedDB e os IDs retornados pelo adapter de replay de produção. Também conferem bodies, patches de duração, `endedAt`, FullSnapshot do rrweb, filas pendentes vazias e estado de debugging encerrado. A rota real de Replay recebe uma verificação visual de abertura do player; a paridade completa dos IDs usa o adapter, não uma varredura de todas as páginas da tabela.

Os percentis usam ordenação nearest-rank de cinco amostras por ação principal; são detectores de regressão grosseira, não uma estimativa estatística robusta da população. A latência mede pointerdown até um frame após o conteúdo esperado existir e ter dimensões visíveis (proxy de feedback pintado), não apenas a duração de `locator.click()`.

A instrumentação observa `IDBObjectStore.put` no service worker e registra quantidade, bytes JSON UTF-8, duração da request e conclusão da transação. Esses bytes estimam o volume serializado, não o tamanho físico em disco. O custo da serialização feita pelo observador aparece separado como `measurementOverheadMs`; as durações incluem o restante da instrumentação. Os contadores de mensagens incluem as consultas feitas pelo runner. `navigator.storage.estimate()` registra também a estimativa agregada do armazenamento da extensão; ela não é uma medição exata de bytes físicos de cada store.

O CDP coleta heap do target e do service worker, métricas de tarefa do target e contadores de DOM no início, antes de parar e ao final. Não há medição isolada de CPU do service worker. As amostras de gravação não forçam GC; a verificação de heap/DOM da UI força GC depois de fechar Response. Falhas de persistência, erros engolidos pelo recorder e exceções não tratadas fazem o teste falhar mesmo se a interface parecer funcional.

## Orçamentos e calibração

| Métrica | Limite inicial |
| --- | --- |
| UI parada: p95 / máximo por interação | Menos de 250ms / 500ms |
| UI durante captura: p95 / máximo | Menos de 500ms / 1.000ms |
| UI: maior long task / bloqueio acumulado acima de 50ms | Parada: 250ms / 500ms; captura: 500ms / 2.000ms |
| UI: CPU (TaskDuration CDP) na janela medida | Menos de 4s parada; 12s com captura |
| UI: reprocessamento de body em updates alheios | Zero parses e zero inserções de HTML de body |
| UI: nós durante Response | Menos de 6.000 |
| UI: heap após GC | Menos de 256MiB; após limpar histórico, 80MiB |
| UI: nós DOM após GC | Menos de 12.000 |
| Gravação: stop e cada commit de sessão, inclusive auto-stop | Menos de 5.000ms |
| Gravação: crescimento de heap de target e SW | Menos de 128MiB; 512MiB no cenário de tamanho |
| Gravação: writes de requests | Até três puts por request, incluindo patches |
| Gravação: bytes regravados de sessions | Menos de 20 vezes o maior payload nos curtos; 250 vezes por sessão nos longos |
| Checkpoint durante tráfego contínuo | Mais writes de sessão ao fim do período ativo do que no início |

Esses limites são guardas iniciais de regressão, não metas de experiência nem percentis de produção. O baseline local foi coletado em macOS arm64 com CPU Apple M4 Pro (12 núcleos, 24GiB RAM) e Chromium 147. O CI usa Ubuntu 24.04, Node.js 22 e o Chromium resolvido pelo lockfile. Diferenças de hardware, carga do runner, sistema operacional e instrumentação impedem tratar os tempos locais como baseline numérico equivalente ao CI.

Para calibrar, preserve a primeira execução, compare a mesma revisão e o mesmo Chromium no mesmo runner e examine distribuição das amostras, perfis de CPU, heap e erros. Uma falha deve ser investigada antes de alterar um limite. Novas execuções servem para diagnóstico; não substituem nem apagam a evidência inicial.

## Evidências locais iniciais

Na primeira medição comparável do código anterior, uma resposta JSON de 1MiB apresentou máximos de 680,8ms para Response, 451,5ms para o menu e 1.715ms para o editor; a maior long task foi de 935ms. Após a otimização de BodyViewer, os seis cenários locais de corpo/histórico passaram; no cenário de 5MiB com 1.000 registros, a maior interação medida foi de aproximadamente 37ms. Esses números descrevem essas execuções locais específicas.

O cenário de 50.000 requests revelou um segundo custo: 25 patches reconstruíam o histórico e o modelo da tabela, produzindo 966ms de bloqueio acumulado e 3,08s de tarefas na UI. Com agrupamento em janelas fixas de 50ms (sem adiar indefinidamente sob tráfego contínuo), a mesma carga passou com 283ms de bloqueio e 1,21s de tarefas. Os patches mantêm a ordem e o body integral; a persistência continua imediata no background. Os 21 cenários curtos passaram no build final local.

Uma tentativa anterior com 5MiB, snapshots DOM do tracing habilitados e o renderer chegando a aproximadamente 5GB terminou em timeout. A sobrecarga do profiler torna essa tentativa inadequada para uma comparação quantitativa de antes/depois. Os testes atuais mantêm tracing sem snapshots DOM.

A gravação curta inicial preservou os 96 IDs em todas as etapas. Foram observados dois puts por request, p95 de transação de aproximadamente 4,1ms e nenhum erro de persistência. O cenário contínuo reproduziu a ausência de checkpoints: após 3.492ms de tráfego, ainda havia somente o write inicial da sessão; o flush final preservou os 156 requests. Essa evidência motivou limitar a espera máxima de flush do recorder. O teste mantém a asserção do checkpoint para impedir a regressão.

O cenário real de 30min passou localmente: três sessões de pelo menos 600.105ms, com 116 requests por sessão (348 no total), paridade de bodies/IDs e nenhum erro de persistência ou sessão órfã. Foram 702 commits de sessão, p95 de 2,5ms e máximo de 7,2ms. O heap do service worker passou de 1,78MiB para 2,69MiB (pico amostrado de 6,91MiB). Este ensaio usou o build com paginação/memoização e checkpoint de 1s; correções posteriores de classificação Unicode e tratamento de falha no flush não pertencem à carga exercitada. Os artefatos registram o hash exato do build. O cenário isolado de 10min compartilha o encerramento exercitado três vezes no ensaio de 30min.

O teste do Side Panel nativo também passou: recebeu request e duração ao vivo e, após fechar/reabrir, exibiu alteração feita diretamente no IndexedDB sem broadcast. Isso valida remontagem/resync; não comprova todas as transições de foco/visibilidade de uma instância que permanece aberta (follow-up Beads 1kl).

## CI e retenção da primeira execução

O workflow `.github/workflows/performance.yml` executa os curtos em pull requests que alteram a aplicação ou este harness. A agenda semanal, às segundas-feiras às 06:30 UTC, inclui curtos e longos. O disparo manual oferece `soak`, desativado inicialmente. Cada job tem um worker, zero retries e timeout de 65 minutos.

O upload usa `if: always()` e preserva por 30 dias o relatório HTML, `performance-results/` e o ambiente do runner, tanto em sucesso quanto em falha. O nome do artefato inclui `run_id` e `run_attempt`, separando reexecuções. Métricas JSON, evidência de gravação, traces e perfis de CPU ficam associados ao teste; falhas antes da coleta podem deixar somente evidência parcial e os logs do job.

Localmente, Playwright reutiliza e limpa o diretório de saída entre execuções. Antes de repetir um teste com falha, copie `performance-results/` e `performance-report/` para outro diretório, ou use `--output=/tmp/debug-buddy-perf-execucao-2` e preserve também o relatório HTML anterior. O `--output` muda os resultados, mas não muda sozinho o diretório do relatório HTML.

## Provar que o gate reprova

O teste permite uma única injeção de diagnóstico que bloqueia cada clique por 650ms no browser, sem alterar a extensão. Este comando deve falhar e preservar artifacts; ele nunca faz parte do job normal:

```bash
PERF_INJECT_REGRESSION=1 npm run perf -- ui.spec.ts --grep 'Response 10240 bytes' --output=/tmp/debug-buddy-regressao-deliberada
```

A variável não altera budgets nem permite dispensar asserções. Remova-a para a execução normal. O gate detecta violações dos cenários e limites documentados; não promete detectar toda degradação possível em qualquer máquina ou carga.

A injeção deliberada foi executada localmente e reprovou no budget de Response: p95 de 665ms contra o limite de 250ms, com métricas, perfil e trace preservados. A primeira execução de CI também ficou preservada em [performance-41297319132-1](https://github.com/guichafy/chrome-extension-debug-buddy/actions/runs/41297319132/artifacts/13080785078); ela revelou erros no harness (permissão de clipboard por origem opaca, seletor de filtro e teto de conexões HTTP), corrigidos em commit posterior, sem retries.
