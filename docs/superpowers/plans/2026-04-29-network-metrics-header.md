# Network Metrics no SiteHeader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar 5 pills agregadas (Total requests · Baixado · TTFB médio · Lentas · Falhas) no lado esquerdo do `SiteHeader`, com Tabs alternando entre janelas "Sessão" e "Página atual"; capturar timing granular Google (TTFB/DNS/TCP/TLS/transferSize/cache) por request para uso futuro.

**Architecture:** Captura granular no service worker (estende `NetworkTimingTracker` + helper puro `deriveNetworkTiming`) escreve `networkTiming` em cada `InterceptedResponse`. Background mantém `SessionMarker` (em memória + `chrome.storage.local`) atualizado por `startDebugging`/`Page.frameNavigated`/`clearAllRequests`. UI lê `allRequests` + `sessionMarker`, agrega via `aggregateRequests` puro, renderiza `NetworkMetricsBar` no header.

**Tech Stack:** TypeScript estrito · React 19 · shadcn `Tabs` + Tooltip · Tailwind v4 · Vitest (jsdom) · biome · Chrome Debugger Protocol (Fetch + Network + Page domains).

**Convenções do projeto a respeitar (CLAUDE.md):**
- Todos os comandos `npm` rodam de `app/`. Use `cd app && <cmd>` ou `(cd app && <cmd>)`.
- Indentação: **tabs (size 2)**. Não troque para espaços.
- Strings de UI, comentários e logs em **pt-BR**.
- TS strict ligado.
- **No-fallback rule**: campo sem dado é omitido/`null`, nunca `0`/`'Unknown'`/`-1` fictícios. UI mostra "—" para `null`.
- Arquivos de teste vão em `__tests__/` co-localizados.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `refactor:` (commitlint config-conventional).
- Husky `pre-commit` roda `biome check --apply` em arquivos staged; `commit-msg` valida o título.
- Path alias `@` → `app/src/`.

**Spec base:** [docs/superpowers/specs/2026-04-29-network-metrics-header-design.md](../specs/2026-04-29-network-metrics-header-design.md)

---

## File Structure

**Novos arquivos:**
- `app/src/types/sessionMarker.ts` — tipo `SessionMarker`.
- `app/src/lib/networkMetrics.ts` — funções puras de agregação + filtro por janela.
- `app/src/lib/__tests__/networkMetrics.test.ts`
- `app/src/hooks/useSessionMarker.ts`
- `app/src/hooks/useNetworkMetrics.ts`
- `app/src/hooks/__tests__/useSessionMarker.test.tsx`
- `app/src/hooks/__tests__/useNetworkMetrics.test.tsx`
- `app/src/components/layout/networkMetricsFormat.ts` — `formatBytes`, `formatMs`, `formatCount`.
- `app/src/components/layout/__tests__/networkMetricsFormat.test.ts`
- `app/src/components/layout/NetworkMetricsBar.tsx`
- `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx`

**Arquivos modificados:**
- `app/src/types/intercepted.ts` — adicionar `networkTiming?` a `InterceptedResponse`.
- `app/src/types/messages.ts` — adicionar actions `getSessionMarker` e `sessionMarkerUpdated`.
- `app/src/lib/networkTiming.ts` — adicionar callback `onMetricsReady`, exportar tipo `NetworkTiming`, exportar helper `deriveNetworkTiming`, capturar `responseTiming`/`encodedDataLength`/`fromDiskCache`/`fromServiceWorker` por entrada.
- `app/src/lib/__tests__/networkTiming.test.ts` — testes para extensão.
- `app/src/entrypoints/background.ts` — estado `sessionMarker`, persistência em `chrome.storage.local.sessionMarker`, handler `getSessionMarker`, broadcast `sessionMarkerUpdated`, habilitar `Page` domain, listener `Page.frameNavigated`, plugar callback `onMetricsReady` no `timingTracker`.
- `app/src/components/layout/SiteHeader.tsx` — receber e renderizar `<NetworkMetricsBar>` no lado esquerdo.
- `app/src/pages/Layout.tsx` — usar `useSessionMarker` + `useNetworkMetrics`, propagar dados ao `SiteHeader`.

---

## Task 1: Estender `InterceptedResponse` com `networkTiming`

**Files:**
- Modify: `app/src/types/intercepted.ts`

- [ ] **Step 1: Adicionar campo `networkTiming` ao `InterceptedResponse`**

Edite `app/src/types/intercepted.ts`. **Após** o campo `mockLatencyMs?` e **antes** de `generatedRuleId?`, adicione:

```ts
	/**
	 * Métricas granulares Google de rede capturadas via CDP `Network.responseReceived` +
	 * `Network.loadingFinished`. Ausente para mocks (não passou pela rede), requests
	 * legadas no IndexedDB, e casos onde o evento não chegou. Campos individuais
	 * também podem ser omitidos quando o dado correspondente não existe (ex.: `tlsMs`
	 * em http puro). Regra do projeto: nada de defaults fictícios — ausência é `undefined`.
	 */
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
```

- [ ] **Step 2: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros (campo é opcional, ninguém precisa gravar ainda).

- [ ] **Step 3: Commit**

```bash
git add app/src/types/intercepted.ts
git commit -m "feat(types): adiciona networkTiming opcional ao InterceptedResponse"
```

---

## Task 2: Tipo `SessionMarker` + ações de mensageria

**Files:**
- Create: `app/src/types/sessionMarker.ts`
- Modify: `app/src/types/messages.ts`

- [ ] **Step 1: Criar `app/src/types/sessionMarker.ts`**

```ts
// Marca dois pontos de tempo durante a interceptação:
//  - sessionStartedAt: quando o usuário clicou em "Iniciar Interceptação"
//  - currentPageNavigatedAt: quando a target tab fez a última navegação
//    de main frame (Page.frameNavigated com parentId == null)
// As pills do header filtram `allRequests` pelos timestamps:
// "Sessão" usa sessionStartedAt; "Página" usa currentPageNavigatedAt.
//
// Persistido em chrome.storage.local.sessionMarker para sobreviver a
// reload do service worker (MV3 reciclamento).

export interface SessionMarker {
	sessionStartedAt: number | null;
	currentPageUrl: string | null;
	currentPageNavigatedAt: number | null;
}

export const EMPTY_SESSION_MARKER: SessionMarker = {
	sessionStartedAt: null,
	currentPageUrl: null,
	currentPageNavigatedAt: null,
};
```

- [ ] **Step 2: Atualizar `app/src/types/messages.ts`**

Adicione `'getSessionMarker'` e `'sessionMarkerUpdated'` à união `MessageAction`. Adicione `sessionMarker?: SessionMarker` ao `Message` e `MessageResponse`. Importe `SessionMarker` do novo arquivo.

Patch a aplicar (após edição, o arquivo deve ficar):

```ts
// Mensagens trocadas entre background.ts (service worker) e a UI React.
// Esta união é a fonte de verdade — quando adicionar uma nova action,
// edite ESTE arquivo e os dois lados (background + UI) recompilam.

import type { InterceptedResponse, ResponseModifications } from './intercepted';
import type { MockConfig } from './legacy';
import type { SessionMarker } from './sessionMarker';

export type MessageAction =
	| 'startDebugging'
	| 'stopDebugging'
	| 'getDebuggingStatus'
	| 'getPendingResponses'
	| 'getAllRequests'
	| 'clearAllRequests'
	| 'getResponseDetails'
	| 'approveResponse'
	| 'newPendingResponse'
	| 'responseBodyReady'
	| 'newRequest'
	| 'requestUpdated'
	| 'selectTargetTab'
	| 'setTargetTab'
	| 'targetTabSelected'
	| 'openSelectTabDialog'
	| 'getSessionMarker'
	| 'sessionMarkerUpdated';

export interface Message {
	action: MessageAction;
	tabId?: number;
	tabTitle?: string;
	tabUrl?: string;
	requestId?: string;
	url?: string;
	status?: number;
	statusText?: string;
	type?: string;
	mimeType?: string;
	body?: string;
	response?: InterceptedResponse;
	modifications?: ResponseModifications;
	updates?: Partial<InterceptedResponse>;
	sessionMarker?: SessionMarker;
}

export interface MessageResponse {
	success?: boolean;
	error?: string;
	isDebugging?: boolean;
	pendingResponses?: Record<string, InterceptedResponse>;
	allRequests?: Record<string, InterceptedResponse>;
	response?: InterceptedResponse;
	mocks?: MockConfig[];
	sessionMarker?: SessionMarker;
}
```

- [ ] **Step 3: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/sessionMarker.ts app/src/types/messages.ts
git commit -m "feat(types): adiciona SessionMarker e ações getSessionMarker/sessionMarkerUpdated"
```

---

## Task 3: Helper puro `deriveNetworkTiming`

**Files:**
- Modify: `app/src/lib/networkTiming.ts`
- Modify: `app/src/lib/__tests__/networkTiming.test.ts`

- [ ] **Step 1: Escrever testes falhando para `deriveNetworkTiming`**

No final de `app/src/lib/__tests__/networkTiming.test.ts` (após o `describe('NetworkTimingTracker', ...)` existente), adicione um novo bloco:

```ts
import { deriveNetworkTiming } from '../networkTiming';

describe('deriveNetworkTiming', () => {
	it('retorna undefined quando timing e encodedDataLength são ambos ausentes', () => {
		expect(deriveNetworkTiming(undefined, undefined, {})).toBeUndefined();
	});

	it('retorna objeto com transferSize quando só encodedDataLength existe', () => {
		expect(deriveNetworkTiming(undefined, 1234, {})).toEqual({
			transferSize: 1234,
			encodedDataLength: 1234,
		});
	});

	it('retorna objeto com fromDiskCache quando response.fromDiskCache é true', () => {
		expect(deriveNetworkTiming(undefined, undefined, { fromDiskCache: true })).toEqual({
			fromDiskCache: true,
		});
	});

	it('retorna objeto com fromServiceWorker quando response.fromServiceWorker é true', () => {
		expect(deriveNetworkTiming(undefined, undefined, { fromServiceWorker: true })).toEqual({
			fromServiceWorker: true,
		});
	});

	it('calcula dnsMs/tcpMs/tlsMs quando todos os pares existem', () => {
		const timing = {
			dnsStart: 0,
			dnsEnd: 10,
			connectStart: 10,
			connectEnd: 30,
			sslStart: 15,
			sslEnd: 25,
			receiveHeadersEnd: 50,
		};
		const result = deriveNetworkTiming(timing, 2048, {});
		expect(result).toEqual({
			ttfbMs: 50,
			dnsMs: 10,
			tcpMs: 20,
			tlsMs: 10,
			transferSize: 2048,
			encodedDataLength: 2048,
		});
	});

	it('omite tlsMs quando sslStart/sslEnd são -1 (http puro)', () => {
		const timing = {
			dnsStart: 0,
			dnsEnd: 5,
			connectStart: 5,
			connectEnd: 15,
			sslStart: -1,
			sslEnd: -1,
			receiveHeadersEnd: 30,
		};
		const result = deriveNetworkTiming(timing, undefined, {});
		expect(result).toEqual({
			ttfbMs: 30,
			dnsMs: 5,
			tcpMs: 10,
		});
	});

	it('omite dnsMs/tcpMs quando intervalos são negativos (cache resolveu sem rede)', () => {
		const timing = {
			dnsStart: -1,
			dnsEnd: -1,
			connectStart: -1,
			connectEnd: -1,
			sslStart: -1,
			sslEnd: -1,
			receiveHeadersEnd: 5,
		};
		const result = deriveNetworkTiming(timing, undefined, {});
		expect(result).toEqual({});
	});

	it('combina timing com flags fromDiskCache/fromServiceWorker', () => {
		const timing = {
			dnsStart: 0,
			dnsEnd: 1,
			connectStart: 1,
			connectEnd: 2,
			sslStart: -1,
			sslEnd: -1,
			receiveHeadersEnd: 3,
		};
		const result = deriveNetworkTiming(timing, 100, {
			fromDiskCache: false,
			fromServiceWorker: true,
		});
		expect(result).toEqual({
			ttfbMs: 3,
			dnsMs: 1,
			tcpMs: 1,
			transferSize: 100,
			encodedDataLength: 100,
			fromServiceWorker: true,
		});
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/lib/__tests__/networkTiming.test.ts`
Expected: novos testes falham com "deriveNetworkTiming is not a function" ou similar; os antigos passam.

- [ ] **Step 3: Implementar `deriveNetworkTiming` em `app/src/lib/networkTiming.ts`**

No início do arquivo (logo após o comentário de header do arquivo, antes do `interface TimingEntry`), adicione:

```ts
// Forma compacta retornada por `deriveNetworkTiming`. Todos os campos opcionais
// — só vão no objeto quando o dado existe de fato. Regra do projeto: ausência ≠ 0.
export interface NetworkTiming {
	ttfbMs?: number;
	dnsMs?: number;
	tcpMs?: number;
	tlsMs?: number;
	transferSize?: number;
	encodedDataLength?: number;
	fromDiskCache?: boolean;
	fromServiceWorker?: boolean;
}

// Subset do `Network.ResponseReceived.response` que importa para timing.
// Tipado como Record para evitar acoplamento com o tipo grande do CDP.
export interface ResponseTimingRaw {
	dnsStart?: number;
	dnsEnd?: number;
	connectStart?: number;
	connectEnd?: number;
	sslStart?: number;
	sslEnd?: number;
	receiveHeadersEnd?: number;
}

export interface ResponseFlagsRaw {
	fromDiskCache?: boolean;
	fromServiceWorker?: boolean;
}

// Diferença "segura" — retorna o intervalo apenas quando ambos os tempos existem
// e são >= 0. CDP usa -1 para indicar "não houve esta fase" (ex.: sslStart = -1
// em http puro). Fora desse caso, undefined deixa o helper omitir o campo.
function safeDelta(start: number | undefined, end: number | undefined): number | undefined {
	if (start == null || end == null) return undefined;
	if (start < 0 || end < 0) return undefined;
	const delta = Math.round(end - start);
	if (delta < 0) return undefined;
	return delta;
}

export function deriveNetworkTiming(
	timing: ResponseTimingRaw | undefined,
	encodedDataLength: number | undefined,
	flags: ResponseFlagsRaw,
): NetworkTiming | undefined {
	const result: NetworkTiming = {};

	if (timing) {
		const ttfbMs = safeDelta(timing.dnsStart, timing.receiveHeadersEnd);
		if (ttfbMs !== undefined) result.ttfbMs = ttfbMs;
		const dnsMs = safeDelta(timing.dnsStart, timing.dnsEnd);
		if (dnsMs !== undefined) result.dnsMs = dnsMs;
		const tcpMs = safeDelta(timing.connectStart, timing.connectEnd);
		if (tcpMs !== undefined) result.tcpMs = tcpMs;
		const tlsMs = safeDelta(timing.sslStart, timing.sslEnd);
		if (tlsMs !== undefined) result.tlsMs = tlsMs;
	}

	if (encodedDataLength !== undefined) {
		result.transferSize = encodedDataLength;
		result.encodedDataLength = encodedDataLength;
	}

	if (flags.fromDiskCache === true) result.fromDiskCache = true;
	if (flags.fromServiceWorker === true) result.fromServiceWorker = true;

	if (Object.keys(result).length === 0) return undefined;
	return result;
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/lib/__tests__/networkTiming.test.ts`
Expected: todos os testes passam, incluindo os 7 novos.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/networkTiming.ts app/src/lib/__tests__/networkTiming.test.ts
git commit -m "feat(networkTiming): adiciona deriveNetworkTiming helper para timing granular"
```

---

## Task 4: Estender `NetworkTimingTracker` com callback `onMetricsReady`

**Files:**
- Modify: `app/src/lib/networkTiming.ts`
- Modify: `app/src/lib/__tests__/networkTiming.test.ts`

- [ ] **Step 1: Escrever testes falhando para captura de timing/encodedDataLength**

Adicione, dentro do `describe('NetworkTimingTracker', ...)` existente, antes do fim do bloco:

```ts
	it('emite onMetricsReady com timing + encodedDataLength quando ambos existem', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm1', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm1',
			timestamp: 1.1,
			response: {
				timing: {
					dnsStart: 0,
					dnsEnd: 5,
					connectStart: 5,
					connectEnd: 15,
					sslStart: -1,
					sslEnd: -1,
					receiveHeadersEnd: 30,
				},
				fromDiskCache: false,
				fromServiceWorker: false,
			},
		});
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm1',
			timestamp: 1.5,
			encodedDataLength: 4096,
		});
		t.linkFetchId('m1', 'fetch-m1');
		expect(metrics).toEqual([
			{
				fetchId: 'fetch-m1',
				timing: {
					ttfbMs: 30,
					dnsMs: 5,
					tcpMs: 10,
					transferSize: 4096,
					encodedDataLength: 4096,
				},
			},
		]);
	});

	it('não emite onMetricsReady quando nem timing nem encodedDataLength existem', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm2', timestamp: 1.0 });
		t.handleNetworkEvent('Network.loadingFinished', { requestId: 'm2', timestamp: 1.5 });
		t.linkFetchId('m2', 'fetch-m2');
		expect(metrics).toEqual([]);
	});

	it('emite onMetricsReady só com flags quando timing/encodedDataLength faltam mas fromDiskCache=true', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm3', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm3',
			timestamp: 1.05,
			response: { fromDiskCache: true },
		});
		t.handleNetworkEvent('Network.loadingFinished', { requestId: 'm3', timestamp: 1.05 });
		t.linkFetchId('m3', 'fetch-m3');
		expect(metrics).toEqual([{ fetchId: 'fetch-m3', timing: { fromDiskCache: true } }]);
	});

	it('emite onMetricsReady idempotente (uma vez por fetchId)', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm4', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm4',
			timestamp: 1.1,
			response: { timing: { dnsStart: 0, dnsEnd: 1, connectStart: 1, connectEnd: 2, sslStart: -1, sslEnd: -1, receiveHeadersEnd: 5 } },
		});
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm4',
			timestamp: 1.2,
			encodedDataLength: 100,
		});
		t.linkFetchId('m4', 'fetch-m4');
		// loadingFinished + linkFetchId já dispararam — qualquer evento adicional não deve duplicar.
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm4',
			timestamp: 1.3,
			encodedDataLength: 999,
		});
		expect(metrics).toHaveLength(1);
	});

	it('loadingFailed descarta entrada antes de emitir métricas', () => {
		const metrics: Array<{ fetchId: string; timing: unknown }> = [];
		const t = new NetworkTimingTracker(
			() => {},
			(fetchId, timing) => metrics.push({ fetchId, timing }),
		);
		t.handleNetworkEvent('Network.requestWillBeSent', { requestId: 'm5', timestamp: 1.0 });
		t.handleNetworkEvent('Network.responseReceived', {
			requestId: 'm5',
			timestamp: 1.1,
			response: { fromDiskCache: true },
		});
		t.handleNetworkEvent('Network.loadingFailed', { requestId: 'm5' });
		t.linkFetchId('m5', 'fetch-m5');
		t.handleNetworkEvent('Network.loadingFinished', {
			requestId: 'm5',
			timestamp: 1.5,
			encodedDataLength: 100,
		});
		expect(metrics).toEqual([]);
	});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/lib/__tests__/networkTiming.test.ts`
Expected: 5 testes novos falham (construtor não aceita 2º arg, ou `metrics` fica vazio).

- [ ] **Step 3: Estender `NetworkTimingTracker`**

Substitua o conteúdo de `app/src/lib/networkTiming.ts` pela versão abaixo (mantém a parte do helper `deriveNetworkTiming` e tipos da Task 3 — apenas estende a classe):

```ts
// Captura tempos de cada requisição via Network domain do Chrome DevTools Protocol
// e correlaciona com o `fetchRequestId` do Fetch.requestPaused.
//
// O `Fetch.requestPaused` (Response stage) chega antes do `Network.responseReceived`/
// `loadingFinished` na maioria dos casos — então não dá pra ler duration de forma
// síncrona. Esta classe acumula start/end conforme chegam, em qualquer ordem, e
// dispara `onDurationReady` assim que `start`, `end` e `fetchRequestId` estão
// disponíveis. Idempotente: cada requisição emite no máximo uma vez.
//
// O segundo callback opcional, `onMetricsReady`, recebe métricas granulares Google
// (TTFB/DNS/TCP/TLS/transferSize/cache) derivadas de `Network.responseReceived.timing`
// e `Network.loadingFinished.encodedDataLength`. Também idempotente, também 1× por request.

// Forma compacta retornada por `deriveNetworkTiming`. Todos os campos opcionais
// — só vão no objeto quando o dado existe de fato. Regra do projeto: ausência ≠ 0.
export interface NetworkTiming {
	ttfbMs?: number;
	dnsMs?: number;
	tcpMs?: number;
	tlsMs?: number;
	transferSize?: number;
	encodedDataLength?: number;
	fromDiskCache?: boolean;
	fromServiceWorker?: boolean;
}

export interface ResponseTimingRaw {
	dnsStart?: number;
	dnsEnd?: number;
	connectStart?: number;
	connectEnd?: number;
	sslStart?: number;
	sslEnd?: number;
	receiveHeadersEnd?: number;
}

export interface ResponseFlagsRaw {
	fromDiskCache?: boolean;
	fromServiceWorker?: boolean;
}

function safeDelta(start: number | undefined, end: number | undefined): number | undefined {
	if (start == null || end == null) return undefined;
	if (start < 0 || end < 0) return undefined;
	const delta = Math.round(end - start);
	if (delta < 0) return undefined;
	return delta;
}

export function deriveNetworkTiming(
	timing: ResponseTimingRaw | undefined,
	encodedDataLength: number | undefined,
	flags: ResponseFlagsRaw,
): NetworkTiming | undefined {
	const result: NetworkTiming = {};

	if (timing) {
		const ttfbMs = safeDelta(timing.dnsStart, timing.receiveHeadersEnd);
		if (ttfbMs !== undefined) result.ttfbMs = ttfbMs;
		const dnsMs = safeDelta(timing.dnsStart, timing.dnsEnd);
		if (dnsMs !== undefined) result.dnsMs = dnsMs;
		const tcpMs = safeDelta(timing.connectStart, timing.connectEnd);
		if (tcpMs !== undefined) result.tcpMs = tcpMs;
		const tlsMs = safeDelta(timing.sslStart, timing.sslEnd);
		if (tlsMs !== undefined) result.tlsMs = tlsMs;
	}

	if (encodedDataLength !== undefined) {
		result.transferSize = encodedDataLength;
		result.encodedDataLength = encodedDataLength;
	}

	if (flags.fromDiskCache === true) result.fromDiskCache = true;
	if (flags.fromServiceWorker === true) result.fromServiceWorker = true;

	if (Object.keys(result).length === 0) return undefined;
	return result;
}

interface TimingEntry {
	start?: number;
	end?: number;
	fetchRequestId?: string;
	durationEmitted?: boolean;
	metricsEmitted?: boolean;
	loadingFinishedFlag?: boolean;
	responseReceivedFlag?: boolean;
	responseTiming?: ResponseTimingRaw;
	encodedDataLength?: number;
	flags?: ResponseFlagsRaw;
}

const NETWORK_EVENTS = new Set([
	'Network.requestWillBeSent',
	'Network.responseReceived',
	'Network.loadingFinished',
	'Network.loadingFailed',
]);

const MAX_ENTRIES = 2000;

export class NetworkTimingTracker {
	private entries = new Map<string, TimingEntry>();
	private readonly onDurationReady: (fetchRequestId: string, durationMs: number) => void;
	private readonly onMetricsReady?: (fetchRequestId: string, timing: NetworkTiming) => void;

	constructor(
		onDurationReady: (fetchRequestId: string, durationMs: number) => void,
		onMetricsReady?: (fetchRequestId: string, timing: NetworkTiming) => void,
	) {
		this.onDurationReady = onDurationReady;
		this.onMetricsReady = onMetricsReady;
	}

	handleNetworkEvent(
		message: string,
		params: {
			requestId?: string;
			timestamp?: number;
			redirectResponse?: unknown;
			response?: { timing?: ResponseTimingRaw; fromDiskCache?: boolean; fromServiceWorker?: boolean };
			encodedDataLength?: number;
		},
	): void {
		if (!NETWORK_EVENTS.has(message)) return;
		const networkId = params.requestId;
		if (!networkId) return;
		const ts = (params.timestamp ?? 0) * 1000;

		switch (message) {
			case 'Network.requestWillBeSent':
				if (params.redirectResponse) {
					this.handleRedirect(networkId, ts);
				} else {
					this.recordStart(networkId, ts);
				}
				break;
			case 'Network.responseReceived': {
				this.recordEnd(networkId, ts, false);
				const entry = this.entries.get(networkId);
				if (entry) {
					entry.responseReceivedFlag = true;
					if (params.response?.timing) entry.responseTiming = params.response.timing;
					entry.flags = {
						fromDiskCache: params.response?.fromDiskCache,
						fromServiceWorker: params.response?.fromServiceWorker,
					};
					this.tryEmit(networkId);
				}
				break;
			}
			case 'Network.loadingFinished': {
				this.recordEnd(networkId, ts, true);
				const entry = this.entries.get(networkId);
				if (entry) {
					entry.loadingFinishedFlag = true;
					if (params.encodedDataLength !== undefined) {
						entry.encodedDataLength = params.encodedDataLength;
					}
					this.tryEmit(networkId);
				}
				break;
			}
			case 'Network.loadingFailed':
				this.discardByNetworkId(networkId);
				break;
		}
	}

	private handleRedirect(networkId: string, redirectTs: number): void {
		const entry = this.entries.get(networkId);
		if (entry?.start != null && entry.fetchRequestId && !entry.durationEmitted) {
			const duration = Math.max(0, Math.round(redirectTs - entry.start));
			this.onDurationReady(entry.fetchRequestId, duration);
		}
		this.set(networkId, { start: redirectTs });
	}

	linkFetchId(networkId: string | undefined, fetchRequestId: string): void {
		if (!networkId) return;
		const entry = this.entries.get(networkId) ?? {};
		entry.fetchRequestId = fetchRequestId;
		this.set(networkId, entry);
		this.tryEmit(networkId);
	}

	discardByNetworkId(networkId: string | undefined): void {
		if (!networkId) return;
		this.entries.delete(networkId);
	}

	reset(): void {
		this.entries.clear();
	}

	private recordStart(networkId: string, startMs: number): void {
		const entry = this.entries.get(networkId) ?? {};
		entry.start = startMs;
		this.set(networkId, entry);
		this.tryEmit(networkId);
	}

	private recordEnd(networkId: string, endMs: number, overwrite: boolean): void {
		const entry = this.entries.get(networkId);
		if (!entry) return;
		if (!overwrite && entry.end != null) return;
		entry.end = endMs;
	}

	private tryEmit(networkId: string): void {
		const entry = this.entries.get(networkId);
		if (!entry) return;

		// Duration: precisa de start + end + fetchId
		if (
			!entry.durationEmitted &&
			entry.start != null &&
			entry.end != null &&
			entry.fetchRequestId
		) {
			const duration = Math.max(0, Math.round(entry.end - entry.start));
			entry.durationEmitted = true;
			this.onDurationReady(entry.fetchRequestId, duration);
		}

		// Métricas: emitidas após loadingFinished (garante encodedDataLength oportunidade) e fetchId
		if (
			this.onMetricsReady &&
			!entry.metricsEmitted &&
			entry.loadingFinishedFlag &&
			entry.fetchRequestId
		) {
			const timing = deriveNetworkTiming(
				entry.responseTiming,
				entry.encodedDataLength,
				entry.flags ?? {},
			);
			entry.metricsEmitted = true;
			if (timing) this.onMetricsReady(entry.fetchRequestId, timing);
		}

		// Limpa quando ambos os ciclos foram concluídos (ou quando metrics não está em uso)
		const metricsDone = !this.onMetricsReady || entry.metricsEmitted;
		if (entry.durationEmitted && metricsDone) {
			this.entries.delete(networkId);
		}
	}

	private set(networkId: string, entry: TimingEntry): void {
		if (this.entries.size >= MAX_ENTRIES && !this.entries.has(networkId)) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		this.entries.set(networkId, entry);
	}
}
```

**Note importante:** os testes existentes passam `tracker.handleNetworkEvent('Network.responseReceived', { requestId: 'n3', timestamp: 1.1 })` sem `response`. A nova lógica acessa `params.response?.timing` com optional chaining — não quebra. Os flags `responseReceivedFlag` ficam `true` mas `responseTiming` fica `undefined`, e como o callback `onMetricsReady` é opcional (não passado nos testes antigos), o caminho de métricas é skipado. Os testes antigos continuam verdes.

- [ ] **Step 4: Rodar todos os testes do networkTiming**

Run: `cd app && npx vitest run src/lib/__tests__/networkTiming.test.ts`
Expected: todos passam (antigos + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/networkTiming.ts app/src/lib/__tests__/networkTiming.test.ts
git commit -m "feat(networkTiming): emite onMetricsReady com timing granular Google"
```

---

## Task 5: `aggregateRequests` puro

**Files:**
- Create: `app/src/lib/networkMetrics.ts`
- Create: `app/src/lib/__tests__/networkMetrics.test.ts`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/lib/__tests__/networkMetrics.test.ts`:

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import {
	SLOW_THRESHOLD_MS,
	aggregateRequests,
	filterByCurrentPage,
	filterBySession,
} from '../networkMetrics';

function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1000,
		...overrides,
	};
}

describe('aggregateRequests', () => {
	it('retorna zeros e nulls para lista vazia', () => {
		expect(aggregateRequests([])).toEqual({
			totalRequests: 0,
			totalBytes: null,
			avgTtfbMs: null,
			slowCount: 0,
			failedCount: 0,
		});
	});

	it('soma totalBytes só de requests com networkTiming.transferSize', () => {
		const requests = [
			req({ networkTiming: { transferSize: 1000 } }),
			req({ networkTiming: { transferSize: 2500 } }),
			req({}), // sem networkTiming → ignorada na soma
		];
		expect(aggregateRequests(requests)).toMatchObject({
			totalRequests: 3,
			totalBytes: 3500,
		});
	});

	it('totalBytes é null quando nenhuma request tem transferSize', () => {
		const requests = [req({ networkTiming: { fromDiskCache: true } }), req({})];
		expect(aggregateRequests(requests).totalBytes).toBeNull();
	});

	it('avgTtfbMs é média sobre requests com ttfbMs definido', () => {
		const requests = [
			req({ networkTiming: { ttfbMs: 100 } }),
			req({ networkTiming: { ttfbMs: 300 } }),
			req({}),
		];
		expect(aggregateRequests(requests).avgTtfbMs).toBe(200);
	});

	it('avgTtfbMs é null quando nenhuma request tem ttfbMs', () => {
		const requests = [req({ networkTiming: { transferSize: 100 } }), req({})];
		expect(aggregateRequests(requests).avgTtfbMs).toBeNull();
	});

	it('slowCount conta apenas duration > SLOW_THRESHOLD_MS', () => {
		const requests = [
			req({ duration: 999 }),
			req({ duration: 1000 }), // borda inclusiva → NÃO conta como lenta
			req({ duration: 1001 }),
			req({ duration: 5000 }),
			req({}), // sem duration → não conta nem como rápida nem como lenta
		];
		expect(aggregateRequests(requests).slowCount).toBe(2);
	});

	it('failedCount conta status >= 400 OU captureError não-vazio', () => {
		const requests = [
			req({ status: 200 }),
			req({ status: 304 }),
			req({ status: 400 }),
			req({ status: 500 }),
			req({ status: 200, captureError: 'oops' }),
		];
		expect(aggregateRequests(requests).failedCount).toBe(3);
	});

	it('SLOW_THRESHOLD_MS é 1000', () => {
		expect(SLOW_THRESHOLD_MS).toBe(1000);
	});
});

describe('filterBySession', () => {
	it('retorna lista vazia quando sessionStartedAt é null', () => {
		const all = { a: req({ timestamp: 100 }), b: req({ timestamp: 200 }) };
		expect(filterBySession(all, null)).toEqual([]);
	});

	it('retorna requests com timestamp >= sessionStartedAt', () => {
		const all = {
			a: req({ timestamp: 100 }),
			b: req({ timestamp: 500 }),
			c: req({ timestamp: 999 }),
		};
		const result = filterBySession(all, 500);
		expect(result.map((r) => r.timestamp).sort()).toEqual([500, 999]);
	});
});

describe('filterByCurrentPage', () => {
	it('retorna lista vazia quando currentPageNavigatedAt é null', () => {
		const all = { a: req({ timestamp: 100 }) };
		expect(filterByCurrentPage(all, null)).toEqual([]);
	});

	it('retorna requests com timestamp >= currentPageNavigatedAt', () => {
		const all = {
			a: req({ timestamp: 100 }),
			b: req({ timestamp: 500 }),
		};
		const result = filterByCurrentPage(all, 500);
		expect(result.map((r) => r.timestamp)).toEqual([500]);
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/lib/__tests__/networkMetrics.test.ts`
Expected: erro "Cannot find module '../networkMetrics'".

- [ ] **Step 3: Implementar `app/src/lib/networkMetrics.ts`**

```ts
// Funções puras de agregação para o NetworkMetricsBar do header.
// O hook `useNetworkMetrics` consome estas funções; o background não usa.
//
// Regra do projeto (no-fallback): quando uma métrica depende de dados
// que podem estar ausentes (ttfbMs, transferSize), retornamos `null` ao
// invés de `0` para a UI distinguir "nenhum dado" de "tudo zerado".

import type { InterceptedResponse } from '@/types/intercepted';

export const SLOW_THRESHOLD_MS = 1000;

export interface MetricsAggregate {
	totalRequests: number;
	totalBytes: number | null;
	avgTtfbMs: number | null;
	slowCount: number;
	failedCount: number;
}

export function aggregateRequests(requests: InterceptedResponse[]): MetricsAggregate {
	let totalBytes: number | null = null;
	let ttfbSum = 0;
	let ttfbCount = 0;
	let slowCount = 0;
	let failedCount = 0;

	for (const r of requests) {
		const transferSize = r.networkTiming?.transferSize;
		if (typeof transferSize === 'number') {
			totalBytes = (totalBytes ?? 0) + transferSize;
		}
		const ttfbMs = r.networkTiming?.ttfbMs;
		if (typeof ttfbMs === 'number') {
			ttfbSum += ttfbMs;
			ttfbCount += 1;
		}
		if (typeof r.duration === 'number' && r.duration > SLOW_THRESHOLD_MS) slowCount += 1;
		if ((typeof r.status === 'number' && r.status >= 400) || r.captureError) failedCount += 1;
	}

	const avgTtfbMs = ttfbCount === 0 ? null : Math.round(ttfbSum / ttfbCount);

	return {
		totalRequests: requests.length,
		totalBytes,
		avgTtfbMs,
		slowCount,
		failedCount,
	};
}

export function filterBySession(
	requests: Record<string, InterceptedResponse>,
	sessionStartedAt: number | null,
): InterceptedResponse[] {
	if (sessionStartedAt == null) return [];
	const out: InterceptedResponse[] = [];
	for (const r of Object.values(requests)) {
		if (r && typeof r.timestamp === 'number' && r.timestamp >= sessionStartedAt) out.push(r);
	}
	return out;
}

export function filterByCurrentPage(
	requests: Record<string, InterceptedResponse>,
	currentPageNavigatedAt: number | null,
): InterceptedResponse[] {
	if (currentPageNavigatedAt == null) return [];
	const out: InterceptedResponse[] = [];
	for (const r of Object.values(requests)) {
		if (r && typeof r.timestamp === 'number' && r.timestamp >= currentPageNavigatedAt) out.push(r);
	}
	return out;
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/lib/__tests__/networkMetrics.test.ts`
Expected: todos os 11 testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/networkMetrics.ts app/src/lib/__tests__/networkMetrics.test.ts
git commit -m "feat(networkMetrics): adiciona agregação pura para pills do header"
```

---

## Task 6: Formatadores `formatBytes` / `formatMs` / `formatCount`

**Files:**
- Create: `app/src/components/layout/networkMetricsFormat.ts`
- Create: `app/src/components/layout/__tests__/networkMetricsFormat.test.ts`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/components/layout/__tests__/networkMetricsFormat.test.ts`:

```ts
import { formatBytes, formatCount, formatMs } from '../networkMetricsFormat';

describe('formatBytes', () => {
	it('retorna "—" para null', () => {
		expect(formatBytes(null)).toBe('—');
	});

	it('formata bytes (< 1024) como número simples + " B"', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1023)).toBe('1023 B');
	});

	it('formata KB com 1 casa decimal', () => {
		expect(formatBytes(1024)).toBe('1.0 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1024 * 999)).toBe('999.0 KB');
	});

	it('formata MB com 1 casa decimal', () => {
		expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
		expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
	});

	it('formata GB com 1 casa decimal', () => {
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
		expect(formatBytes(1024 * 1024 * 1024 * 3)).toBe('3.0 GB');
	});
});

describe('formatMs', () => {
	it('retorna "—" para null', () => {
		expect(formatMs(null)).toBe('—');
	});

	it('formata < 1000 como "N ms"', () => {
		expect(formatMs(0)).toBe('0 ms');
		expect(formatMs(245)).toBe('245 ms');
		expect(formatMs(999)).toBe('999 ms');
	});

	it('formata >= 1000 como "N.N s"', () => {
		expect(formatMs(1000)).toBe('1.0 s');
		expect(formatMs(1500)).toBe('1.5 s');
		expect(formatMs(12345)).toBe('12.3 s');
	});
});

describe('formatCount', () => {
	it('formata números simples', () => {
		expect(formatCount(0)).toBe('0');
		expect(formatCount(47)).toBe('47');
		expect(formatCount(1234)).toBe('1234');
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/components/layout/__tests__/networkMetricsFormat.test.ts`
Expected: erro "Cannot find module '../networkMetricsFormat'".

- [ ] **Step 3: Implementar `app/src/components/layout/networkMetricsFormat.ts`**

```ts
// Formatadores compactos para as pills do NetworkMetricsBar.
// Regra do projeto: ausência de dado é "—", nunca "0" enganoso.

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function formatBytes(value: number | null): string {
	if (value == null) return '—';
	if (value < KB) return `${value} B`;
	if (value < MB) return `${(value / KB).toFixed(1)} KB`;
	if (value < GB) return `${(value / MB).toFixed(1)} MB`;
	return `${(value / GB).toFixed(1)} GB`;
}

export function formatMs(value: number | null): string {
	if (value == null) return '—';
	if (value < 1000) return `${value} ms`;
	return `${(value / 1000).toFixed(1)} s`;
}

export function formatCount(value: number): string {
	return String(value);
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/components/layout/__tests__/networkMetricsFormat.test.ts`
Expected: 9 testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/networkMetricsFormat.ts app/src/components/layout/__tests__/networkMetricsFormat.test.ts
git commit -m "feat(format): formatadores formatBytes/formatMs/formatCount"
```

---

## Task 7: Hook `useSessionMarker`

**Files:**
- Create: `app/src/hooks/useSessionMarker.ts`
- Create: `app/src/hooks/__tests__/useSessionMarker.test.tsx`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/hooks/__tests__/useSessionMarker.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { SessionMarker } from '@/types/sessionMarker';
import { useSessionMarker } from '../useSessionMarker';

describe('useSessionMarker', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('retorna marker zerado inicialmente e busca via getSessionMarker', async () => {
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://example.com',
			currentPageNavigatedAt: 1500,
		};
		(chrome.runtime.sendMessage as any).mockResolvedValueOnce({ sessionMarker: marker });

		const { result } = renderHook(() => useSessionMarker());

		expect(result.current).toEqual({
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		});

		await waitFor(() => {
			expect(result.current).toEqual(marker);
		});

		expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getSessionMarker' });
	});

	it('atualiza quando sessionMarkerUpdated chega', async () => {
		const initial: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		(chrome.runtime.sendMessage as any).mockResolvedValueOnce({ sessionMarker: initial });

		let listener: ((msg: any) => void) | undefined;
		(chrome.runtime.onMessage.addListener as any).mockImplementationOnce((fn: any) => {
			listener = fn;
		});

		const { result } = renderHook(() => useSessionMarker());
		await waitFor(() => expect(result.current).toEqual(initial));

		const updated: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://test.com',
			currentPageNavigatedAt: 2000,
		};
		listener?.({ action: 'sessionMarkerUpdated', sessionMarker: updated });

		await waitFor(() => expect(result.current).toEqual(updated));
	});

	it('mantém marker zerado quando getSessionMarker falha', async () => {
		(chrome.runtime.sendMessage as any).mockRejectedValueOnce(new Error('boom'));
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { result } = renderHook(() => useSessionMarker());
		await waitFor(() => expect(errSpy).toHaveBeenCalled());

		expect(result.current).toEqual({
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		});

		errSpy.mockRestore();
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/hooks/__tests__/useSessionMarker.test.tsx`
Expected: "Cannot find module '../useSessionMarker'".

- [ ] **Step 3: Implementar `app/src/hooks/useSessionMarker.ts`**

```ts
import { useEffect, useState } from 'react';
import { type SessionMarker, EMPTY_SESSION_MARKER } from '@/types/sessionMarker';

// Lê o SessionMarker mantido pelo background. Mesmo padrão de useDebugging:
// busca inicial via sendMessage('getSessionMarker') + listener para
// 'sessionMarkerUpdated' que o background broadcasta em start/stop/navegação/clear.

export function useSessionMarker(): SessionMarker {
	const [marker, setMarker] = useState<SessionMarker>(EMPTY_SESSION_MARKER);

	useEffect(() => {
		let cancelled = false;
		chrome.runtime
			.sendMessage({ action: 'getSessionMarker' })
			.then((response) => {
				if (cancelled) return;
				if (response?.sessionMarker) setMarker(response.sessionMarker);
			})
			.catch((error) => {
				console.error('Erro ao buscar SessionMarker:', error);
			});

		const messageListener = (message: any) => {
			if (message?.action === 'sessionMarkerUpdated' && message.sessionMarker) {
				setMarker(message.sessionMarker);
			}
		};
		chrome.runtime.onMessage.addListener(messageListener);

		return () => {
			cancelled = true;
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, []);

	return marker;
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/hooks/__tests__/useSessionMarker.test.tsx`
Expected: 3 testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useSessionMarker.ts app/src/hooks/__tests__/useSessionMarker.test.tsx
git commit -m "feat(hooks): adiciona useSessionMarker para ler marker do background"
```

---

## Task 8: Hook `useNetworkMetrics`

**Files:**
- Create: `app/src/hooks/useNetworkMetrics.ts`
- Create: `app/src/hooks/__tests__/useNetworkMetrics.test.tsx`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/hooks/__tests__/useNetworkMetrics.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';
import { useNetworkMetrics } from '../useNetworkMetrics';

function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1000,
		...overrides,
	};
}

describe('useNetworkMetrics', () => {
	it('retorna agregados zerados quando marker está vazio', () => {
		const all: Record<string, InterceptedResponse> = {};
		const marker: SessionMarker = {
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session.totalRequests).toBe(0);
		expect(result.current.currentPage.totalRequests).toBe(0);
	});

	it('agrega só requests da janela "Sessão" quando sessionStartedAt está setado', () => {
		const all = {
			old: req({ timestamp: 100 }),
			a: req({ timestamp: 1000, networkTiming: { transferSize: 500 } }),
			b: req({ timestamp: 2000, networkTiming: { transferSize: 1500 } }),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session).toMatchObject({ totalRequests: 2, totalBytes: 2000 });
		expect(result.current.currentPage.totalRequests).toBe(0);
	});

	it('agrega "Página atual" usando currentPageNavigatedAt', () => {
		const all = {
			a: req({ timestamp: 1000 }),
			b: req({ timestamp: 2500, status: 500 }),
			c: req({ timestamp: 3000 }),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://x.com',
			currentPageNavigatedAt: 2500,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.currentPage).toMatchObject({ totalRequests: 2, failedCount: 1 });
		expect(result.current.session.totalRequests).toBe(3);
	});

	it('memoiza: mesma referência de input retorna mesmo objeto', () => {
		const all = { a: req({ timestamp: 1500 }) };
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result, rerender } = renderHook(({ all, marker }) => useNetworkMetrics(all, marker), {
			initialProps: { all, marker },
		});
		const first = result.current;
		rerender({ all, marker });
		expect(result.current).toBe(first);
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/hooks/__tests__/useNetworkMetrics.test.tsx`
Expected: "Cannot find module '../useNetworkMetrics'".

- [ ] **Step 3: Implementar `app/src/hooks/useNetworkMetrics.ts`**

```ts
import { useMemo } from 'react';
import {
	type MetricsAggregate,
	aggregateRequests,
	filterByCurrentPage,
	filterBySession,
} from '@/lib/networkMetrics';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';

// Hook puro: derivado de allRequests + sessionMarker. Memoizado para evitar
// agregar a cada render — só recompõe quando uma das duas referências muda.

export interface NetworkMetricsResult {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
}

export function useNetworkMetrics(
	allRequests: Record<string, InterceptedResponse>,
	sessionMarker: SessionMarker,
): NetworkMetricsResult {
	return useMemo(() => {
		const session = aggregateRequests(filterBySession(allRequests, sessionMarker.sessionStartedAt));
		const currentPage = aggregateRequests(
			filterByCurrentPage(allRequests, sessionMarker.currentPageNavigatedAt),
		);
		return { session, currentPage };
	}, [allRequests, sessionMarker]);
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/hooks/__tests__/useNetworkMetrics.test.tsx`
Expected: 4 testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useNetworkMetrics.ts app/src/hooks/__tests__/useNetworkMetrics.test.tsx
git commit -m "feat(hooks): adiciona useNetworkMetrics memoizado"
```

---

## Task 9: Componente `NetworkMetricsBar`

**Files:**
- Create: `app/src/components/layout/NetworkMetricsBar.tsx`
- Create: `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { NetworkMetricsBar } from '../NetworkMetricsBar';

function agg(overrides: Partial<MetricsAggregate> = {}): MetricsAggregate {
	return {
		totalRequests: 0,
		totalBytes: null,
		avgTtfbMs: null,
		slowCount: 0,
		failedCount: 0,
		...overrides,
	};
}

describe('NetworkMetricsBar', () => {
	it('mostra placeholder quando totalRequests da aba ativa é 0', () => {
		render(
			<NetworkMetricsBar
				session={agg()}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={false}
			/>,
		);
		expect(screen.getByText(/sem requests/i)).toBeInTheDocument();
	});

	it('renderiza as 5 pills da Sessão por padrão', () => {
		render(
			<NetworkMetricsBar
				session={agg({
					totalRequests: 47,
					totalBytes: 1024 * 1024 * 1.2,
					avgTtfbMs: 245,
					slowCount: 3,
					failedCount: 1,
				})}
				currentPage={agg()}
				hasCurrentPage={true}
				isDebugging={true}
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		expect(screen.getByText('1.2 MB')).toBeInTheDocument();
		expect(screen.getByText('245 ms')).toBeInTheDocument();
		// pills "lentas" e "falhas" mostram o número
		expect(screen.getAllByText('3').length).toBeGreaterThan(0);
		expect(screen.getAllByText('1').length).toBeGreaterThan(0);
	});

	it('alterna para janela "Página atual" ao clicar na tab', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 47 })}
				currentPage={agg({ totalRequests: 12 })}
				hasCurrentPage={true}
				isDebugging={true}
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('tab', { name: /página/i }));
		expect(screen.getByText('12')).toBeInTheDocument();
	});

	it('desabilita tab "Página" quando hasCurrentPage é false', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
			/>,
		);
		const pageTab = screen.getByRole('tab', { name: /página/i });
		expect(pageTab).toBeDisabled();
	});

	it('aplica classe de cor de aviso quando slowCount > 0', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 2 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
			/>,
		);
		const slowPill = container.querySelector('[data-pill="slow"]');
		expect(slowPill?.className).toMatch(/text-amber/);
	});

	it('aplica classe destrutiva quando failedCount > 0', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, failedCount: 1 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
			/>,
		);
		const failPill = container.querySelector('[data-pill="failed"]');
		expect(failPill?.className).toMatch(/text-destructive/);
	});

	it('renderiza "—" para totalBytes/avgTtfbMs nulls', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, totalBytes: null, avgTtfbMs: null })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
			/>,
		);
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/components/layout/__tests__/NetworkMetricsBar.test.tsx`
Expected: erro "Cannot find module '../NetworkMetricsBar'".

- [ ] **Step 3: Implementar `app/src/components/layout/NetworkMetricsBar.tsx`**

```tsx
import { useState } from 'react';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { formatBytes, formatCount, formatMs } from './networkMetricsFormat';

interface NetworkMetricsBarProps {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	hasCurrentPage: boolean;
	isDebugging: boolean;
}

type Window = 'session' | 'page';

export function NetworkMetricsBar({
	session,
	currentPage,
	hasCurrentPage,
	isDebugging: _isDebugging,
}: NetworkMetricsBarProps) {
	const [window, setWindow] = useState<Window>('session');
	const active = window === 'session' ? session : currentPage;

	return (
		<div className="flex min-w-0 flex-shrink items-center gap-2 overflow-hidden">
			<Tabs value={window} onValueChange={(v) => setWindow(v as Window)}>
				<TabsList className="h-7">
					<TabsTrigger value="session" className="px-2 text-xs">
						Sessão
					</TabsTrigger>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<TabsTrigger
										value="page"
										className="px-2 text-xs"
										disabled={!hasCurrentPage}
									>
										Página
									</TabsTrigger>
								</span>
							</TooltipTrigger>
							{!hasCurrentPage && (
								<TooltipContent side="bottom">
									Aguardando navegação na aba alvo
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				</TabsList>
			</Tabs>

			{active.totalRequests === 0 ? (
				<span className="text-xs text-muted-foreground">Sem requests ainda</span>
			) : (
				<div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
					<Pill icon="bar-chart" label="Total requests" name="total">
						{formatCount(active.totalRequests)}
					</Pill>
					<Pill icon="download" label="Total baixado" name="bytes">
						{formatBytes(active.totalBytes)}
					</Pill>
					<Pill icon="zap" label="TTFB médio" name="ttfb">
						{formatMs(active.avgTtfbMs)}
					</Pill>
					<Pill
						icon="turtle"
						label="Requests lentas (> 1s)"
						name="slow"
						accent={active.slowCount > 0 ? 'warn' : undefined}
					>
						{formatCount(active.slowCount)}
					</Pill>
					<Pill
						icon="alert-triangle"
						label="Falhas (4xx/5xx)"
						name="failed"
						accent={active.failedCount > 0 ? 'danger' : undefined}
					>
						{formatCount(active.failedCount)}
					</Pill>
				</div>
			)}
		</div>
	);
}

interface PillProps {
	icon: string;
	label: string;
	name: string;
	accent?: 'warn' | 'danger';
	children: React.ReactNode;
}

function Pill({ icon, label, name, accent, children }: PillProps) {
	const accentClass =
		accent === 'warn'
			? 'text-amber-500'
			: accent === 'danger'
				? 'text-destructive'
				: 'text-foreground';
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						data-pill={name}
						className={`flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs ${accentClass}`}
					>
						<LucideIcon name={icon as never} className="h-3.5 w-3.5" />
						<span>{children}</span>
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom">{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
```

**Nota sobre os ícones:** o componente `LucideIcon` aceita um `name` tipado pela união `LucideIconName`. Verifique se `bar-chart`, `download`, `zap`, `turtle`, `alert-triangle` estão na união em `app/src/components/ui/lucide-icon.tsx`. Se algum não estiver, adicione-o lá nesta task antes de rodar os testes (ou substitua por um equivalente já registrado: `chart-bar`, `arrow-down-to-line`, `lightning`, `slow`, `triangle-alert`). O cast `as never` no JSX é o degrau de escape se `LucideIconName` não tiver o ícone — preferível adicionar à união, e remover o cast.

- [ ] **Step 4: Garantir que todos os ícones existem na união `LucideIconName`**

Run: `grep -E "bar-chart|download|zap|turtle|alert-triangle" app/src/components/ui/lucide-icon.tsx`
Expected: cada um aparece (ou aparece um equivalente).

Se algum não existir, edite `app/src/components/ui/lucide-icon.tsx` adicionando o nome à união e ao mapa de ícones. Depois remova o `as never` do componente Pill.

- [ ] **Step 5: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/components/layout/__tests__/NetworkMetricsBar.test.tsx`
Expected: 7 testes passam.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/layout/NetworkMetricsBar.tsx app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx app/src/components/ui/lucide-icon.tsx
git commit -m "feat(layout): adiciona NetworkMetricsBar com Tabs Sessão/Página"
```

---

## Task 10: Background — estado `sessionMarker` + handler `getSessionMarker`

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Adicionar import do tipo + variável global + persistência**

Em `app/src/entrypoints/background.ts`, adicione o import na seção de imports do topo (junto com os outros `@/types`):

```ts
import type { SessionMarker } from '@/types/sessionMarker';
import { EMPTY_SESSION_MARKER } from '@/types/sessionMarker';
```

Logo após a declaração de `let targetTabUrl = '';` (perto da linha 35), adicione:

```ts
let sessionMarker: SessionMarker = { ...EMPTY_SESSION_MARKER };

function broadcastSessionMarker(): void {
	broadcastToUI('sessionMarkerUpdated', { sessionMarker });
}

async function persistSessionMarker(): Promise<void> {
	try {
		await chrome.storage.local.set({ sessionMarker });
	} catch (err) {
		console.error('Erro ao persistir sessionMarker:', err);
	}
}

async function loadSessionMarker(): Promise<void> {
	try {
		const result = await chrome.storage.local.get(['sessionMarker']);
		if (result.sessionMarker) {
			sessionMarker = result.sessionMarker;
		}
	} catch (err) {
		console.error('Erro ao carregar sessionMarker:', err);
	}
}
```

- [ ] **Step 2: Carregar marker no boot do service worker**

Encontre o bloco `chrome.storage.local.get(['targetTabInfo'], (result) => { ... });` (perto da linha 107). **Logo abaixo desse bloco**, adicione:

```ts
loadSessionMarker();
```

- [ ] **Step 3: Adicionar handler `getSessionMarker` no `onMessage`**

Localize o `else if (message.action === 'clearAllRequests')` (linha 262). **Logo após o fechamento desse `else if`** (depois do `return true;` da resposta assíncrona), adicione um novo bloco antes do próximo `else if`:

```ts
			} else if (message.action === 'getSessionMarker') {
				sendResponse({ sessionMarker });
				return false;
```

- [ ] **Step 4: Resetar marker em `clearAllRequests`**

Dentro do handler `clearAllRequests` (atualmente:
```ts
} else if (message.action === 'clearAllRequests') {
    allRequests = {};
    indexedDBService
      .clearAllRequests()
      .then(() => sendResponse({ success: true }))
      ...
```
), troque o corpo por:

```ts
			} else if (message.action === 'clearAllRequests') {
				allRequests = {};
				sessionMarker = { ...EMPTY_SESSION_MARKER };
				persistSessionMarker();
				broadcastSessionMarker();
				indexedDBService
					.clearAllRequests()
					.then(() => sendResponse({ success: true }))
					.catch((err) => {
						console.error('Erro ao limpar IndexedDB:', err);
						sendResponse({ success: false, error: String(err) });
					});
				return true; // resposta assíncrona
```

- [ ] **Step 5: Atualizar marker em `startDebugging`**

Localize a função `startDebugging` (perto da linha 539). Após o bloco `await chrome.debugger.attach({ tabId }, '1.3')` e ANTES de `await chrome.debugger.sendCommand({ tabId }, 'Network.enable')` (perto da linha 577), atualize o marker:

```ts
			sessionMarker = {
				sessionStartedAt: Date.now(),
				currentPageUrl: null,
				currentPageNavigatedAt: null,
			};
			await persistSessionMarker();
			broadcastSessionMarker();
```

- [ ] **Step 6: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 7: Commit**

```bash
git add app/src/entrypoints/background.ts
git commit -m "feat(background): mantém SessionMarker persistido em chrome.storage.local"
```

---

## Task 11: Background — habilitar `Page` domain + listener `Page.frameNavigated`

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Habilitar `Page.enable` durante `startDebugging`**

Em `startDebugging`, após `await chrome.debugger.sendCommand({ tabId }, 'Network.enable')` e ANTES de `await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', ...)`, adicione:

```ts
			try {
				await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
				console.log('Page domain enabled for navigation tracking');
			} catch (error) {
				// Não bloqueia a interceptação — só perde o tracking de navegação.
				console.error('Erro ao habilitar Page domain:', error);
			}
```

- [ ] **Step 2: Desabilitar `Page` domain em `stopDebugging`**

Localize `stopDebugging` (linha ~612). Antes de `await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Fetch.disable')`, adicione:

```ts
			try {
				await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Page.disable');
			} catch (error) {
				console.error('Erro ao desabilitar Page domain:', error);
			}
```

- [ ] **Step 3: Tratar `Page.frameNavigated` em `debuggerEventListener`**

Localize `debuggerEventListener` (linha ~660). Substitua o bloco `if (message.startsWith('Network.')) { ... }` e `if (message === 'Fetch.requestPaused') { ... }` pelo seguinte (mantendo a lógica original — apenas adicionando o tratamento `Page.frameNavigated` no início):

```ts
function debuggerEventListener(
	debuggeeId: chrome.debugger.Debuggee,
	message: string,
	params: any,
): void {
	if (debuggeeId.tabId !== attachedTabId) return;

	if (message === 'Page.frameNavigated') {
		const frame = params?.frame;
		// Filtra: só main frame (parentId == null). Iframes têm parentId.
		if (frame && frame.parentId == null && typeof frame.url === 'string') {
			sessionMarker = {
				...sessionMarker,
				currentPageUrl: frame.url,
				currentPageNavigatedAt: Date.now(),
			};
			persistSessionMarker();
			broadcastSessionMarker();
		}
		return;
	}

	if (message.startsWith('Network.')) {
		timingTracker.handleNetworkEvent(message, params);
		return;
	}

	if (message === 'Fetch.requestPaused') {
		handleRequestPaused(params).catch((error) => {
			console.error('Erro ao processar Fetch.requestPaused:', error);
			const requestId = params?.requestId;
			if (!requestId) return;
			sendDebuggerCommand('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(
				(failError) => {
					console.error('Erro ao sinalizar falha para request pausada:', failError);
				},
			);
		});
	}
}
```

- [ ] **Step 4: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add app/src/entrypoints/background.ts
git commit -m "feat(background): habilita Page domain e atualiza marker em frameNavigated"
```

---

## Task 12: Background — plugar `onMetricsReady` no `timingTracker`

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Passar callback de métricas ao tracker**

Localize a linha:
```ts
const timingTracker = new NetworkTimingTracker((fetchRequestId, duration) => {
	patchRequest(fetchRequestId, { duration, durationSource: 'network' });
});
```

Substitua por:

```ts
const timingTracker = new NetworkTimingTracker(
	(fetchRequestId, duration) => {
		patchRequest(fetchRequestId, { duration, durationSource: 'network' });
	},
	(fetchRequestId, networkTiming) => {
		patchRequest(fetchRequestId, { networkTiming });
	},
);
```

- [ ] **Step 2: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Rodar tudo do background-relacionado**

Run: `cd app && npx vitest run src/lib/__tests__/networkTiming.test.ts`
Expected: todos passam.

- [ ] **Step 4: Commit**

```bash
git add app/src/entrypoints/background.ts
git commit -m "feat(background): patcha networkTiming nas requests via tracker callback"
```

---

## Task 13: Integrar `NetworkMetricsBar` no header

**Files:**
- Modify: `app/src/components/layout/SiteHeader.tsx`
- Modify: `app/src/pages/Layout.tsx`

- [ ] **Step 1: Estender props do `SiteHeader`**

Substitua o conteúdo de `app/src/components/layout/SiteHeader.tsx` por:

```tsx
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NetworkMetricsBar } from './NetworkMetricsBar';
import type { MetricsAggregate } from '@/lib/networkMetrics';

interface SiteHeaderProps {
	targetTab: {
		id: number | null;
		title: string;
		url: string;
	};
	isDebugging: boolean;
	onSelectTabClick: () => void;
	onStartDebugging: () => void;
	onStopDebugging: () => void;
	metrics: { session: MetricsAggregate; currentPage: MetricsAggregate };
	hasCurrentPage: boolean;
}

export function SiteHeader({
	targetTab,
	isDebugging,
	onSelectTabClick,
	onStartDebugging,
	onStopDebugging,
	metrics,
	hasCurrentPage,
}: SiteHeaderProps) {
	return (
		<header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear pr-2">
			<div className="flex w-full items-center justify-between px-4 lg:px-6">
				<div className="flex min-w-0 items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mx-2 hidden data-[orientation=vertical]:h-6 md:block"
					/>
					<NetworkMetricsBar
						session={metrics.session}
						currentPage={metrics.currentPage}
						hasCurrentPage={hasCurrentPage}
						isDebugging={isDebugging}
					/>
				</div>

				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									className="flex items-center gap-2 max-w-[200px]"
									onClick={onSelectTabClick}
								>
									<LucideIcon name="tab" className="h-4 w-4 flex-shrink-0" />
									<span className="truncate">
										{targetTab.id ? targetTab.title : 'Selecionar Aba'}
									</span>
								</Button>
							</TooltipTrigger>
							{targetTab.id && (
								<TooltipContent side="bottom" className="max-w-[300px] break-words">
									<div>
										<div className="font-medium">{targetTab.title}</div>
										<div className="text-xs text-muted-foreground">{targetTab.url}</div>
									</div>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>

					{!isDebugging ? (
						<Button
							variant="default"
							className="flex items-center gap-2"
							onClick={onStartDebugging}
						>
							<LucideIcon name="play" className="h-4 w-4" />
							<span className="hidden sm:inline">Iniciar Interceptação</span>
						</Button>
					) : (
						<Button
							variant="destructive"
							className="flex items-center gap-2"
							onClick={onStopDebugging}
						>
							<LucideIcon name="stop" className="h-4 w-4" />
							<span className="hidden sm:inline">Parar Interceptação</span>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
```

- [ ] **Step 2: Conectar hooks no `Layout.tsx`**

Substitua o conteúdo de `app/src/pages/Layout.tsx` por:

```tsx
import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useSessionMarker } from '../hooks/useSessionMarker';
import { useNetworkMetrics } from '../hooks/useNetworkMetrics';

const Layout: React.FC = () => {
	const { isDebugging, targetTab, startDebugging, stopDebugging } = useDebugging();
	const { pendingResponses } = useResponses();
	const { allRequests } = useAllRequests();
	const sessionMarker = useSessionMarker();
	const metrics = useNetworkMetrics(allRequests, sessionMarker);
	const [selectTabDialogOpen, setSelectTabDialogOpen] = useState(false);

	useEffect(() => {
		const messageListener = (message: any) => {
			if (message.action === 'openSelectTabDialog') {
				setSelectTabDialogOpen(true);
			}
		};

		chrome.runtime.onMessage.addListener(messageListener);

		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, []);

	const handleSelectTab = (tabId: number, tabTitle: string, tabUrl: string) => {
		chrome.runtime.sendMessage({
			action: 'setTargetTab',
			tabId,
			tabTitle,
			tabUrl,
		});
	};

	return (
		<SidebarProvider>
			<AppSidebar variant="inset" pendingResponsesCount={Object.keys(pendingResponses).length} />
			<SidebarInset>
				<SelectTabDialog
					open={selectTabDialogOpen}
					onOpenChange={setSelectTabDialogOpen}
					onSelectTab={handleSelectTab}
				/>
				<SiteHeader
					targetTab={targetTab}
					isDebugging={isDebugging}
					onSelectTabClick={() => setSelectTabDialogOpen(true)}
					onStartDebugging={() => startDebugging()}
					onStopDebugging={() => stopDebugging()}
					metrics={metrics}
					hasCurrentPage={sessionMarker.currentPageNavigatedAt != null}
				/>

				<div className="main-content-container flex-1 min-h-0 overflow-hidden">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
```

**Nota sobre `useAllRequests`:** este hook já é a fonte do estado das requests. O `Layout` agora consome além das `pendingResponses`. Não há conflito — múltiplas montagens de `useAllRequests` apenas duplicam o subscribe de `chrome.runtime.onMessage`, o que é benigno (cada um filtra por `requestId`). Em uma iteração futura, podemos elevar para um Context — fora de escopo aqui.

- [ ] **Step 3: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/SiteHeader.tsx app/src/pages/Layout.tsx
git commit -m "feat(layout): integra NetworkMetricsBar no SiteHeader"
```

---

## Task 14: Smoke check final — lint + build + tests + carregar a extensão

**Files:** nenhum a modificar — apenas validação.

- [ ] **Step 1: Rodar lint**

Run: `cd app && npm run lint`
Expected: zero warnings.

Se Biome reclamar, rodar `cd app && npm run lint:fix` e revisar o diff antes de commitar correções.

- [ ] **Step 2: Rodar tsc**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Rodar todos os testes**

Run: `cd app && npm test`
Expected: todas as suites passam (incluindo as 5 novas: networkMetrics, networkMetricsFormat, useSessionMarker, useNetworkMetrics, NetworkMetricsBar; e a estendida: networkTiming).

- [ ] **Step 4: Build de produção**

Run: `cd app && npm run build`
Expected: bundle gerado em `app/dist/`, zero erros, sem warnings de manifest.

- [ ] **Step 5: Validar manualmente carregando a extensão**

1. Abrir `chrome://extensions` → Developer mode → Load unpacked → selecionar `app/dist/`.
2. Clicar no ícone da extensão pra abrir a aba do interceptor.
3. Selecionar uma aba alvo (ex.: `https://news.ycombinator.com`).
4. Clicar **Iniciar Interceptação**.
5. Observar no header esquerdo: tabs **Sessão** | **Página** com 5 pills (placeholder "Sem requests ainda" no início).
6. Carregar a target tab → pills devem popular: requests > 0, baixado em KB/MB, TTFB > 0.
7. Clicar na tab "Página" → mostra apenas requests desde o último `frameNavigated`.
8. Navegar dentro da target tab → tab "Página" reseta com novo URL e novos números.
9. Parar Interceptação → pills congelam.
10. Limpar Histórico → pills voltam ao placeholder.

- [ ] **Step 6: Commit final (se houve fix de lint)**

Se a Step 1 precisou de fix:
```bash
git add -p
git commit -m "chore: ajustes de lint pós-integração"
```

Se nada mudou neste step, pular o commit.

---

## Self-Review

**Cobertura do spec:**

| Seção do spec | Task implementadora |
|---------------|---------------------|
| Captura granular CDP (extender NetworkTimingTracker) | Task 4 |
| `deriveNetworkTiming` helper puro | Task 3 |
| `Page` domain + frameNavigated listener | Task 11 |
| SessionMarker (tipo, persistência, transições) | Tasks 2, 10 |
| `aggregateRequests` + filtros por janela | Task 5 |
| Hook `useNetworkMetrics` memoizado | Task 8 |
| Hook `useSessionMarker` | Task 7 |
| Formatadores `formatBytes`/`formatMs`/`formatCount` | Task 6 |
| `NetworkMetricsBar` (Tabs, 5 pills, estado vazio) | Task 9 |
| Integração no `SiteHeader` + `Layout` | Task 13 |
| Modelo de dados (`networkTiming` no `InterceptedResponse`) | Task 1 |
| Mensageria (`getSessionMarker`, `sessionMarkerUpdated`) | Task 2 |
| Tracker callback `onMetricsReady` plugado | Task 12 |
| Lifecycle: reset em start/stop/clear/navegação | Tasks 10, 11, 12 |
| Responsividade (Separator hidden em sm) | Task 13 |
| Tooltip "Aguardando navegação" quando `hasCurrentPage = false` | Task 9 |
| Lint/build/test gate | Task 14 |

Sem buracos.

**Sem placeholders detectados:** todo step com código tem o código completo, todo comando tem o expected, nenhum "TBD/TODO/implementar depois".

**Consistência de tipos:**
- `SessionMarker` definido na Task 2, importado nas Tasks 7, 8, 10, 11, 13.
- `MetricsAggregate` definido na Task 5, importado nas Tasks 8, 9, 13.
- `NetworkTiming` exportado na Task 4 (incluído via re-export de tipos no `intercepted.ts` da Task 1 — campos opcionais espelhados manualmente).
- `EMPTY_SESSION_MARKER` definido na Task 2, usado nas Tasks 7, 10.
- Funções `aggregateRequests`/`filterBySession`/`filterByCurrentPage` mantêm assinatura idêntica ao longo do plano.

OK pra executar.
