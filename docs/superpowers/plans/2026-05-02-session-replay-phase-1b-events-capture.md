# Session Replay — Phase 1b: Events Capture (Console + Network + Route + Error + Hard Limits)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar todos os eventos relevantes (network, console, route, error) na sessão ativa, aplicar hard limits 50MB/10min com encerramento automático, registrar telemetria local. Após Phase 1b, o `.dbsession` tem corpo completo de eventos (faltando só rrwebEvents da Phase 2 e stateKeyframes da Phase 4).

**Architecture:** Background recebe os eventos via canais já existentes (`Fetch.requestPaused`, `chrome.webNavigation.onCommitted`) e novos (`Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded` via CDP), normaliza pra `SessionEvent` typed e chama `recorder.addEvent`. Recorder mantém contador de bytes em memória por sessão ativa, dispara auto-stop ao bater limite. Coalesce de console idênticas consecutivas é aplicado dentro do `addEvent`.

**Tech Stack:** TypeScript strict, Vitest, Vite, CDP via `chrome.debugger` (já attached pela interceptação atual).

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` (seções 5 hard limits, 7-bis Console Capture, 10 modelo de dados, 11 indicadores visuais).

---

## File Structure

**Modify:**
- `app/src/lib/session/types.ts` — adicionar variantes ao `SessionEvent` union (`NetworkEvent`, `ConsoleEvent`, `RouteChangeEvent`, `ErrorEvent`), tipos auxiliares (`ConsoleArgPreview`, `SessionTelemetry`), novos campos opcionais em `Session` (`telemetry?`)
- `app/src/lib/session/recorder.ts` — novo método `addEvent(sessionId, event)` com coalesce + hard limit check + auto-stop + telemetria
- `app/src/entrypoints/background.ts` — ativar `Runtime.enable` + `Log.enable` no debugger quando há sessão ativa, handlers de `Runtime.consoleAPICalled` / `Runtime.exceptionThrown` / `Log.entryAdded`, integração de `handleRequestPaused` com `recorder.addEvent`, emissão de `RouteChangeEvent` em `webNavigation.onCommitted`

**Create:**
- `app/src/lib/session/coalesce.ts` — helper `tryCoalesceConsole(prev, next)` retornando `{ coalesced: true, event: ConsoleEvent } | { coalesced: false }`
- `app/src/lib/session/sizeEstimate.ts` — `estimateEventBytes(event)` — heurística rápida via JSON.stringify length pra contador de hard limit

**Test (co-located):**
- `app/src/lib/session/__tests__/coalesce.test.ts`
- `app/src/lib/session/__tests__/sizeEstimate.test.ts`
- `app/src/lib/session/__tests__/recorder.test.ts` (estender — addEvent, hard limits, telemetria)

---

## Decisões de design

**Hard limits memória vs persistência:** contador `bytes` e `startedAt` ficam em **`Map<sessionId, { bytes, startedAt }>` em memória do recorder** (não persistem em IndexedDB). Service worker recycling pode perder o contador, mas no próximo `addEvent` ele é reconstruído via `JSON.stringify(session).length`. Custo aceitável (recálculo raro).

**Telemetry persistência:** quando hard limit dispara, gravamos `Session.telemetry: SessionTelemetry` no IndexedDB junto com o `endedAt` final. Telemetria é dado da sessão, não enviada externamente.

**Console coalesce:** dois `ConsoleEvent` são "idênticos consecutivos" se: mesmo `level`, mesmo `source`, mesma `description` agregada (concat dos `args[].description` separados por espaço). Stack trace e timestamp não entram na comparação. Coalesce mantém o primeiro evento e incrementa `coalesceCount`.

**Runtime.enable / Log.enable scope:** ativados quando há sessão ativa pra tab debugada. Desativados quando sessão encerra. Modo passivo (Interceptação on, Gravação off) NÃO ativa Runtime/Log — só Smart Detection + antipatterns rodam (antipatterns vêm em Phase 3).

**ErrorEvent vs ConsoleEvent:** `Runtime.exceptionThrown` vira **ErrorEvent dedicado** (não ConsoleEvent). Distinção semântica: `console.error('msg', err)` é ConsoleEvent; uncaught exception é ErrorEvent. Permite UI futura mostrar separadamente.

**Network event encaminhamento:** dentro de `handleRequestPaused`, depois de persistir em `allRequests` (caminho atual), checamos se há sessão ativa pra `targetTabId` e emitimos `NetworkEvent` via `recorder.addEvent`. Reusa o `bodyRef` que já vai pra IndexedDB (não duplica payload).

**RouteChangeEvent:** emitido em `chrome.webNavigation.onCommitted` (mesmo handler que dispara `probeStartDetection`). Além disso, SPA route changes (pushstate/replacestate/popstate) também viram RouteChangeEvent — encaminhados via `pageDetected` que já chega do bridge. Decisão: `pageDetected` handler emite tanto detection event (já faz) quanto RouteChangeEvent.

---

## Task 1: Tipos novos em `types.ts`

**Files:**
- Modify: `app/src/lib/session/types.ts`

- [ ] **Step 1: Estender o union `SessionEvent` + adicionar tipos auxiliares**

Em `app/src/lib/session/types.ts`, manter tudo que está e adicionar (após `DetectionPhase`):

```ts
export type ConsoleSource = 'app' | 'browser' | 'security';

export type ConsoleLevel =
	| 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace'
	| 'dir' | 'table' | 'group' | 'groupCollapsed' | 'groupEnd'
	| 'count' | 'countReset' | 'assert'
	| 'time' | 'timeEnd' | 'timeLog' | 'clear';

export interface ConsoleArgPreview {
	type: 'string' | 'number' | 'boolean' | 'undefined' | 'null' | 'object' | 'function' | 'symbol';
	description: string;
	preview?: {
		properties: Array<{ name: string; type: string; value?: string }>;
		overflow: boolean;
	};
}

export interface ConsoleStackFrame {
	url: string;
	lineNumber: number;
	columnNumber: number;
	functionName: string;
}

export interface SessionTelemetry {
	hitHardLimit: boolean;
	hardLimitReason?: 'size' | 'time';
	endedSizeBytes: number;
	endedDurationMs: number;
	navigationCount: number;
}
```

Substituir o `SessionEvent` union (atualmente só `detection`) por:

```ts
export type SessionEvent =
	| { type: 'detection'; timestamp: number; phaseId: string }
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
		}
	| {
			type: 'console';
			timestamp: number;
			phaseId: string;
			source: ConsoleSource;
			level: ConsoleLevel;
			args: ConsoleArgPreview[];
			stackTrace?: { frames: ConsoleStackFrame[] };
			coalesceCount?: number;
		}
	| {
			type: 'route';
			timestamp: number;
			phaseId: string;
			url: string;
			triggerType: PageDetectionTrigger;
		}
	| {
			type: 'error';
			timestamp: number;
			phaseId: string;
			message: string;
			stackTrace?: { frames: ConsoleStackFrame[] };
		};
```

E em `Session`:

```ts
export interface Session {
	id: string;
	schemaVersion: 1;
	startedAt: number;
	endedAt: number | null;
	origin: SessionOrigin;
	tabId: number;
	metadata: SessionMetadata;
	detectionPhases: DetectionPhase[];
	events: SessionEvent[];
	telemetry?: SessionTelemetry;  // novo: setado quando hard limit dispara
}
```

- [ ] **Step 2: tsc + lint + commit**

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
git add app/src/lib/session/types.ts
git commit -m "feat(session): tipos network/console/route/error + telemetry"
```

---

## Task 2: Coalesce helper

**Files:**
- Create: `app/src/lib/session/coalesce.ts`
- Test: `app/src/lib/session/__tests__/coalesce.test.ts`

- [ ] **Step 1: Test**

`app/src/lib/session/__tests__/coalesce.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tryCoalesceConsole } from '../coalesce';
import type { SessionEvent } from '../types';

const ce = (overrides: Partial<Extract<SessionEvent, { type: 'console' }>> = {}): Extract<SessionEvent, { type: 'console' }> => ({
	type: 'console',
	timestamp: 0,
	phaseId: 'p1',
	source: 'app',
	level: 'log',
	args: [{ type: 'string', description: 'hello' }],
	...overrides,
});

describe('tryCoalesceConsole', () => {
	it('coalesce dois consoles idênticos consecutivos', () => {
		const prev = ce({ timestamp: 1 });
		const next = ce({ timestamp: 2 });
		const out = tryCoalesceConsole(prev, next);
		expect(out.coalesced).toBe(true);
		if (out.coalesced) {
			expect(out.event.coalesceCount).toBe(2);
			expect(out.event.timestamp).toBe(1); // primeiro
		}
	});

	it('incrementa coalesceCount quando prev já está coalescido', () => {
		const prev = ce({ timestamp: 1, coalesceCount: 5 });
		const next = ce({ timestamp: 6 });
		const out = tryCoalesceConsole(prev, next);
		expect(out.coalesced).toBe(true);
		if (out.coalesced) expect(out.event.coalesceCount).toBe(6);
	});

	it('não coalesce quando level difere', () => {
		const prev = ce({ level: 'log' });
		const next = ce({ level: 'warn' });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});

	it('não coalesce quando source difere', () => {
		const prev = ce({ source: 'app' });
		const next = ce({ source: 'browser' });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});

	it('não coalesce quando args description difere', () => {
		const prev = ce({ args: [{ type: 'string', description: 'a' }] });
		const next = ce({ args: [{ type: 'string', description: 'b' }] });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});

	it('coalesce ignorando timestamp e stackTrace', () => {
		const prev = ce({
			timestamp: 1,
			stackTrace: { frames: [{ url: 'a.js', lineNumber: 1, columnNumber: 1, functionName: 'f' }] },
		});
		const next = ce({ timestamp: 999 });
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(true);
	});

	it('não coalesce quando prev não é console event', () => {
		const prev: SessionEvent = { type: 'detection', timestamp: 1, phaseId: 'p' };
		const next = ce();
		expect(tryCoalesceConsole(prev, next).coalesced).toBe(false);
	});
});
```

- [ ] **Step 2: Implementar**

`app/src/lib/session/coalesce.ts`:

```ts
import type { ConsoleArgPreview, SessionEvent } from './types';

type ConsoleEv = Extract<SessionEvent, { type: 'console' }>;

export type CoalesceResult =
	| { coalesced: true; event: ConsoleEv }
	| { coalesced: false };

function argsDescriptionKey(args: ConsoleArgPreview[]): string {
	return args.map((a) => `${a.type}:${a.description}`).join('|');
}

function isConsole(ev: SessionEvent): ev is ConsoleEv {
	return ev.type === 'console';
}

export function tryCoalesceConsole(prev: SessionEvent, next: ConsoleEv): CoalesceResult {
	if (!isConsole(prev)) return { coalesced: false };
	if (prev.level !== next.level) return { coalesced: false };
	if (prev.source !== next.source) return { coalesced: false };
	if (prev.phaseId !== next.phaseId) return { coalesced: false };
	if (argsDescriptionKey(prev.args) !== argsDescriptionKey(next.args)) {
		return { coalesced: false };
	}
	const merged: ConsoleEv = {
		...prev,
		coalesceCount: (prev.coalesceCount ?? 1) + 1,
	};
	return { coalesced: true, event: merged };
}
```

- [ ] **Step 3: Validate + commit**

```bash
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/coalesce.test.ts
git add app/src/lib/session/coalesce.ts app/src/lib/session/__tests__/coalesce.test.ts
git commit -m "feat(session): coalesce de console idênticos consecutivos"
```

---

## Task 3: Estimador de bytes por evento

**Files:**
- Create: `app/src/lib/session/sizeEstimate.ts`
- Test: `app/src/lib/session/__tests__/sizeEstimate.test.ts`

- [ ] **Step 1: Test**

`app/src/lib/session/__tests__/sizeEstimate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { estimateEventBytes } from '../sizeEstimate';
import type { SessionEvent } from '../types';

describe('estimateEventBytes', () => {
	it('detection event tem tamanho pequeno', () => {
		const ev: SessionEvent = { type: 'detection', timestamp: 1, phaseId: 'p' };
		expect(estimateEventBytes(ev)).toBeGreaterThan(0);
		expect(estimateEventBytes(ev)).toBeLessThan(200);
	});

	it('network event maior que detection (mais campos)', () => {
		const detection: SessionEvent = { type: 'detection', timestamp: 1, phaseId: 'p' };
		const network: SessionEvent = {
			type: 'network',
			timestamp: 1,
			phaseId: 'p',
			requestId: 'r1',
			method: 'GET',
			url: 'https://example.com/api/users?id=42&format=json',
			status: 200,
			durationMs: 123,
			bodyRef: 'blob:abc',
		};
		expect(estimateEventBytes(network)).toBeGreaterThan(estimateEventBytes(detection));
	});

	it('console com payload longo aumenta tamanho', () => {
		const small: SessionEvent = {
			type: 'console',
			timestamp: 1,
			phaseId: 'p',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'hi' }],
		};
		const big: SessionEvent = {
			type: 'console',
			timestamp: 1,
			phaseId: 'p',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'x'.repeat(5000) }],
		};
		expect(estimateEventBytes(big)).toBeGreaterThan(estimateEventBytes(small) + 4000);
	});
});
```

- [ ] **Step 2: Implementar**

`app/src/lib/session/sizeEstimate.ts`:

```ts
import type { SessionEvent } from './types';

// Estimativa rápida via JSON.stringify. Usado pelo recorder pra contar bytes
// acumulados na sessão e disparar hard limit. Não precisa ser exato — só
// monotônico e proporcional ao payload real persistido em IndexedDB.
export function estimateEventBytes(event: SessionEvent): number {
	return JSON.stringify(event).length;
}
```

- [ ] **Step 3: Validate + commit**

```bash
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/sizeEstimate.test.ts
git add app/src/lib/session/sizeEstimate.ts app/src/lib/session/__tests__/sizeEstimate.test.ts
git commit -m "feat(session): estimador de bytes por evento (heurística JSON.stringify)"
```

---

## Task 4: Recorder.addEvent + hard limits + telemetria

**Files:**
- Modify: `app/src/lib/session/recorder.ts`
- Modify: `app/src/lib/session/__tests__/recorder.test.ts`

- [ ] **Step 1: Adicionar testes ao recorder.test.ts**

Adicionar no final do `describe('recorder', ...)`:

```ts
	it('addEvent persiste evento e atualiza session.events', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		await recorder.addEvent(id, {
			type: 'network',
			timestamp: 11,
			phaseId,
			requestId: 'r1',
			method: 'GET',
			url: 'https://api/x',
			status: 200,
		});
		const got = await sessionStore.get(id);
		const networkEvents = got!.events.filter((e) => e.type === 'network');
		expect(networkEvents).toHaveLength(1);
	});

	it('addEvent coalesce 2 console idênticos consecutivos em 1 entrada com count=2', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		const baseConsole = {
			type: 'console' as const,
			phaseId,
			source: 'app' as const,
			level: 'log' as const,
			args: [{ type: 'string' as const, description: 'rendered' }],
		};
		await recorder.addEvent(id, { ...baseConsole, timestamp: 11 });
		await recorder.addEvent(id, { ...baseConsole, timestamp: 12 });
		const got = await sessionStore.get(id);
		const consoleEvents = got!.events.filter((e) => e.type === 'console');
		expect(consoleEvents).toHaveLength(1);
		const first = consoleEvents[0];
		if (first.type !== 'console') throw new Error('expected console');
		expect(first.coalesceCount).toBe(2);
	});

	it('addEvent dispara auto-stop quando ultrapassa SIZE_LIMIT_BYTES', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		// Bota o limite muito baixo via _setLimitsForTests pra testar trigger.
		recorder._setLimitsForTests({ sizeBytes: 500, durationMs: 60_000 });
		try {
			for (let i = 0; i < 100; i++) {
				await recorder.addEvent(id, {
					type: 'console',
					timestamp: 11 + i,
					phaseId,
					source: 'app',
					level: 'log',
					args: [{ type: 'string', description: `n${i}` }],
				});
			}
		} catch {
			// Auto-stop pode rejeitar adicions posteriores; ignorar nesse loop.
		}
		const got = await sessionStore.get(id);
		expect(got!.endedAt).not.toBeNull();
		expect(got!.telemetry?.hitHardLimit).toBe(true);
		expect(got!.telemetry?.hardLimitReason).toBe('size');
	} );

	it('addEvent dispara auto-stop quando ultrapassa DURATION_LIMIT_MS', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		// Limite de duração 1ms — qualquer evento depois disparou hard limit.
		recorder._setLimitsForTests({ sizeBytes: 50_000_000, durationMs: 1 });
		await new Promise((r) => setTimeout(r, 10));
		await recorder.addEvent(id, {
			type: 'console',
			timestamp: 100,
			phaseId,
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'late' }],
		});
		const got = await sessionStore.get(id);
		expect(got!.endedAt).not.toBeNull();
		expect(got!.telemetry?.hardLimitReason).toBe('time');
	});
```

Adicionar `afterEach` que reseta limites:

```ts
afterEach(async () => {
	recorder._resetLimitsForTests();
	await sessionStore.clear();
});
```

(Substituir o `afterEach` atual.)

- [ ] **Step 2: Implementar `addEvent` + hard limits no recorder**

Em `app/src/lib/session/recorder.ts`, adicionar imports:

```ts
import { tryCoalesceConsole } from './coalesce';
import { estimateEventBytes } from './sizeEstimate';
```

Adicionar (no escopo de módulo, antes do `export const recorder`):

```ts
const DEFAULT_SIZE_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_DURATION_LIMIT_MS = 10 * 60 * 1000;  // 10 min

let sizeLimitBytes = DEFAULT_SIZE_LIMIT_BYTES;
let durationLimitMs = DEFAULT_DURATION_LIMIT_MS;

interface SessionRuntime {
	bytes: number;
	startedAt: number;
	navigationCount: number;
}
const runtime = new Map<string, SessionRuntime>();

function getOrInitRuntime(sessionId: string, session: Session): SessionRuntime {
	let r = runtime.get(sessionId);
	if (!r) {
		// Reconstruir após service worker recycle
		r = {
			bytes: JSON.stringify(session).length,
			startedAt: session.startedAt,
			navigationCount: session.events.filter((e) => e.type === 'route').length,
		};
		runtime.set(sessionId, r);
	}
	return r;
}

async function autoStop(
	session: Session,
	reason: 'size' | 'time',
	r: SessionRuntime,
): Promise<void> {
	session.endedAt = Date.now();
	session.telemetry = {
		hitHardLimit: true,
		hardLimitReason: reason,
		endedSizeBytes: r.bytes,
		endedDurationMs: session.endedAt - r.startedAt,
		navigationCount: r.navigationCount,
	};
	await sessionStore.put(session);
	runtime.delete(session.id);
}
```

Adicionar método `addEvent` no objeto `recorder`:

```ts
	async addEvent(sessionId: string, event: SessionEvent): Promise<void> {
		const s = await sessionStore.get(sessionId);
		if (!s) throw new Error(`Session ${sessionId} não encontrada`);
		if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);

		const r = getOrInitRuntime(sessionId, s);

		// Coalesce console idênticos consecutivos
		if (event.type === 'console') {
			const last = s.events[s.events.length - 1];
			if (last) {
				const result = tryCoalesceConsole(last, event);
				if (result.coalesced) {
					s.events[s.events.length - 1] = result.event;
					// Não cresce bytes (coalesce só atualiza count na entrada existente)
					await sessionStore.put(s);
					return;
				}
			}
		}

		s.events.push(event);
		if (event.type === 'route') r.navigationCount++;
		r.bytes += estimateEventBytes(event);

		// Hard limit checks (ordem: size primeiro porque é o mais comum)
		if (r.bytes >= sizeLimitBytes) {
			await autoStop(s, 'size', r);
			return;
		}
		const duration = Date.now() - r.startedAt;
		if (duration >= durationLimitMs) {
			await autoStop(s, 'time', r);
			return;
		}

		await sessionStore.put(s);
	},
```

Atualizar `stopSession` pra limpar runtime cache:

```ts
	async stopSession(id: string): Promise<void> {
		const s = await sessionStore.get(id);
		if (!s) throw new Error(`Session ${id} não encontrada`);
		// Idempotente por design: background pode chamar stopSession em tab close
		// sem precisar saber se a sessão já foi encerrada antes (ex: usuário ja
		// clicou em "Parar gravação"). Não-encontrada continua erro.
		if (s.endedAt !== null) return;
		s.endedAt = Date.now();
		runtime.delete(id);
		await sessionStore.put(s);
	},
```

E expor helpers de teste:

```ts
	_setLimitsForTests(limits: { sizeBytes: number; durationMs: number }): void {
		sizeLimitBytes = limits.sizeBytes;
		durationLimitMs = limits.durationMs;
	},

	_resetLimitsForTests(): void {
		sizeLimitBytes = DEFAULT_SIZE_LIMIT_BYTES;
		durationLimitMs = DEFAULT_DURATION_LIMIT_MS;
		runtime.clear();
	},
```

- [ ] **Step 3: Validate + commit**

```bash
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/recorder.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.test.ts
git commit -m "feat(session): recorder.addEvent com coalesce + hard limits + telemetria"
```

---

## Task 5: Background — Runtime + Log enable + handlers

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Ativar Runtime + Log quando session inicia**

No handler `__debug_startSession`, depois de `recorder.startSession` e antes de `chrome.tabs.sendMessage(probeStartDetection)`, ativar os domains via CDP:

```ts
await chrome.debugger.sendCommand({ tabId: message.tabId }, 'Runtime.enable');
await chrome.debugger.sendCommand({ tabId: message.tabId }, 'Log.enable');
```

> **Atenção:** `chrome.debugger.attach` deve ter sido feito antes (pela feature de interceptação atual). Se não está attached, esses comandos lançam. Documente: Phase 1a entrega `__debug_startSession` que assume que a interceptação já está rodando na tab. Se não está, retorne `{ ok: false, error: 'Interceptação não está ativa nesta tab' }`. Adicione um check antes:

```ts
const debuggee = { tabId: message.tabId };
const targets = await chrome.debugger.getTargets();
const attached = targets.find((t) => t.tabId === message.tabId && t.attached);
if (!attached) {
	sendResponse({ ok: false, error: 'Interceptação não está ativa nesta tab' });
	return;
}
```

- [ ] **Step 2: Listener `chrome.debugger.onEvent`**

Já deve existir um handler `chrome.debugger.onEvent` no background pra `Fetch.requestPaused`. Adicionar branches pros novos events. Pseudo-código (ajustar pelo padrão real):

```ts
chrome.debugger.onEvent.addListener(async (source, method, params) => {
	if (source.tabId === undefined) return;
	const session = await recorder.getActiveByTab(source.tabId);

	// ... handler existente de Fetch.requestPaused ...

	if (session && method === 'Runtime.consoleAPICalled') {
		await handleConsoleAPI(session, params as Protocol.Runtime.ConsoleAPICalledEvent);
	} else if (session && method === 'Runtime.exceptionThrown') {
		await handleExceptionThrown(session, params as Protocol.Runtime.ExceptionThrownEvent);
	} else if (session && method === 'Log.entryAdded') {
		await handleLogEntry(session, params as Protocol.Log.EntryAddedEvent);
	}
});
```

- [ ] **Step 3: Handler `Runtime.consoleAPICalled` → ConsoleEvent**

```ts
import type { Protocol } from 'devtools-protocol/types/protocol';
import type { ConsoleArgPreview, ConsoleLevel, ConsoleStackFrame, SessionEvent } from '@/lib/session/types';

function mapConsoleApiType(type: Protocol.Runtime.ConsoleAPICalledEventType): ConsoleLevel {
	const map: Record<string, ConsoleLevel> = {
		log: 'log', debug: 'debug', info: 'info', error: 'error', warning: 'warn',
		dir: 'dir', dirxml: 'dir', table: 'table', trace: 'trace',
		clear: 'clear', startGroup: 'group', startGroupCollapsed: 'groupCollapsed',
		endGroup: 'groupEnd', assert: 'assert', profile: 'log', profileEnd: 'log',
		count: 'count', timeEnd: 'timeEnd',
	};
	return map[type] ?? 'log';
}

function toArgPreview(obj: Protocol.Runtime.RemoteObject): ConsoleArgPreview {
	const out: ConsoleArgPreview = {
		type: (obj.type ?? 'string') as ConsoleArgPreview['type'],
		description: obj.description ?? String(obj.value ?? ''),
	};
	if (obj.preview) {
		out.preview = {
			properties: obj.preview.properties.map((p) => ({
				name: p.name,
				type: p.type,
				value: p.value,
			})),
			overflow: obj.preview.overflow ?? false,
		};
	}
	return out;
}

function toStackFrames(stack?: Protocol.Runtime.StackTrace): { frames: ConsoleStackFrame[] } | undefined {
	if (!stack) return undefined;
	return {
		frames: stack.callFrames.map((f) => ({
			url: f.url,
			lineNumber: f.lineNumber,
			columnNumber: f.columnNumber,
			functionName: f.functionName,
		})),
	};
}

function currentPhaseId(session: Session): string {
	const last = session.detectionPhases[session.detectionPhases.length - 1];
	return last?.id ?? 'no-phase';
}

async function handleConsoleAPI(
	session: Session,
	params: Protocol.Runtime.ConsoleAPICalledEvent,
): Promise<void> {
	const event: SessionEvent = {
		type: 'console',
		timestamp: params.timestamp,
		phaseId: currentPhaseId(session),
		source: 'app',
		level: mapConsoleApiType(params.type),
		args: params.args.map(toArgPreview),
		stackTrace: toStackFrames(params.stackTrace),
	};
	try {
		await recorder.addEvent(session.id, event);
	} catch (err) {
		console.warn('[session] addEvent console falhou:', err);
	}
}
```

- [ ] **Step 4: Handler `Runtime.exceptionThrown` → ErrorEvent**

```ts
async function handleExceptionThrown(
	session: Session,
	params: Protocol.Runtime.ExceptionThrownEvent,
): Promise<void> {
	const det = params.exceptionDetails;
	const message = det.exception?.description ?? det.text ?? 'Exception';
	const event: SessionEvent = {
		type: 'error',
		timestamp: params.timestamp,
		phaseId: currentPhaseId(session),
		message,
		stackTrace: toStackFrames(det.stackTrace),
	};
	try {
		await recorder.addEvent(session.id, event);
	} catch (err) {
		console.warn('[session] addEvent error falhou:', err);
	}
}
```

- [ ] **Step 5: Handler `Log.entryAdded` → ConsoleEvent**

```ts
function mapLogLevel(level: Protocol.Log.LogEntryLevel): ConsoleLevel {
	if (level === 'error') return 'error';
	if (level === 'warning') return 'warn';
	if (level === 'info') return 'info';
	return 'debug';
}

function mapLogSource(source: Protocol.Log.LogEntrySource): 'browser' | 'security' {
	return source === 'security' ? 'security' : 'browser';
}

async function handleLogEntry(
	session: Session,
	params: Protocol.Log.EntryAddedEvent,
): Promise<void> {
	const e = params.entry;
	const event: SessionEvent = {
		type: 'console',
		timestamp: e.timestamp,
		phaseId: currentPhaseId(session),
		source: mapLogSource(e.source),
		level: mapLogLevel(e.level),
		args: [{ type: 'string', description: e.text }],
		stackTrace: toStackFrames(e.stackTrace),
	};
	try {
		await recorder.addEvent(session.id, event);
	} catch (err) {
		console.warn('[session] addEvent log falhou:', err);
	}
}
```

- [ ] **Step 6: Disable Runtime + Log no stopSession (best-effort)**

No handler `__debug_stopSession`, depois de `recorder.stopSession` e antes do `probeIdle` (que já existe), tentar desativar:

```ts
if (session?.tabId !== undefined) {
	try {
		await chrome.debugger.sendCommand({ tabId: session.tabId }, 'Runtime.disable');
		await chrome.debugger.sendCommand({ tabId: session.tabId }, 'Log.disable');
	} catch {
		// Debugger pode ter detached entre stopSession e disable; ignorar.
	}
	// ... probeIdle existente ...
}
```

- [ ] **Step 7: Validate + commit**

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/entrypoints/background.ts
git commit -m "feat(session): captura console+exception+log via CDP Runtime/Log domains"
```

> **Pacote `devtools-protocol`** já é dependência transitiva (vem com @types/chrome). Se faltar, rodar `npm install --save-dev devtools-protocol`.

---

## Task 6: Background — encaminhamento de network events

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Ler o caminho atual de `Fetch.requestPaused`**

Localizar `handleRequestPaused` (ou nome similar) e o ponto onde request finalizada vai pra `allRequests` + IndexedDB. Após esse ponto, adicionar emissão pro recorder.

- [ ] **Step 2: Emitir NetworkEvent quando há sessão ativa**

Pseudo-código (ajustar pelo padrão real do projeto):

```ts
// Dentro de handleRequestPaused (ou onde request é finalizada):
const session = await recorder.getActiveByTab(targetTabId);
if (session) {
	try {
		await recorder.addEvent(session.id, {
			type: 'network',
			timestamp: response.timestamp,
			phaseId: currentPhaseId(session),
			requestId: response.id,
			method: response.method,
			url: response.url,
			status: response.status,
			durationMs: response.duration,
			bodyRef: response.bodyRef,
		});
	} catch (err) {
		console.warn('[session] addEvent network falhou:', err);
	}
}
```

> **Atenção:** o `bodyRef` reusa o que já é gravado em `requests` store. Não duplicar o blob no novo store. Verifique como `bodyRef` é gerado hoje em `persistRequest` e use o mesmo.

> **Sobre duration assíncrono:** o projeto tem `NetworkTimingTracker` que emite `onDurationReady` depois. Pra Phase 1b, gravamos NetworkEvent inicial sem `durationMs` (campo opcional) e atualizamos via `patchRequest` quando duration chega. Solução simples: emitir NetworkEvent sem durationMs no primeiro persist; em `patchRequest`, se há sessão ativa e o requestId bate, achar o NetworkEvent na session e atualizar in-place (mutação OK pelo single-threaded background).

- [ ] **Step 3: Validate + commit**

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/entrypoints/background.ts
git commit -m "feat(session): encaminha network events de Fetch.requestPaused pra recorder"
```

---

## Task 7: Background — RouteChangeEvent em webNavigation + pageDetected

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Emitir RouteChangeEvent em webNavigation.onCommitted**

No listener atual (que faz `probeStartDetection`), adicionar antes:

```ts
chrome.webNavigation.onCommitted.addListener(async (details) => {
	if (details.frameId !== 0) return;
	const session = await recorder.getActiveByTab(details.tabId);
	if (!session) return;

	// 1. Emitir RouteChangeEvent
	try {
		await recorder.addEvent(session.id, {
			type: 'route',
			timestamp: details.timeStamp,
			phaseId: currentPhaseId(session),
			url: details.url,
			triggerType: 'navigation',
		});
	} catch (err) {
		console.warn('[session] addEvent route falhou:', err);
	}

	// 2. Existing probeStartDetection (mantém)
	try {
		await chrome.tabs.sendMessage(details.tabId, {
			action: 'probeStartDetection',
			reason: 'navigation',
		});
	} catch (err) {
		// ... handler existente de erros esperados ...
	}
});
```

- [ ] **Step 2: SPA route changes via pageDetected**

No handler `pageDetected` (já existente em background.ts), adicionar emissão de RouteChangeEvent além de chamar `recorder.addPage`:

```ts
if (message.action === 'pageDetected') {
	(async () => {
		const tabId = sender?.tab?.id;
		if (tabId === undefined) {
			sendResponse({ ok: false, reason: 'no tab id in sender' });
			return;
		}
		const session = await recorder.getActiveByTab(tabId);
		if (!session) {
			sendResponse({ ok: false, reason: 'no active session for tab' });
			return;
		}
		try {
			const detection: PageDetection = { ...message.payload };
			await recorder.addPage(session.id, detection);
			// Emite RouteChangeEvent com mesmo trigger do probe (pushstate, replacestate, popstate, initial)
			const updated = await recorder.getActiveByTab(tabId);
			if (updated) {
				await recorder.addEvent(updated.id, {
					type: 'route',
					timestamp: message.payload.timestamp,
					phaseId: currentPhaseId(updated),
					url: message.payload.url,
					triggerType: message.payload.triggerType,
				});
			}
			sendResponse({ ok: true });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

> **Nota:** `recorder.addPage` faz `sessionStore.put`; `recorder.addEvent` faz outro put. 2 writes consecutivas. Pra Phase 1b é aceitável; se virar gargalo, futuro pode juntar em uma transação.

- [ ] **Step 3: Validate + commit**

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/entrypoints/background.ts
git commit -m "feat(session): RouteChangeEvent em webNavigation e SPA route changes"
```

---

## Self-Review Checklist (rodar antes de fechar Phase 1b)

- [ ] **Spec coverage:**
  - Hard limits 50MB/10min com auto-stop ✓ (Task 4)
  - Telemetry local ✓ (Task 4)
  - Console capture via Runtime+Log + coalesce ✓ (Tasks 2, 5)
  - Network event encaminhamento ✓ (Task 6)
  - Route + Error events ✓ (Tasks 5, 7)

- [ ] **Placeholder scan:** zero TBDs.

- [ ] **Type consistency:** `SessionEvent` union tem 5 variants em todos os arquivos.

- [ ] **No fallbacks check:** catch silencioso só em pontos limpos (chrome.debugger disable best-effort, sendMessage tab fechada). Erro de addEvent é logado em warn, não swallowed.

---

## Pontos abertos para revalidar adiante

- Coalesce só funciona pra console **idênticos**. Mensagens variáveis em loop ("rendered #1", "rendered #2") escapam — antipattern `console-flood` futuro mitiga (Phase 3).
- Hard limit check usa estimateEventBytes (heurística JSON.stringify), não bytes reais persistidos. Diferença é pequena (overhead de IndexedDB ~5%), aceitável.
- Após auto-stop, NetworkTimingTracker pode tentar `patchRequest` numa sessão encerrada. Verificar que `recorder.addEvent` rejeita corretamente (ver Tarefa 4 — `if (s.endedAt !== null) throw`).
- `Runtime.disable`/`Log.disable` no stopSession é best-effort — se chrome.debugger detacha antes (ex: usuário stops interception), os disable falham silenciosamente. Aceitável (sem leak — quando re-attach, Runtime.enable do próximo `__debug_startSession` reconfigura).
