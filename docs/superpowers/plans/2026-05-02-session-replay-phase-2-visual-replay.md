# Session Replay — Phase 2: Visual Replay (rrweb)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar captura visual completa via `rrweb` (DOM/mouse/input/scroll) à gravação de sessão. ReplayPage ganha layout 2-colunas com `rrweb-player` (~65% à esquerda) e abas timeline/console (à direita) sincronizados por scrubbing. Viewer.html standalone passa a renderizar visual offline. Canvas continua opt-in (já existe checkbox + flag `metadata.canvasCaptureEnabled`). Re-injeção em `webNavigation.onCommitted` mantém continuidade da sessão atravessando navegação.

**Architecture:** Probe novo `app/src/probe/rrwebRecorder.ts` roda como content script `ISOLATED` (NÃO `MAIN`) — `rrweb-record` precisa do DOM real e isolado evita conflito com a app debugada. Buffer de eventos rrweb em memória do isolated; flush via `chrome.runtime.sendMessage({ action: 'rrwebBatch', sessionId, events })` a cada 1s OU 100 eventos (o que vier antes). Background recebe batch e chama `recorder.addRrwebEvents(sessionId, events)` que atualiza `session.rrwebEvents` (campo opcional novo), `runtime.bytes` (conta bytes rrweb no hard limit), persiste em IndexedDB. `startRecording`/`stopRecording` despacham `__rrweb_start`/`__rrweb_stop` para o content script via `chrome.tabs.sendMessage`. Re-injeção em `webNavigation.onCommitted`: o manifest content_scripts já cobre re-rodar o script; o background dispara novo `__rrweb_start` para a sessão ativa após navegação. UI: `RrwebPlayer.tsx` faz mount imperativo de `rrweb-player`; `useReplayPlayhead` mantém `currentMs` em estado React, escuta o evento `ui-update-current-time` do player e expõe scrubbing programático. ReplayPage filtra `events` por `event.timestamp <= startedAt + currentMs`. Viewer.html embute `rrweb-player` minificado inline + sessão JSON. Replay cross-origin já roda dentro da própria UI da extensão; CSP `extension_pages` é validado para garantir que `rrweb-player` (sem `eval`) carrega; iframe sandboxed (`sandbox="allow-scripts"` + `srcDoc`) é usado para isolar o DOM reconstruído do shell da extensão e evitar contaminação de estilos.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` — seções 7 (DOM Replay Capture), 11 (UI/UX Replay Player), 14.8 (replay cross-origin via iframe sandboxed), 14.9 (drift de relógio rrweb ↔ probe), 16 (Fase 2).

---

## File Structure

**Modify:**
- `app/package.json` — adicionar `rrweb` (~v2.0.0-alpha.x) e `rrweb-player` (~v1.0.0-alpha.x) como deps.
- `app/src/lib/session/types.ts` — adicionar tipo `RrwebEvent` e campo opcional `rrwebEvents?: RrwebEvent[]` em `Session`.
- `app/src/lib/session/sizeEstimate.ts` — adicionar `estimateRrwebBytes(events): number` e exportar (recorder usa para hard limit).
- `app/src/lib/session/recorder.ts` — método `addRrwebEvents(sessionId, events)` com persistência + bytes + auto-stop.
- `app/src/lib/session/viewerTemplate.ts` — embutir `rrweb-player` inline + render visual + timeline lateral.
- `app/src/types/messages.ts` — adicionar action `rrwebBatch` (UI/probe → background) e payload `rrwebEvents`.
- `app/src/entrypoints/background.ts` — handler `rrwebBatch` + envio de `__rrweb_start`/`__rrweb_stop` ao content script em `startRecording`/`stopRecording` + re-disparo em `webNavigation.onCommitted` quando há sessão ativa.
- `app/manifest.json` — adicionar entry de content_script para `rrweb-recorder.js` (run_at `document_start`, world `ISOLATED`); validar `content_security_policy.extension_pages` (sem `unsafe-eval`).
- `app/vite.config.mts` — adicionar entry `rrweb-recorder` para o probe.
- `app/src/pages/ReplayPage.tsx` — layout 2-colunas com `RrwebPlayer` + abas timeline/console filtradas por `currentMs`; fallback "Sessão sem captura visual" quando `rrwebEvents` ausente/vazio.

**Create:**
- `app/src/probe/rrwebRecorder.ts` — content script isolado: liga `record({ recordCanvas })`, buffer + flush, listeners de `__rrweb_start`/`__rrweb_stop`.
- `app/src/components/replay/RrwebPlayer.tsx` — wrapper React que monta `rrweb-player` imperativo via `useEffect`, expõe `goto(timeMs)` / `getCurrentTime()` via `forwardRef`.
- `app/src/hooks/useReplayPlayhead.ts` — hook com `currentMs`, `setCurrentMs`, `isPlaying`, sincroniza com player via callbacks.

**Test (co-located):**
- `app/src/lib/session/__tests__/recorder-rrweb.test.ts` — `addRrwebEvents` (append, bytes, hard limit por size, sessão inexistente, encerrada).
- `app/src/lib/session/__tests__/sizeEstimate-rrweb.test.ts` — `estimateRrwebBytes`.
- `app/src/lib/session/__tests__/viewerTemplate-rrweb.test.ts` — viewer embute `rrweb-player`, JSON, eventos rrweb.
- `app/src/components/replay/__tests__/RrwebPlayer.test.tsx` — mount/unmount, prop `events`, ref `goto`/`getCurrentTime`.
- `app/src/hooks/__tests__/useReplayPlayhead.test.ts` — estado, setCurrentMs, sincronização.
- `app/src/pages/__tests__/ReplayPage.test.tsx` — fallback sem rrwebEvents, filtro por currentMs.

---

## Decisões de design

**rrweb v2 (alpha) vs v1.** v2 traz `rrweb-record` mais leve, type-safe e ESM-friendly. Bundle gzip ~50 KB. v1 é estável mas CommonJS-only com tipos parciais. Escolhemos v2 para alinhar com Vite/ESM e evitar `require` em service worker. Se v2 alpha quebrar, fallback é pin em última versão estável de v1.

**Isolated content script (NÃO MAIN-world).** `rrweb-record` precisa do DOM real (DOM API) — funciona perfeitamente no isolated. Rodar no MAIN aumentaria risco de conflito com a app (poluição de protótipos, framework devtools confusos). Continuidade com a arquitetura existente: probe MAIN faz detection/state taps; bridge ISOLATED faz relay; `rrwebRecorder.ts` fica como **terceiro content script** isolado (não compartilha global state com o bridge — isolamento por arquivo).

**Buffer + flush 1s/100 eventos.** rrweb gera ~10 eventos/s em uso típico, picos de 100+ em mutations grandes. Flush a 1s mantém UI quase real-time; flush a 100 eventos evita acumular 1MB+ de eventos numa só mensagem (chrome.runtime.sendMessage tem limite ~64MB mas serializa síncrono na origem). Não usar `port` (long-lived connection) por simplicidade — sendMessage one-shot é compatível com service worker recycling (worker rebooteia, próximo batch chega normal).

**`rrwebEvents` em campo opcional separado.** Spec é explícita (seção 10): eventos DOM/mouse/input não vão pra `events: SessionEvent[]` — vivem em `Session.rrwebEvents?: RrwebEvent[]`. Motivo: 1000 mousemove/min explodiriam a timeline lógica. `schemaVersion` permanece `1` (campo é opcional, forward/backward compat preservada).

**Bytes rrweb contam no hard limit.** `recorder.addRrwebEvents` chama `estimateRrwebBytes(events)` e soma em `runtime.bytes`. Quando atingir 50MB OU 10min, `autoStop` dispara — mesma lógica de `addEvent`. Hard limit existente já existe e continua valendo: agora ele protege também contra rrweb desenfreado em apps com canvas/animação.

**Re-injeção em `webNavigation.onCommitted`.** Manifest `content_scripts` já cobre re-injeção do JS após navegação cross-origin (Chrome roda content script no novo doc). O probe `rrwebRecorder.ts` precisa esperar `__rrweb_start` (não inicia gravando sozinho) — caso contrário gravaria *toda* tab debugada, mesmo sem sessão ativa. Background, ao detectar `webNavigation.onCommitted` com sessão ativa, re-envia `__rrweb_start` ao novo content script.

**Drift de relógio rrweb ↔ events.** rrweb timestamp usa `Date.now()` interno (configurável). Mantemos default — `events: SessionEvent[]` também usa `Date.now()` (com exceção de timestamps CDP em segundos, já tratados em `EventRow`). Drift esperado <100 ms. Spec (seção 14.9) marca como ponto a instrumentar se houver relato; não bloqueante para Fase 2.

**Replay player iframe sandboxed.** ReplayPage hospeda `RrwebPlayer` que monta `rrweb-player` em uma `<div>` interna. `rrweb-player` reconstrói o DOM gravado dentro de **seu próprio iframe** automaticamente — isolamento natural. Para isolar AINDA mais (apps que injetam `style` agressivo no parent), envolvemos o player num `<iframe sandbox="allow-scripts" srcDoc=...>`. Trade-off: srcDoc impede import direto de `rrweb-player` ESM. Escolha: **NÃO usar srcDoc no shell da extensão** — o player do `rrweb-player` JÁ cria iframe interno; basta isolar via CSS scope (`.rrweb-player-host`) e confiar no isolamento nativo. Para o **viewer.html standalone** (offline, embutido no `.dbsession`), o iframe é o próprio HTML — não precisa srcDoc adicional. Documentamos a decisão.

**CSP `extension_pages`.** `rrweb-player` v1.x não usa `eval`/`Function` em runtime de player; só `JSON.parse` + DOM mutation. Manifest atual (`extension_pages` default = `script-src 'self'; object-src 'self'`) é suficiente. Fase 2 NÃO precisa adicionar `'unsafe-eval'`. Validamos via `npm run build` + carregar em Chrome.

**No-fallbacks.** `addRrwebEvents` em sessão inexistente lança erro (não cria session silenciosa). Em sessão encerrada, lança erro (não fabrica sessão nova nem ignora). Probe que recebe `__rrweb_start` sem ter sessionId conhecido lança warn no console e ignora (não pode persistir sem id válido).

---

## Task 1: Tipos + sizeEstimate + dependências

**Files:**
- Modify: `app/package.json`
- Modify: `app/src/lib/session/types.ts`
- Modify: `app/src/lib/session/sizeEstimate.ts`
- Test: `app/src/lib/session/__tests__/sizeEstimate-rrweb.test.ts`

### Step 1.1: Instalar rrweb e rrweb-player

```bash
cd app && npm install rrweb@^2.0.0-alpha.18 rrweb-player@^1.0.0-alpha.18
```

Esperado: instalações bem-sucedidas, `package-lock.json` atualizado, sem peer-dep warnings críticos.

### Step 1.2: Adicionar tipo `RrwebEvent` e campo opcional `rrwebEvents`

Editar `app/src/lib/session/types.ts`. Adicionar acima de `Session`:

```ts
// rrweb event payload é opaco para a extensão — apenas serializa/deserializa.
// Tipagem mínima: timestamp + type + data. rrweb v2 usa enum numérico para `type`
// (0=DomContentLoaded, 1=Load, 2=FullSnapshot, 3=IncrementalSnapshot, 4=Meta, 5=Custom, 6=Plugin).
export interface RrwebEvent {
	type: number;
	data: unknown;
	timestamp: number;
}
```

E em `Session`, adicionar campo opcional logo após `events`:

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
	rrwebEvents?: RrwebEvent[];
	telemetry?: SessionTelemetry;
}
```

### Step 1.3: Adicionar `estimateRrwebBytes`

Editar `app/src/lib/session/sizeEstimate.ts` para o conteúdo abaixo:

```ts
import type { RrwebEvent, SessionEvent } from './types';

// Estimativa rápida via JSON.stringify. Usado pelo recorder pra contar bytes
// acumulados na sessão e disparar hard limit. Não precisa ser exato — só
// monotônico e proporcional ao payload real persistido em IndexedDB.
export function estimateEventBytes(event: SessionEvent): number {
	return JSON.stringify(event).length;
}

// Estima bytes de um batch de eventos rrweb. JSON.stringify do array inteiro
// é mais barato que somar por evento e captura overhead de delimitadores.
export function estimateRrwebBytes(events: RrwebEvent[]): number {
	if (events.length === 0) return 0;
	return JSON.stringify(events).length;
}
```

### Step 1.4: Test do `estimateRrwebBytes`

Criar `app/src/lib/session/__tests__/sizeEstimate-rrweb.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { estimateRrwebBytes } from '../sizeEstimate';
import type { RrwebEvent } from '../types';

const ev = (type: number, data: unknown, timestamp: number): RrwebEvent => ({
	type,
	data,
	timestamp,
});

describe('estimateRrwebBytes', () => {
	it('retorna 0 para array vazio', () => {
		expect(estimateRrwebBytes([])).toBe(0);
	});

	it('retorna número positivo para um evento', () => {
		const bytes = estimateRrwebBytes([ev(2, { source: 0, html: '<html></html>' }, 1)]);
		expect(bytes).toBeGreaterThan(0);
	});

	it('é monotônico — mais eventos => mais bytes', () => {
		const small = estimateRrwebBytes([ev(3, { source: 1, x: 0, y: 0 }, 1)]);
		const big = estimateRrwebBytes([
			ev(3, { source: 1, x: 0, y: 0 }, 1),
			ev(3, { source: 1, x: 100, y: 100 }, 2),
			ev(3, { source: 1, x: 200, y: 200 }, 3),
		]);
		expect(big).toBeGreaterThan(small);
	});
});
```

### Step 1.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/sizeEstimate-rrweb.test.ts
cd app && npm test 2>&1 | tail -5
git add app/package.json app/package-lock.json app/src/lib/session/types.ts app/src/lib/session/sizeEstimate.ts app/src/lib/session/__tests__/sizeEstimate-rrweb.test.ts
git commit -m "feat(session): tipo RrwebEvent + estimateRrwebBytes + deps rrweb/rrweb-player"
```

Esperado: 3 testes novos, suite total +3.

---

## Task 2: Probe rrwebRecorder (content script ISOLATED)

**Files:**
- Create: `app/src/probe/rrwebRecorder.ts`
- Modify: `app/manifest.json`
- Modify: `app/vite.config.mts`

### Step 2.1: Criar `rrwebRecorder.ts`

`app/src/probe/rrwebRecorder.ts`:

```ts
// Content script ISOLATED que liga rrweb-record e flusha eventos pro background.
// Roda em todas as URLs (matches: <all_urls>) com run_at: document_start. Espera
// `__rrweb_start` antes de iniciar a captura — sem isso, fica idle (sem overhead).

import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_BATCH_SIZE = 100;

let buffer: eventWithTime[] = [];
let stopRecording: (() => void) | null = null;
let flushTimer: number | null = null;
let activeSessionId: string | null = null;

function flush(): void {
	if (buffer.length === 0) return;
	if (activeSessionId === null) {
		// Defesa: sem sessionId, não há onde gravar — descarta para não vazar bytes.
		buffer = [];
		return;
	}
	const batch = buffer;
	buffer = [];
	chrome.runtime
		.sendMessage({
			action: 'rrwebBatch',
			sessionId: activeSessionId,
			rrwebEvents: batch,
		})
		.catch((err: unknown) => {
			// Canal invalidado quando a extensão é recarregada — silenciar.
			if (String(err).includes('Extension context invalidated')) return;
			console.warn('[rrweb] flush falhou:', err);
		});
}

function scheduleFlush(): void {
	if (flushTimer !== null) return;
	flushTimer = window.setTimeout(() => {
		flushTimer = null;
		flush();
	}, FLUSH_INTERVAL_MS);
}

function startRecording(sessionId: string, recordCanvas: boolean): void {
	if (stopRecording) {
		// Já gravando — provavelmente re-injeção pós-navegação. Atualiza sessionId
		// e reinicia para gerar FullSnapshot do novo documento.
		stopRecording();
		stopRecording = null;
		buffer = [];
	}
	activeSessionId = sessionId;
	const stop = record({
		emit(event: eventWithTime) {
			buffer.push(event);
			if (buffer.length >= FLUSH_BATCH_SIZE) {
				if (flushTimer !== null) {
					clearTimeout(flushTimer);
					flushTimer = null;
				}
				flush();
				return;
			}
			scheduleFlush();
		},
		recordCanvas,
	});
	if (!stop) {
		// rrweb retorna undefined quando já há gravação ativa no mesmo doc —
		// nunca deveria acontecer porque limpamos `stopRecording` acima.
		throw new Error('[rrweb] record() retornou undefined inesperadamente');
	}
	stopRecording = stop;
}

function stopRecordingNow(): void {
	if (stopRecording) {
		stopRecording();
		stopRecording = null;
	}
	if (flushTimer !== null) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	flush(); // último batch
	activeSessionId = null;
	buffer = [];
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
	if (message?.action === '__rrweb_start') {
		const sid = message.sessionId;
		const recordCanvas = !!message.recordCanvas;
		if (typeof sid !== 'string' || sid.length === 0) {
			console.warn('[rrweb] __rrweb_start sem sessionId válido — ignorado');
			return false;
		}
		try {
			startRecording(sid, recordCanvas);
		} catch (err) {
			console.warn('[rrweb] startRecording falhou:', err);
		}
	} else if (message?.action === '__rrweb_stop') {
		stopRecordingNow();
	}
	return false;
});

// Flush antes de a tab fechar (best-effort — service worker pode não receber).
window.addEventListener('pagehide', () => {
	if (stopRecording) {
		flush();
	}
});
```

### Step 2.2: Adicionar entry no Vite

Editar `app/vite.config.mts`. Localizar o objeto `rollupOptions.input` e adicionar entry `'rrweb-recorder'`:

```ts
input: {
	options: resolve(__dirname, 'options.html'),
	sidepanel: resolve(__dirname, 'sidepanel.html'),
	background: resolve(__dirname, 'src/entrypoints/background.ts'),
	main: resolve(__dirname, 'src/entrypoints/options/main.tsx'),
	'probe-main': resolve(__dirname, 'src/probe/main.ts'),
	'probe-bridge': resolve(__dirname, 'src/probe/bridge.ts'),
	'rrweb-recorder': resolve(__dirname, 'src/probe/rrwebRecorder.ts'),
},
```

> Se o Vite config atual não tiver `probe-main`/`probe-bridge` listados explicitamente (eles podem vir de plugin), adicionar SOMENTE `'rrweb-recorder'` ao input existente. Output `entryFileNames: '[name].js'` produz `rrweb-recorder.js` em `dist/`.

### Step 2.3: Registrar content script no manifest

Editar `app/manifest.json`. Adicionar entry no array `content_scripts` (após `probe-bridge`):

```json
{
	"matches": ["<all_urls>"],
	"js": ["rrweb-recorder.js"],
	"run_at": "document_start",
	"world": "ISOLATED"
}
```

Resultado final do array:

```json
"content_scripts": [
	{
		"matches": ["<all_urls>"],
		"js": ["probe-main.js"],
		"run_at": "document_start",
		"world": "MAIN"
	},
	{
		"matches": ["<all_urls>"],
		"js": ["probe-bridge.js"],
		"run_at": "document_start",
		"world": "ISOLATED"
	},
	{
		"matches": ["<all_urls>"],
		"js": ["rrweb-recorder.js"],
		"run_at": "document_start",
		"world": "ISOLATED"
	}
]
```

### Step 2.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm run build
ls app/dist/rrweb-recorder.js  # confirma que o bundle saiu
git add app/src/probe/rrwebRecorder.ts app/manifest.json app/vite.config.mts
git commit -m "feat(session): probe rrwebRecorder isolated com buffer/flush + entry no manifest"
```

Esperado: build passa, `dist/rrweb-recorder.js` existe, manifest válido.

---

## Task 3: Background handler `rrwebBatch` + `recorder.addRrwebEvents`

**Files:**
- Modify: `app/src/types/messages.ts`
- Modify: `app/src/lib/session/recorder.ts`
- Modify: `app/src/entrypoints/background.ts`
- Test: `app/src/lib/session/__tests__/recorder-rrweb.test.ts`

### Step 3.1: Adicionar action e payload

Editar `app/src/types/messages.ts`. Adicionar à união `MessageAction`:

```ts
| 'rrwebBatch'
```

E em `Message`, adicionar campo opcional:

```ts
// rrweb (Phase 2)
rrwebEvents?: import('@/lib/session/types').RrwebEvent[];
recordCanvas?: boolean;
```

> O `import(...)` inline evita dep cíclica de tipos. Se preferir `import type` no topo, agrupar com os outros imports de `@/lib/session/types`.

### Step 3.2: Implementar `recorder.addRrwebEvents`

Editar `app/src/lib/session/recorder.ts`. Adicionar import:

```ts
import { estimateEventBytes, estimateRrwebBytes } from './sizeEstimate';
```

E adicionar método dentro do objeto `recorder` (após `addEvent`):

```ts
async addRrwebEvents(sessionId: string, events: RrwebEvent[]): Promise<void> {
	if (events.length === 0) return;
	const s = await sessionStore.get(sessionId);
	if (!s) throw new Error(`Session ${sessionId} não encontrada`);
	if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);

	const r = getOrInitRuntime(sessionId, s);

	if (!s.rrwebEvents) s.rrwebEvents = [];
	s.rrwebEvents.push(...events);
	r.bytes += estimateRrwebBytes(events);

	// Hard limit — mesma lógica de addEvent (size primeiro, depois time).
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

E adicionar import de `RrwebEvent` ao topo (junto com os outros tipos):

```ts
import type {
	DetectionPhase,
	PageDetection,
	RrwebEvent,
	Session,
	SessionEvent,
	SessionMetadata,
} from './types';
```

### Step 3.3: Test do `addRrwebEvents`

Criar `app/src/lib/session/__tests__/recorder-rrweb.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';
import type { RrwebEvent } from '../types';

const ev = (type: number, timestamp: number, payload: unknown = {}): RrwebEvent => ({
	type,
	data: payload,
	timestamp,
});

const META = {
	initialUrl: 'https://example.test/',
	userAgent: 'jsdom',
	viewportSize: { w: 1280, h: 720 },
	canvasCaptureEnabled: false,
};

describe('recorder.addRrwebEvents', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
	});

	afterEach(() => {
		recorder._resetLimitsForTests();
	});

	it('append eventos a session.rrwebEvents (cria array se ausente)', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.addRrwebEvents(id, [ev(2, 1), ev(3, 2)]);
		const s = await sessionStore.get(id);
		expect(s?.rrwebEvents?.length).toBe(2);
		expect(s?.rrwebEvents?.[0].type).toBe(2);
	});

	it('append acumulativo entre batches', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.addRrwebEvents(id, [ev(2, 1)]);
		await recorder.addRrwebEvents(id, [ev(3, 2), ev(3, 3)]);
		const s = await sessionStore.get(id);
		expect(s?.rrwebEvents?.length).toBe(3);
	});

	it('é no-op com array vazio', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.addRrwebEvents(id, []);
		const s = await sessionStore.get(id);
		expect(s?.rrwebEvents).toBeUndefined();
	});

	it('lança erro em sessão inexistente', async () => {
		await expect(recorder.addRrwebEvents('sess_missing', [ev(2, 1)])).rejects.toThrow(
			/não encontrada/,
		);
	});

	it('lança erro em sessão encerrada', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.stopSession(id);
		await expect(recorder.addRrwebEvents(id, [ev(2, 1)])).rejects.toThrow(/já encerrada/);
	});

	it('dispara hard limit por size quando bytes excedem', async () => {
		recorder._setLimitsForTests({ sizeBytes: 500, durationMs: 60_000 });
		const id = await recorder.startSession({ tabId: 1, ...META });
		// Evento volumoso: payload string ~600 chars
		const big = ev(2, 1, { html: 'x'.repeat(600) });
		await recorder.addRrwebEvents(id, [big]);
		const s = await sessionStore.get(id);
		expect(s?.endedAt).not.toBeNull();
		expect(s?.telemetry?.hitHardLimit).toBe(true);
		expect(s?.telemetry?.hardLimitReason).toBe('size');
	});
});
```

> Nota: este teste depende de `fake-indexeddb/auto`. Se ele já não está em devDependencies, instalar:
>
> ```bash
> cd app && npm install --save-dev fake-indexeddb
> ```
>
> E confirmar que outros testes de `sessionStore` no projeto usam o mesmo import. Se a suíte já provê IndexedDB de outro jeito, pular esse install.

### Step 3.4: Handler `rrwebBatch` no background

Editar `app/src/entrypoints/background.ts`. Localizar a seção de handlers `// --- Session Replay --- ` e adicionar antes do `return false;` final do listener:

```ts
if (message.action === 'rrwebBatch') {
	(async () => {
		try {
			const sid = message.sessionId as string | undefined;
			const events = message.rrwebEvents;
			if (!sid || !Array.isArray(events)) {
				sendResponse({ ok: false, error: 'rrwebBatch: sessionId/rrwebEvents inválidos' });
				return;
			}
			await recorder.addRrwebEvents(sid, events as RrwebEvent[]);
			sendResponse({ ok: true });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

E adicionar `RrwebEvent` ao import de `@/lib/session/types` no topo:

```ts
import type {
	ConsoleArgPreview,
	ConsoleLevel,
	ConsoleStackFrame,
	PageDetection,
	RrwebEvent,
	Session,
	SessionEvent,
} from '@/lib/session/types';
```

### Step 3.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/recorder-rrweb.test.ts
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/types/messages.ts app/src/lib/session/recorder.ts app/src/entrypoints/background.ts app/src/lib/session/__tests__/recorder-rrweb.test.ts
git commit -m "feat(session): handler rrwebBatch + recorder.addRrwebEvents com hard limit"
```

Esperado: 6 testes novos no recorder-rrweb, build verde.

---

## Task 4: Despachar `__rrweb_start`/`__rrweb_stop` em start/stop e re-injeção em navegação

**Files:**
- Modify: `app/src/entrypoints/background.ts`

### Step 4.1: Enviar `__rrweb_start` em `startRecording`

Editar `app/src/entrypoints/background.ts`. No handler `if (message.action === 'startRecording') {`, adicionar APÓS `await chrome.tabs.sendMessage(message.tabId, { action: 'probeStartDetection', ... })` e ANTES de `sendResponse({ ok: true, sessionId: id })`:

```ts
// Inicia rrweb no content script ISOLATED da tab alvo. Falha aqui propaga
// erro pro caller (no-fallbacks): sem rrweb a sessão não tem captura visual.
await chrome.tabs.sendMessage(message.tabId, {
	action: '__rrweb_start',
	sessionId: id,
	recordCanvas: message.canvasCaptureEnabled ?? false,
});
```

### Step 4.2: Enviar `__rrweb_stop` em `stopRecording`

No handler `if (message.action === 'stopRecording') {`, dentro do bloco que envia `probeIdle` (após `Runtime.disable`/`Log.disable` e antes de `chrome.tabs.sendMessage(... probeIdle)`), adicionar:

```ts
try {
	await chrome.tabs.sendMessage(session.tabId, { action: '__rrweb_stop' });
} catch {
	// Tab pode ter fechado; ignorar (probe idle cobre o resto).
}
```

> Mantém a estrutura existente do try/catch existente — adicionar este try/catch ANTES do try/catch que envia `probeIdle`.

### Step 4.3: Re-injetar `__rrweb_start` em `webNavigation.onCommitted`

Editar o listener `chrome.webNavigation.onCommitted.addListener`. Após o `chrome.tabs.sendMessage(details.tabId, { action: 'probeStartDetection', reason: 'navigation' })`, adicionar (no mesmo try/catch ou um adjacente):

```ts
// Re-inicia rrweb no novo documento — content_script é re-injetado pelo Chrome
// em document_start, mas precisa receber __rrweb_start de novo (probe é idle até
// receber a mensagem). recordCanvas vem da metadata da sessão ativa.
try {
	await chrome.tabs.sendMessage(details.tabId, {
		action: '__rrweb_start',
		sessionId: session.id,
		recordCanvas: session.metadata.canvasCaptureEnabled,
	});
} catch (err) {
	const msg = String(err);
	if (
		msg.includes('Could not establish connection') ||
		msg.includes('The tab was closed') ||
		msg.includes('No tab with id')
	) {
		return;
	}
	console.warn(`[session] __rrweb_start em navegação inesperado em tab ${details.tabId}:`, err);
}
```

### Step 4.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/entrypoints/background.ts
git commit -m "feat(session): __rrweb_start/__rrweb_stop em start/stop e re-injeção pós navegação"
```

Esperado: build/lint/tests verdes.

---

## Task 5: Componente `RrwebPlayer` (React wrapper)

**Files:**
- Create: `app/src/components/replay/RrwebPlayer.tsx`
- Test: `app/src/components/replay/__tests__/RrwebPlayer.test.tsx`

### Step 5.1: Criar `RrwebPlayer.tsx`

`app/src/components/replay/RrwebPlayer.tsx`:

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
// rrweb-player é alpha — tipos vêm do próprio pacote em v2.
// @ts-expect-error: rrweb-player não exporta types de default em alpha — TODO atualizar quando v2 stable.
import RrwebPlayerLib from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import type { RrwebEvent } from '@/lib/session/types';

export interface RrwebPlayerHandle {
	goto: (timeMs: number) => void;
	getCurrentTime: () => number;
	play: () => void;
	pause: () => void;
}

interface Props {
	events: RrwebEvent[];
	autoPlay?: boolean;
	width?: number;
	height?: number;
	onTimeUpdate?: (currentMs: number) => void;
}

interface RrwebPlayerInstance {
	goto: (ms: number) => void;
	getCurrentTime: () => number;
	play: () => void;
	pause: () => void;
	addEventListener: (event: string, handler: (payload: unknown) => void) => void;
	$destroy?: () => void;
}

export const RrwebPlayer = forwardRef<RrwebPlayerHandle, Props>(function RrwebPlayer(
	{ events, autoPlay = false, width = 1024, height = 576, onTimeUpdate },
	ref,
) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const playerRef = useRef<RrwebPlayerInstance | null>(null);

	useEffect(() => {
		if (!hostRef.current) return;
		if (events.length < 2) {
			// rrweb-player exige no mínimo 2 eventos (Meta + FullSnapshot) para montar.
			// Sem isso: render fallback no caller via length check; aqui só skip.
			return;
		}
		const player = new RrwebPlayerLib({
			target: hostRef.current,
			props: {
				events,
				autoPlay,
				width,
				height,
				showController: true,
			},
		}) as unknown as RrwebPlayerInstance;
		playerRef.current = player;

		if (onTimeUpdate) {
			player.addEventListener('ui-update-current-time', (payload: unknown) => {
				const p = payload as { payload: number } | number;
				const ms = typeof p === 'number' ? p : p.payload;
				onTimeUpdate(ms);
			});
		}

		return () => {
			try {
				playerRef.current?.$destroy?.();
			} finally {
				playerRef.current = null;
				if (hostRef.current) hostRef.current.innerHTML = '';
			}
		};
	}, [events, autoPlay, width, height, onTimeUpdate]);

	useImperativeHandle(
		ref,
		(): RrwebPlayerHandle => ({
			goto: (ms: number) => playerRef.current?.goto(ms),
			getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
			play: () => playerRef.current?.play(),
			pause: () => playerRef.current?.pause(),
		}),
		[],
	);

	return <div ref={hostRef} className="rrweb-player-host" />;
});
```

### Step 5.2: Test do `RrwebPlayer`

`app/src/components/replay/__tests__/RrwebPlayer.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RrwebPlayer, type RrwebPlayerHandle } from '../RrwebPlayer';
import type { RrwebEvent } from '@/lib/session/types';

// Mock rrweb-player — em jsdom o player tenta criar iframe + virar Canvas.
// Stub captura props e expõe métodos para asserts.
const playerMock = {
	goto: vi.fn(),
	getCurrentTime: vi.fn(() => 1234),
	play: vi.fn(),
	pause: vi.fn(),
	addEventListener: vi.fn(),
	$destroy: vi.fn(),
};
vi.mock('rrweb-player', () => ({
	default: vi.fn(() => playerMock),
}));
vi.mock('rrweb-player/dist/style.css', () => ({}));

const minimalEvents: RrwebEvent[] = [
	{ type: 4, timestamp: 0, data: { href: 'https://example/', width: 1024, height: 768 } },
	{ type: 2, timestamp: 1, data: { node: {}, initialOffset: { left: 0, top: 0 } } },
];

describe('RrwebPlayer', () => {
	it('monta sem crash com >=2 eventos', () => {
		const { container } = render(<RrwebPlayer events={minimalEvents} />);
		expect(container.querySelector('.rrweb-player-host')).toBeInTheDocument();
	});

	it('não monta player com <2 eventos', () => {
		const RrwebPlayerLib = (await import('rrweb-player')).default as unknown as ReturnType<
			typeof vi.fn
		>;
		RrwebPlayerLib.mockClear();
		render(<RrwebPlayer events={[]} />);
		expect(RrwebPlayerLib).not.toHaveBeenCalled();
	});

	it('expõe goto/getCurrentTime via ref', () => {
		const ref = createRef<RrwebPlayerHandle>();
		render(<RrwebPlayer ref={ref} events={minimalEvents} />);
		ref.current?.goto(500);
		expect(playerMock.goto).toHaveBeenCalledWith(500);
		expect(ref.current?.getCurrentTime()).toBe(1234);
	});

	it('chama onTimeUpdate quando player emite ui-update-current-time', () => {
		const onTimeUpdate = vi.fn();
		render(<RrwebPlayer events={minimalEvents} onTimeUpdate={onTimeUpdate} />);
		// Pega o handler registrado via addEventListener
		const handler = playerMock.addEventListener.mock.calls.find(
			(c) => c[0] === 'ui-update-current-time',
		)?.[1];
		expect(handler).toBeDefined();
		handler?.({ payload: 750 });
		expect(onTimeUpdate).toHaveBeenCalledWith(750);
	});
});
```

> Nota: o teste do "não monta com <2 eventos" usa `await import` dentro de função síncrona — Vitest aceita top-level await mas dentro de `it` requer `async`. Ajustar a função para `it('...', async () => { ... })`.

### Step 5.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/replay/__tests__/RrwebPlayer.test.tsx
cd app && npm test 2>&1 | tail -5
git add app/src/components/replay/RrwebPlayer.tsx app/src/components/replay/__tests__/RrwebPlayer.test.tsx
git commit -m "feat(session): componente RrwebPlayer com forwardRef goto/getCurrentTime"
```

Esperado: 4 testes RrwebPlayer, suite passa.

---

## Task 6: Hook `useReplayPlayhead`

**Files:**
- Create: `app/src/hooks/useReplayPlayhead.ts`
- Test: `app/src/hooks/__tests__/useReplayPlayhead.test.ts`

### Step 6.1: Criar hook

`app/src/hooks/useReplayPlayhead.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import type { RrwebPlayerHandle } from '@/components/replay/RrwebPlayer';

export interface ReplayPlayheadState {
	/** Tempo corrente em ms desde o início da sessão. */
	currentMs: number;
	/** Callback a passar como `onTimeUpdate` do RrwebPlayer (mantém estado em sincronia). */
	onTimeUpdate: (ms: number) => void;
	/** Comanda o player a saltar para `ms`. Faz nada se ref ainda não montou. */
	seek: (ms: number) => void;
	/** Ref a passar ao RrwebPlayer. Necessário para `seek` funcionar. */
	playerRef: React.RefObject<RrwebPlayerHandle | null>;
}

/**
 * Mantém o playhead (tempo corrente) sincronizado entre o rrweb-player e
 * a UI React. O player é a fonte da verdade quando tocando; chamadas a `seek`
 * empurram o player para um ponto específico (ex: clicar num evento da timeline).
 */
export function useReplayPlayhead(): ReplayPlayheadState {
	const [currentMs, setCurrentMs] = useState(0);
	const playerRef = useRef<RrwebPlayerHandle | null>(null);

	const onTimeUpdate = useCallback((ms: number) => {
		setCurrentMs(ms);
	}, []);

	const seek = useCallback((ms: number) => {
		const player = playerRef.current;
		if (!player) return;
		player.goto(ms);
		// Atualiza estado imediatamente — ui-update-current-time pode demorar um frame.
		setCurrentMs(ms);
	}, []);

	return { currentMs, onTimeUpdate, seek, playerRef };
}
```

### Step 6.2: Test

`app/src/hooks/__tests__/useReplayPlayhead.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReplayPlayhead } from '../useReplayPlayhead';
import type { RrwebPlayerHandle } from '@/components/replay/RrwebPlayer';

describe('useReplayPlayhead', () => {
	it('inicia com currentMs=0', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		expect(result.current.currentMs).toBe(0);
	});

	it('onTimeUpdate atualiza currentMs', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		act(() => {
			result.current.onTimeUpdate(1500);
		});
		expect(result.current.currentMs).toBe(1500);
	});

	it('seek sem ref montada é no-op silencioso', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		expect(() => {
			act(() => {
				result.current.seek(500);
			});
		}).not.toThrow();
		// currentMs ainda atualiza otimisticamente
		expect(result.current.currentMs).toBe(500);
	});

	it('seek com ref chama goto e atualiza currentMs', () => {
		const { result } = renderHook(() => useReplayPlayhead());
		const goto = vi.fn();
		const fakePlayer: RrwebPlayerHandle = {
			goto,
			getCurrentTime: () => 0,
			play: vi.fn(),
			pause: vi.fn(),
		};
		act(() => {
			(result.current.playerRef as React.MutableRefObject<RrwebPlayerHandle | null>).current =
				fakePlayer;
			result.current.seek(2500);
		});
		expect(goto).toHaveBeenCalledWith(2500);
		expect(result.current.currentMs).toBe(2500);
	});
});
```

### Step 6.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/hooks/__tests__/useReplayPlayhead.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/hooks/useReplayPlayhead.ts app/src/hooks/__tests__/useReplayPlayhead.test.ts
git commit -m "feat(session): hook useReplayPlayhead com seek e onTimeUpdate"
```

Esperado: 4 testes useReplayPlayhead, suite passa.

---

## Task 7: ReplayPage com layout 2-colunas + scrubbing sincronizado

**Files:**
- Modify: `app/src/pages/ReplayPage.tsx`
- Test: `app/src/pages/__tests__/ReplayPage.test.tsx`

### Step 7.1: Reescrever `ReplayPage.tsx`

`app/src/pages/ReplayPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { EventRow } from '@/components/replay/EventRow';
import { PhaseList } from '@/components/replay/PhaseList';
import { RrwebPlayer } from '@/components/replay/RrwebPlayer';
import { useReplayPlayhead } from '@/hooks/useReplayPlayhead';
import { sessionStore } from '@/lib/session/storage';
import type { Session, SessionEvent } from '@/lib/session/types';

const FILTERS: SessionEvent['type'][] = ['network', 'console', 'route', 'error', 'detection'];

export function ReplayPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const [session, setSession] = useState<Session | null>(null);
	const [enabled, setEnabled] = useState<Record<string, boolean>>({
		network: true,
		console: true,
		route: true,
		error: true,
		detection: false,
	});
	const playhead = useReplayPlayhead();

	useEffect(() => {
		if (!sessionId) return;
		void sessionStore.get(sessionId).then(setSession);
	}, [sessionId]);

	if (!session) {
		return <div className="p-4 text-muted-foreground text-sm">Carregando…</div>;
	}

	const hasRrweb = !!session.rrwebEvents && session.rrwebEvents.length >= 2;
	const cutoffTimestamp = session.startedAt + playhead.currentMs;
	const visibleEvents = session.events.filter(
		(e) => enabled[e.type] && e.timestamp <= cutoffTimestamp,
	);

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Replay — {session.metadata.initialUrl}</h1>
				<span className="text-muted-foreground text-xs">
					{session.events.length} eventos · {session.detectionPhases.length} fases ·{' '}
					{session.rrwebEvents?.length ?? 0} eventos visuais
				</span>
			</div>

			<div className="grid grid-cols-[65%_1fr] gap-3 overflow-hidden">
				{/* Coluna esquerda: rrweb-player ou fallback */}
				<div className="overflow-auto rounded border bg-black">
					{hasRrweb ? (
						<RrwebPlayer
							ref={playhead.playerRef}
							events={session.rrwebEvents ?? []}
							onTimeUpdate={playhead.onTimeUpdate}
						/>
					) : (
						<div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
							Sessão sem captura visual.
							<br />
							Esta sessão foi gravada antes da Fase 2 ou com rrweb desabilitado.
						</div>
					)}
				</div>

				{/* Coluna direita: filtros + timeline + fases */}
				<div className="flex flex-col gap-3 overflow-hidden">
					<div className="flex flex-wrap items-center gap-3 rounded border p-2 text-xs">
						<span className="font-medium">Filtros:</span>
						{FILTERS.map((f) => (
							<label key={f} htmlFor={`filter-${f}`} className="flex items-center gap-1">
								<Checkbox
									id={`filter-${f}`}
									checked={!!enabled[f]}
									onCheckedChange={(v) =>
										setEnabled((prev) => ({ ...prev, [f]: v === true }))
									}
								/>
								{f}
							</label>
						))}
					</div>

					<div className="flex-1 overflow-auto rounded border">
						{visibleEvents.length === 0 ? (
							<p className="p-3 text-muted-foreground text-sm">
								Nenhum evento até o ponto atual ({(playhead.currentMs / 1000).toFixed(2)}s).
							</p>
						) : (
							visibleEvents.map((ev, i) => (
								<EventRow key={i} event={ev} startedAt={session.startedAt} />
							))
						)}
					</div>

					<aside className="max-h-48 overflow-auto">
						<PhaseList phases={session.detectionPhases} />
					</aside>
				</div>
			</div>
		</div>
	);
}
```

### Step 7.2: Test da ReplayPage

`app/src/pages/__tests__/ReplayPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReplayPage } from '../ReplayPage';
import { sessionStore } from '@/lib/session/storage';
import type { Session } from '@/lib/session/types';

// Mock RrwebPlayer pra evitar montar rrweb-player real (já testado isolado).
vi.mock('@/components/replay/RrwebPlayer', () => ({
	RrwebPlayer: () => <div data-testid="rrweb-player-mock" />,
}));

const baseSession = (overrides: Partial<Session> = {}): Session => ({
	id: 'sess_test',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
	...overrides,
});

function renderAt(sessionId: string) {
	return render(
		<MemoryRouter initialEntries={[`/replay/${sessionId}`]}>
			<Routes>
				<Route path="/replay/:sessionId" element={<ReplayPage />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe('ReplayPage', () => {
	it('mostra fallback quando rrwebEvents ausente', async () => {
		await sessionStore.put(baseSession());
		renderAt('sess_test');
		await waitFor(() => {
			expect(screen.getByText(/Sessão sem captura visual/i)).toBeInTheDocument();
		});
	});

	it('renderiza RrwebPlayer quando rrwebEvents tem >=2 eventos', async () => {
		await sessionStore.put(
			baseSession({
				id: 'sess_with_rrweb',
				rrwebEvents: [
					{ type: 4, timestamp: 1_000, data: {} },
					{ type: 2, timestamp: 1_001, data: {} },
				],
			}),
		);
		renderAt('sess_with_rrweb');
		await waitFor(() => {
			expect(screen.getByTestId('rrweb-player-mock')).toBeInTheDocument();
		});
	});

	it('inicialmente filtra eventos com timestamp > startedAt + currentMs (currentMs=0)', async () => {
		await sessionStore.put(
			baseSession({
				id: 'sess_filter',
				events: [
					{ type: 'route', timestamp: 1_500, phaseId: 'p1', url: 'https://x', triggerType: 'initial' },
				],
			}),
		);
		renderAt('sess_filter');
		await waitFor(() => {
			// currentMs=0 → cutoff=1000, evento em 1500 NÃO aparece
			expect(screen.getByText(/Nenhum evento até o ponto atual/i)).toBeInTheDocument();
		});
	});
});
```

### Step 7.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/pages/__tests__/ReplayPage.test.tsx
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/pages/ReplayPage.tsx app/src/pages/__tests__/ReplayPage.test.tsx
git commit -m "feat(session): ReplayPage 2-colunas com RrwebPlayer + scrubbing sincronizado"
```

Esperado: 3 testes ReplayPage, suite passa.

---

## Task 8: Viewer.html standalone com rrweb-player embutido

**Files:**
- Modify: `app/src/lib/session/viewerTemplate.ts`
- Test: `app/src/lib/session/__tests__/viewerTemplate-rrweb.test.ts`

### Step 8.1: Embutir `rrweb-player` no template

Reescrever `app/src/lib/session/viewerTemplate.ts`. O viewer precisa rodar offline (sem CDN) — embutimos o JS minificado de `rrweb-player` lendo do `node_modules` em build time. Vite via `?raw` import resolve isso.

```ts
// Template HTML standalone que renderiza uma session offline + visual rrweb.
// JSON.stringify(session) é injetado como literal JavaScript.
// rrweb-player JS+CSS é embutido inline a partir do node_modules em build time.

// @ts-expect-error: Vite resolve `?raw` em runtime; tsc não conhece.
import rrwebPlayerJs from 'rrweb-player/dist/index.js?raw';
// @ts-expect-error: idem.
import rrwebPlayerCss from 'rrweb-player/dist/style.css?raw';

export function buildViewerHtml(sessionJson: string): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Debug Buddy — Session Viewer</title>
<style>
	body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; color: #1f2937; }
	header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
	h1 { font-size: 18px; margin: 0; font-weight: 600; }
	.meta { color: #6b7280; font-size: 12px; }
	main { display: grid; grid-template-columns: 65% 1fr; gap: 12px; height: calc(100vh - 80px); }
	#player { background: #000; border-radius: 4px; overflow: hidden; }
	.right { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
	.timeline { flex: 1; overflow: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
	.row { display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 4px 12px; border-bottom: 1px solid #f3f4f6; font-family: ui-monospace, monospace; font-size: 11px; }
	.offset { color: #6b7280; }
	.t-network { color: #1d4ed8; }
	.t-console { color: #334155; }
	.t-route { color: #7c3aed; }
	.t-error { color: #b91c1c; }
	.t-detection { color: #047857; }
	.phase { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; font-size: 11px; margin-bottom: 8px; }
	.banner { background: #fef3c7; color: #92400e; padding: 6px 12px; font-size: 12px; border-radius: 4px; margin-bottom: 12px; }
	.fallback { display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280; font-size: 13px; padding: 24px; text-align: center; }
${rrwebPlayerCss}
</style>
</head>
<body>
<div class="banner">Debug Buddy Session Viewer (offline standalone) — replay visual via rrweb embutido.</div>
<header>
	<h1 id="title">Carregando…</h1>
	<span class="meta" id="meta"></span>
</header>
<main>
	<div id="player"></div>
	<div class="right">
		<div class="timeline" id="timeline"></div>
		<aside id="phases"></aside>
	</div>
</main>
<script>
${rrwebPlayerJs}
</script>
<script>
const SESSION = ${sessionJson};

function escape(s) {
	return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function eventLabel(ev) {
	switch (ev.type) {
		case 'network': return '[' + ev.method + '] ' + ev.url + ' → ' + ev.status;
		case 'console': {
			const text = (ev.args || []).map(a => a.description).join(' ');
			const count = ev.coalesceCount > 1 ? ' (×' + ev.coalesceCount + ')' : '';
			return '[' + (ev.level || '').toUpperCase() + '] ' + text + count;
		}
		case 'route': return '[ROUTE/' + ev.triggerType + '] ' + ev.url;
		case 'error': return '[ERROR] ' + ev.message;
		case 'detection': return '[PHASE START] ' + ev.phaseId;
		default: return '[' + ev.type + ']';
	}
}

function offsetSec(ev, startedAt) {
	const ms = ev.timestamp >= 1e12 ? (ev.timestamp - startedAt) : (ev.timestamp * 1000 - startedAt);
	return (ms / 1000).toFixed(2);
}

document.getElementById('title').textContent = 'Replay — ' + (SESSION.metadata && SESSION.metadata.initialUrl || 'sem URL');
document.getElementById('meta').textContent = (SESSION.events || []).length + ' eventos · ' + (SESSION.detectionPhases || []).length + ' fases · ' + ((SESSION.rrwebEvents || []).length) + ' eventos visuais';

const playerHost = document.getElementById('player');
if ((SESSION.rrwebEvents || []).length >= 2 && typeof rrwebPlayer !== 'undefined') {
	new rrwebPlayer({
		target: playerHost,
		props: {
			events: SESSION.rrwebEvents,
			showController: true,
			autoPlay: false,
		},
	});
} else {
	playerHost.innerHTML = '<div class="fallback">Sessão sem captura visual.<br/>Gravada antes da Fase 2 ou com rrweb desabilitado.</div>';
}

const timeline = document.getElementById('timeline');
(SESSION.events || []).forEach(ev => {
	const row = document.createElement('div');
	row.className = 'row';
	row.innerHTML = '<span class="offset">+' + offsetSec(ev, SESSION.startedAt) + 's</span><span class="t-' + ev.type + '">' + escape(eventLabel(ev)) + '</span>';
	timeline.appendChild(row);
});

const phases = document.getElementById('phases');
(SESSION.detectionPhases || []).forEach((p, i) => {
	const div = document.createElement('div');
	div.className = 'phase';
	const fw = (p.fingerprint && p.fingerprint.framework) || {};
	div.innerHTML = '<strong>Fase ' + (i + 1) + ' — ' + escape(fw.name || '') + (fw.version ? ' v' + escape(fw.version) : '') + '</strong><br>' + (p.pages || []).length + ' URL(s)';
	phases.appendChild(div);
});
</script>
</body>
</html>`;
}
```

> Trade-off: `?raw` imports inflam o bundle de `dist/background.js` (que importa `viewerTemplate`) com ~200 KB extra de string. Aceitável: o exporter só carrega o template quando o usuário clica "Exportar". Alternativa para Phase 2.x: copiar o asset via `vite-plugin-static-copy` e usar `fetch` no momento do export. Phase 2 fica com `?raw` para manter um único arquivo `.dbsession` autocontido.

### Step 8.2: Atualizar test do viewerTemplate

Editar `app/src/lib/session/__tests__/viewerTemplate-rrweb.test.ts` (criar):

```ts
import { describe, expect, it } from 'vitest';
import { buildViewerHtml } from '../viewerTemplate';

describe('buildViewerHtml — Phase 2', () => {
	it('embute o JSON da session', () => {
		const html = buildViewerHtml('{"id":"sess_test","rrwebEvents":[{"type":4,"timestamp":1,"data":{}}]}');
		expect(html).toContain('"sess_test"');
		expect(html).toContain('rrwebEvents');
	});

	it('embute código do rrweb-player (procura por símbolo característico)', () => {
		const html = buildViewerHtml('{}');
		// rrweb-player exporta a classe `rrwebPlayer`. O bundle minificado contém o nome.
		expect(html).toMatch(/rrwebPlayer/);
	});

	it('embute CSS do rrweb-player', () => {
		const html = buildViewerHtml('{}');
		// Classes características do player CSS.
		expect(html).toMatch(/\.rr-player|\.replayer-wrapper/);
	});

	it('inclui fallback "sem captura visual"', () => {
		const html = buildViewerHtml('{}');
		expect(html).toContain('Sessão sem captura visual');
	});

	it('marca header como Phase 2 (replay visual via rrweb embutido)', () => {
		const html = buildViewerHtml('{}');
		expect(html).toContain('replay visual via rrweb embutido');
	});
});
```

> Se o teste anterior `exporter.test.ts` (Phase 1d) procurava por "sem rrweb visual nesta versão", ele vai quebrar. Atualizar a asserção lá ou remover o teste obsoleto. Conferir antes de commit:
>
> ```bash
> cd app && grep -rn "sem rrweb visual nesta versão" src/
> ```

### Step 8.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/viewerTemplate-rrweb.test.ts
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/exporter.test.ts
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/lib/session/viewerTemplate.ts app/src/lib/session/__tests__/viewerTemplate-rrweb.test.ts app/src/lib/session/__tests__/exporter.test.ts
git commit -m "feat(session): viewer.html standalone com rrweb-player embutido"
```

Esperado: 5 testes novos no viewerTemplate-rrweb, exporter.test.ts ainda passa (após ajuste).

---

## Task 9: Validar CSP + iframe sandboxing trade-off documentado

**Files:**
- Modify: `app/manifest.json` (somente se ajuste CSP for necessário)

### Step 9.1: Confirmar CSP atual permite rrweb-player

`rrweb-player` v2 em runtime usa: `JSON.parse`, `document.createElement`, `MutationObserver`, `requestAnimationFrame`, `Worker` opcional. **Não usa `eval`/`new Function`** em build de produção. O default de MV3 é `script-src 'self'; object-src 'self'` — suficiente.

Validar:

```bash
cd app && npm run build
grep -nE "(eval|new Function)" dist/*.js | head -5
```

Esperado: nenhum match em código relevante (ou apenas em strings de comentário). Se aparecer `eval` real no output do `rrweb-player`, alternativas:

1. Tentar `rrweb-player` build alternativo (`/dist/index.esm.js`).
2. Pin em última versão estável de v1 que já era validada por outros projetos MV3.
3. Adicionar `'wasm-unsafe-eval'` ao `extension_pages` (NÃO `'unsafe-eval'` puro — Chrome Web Store rejeita).

> Se for necessário ajuste, editar `app/manifest.json` adicionando:
>
> ```json
> "content_security_policy": {
> 	"extension_pages": "script-src 'self'; object-src 'self'"
> }
> ```
>
> (Default explicitado, sem mudança real — só confirmação.)

### Step 9.2: Documentar decisão de iframe sandboxing

Adicionar comentário no topo de `app/src/components/replay/RrwebPlayer.tsx` (já adicionado se Task 5 foi seguida; reforçar):

> A spec (seção 14.8) recomenda iframe sandboxed para isolar o DOM reconstruído.
> Optamos por NÃO usar `<iframe sandbox srcDoc>` no shell da extensão porque o
> próprio rrweb-player v2 já cria um iframe interno (`replayer-wrapper > iframe`)
> que isola o DOM gravado do shell. Adicionar mais um iframe externo seria
> redundante e quebraria os imports ESM (`srcDoc` não resolve `import`s).
>
> Para o **viewer.html standalone** (offline, embutido no .dbsession), o HTML
> inteiro já é o iframe quando aberto via `file://` ou anexado em Jira/Slack
> (browser trata como documento isolado). Sem ajuste extra necessário.
>
> Se uma app debugada tiver CSS muito agressivo no parent que vaze pro
> rrweb-player (improvável — Shadow DOM nativo do replayer-wrapper bloqueia),
> Phase 2.x adiciona Shadow Root ao host.

### Step 9.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm run build
cd app && npm test 2>&1 | tail -5
# Se manifest mudou:
git add app/manifest.json app/src/components/replay/RrwebPlayer.tsx
# Se manifest NÃO mudou (só comentário no RrwebPlayer):
git add app/src/components/replay/RrwebPlayer.tsx
git commit -m "feat(session): valida CSP MV3 sem unsafe-eval + documenta iframe trade-off"
```

> Se Task 9 não resultou em mudanças de código (CSP já é suficiente, comentário já estava na Task 5), pular o commit e mover Self-Review.

---

## Self-Review Checklist

- [ ] **Spec coverage Phase 2:**
  - rrweb integrado (recorder + player) ✓ (Tasks 2, 5)
  - Buffer + flush 1s/100 eventos ✓ (Task 2)
  - Bytes rrweb contam no hard limit 50MB/10min ✓ (Task 3)
  - Canvas opt-in via `metadata.canvasCaptureEnabled` ✓ (Task 4 propaga flag)
  - Re-injeção em `webNavigation.onCommitted` ✓ (Task 4)
  - ReplayPage 2-colunas com scrubbing sincronizado ✓ (Tasks 6, 7)
  - Fallback "sem captura visual" ✓ (Task 7)
  - Viewer.html offline com rrweb-player embutido ✓ (Task 8)
  - `Session.rrwebEvents?` opcional, schemaVersion=1 fixo ✓ (Task 1)
  - Eventos rrweb FORA de `events: SessionEvent[]` ✓ (Task 1)

- [ ] **No-fallbacks check:**
  - `addRrwebEvents` em sessão inexistente → throw ✓
  - `addRrwebEvents` em sessão encerrada → throw ✓
  - Probe sem sessionId em `__rrweb_start` → warn + ignora (não persiste lixo) ✓
  - `RrwebPlayer` com <2 eventos → não monta (caller mostra fallback) ✓
  - Sem `||` defaults em campos required ✓

- [ ] **MV3 quirks:**
  - rrwebRecorder roda em ISOLATED (não MAIN) ✓
  - Service worker pode ser reciclado entre batches — `addRrwebEvents` reabre IDB conexão ✓
  - CSP `extension_pages` validado sem `unsafe-eval` ✓

- [ ] **Forward compat:**
  - `rrwebEvents` é opcional — sessions Phase 1 abrem sem rrweb
  - `RrwebEvent.type` é `number` opaco — versões futuras de rrweb não quebram tipo

---

## Pontos abertos pra Phase 2.x / Phase 3+

- **Drift de relógio rrweb ↔ events.** Spec 14.9 marca como ponto a instrumentar se houver relato. Phase 2.x: enviar `performance.now()` do MAIN para isolated com offset, ou usar `Date.now()` em ambos (default atual).
- **Aba Console dedicada.** ReplayPage hoje mistura console nas linhas da timeline; Phase 3 separa em aba "Console" estilo DevTools com filtros por level/source.
- **Viewer.html bundle size.** `?raw` import infla `dist/background.js` em ~200 KB. Phase 2.x avalia copiar `rrweb-player.js` via `vite-plugin-static-copy` e fazer `fetch('/rrweb-player.js').then(r => r.text())` no exporter — mantém zip autocontido sem inflar background.
- **Body blobs no .dbsession.** Continua não incluído (Phase 1d ponto aberto). Phase 2.x ou Phase 3 adiciona blobs persistidos.
- **Antipatterns engine.** Phase 3 começa com `dup-req-burst`, `retry-storm`, `effect-fetch-loop`, `waterfall`, `auth-refresh-storm`.
- **State capture.** Phase 4 — Redux + Zustand.
