# Spec: Session Replay — Insights & Recommendations Refactor

**Produto:** Debug Buddy
**Status:** Draft v1.0 — entrevista 2026-05-03
**Branch:** `feature/session-replay`
**Supersede parcial de:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` (seções 6, 8, 10 quanto a antipatterns; seção 9 quanto a state per-fase)

---

## 0. Contexto e motivação

A v0.3 da spec Session Replay introduziu três módulos de "diagnóstico" coexistindo no mesmo fluxo:

1. **Smart Detection** (framework + libs por URL).
2. **Antipattern Detection** (10 heurísticas network-driven).
3. **State Capture** (Redux/Zustand/NgRx/Angular signals com baseline + keyframes per-DetectionPhase).

Em prática, o que está implementado:

- A **detecção de framework** cobre apenas React e Angular; não detecta jQuery — biblioteca extremamente comum nos sites alvo do usuário.
- O **State Inspector** só funciona em sessão gravada. Em modo passivo (interceptação ON, gravação OFF), o probe é deliberadamente injetado com `withStateTaps:false` e nada de estado aparece.
- O **`LiveAntipatternsPanel`** (lateral, modo passivo) mostra "Aguardando primeira detecção…" e "Nenhum antipattern detectado" na maioria das aplicações reais. Sem feedback útil.
- Os 10 antipatterns são **ruidosos e/ou inaplicáveis** sem cache de queries (TanStack/Apollo são `detection-only`); poucos disparam em apps típicas, e os que disparam dão pouca acionabilidade.

Esta spec **reorienta** a feature para o que efetivamente entrega valor:

1. Detectar **React, Angular e jQuery** (mantém a semântica de fingerprint per-URL).
2. Mostrar **estado da aplicação** (Redux/Zustand/Angular Signals/NgRx) **com ou sem gravação** — em passivo é snapshot ao vivo, em gravação é timeline scrubável.
3. Substituir antipatterns por **Recomendações** estilo Lighthouse-light, com 10 regras concretas (compressão, cache, security headers, payload, cookies, CORS).

A engine de antipatterns é **removida por completo**, não apenas suspensa.

---

## 1. Decisões consolidadas

| # | Decisão | Implicação |
|---|---|---|
| 1 | Detectar React, Angular, jQuery | jQuery vai em `EnvironmentFingerprint.libraries` (campo novo), não em `framework.name` — coexistência com React/Angular é comum. |
| 2 | State capture sempre ativo (passivo + gravação) | Probe sempre instala state taps quando ativo. Em passivo, mutações só são broadcast (não persistidas). UI mantém cache in-memory dos últimos 100 changes por store. |
| 3 | Remover antipattern engine inteiro | Apaga `lib/session/antipattern/`, `AntipatternHitRow`, `AntipatternsTab`. `AntipatternHit` sai dos types. |
| 4 | Recomendações estilo Lighthouse — 10 regras (perfil C) | Compressão, cache estáticos, mixed content, CSP, HSTS, X-Content-Type-Options, payload grande, imagem não otimizada, cookie sem Secure/HttpOnly, CORS aberto. |
| 5 | Recomendações rodam em **passivo + gravação** | Engine única em background. Em passivo: broadcast para UI in-memory. Em gravação: broadcast + persistência em `Session.recommendations[]`. |
| 6 | Implementação extensível | Cada regra em arquivo próprio sob `rules/`. Registry array em `registry.ts`. Adicionar 11ª regra = criar arquivo + 1 linha. |
| 7 | Schema mantém `schemaVersion: 1` | `recommendations` opcional. Sessões antigas com `antipatternHits` continuam abrindo (campo ignorado). |

---

## 2. Modelo de dados

### 2.1 Tipos novos em `app/src/lib/session/types.ts`

```typescript
export type RecommendationSeverity = 'info' | 'warn' | 'error';

export type RecommendationRuleId =
  | 'compression-missing'
  | 'cache-missing'
  | 'mixed-content'
  | 'csp-missing'
  | 'hsts-missing'
  | 'nosniff-missing'
  | 'large-payload'
  | 'image-not-optimized'
  | 'cookie-insecure'
  | 'cors-open';

export interface Recommendation {
  id: string;                                 // crypto.randomUUID()
  ruleId: RecommendationRuleId;
  severity: RecommendationSeverity;
  timestamp: number;
  phaseId?: string;                           // só em sessão gravada
  requestId?: string;                         // link para NetworkEvent quando aplicável
  url: string;                                // URL exata do hit
  host: string;                               // dedup
  summary: string;                            // texto curto pra UI ("compressão ausente em /api/products")
  evidence: Record<string, string>;           // headers/valores do hit ({"content-encoding":"absent","content-length":"34123"})
  suggestion?: string;                        // ação recomendada
}

export interface LibraryDetection {
  name: 'jquery';                             // futuro: 'lodash' | 'moment' | 'dayjs' | etc.
  version?: string;
  confidence: 'high' | 'medium' | 'low';
}
```

### 2.2 `EnvironmentFingerprint` ganha `libraries`

```typescript
export interface EnvironmentFingerprint {
  framework: { name: 'react' | 'angular' | 'vanilla'; version?: string };
  libraries: LibraryDetection[];              // NOVO — não breaking; campo opcional na deserialização
  httpClients: HttpClientDetection[];
  dataFetching: DataFetchingDetection[];
  stateManagers: StateManagerDetection[];
  detectedAt: number;
  isProductionBuild: boolean;
}
```

`fingerprintsEqual` em `lib/session/fingerprint.ts` ganha comparação canônica de `libraries` (`name:version:confidence`). Mudança em `libraries` abre fase nova — coerente com a regra existente.

### 2.3 `Session` ganha `recommendations`, perde `antipatternHits`

```typescript
export interface Session {
  // ... campos atuais mantidos
  recommendations?: Recommendation[];         // NOVO; opcional
  // antipatternHits removido
}
```

### 2.4 Tipos removidos

- `AntipatternHit`
- `AntipatternSeverity`
- `AntipatternPatternId`
- `Session.antipatternHits`

---

## 3. Detecção de framework e libraries

### 3.1 Framework continua igual

`app/src/probe/detectors/framework.ts` permanece — React (via `__REACT_DEVTOOLS_GLOBAL_HOOK__` ou fiber containers em `[data-reactroot], #root, #__next`) e Angular (`window.ng.getComponent` ou `[ng-version]`). Fallback: `vanilla`.

### 3.2 jQuery em arquivo novo

```typescript
// app/src/probe/detectors/libraries.ts
import type { LibraryDetection } from '@/lib/session/types';

export function detectLibraries(): LibraryDetection[] {
  const out: LibraryDetection[] = [];

  // jQuery via window.jQuery (canônico)
  const w = window as unknown as {
    jQuery?: { fn?: { jquery?: string } };
    $?: { fn?: { jquery?: string } } | unknown;
  };

  const jq = w.jQuery;
  if (jq && typeof jq === 'function' && jq.fn?.jquery) {
    out.push({ name: 'jquery', version: jq.fn.jquery, confidence: 'high' });
    return out;
  }

  // Fallback: window.$ pode ser jQuery aliasada
  const $ = w.$;
  if (
    typeof $ === 'function' &&
    ($ as { fn?: { jquery?: string } }).fn?.jquery
  ) {
    const v = ($ as { fn: { jquery: string } }).fn.jquery;
    out.push({ name: 'jquery', version: v, confidence: 'high' });
  }

  // NÃO inferimos jQuery por presença de $ sem .fn.jquery — Prototype, Zepto e
  // outras libs também usam $; falsos positivos são inaceitáveis.

  return out;
}
```

### 3.3 Integração no probe

`probe/main.ts:buildFingerprint` adiciona:

```typescript
return {
  framework: detectFramework(),
  libraries: detectLibraries(),
  httpClients: detectHttpClients(),
  dataFetching: detectDataFetching(),
  stateManagers: detectStateManagers(),
  detectedAt: Date.now(),
  isProductionBuild: isProductionBuild(),
};
```

---

## 4. State capture independente de gravação

### 4.1 Mudanças no protocolo do probe

**Hoje:** `probe:start-detection` carrega flag `withStateTaps: boolean`. Em modo passivo, background envia `false`. Probe não instala wrappers.

**Novo:** Taps são instalados sempre que probe está ativo. Flag `withStateTaps` é removida do tipo `ProbeMessage`. Sem fase de transição: extensão é local, probe + bridge + background são deployados juntos no mesmo `npm run build`. `chrome.tabs.sendMessage` em flight de antes do reload simplesmente falha — comportamento já tolerado pelo bridge (`Extension context invalidated` é silenciado).

```typescript
// app/src/probe/protocol.ts
export type ProbeMessage =
  | {
      ns: typeof PROBE_NAMESPACE;
      type: 'probe:start-detection';
      reason: PageDetectionTrigger;
      // withStateTaps removido — comportamento agora é incondicional
    }
  | { ns: typeof PROBE_NAMESPACE; type: 'probe:idle' }
  | { /* probe:detection — inalterado */ }
  | { /* probe:state-change — inalterado */ }
  | { /* probe:angular-http-tag — inalterado */ };
```

`probe/main.ts` instala `installReduxTap()`, `installZustandTap()`, `installAngularHttpTap()`, `installAngularSignalTap()`, `installNgRxTap()` sempre que recebe `probe:start-detection` (idempotentes — chamada repetida é no-op).

### 4.2 Background: broadcast ao vivo

Quando `chrome.runtime.onMessage` recebe `stateChange`:

- **Sempre:** `broadcastToUI('liveStateChange', { tabId, payload: statePayload })` — UI consome com ou sem sessão.
- **Se há sessão ativa para `tabId`:** `recorder.addEvent(sessionId, stateChangeEvent)` persiste como hoje.

Sem mudanças na lógica de keyframes em sessão gravada.

### 4.3 UI: `StateInspector` ganha modo live

```typescript
interface Props {
  // Modo gravado (replay):
  phase?: DetectionPhase | null;
  events?: SessionEvent[];
  playheadTimestamp?: number;
  // Modo passivo (live):
  liveSnapshot?: LiveStateSnapshot;
}

interface LiveStateSnapshot {
  byStoreId: Record<string, {
    storeKind: StoreKind;
    current: unknown;                          // último state observado
    recentChanges: number;                     // count de mutações observadas (visual feedback)
    lastChangeAt: number;
  }>;
}
```

Renderização:
- Se `liveSnapshot` definido: usa `liveSnapshot.byStoreId` direto (sem reconstrução temporal — não há timeline em passivo).
- Senão: usa `reconstructStateAt(phase, ...)` como hoje.

### 4.4 Cache in-memory na UI passiva

`LiveInsightsPanel` mantém um `useReducer` que aplica cada `liveStateChange` recebido. Estrutura:

```typescript
interface LiveState {
  byStoreId: Record<string, {
    storeKind: StoreKind;
    current: unknown;
    history: { prev: unknown; next: unknown; timestamp: number }[];  // FIFO cap 100
  }>;
}
```

Reset quando: `tabId` muda, navegação real (`webNavigation.onCommitted` → broadcast `liveDetection` com `triggerType: 'navigation'`), botão "limpar" no painel.

---

## 5. Engine de Recomendações

### 5.1 Estrutura de arquivos

```
app/src/lib/session/recommendations/
├── types.ts                        # Rule, RuleContext, Recommendation re-exportada
├── engine.ts                       # RecommendationEngine
├── registry.ts                     # array das 10 regras
├── rules/
│   ├── compressionMissing.ts
│   ├── cacheMissing.ts
│   ├── mixedContent.ts
│   ├── cspMissing.ts
│   ├── hstsMissing.ts
│   ├── nosniffMissing.ts
│   ├── largePayload.ts
│   ├── imageNotOptimized.ts
│   ├── cookieInsecure.ts
│   └── corsOpen.ts
└── __tests__/
    ├── engine.test.ts
    └── rules/
        ├── compressionMissing.test.ts
        └── ... (uma por regra)
```

### 5.2 Contrato de regra

```typescript
// types.ts
export interface RuleContext {
  topFrameUrl: string | null;                 // pra mixed-content; null se desconhecido
}

export type RulePartial = Omit<Recommendation, 'id' | 'timestamp'>;
export type Rule = (ev: NetworkEvent, ctx: RuleContext) => RulePartial | null;

export interface RuleDescriptor {
  id: RecommendationRuleId;
  rule: Rule;
}
```

Regras são funções **puras** sem estado entre chamadas. Engine adiciona `id` e `timestamp` antes de emitir.

### 5.3 Engine

```typescript
// engine.ts
export class RecommendationEngine {
  private dedup = new Set<string>();
  private dedupOrder: string[] = [];
  private static MAX_DEDUP = 1000;

  constructor(private readonly rules: RuleDescriptor[] = REGISTRY) {}

  pushResponse(ev: NetworkEvent, ctx: RuleContext): Recommendation[] {
    const out: Recommendation[] = [];
    for (const { rule } of this.rules) {
      const partial = rule(ev, ctx);
      if (!partial) continue;
      const key = this.dedupKey(partial);
      if (this.dedup.has(key)) continue;
      this.dedup.add(key);
      this.dedupOrder.push(key);
      this.evictIfNeeded();
      out.push({ ...partial, id: crypto.randomUUID(), timestamp: Date.now() });
    }
    return out;
  }

  reset(): void {
    this.dedup.clear();
    this.dedupOrder = [];
  }

  private dedupKey(p: RulePartial): string {
    let pathname: string;
    try {
      pathname = new URL(p.url).pathname;
    } catch {
      pathname = p.url;                        // dedup degradado pra hosts inválidos — não silencia erro semântico, dedup ainda funciona por string equality
    }
    return `${p.ruleId}|${p.host}|${pathname}`;
  }

  private evictIfNeeded(): void {
    while (this.dedupOrder.length > RecommendationEngine.MAX_DEDUP) {
      const oldest = this.dedupOrder.shift();
      if (oldest !== undefined) this.dedup.delete(oldest);
    }
  }
}
```

### 5.4 Integração no `background.ts`

Em `handleRequestPaused`, após captura completa do response (status, headers, body size conhecido):

```typescript
const networkEvent = buildNetworkEventFromResponse(...);
// ... persistRequest(id, response) já existente
const ctx: RuleContext = { topFrameUrl: await getTopFrameUrl(tabId) };
const hits = recommendationEngine.pushResponse(networkEvent, ctx);
for (const hit of hits) {
  broadcastToUI('liveRecommendation', { tabId, recommendation: hit });
  const session = await recorder.getActiveByTab(tabId);
  if (session) {
    await recorder.addRecommendation(session.id, hit);
  }
}
```

`getTopFrameUrl(tabId)` é nova helper: lê `chrome.tabs.get(tabId).url`. Cacheada por `tabId` com invalidação em `webNavigation.onCommitted`.

`recommendationEngine.reset()` é chamado em:
- `startDebugging` (nova sessão de debug — limpa state acumulado).
- `webNavigation.onCommitted` no main frame da target tab (dedup é por host+pathname; reset garante que retornar a uma URL ainda mostra recomendações).

### 5.5 Persistência em sessão gravada

`recorder.ts` ganha:

```typescript
async addRecommendation(sessionId: string, rec: Recommendation): Promise<void> {
  const session = await this.getById(sessionId);
  if (!session) throw new Error(`Session ${sessionId} não existe`);
  const list = session.recommendations ?? [];
  list.push(rec);
  await this.put({ ...session, recommendations: list });
}
```

Reusa o debounce existente (50ms) — recomendações chegam em rajadas durante page load.

`viewer.html` (template em `lib/session/viewerTemplate.ts`) renderiza `session.recommendations` numa aba dedicada — viewer standalone tem o mesmo painel do replay.

### 5.6 Implementação das 10 regras

Cada arquivo expõe `export const RULE: RuleDescriptor`. Resumo das heurísticas:

#### `compression-missing` (severity: warn)
- Condição: `status === 200`; `content-type` casa `text/*` OU `application/json` OU `application/javascript` OU `application/xml`; `content-length > 1024`; **sem** `content-encoding` ∈ {`gzip`,`br`,`deflate`,`zstd`}.
- Evidence: `{"content-type": "...", "content-length": "...", "content-encoding": "absent"}`.
- Suggestion: "Habilite gzip/brotli no servidor para responses textuais > 1 KB."

#### `cache-missing` (severity: info)
- Condição: pathname termina em `.js`, `.css`, `.png`, `.jpg`, `.jpeg`, `.svg`, `.woff2`, `.webp`, `.avif`, `.ico`, `.gif`; **sem** `cache-control` OU com `cache-control` contendo `no-store`.
- Evidence: `{"cache-control": valor ou "absent"}`.
- Suggestion: "Estáticos versionados podem ter `Cache-Control: public, max-age=31536000, immutable`."

#### `mixed-content` (severity: error)
- Condição: `ctx.topFrameUrl` começa com `https://`; `ev.url` começa com `http://` (não `https:`, `data:`, `blob:`).
- Evidence: `{"page": topFrameUrl, "subresource": ev.url}`.
- Suggestion: "Migre o subresource para HTTPS — navegadores bloqueiam mixed content em produção."

#### `csp-missing` (severity: error)
- Condição: `content-type` casa `text/html`; status 200; **sem** `content-security-policy` (ou `content-security-policy-report-only`).
- Evidence: `{"content-type": "text/html"}`.
- Suggestion: "Adicione `Content-Security-Policy` para mitigar XSS."

#### `hsts-missing` (severity: error)
- Condição: `ev.url` é `https://`; **sem** `strict-transport-security` na response.
- Evidence: `{"strict-transport-security": "absent"}`.
- Suggestion: "Adicione `Strict-Transport-Security: max-age=31536000; includeSubDomains` para forçar HTTPS."

#### `nosniff-missing` (severity: warn)
- Condição: status 200; **sem** `x-content-type-options: nosniff`.
- Evidence: `{"x-content-type-options": valor ou "absent"}`.
- Suggestion: "Adicione `X-Content-Type-Options: nosniff` para impedir MIME sniffing."

#### `large-payload` (severity: info)
- Condição: `content-length > 1_048_576` (1 MB); pathname **não** contém `page=`, `limit=`, `offset=`, `cursor=` na query string.
- Evidence: `{"content-length": "..."}`.
- Suggestion: "Considere paginação ou compressão semântica."

#### `image-not-optimized` (severity: info)
- Condição: `content-type` em {`image/png`,`image/jpeg`}; `content-length > 524_288` (500 KB).
- Quando `InterceptedResponse.request.headers.accept` está disponível, hit reforçado SE accept contém `image/webp` OU `image/avif` — caso contrário, regra ainda dispara mas evidence sinaliza ausência do header.
- Evidence: `{"content-type": "...", "content-length": "...", "accept": "..." | "absent"}`.
- Suggestion: "Sirva WebP/AVIF para clientes modernos — economia típica de 30-50%. Verifique `Accept` do cliente real antes de migrar."

#### `cookie-insecure` (severity: error)
- Condição: response com `set-cookie`; parse cada cookie. Hit se faltar `Secure` em URL `https://` OU se faltar `HttpOnly` (independente de scheme).
- Evidence: `{"cookie": <nome>, "missing": "Secure" | "HttpOnly" | "Secure;HttpOnly"}`.
- Suggestion: "Adicione flags `Secure; HttpOnly` (e considere `SameSite=Lax`)."

#### `cors-open` (severity: warn)
- Condição: response com `access-control-allow-origin: *` E **sem** `access-control-allow-credentials: true`.
- Severity: warn — `*` por si só não é vulnerabilidade; vira sinal quando combinado com endpoints sensíveis.
- Evidence: `{"access-control-allow-origin": "*"}`.
- Suggestion: "Restrinja `Access-Control-Allow-Origin` ao(s) origin(s) confiável(eis)."

### 5.7 Severidades agrupadas

```
error:  mixed-content, csp-missing, hsts-missing, cookie-insecure
warn:   compression-missing, nosniff-missing, cors-open
info:   cache-missing, large-payload, image-not-optimized
```

---

## 6. UI

### 6.1 Aesthetic & design tokens

A UI **respeita** o design system existente do projeto — não invento fontes novas, paletas novas, ou aesthetic radical. O painel é um instrumento técnico denso, no espírito de DevTools. Decisões:

- **Tipografia:** `var(--font-body)` (Plus Jakarta Sans) para texto; `var(--font-code)` (IBM Plex Mono) para URL/host/headers/diff de state. Display sutil com `font-weight: 600` em headers de seção, sem trocar a face.
- **Cores semânticas:** mapear `RecommendationSeverity` → tokens existentes:
  - `error` → `var(--color-destructive)` / `--color-destructive-foreground`
  - `warn` → `var(--color-warning)` / `--color-warning-foreground`
  - `info` → `var(--color-info)` / `--color-info-foreground`
- **Densidade:** painel é compacto (text-xs/text-sm; gap-1 a gap-2). Padding interno consistente `px-3 py-2`. Border de cada item severity-tinted no `border-l-2`.
- **Empty states:** **nunca** aparecem em branco. Cada um é frase informativa explicando o porquê e o que fazer.
- **Microinteração:** quando uma recomendação nova chega, a row tem `animate-in fade-in-0 slide-in-from-right-1` (já disponível via `tw-animate-css`) com `duration-200`. Sem efeitos exagerados — feedback discreto.
- **Indicador de atividade:** quando state taps recebem mutações ativas, um dot pulsante (`animate-pulse`) discreto fica ao lado do nome do store. Some após 2s sem mutação.

### 6.2 `LiveInsightsPanel` (substitui `LiveAntipatternsPanel`)

Posição: `fixed bottom-3 right-3`, largura 360px, max-h-[70vh], overflow-auto, rounded border, shadow-lg. **Idêntica geometria à de hoje** — não vamos inventar layout novo, só re-distribuir conteúdo.

```
┌──────────────────────────────────────────┐
│ Live Insights                  [limpar]  │ ← header sticky
├──────────────────────────────────────────┤
│ ▼ Framework & Libraries                  │ ← collapsible
│   [react 18.2] [jquery 3.7]              │
│   [redux ×2] [zustand ×1] [angular-http] │
│   /us/pokedex/charizard                  │ ← URL atual em mono
├──────────────────────────────────────────┤
│ ▼ Estado ao vivo                         │ ← collapsible
│   Store: [redux:store#0 ▾]   ● 12 mut.   │ ← dot pulsante quando ativo
│   ┌──────────────────────────────────┐   │
│   │ { user: {...}, cart: [...] }     │   │ ← JsonTree
│   └──────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ ▼ Recomendações (4)                      │ ← collapsible; counter
│   [error|warn|info]   filtros            │ ← checkbox por severity
│   ⚠ compression-missing                  │
│   /api/products — 34 KB sem gzip         │
│   ▸ ver detalhes                         │
│   …                                       │
└──────────────────────────────────────────┘
```

#### Comportamento

- **Visibilidade:** painel só aparece quando `passiveTabId !== null` (interceptação ON, gravação OFF, target tab definida) — **mesma regra de hoje**. Quando gravando, a UI do replay tem os mesmos dados.
- **Persistência (UI):** state de seções colapsadas em `useState` local — não persiste entre mounts (extensão fechada-aberta zera). Aceitável; é um instrumento de inspeção transitório.
- **Limpar:** zera tudo (recomendações, snapshot de state, last detection).
- **Reset automático:** `tabId` mudando → reset; `liveDetection` com `triggerType: 'navigation'` → reset (recomendações dedupadas em outra URL anterior podem virar novidade).

#### Estado vazio de cada seção

- **Framework & Libraries:** "Aguardando primeira detecção do probe…" — spinner pequeno (`animate-spin`).
- **Estado ao vivo:** "Nenhum store de estado detectado nesta página." (sub-label: "Redux/Zustand/NgRx/Angular Signals aparecem aqui quando inicializados.").
- **Recomendações:** "Nenhuma recomendação até agora." (sub-label: "Carregue recursos da página para acionar regras."). Quando filtros zeram visíveis: "Filtros escondem todas as N recomendações.".

### 6.3 Replay (modo gravado)

- **Aba "Antipatterns" → "Recomendações"** no painel direito do `RrwebPlayer` (componente `AntipatternsTab` é renomeado para `RecommendationsTab` e re-implementado lendo `session.recommendations`).
- **Filtros:** mesmo padrão (checkboxes por severity).
- **Item expansível:** clicar mostra `evidence` em key/value mono e `suggestion`. Se `requestId` está presente, link "ver request" navega para o item correspondente na aba Requisições (já existe `select` em `useRequestSelection` — reaproveitar).
- **Sincronização com playhead:** recomendações com `timestamp <= playheadTimestamp` são destacadas; futuras ficam dimmed (opacity-50). Mesmo padrão dos demais painéis sincronizados.

### 6.4 `PhaseList` (`components/replay/PhaseList.tsx`)

- Continua existindo. Adiciona badges de `libraries` ao lado dos badges de `dataFetching`. Layout idêntico — só mais um `.map`.
- Removidos: nenhum elemento atual perde lugar.

### 6.5 `StateInspector` no replay vs no painel passivo

Mesmo componente, dois modos. Decisão de DX: **única fonte da verdade**, props mutuamente exclusivas indicam o modo. Em runtime, se ambos forem passados, `liveSnapshot` ganha precedência. Erro de uso é detectado em desenvolvimento via `console.warn`.

---

## 7. Fluxo de mensagens (atualizações em `types/messages.ts`)

**Remove:**
- `liveAntipatternHit`

**Adiciona:**
- `liveRecommendation { tabId: number; recommendation: Recommendation }`
- `liveStateChange { tabId: number; payload: ProbeStateChangePayload }`

**Mantém:** `liveDetection`, `pageDetected`, `stateChange`, `probeStartDetection`, `probeIdle`.

**Observação:** `stateChange` (probe → background) e `liveStateChange` (background → UI) são separados — **não consolido** em uma única mensagem. Direção do fluxo é parte do contrato.

---

## 8. Migração / cleanup

### 8.1 Arquivos a deletar

```
app/src/lib/session/antipattern/                                (todo o diretório)
app/src/components/replay/AntipatternHitRow.tsx
app/src/components/replay/AntipatternsTab.tsx
app/src/components/replay/__tests__/AntipatternsTab.test.tsx    (se existir)
app/src/lib/session/__tests__/antipattern*.test.ts              (se existirem)
```

### 8.2 Arquivos a renomear

```
app/src/components/replay/LiveAntipatternsPanel.tsx → LiveInsightsPanel.tsx
app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx → LiveInsightsPanel.test.tsx
```

### 8.3 Arquivos a editar

- `app/src/lib/session/types.ts` — remove tipos antipattern; adiciona Recommendation, LibraryDetection.
- `app/src/lib/session/recorder.ts` — adiciona `addRecommendation`; remove `addAntipatternHit`.
- `app/src/lib/session/fingerprint.ts` — comparação inclui `libraries`.
- `app/src/lib/session/viewerTemplate.ts` — viewer renderiza `recommendations` (deleta antipatterns do template).
- `app/src/probe/protocol.ts` — `withStateTaps` removido.
- `app/src/probe/main.ts` — taps sempre instalados quando ativo; adiciona `detectLibraries`.
- `app/src/probe/bridge.ts` — sem mudanças contratuais; valida.
- `app/src/entrypoints/background.ts`:
  - Remove import e uso de `AntipatternEngine`.
  - Adiciona `RecommendationEngine` instanciada (singleton in-process).
  - Hook em `handleRequestPaused` chamando `engine.pushResponse`.
  - `liveAntipatternHit` broadcast removido; substitui por `liveRecommendation`.
  - `stateChange` listener remove gate de `withStateTaps`; sempre broadcasta `liveStateChange`.
- `app/src/types/messages.ts` — diff descrito em §7.
- `app/src/pages/Layout.tsx` — `LiveAntipatternsPanel` import → `LiveInsightsPanel`. `passiveTabId` mantém semântica (interceptação ON, gravação OFF).
- `app/src/components/replay/StateInspector.tsx` — props ganham `liveSnapshot?`.

### 8.4 Backward compat de sessões exportadas

`schemaVersion: 1` mantém. Tanto `antipatternHits` (antigo) quanto `recommendations` (novo) são opcionais. Importer ignora `antipatternHits` silenciosamente. Viewer template só renderiza `recommendations`. Sessões antigas abrem sem aba "Antipatterns" — aceitável (UX leve degradada para o passado, novo padrão para frente).

### 8.5 Beads

- Fechar `chrome-extension-debug-buddy-c49` (Antipattern Phase 3 follow-ups) com reason "feature substituída por Recomendações".
- Criar epic + child issues durante `writing-plans` (não nesta spec).

---

## 9. Testes

### 9.1 Unit

- **Uma test file por regra** em `lib/session/recommendations/__tests__/rules/<rule>.test.ts`. Cada uma exercita: caso positivo (regra dispara), caso negativo óbvio (regra não dispara), 1-2 edge cases (header com case diferente, valores limítrofes — `content-length: 1024` exato em compression-missing, etc.).
- **Engine:** `engine.test.ts` cobre dedup por `ruleId|host|pathname`, FIFO eviction quando excede 1000, reset.
- **`detectLibraries`:** caso jQuery via `window.jQuery` com versão; via `window.$` com `.fn.jquery`; sem jQuery; falso positivo Prototype/Zepto descartado.
- **`fingerprintsEqual`:** `libraries` diferente abre fase nova; mesmo `libraries` mas ordem diferente (sameSet) é igualdade.
- **`StateInspector`:** modo `phase` (gravado) — comportamento atual; modo `liveSnapshot` (passivo) — renderiza `byStoreId` direto.
- **`LiveInsightsPanel`:** snapshot com 3 seções vazias (estado vazio); snapshot com hits/state/detection; reset em mudança de tabId.

### 9.2 Integration

- **`background.ts`:** mock de `chrome.runtime.onMessage` com payload de `pageDetected`; verifica `liveDetection` broadcast em modo passivo, `addPage` em sessão ativa.
- **`background.ts`:** simulação de `Fetch.requestPaused` com response sem gzip e content-type texto; verifica `liveRecommendation` broadcast e `addRecommendation` se sessão ativa.
- **`background.ts`:** simulação de `stateChange` com sessão ativa → `addEvent`; sem sessão → só broadcast.

### 9.3 E2E (Playwright)

Adiciona caso novo ao golden path:
- Página fixture servida em :3100 com:
  - `<script src="/jquery-3.7.0.min.js">` (servido localmente)
  - `<div id="root"></div>` + bundle React inline com store Redux (já há fixture similar)
  - Endpoint `/api/products` que responde texto JSON sem `Content-Encoding`
- Fluxo: ativa interceptação **sem gravação**; abre Layout; espera no painel:
  - Badge `react`
  - Badge `jquery 3.7.0`
  - Badge `redux ×1`
  - Recomendação `compression-missing` para `/api/products`
- Captura screenshot `live-insights-passive.png` para `app/e2e/evidence/`.

---

## 10. Performance e overhead

- **State taps sempre on:** wrappers em Redux/Zustand/Signals/NgRx são idempotentes (já hoje). Custo de wrap é one-shot. Custo por mutação é O(1) — só broadcast da diff.
- **Engine de recomendações:** 10 regras × N requests por sessão. Cada regra é O(1) sobre headers. `Map.get`/`String.includes` dominam — desprezível mesmo em sessões com 1000 requests. Dedup com Set + queue paralela (cap 1000) é constante.
- **Re-render do `LiveInsightsPanel`:** seção de recomendações lista N hits (cap 50 visíveis); state inspector usa `useMemo` para reconstruir snapshot (já hoje em modo gravado). Em modo passivo, `liveSnapshot` é deriving direto do reducer — sem custo extra.
- **`getTopFrameUrl`:** 1 chamada `chrome.tabs.get` por request seria caro. Cache por `tabId`, invalidado em `webNavigation.onCommitted`. Custo amortizado: 1 `chrome.tabs.get` por navegação.

---

## 11. Não-objetivos desta refatoração

- **Não** vamos retomar nenhum dos antipatterns removidos como "regra de recomendação". Se um deles voltar a fazer sentido (ex.: `dup-req-burst`), entra como issue futura — fora desta spec.
- **Não** vamos detectar Vue, Svelte, Solid, Lodash, Moment, Day.js. `libraries` é estendível mas v1 só tem jQuery.
- **Não** vamos suportar regras stateful (que precisam de N requests anteriores) na engine atual. As 10 regras são todas response-level pure. Stateful é padrão da spec antiga (engine de antipatterns) — descartado por simplicidade.
- **Não** vamos publicar schema externamente. `schemaVersion: 1` permanece interno. Sessões exportadas que abriram em versão antiga continuam abrindo em versão nova; o reverso (sessão nova em viewer antigo) renderiza só o que conhece e exibe aviso forward-compat (já especificado em v0.3).

---

## 12. Faseamento de implementação

A spec será desdobrada em **um único plano de implementação** com sub-tarefas. Razão: as mudanças são entrelaçadas (modelo, probe, background, UI) — split em fases parciais arrisca deixar a árvore com tipos incompatíveis. Plano único com TDD + verificação por sub-tarefa.

Ordem sugerida (a ser detalhada no plano):

1. **Modelo de dados.** Atualiza `types.ts`, `fingerprint.ts`, `recorder.ts`. Remove tipos antipattern. Testes do recorder passam.
2. **Detector de jQuery.** Cria `libraries.ts`, integra no `probe/main.ts`, testes.
3. **State capture sem gating.** Remove `withStateTaps` do protocolo, taps sempre on, broadcast `liveStateChange`.
4. **Engine de recomendações.** Esqueleto + 10 regras + testes unitários por regra.
5. **Integração background.** Hook em `handleRequestPaused`, broadcast, persistência.
6. **UI do `LiveInsightsPanel`.** Renomeia, refatora 3 seções, estado vazio, micro-animações.
7. **UI do replay.** Substitui aba Antipatterns por Recomendações.
8. **Cleanup.** Apaga arquivos antigos. Atualiza `Layout.tsx`.
9. **E2E.** Adiciona caso novo ao golden path.
10. **Beads:** fecha c49, cria follow-ups que surgirem.

---

## 13. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| State taps sempre on quebram apps com prototipos exóticos (Proxy ao redor de Redux store) | Wrappers já são idempotentes e silenciam erros do tap (try/catch interno por implementação). Não é regressão — só remove o gate. |
| 10 regras virarem ruído em apps mal configuradas | Dedup por `ruleId|host|pathname` + filtros por severity. Default mostra todas. |
| jQuery em versão exótica (cdn de UMD multi-namespace) sem `$.fn.jquery` | Aceitamos não detectar. Confiabilidade > cobertura. |
| `getTopFrameUrl` cache stale → mixed-content falso positivo | Invalidação em `webNavigation.onCommitted` — alinhada com o ciclo de página. Janela de erro: <50ms entre commit e response, aceitável. |
| Cleanup deixa imports orfãos de antipattern em arquivos não-listados | TypeScript strict + Biome `noUnusedImports` quebram build. CI pega. |

---

## 14. Pontos abertos para revalidar adiante

- **Conjunto de bibliotecas detectadas** — depois de v1, considerar Lodash/Moment/Day.js conforme demanda real do usuário.
- **Recomendações stateful** — se aparecer demanda real (ex.: "request duplicada"), reabrir engine com buffer; até lá, simples.
- **i18n das suggestions** — hoje hardcoded em pt-BR. Quando i18n entrar (issue #3), suggestions viram chaves de tradução.
- **Source map para callsite** — apenas relevante para state changes em build minificado. Hoje resolvedor (lib `source-map`) só era usado por antipatterns. Mantemos `sourceMap.ts` no codebase para reuso futuro pelo State Inspector se virar dor.
