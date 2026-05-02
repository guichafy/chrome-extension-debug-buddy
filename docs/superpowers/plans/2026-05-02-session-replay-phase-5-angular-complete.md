# Session Replay — Phase 5: Angular Complete (HttpClient, Signals, NgRx)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promover Angular de cidadão de segunda classe (apenas detecção) a cidadão de primeira: capturar requisições do `HttpClient`, mudanças de Signals e ações/state do NgRx como eventos da Session. QA gravando uma SPA Angular passa a ver no replay (a) requests com `client: 'angular-http'`, (b) `StateChangeEvent` com `storeKind: 'angular-signal'` e `'ngrx'` no Inspector, e (c) o painel `Environment Phases` reflete `tracked` em vez de `detection-only` para Angular HttpClient/NgRx/Signals.

**Architecture:** A Phase 4 entregou a infra de state capture (`StateChangeEvent` em `types.ts`, taps de Redux/Zustand/MobX/Jotai vivendo em `app/src/probe/state/`, bridge isolated → background com canal `stateChange`, e `StateInspector.tsx` na UI). Phase 5 adiciona três taps Angular-específicos seguindo o mesmo padrão arquitetural: probe injetado no MAIN world detecta + wrappa a API alvo, posta `ProbeMessage` para o ISOLATED world, que repassa via `chrome.runtime.sendMessage({action: 'stateChange', ...})` ao background, que persiste no `recorder` como `StateChangeEvent`. O HttpClient hook é diferente: ele wrappa `XMLHttpRequest.open` no MAIN world e adiciona o tag `client: 'angular-http'` ao `NetworkEvent` correspondente — a captura de network em si continua via `chrome.debugger` Fetch domain (não duplica request); o probe só publica metadados de classificação que o background usa para enriquecer o evento já existente.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` seção 6 (Angular HttpClient via `XMLHttpRequest.open` hook + `ng` global; NgRx; Signals com `tracked` em Phase 5).

---

## File Structure

**Modify:**
- `app/src/lib/session/types.ts` — adicionar `client?: string` em `NetworkEvent`; estender `StateChangeEvent.storeKind` com `'angular-signal' | 'ngrx'`.
- `app/src/probe/detectors/httpClients.ts` — detectar `window.ng` + heurística `HttpClient` para popular `HttpClientDetection` com `name: 'angular-http'`.
- `app/src/probe/detectors/stateManagers.ts` — promover NgRx e Angular Signals a `treatment: 'tracked'` (era marcado como `detection-only` ou inexistente).
- `app/src/probe/main.ts` — registrar os três taps novos no boot do probe.
- `app/src/probe/bridge.ts` — encaminhar payloads `probe:angular-http-tag`, `probe:state-change` (kind `angular-signal`/`ngrx`) ao background.
- `app/src/entrypoints/background.ts` — handler de `angularHttpTag` (anota `NetworkEvent.client`) e roteamento dos novos `storeKind` no `stateChange` para o recorder.
- `app/src/lib/session/recorder.ts` — aceita `client` no append de `NetworkEvent`; aceita os dois novos `storeKind` no append de `StateChangeEvent`.
- `app/src/components/recording/StateInspector.tsx` — labels e ícones para `angular-signal` e `ngrx`.
- `app/src/components/recording/EnvironmentPhases.tsx` (ou equivalente do painel de fases) — atualizar tooltip removendo "(detection-only)" para Angular HttpClient/NgRx/Signals.

**Create:**
- `app/src/probe/state/angularHttpTap.ts` — instala wrapper em `XMLHttpRequest.prototype.open`, detecta call sites Angular `HttpClient` (heurística por stack trace + `window.ng?.getComponent`), posta `probe:angular-http-tag` com `{requestUrl, method, requestId?}`.
- `app/src/probe/state/angularSignalTap.ts` — tenta acessar `ng.ɵsignal` (ou helpers internos similares); se inacessível, instala fallback patch em `WritableSignal.prototype.set`/`.update` quando uma instância passa pelo `ng.getComponent`. `confidence: 'low'` quando interno é inacessível.
- `app/src/probe/state/ngrxTap.ts` — detecta `__NGRX_DEVTOOLS__` ou `window.__STORE__`; wrappa `dispatch` e `state.subscribe` para emitir `StateChangeEvent` por action.
- `app/src/probe/state/__tests__/angularHttpTap.test.ts`
- `app/src/probe/state/__tests__/angularSignalTap.test.ts`
- `app/src/probe/state/__tests__/ngrxTap.test.ts`

**Test (co-located):**
- `app/src/lib/session/__tests__/types.test.ts` — assertions de tipos para os novos campos.
- `app/src/probe/detectors/__tests__/httpClients.test.ts` — caso `angular-http` detectado.
- `app/src/probe/detectors/__tests__/stateManagers.test.ts` — NgRx/Signals com `tracked`.
- `app/src/probe/__tests__/bridge.test.ts` — repasse dos novos canais.
- `app/src/lib/session/__tests__/recorder.test.ts` — append com `client` e novos `storeKind`.
- `app/src/lib/session/__tests__/fingerprint.test.ts` — `treatment: 'tracked'` consolida em fingerprint.
- `app/src/components/recording/__tests__/StateInspector.test.tsx` — render de `angular-signal`/`ngrx`.

---

## Decisões de design

**HttpClient via XHR, não via fetch:** Angular `HttpClient` usa `XMLHttpRequest` por padrão (mesmo em versões modernas), com Fetch backend opt-in via `provideHttpClient(withFetch())`. A spec exige hook em `XMLHttpRequest.open`, não em `fetch`. Para apps que optaram por Fetch backend, o tap detecta call sites Angular pela presença de `HttpHandler`/`HttpClient` no stack trace e emite o tag mesmo no fetch — registrar a limitação no comentário do detector.

**Tag de classificação, não interceptação:** O HttpClient tap NÃO duplica a captura do request — quem captura URL/method/status/body continua sendo o `chrome.debugger` Fetch domain no background. O probe só posta um "tag" associativo `{requestUrl, method, timestampHint}` que o background tenta casar contra o `NetworkEvent` mais recente daquela URL+método (janela de 250ms). Match falha → silêncio (no fallback). Match acerta → `patchRequest` adiciona `client: 'angular-http'` e o `requestUpdated` propaga pra UI.

**Signals — `confidence: 'low'` é o caminho default:** `ng.ɵsignal` é privado e muda a cada major do Angular. O tap tenta acessar e detecta a versão; se a API mudou, marca a `StateManagerDetection` como `treatment: 'tracked'` mas `confidence: 'low'` no payload do event (campo informativo no `StateChangeEvent`, não no fingerprint). Captura falha silenciosa não é fallback — o detector deve registrar `'angular-signal'` apenas quando o tap conseguiu wrappar pelo menos uma instância; se falhou em todas, NÃO emite a detection (fingerprint não mente sobre tracking).

**NgRx — `dispatch` é a fonte primária:** Hook em `Store.prototype.dispatch` (ou via `__NGRX_DEVTOOLS__.connect`) entrega `{action, prevState, nextState}` por chamada. Subscrição em `state` é redundante e gera ruído (uma emit por subscriber). Tap subscreve `state` apenas como fonte secundária se `dispatch` não estiver wrappable (NgRx Component Store, por ex.).

**Tratamento upgrade no fingerprint:** Hoje `httpClients` não tem campo `treatment`. Spec original previa adicionar — mas isso quebraria fingerprintsEqual e exigiria migração. Decisão: mantemos `httpClients` sem `treatment`; o "upgrade" se materializa em `dataFetching`/`stateManagers` que JÁ têm `treatment`. Para Angular HttpClient especificamente, criamos uma entrada em `dataFetching` com `name: 'angular-http'` e `treatment: 'tracked'` quando o tap está ativo (paralelo ao que `react-query` faz). Detector `httpClients` continua sinalizando presença com `confidence`, sem `treatment`.

**Detecção do contexto Angular:** Probe roda no MAIN world (mesmo contexto que a app). `window.ng` (debug API) só existe em dev mode e em alguns prod builds com `enableProdMode()` desativado. Para apps de prod sem `ng`, o tap usa heurística: presença de `<app-root>` ou atributos `_ngcontent-*` no DOM + bundling signature. Se nenhuma heurística confirma, o tap não instala wrappers (consistente com regra de no-fallbacks).

---

## Task 1: Type contract — `NetworkEvent.client` e `StateChangeEvent.storeKind`

**Files:**
- Modify: `app/src/lib/session/types.ts`
- Test: `app/src/lib/session/__tests__/types.test.ts`

### Step 1.1: Estender `NetworkEvent` com `client?: string`

Em `app/src/lib/session/types.ts`, a variante `network` ganha `client?: string`:

```ts
| {
		type: 'network';
		timestamp: number;
		phaseId: string;
		requestId: string;
		method: string;
		url: string;
		status: number;
		durationMs?: number;
		bodyRef?: string;
		// Tag opcional de classificação (e.g. 'angular-http', 'react-query', 'axios').
		// Setada por taps no probe; ausência = não classificado.
		client?: string;
  }
```

### Step 1.2: Estender `StateChangeEvent.storeKind`

A Phase 4 já criou a variante `state` com `storeKind: 'redux' | 'zustand' | 'mobx' | 'jotai'`. Adicionar dois valores:

```ts
storeKind: 'redux' | 'zustand' | 'mobx' | 'jotai' | 'angular-signal' | 'ngrx';
```

> Se a Phase 4 não tiver feito merge ainda, este step deve revisar a forma exata da variante `state` antes de editar.

### Step 1.3: Test de contrato

`app/src/lib/session/__tests__/types.test.ts` (criar OU adicionar caso já exista):

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { SessionEvent } from '../types';

describe('NetworkEvent.client', () => {
	it('aceita campo client opcional como string', () => {
		const ev: SessionEvent = {
			type: 'network',
			timestamp: 1,
			phaseId: 'p',
			requestId: 'r',
			method: 'GET',
			url: '/api/x',
			status: 200,
			client: 'angular-http',
		};
		expectTypeOf(ev).toMatchTypeOf<SessionEvent>();
	});
});

describe('StateChangeEvent.storeKind', () => {
	it("aceita 'angular-signal' e 'ngrx'", () => {
		const a: SessionEvent = {
			type: 'state',
			timestamp: 1,
			phaseId: 'p',
			storeKind: 'angular-signal',
			storeId: 'sig#1',
			diff: { before: 0, after: 1 },
		};
		const b: SessionEvent = {
			type: 'state',
			timestamp: 1,
			phaseId: 'p',
			storeKind: 'ngrx',
			storeId: 'root',
			actionType: '[Counter] Increment',
			diff: { before: { count: 0 }, after: { count: 1 } },
		};
		expectTypeOf(a).toMatchTypeOf<SessionEvent>();
		expectTypeOf(b).toMatchTypeOf<SessionEvent>();
	});
});
```

> Ajustar shape do `StateChangeEvent` ao que a Phase 4 entregou (campos `storeId`, `actionType?`, `diff` são placeholders aqui — usar os reais).

### Step 1.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/types.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/types.ts app/src/lib/session/__tests__/types.test.ts
git commit -m "feat(session): NetworkEvent.client + storeKind angular-signal/ngrx"
```

Esperado: 2 testes de contrato a mais; suite passa integralmente.

---

## Task 2: Detector + tap Angular HttpClient

**Files:**
- Create: `app/src/probe/state/angularHttpTap.ts`
- Modify: `app/src/probe/detectors/httpClients.ts`
- Modify: `app/src/probe/detectors/dataFetching.ts` (adicionar entrada `angular-http` com `treatment: 'tracked'`)
- Modify: `app/src/probe/main.ts` (registrar tap no boot)
- Modify: `app/src/probe/bridge.ts` (encaminhar `probe:angular-http-tag`)
- Modify: `app/src/entrypoints/background.ts` (handler que casa tag com `NetworkEvent`)
- Test: `app/src/probe/state/__tests__/angularHttpTap.test.ts`
- Test: `app/src/probe/detectors/__tests__/httpClients.test.ts`

### Step 2.1: Implementar `angularHttpTap.ts`

`app/src/probe/state/angularHttpTap.ts`:

```ts
import { PROBE_NAMESPACE } from '../protocol';

interface AngularHttpTagPayload {
	url: string;
	method: string;
	timestampHint: number;
	confidence: 'high' | 'medium' | 'low';
}

interface AngularGlobals {
	ng?: {
		getComponent?: (el: unknown) => unknown;
		getContext?: (el: unknown) => unknown;
	};
}

function detectAngularContext(): boolean {
	const ng = (window as unknown as AngularGlobals).ng;
	if (ng?.getComponent && ng?.getContext) return true;
	// Fallback de prod: presença de <app-root> + atributos _ngcontent-*.
	const hasAppRoot = !!document.querySelector('app-root');
	const hasNgContent = !!document.querySelector('[_ngcontent-ng-c0]')
		|| document.documentElement.outerHTML.includes('_ngcontent-');
	return hasAppRoot && hasNgContent;
}

function isHttpClientCallSite(stackString: string): boolean {
	// Heurística: `HttpClient.request`, `HttpHandler.handle`, `HttpInterceptor` aparecem
	// no stack trace de qualquer chamada via HttpClient. Em prod build minificado, só
	// `_HttpClient` ou nomes mangled — confiança cai pra 'medium'.
	if (/HttpClient\.|HttpHandler\.|HttpInterceptor/.test(stackString)) return true;
	if (/_HttpClient|HttpXhrBackend/.test(stackString)) return true;
	return false;
}

export function installAngularHttpTap(): { uninstall: () => void } | null {
	if (!detectAngularContext()) return null;

	const origOpen = XMLHttpRequest.prototype.open;
	const origSend = XMLHttpRequest.prototype.send;

	type TaggedXhr = XMLHttpRequest & {
		__dbb_method?: string;
		__dbb_url?: string;
		__dbb_isAngular?: boolean;
	};

	XMLHttpRequest.prototype.open = function (
		this: TaggedXhr,
		method: string,
		url: string | URL,
		...rest: unknown[]
	) {
		this.__dbb_method = String(method).toUpperCase();
		this.__dbb_url = typeof url === 'string' ? url : url.toString();
		const stack = new Error().stack ?? '';
		this.__dbb_isAngular = isHttpClientCallSite(stack);
		// biome-ignore lint/suspicious/noExplicitAny: signature genérica do XHR.open
		return origOpen.apply(this, [method, url, ...rest] as any);
	};

	XMLHttpRequest.prototype.send = function (
		this: TaggedXhr,
		body?: Document | XMLHttpRequestBodyInit | null,
	) {
		if (this.__dbb_isAngular && this.__dbb_url && this.__dbb_method) {
			const payload: AngularHttpTagPayload = {
				url: this.__dbb_url,
				method: this.__dbb_method,
				timestampHint: Date.now(),
				confidence: 'high',
			};
			window.postMessage(
				{ ns: PROBE_NAMESPACE, type: 'probe:angular-http-tag', payload },
				location.origin,
			);
		}
		return origSend.call(this, body ?? null);
	};

	return {
		uninstall: () => {
			XMLHttpRequest.prototype.open = origOpen;
			XMLHttpRequest.prototype.send = origSend;
		},
	};
}
```

### Step 2.2: Atualizar `httpClients.ts` para reportar `angular-http`

```ts
import type { HttpClientDetection } from '@/lib/session/types';

export function detectHttpClients(): HttpClientDetection[] {
	const out: HttpClientDetection[] = [
		{ name: 'fetch', confidence: 'high' },
		{ name: 'xhr', confidence: 'high' },
	];

	if ((window as unknown as { axios?: unknown }).axios) {
		out.push({ name: 'axios', confidence: 'high' });
	}

	const ng = (window as unknown as { ng?: { getComponent?: unknown } }).ng;
	const hasAppRoot = !!document.querySelector('app-root');
	if (ng?.getComponent || hasAppRoot) {
		// Confidence 'high' quando ng.getComponent existe; 'medium' só com app-root.
		out.push({
			name: 'angular-http',
			confidence: ng?.getComponent ? 'high' : 'medium',
		});
	}

	return out;
}
```

### Step 2.3: `dataFetching.ts` — adicionar entrada `angular-http` com `treatment: 'tracked'`

Adicionar o detector pra refletir o upgrade da Phase 5:

```ts
const ng = (window as unknown as { ng?: { getComponent?: unknown } }).ng;
const hasAppRoot = !!document.querySelector('app-root');
if (ng?.getComponent || hasAppRoot) {
	out.push({ name: 'angular-http', treatment: 'tracked' });
}
```

### Step 2.4: Bridge + background — handler `angularHttpTag`

`bridge.ts`:

```ts
if (e.data.type === 'probe:angular-http-tag') {
	chrome.runtime.sendMessage({
		action: 'angularHttpTag',
		payload: e.data.payload,
	});
	return;
}
```

`background.ts` ganha listener:

```ts
if (message.action === 'angularHttpTag') {
	// Casa tag contra NetworkEvent recente em allRequests (janela 250ms, mesmo URL+method).
	tagAngularHttpRequest(message.payload);
	return false;
}
```

`tagAngularHttpRequest` percorre `allRequests` em ordem reversa, encontra o primeiro com `url === payload.url && method === payload.method && timestampDiff < 250ms`, e chama `patchRequest(id, { client: 'angular-http' })`. **No fallback**: se nenhum match, log de debug e nada mais — não inventa um requestId.

### Step 2.5: Tests

`app/src/probe/state/__tests__/angularHttpTap.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { installAngularHttpTap } from '../angularHttpTap';

describe('installAngularHttpTap', () => {
	const origOpen = XMLHttpRequest.prototype.open;
	const origSend = XMLHttpRequest.prototype.send;

	beforeEach(() => {
		(window as unknown as { ng?: unknown }).ng = { getComponent: () => null, getContext: () => null };
		document.body.innerHTML = '<app-root></app-root>';
	});

	afterEach(() => {
		XMLHttpRequest.prototype.open = origOpen;
		XMLHttpRequest.prototype.send = origSend;
		delete (window as unknown as { ng?: unknown }).ng;
	});

	it('retorna null quando contexto Angular não detectado', () => {
		delete (window as unknown as { ng?: unknown }).ng;
		document.body.innerHTML = '';
		expect(installAngularHttpTap()).toBeNull();
	});

	it('posta probe:angular-http-tag quando stack contém HttpClient', async () => {
		const tap = installAngularHttpTap();
		expect(tap).not.toBeNull();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		// Simula call site Angular ao injetar erro com stack contendo HttpClient
		const fakeStackCtor = class {
			get stack() {
				return 'Error\n  at HttpClient.request (zone.js:42)\n  at app.ts:1';
			}
		};
		const origError = globalThis.Error;
		// biome-ignore lint/suspicious/noExplicitAny: mock do Error pra controlar stack
		(globalThis as any).Error = fakeStackCtor as any;

		const xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://localhost/api/x');
		xhr.send();

		(globalThis as any).Error = origError;
		await new Promise((r) => setTimeout(r, 0));

		const tag = messages.find((m) =>
			(m as { type?: string }).type === 'probe:angular-http-tag',
		);
		expect(tag).toBeDefined();
		expect((tag as { payload: { url: string } }).payload.url).toBe('http://localhost/api/x');

		tap?.uninstall();
	});

	it('NÃO posta tag quando stack não contém HttpClient', async () => {
		const tap = installAngularHttpTap();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://localhost/x');
		xhr.send();
		await new Promise((r) => setTimeout(r, 0));

		const tag = messages.find((m) =>
			(m as { type?: string }).type === 'probe:angular-http-tag',
		);
		expect(tag).toBeUndefined();
		tap?.uninstall();
	});
});
```

`app/src/probe/detectors/__tests__/httpClients.test.ts` (adicionar caso):

```ts
it('detecta angular-http com confidence high quando window.ng existe', () => {
	(window as unknown as { ng?: unknown }).ng = { getComponent: () => null };
	const out = detectHttpClients();
	const angular = out.find((c) => c.name === 'angular-http');
	expect(angular).toBeDefined();
	expect(angular?.confidence).toBe('high');
	delete (window as unknown as { ng?: unknown }).ng;
});

it('detecta angular-http com confidence medium quando só <app-root> existe', () => {
	document.body.innerHTML = '<app-root></app-root>';
	const out = detectHttpClients();
	const angular = out.find((c) => c.name === 'angular-http');
	expect(angular?.confidence).toBe('medium');
});
```

### Step 2.6: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/state/__tests__/angularHttpTap.test.ts src/probe/detectors/__tests__/httpClients.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/state/angularHttpTap.ts app/src/probe/detectors/httpClients.ts app/src/probe/detectors/dataFetching.ts app/src/probe/main.ts app/src/probe/bridge.ts app/src/entrypoints/background.ts app/src/probe/state/__tests__/angularHttpTap.test.ts app/src/probe/detectors/__tests__/httpClients.test.ts
git commit -m "feat(session): tap Angular HttpClient via XHR.open + tag client=angular-http"
```

---

## Task 3: Tap Angular Signals

**Files:**
- Create: `app/src/probe/state/angularSignalTap.ts`
- Modify: `app/src/probe/main.ts` (boot)
- Modify: `app/src/probe/bridge.ts` (já encaminha `probe:state-change` da Phase 4 — verificar)
- Test: `app/src/probe/state/__tests__/angularSignalTap.test.ts`

### Step 3.1: Implementar `angularSignalTap.ts`

```ts
import { PROBE_NAMESPACE } from '../protocol';

interface AngularRuntime {
	ng?: {
		getComponent?: (el: unknown) => unknown;
		// ɵsignal é privado e muda a cada major. Best-effort.
		ɵsignal?: unknown;
	};
}

interface SignalChangePayload {
	storeKind: 'angular-signal';
	storeId: string;
	confidence: 'high' | 'medium' | 'low';
	diff: { before: unknown; after: unknown };
	timestamp: number;
}

let signalIdCounter = 0;

function probeSignalApi(): { tracked: number; confidence: 'high' | 'medium' | 'low' } {
	const ng = (window as unknown as AngularRuntime).ng;
	if (!ng) return { tracked: 0, confidence: 'low' };
	if (typeof (ng as { ɵsignal?: unknown }).ɵsignal === 'function') {
		// API privada acessível: caminho 'high' (Angular 17+ debug).
		return { tracked: 0, confidence: 'high' };
	}
	return { tracked: 0, confidence: 'low' };
}

export function installAngularSignalTap(): { uninstall: () => void } | null {
	const probe = probeSignalApi();
	const ng = (window as unknown as AngularRuntime).ng;
	if (!ng) return null;

	// Estratégia 1 (high): wrapping de ɵsignal — ainda não estável entre versões.
	// Estratégia 2 (medium/low): patch quando getComponent retorna instância com
	// propriedades que parecem WritableSignal (function que tem .set / .update).
	const wrappedSignals = new WeakSet<object>();

	function wrapInstance(instance: unknown): boolean {
		if (typeof instance !== 'object' || instance === null) return false;
		let wrappedAny = false;
		for (const key of Object.keys(instance as object)) {
			const val = (instance as Record<string, unknown>)[key];
			if (typeof val !== 'function') continue;
			const fn = val as { set?: unknown; update?: unknown };
			if (typeof fn.set !== 'function' || typeof fn.update !== 'function') continue;
			if (wrappedSignals.has(fn as object)) continue;
			wrappedSignals.add(fn as object);
			const id = `sig#${++signalIdCounter}#${key}`;
			const origSet = fn.set as (v: unknown) => void;
			const origUpdate = fn.update as (fn: (cur: unknown) => unknown) => void;
			fn.set = function (v: unknown) {
				const before = (val as unknown as () => unknown)();
				origSet.call(this, v);
				emitChange(id, before, v);
			};
			fn.update = function (mut: (cur: unknown) => unknown) {
				const before = (val as unknown as () => unknown)();
				origUpdate.call(this, mut);
				const after = (val as unknown as () => unknown)();
				emitChange(id, before, after);
			};
			wrappedAny = true;
		}
		return wrappedAny;
	}

	function emitChange(storeId: string, before: unknown, after: unknown): void {
		const payload: SignalChangePayload = {
			storeKind: 'angular-signal',
			storeId,
			confidence: probe.confidence,
			diff: { before, after },
			timestamp: Date.now(),
		};
		window.postMessage(
			{ ns: PROBE_NAMESPACE, type: 'probe:state-change', payload },
			location.origin,
		);
	}

	// Hook em ng.getComponent: cada vez que devtools ou nosso código chama,
	// inspecionamos o componente retornado.
	const origGetComponent = ng.getComponent;
	if (origGetComponent) {
		ng.getComponent = function (el: unknown) {
			const inst = origGetComponent.call(this, el);
			if (inst) wrapInstance(inst);
			return inst;
		};
	}

	// Best effort: percorrer DOM Angular e wrappar componentes existentes uma vez.
	const angularEls = document.querySelectorAll('[_nghost-ng-c0], app-root, [ng-version]');
	angularEls.forEach((el) => {
		try {
			const inst = origGetComponent?.call(ng, el);
			if (inst) wrapInstance(inst);
		} catch {
			// silencioso; tap é best-effort.
		}
	});

	return {
		uninstall: () => {
			if (origGetComponent) ng.getComponent = origGetComponent;
		},
	};
}

// Helper exportado pra detector: indica se pelo menos um signal foi wrappable.
export function angularSignalsTrackable(): boolean {
	const ng = (window as unknown as AngularRuntime).ng;
	return !!ng?.getComponent;
}
```

### Step 3.2: Atualizar `stateManagers.ts` para reportar Signals com `tracked`

```ts
import { angularSignalsTrackable } from '../state/angularSignalTap';

export function detectStateManagers(): StateManagerDetection[] {
	const out: StateManagerDetection[] = [];

	if (
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__
	) {
		out.push({ name: 'redux', storesDetected: 0, treatment: 'tracked' });
	}

	if (angularSignalsTrackable()) {
		out.push({ name: 'angular-signal', storesDetected: 0, treatment: 'tracked' });
	}

	// NgRx — adicionado na Task 4.

	return out;
}
```

> Importar `angularSignalsTrackable` do tap mantém o detector honesto: só reporta quando o tap pode efetivamente operar (no fallback).

### Step 3.3: Tests

`app/src/probe/state/__tests__/angularSignalTap.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { installAngularSignalTap, angularSignalsTrackable } from '../angularSignalTap';

describe('angularSignalTap', () => {
	beforeEach(() => {
		const fakeComponent = (() => {
			let val = 0;
			const sig = (() => val) as ((() => number) & {
				set: (v: number) => void;
				update: (m: (c: number) => number) => void;
			});
			sig.set = (v: number) => {
				val = v;
			};
			sig.update = (m: (c: number) => number) => {
				val = m(val);
			};
			return { count: sig };
		})();
		(window as unknown as { ng?: unknown }).ng = {
			getComponent: () => fakeComponent,
		};
	});

	afterEach(() => {
		delete (window as unknown as { ng?: unknown }).ng;
	});

	it('retorna null sem ng global', () => {
		delete (window as unknown as { ng?: unknown }).ng;
		expect(installAngularSignalTap()).toBeNull();
	});

	it('angularSignalsTrackable=true quando ng.getComponent existe', () => {
		expect(angularSignalsTrackable()).toBe(true);
	});

	it('emite probe:state-change ao chamar .set() no signal', async () => {
		const tap = installAngularSignalTap();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const ng = (window as unknown as { ng: { getComponent: (el: unknown) => unknown } }).ng;
		const inst = ng.getComponent(document.body) as {
			count: ((() => number) & { set: (v: number) => void });
		};
		inst.count.set(42);
		await new Promise((r) => setTimeout(r, 0));

		const change = messages.find(
			(m) => (m as { type?: string }).type === 'probe:state-change',
		) as { payload: { storeKind: string; diff: { before: number; after: number } } } | undefined;
		expect(change?.payload.storeKind).toBe('angular-signal');
		expect(change?.payload.diff.after).toBe(42);
		tap?.uninstall();
	});

	it('emite probe:state-change ao chamar .update()', async () => {
		const tap = installAngularSignalTap();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const ng = (window as unknown as { ng: { getComponent: (el: unknown) => unknown } }).ng;
		const inst = ng.getComponent(document.body) as {
			count: ((() => number) & { update: (m: (c: number) => number) => void });
		};
		inst.count.update((c) => c + 5);
		await new Promise((r) => setTimeout(r, 0));

		const changes = messages.filter(
			(m) => (m as { type?: string }).type === 'probe:state-change',
		);
		expect(changes.length).toBeGreaterThan(0);
		tap?.uninstall();
	});
});
```

### Step 3.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/state/__tests__/angularSignalTap.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/state/angularSignalTap.ts app/src/probe/detectors/stateManagers.ts app/src/probe/main.ts app/src/probe/state/__tests__/angularSignalTap.test.ts
git commit -m "feat(session): tap Angular Signals com confidence + storeKind angular-signal"
```

---

## Task 4: Tap NgRx

**Files:**
- Create: `app/src/probe/state/ngrxTap.ts`
- Modify: `app/src/probe/detectors/stateManagers.ts`
- Modify: `app/src/probe/main.ts`
- Test: `app/src/probe/state/__tests__/ngrxTap.test.ts`

### Step 4.1: Implementar `ngrxTap.ts`

```ts
import { PROBE_NAMESPACE } from '../protocol';

interface NgRxStoreLike {
	dispatch?: (action: unknown) => void;
	state$?: { subscribe?: (cb: (state: unknown) => void) => unknown };
	source?: { subscribe?: (cb: (s: unknown) => void) => unknown };
}

interface NgRxAction {
	type?: string;
	[k: string]: unknown;
}

interface NgRxChangePayload {
	storeKind: 'ngrx';
	storeId: string;
	actionType?: string;
	diff: { before: unknown; after: unknown };
	timestamp: number;
}

function findStore(): NgRxStoreLike | null {
	const w = window as unknown as {
		__NGRX_DEVTOOLS__?: { connect?: () => unknown };
		__STORE__?: NgRxStoreLike;
	};
	if (w.__STORE__?.dispatch) return w.__STORE__;
	// __NGRX_DEVTOOLS__ é injetado pelo StoreDevtoolsModule; um connect() retorna proxy
	// com listeners. Tap só usa como sinal de presença — wrap real é em Store.dispatch.
	return null;
}

export function ngrxDetected(): boolean {
	const w = window as unknown as { __NGRX_DEVTOOLS__?: unknown; __STORE__?: unknown };
	return !!(w.__NGRX_DEVTOOLS__ || w.__STORE__);
}

export function installNgRxTap(): { uninstall: () => void } | null {
	const store = findStore();
	if (!store?.dispatch) return null;

	let lastState: unknown;
	const stream = store.state$ ?? store.source;
	const sub = stream?.subscribe?.((s: unknown) => {
		lastState = s;
	});

	const origDispatch = store.dispatch.bind(store);
	store.dispatch = (action: unknown) => {
		const before = lastState;
		const ret = origDispatch(action);
		// Próximo tick lastState já foi atualizado pelo subscribe.
		queueMicrotask(() => {
			const payload: NgRxChangePayload = {
				storeKind: 'ngrx',
				storeId: 'root',
				actionType: (action as NgRxAction)?.type,
				diff: { before, after: lastState },
				timestamp: Date.now(),
			};
			window.postMessage(
				{ ns: PROBE_NAMESPACE, type: 'probe:state-change', payload },
				location.origin,
			);
		});
		return ret;
	};

	return {
		uninstall: () => {
			store.dispatch = origDispatch;
			(sub as { unsubscribe?: () => void } | undefined)?.unsubscribe?.();
		},
	};
}
```

### Step 4.2: `stateManagers.ts` — entrada `ngrx` com `tracked`

```ts
import { ngrxDetected } from '../state/ngrxTap';

if (ngrxDetected()) {
	out.push({ name: 'ngrx', storesDetected: 0, treatment: 'tracked' });
}
```

### Step 4.3: Tests

`app/src/probe/state/__tests__/ngrxTap.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { installNgRxTap, ngrxDetected } from '../ngrxTap';

describe('ngrxTap', () => {
	type Listener = (s: unknown) => void;

	const buildFakeStore = () => {
		const listeners: Listener[] = [];
		let state = { count: 0 };
		const store = {
			dispatch: (action: { type: string }) => {
				if (action.type === '[Counter] Increment') state = { count: state.count + 1 };
				listeners.forEach((l) => l(state));
			},
			state$: {
				subscribe: (cb: Listener) => {
					listeners.push(cb);
					cb(state);
					return { unsubscribe: () => listeners.splice(listeners.indexOf(cb), 1) };
				},
			},
		};
		return store;
	};

	beforeEach(() => {
		(window as unknown as { __STORE__?: unknown }).__STORE__ = buildFakeStore();
	});

	afterEach(() => {
		delete (window as unknown as { __STORE__?: unknown }).__STORE__;
	});

	it('ngrxDetected=true quando __STORE__ existe', () => {
		expect(ngrxDetected()).toBe(true);
	});

	it('ngrxDetected=false sem nenhum hook', () => {
		delete (window as unknown as { __STORE__?: unknown }).__STORE__;
		expect(ngrxDetected()).toBe(false);
	});

	it('emite probe:state-change com actionType ao dispatch', async () => {
		const tap = installNgRxTap();
		expect(tap).not.toBeNull();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const store = (window as unknown as { __STORE__: { dispatch: (a: unknown) => void } }).__STORE__;
		store.dispatch({ type: '[Counter] Increment' });
		await new Promise((r) => setTimeout(r, 5));

		const ev = messages.find(
			(m) => (m as { type?: string }).type === 'probe:state-change',
		) as { payload: { storeKind: string; actionType: string; diff: { after: unknown } } } | undefined;
		expect(ev?.payload.storeKind).toBe('ngrx');
		expect(ev?.payload.actionType).toBe('[Counter] Increment');
		expect(ev?.payload.diff.after).toEqual({ count: 1 });

		tap?.uninstall();
	});

	it('uninstall restaura dispatch original', () => {
		const store = (window as unknown as { __STORE__: { dispatch: (a: unknown) => void } }).__STORE__;
		const origRef = store.dispatch;
		const tap = installNgRxTap();
		expect(store.dispatch).not.toBe(origRef);
		tap?.uninstall();
		expect(store.dispatch).toBe(origRef);
	});
});
```

### Step 4.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/state/__tests__/ngrxTap.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/state/ngrxTap.ts app/src/probe/detectors/stateManagers.ts app/src/probe/main.ts app/src/probe/state/__tests__/ngrxTap.test.ts
git commit -m "feat(session): tap NgRx via Store.dispatch + storeKind ngrx"
```

---

## Task 5: Bridge isolated → background — encaminhar novos `storeKind`

**Files:**
- Modify: `app/src/probe/bridge.ts`
- Modify: `app/src/entrypoints/background.ts`
- Modify: `app/src/lib/session/recorder.ts`
- Test: `app/src/probe/__tests__/bridge.test.ts`
- Test: `app/src/lib/session/__tests__/recorder.test.ts`

### Step 5.1: `bridge.ts` — confirmar repasse para `storeKind` novos

A Phase 4 já implementou repasse de `probe:state-change`. Verificar que a função encaminhadora não filtra `storeKind`. Se filtra (por exemplo, `if (storeKind === 'redux' || ...)`), ampliar:

```ts
const allowedKinds = ['redux', 'zustand', 'mobx', 'jotai', 'angular-signal', 'ngrx'] as const;
if (!allowedKinds.includes(payload.storeKind)) return;
```

### Step 5.2: `background.ts` — `stateChange` handler aceita novos kinds

O handler do canal `stateChange` já chama `recorder.appendStateChange({...})`. Verificar que o `storeKind` é passado verbatim (sem allowlist obsoleta).

### Step 5.3: `recorder.ts` — `appendStateChange` aceita `angular-signal`/`ngrx`

Se a Phase 4 implementou um `switch (storeKind)`, adicionar cases:

```ts
case 'angular-signal':
case 'ngrx':
	this.events.push({
		type: 'state',
		timestamp: payload.timestamp,
		phaseId: this.currentPhaseId,
		storeKind: payload.storeKind,
		storeId: payload.storeId,
		actionType: payload.actionType,
		diff: payload.diff,
	});
	break;
```

> Sem fallback: se a variante `state` foi modelada como discriminated union pelo `storeKind`, o TS guia o ajuste.

### Step 5.4: `appendNetworkEvent` aceita `client`

Garantir que o campo `client` da Phase 5 é propagado pelo recorder quando vem do `patchRequest` originado do `tagAngularHttpRequest`.

### Step 5.5: Tests

`app/src/probe/__tests__/bridge.test.ts` — adicionar (se já existe, complementar):

```ts
it('encaminha probe:state-change com storeKind angular-signal', () => {
	const sendMessage = vi.fn();
	(globalThis as unknown as { chrome: { runtime: { sendMessage: typeof sendMessage } } }).chrome = {
		runtime: { sendMessage },
	};
	// ... boot do bridge / postar message com storeKind=angular-signal ...
	expect(sendMessage).toHaveBeenCalledWith(
		expect.objectContaining({ action: 'stateChange' }),
	);
	const arg = sendMessage.mock.calls[0][0];
	expect(arg.payload.storeKind).toBe('angular-signal');
});

it('encaminha probe:state-change com storeKind ngrx', () => {
	// análogo
});
```

`app/src/lib/session/__tests__/recorder.test.ts` — adicionar:

```ts
it('appendStateChange persiste storeKind angular-signal', () => {
	const r = new Recorder(/* ... */);
	r.appendStateChange({
		storeKind: 'angular-signal',
		storeId: 'sig#1',
		diff: { before: 0, after: 1 },
		timestamp: 100,
	});
	const session = r.snapshot();
	const ev = session.events.find((e) => e.type === 'state');
	expect((ev as { storeKind: string }).storeKind).toBe('angular-signal');
});

it('appendNetworkEvent aceita client=angular-http', () => {
	const r = new Recorder(/* ... */);
	r.appendNetworkEvent({
		requestId: 'r1',
		method: 'GET',
		url: '/api',
		status: 200,
		client: 'angular-http',
		timestamp: 1,
	});
	const ev = r.snapshot().events[0] as { type: 'network'; client?: string };
	expect(ev.client).toBe('angular-http');
});
```

### Step 5.6: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/__tests__/bridge.test.ts src/lib/session/__tests__/recorder.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/bridge.ts app/src/entrypoints/background.ts app/src/lib/session/recorder.ts app/src/probe/__tests__/bridge.test.ts app/src/lib/session/__tests__/recorder.test.ts
git commit -m "feat(session): bridge + recorder aceitam angular-signal/ngrx + client=angular-http"
```

---

## Task 6: Fingerprint upgrade — `treatment: 'tracked'` para Angular libs

**Files:**
- Modify: `app/src/probe/detectors/dataFetching.ts` (já tocado na Task 2, validar consolidação)
- Modify: `app/src/probe/detectors/stateManagers.ts` (já tocado nas Tasks 3 e 4)
- Modify: `app/src/lib/session/fingerprint.ts` — nada a alterar de lógica; apenas confirmar que `fingerprintsEqual` continua válido com os novos nomes (já é, pois compara por `name:version:treatment`).
- Test: `app/src/lib/session/__tests__/fingerprint.test.ts`
- Test: `app/src/probe/detectors/__tests__/stateManagers.test.ts`

### Step 6.1: Test fingerprint distingue antes/depois do upgrade

`fingerprint.test.ts` (adicionar):

```ts
it('fingerprintsEqual=false quando angular-http muda de detection-only para tracked', () => {
	const before: EnvironmentFingerprint = {
		framework: { name: 'angular' },
		httpClients: [{ name: 'angular-http', confidence: 'high' }],
		dataFetching: [{ name: 'angular-http', treatment: 'detection-only' }],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	};
	const after: EnvironmentFingerprint = {
		...before,
		dataFetching: [{ name: 'angular-http', treatment: 'tracked' }],
	};
	expect(fingerprintsEqual(before, after)).toBe(false);
});

it('fingerprintsEqual=true para dois snapshots com angular-signal tracked', () => {
	const a: EnvironmentFingerprint = {
		framework: { name: 'angular' },
		httpClients: [],
		dataFetching: [],
		stateManagers: [{ name: 'angular-signal', storesDetected: 0, treatment: 'tracked' }],
		detectedAt: 1,
		isProductionBuild: false,
	};
	const b: EnvironmentFingerprint = { ...a, detectedAt: 999 };
	expect(fingerprintsEqual(a, b)).toBe(true);
});
```

### Step 6.2: Test stateManagers reporta NgRx + Signals com tracked

`app/src/probe/detectors/__tests__/stateManagers.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { detectStateManagers } from '../stateManagers';

describe('detectStateManagers — Phase 5 Angular', () => {
	afterEach(() => {
		delete (window as unknown as { ng?: unknown }).ng;
		delete (window as unknown as { __STORE__?: unknown }).__STORE__;
		delete (window as unknown as { __NGRX_DEVTOOLS__?: unknown }).__NGRX_DEVTOOLS__;
	});

	it('reporta angular-signal com tracked quando ng.getComponent existe', () => {
		(window as unknown as { ng: unknown }).ng = { getComponent: () => null };
		const out = detectStateManagers();
		const sig = out.find((s) => s.name === 'angular-signal');
		expect(sig?.treatment).toBe('tracked');
	});

	it('reporta ngrx com tracked quando __STORE__ existe', () => {
		(window as unknown as { __STORE__: unknown }).__STORE__ = { dispatch: () => {} };
		const out = detectStateManagers();
		const ngrx = out.find((s) => s.name === 'ngrx');
		expect(ngrx?.treatment).toBe('tracked');
	});

	it('NÃO reporta angular-signal quando ng está ausente (no fallback)', () => {
		const out = detectStateManagers();
		expect(out.find((s) => s.name === 'angular-signal')).toBeUndefined();
	});
});
```

### Step 6.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/fingerprint.test.ts src/probe/detectors/__tests__/stateManagers.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/detectors/dataFetching.ts app/src/probe/detectors/stateManagers.ts app/src/lib/session/__tests__/fingerprint.test.ts app/src/probe/detectors/__tests__/stateManagers.test.ts
git commit -m "feat(session): Angular HttpClient/NgRx/Signals como tracked no fingerprint"
```

---

## Task 7: UI — `StateInspector` + `EnvironmentPhases` panel

**Files:**
- Modify: `app/src/components/recording/StateInspector.tsx`
- Modify: `app/src/components/recording/EnvironmentPhases.tsx` (ou nome equivalente entregue na Phase 1c)
- Test: `app/src/components/recording/__tests__/StateInspector.test.tsx`

### Step 7.1: `StateInspector` renderiza `angular-signal` e `ngrx`

Adicionar mapeamento de label/ícone na UI de inspeção de state events. Onde existe um `switch (storeKind)` ou `record` `{redux: 'Redux', ...}`, estender:

```tsx
const STORE_LABEL: Record<StateChangeEvent['storeKind'], string> = {
	redux: 'Redux',
	zustand: 'Zustand',
	mobx: 'MobX',
	jotai: 'Jotai',
	'angular-signal': 'Angular Signal',
	ngrx: 'NgRx',
};

const STORE_ICON: Record<StateChangeEvent['storeKind'], string> = {
	redux: '🟣',
	zustand: '🐻',
	mobx: '🟠',
	jotai: '🪶',
	'angular-signal': '🅰️',
	ngrx: '🅽',
};
```

> CLAUDE.md proíbe emojis em código por padrão — usar componentes `lucide-react` (ex.: `Atom`, `Zap`) ou abreviações textuais (`A-Sig`, `NgRx`). Manter consistência com o que a Phase 4 escolheu.

Render do action type (NgRx tem `actionType`, Signal não):

```tsx
{event.storeKind === 'ngrx' && event.actionType && (
	<span className="font-mono text-xs">{event.actionType}</span>
)}
```

### Step 7.2: `EnvironmentPhases` — tooltip atualizado

O painel mostra cada lib com badge `tracked` ou `detection-only`. Para o tooltip, remover hardcode "Angular libs are detection-only" se existir; o badge agora reflete o real `treatment` do fingerprint persistido (sem texto especial-case por framework).

### Step 7.3: Tests

`app/src/components/recording/__tests__/StateInspector.test.tsx` — adicionar:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StateInspector } from '../StateInspector';

describe('StateInspector — Phase 5 storeKinds', () => {
	it('renderiza label "Angular Signal" para storeKind=angular-signal', () => {
		render(
			<StateInspector
				events={[
					{
						type: 'state',
						timestamp: 1,
						phaseId: 'p',
						storeKind: 'angular-signal',
						storeId: 'sig#1',
						diff: { before: 0, after: 1 },
					},
				]}
			/>,
		);
		expect(screen.getByText(/Angular Signal/)).toBeInTheDocument();
	});

	it('renderiza label "NgRx" e actionType para storeKind=ngrx', () => {
		render(
			<StateInspector
				events={[
					{
						type: 'state',
						timestamp: 1,
						phaseId: 'p',
						storeKind: 'ngrx',
						storeId: 'root',
						actionType: '[Counter] Increment',
						diff: { before: { c: 0 }, after: { c: 1 } },
					},
				]}
			/>,
		);
		expect(screen.getByText(/NgRx/)).toBeInTheDocument();
		expect(screen.getByText(/\[Counter\] Increment/)).toBeInTheDocument();
	});
});
```

### Step 7.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/recording/__tests__/StateInspector.test.tsx
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/components/recording/StateInspector.tsx app/src/components/recording/EnvironmentPhases.tsx app/src/components/recording/__tests__/StateInspector.test.tsx
git commit -m "feat(session): UI render angular-signal/ngrx no StateInspector + tooltip atualizado"
```

---

## Self-Review Checklist

- [ ] **Spec coverage Phase 5 (seção 6):**
  - HttpClient hook via `XMLHttpRequest.open` com `client: 'angular-http'` ✓ (Task 2)
  - Detecção via `window.ng?.getComponent` + heurística DOM ✓ (Tasks 2 e 3)
  - Signals via tap (`set`/`update`) com `confidence: 'low'` quando interno inacessível ✓ (Task 3)
  - NgRx via `__NGRX_DEVTOOLS__` ou `__STORE__` wrapping `dispatch` ✓ (Task 4)
  - `treatment: 'tracked'` para Angular HttpClient/NgRx/Signals ✓ (Task 6)
  - `StateInspector` renderiza novos `storeKind` ✓ (Task 7)
  - Tooltip de Environment Phases sem "(detection-only)" pra essas libs ✓ (Task 7)

- [ ] **No-fallbacks check:**
  - HttpClient tag não match → silêncio + log debug; NÃO inventa requestId.
  - Signals tap não consegue wrappar → não emite detection (`angular-signal` não aparece no fingerprint).
  - NgRx sem dispatch wrappable → tap retorna `null`, detector não reporta.
  - Importer continuará rejeitando schemas inválidos (sem mudança).

- [ ] **CLAUDE.md compliance:**
  - Indentação tabs (size 2).
  - Strings/comentários em pt-BR.
  - Tests co-located em `__tests__/`.
  - Comandos npm rodam com `cd app`.
  - Sem emojis em código (UI usa lucide-react ou texto).

- [ ] **Phase 4 dependency check:** Antes de começar, confirmar que a infra `StateChangeEvent` + bridge `stateChange` + `StateInspector` base estão em main. Se Phase 4 não tiver merged ainda, marcar Phase 5 como bloqueada e rebase ao mergear.

---

## Pontos abertos pra Phase 6 / follow-up

- Capturar request body de `XMLHttpRequest.send` para Angular HttpClient (paralelo ao que fetch hook faz). Hoje só taggeamos; body continua vindo do CDP Fetch domain.
- Signals com `effect()` e `computed()` não são capturados — apenas writable signals via `set`/`update`. Phase 6 ou follow-up pode adicionar tap em `effect`.
- NgRx ComponentStore (escopo local) não é detectado por `__STORE__`; precisa hook em `@ngrx/component-store` específico — issue separada.
- `confidence` no `StateChangeEvent` ainda é informativo: UI não diferencia visualmente. Spec Phase 6 deve definir tratamento (badge "low confidence"?).
- Mascaramento de payload (Authorization, cookies em tags `angular-http`) — Phase 6 (privacy) cobre.
