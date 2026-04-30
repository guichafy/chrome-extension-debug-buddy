# Network Metrics no SiteHeader — Design

**Data:** 2026-04-29
**Autor:** brainstorming session com Guilherme Chafy
**Status:** aprovado, pronto pra escrita do plano de implementação

## Objetivo

Mostrar, no lado esquerdo do `SiteHeader.tsx`, métricas relevantes de rede em formato compacto pra que o dev tenha visibilidade imediata do estado da sessão de interceptação. As métricas seguem o que a documentação Google de network troubleshooting prioriza: volume, latência de resposta, requests problemáticas.

Adicionalmente, capturar dados granulares de timing (TTFB, DNS, TCP, TLS, transferSize, cache) por request — disponíveis no `InterceptedResponse` para uso futuro no dialog de detalhes (esta feature **não** consome esses dados granulares na UI, apenas os captura).

## Decisões coletadas no brainstorming

1. **Granularidade:** sessão agregada **+** captura granular Google por request (TTFB, DNS, TCP, TLS, transferSize, fromCache).
2. **Bundle de pills no header:** Total requests · Total baixado · TTFB médio · Lentas (>1s) · Falhas (4xx+5xx).
3. **Janelas:** "Sessão" + "Página atual" (duas janelas distintas).
4. **Visual:** Tabs Sessão/Página com 1 grupo de 5 pills visível por vez.

## Arquitetura

Três camadas, cada uma com uma responsabilidade.

### 1. Captura granular no background

Estende `app/src/lib/networkTiming.ts` (`NetworkTimingTracker`) para também acumular o objeto `timing` de `Network.responseReceived` e o `encodedDataLength` de `Network.loadingFinished`. O ciclo de vida é o mesmo do `duration` — esperar todos os eventos, emitir uma vez via callback `onMetricsReady(fetchRequestId, networkTiming)`.

Helper puro `deriveNetworkTiming(timing, encodedDataLength, response): NetworkTiming` em `app/src/lib/networkTiming.ts` (mesmo arquivo, função exportada). Cálculos:

- `dnsMs = timing.dnsEnd - timing.dnsStart` quando ambos `≥ 0`, senão omite o campo.
- `tcpMs = timing.connectEnd - timing.connectStart` quando ambos `≥ 0`.
- `tlsMs = timing.sslEnd - timing.sslStart` quando ambos `≥ 0`. Omite em http puro.
- `ttfbMs = timing.receiveHeadersEnd - timing.dnsStart` quando ambos definidos.
- `transferSize = encodedDataLength` (recebido do `loadingFinished`).
- `encodedDataLength` exposto separado pra inspeção.
- `fromDiskCache = response.fromDiskCache === true`.
- `fromServiceWorker = response.fromServiceWorker === true`.

**Regra de no-fallback (CLAUDE.md):** quando um campo não tem dado, é **omitido**. Nada de `-1` ou `0` fictício. Se `timing` é `undefined` (mock, cache, etc.), o objeto `networkTiming` inteiro fica indefinido.

### 2. Page domain + sessionMarker

`background.ts` habilita `Page.enable` no `chrome.debugger.attach`. Listener de `Page.frameNavigated` filtra main frame (`params.frame.parentId == null`), atualiza marker.

```ts
interface SessionMarker {
  sessionStartedAt: number | null;
  currentPageUrl: string | null;
  currentPageNavigatedAt: number | null;
}
```

Persistido em `chrome.storage.local.sessionMarker` para sobreviver a reload do service worker MV3.

**Transições:**
- `startDebugging()` → `sessionStartedAt = Date.now()`, `currentPageUrl = null`, `currentPageNavigatedAt = null`. Broadcast.
- `Page.frameNavigated` (main frame) → `currentPageUrl = frame.url`, `currentPageNavigatedAt = Date.now()`. Broadcast.
- `stopDebugging()` → marker permanece (números congelados visíveis pro usuário).
- `clearAllRequests` → marker zera (`null/null/null`). Broadcast.

**Falha de `Page.enable`:** log `console.error`, NÃO interrompe Fetch/Network. UI vê tab "Página" desabilitada com tooltip "Aguardando navegação na aba alvo".

### 3. Agregação na UI

Pure functions em **`app/src/lib/networkMetrics.ts`**:

```ts
export const SLOW_THRESHOLD_MS = 1000;

export interface MetricsAggregate {
  totalRequests: number;
  totalBytes: number | null;   // null quando nenhuma request tem transferSize
  avgTtfbMs: number | null;    // null quando nenhuma request tem ttfbMs
  slowCount: number;
  failedCount: number;
}

export function aggregateRequests(requests: InterceptedResponse[]): MetricsAggregate;
export function filterBySession(requests: Record<string, InterceptedResponse>, sessionStartedAt: number | null): InterceptedResponse[];
export function filterByCurrentPage(requests: Record<string, InterceptedResponse>, currentPageNavigatedAt: number | null): InterceptedResponse[];
```

**Regras de agregação (no-fallback):**
- `totalBytes` retorna `null` quando nenhuma request tem `networkTiming.transferSize` definido. Quando ao menos uma tem, soma todas as definidas e ignora as ausentes. UI mostra "—" quando `null`.
- `avgTtfbMs` retorna `null` quando nenhuma request tem `networkTiming.ttfbMs`. Caso contrário, média simples sobre as definidas. UI mostra "—" quando `null`.
- `slowCount` conta apenas requests com `duration` definida E `duration > SLOW_THRESHOLD_MS`. Requests sem `duration` não contam (nem como "rápida" nem como "lenta").
- `failedCount` conta `status >= 400 || captureError != null`.

Hook **`app/src/hooks/useNetworkMetrics.ts`** consome `allRequests` e `sessionMarker` por argumento (sem coupling com leitor):

```ts
export function useNetworkMetrics(
  allRequests: Record<string, InterceptedResponse>,
  sessionMarker: SessionMarker,
): { session: MetricsAggregate; currentPage: MetricsAggregate };
```

Memoizado com `useMemo` em `[allRequests, sessionMarker]`.

Hook complementar **`app/src/hooks/useSessionMarker.ts`** (mesmo padrão de `useDebugging`):
- Mount: `chrome.runtime.sendMessage({ action: 'getSessionMarker' })`.
- Listener: `sessionMarkerUpdated`.

### 4. Modelo de dados

Extensão de `app/src/types/intercepted.ts`:

```ts
export interface InterceptedResponse {
  // ... campos existentes ...
  networkTiming?: {
    ttfbMs?: number;
    dnsMs?: number;
    tcpMs?: number;
    tlsMs?: number;
    transferSize?: number;
    encodedDataLength?: number;
    fromDiskCache?: boolean;
    fromServiceWorker?: boolean;
  };
}
```

Todos opcionais — registros legados no IndexedDB não têm o campo, leitor ignora.

### 5. Mensageria

Adições a `app/src/types/messages.ts`:
- `getSessionMarker` (UI → background, retorna `SessionMarker`).
- `sessionMarkerUpdated` (background → UI broadcast).

`requestUpdated` continua sendo o canal pra `networkTiming` chegar à UI (junto com `duration` ou logo depois). Sem mensagem nova.

## Componente do header

**Novo arquivo:** `app/src/components/layout/NetworkMetricsBar.tsx`.

```tsx
interface NetworkMetricsBarProps {
  session: MetricsAggregate;
  currentPage: MetricsAggregate;
  hasCurrentPage: boolean;
  isDebugging: boolean;
}
```

**Render:**
- shadcn `Tabs` com `value` em `'session' | 'page'`. Estado local. Default `'session'`.
- Quando `hasCurrentPage = false`, tab "Página" `disabled` com tooltip.
- 5 pills horizontais, ordem fixa: requests · baixado · TTFB · lentas · falhas.
- Pill = elemento com `LucideIcon` + valor + classes Tailwind compactas (`px-2 py-1 rounded-md bg-muted text-xs`).
- Pill "lentas" > 0 ganha cor `text-amber-500`; "falhas" > 0 ganha `text-destructive`.

**Estado vazio (`totalRequests === 0`):** placeholder único "Sem requests ainda" no lugar das pills.

**Estado "não debugando":** mantém os números congelados (não esconde).

**Formatadores em `app/src/components/layout/networkMetricsFormat.ts`:**
- `formatBytes(n: number | null): string` — "1.2 MB", "380 KB", "—" quando `null`.
- `formatMs(n: number | null): string` — "245 ms", "1.2 s", "—" quando `null`.
- `formatCount(n: number): string`.

## Mudança em `SiteHeader.tsx`

Insere `<NetworkMetricsBar ... />` após `Separator`. Recebe props vindas do `Layout.tsx` (que já tem acesso a `useDebugging`, `useAllRequests`, e adicionará `useSessionMarker` + `useNetworkMetrics`).

**Responsividade:**
- Container `min-w-0 flex-shrink overflow-hidden`.
- `< sm` (sidepanel ~380–420px): tabs viram toggle compacto, pills `overflow-x-auto` sem barra visível.
- `≥ md` (options.html janela normal): inline.
- `Separator` à esquerda fica `hidden md:block` no sidepanel pra ganhar espaço.

## Lifecycle resumido

| Evento | sessionMarker | allRequests |
|--------|---------------|-------------|
| Extension install / SW boot | carrega de `storage.local` | carrega de IndexedDB |
| `startDebugging` | `sessionStartedAt = now`, page=null/null | (não muda) |
| `Page.frameNavigated` main | `currentPageUrl/At = now` | (não muda) |
| `Fetch.requestPaused` + agregados | (não muda) | adiciona request |
| `Network.responseReceived/loadingFinished` | (não muda) | patch `networkTiming` |
| `stopDebugging` | (preserva) | (preserva) |
| `clearAllRequests` | zera tudo | zera tudo |

## Testes

- `app/src/lib/__tests__/networkMetrics.test.ts` — `aggregateRequests` com fixtures: vazio, só mock, mix, todas sem `networkTiming`, todas com falhas, edge de threshold (1000 vs 1001), `filterBySession`, `filterByCurrentPage`.
- `app/src/lib/__tests__/networkTiming.test.ts` (estende existente) — `deriveNetworkTiming` com `timing` parcial (sem TLS), redirect com `responseReceived`, ausência total de `timing`, `fromDiskCache` true, `encodedDataLength` em `loadingFinished`.
- `app/src/components/layout/__tests__/networkMetricsFormat.test.ts` — formatadores em todas as faixas (B/KB/MB/GB; ms/s; null em ambos).
- `app/src/hooks/__tests__/useNetworkMetrics.test.tsx` — recompõe quando `allRequests` muda, memoiza quando não muda.
- `app/src/hooks/__tests__/useSessionMarker.test.tsx` — busca inicial, atualiza no broadcast.
- `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx` — render, troca de tab, estado vazio, tab "Página" disabled quando `hasCurrentPage = false`, classes de cor em lentas/falhas > 0.

Smoke test do `NetworkTimingTracker` estendido valida que `onMetricsReady` é chamado uma vez com o objeto correto após sequência completa de eventos.

## Fora de escopo (registrado, não implementar)

- Core Web Vitals (LCP, INP, CLS) — exigem `Page.addScriptToEvaluateOnNewDocument` injetando PerformanceObserver. Outro PR.
- Click em pill filtrando Request History — futuro.
- Persistir histórico de sessões anteriores — só a sessão atual.
- Mostrar `networkTiming` granular no `ResponseDialog` (waterfall por request) — outro PR. **Esta feature deixa o dado pronto** no `InterceptedResponse`.
- i18n — issue #3 cobre o tema; pt-BR aqui.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| `Page.frameNavigated` falha em iframes/SPAs (history.pushState não dispara) | Documentado: SPA-only nav não reseta "Página". Aceitável v1; pode-se ouvir `Page.navigatedWithinDocument` em PR futuro. |
| Service worker reload perde marker | Persistido em `chrome.storage.local`. SW relê na inicialização. |
| `networkTiming` ausente em registros antigos no IndexedDB | Campo opcional; UI tolera ausência (mostra "—"). Sem migração necessária. |
| Sidepanel estreito esconde pills | `overflow-x-auto` sem barra; usuário arrasta. Não escondemos dado silenciosamente. |
| Performance de `aggregateRequests` em sessão grande (1000+ requests) | `useMemo`. Aggregate é O(n), uma passada. 10k requests = ~1ms em hardware típico. Sem worry. |
