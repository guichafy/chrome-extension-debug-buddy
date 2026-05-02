# Spec: Session Replay com Smart Detection, Antipattern Detection e Console Capture

**Produto:** Debug Buddy
**Status:** Draft v0.3 — validado em entrevista (2026-05-02)
**Branch:** `feature/session-replay`

**Mudanças em relação à v0.2:**
- **Modos de operação reduzidos a 2.** Não existe "Apenas Gravação"; Session Replay sempre roda *sobre* a interceptação ativa (CDP attached, banner amarelo). Toggle `Gravação` só fica habilitado quando Interceptação está ON.
- **Modo passivo é fire-and-forget.** Sem buffer rotativo, sem promote-to-recording. Alimenta `Live Antipatterns` em tempo real e descarta tudo. O ponto aberto da v0.2 sobre "promover últimos 5 minutos" se resolve como fora de escopo da v1.
- **Network capture sempre via CDP.** O probe MAIN-world existe para framework detection, state taps e callsite/stack capture — não para network.
- **Novo módulo: Console Capture (seção 7-bis).** Captura via CDP `Runtime` + `Log` domains, cobertura completa (console.* da app, exceptions, warnings nativos do navegador), serialização via `RemoteObject.preview`, coalesce de idênticas consecutivas.
- **Schema versioning faseado:** `schemaVersion: 1` fixo durante todo o faseamento; campos novos sempre opcionais; viewer renderiza só o que conhece com aviso "esta sessão tem dados de uma versão mais nova".
- **State capture per-fase.** `stateBaseline` e `stateKeyframes` movem do nível Session para dentro de cada `DetectionPhase`. `antipatternHits` continua no nível Session, mas cada hit ganha `phaseId`.
- **Detecção honesta:** Apollo / TanStack Query / SWR / urql / Relay listadas com badge `detection-only` + tooltip "não agrupamos por operation nesta versão".
- **Source map heurístico** para resolver callsite minificado (GET `<bundle>.js.map` no mesmo path; cache por arquivo/sessão; lib `source-map` ~100 KB).
- **Privacy gate no Export:** modal de confirmação agressivo na Fase 2 (sem mascaramento ainda; Fase 6 cobre o resto).
- **Telemetria local** de quantas sessões batem o teto 50 MB / 10 min e em qual evento (tempo, tamanho, navegação).
- **Canvas rrweb:** default OFF, checkbox por sessão ao iniciar Gravação.
- **Importadas contam no limite de 10** (lista exibe origem: gravada local / importada).

**Mudanças em relação à v0.1 (mantidas):**
- rrweb na main thread (sem worker/OffscreenCanvas).
- Retenção 10 sessões com prompt manual de deleção (sem auto-purge).
- Resolução do replay-player segue scaling responsivo nativo do `rrweb-player`.
- Export sempre em arquivo único (sem chunks).

**Mudanças em relação à v0 (mantidas):**
- Captura visual completa via rrweb (DOM/mouse/input).
- Smart Detection per-URL com unificação na timeline.
- Replay cross-origin permitido por design.
- Privacidade extraída como TODO (não implementada nesta fase).
- GraphQL fora de escopo de tratamento dedicado.

---

## 1. Visão

Hoje o Debug Buddy intercepta e modifica respostas. Esta feature transforma a extensão em uma ferramenta de **observabilidade do frontend**: o usuário grava o que aconteceu (interação visual completa, requests, console, mudanças de estado, renders), recebe diagnósticos automáticos sobre problemas detectados, e exporta um pacote auto-contido que outro dev consegue replayar localmente como se estivesse assistindo o usuário usando a aplicação.

Frase de venda interna: *"o QA aperta gravar, faz o bug acontecer, e manda um arquivo. O dev abre, assiste a navegação como se estivesse vendo a tela do usuário, vê o clique exato que disparou a request errada, o `console.error` que vazou no caminho, e o estado que ficou inconsistente, e reproduz na própria máquina sem subir nada."*

A inspiração visual direta é o Session Replay do FullStory: o dev assiste à navegação do usuário (mouse, cliques, scroll, digitação) com painéis laterais mostrando network, console e estado correlacionados na mesma timeline.

## 2. Personas e jornadas

> **Nota editorial:** As personas abaixo representam o produto-alvo pós-Fase 6. Cada uma é atendida progressivamente conforme o faseamento da seção 16. Persona "QA reportando bug" depende de Fase 2 (replay visual) + Fase 6 (privacidade segura para Export). Persona "Tech lead em revisão" depende de Fase 3 (antipatterns).

**Dev debugando localmente.** Liga gravação enquanto reproduz um bug intermitente. Ao parar, vê a timeline anotada: aqui o usuário clicou, aqui foi disparada uma request duplicada (antipattern destacado), aqui apareceu um `console.error` sobre estado órfão, aqui o estado do Redux ficou inconsistente. Volta no tempo até o ponto exato e revê o vídeo da interação naquele instante.

**QA reportando bug.** Sem precisar entender a stack, grava a sessão e exporta um `.dbsession`. Anexa no Jira. O dev recebe, importa, e tem replay completo: vê a tela mexendo, o cursor andando, os campos sendo preenchidos, junto com o painel de network, console e estado. Não precisa pedir "manda os passos pra reproduzir".

**Tech lead em revisão.** Roda uma sessão de uso real e olha o relatório de antipatterns: "esta tela faz 12 requests redundantes em 800ms", "este componente tem retry storm em erro de auth", "este loop loga 200 mensagens de warning em 1s". Vira insumo de refactor.

**Dev usando "modo passivo" durante desenvolvimento.** Liga apenas o modo Interceptação sem Gravação. Não há overhead de captura visual nem persistência de sessão; só os antipatterns aparecem em tempo real num painel lateral conforme ele navega na app que está construindo. Funciona como um linter de runtime.

## 3. Escopo

### Frameworks suportados na v1

- **React** 16.8+ (hooks era), incluindo Next.js (CSR + RSC payloads parseados como caso especial).
- **Angular** 14+ (standalone components e signals incluídos).
- **JavaScript vanilla** (fetch / XHR / Axios sem framework).

Vue, Svelte, Solid: fora do v1, plugáveis depois.

### Bibliotecas reconhecidas na v1

| Categoria | Bibliotecas |
|---|---|
| HTTP client | fetch nativo, XMLHttpRequest, Axios, Angular HttpClient, ky |
| Data fetching | TanStack Query, SWR, RTK Query, Apollo Client, urql, Relay |
| State management | Redux (+ Toolkit), Zustand, Jotai, MobX, NgRx, Angular signals |

Libs em "Data fetching" são **detectadas mas não tratadas** na v1 — ver seção 6 (badge `detection-only`).

### Fora de escopo na v1

- **GraphQL com tratamento dedicado.** Queries/mutations entram no histórico como requests HTTP comuns, sem agrupamento por operation, sem parsing de schema, sem validação de variables. Apollo é detectado mas listado com badge `detection-only`.
- **WebSocket / SSE / gRPC-Web** (planejado para v2).
- **Replay executável** que roda contra o backend real. O replay é visual e factual (DOM reconstruído + estado reconstruído + console reproduzido), não interativo.
- **Privacidade e segurança.** Não implementadas nesta fase; marcadas como `TODO Privacidade` em todos os pontos relevantes do documento. Antes de qualquer release público, uma fase dedicada precisa endereçá-los. Export na Fase 2 sai com modal de confirmação agressivo.
- **Promover buffer passivo para sessão gravada.** Modo passivo é fire-and-forget; dev que percebeu o bug tarde precisa ligar Gravação e reproduzir.
- **Serialização rica de args de console.** Usamos só o `preview` que CDP entrega. Quem precisa expandir um objeto a fundo abre DevTools no momento da gravação.

## 4. Modos de operação

A feature introduz **um único modo novo** (Gravação) que se combina ortogonalmente com o estado atual de "Interceptação ligada/desligada". Session Replay sempre roda *sobre* a interceptação ativa: CDP precisa estar attached, banner amarelo "DevTools is debugging" presente.

| Modo | Intercepta? | Captura visual? | Captura network? | Captura console? | Captura estado? | Antipatterns? | Persiste sessão? |
|---|---|---|---|---|---|---|---|
| **Interceptação sem Gravação** (passivo) | Sim | Não | Sim, em tempo real (descartado imediatamente) | Não | Não | Sim, em tempo real | Não |
| **Interceptação com Gravação** | Sim | Sim | Sim, completa | Sim | Sim | Sim | Sim (`.dbsession`) |

A UI deixa explícito qual modo está ativo, com indicadores visuais distintos. Toggles independentes na barra superior:
- `Interceptação` (já existe).
- `Gravação` (novo). **Só fica habilitado quando Interceptação está ON e há tab alvo selecionada.**

O modo passivo (Interceptação sem Gravação) é desenhado para uso contínuo durante desenvolvimento: zero overhead de captura visual / console / state, sem persistência. Funciona como um "linter de runtime" que avisa o dev quando um padrão problemático aparece. Console capture **não roda em modo passivo** — dev usa o DevTools Console nativo se não está gravando.

## 5. Arquitetura

```
┌──────────────────────────────────────────────────────┐
│ Tab alvo (página debugada)                           │
│                                                      │
│  ┌────────────────┐    ┌──────────────────────────┐  │
│  │ MAIN-world     │    │ Isolated content script  │  │
│  │ probe          │◄──►│ (bridge)                 │  │
│  │                │    │                          │  │
│  │ - sniff hooks  │    │ - rrweb recorder         │  │
│  │ - state taps   │    │ - postMessage relay      │  │
│  │ - detection    │    │                          │  │
│  │ - callsite cap │    │                          │  │
│  └────────────────┘    └──────────┬───────────────┘  │
└─────────────────────────────────────┼────────────────┘
                                      │ chrome.runtime
                                      ▼
              ┌─────────────────────────────────┐
              │ Background service worker       │
              │                                 │
              │ - chrome.debugger (já existe)   │
              │ - Network/Fetch (já existe)     │
              │ - Runtime + Log (novo)          │
              │ - session orchestrator (novo)   │
              │ - antipattern engine (novo)     │
              │ - source map resolver (novo)    │
              │ - storage (IndexedDB)           │
              └────────────┬────────────────────┘
                           │
                           ▼
              ┌─────────────────────────────────┐
              │ UI (tab dedicada / side panel)  │
              │                                 │
              │ - timeline + replay player      │
              │ - rrweb player (visual)         │
              │ - console panel                 │
              │ - state inspector               │
              │ - antipattern report            │
              │ - export / import               │
              └─────────────────────────────────┘
```

### Decisões arquiteturais relevantes

**rrweb para captura visual.** A captura de DOM/mouse/input usa `rrweb` (MIT, community-vetted). Roda no isolated content script. Saída é um array de eventos com snapshot inicial + mutações incrementais. **Main thread**, sem worker/OffscreenCanvas (decisão da v0.2: priorizar simplicidade).

**Network capture: sempre via CDP.** Já temos `Fetch.enable` e `Network.enable` (esta para timing). Não há fallback "probe-only sem CDP" — o modo "Apenas Gravação" não existe.

**Console capture: via CDP `Runtime` + `Log` domains.** Ativados quando Gravação liga. Detalhes na seção 7-bis.

**MAIN-world probe permanece responsável por:**
- Detecção de framework e libs (precisa enxergar `window.__REDUX_DEVTOOLS_EXTENSION__`, `window.ng`, etc.).
- Tap em stores de estado (Zustand, signals do Angular dependem de acesso aos objetos do MAIN world).
- Captura de callsite enriquecido (parsing de stack do código da app, não da nossa wrapper).

**Re-injeção em navegação.** A cada `chrome.webNavigation.onCommitted` na tab alvo, re-injetamos probe + rrweb. Necessário porque navegação para nova origem destrói o contexto JS anterior. Continuidade da sessão é responsabilidade do background, que mantém o `Session` vivo enquanto a tab estiver "em gravação".

**Constraints de MV3 reforçadas:**
- Service worker pode ser terminado a qualquer momento. Estado da sessão em andamento precisa estar em IndexedDB com flush incremental, nunca só em memória.
- Cada sessão tem teto duro de **50 MB ou 10 minutos** (o que vier primeiro). Ao atingir o teto, gravação é encerrada automaticamente e usuário é solicitado a exportar ou descartar a sessão. Sem ring buffer, sem split em chunks.
- **Telemetria local** (não enviada externamente): registramos quantas sessões batem o teto e em qual evento (tempo, tamanho, navegação). Revisaremos os números com dado real antes de ajustar limites.
- `chrome.debugger` já está atachado pela feature de interceptação — reuso, não atacha segunda sessão. CDP só permite uma sessão de debugger por tab.

## 6. Módulo: Smart Detection (per-URL)

### Mudança em relação à v0

A detecção roda **a cada navegação** dentro da sessão. Cobre:
1. SPA com client-side routing (mesmo origin, URL muda mas a app não recarrega).
2. Navegação tradicional dentro do mesmo site (`pokemon.com/us/pokedex` → `pokemon.com/us/pokemon-video-games`).
3. Navegação entre sites distintos (`pokemon.com` → `pokemongo.com`).

### Triggers de re-detecção

| Evento | Estratégia |
|---|---|
| `chrome.webNavigation.onCommitted` (navegação real) | Reinjeta probe; detecção roda do zero após `document_start`. |
| `history.pushState` / `history.replaceState` (SPA route change) | Detecção rápida (recheca só signals que podem mudar com lazy loading: novas libs registradas no globalThis, novos stores criados). Framework e versão são considerados estáveis dentro da SPA. |
| `popstate` | Idem ao push/replace. |

### Regra de unificação na timeline

Para evitar ruído visual quando o usuário navega entre 50 páginas do mesmo site, agrupamos detecções consecutivas com fingerprint idêntico em uma única **fase**:

- Cada navegação produz um `PageDetection` com `url`, `timestamp`, e `EnvironmentFingerprint`.
- Detecções consecutivas são comparadas. Se o fingerprint é estruturalmente idêntico (mesmos frameworks, versões, libs, com mesmo confidence), a nova detecção é mesclada na fase atual, que passa a listar múltiplas URLs cobertas.
- Se *qualquer* aspecto do fingerprint muda (versão diferente, lib nova detectada, framework diferente), uma **nova fase** abre na timeline.

| Cenário | Resultado |
|---|---|
| `pokemon.com/us/pokedex` → `pokemon.com/us/pokemon-video-games` (mesmo build) | 1 fase, 2 URLs listadas |
| `pokemon.com` (React 18 + Apollo) → `pokemongo.com` (Angular + HttpClient) | 2 fases distintas |
| `pokemon.com` (React 18) → `pokemon.com/blog` (estática sem React) | 2 fases (vanilla é fingerprint diferente) |

### Comparação de fingerprints

```typescript
function fingerprintsEqual(a: EnvironmentFingerprint, b: EnvironmentFingerprint): boolean {
  return (
    a.framework.name === b.framework.name &&
    a.framework.version === b.framework.version &&
    sameSet(a.httpClients, b.httpClients, key => `${key.name}:${key.confidence}`) &&
    sameSet(a.dataFetching, b.dataFetching, key => `${key.name}:${key.version ?? ''}`) &&
    sameSet(a.stateManagers, b.stateManagers, key => `${key.name}:${key.storesDetected}`)
  );
}
```

`isProductionBuild` e `detectedAt` não entram na comparação (metadados, não identidade).

### O que detectamos e como

| Alvo | Técnica primária | Fallback | Tratamento na v1 |
|---|---|---|---|
| React + versão | `__REACT_DEVTOOLS_GLOBAL_HOOK__` | parse de stack em fetch | Tratado |
| Angular + versão | `window.ng.getComponent` após bootstrap | tag `ng-version` no DOM | Tratado |
| Redux | `window.__REDUX_DEVTOOLS_EXTENSION__` + sniff em `store.subscribe` via wrapping | — | Tratado (Phase 4) |
| Zustand | hook nas chamadas `create()` via Proxy global no probe | detecção por signature de store | Tratado (Phase 4) |
| TanStack Query | `window.__TANSTACK_QUERY_CLIENT__` se devtools instalado | parsing de stack | `detection-only` |
| Apollo | `window.__APOLLO_CLIENT__` | header `apollographql-client-name` | `detection-only` |
| SWR / urql / Relay / RTK Query | sniff de signatures conhecidas | header / stack | `detection-only` |
| Axios | hook em `XMLHttpRequest.open` + config object | nome em stack: `dispatchXhrRequest` | Tratado |
| Angular HttpClient | hook em `XMLHttpRequest.open` + presença de `ng` global | header característico | Tratado (Phase 5) |
| MobX / Jotai / NgRx / Angular signals | sniff de signatures conhecidas | — | Tratado (Phase 4–5) |

**Badge `detection-only`:** libs marcadas assim aparecem no painel `Environment Phases` com tooltip "Detectada nesta versão, sem agrupamento de operations / cache inspector dedicado. Requests aparecem como HTTP comuns no painel network."

### Saída da detecção

```typescript
interface EnvironmentFingerprint {
  framework: { name: 'react' | 'angular' | 'vanilla'; version?: string };
  httpClients: Array<{ name: string; confidence: 'high' | 'medium' | 'low' }>;
  dataFetching: Array<{ name: string; version?: string; treatment: 'tracked' | 'detection-only' }>;
  stateManagers: Array<{ name: string; storesDetected: number; treatment: 'tracked' | 'detection-only' }>;
  detectedAt: number;
  isProductionBuild: boolean;
}

interface PageDetection {
  url: string;
  timestamp: number;
  fingerprint: EnvironmentFingerprint;
  triggerType: 'navigation' | 'pushstate' | 'replacestate' | 'popstate' | 'initial';
}

interface DetectionPhase {
  id: string;
  startTimestamp: number;
  endTimestamp: number;
  fingerprint: EnvironmentFingerprint;
  pages: PageDetection[];
  stateBaseline?: StateSnapshot;          // movido pra dentro da fase em v0.3
  stateKeyframes: StateKeyframe[];        // movido pra dentro da fase em v0.3
}
```

### Builds de produção minificados

1. Source maps locais (se servidos publicamente) — usado também pelo source map resolver da seção 8.
2. Hooks de devtools (sobrevivem à minificação).
3. Signatures de comportamento.
4. Manifest hints opcionais do usuário.

> **TODO Privacidade:** Detecção lê `globalThis` e parseia stacks que podem incluir caminhos com nomes de usuário em ambientes de desenvolvimento. Antes de release, decidir se logamos paths brutos no `.dbsession` ou se truncamos a partir de heurísticas (`/Users/...`, `/home/...`).

## 7. Módulo: DOM Replay Capture

### Decisão de stack

Usaremos **rrweb** (`rrweb-record` + `rrweb-player`). Justificativa:
- Reduz risco e tempo de implementação (build próprio levaria 6+ meses).
- Compatível com MV3 (roda 100% client-side).
- Já trata os casos difíceis: shadow DOM, canvas, iframes same-origin, mutações em árvores grandes.
- MIT license, ~50 KB gzip.
- **Main thread** (sem worker/OffscreenCanvas) — decisão consolidada na v0.2.

> **TODO Privacidade:** rrweb tem suporte nativo a mascaramento (`maskTextSelector`, `maskInputOptions`). Configuração default agressiva (passwords, `autocomplete="cc-*"`, classe `dbb-mask`) será definida na Fase 6.

### O que é capturado

| Tipo | Frequência | Volume estimado |
|---|---|---|
| Snapshot inicial do DOM | 1x por page-load | 50–500 KB |
| Mutações incrementais (mutation observer) | Por mudança | depende da app |
| Movimento de mouse | Throttled a 50ms | médio |
| Clicks, double-clicks, context menu | Por evento | baixo |
| Inputs (`change`, `input` events) | Por evento | baixo |
| Scroll | Throttled a 100ms | médio |
| Viewport resize | Por evento | baixo |
| Touch events (mobile-emulated) | Throttled | médio |
| Selection / focus | Por evento | baixo |
| Canvas | **Default OFF; opt-in por sessão** | alto se ligado |

**Canvas:** default desligado. Quando o usuário liga `Gravação`, aparece checkbox "Capturar canvas (overhead alto)". Decisão por sessão. Apps com charts D3 / jogos / editores ligam quando precisam; apps comuns têm zero custo.

### Limitações conhecidas a comunicar ao usuário

- **Iframes cross-origin não são capturados** (limitação do navegador). Aparecem como retângulos vazios. Aceitável para v1.
- **Conteúdo de `<video>` e `<audio>` não é capturado.** O elemento aparece, mas o frame de vídeo não.
- **Web Components com shadow DOM closed** não são acessíveis.
- **Animações CSS** são reproduzidas pelo CSS no replay, não gravadas frame a frame.

### Buffer e flush

- Eventos rrweb vão para um buffer em memória no isolated content script.
- Flush para o service worker via `chrome.runtime.sendMessage` em batches a cada 1s ou 100 eventos.
- Service worker grava em IndexedDB imediatamente.

### Modo passivo

Modo passivo **não captura rrweb**. Rodam apenas: network (já existe), Smart Detection per-URL (necessária pra antipatterns saberem em qual fase estão), route tracking, e o engine de antipatterns alimentando o painel `Live Antipatterns`. **Sem console, sem state, sem rrweb, sem persistência.** Preserva a promessa de overhead minimizado para uso contínuo durante dev.

## 7-bis. Módulo: Console Capture (novo em v0.3)

### Fonte

Captura via CDP (já attached pela interceptação):
- `Runtime.enable` + listener `Runtime.consoleAPICalled` — chamadas da app: `console.log/info/warn/error/debug/trace/dir/table/group/groupCollapsed/groupEnd/count/countReset/assert/time/timeEnd/timeLog/clear`.
- `Runtime.exceptionThrown` — uncaught errors com stack trace nativo.
- `Log.enable` + listener `Log.entryAdded` — mensagens injetadas pelo navegador: CORS errors, CSP violations, mixed content, deprecation warnings, network errors no console (`Failed to load resource`).

Espelha o que aparece aberto no DevTools Console com "All levels".

### Quando captura

Console capture **só ativa quando Gravação está ON**. Modo passivo não captura console (segue fire-and-forget; dev sem gravar usa DevTools Console nativo).

### Serialização de args

Usa o `preview` que CDP já envia em `consoleAPICalled` — gratuito, sem round-trip extra:
- ~5 propriedades por objeto, com nome / tipo / valor truncado.
- ~100 chars de strings.
- Tipo de cada arg (`string`, `number`, `boolean`, `undefined`, `null`, `object`, `function`, `symbol`).
- Flag `overflow` indicando "tem mais coisa não mostrada".

UI renderiza no estilo DevTools collapsed: `Object {a: 1, b: 2, ...}`. **Não** suportamos expandir além do preview na v1 — quem precisa inspecionar a fundo abre DevTools no momento da gravação.

### Stack trace

Nativo do CDP. Resolvido com a mesma heurística de source map dos antipatterns (seção 8) quando a frame está em build minificado.

### Spam protection (coalesce)

Mensagens **idênticas consecutivas** são coalescidas em uma única entrada com `coalesceCount: N`. Igual DevTools Console (`Foo (×123)`). Funciona bem para loop estático ("rendered" chamado 5000 vezes); flood com mensagens variando ("rendered #1", "rendered #2", ...) ainda passa, mas abre porta para um futuro antipattern `console-flood`.

### Modelo de dados

```typescript
interface ConsoleEvent {
  type: 'console';
  timestamp: number;
  phaseId: string;                       // qual DetectionPhase
  source: 'app' | 'browser' | 'security';
  level:
    | 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace'
    | 'dir' | 'table' | 'group' | 'groupCollapsed' | 'groupEnd'
    | 'count' | 'countReset' | 'assert'
    | 'time' | 'timeEnd' | 'timeLog' | 'clear';
  args: ConsoleArgPreview[];
  stackTrace?: {
    frames: Array<{ url: string; lineNumber: number; columnNumber: number; functionName: string }>;
  };
  coalesceCount?: number;                // >1 quando coalescido
}

interface ConsoleArgPreview {
  type: 'string' | 'number' | 'boolean' | 'undefined' | 'null' | 'object' | 'function' | 'symbol';
  description: string;
  preview?: {
    properties: Array<{ name: string; type: string; value?: string }>;
    overflow: boolean;
  };
}
```

`ConsoleEvent` continua em `SessionEvent` (já estava listado na seção 10 da v0.2; agora detalhado).

### UI

- **Aba "Console" no painel direito do Replay Player.** Layout estilo DevTools com filtros por level (errors, warnings, info, verbose) e por source (app, browser, security), busca textual no description.
- **Timeline horizontal:** console messages cromaticamente coloridas por level intercaladas com network/state/antipatterns.
- **Scrubbing sincronizado:** aba Console mostra mensagens até o tempo T do scrub.

### Antipatterns derivados (futuro)

- `console-flood` — ≥100 mensagens idênticas em <1s (já parcialmente coberto pelo coalesce; vira sinal explícito).
- `error-storm` — ≥3 `console.error` em <500ms (sinal de bug ativo em produção).

> **TODO Privacidade:** dev frequentemente loga `console.log('password:', pwd)`. Args podem conter tokens, dados de cartão, PII. Vai pro spec separado da Fase 6 (mascaramento por regex em description, opt-in para domínios específicos).

## 8. Módulo: Antipattern Detection

Catálogo v1 (inalterado em relação à v0):

| ID | Severity | Heurística |
|---|---|---|
| `dup-req-burst` | warn | Mesmo fingerprint (método+URL+hash body) ≥3x em <500ms |
| `retry-storm` | error | ≥4 tentativas da mesma request em <2s, todas falhas |
| `auth-refresh-storm` | error | ≥2 refreshes paralelos em <1s |
| `waterfall` | info | Cadeia sequencial paralelizável |
| `request-after-unmount` | warn | Resposta chega após unmount do componente origem |
| `polling-no-cleanup` | warn | Polling continua após navegação/unmount |
| `effect-fetch-loop` | error | ≥10 requests idênticas em <5s do mesmo callsite |
| `n-plus-one` | warn | Request pai + N filhas variando ID |
| `stale-cache-thrash` | info | TanStack Query: invalidate >3x/s — pode não disparar em v1 (TanStack é `detection-only`) |
| `large-payload-slow-path` | info | Resposta >1 MB sem paginação detectada |

Engine: stream de eventos cronológico com janela móvel; cada detector é independente.

### Source map resolver (novo em v0.3)

`AntipatternHit.context.callsite` traz `{ file, line }`. Em build minificado isso vira `bundle.js:1:48312` — inútil. Estratégia:

- Quando o callsite aponta para arquivo aparentemente minificado (heurística: linha 1 e coluna alta), background tenta GET `<file>.map` no mesmo path.
- Se 200, parseia com lib `source-map` (~100 KB adicional ao bundle de produção da extensão) e resolve para `{ file, line }` original.
- Se 404 / inválido / CORS, fallback silencioso para location bruta. Cache por arquivo-por-sessão (resolução é lazy: roda a primeira vez que precisamos resolver um callsite naquele arquivo).
- Mesmo resolver é usado pelo Console Capture (seção 7-bis) para enriquecer stack frames.

> **TODO Privacidade:** source maps podem expor caminhos absolutos do build server (ex: `/home/runner/work/.../src/...`). Vai pro spec da Fase 6.

```typescript
interface AntipatternHit {
  patternId: string;
  severity: 'info' | 'warn' | 'error';
  startTimestamp: number;
  endTimestamp: number;
  phaseId: string;                       // novo em v0.3
  evidenceEventIds: string[];
  context: {
    component?: string;
    callsite?: ResolvedCallsite;
    summary: string;
  };
  suggestion?: string;
}

interface ResolvedCallsite {
  raw: { file: string; line: number; column?: number };
  resolved?: { file: string; line: number; column?: number };  // só se source map resolveu
}
```

No modo passivo, hits são publicados ao vivo num painel lateral. No modo gravado, ficam ancorados na timeline.

## 9. Módulo: Time-Travel de Estado

Snapshots de estado (Redux, Zustand, NgRx, signals) são gravados como eventos da sessão e armazenados via keyframe + diff + LZ-string.

**Mudança em v0.3: state per-fase.** `stateBaseline` e `stateKeyframes` agora vivem dentro de cada `DetectionPhase` (seção 6). Quando o usuário navega entre fases com framework diferente (Redux → Angular signals), o inspector zera o painel e começa baseline novo da próxima fase. Modelo coerente com a Smart Detection per-URL.

UX: o painel de inspector de estado é **sincronizado** com o player visual. Ao scrubar a timeline para o instante T:
- O rrweb-player avança/recua para T.
- O painel de network filtra para eventos ≤ T.
- A aba console filtra para mensagens ≤ T.
- O inspector de estado reconstrói o snapshot em T aplicando diffs sobre o `stateBaseline` da `DetectionPhase` à qual T pertence.

Os quatro painéis mexem juntos.

> **TODO Privacidade:** state snapshots podem conter tokens, dados de usuário, segredos. Antes de release, definir whitelisting/redação configurável.

## 10. Modelo de dados

```typescript
interface Session {
  id: string;
  schemaVersion: 1;                       // fixo durante todo o faseamento (campos novos sempre opcionais)
  startedAt: number;
  endedAt: number;
  origin: 'recorded' | 'imported';        // novo em v0.3 — UI mostra na lista
  metadata: {
    initialUrl: string;
    userAgent: string;
    viewportSize: { w: number; h: number };
    canvasCaptureEnabled: boolean;        // novo em v0.3
  };
  detectionPhases: DetectionPhase[];      // contém stateBaseline + stateKeyframes (movidos do Session)
  events: SessionEvent[];                 // ordenados por timestamp
  rrwebEvents?: RrwebEvent[];             // opcional (Phase 2+)
  antipatternHits?: AntipatternHit[];     // opcional (Phase 3+); cada hit tem phaseId
  telemetry?: SessionTelemetry;           // novo em v0.3 — local, não enviada externamente
}

type SessionEvent =
  | NetworkEvent
  | StateChangeEvent                      // independente da rrweb, vem do tap em store
  | ConsoleEvent                          // detalhado em seção 7-bis
  | RouteChangeEvent
  | ErrorEvent
  | DetectionEvent;                       // marca início de uma DetectionPhase

interface SessionTelemetry {
  hitHardLimit: boolean;
  hardLimitReason?: 'size' | 'time' | 'navigation';
  endedSizeBytes: number;
  endedDurationMs: number;
  navigationCount: number;
}

// Eventos de DOM/mouse/input vivem em rrwebEvents, não em SessionEvent.
// Evita inflar a timeline lógica com 1000 mousemove events por minuto.
```

`bodyRef` continua apontando para blob store separado em IndexedDB para não inchar o índice.

**Política de campos opcionais:** todos os campos novos adicionados pós-Phase 1 são opcionais (`?`). Viewer/importer renderiza só o que conhece e exibe aviso "esta sessão tem dados de uma versão mais nova; alguns recursos podem não aparecer" se encontrar campo desconhecido.

> **TODO Privacidade:** `metadata.userAgent`, headers e bodies de network, args do console e o stream rrweb completo podem conter PII. Schema deve eventualmente ter um campo `redactionApplied: RedactionConfig` para auditoria.

## 11. UI / UX

### Rotas novas

`createHashRouter` ganha:
- `/replay/:sessionId` — Replay Player de sessão gravada localmente.
- `/replay/imported-:hash` — Replay Player de sessão importada (mesmo componente, source diferente).
- `/sessions` — Lista de sessões salvas (gravadas + importadas, com badge de origem).

### Painéis novos

- **Replay Player** (principal). Layout em duas colunas:
  - **Esquerda:** rrweb-player ocupando ~65% da largura, controles play/pause/scrub/velocidade.
  - **Direita:** abas em **Timeline** (network + console + estado + antipatterns), **Console**, **Inspector de Estado**, **Antipattern Report**.
- **Environment Phases**. Lista as `DetectionPhase` da sessão. Clicar numa fase salta o player para o início dela. Libs com badge `detection-only` visíveis com tooltip explicativo.
- **Live Antipatterns**. Painel lateral compacto que aparece no modo passivo.

### Controles de gravação e modo

Dois toggles independentes na barra superior:
- `Interceptação` (já existe).
- `Gravação` (novo). **Habilitado só quando Interceptação está ON e há tab alvo.**

Ao ligar `Gravação`, modal pequeno aparece com:
- Checkbox "Capturar canvas (overhead alto)" — default OFF.
- Botão "Iniciar gravação".

### Indicadores visuais

- Banner permanente quando `Gravação` está ativa (similar ao banner do debugger). Importante: usuário precisa saber que tela está sendo gravada.
- Counter de tamanho da sessão atual ("12.4 MB / 50 MB" e "3:24 / 10:00").
- **80% do limite (40 MB ou 8 minutos):** banner de aviso oferecendo export imediato.
- **100% do limite:** gravação encerra automaticamente. Modal solicita ao usuário exportar ou descartar a sessão. Sem ring buffer, sem split.

### Retenção local de sessões

Debug Buddy mantém **no máximo 10 sessões salvas** em IndexedDB simultaneamente. **Sessões importadas contam no mesmo limite.** Quando o usuário tenta iniciar nova gravação ou importar e já existem 10 sessões, modal solicita deletar pelo menos uma antes de prosseguir.

**Não há auto-purge.** Lista mostra: badge de origem (gravada local / importada), tamanho, duração, URL inicial, timestamp.

### Replay-player: comportamento de resolução

Sessão pode ter sido gravada em resolução diferente da resolução do dispositivo de quem assiste. O replay segue o **scaling responsivo nativo do `rrweb-player`** (sem lógica de scaling customizada).

### Export / import

- **Export:** `.dbsession` (zip com `manifest.json`, `session.json`, blobs de body, eventos rrweb em arquivo separado, `viewer.html` standalone).
- **Modal de confirmação agressivo no Export:** antes de gerar o arquivo, modal explica em texto destacado:
  > "Este arquivo contém TUDO que foi gravado: a tela inteira (incluindo conteúdo digitado em campos como senhas, números de cartão e tokens), todas as requisições e respostas da rede (incluindo Authorization headers e cookies), todas as mensagens de console, e o estado completo da aplicação. Revise antes de anexar em qualquer lugar público (Jira, Slack, e-mail). Mascaramento automático será adicionado em uma versão futura."
  > Botões: `Cancelar` / `Entendi, exportar`.
- Viewer.html embute versão minimalista do player (rrweb-player + UI de timeline + aba Console + aba State + aba Antipatterns) que roda offline, sem precisar do Debug Buddy. Crítico para bug reports anexados em Jira.
- **Import:** abre uma sessão exportada e mostra no mesmo replay player, **independente da origem da aba atual**. Roda dentro de iframe sandboxed da UI da extensão.

## 12. Schema versioning

Schema do `.dbsession` permanece **interno** — não publicamos garantias de compatibilidade externa nesta fase.

### Política

- `schemaVersion: 1` **fixo durante todo o faseamento**. Campos novos adicionados em fases posteriores são sempre **opcionais**.
- Mudanças backward-compatible (campos opcionais novos) **não bumpam** a versão.
- Mudanças breaking (renomear campo, mudar formato) bumpam a versão e requerem migrator no import.
- Viewer.html embutido na sessão: renderiza só o que conhece. Se encontra campo desconhecido (forward compat), exibe aviso "esta sessão tem dados de uma versão mais nova do Debug Buddy; alguns recursos podem não aparecer".
- Documentação interna em `app/docs/dbsession-schema.md` (a criar) com:
  - Estrutura completa de cada tipo, marcando quando cada campo foi introduzido.
  - Mudanças entre versões (quando houver bump real).
  - Exemplos canônicos.
  - Tabela de migrators implementados.

### Quando publicar externamente

Quando tivermos:
1. Pelo menos uma versão estável que rodou em produção por 3+ meses sem mudança.
2. Um caso de uso externo concreto (integração com outra ferramenta).
3. Bandwidth para garantir backward-compatibility a partir do anúncio.

Até lá, qualquer ferramenta externa que parsear `.dbsession` faz por sua conta e risco.

## 13. Privacidade e segurança (não implementado nesta fase)

> **TODO geral:** Esta seção é intencionalmente vazia de decisões nesta versão. Spec separada na Fase 6 vai cobrir:
> - Mascaramento de inputs sensíveis no rrweb (passwords, cartões).
> - Redação configurável de headers (Authorization, Cookie, Set-Cookie) e bodies de network.
> - Mascaramento de args de console por regex (passwords, tokens, dados de cartão).
> - Whitelisting/blacklisting de URLs para gravação.
> - Redação de state snapshots (whitelisting de keys).
> - Política de retenção e auto-purge de sessões antigas.
> - Truncamento de paths em stack traces e source maps.
> - Política para sessões importadas de origens diferentes (atualmente: permitido sem aviso, precisamos avisar pelo menos).
> - Banner permanente e ruidoso quando gravação está ativa.

**Mitigação parcial na Fase 2:** modal de confirmação agressivo no Export (ver seção 11). É a única "barreira" ativa enquanto Fase 6 não chega.

## 14. Desafios técnicos prioritários

1. **Race condition do probe vs. app code.** Se a app importar React/Angular antes do nosso script no MAIN world rodar, perdemos pontos de hook. Mitigação: `run_at: document_start` + `chrome.scripting.executeScript({ world: 'MAIN' })`. Validar em apps com bundles muito grandes.
2. **Re-injeção em navegação cross-origin.** A cada `webNavigation.onCommitted`, todo o probe + rrweb precisa re-rodar. Continuidade da sessão é responsabilidade do background.
3. **Overhead de captura.** Hook em fetch + tap em store + sampling de render + rrweb gravando DOM/mouse + Runtime/Log do console adiciona latência mensurável. Meta: <8% de overhead em apps típicas. Necessário benchmark com Lighthouse antes/depois.
4. **Tamanho de sessão.** rrweb pode gerar 10–30 MB em 5 minutos de uso pesado. Hard limit: 50 MB / 10 min. Telemetria local para revisar valores com dado real.
5. **Detecção em produção minificada.** Estratégias da v0 mantidas. Aceitar `confidence: low` em casos extremos.
6. **Compatibilidade com a interceptação atual.** CDP só permite uma sessão de debugger por tab. Reusar sessão existente.
7. **Service worker reciclando memória.** Estado da gravação em andamento totalmente reconstruível a partir do IndexedDB.
8. **Replay cross-origin via iframe sandboxed.** O `.dbsession` é renderizado num iframe isolado da UI da extensão. CSP da extensão precisa permitir o player rrweb.
9. **Drift de relógio entre rrweb (isolated content script) e probe (MAIN world).** Provavelmente <100 ms imperceptível em scrubbing; instrumentar se houver relato. Mitigação possível: enviar `performance.now()` do MAIN para o isolated via postMessage com offset.
10. **Performance de scrubbing com state diffs grandes.** Pode ficar caro reconstruir snapshot de Redux store grande aplicando dezenas de diffs. Adicionar índice de keyframes (snapshot completo a cada N segundos) se virar dor real.
11. **Console flood sob coalesce.** Loop com mensagens variando ("rendered #1", "rendered #2", ...) escapa do coalesce e estoura sessão. Antipattern `console-flood` futuro mitiga, mas não na v1.
12. **Source map fetch com auth/CORS.** Fallback silencioso para location bruta. Documentar como limitação.

## 15. Métricas de sucesso

- Tempo médio entre `iniciar gravação` e `bug reproduzido pelo dev` (alvo: redução de 50% vs. relato textual). Requer baseline antes de medir.
- % de sessões exportadas que abrem corretamente em outra máquina.
- Antipatterns detectados por sessão (sanity check do detector — nem zero nem ruidoso demais).
- Overhead medido em FCP/LCP da app debugada com gravação ligada.
- Taxa de detecção bem-sucedida do framework por fase (alvo: >95% em React/Angular conhecidos, >80% em apps minificadas).
- Adoção do modo passivo: % de devs que mantêm modo passivo ligado >30 min/dia.
- **Telemetria local** (não enviada externamente): % de sessões que batem hard limit, distribuição de razão (size / time / navigation).

## 16. Faseamento sugerido

**Fase 1 — Foundation.**
Smart Detection per-URL com unificação. Modos de operação (passivo + gravação). Captura de network (já existe) + **console (Runtime + Log domains, com coalesce e source map heurístico)** + route change + error. UI básica com timeline. Sem rrweb, sem state, sem antipatterns. Export/import de sessão "leve". Telemetria local de hard limit.

**Fase 2 — Visual replay.**
Integração rrweb (gravação + player). UI de replay com player visual + timeline sincronizada. Viewer standalone embutido no `.dbsession`. Replay cross-origin via iframe sandboxed. **Modal de confirmação agressivo no Export.** Checkbox de canvas opt-in.

**Fase 3 — Antipattern engine.**
Os 5 patterns de maior valor: `dup-req-burst`, `retry-storm`, `effect-fetch-loop`, `waterfall`, `auth-refresh-storm`. Live panel para modo passivo, painel ancorado para modo gravado. Source map resolver compartilhado com Console Capture.

**Fase 4 — State capture.**
Tap em Redux e Zustand primeiro. Snapshots + diffs + replay com inspector de estado sincronizado. **stateBaseline + stateKeyframes per-DetectionPhase.**

**Fase 5 — Angular completo.**
Angular HttpClient, signals, NgRx.

**Fase 6 — Privacidade e segurança.**
Spec separada (ver seção 13). Mascaramento, redação, confirmações, banners. Pré-requisito para release público amplo.

---

## Decisões consolidadas em v0.3

Para histórico, os pontos resolvidos nesta entrevista (2026-05-02):

1. **Modos de operação reduzidos a 2.** Não existe "Apenas Gravação". Toggle Gravação habilita só quando Interceptação está ON.
2. **Modo passivo é fire-and-forget.** Sem buffer rotativo, sem promote-to-recording, sem console capture. Resolve o ponto aberto da v0.2.
3. **Network capture sempre via CDP.** Probe não vê network.
4. **Console Capture (módulo novo, seção 7-bis).** CDP `Runtime` + `Log`, cobertura completa, preview do RemoteObject, coalesce de idênticas consecutivas. Só roda com Gravação ON.
5. **Limites 50 MB / 10 min mantidos, com telemetria local** para revisar com dado real.
6. **Canvas rrweb default OFF**, checkbox por sessão ao iniciar Gravação.
7. **schemaVersion: 1 fixo**, campos novos sempre opcionais, viewer renderiza só o que conhece + aviso forward-compat.
8. **state movido para DetectionPhase.** `stateBaseline` e `stateKeyframes` por fase. `antipatternHits` no nível Session com `phaseId` por hit.
9. **Apollo / TanStack / SWR / urql / Relay com badge `detection-only`** + tooltip.
10. **Source map heurístico** para callsite minificado (lib `source-map`, ~100 KB; fallback silencioso). Compartilhado entre antipatterns e Console Capture.
11. **Modal de confirmação agressivo no Export** (Fase 2). Sem mascaramento; mascaramento na Fase 6.
12. **Importadas contam no limite de 10**, lista exibe origem.
13. **Personas representam produto-alvo pós-Fase 6**, com nota editorial em seção 2.
14. **Rotas:** `/replay/:sessionId`, `/replay/imported-:hash`, `/sessions`.
15. **Pontos abertos da v0.2 fechados:** promote-to-recording (fora de escopo da v1).

## Pontos abertos para revalidar adiante

- **Drift de relógio rrweb ↔ probe** durante scrubbing — instrumentar se houver relato; mitigação pronta (offset via `performance.now()` do MAIN).
- **Performance de scrubbing com state grande** — adicionar índice de keyframes se virar dor.
- **Console flood com mensagens variando** — antipattern `console-flood` numa v1.x.
- **Source map fetch com auth/CORS** — documentar como limitação; possivelmente UI para upload manual de `.map` na Fase 6.
- **antipatternHits cruzando fronteiras de fase** (ex: `request-after-unmount` onde unmount aconteceu em fase anterior) — confirmar que `phaseId` é a phase do *hit*, não do unmount original; documentar na implementação.
