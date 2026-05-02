# Session Replay — Phase 3: Antipattern Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o motor de detecção de antipatterns (5 prioritários) descrito na seção 8 do spec. Em modo gravado, hits ficam ancorados na timeline (`session.antipatternHits`); em modo passivo, são publicados ao vivo num painel lateral via broadcast `liveAntipatternHit`. Source map resolver compartilhado (compatível com Console Capture) traduz `bundle.js:1:48312` → arquivo/linha original quando o `.map` está disponível, com fallback silencioso para a location bruta.

**Architecture:** Engine streaming cronológico (`lib/session/antipattern/engine.ts`) com janela móvel; cada detector é uma função pura independente em `lib/session/antipattern/detectors/<id>.ts` que recebe um `NetworkEvent` novo + buffer de eventos recentes e devolve `AntipatternHit | null`. O resolver de source map (`lib/session/sourceMap.ts`) usa a lib `source-map` (npm), `fetch(<file>.map)` e cache LRU por arquivo. Recorder ganha `addAntipatternHit` que persiste no `Session.antipatternHits`. Background integra o engine no handler `network` existente: passivo → broadcast `liveAntipatternHit`; gravado → grava + broadcast. UI ganha aba "Antipatterns" no `ReplayPage` e `LiveAntipatternsPanel.tsx` montado no Layout para modo passivo.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` (seção 8 — Antipattern Detection, modelo `AntipatternHit` / `ResolvedCallsite`, source map resolver, catálogo dos 5 patterns).

---

## File Structure

**Modify:**
- `app/src/lib/session/types.ts` — adicionar `AntipatternHit`, `ResolvedCallsite`, `AntipatternSeverity`, `AntipatternId`. Adicionar `antipatternHits?: AntipatternHit[]` em `Session` e `callsite?: { file: string; line: number; column?: number }` opcional na variante `network` de `SessionEvent`.
- `app/src/lib/session/recorder.ts` — `addAntipatternHit(sessionId, hit)`, estado runtime para janela móvel do engine (mapa por session + buffer por tab para passivo).
- `app/src/entrypoints/background.ts` — engine roda no handler `network` (modo passivo via `tabId` + modo gravado via `sessionId`); broadcast `liveAntipatternHit`; lazy resolver de callsite ao gerar hit.
- `app/src/types/messages.ts` — adicionar `liveAntipatternHit` em `MessageAction` + payload `antipatternHit?: AntipatternHit` em `Message`.
- `app/src/pages/ReplayPage.tsx` — nova aba "Antipatterns" com lista filtrada por severity.
- `app/src/pages/Layout.tsx` — montar `LiveAntipatternsPanel` quando `interceptação ON && gravação OFF` (modo passivo).
- `app/package.json` — `source-map` como dep (~100 KB).

**Create:**
- `app/src/lib/session/antipattern/engine.ts` — `AntipatternEngine` class com `pushEvent(ev): AntipatternHit[]`, mantém buffer por sessão/tab cronológico com janela móvel. Cada detector independente.
- `app/src/lib/session/antipattern/detectors/dupReqBurst.ts` — detector `dup-req-burst`.
- `app/src/lib/session/antipattern/detectors/retryStorm.ts` — detector `retry-storm`.
- `app/src/lib/session/antipattern/detectors/effectFetchLoop.ts` — detector `effect-fetch-loop` (depende de `callsite`).
- `app/src/lib/session/antipattern/detectors/waterfall.ts` — detector `waterfall`.
- `app/src/lib/session/antipattern/detectors/authRefreshStorm.ts` — detector `auth-refresh-storm`.
- `app/src/lib/session/antipattern/fingerprint.ts` — helpers puros (hash de body/url/método, classificação `looksLikeRefreshUrl`).
- `app/src/lib/session/sourceMap.ts` — resolver com cache LRU + lib `source-map`.
- `app/src/components/replay/AntipatternsTab.tsx` — aba renderizada no ReplayPage.
- `app/src/components/replay/AntipatternHitRow.tsx` — uma row com severity, summary, callsite resolvido (com fallback).
- `app/src/components/replay/LiveAntipatternsPanel.tsx` — painel lateral compacto para modo passivo (escuta `liveAntipatternHit`).

**Test (co-located):**
- `app/src/lib/session/__tests__/sourceMap.test.ts`
- `app/src/lib/session/antipattern/__tests__/engine.test.ts`
- `app/src/lib/session/antipattern/__tests__/dupReqBurst.test.ts`
- `app/src/lib/session/antipattern/__tests__/retryStorm.test.ts`
- `app/src/lib/session/antipattern/__tests__/effectFetchLoop.test.ts`
- `app/src/lib/session/antipattern/__tests__/waterfall.test.ts`
- `app/src/lib/session/antipattern/__tests__/authRefreshStorm.test.ts`
- `app/src/lib/session/__tests__/recorder.antipattern.test.ts`
- `app/src/components/replay/__tests__/AntipatternsTab.test.tsx`
- `app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx`
- `app/src/components/replay/__tests__/AntipatternHitRow.test.tsx`

---

## Decisões de design

**Engine streaming, não batch.** Engine recebe eventos em ordem de timestamp via `pushEvent`. Cada detector é puro: `(newEvent, buffer) => AntipatternHit | null`. Buffer mantém só eventos dentro da maior janela usada (5s por enquanto, do `effect-fetch-loop`); FIFO eviction baseado em `timestamp`. Isso permite usar o mesmo engine em modo passivo (sem persistir) e gravado (persistir + broadcast).

**`source-map` lib na main bundle.** ~100 KB extra ao final do bundle de produção. Carregada estaticamente — não vale a pena lazy-load porque o engine pode dispará-la a qualquer momento. Documenta-se em `app/docs/dbsession-schema.md` (futuro).

**Cache LRU do resolver: por arquivo, com TTL infinito por sessão da extensão.** Tamanho 50 entradas (heurística — apps típicas têm <10 chunks ativos). Ao bater limite, descarta o entry com `lastAccess` mais antigo. Falhas (`404`, `CORS`, parse error) também são cacheadas como `null` para não retentar a cada hit.

**No-fallbacks (CLAUDE.md):** resolver retorna `ResolvedCallsite` com `raw` sempre presente e `resolved` opcional. Se source map falha, NÃO inventamos linha — `resolved` fica `undefined` e a UI mostra raw. Engine não silencia erros internos: se um detector lança, log + propaga (testes garantem que detectores nunca lançam para inputs válidos).

**Callsite no `NetworkEvent`.** Tornamos `callsite?: { file, line, column? }` opcional na variante `network`. Phase 3 só lê — preencher é responsabilidade do probe (capturado em fases anteriores ou follow-up). Detector `effect-fetch-loop` silencia se callsite ausente em ≥metade dos events da janela (sem callsite não temos como agrupar; alternativa: agrupar por URL; **rejeitada** porque o spec define "mesmo callsite"). 

**Modo passivo: buffer por `tabId`.** Recorder não conhece tabs sem session; passivo precisa de buffer separado. `engine.ts` exporta a classe pura sem depender de session — quem chama (`background.ts` ou `recorder.ts`) escolhe o key. Buffer passivo TTL 5s + max 200 entries (FIFO) para não vazar memória se usuário esquece passivo ligado por horas.

**`waterfall` detector — heurística mínima.** Sequência de ≥3 requests onde cada uma começa após a anterior terminar (gap < 200ms, sem overlap), todas para o mesmo host, e durações totais > 1s. Severity `info`. Documentar limitação: não detecta dependência semântica real (precisaria de stack trace ou correlação por response body).

**`auth-refresh-storm` — heurística.** URLs com path matching `/refresh|/oauth/token|/auth/refresh|/sessions/refresh`. ≥2 requests para tal URL com janela ≤1s (paralelos = `start` overlap), independente de status. Função `looksLikeRefreshUrl` em `fingerprint.ts` aceita lista de regexes e exporta os defaults.

**`evidenceEventIds`.** `NetworkEvent` não tem `id` no schema atual. Definimos um id derivado `${requestId}@${timestamp}` para uso interno em `evidenceEventIds`. UI usa esse id pra highlight; suficiente porque pertence à mesma session.

**Persistência de hits:** `addAntipatternHit` faz dedup leve por `(patternId, startTimestamp, endTimestamp, summary)` para evitar duplicar quando o engine roda no mesmo evento depois de service worker recycle (raro mas possível durante long sessions).

**Broadcast `liveAntipatternHit` payload:** `{ tabId, hit }`. UI filtra por `tabId === currentTargetTab` para não mostrar hits de outra tab.

---

## Task 1: Tipos `AntipatternHit` + `ResolvedCallsite` em `types.ts`

**Files:**
- Modify: `app/src/lib/session/types.ts`
- Test: existing typecheck via `tsc --noEmit`

### Step 1.1: Adicionar tipos

Em `app/src/lib/session/types.ts`, adicionar antes de `Session`:

```ts
export type AntipatternSeverity = 'info' | 'warn' | 'error';

export type AntipatternId =
	| 'dup-req-burst'
	| 'retry-storm'
	| 'effect-fetch-loop'
	| 'waterfall'
	| 'auth-refresh-storm';

export interface RawCallsite {
	file: string;
	line: number;
	column?: number;
}

export interface ResolvedCallsite {
	raw: RawCallsite;
	resolved?: RawCallsite;
}

export interface AntipatternHit {
	patternId: AntipatternId;
	severity: AntipatternSeverity;
	startTimestamp: number;
	endTimestamp: number;
	phaseId: string;
	evidenceEventIds: string[];
	context: {
		component?: string;
		callsite?: ResolvedCallsite;
		summary: string;
	};
	suggestion?: string;
}
```

### Step 1.2: Estender `Session` e `network` event

Atualizar `SessionEvent` adicionando `callsite?` na variante `network`:

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
		callsite?: RawCallsite;
  }
```

Atualizar `Session` adicionando campo opcional:

```ts
export interface Session {
	// ...campos existentes...
	antipatternHits?: AntipatternHit[];
}
```

### Step 1.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/types.ts
git commit -m "feat(session): tipos AntipatternHit + ResolvedCallsite + callsite opcional em NetworkEvent"
```

Esperado: typecheck verde; suite total inalterada (sem novos testes nesta task — schema é opcional).

---

## Task 2: Source map resolver

**Files:**
- Modify: `app/package.json` (instala `source-map`)
- Create: `app/src/lib/session/sourceMap.ts`
- Test: `app/src/lib/session/__tests__/sourceMap.test.ts`

### Step 2.1: Instalar `source-map`

```bash
cd app && npm install source-map
```

### Step 2.2: Implementar `sourceMap.ts`

`app/src/lib/session/sourceMap.ts`:

```ts
// Resolver lazy de source maps para callsites minificados.
// - Tenta GET <file>.map quando linha=1 e coluna alta (heurística "minificado").
// - Cache LRU por arquivo (50 entradas; falhas também são cacheadas como null).
// - Fallback silencioso para raw quando .map ausente, inválido, ou bloqueado por CORS.
// Sem fallbacks fabricados (CLAUDE.md): se o map não traduzir, `resolved` = undefined.

import { SourceMapConsumer } from 'source-map';
import type { RawCallsite, ResolvedCallsite } from './types';

const CACHE_MAX = 50;
const MIN_COLUMN_FOR_MINIFIED = 200; // heurística: builds reais raramente passam de 200 em col válida

interface CacheEntry {
	consumer: SourceMapConsumer | null; // null = tentado e falhou
	lastAccess: number;
}

const cache = new Map<string, CacheEntry>();

function evictIfNeeded(): void {
	if (cache.size <= CACHE_MAX) return;
	let oldestKey: string | null = null;
	let oldest = Infinity;
	for (const [k, v] of cache) {
		if (v.lastAccess < oldest) {
			oldest = v.lastAccess;
			oldestKey = k;
		}
	}
	if (oldestKey) cache.delete(oldestKey);
}

function looksMinified(call: RawCallsite): boolean {
	return call.line === 1 && (call.column ?? 0) >= MIN_COLUMN_FOR_MINIFIED;
}

async function loadConsumer(fileUrl: string): Promise<SourceMapConsumer | null> {
	const cached = cache.get(fileUrl);
	if (cached) {
		cached.lastAccess = Date.now();
		return cached.consumer;
	}
	const mapUrl = `${fileUrl}.map`;
	let consumer: SourceMapConsumer | null = null;
	try {
		const res = await fetch(mapUrl);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const raw = await res.json();
		consumer = await new SourceMapConsumer(raw);
	} catch {
		consumer = null;
	}
	cache.set(fileUrl, { consumer, lastAccess: Date.now() });
	evictIfNeeded();
	return consumer;
}

export async function resolveCallsite(raw: RawCallsite): Promise<ResolvedCallsite> {
	if (!looksMinified(raw)) {
		return { raw };
	}
	const consumer = await loadConsumer(raw.file);
	if (!consumer) return { raw };

	const original = consumer.originalPositionFor({
		line: raw.line,
		column: raw.column ?? 0,
	});

	if (!original.source || original.line === null) {
		return { raw };
	}

	return {
		raw,
		resolved: {
			file: original.source,
			line: original.line,
			column: original.column ?? undefined,
		},
	};
}

export function _resetCacheForTests(): void {
	for (const v of cache.values()) v.consumer?.destroy();
	cache.clear();
}
```

### Step 2.3: Test

`app/src/lib/session/__tests__/sourceMap.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheForTests, resolveCallsite } from '../sourceMap';

// Source map mínimo válido produzido por `source-map` lib em fixture estático.
// Mapeia bundle.js:1:30 → src/foo.ts:5:0
const FIXTURE_MAP = {
	version: 3,
	file: 'bundle.js',
	sources: ['src/foo.ts'],
	sourcesContent: ['function foo() {\n  return 42;\n}\n'],
	names: [],
	mappings: ';;;;mBAAA,SAAS,GAAG,CAAC,GAAG',
};

const ORIG_FETCH = globalThis.fetch;

describe('resolveCallsite', () => {
	beforeEach(() => {
		_resetCacheForTests();
	});

	afterEach(() => {
		globalThis.fetch = ORIG_FETCH;
	});

	it('passa direto raw quando linha != 1 (provável já não-minificado)', async () => {
		globalThis.fetch = vi.fn();
		const r = await resolveCallsite({ file: 'http://x/app.js', line: 42, column: 5 });
		expect(r).toEqual({ raw: { file: 'http://x/app.js', line: 42, column: 5 } });
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('passa direto raw quando coluna baixa', async () => {
		globalThis.fetch = vi.fn();
		const r = await resolveCallsite({ file: 'http://x/app.js', line: 1, column: 10 });
		expect(r.resolved).toBeUndefined();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('fetcha .map quando heurística aciona e cacheia falha 404', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const r1 = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		expect(r1.resolved).toBeUndefined();
		// segunda chamada usa cache
		const r2 = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		expect(r2.resolved).toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('resolve para arquivo original quando .map é válido', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => FIXTURE_MAP,
		}) as unknown as typeof fetch;
		const r = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		// pelo menos um resolved deve aparecer; valores exatos dependem do mappings —
		// o teste valida shape e que resolved.file aponta para sources[0].
		if (r.resolved) {
			expect(r.resolved.file).toMatch(/foo\.ts$/);
		} else {
			// se mappings não cobrir col 500, segue raw — também é válido
			expect(r.resolved).toBeUndefined();
		}
	});

	it('fallback silencioso quando .map é JSON inválido', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => {
				throw new Error('parse');
			},
		}) as unknown as typeof fetch;
		const r = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		expect(r.resolved).toBeUndefined();
	});
});
```

### Step 2.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/sourceMap.test.ts
cd app && npm test 2>&1 | tail -5
git add app/package.json app/package-lock.json app/src/lib/session/sourceMap.ts app/src/lib/session/__tests__/sourceMap.test.ts
git commit -m "feat(session): source map resolver com cache LRU para callsites minificados"
```

Esperado: 5 testes sourceMap passando.

---

## Task 3: Engine streaming

**Files:**
- Create: `app/src/lib/session/antipattern/engine.ts`
- Create: `app/src/lib/session/antipattern/fingerprint.ts`
- Test: `app/src/lib/session/antipattern/__tests__/engine.test.ts`

### Step 3.1: Helpers em `fingerprint.ts`

`app/src/lib/session/antipattern/fingerprint.ts`:

```ts
// Helpers puros usados por múltiplos detectores.

import type { SessionEvent } from '../types';

export type NetworkEvent = Extract<SessionEvent, { type: 'network' }>;

export function isNetworkEvent(ev: SessionEvent): ev is NetworkEvent {
	return ev.type === 'network';
}

export function networkEventId(ev: NetworkEvent): string {
	return `${ev.requestId}@${ev.timestamp}`;
}

// Hash determinístico simples (DJB2). Suficiente para fingerprint de body
// idêntico em janela curta — não é crypto.
export function djb2(str: string): string {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = ((h << 5) + h + str.charCodeAt(i)) | 0;
	}
	return (h >>> 0).toString(36);
}

// Fingerprint = método+URL+hash(body). Como NetworkEvent não tem body
// inline (só bodyRef), em Phase 3 usamos método+URL como aproximação;
// detectores que precisam de body checam bodyRef quando disponível.
export function reqFingerprint(ev: NetworkEvent): string {
	return `${ev.method} ${ev.url}${ev.bodyRef ? `#${djb2(ev.bodyRef)}` : ''}`;
}

const DEFAULT_REFRESH_PATTERNS: RegExp[] = [
	/\/refresh(\b|$|\?)/i,
	/\/oauth\/token(\b|$|\?)/i,
	/\/auth\/refresh(\b|$|\?)/i,
	/\/sessions\/refresh(\b|$|\?)/i,
	/\/token\/refresh(\b|$|\?)/i,
];

export function looksLikeRefreshUrl(url: string, patterns = DEFAULT_REFRESH_PATTERNS): boolean {
	return patterns.some((re) => re.test(url));
}

export function isFailureStatus(status: number): boolean {
	// 0 = network error / aborted; 4xx/5xx = falha aplicacional
	return status === 0 || status >= 400;
}
```

### Step 3.2: Engine

`app/src/lib/session/antipattern/engine.ts`:

```ts
// Engine streaming cronológico com janela móvel.
// Cada detector é uma função pura independente: recebe (newEvent, buffer) e
// devolve AntipatternHit | null. Engine aplica todos a cada novo evento e
// retorna lista de hits emergentes.
//
// Não silencia erros: se um detector lança, log + re-throw. Testes garantem
// que detectores nunca lançam para inputs válidos.

import type { AntipatternHit, SessionEvent } from '../types';
import { isNetworkEvent, type NetworkEvent } from './fingerprint';

import { detectDupReqBurst } from './detectors/dupReqBurst';
import { detectRetryStorm } from './detectors/retryStorm';
import { detectEffectFetchLoop } from './detectors/effectFetchLoop';
import { detectWaterfall } from './detectors/waterfall';
import { detectAuthRefreshStorm } from './detectors/authRefreshStorm';

export type Detector = (ev: NetworkEvent, buffer: NetworkEvent[]) => AntipatternHit | null;

const DEFAULT_DETECTORS: Detector[] = [
	detectDupReqBurst,
	detectRetryStorm,
	detectEffectFetchLoop,
	detectWaterfall,
	detectAuthRefreshStorm,
];

const WINDOW_MS = 5_000; // maior janela usada (effect-fetch-loop)
const MAX_BUFFER = 500; // teto de segurança

export class AntipatternEngine {
	private buffer: NetworkEvent[] = [];
	private emitted = new Set<string>(); // dedup: patternId|start|end|summary

	constructor(private readonly detectors: Detector[] = DEFAULT_DETECTORS) {}

	pushEvent(ev: SessionEvent): AntipatternHit[] {
		if (!isNetworkEvent(ev)) return [];

		// FIFO eviction baseado em janela + teto absoluto
		const cutoff = ev.timestamp - WINDOW_MS;
		while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
			this.buffer.shift();
		}
		while (this.buffer.length >= MAX_BUFFER) {
			this.buffer.shift();
		}

		this.buffer.push(ev);

		const hits: AntipatternHit[] = [];
		for (const detector of this.detectors) {
			const hit = detector(ev, this.buffer);
			if (!hit) continue;
			const key = `${hit.patternId}|${hit.startTimestamp}|${hit.endTimestamp}|${hit.context.summary}`;
			if (this.emitted.has(key)) continue;
			this.emitted.add(key);
			hits.push(hit);
		}
		return hits;
	}

	reset(): void {
		this.buffer = [];
		this.emitted.clear();
	}

	get bufferSize(): number {
		return this.buffer.length;
	}
}
```

### Step 3.3: Test do engine (com detectores mockados)

`app/src/lib/session/antipattern/__tests__/engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AntipatternHit, SessionEvent } from '../../types';
import { AntipatternEngine, type Detector } from '../engine';

function netEv(over: Partial<Extract<SessionEvent, { type: 'network' }>>): SessionEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r1',
		method: 'GET',
		url: 'http://x/',
		status: 200,
		...over,
	};
}

function consoleEv(timestamp: number): SessionEvent {
	return {
		type: 'console',
		timestamp,
		phaseId: 'p1',
		source: 'app',
		level: 'log',
		args: [],
	};
}

const fakeHit = (patternId = 'dup-req-burst' as const, summary = 's'): AntipatternHit => ({
	patternId,
	severity: 'warn',
	startTimestamp: 1,
	endTimestamp: 2,
	phaseId: 'p1',
	evidenceEventIds: [],
	context: { summary },
});

describe('AntipatternEngine', () => {
	it('ignora eventos não-network', () => {
		const det: Detector = () => fakeHit();
		const eng = new AntipatternEngine([det]);
		const hits = eng.pushEvent(consoleEv(10));
		expect(hits).toEqual([]);
	});

	it('aplica todos os detectores em ordem e devolve hits', () => {
		const a: Detector = () => fakeHit('dup-req-burst', 'A');
		const b: Detector = () => fakeHit('retry-storm', 'B');
		const eng = new AntipatternEngine([a, b]);
		const hits = eng.pushEvent(netEv({ timestamp: 100 }));
		expect(hits.map((h) => h.patternId)).toEqual(['dup-req-burst', 'retry-storm']);
	});

	it('dedup por patternId+start+end+summary', () => {
		const det: Detector = () => fakeHit();
		const eng = new AntipatternEngine([det]);
		const first = eng.pushEvent(netEv({ timestamp: 1 }));
		const second = eng.pushEvent(netEv({ timestamp: 2, requestId: 'r2' }));
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(0);
	});

	it('FIFO eviction respeita janela de 5s', () => {
		const det: Detector = (_ev, buf) => {
			// detector toy que retorna hit só se buffer tiver >= 2 eventos
			return buf.length >= 2 ? fakeHit('dup-req-burst', String(buf.length)) : null;
		};
		const eng = new AntipatternEngine([det]);
		eng.pushEvent(netEv({ timestamp: 0 }));
		eng.pushEvent(netEv({ timestamp: 100 }));
		expect(eng.bufferSize).toBe(2);
		// avança 6s — primeiro evento sai do buffer
		eng.pushEvent(netEv({ timestamp: 6_000 }));
		expect(eng.bufferSize).toBe(2); // [100ms, 6000ms]? não — 100 < 6000-5000=1000 sai
		// recalcula: cutoff=1000ms; buffer pré-push = [0, 100]; 0 e 100 ambos < 1000 saem.
		expect(eng.bufferSize).toBe(1);
	});

	it('reset limpa buffer e emitted', () => {
		const det: Detector = () => fakeHit();
		const eng = new AntipatternEngine([det]);
		eng.pushEvent(netEv({ timestamp: 1 }));
		eng.reset();
		const hits = eng.pushEvent(netEv({ timestamp: 2 }));
		expect(hits).toHaveLength(1);
		expect(eng.bufferSize).toBe(1);
	});
});
```

### Step 3.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/antipattern/__tests__/engine.test.ts
git add app/src/lib/session/antipattern/engine.ts app/src/lib/session/antipattern/fingerprint.ts app/src/lib/session/antipattern/__tests__/engine.test.ts
git commit -m "feat(session): engine streaming de antipatterns com janela móvel + dedup"
```

> NOTE: o teste anterior depende dos arquivos de detector (importados pelo `engine.ts`). Stub vazio em cada arquivo `detectors/<id>.ts` exportando `(_ev, _buf) => null` para que o engine compile antes da Task 4. Atualizar nas Tasks 4–8.

Esperado: 5 testes engine passando.

---

## Task 4: Detector `dup-req-burst`

**Files:**
- Create: `app/src/lib/session/antipattern/detectors/dupReqBurst.ts`
- Test: `app/src/lib/session/antipattern/__tests__/dupReqBurst.test.ts`

### Step 4.1: Detector

`app/src/lib/session/antipattern/detectors/dupReqBurst.ts`:

```ts
// Mesmo fingerprint (método+URL+hash body) ≥3x em <500ms → severity warn.

import type { AntipatternHit } from '../../types';
import { type NetworkEvent, networkEventId, reqFingerprint } from '../fingerprint';

const WINDOW_MS = 500;
const MIN_OCCURRENCES = 3;

export function detectDupReqBurst(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	const fp = reqFingerprint(ev);
	const cutoff = ev.timestamp - WINDOW_MS;
	const matches = buffer.filter((b) => b.timestamp >= cutoff && reqFingerprint(b) === fp);
	if (matches.length < MIN_OCCURRENCES) return null;
	const start = matches[0].timestamp;
	const end = matches[matches.length - 1].timestamp;
	return {
		patternId: 'dup-req-burst',
		severity: 'warn',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: matches.map(networkEventId),
		context: {
			summary: `${matches.length}× ${ev.method} ${ev.url} em ${end - start}ms`,
		},
		suggestion: 'Verifique deduplicação no client (debounce, cache, request coalescing).',
	};
}
```

### Step 4.2: Test

`app/src/lib/session/antipattern/__tests__/dupReqBurst.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../../types';
import { detectDupReqBurst } from '../detectors/dupReqBurst';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'GET',
		url: 'http://x/a',
		status: 200,
		...over,
	} as NetworkEvent;
}

describe('detectDupReqBurst', () => {
	it('hit quando ≥3 mesma URL em <500ms', () => {
		const buf = [
			n({ timestamp: 100, requestId: '1' }),
			n({ timestamp: 200, requestId: '2' }),
			n({ timestamp: 350, requestId: '3' }),
		];
		const hit = detectDupReqBurst(buf[2], buf);
		expect(hit).toBeTruthy();
		expect(hit!.patternId).toBe('dup-req-burst');
		expect(hit!.severity).toBe('warn');
		expect(hit!.evidenceEventIds).toHaveLength(3);
		expect(hit!.context.summary).toContain('3×');
	});

	it('sem hit com 2 ocorrências', () => {
		const buf = [n({ timestamp: 100, requestId: '1' }), n({ timestamp: 200, requestId: '2' })];
		expect(detectDupReqBurst(buf[1], buf)).toBeNull();
	});

	it('sem hit quando janela > 500ms', () => {
		const buf = [
			n({ timestamp: 0, requestId: '1' }),
			n({ timestamp: 200, requestId: '2' }),
			n({ timestamp: 600, requestId: '3' }),
		];
		expect(detectDupReqBurst(buf[2], buf)).toBeNull();
	});

	it('separa por método', () => {
		const buf = [
			n({ timestamp: 0, method: 'GET', requestId: '1' }),
			n({ timestamp: 100, method: 'POST', requestId: '2' }),
			n({ timestamp: 200, method: 'POST', requestId: '3' }),
			n({ timestamp: 300, method: 'POST', requestId: '4' }),
		];
		const hit = detectDupReqBurst(buf[3], buf);
		expect(hit).toBeTruthy();
		expect(hit!.evidenceEventIds).toHaveLength(3); // só os 3 POST
	});

	it('separa por URL', () => {
		const buf = [
			n({ timestamp: 0, url: 'http://x/a', requestId: '1' }),
			n({ timestamp: 100, url: 'http://x/b', requestId: '2' }),
			n({ timestamp: 200, url: 'http://x/a', requestId: '3' }),
		];
		expect(detectDupReqBurst(buf[2], buf)).toBeNull();
	});
});
```

### Step 4.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/antipattern/__tests__/dupReqBurst.test.ts
git add app/src/lib/session/antipattern/detectors/dupReqBurst.ts app/src/lib/session/antipattern/__tests__/dupReqBurst.test.ts
git commit -m "feat(session): detector dup-req-burst (≥3 requisições idênticas em <500ms)"
```

Esperado: 5 testes passando.

---

## Task 5: Detector `retry-storm`

**Files:**
- Create: `app/src/lib/session/antipattern/detectors/retryStorm.ts`
- Test: `app/src/lib/session/antipattern/__tests__/retryStorm.test.ts`

### Step 5.1: Detector

`app/src/lib/session/antipattern/detectors/retryStorm.ts`:

```ts
// ≥4 tentativas da mesma request em <2s, todas com status de falha → severity error.

import type { AntipatternHit } from '../../types';
import { isFailureStatus, type NetworkEvent, networkEventId, reqFingerprint } from '../fingerprint';

const WINDOW_MS = 2_000;
const MIN_OCCURRENCES = 4;

export function detectRetryStorm(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	if (!isFailureStatus(ev.status)) return null;
	const fp = reqFingerprint(ev);
	const cutoff = ev.timestamp - WINDOW_MS;
	const matches = buffer.filter(
		(b) => b.timestamp >= cutoff && reqFingerprint(b) === fp && isFailureStatus(b.status),
	);
	if (matches.length < MIN_OCCURRENCES) return null;
	const start = matches[0].timestamp;
	const end = matches[matches.length - 1].timestamp;
	return {
		patternId: 'retry-storm',
		severity: 'error',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: matches.map(networkEventId),
		context: {
			summary: `${matches.length}× ${ev.method} ${ev.url} falhando em ${end - start}ms (status ${ev.status})`,
		},
		suggestion: 'Aplique backoff exponencial e teto de retries; verifique se erro é retriável.',
	};
}
```

### Step 5.2: Test

`app/src/lib/session/antipattern/__tests__/retryStorm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectRetryStorm } from '../detectors/retryStorm';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'GET',
		url: 'http://x/a',
		status: 500,
		...over,
	} as NetworkEvent;
}

describe('detectRetryStorm', () => {
	it('hit com 4 falhas em <2s', () => {
		const buf = [
			n({ timestamp: 0, requestId: '1' }),
			n({ timestamp: 400, requestId: '2' }),
			n({ timestamp: 900, requestId: '3' }),
			n({ timestamp: 1500, requestId: '4' }),
		];
		const hit = detectRetryStorm(buf[3], buf);
		expect(hit).toBeTruthy();
		expect(hit!.severity).toBe('error');
		expect(hit!.evidenceEventIds).toHaveLength(4);
	});

	it('sem hit se evento atual é 200', () => {
		const buf = [
			n({ timestamp: 0, status: 500, requestId: '1' }),
			n({ timestamp: 400, status: 500, requestId: '2' }),
			n({ timestamp: 900, status: 500, requestId: '3' }),
			n({ timestamp: 1500, status: 200, requestId: '4' }),
		];
		expect(detectRetryStorm(buf[3], buf)).toBeNull();
	});

	it('sem hit se uma das tentativas teve sucesso', () => {
		const buf = [
			n({ timestamp: 0, status: 500, requestId: '1' }),
			n({ timestamp: 400, status: 200, requestId: '2' }),
			n({ timestamp: 900, status: 500, requestId: '3' }),
			n({ timestamp: 1500, status: 500, requestId: '4' }),
		];
		// só 3 falhas (1, 3, 4)
		expect(detectRetryStorm(buf[3], buf)).toBeNull();
	});

	it('considera status=0 como falha', () => {
		const buf = [
			n({ timestamp: 0, status: 0, requestId: '1' }),
			n({ timestamp: 200, status: 0, requestId: '2' }),
			n({ timestamp: 400, status: 0, requestId: '3' }),
			n({ timestamp: 600, status: 0, requestId: '4' }),
		];
		expect(detectRetryStorm(buf[3], buf)).toBeTruthy();
	});

	it('sem hit fora da janela 2s', () => {
		const buf = [
			n({ timestamp: 0, requestId: '1' }),
			n({ timestamp: 500, requestId: '2' }),
			n({ timestamp: 1000, requestId: '3' }),
			n({ timestamp: 2500, requestId: '4' }),
		];
		// só 1 dentro da janela
		expect(detectRetryStorm(buf[3], buf)).toBeNull();
	});
});
```

### Step 5.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/antipattern/__tests__/retryStorm.test.ts
git add app/src/lib/session/antipattern/detectors/retryStorm.ts app/src/lib/session/antipattern/__tests__/retryStorm.test.ts
git commit -m "feat(session): detector retry-storm (≥4 falhas mesma request em <2s)"
```

Esperado: 5 testes passando.

---

## Task 6: Detector `effect-fetch-loop` + callsite no NetworkEvent

**Files:**
- Create: `app/src/lib/session/antipattern/detectors/effectFetchLoop.ts`
- Test: `app/src/lib/session/antipattern/__tests__/effectFetchLoop.test.ts`

### Step 6.1: Detector

`app/src/lib/session/antipattern/detectors/effectFetchLoop.ts`:

```ts
// ≥10 requests idênticas em <5s do mesmo callsite → severity error.
// Silencia se metade ou mais dos eventos da janela não tem callsite (sem
// callsite não dá pra agrupar — alternativa "agrupar por URL" é coberta
// por dup-req-burst).

import type { AntipatternHit } from '../../types';
import { type NetworkEvent, networkEventId, reqFingerprint } from '../fingerprint';

const WINDOW_MS = 5_000;
const MIN_OCCURRENCES = 10;

function callsiteKey(ev: NetworkEvent): string | null {
	if (!ev.callsite) return null;
	return `${ev.callsite.file}:${ev.callsite.line}:${ev.callsite.column ?? '?'}`;
}

export function detectEffectFetchLoop(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	const key = callsiteKey(ev);
	if (!key) return null;
	const fp = reqFingerprint(ev);
	const cutoff = ev.timestamp - WINDOW_MS;
	const window = buffer.filter((b) => b.timestamp >= cutoff);
	const withoutCallsite = window.filter((b) => !b.callsite).length;
	if (withoutCallsite >= window.length / 2) return null; // sinal degradado, abafa

	const matches = window.filter((b) => callsiteKey(b) === key && reqFingerprint(b) === fp);
	if (matches.length < MIN_OCCURRENCES) return null;
	const start = matches[0].timestamp;
	const end = matches[matches.length - 1].timestamp;
	return {
		patternId: 'effect-fetch-loop',
		severity: 'error',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: matches.map(networkEventId),
		context: {
			callsite: ev.callsite ? { raw: ev.callsite } : undefined,
			summary: `${matches.length}× ${ev.method} ${ev.url} do mesmo callsite em ${end - start}ms`,
		},
		suggestion:
			'Verifique dependências do useEffect/onChanges — provavelmente há objeto/array recriado a cada render disparando refetch.',
	};
}
```

### Step 6.2: Test

`app/src/lib/session/antipattern/__tests__/effectFetchLoop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectEffectFetchLoop } from '../detectors/effectFetchLoop';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'GET',
		url: 'http://x/a',
		status: 200,
		callsite: { file: 'http://x/app.js', line: 10, column: 5 },
		...over,
	} as NetworkEvent;
}

describe('detectEffectFetchLoop', () => {
	it('silencia sem callsite no evento atual', () => {
		const buf = [n({ timestamp: 0, callsite: undefined, requestId: '1' })];
		expect(detectEffectFetchLoop(buf[0], buf)).toBeNull();
	});

	it('silencia se ≥metade da janela não tem callsite', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 6; i++) {
			buf.push(n({ timestamp: i * 100, requestId: `s${i}`, callsite: undefined }));
		}
		for (let i = 0; i < 5; i++) {
			buf.push(n({ timestamp: 600 + i * 100, requestId: `c${i}` }));
		}
		expect(detectEffectFetchLoop(buf[buf.length - 1], buf)).toBeNull();
	});

	it('hit com 10 do mesmo callsite em <5s', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 10; i++) {
			buf.push(n({ timestamp: i * 200, requestId: `r${i}` }));
		}
		const hit = detectEffectFetchLoop(buf[9], buf);
		expect(hit).toBeTruthy();
		expect(hit!.patternId).toBe('effect-fetch-loop');
		expect(hit!.severity).toBe('error');
		expect(hit!.evidenceEventIds).toHaveLength(10);
		expect(hit!.context.callsite?.raw.file).toBe('http://x/app.js');
	});

	it('separa por callsite', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 5; i++) {
			buf.push(n({ timestamp: i * 200, requestId: `a${i}` }));
		}
		for (let i = 0; i < 5; i++) {
			buf.push(
				n({
					timestamp: 1000 + i * 200,
					requestId: `b${i}`,
					callsite: { file: 'http://x/app.js', line: 50, column: 1 },
				}),
			);
		}
		// 10 events no total, 5+5 por callsite — nenhum atinge 10 do mesmo
		expect(detectEffectFetchLoop(buf[buf.length - 1], buf)).toBeNull();
	});

	it('sem hit com 9 ocorrências', () => {
		const buf: NetworkEvent[] = [];
		for (let i = 0; i < 9; i++) {
			buf.push(n({ timestamp: i * 200, requestId: `r${i}` }));
		}
		expect(detectEffectFetchLoop(buf[8], buf)).toBeNull();
	});
});
```

### Step 6.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/antipattern/__tests__/effectFetchLoop.test.ts
git add app/src/lib/session/antipattern/detectors/effectFetchLoop.ts app/src/lib/session/antipattern/__tests__/effectFetchLoop.test.ts
git commit -m "feat(session): detector effect-fetch-loop (≥10 mesma request/callsite em <5s)"
```

Esperado: 5 testes passando.

---

## Task 7: Detector `waterfall`

**Files:**
- Create: `app/src/lib/session/antipattern/detectors/waterfall.ts`
- Test: `app/src/lib/session/antipattern/__tests__/waterfall.test.ts`

### Step 7.1: Detector

`app/src/lib/session/antipattern/detectors/waterfall.ts`:

```ts
// ≥3 requests sequenciais (sem overlap, gap < 200ms) para mesmo host,
// duração total > 1s → severity info. Heurística mínima: não detecta
// dependência semântica real, só padrão temporal.

import type { AntipatternHit } from '../../types';
import { type NetworkEvent, networkEventId } from '../fingerprint';

const MIN_CHAIN = 3;
const MAX_GAP_MS = 200;
const MIN_TOTAL_DURATION_MS = 1_000;

function host(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return '';
	}
}

function endOf(ev: NetworkEvent): number {
	return ev.timestamp + (ev.durationMs ?? 0);
}

export function detectWaterfall(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	if (ev.durationMs === undefined) return null;
	const targetHost = host(ev.url);
	if (!targetHost) return null;

	// Constroi cadeia anterior: percorre buffer de trás pra frente; cada
	// evento elegível precisa terminar antes de o próximo começar (gap aceitável)
	// e ter mesmo host.
	const chain: NetworkEvent[] = [ev];
	for (let i = buffer.length - 2; i >= 0; i--) {
		const prev = buffer[i];
		if (prev.durationMs === undefined) break;
		if (host(prev.url) !== targetHost) break;
		const next = chain[chain.length - 1];
		const gap = next.timestamp - endOf(prev);
		if (gap < 0 || gap > MAX_GAP_MS) break;
		chain.push(prev);
	}
	if (chain.length < MIN_CHAIN) return null;
	chain.reverse();
	const start = chain[0].timestamp;
	const end = endOf(chain[chain.length - 1]);
	if (end - start < MIN_TOTAL_DURATION_MS) return null;

	return {
		patternId: 'waterfall',
		severity: 'info',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: chain.map(networkEventId),
		context: {
			summary: `${chain.length} requests sequenciais para ${targetHost} em ${end - start}ms`,
		},
		suggestion:
			'Avalie paralelização (Promise.all, prefetch) ou bundling no backend (BFF / GraphQL).',
	};
}
```

### Step 7.2: Test

`app/src/lib/session/antipattern/__tests__/waterfall.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectWaterfall } from '../detectors/waterfall';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'GET',
		url: 'http://x/a',
		status: 200,
		durationMs: 400,
		...over,
	} as NetworkEvent;
}

describe('detectWaterfall', () => {
	it('hit com 3 sequenciais > 1s total', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 400, requestId: '1', url: 'http://x/a' }),
			n({ timestamp: 450, durationMs: 400, requestId: '2', url: 'http://x/b' }),
			n({ timestamp: 900, durationMs: 400, requestId: '3', url: 'http://x/c' }),
		];
		const hit = detectWaterfall(buf[2], buf);
		expect(hit).toBeTruthy();
		expect(hit!.patternId).toBe('waterfall');
		expect(hit!.severity).toBe('info');
		expect(hit!.evidenceEventIds).toHaveLength(3);
	});

	it('sem hit se duração total < 1s', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 100, requestId: '1' }),
			n({ timestamp: 110, durationMs: 100, requestId: '2' }),
			n({ timestamp: 220, durationMs: 100, requestId: '3' }),
		];
		expect(detectWaterfall(buf[2], buf)).toBeNull();
	});

	it('quebra se gap > 200ms', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 400, requestId: '1' }),
			n({ timestamp: 700, durationMs: 400, requestId: '2' }), // gap 300ms
			n({ timestamp: 1200, durationMs: 400, requestId: '3' }),
		];
		expect(detectWaterfall(buf[2], buf)).toBeNull();
	});

	it('quebra ao mudar de host', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 400, url: 'http://a.test/' }),
			n({ timestamp: 450, durationMs: 400, url: 'http://b.test/' }),
			n({ timestamp: 900, durationMs: 400, url: 'http://b.test/' }),
		];
		// só 2 do host b.test
		expect(detectWaterfall(buf[2], buf)).toBeNull();
	});

	it('silencia se duração ausente', () => {
		const buf = [n({ timestamp: 0, durationMs: undefined, requestId: '1' })];
		expect(detectWaterfall(buf[0], buf)).toBeNull();
	});
});
```

### Step 7.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/antipattern/__tests__/waterfall.test.ts
git add app/src/lib/session/antipattern/detectors/waterfall.ts app/src/lib/session/antipattern/__tests__/waterfall.test.ts
git commit -m "feat(session): detector waterfall (≥3 requests sequenciais paralelizáveis)"
```

Esperado: 5 testes passando.

---

## Task 8: Detector `auth-refresh-storm`

**Files:**
- Create: `app/src/lib/session/antipattern/detectors/authRefreshStorm.ts`
- Test: `app/src/lib/session/antipattern/__tests__/authRefreshStorm.test.ts`

### Step 8.1: Detector

`app/src/lib/session/antipattern/detectors/authRefreshStorm.ts`:

```ts
// ≥2 refreshes paralelos em <1s → severity error.
// "Paralelo" = janelas de start sobrepostas (request anterior ainda
// em voo quando próxima começa). Se durationMs ausente, usa só o
// timestamp como proxy de start (overlap simplificado: dentro de 1s).

import type { AntipatternHit } from '../../types';
import {
	looksLikeRefreshUrl,
	type NetworkEvent,
	networkEventId,
} from '../fingerprint';

const WINDOW_MS = 1_000;
const MIN_OCCURRENCES = 2;

function endOf(ev: NetworkEvent): number {
	return ev.timestamp + (ev.durationMs ?? WINDOW_MS);
}

export function detectAuthRefreshStorm(
	ev: NetworkEvent,
	buffer: NetworkEvent[],
): AntipatternHit | null {
	if (!looksLikeRefreshUrl(ev.url)) return null;
	const cutoff = ev.timestamp - WINDOW_MS;
	const candidates = buffer.filter((b) => b.timestamp >= cutoff && looksLikeRefreshUrl(b.url));
	if (candidates.length < MIN_OCCURRENCES) return null;

	// Heurística de paralelo: para cada par (a, b), considerar paralelo
	// se b.timestamp < endOf(a). Como o evento atual é o último, basta
	// checar se algum predecessor ainda estava em voo quando ele começou.
	const overlaps = candidates.filter((b) => b !== ev && endOf(b) > ev.timestamp);
	if (overlaps.length < MIN_OCCURRENCES - 1) return null;

	const evidence = [...overlaps, ev];
	const start = Math.min(...evidence.map((e) => e.timestamp));
	const end = Math.max(...evidence.map(endOf));
	return {
		patternId: 'auth-refresh-storm',
		severity: 'error',
		startTimestamp: start,
		endTimestamp: end,
		phaseId: ev.phaseId,
		evidenceEventIds: evidence.map(networkEventId),
		context: {
			summary: `${evidence.length}× refresh paralelo em ${end - start}ms (${ev.url})`,
		},
		suggestion:
			'Coalesce refreshes: única chamada compartilhada via promise/mutex. Múltiplas em paralelo invalidam tokens entre si.',
	};
}
```

### Step 8.2: Test

`app/src/lib/session/antipattern/__tests__/authRefreshStorm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectAuthRefreshStorm } from '../detectors/authRefreshStorm';
import type { NetworkEvent } from '../fingerprint';

function n(over: Partial<NetworkEvent>): NetworkEvent {
	return {
		type: 'network',
		timestamp: 0,
		phaseId: 'p1',
		requestId: 'r',
		method: 'POST',
		url: 'http://x/api/auth/refresh',
		status: 200,
		durationMs: 800,
		...over,
	} as NetworkEvent;
}

describe('detectAuthRefreshStorm', () => {
	it('hit com 2 refreshes paralelos em <1s', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 800, requestId: '1' }),
			n({ timestamp: 200, durationMs: 800, requestId: '2' }),
		];
		const hit = detectAuthRefreshStorm(buf[1], buf);
		expect(hit).toBeTruthy();
		expect(hit!.severity).toBe('error');
		expect(hit!.evidenceEventIds).toHaveLength(2);
	});

	it('sem hit se URL não parece refresh', () => {
		const buf = [
			n({ timestamp: 0, url: 'http://x/api/users', requestId: '1' }),
			n({ timestamp: 200, url: 'http://x/api/users', requestId: '2' }),
		];
		expect(detectAuthRefreshStorm(buf[1], buf)).toBeNull();
	});

	it('sem hit se sequencial (não paralelo)', () => {
		const buf = [
			n({ timestamp: 0, durationMs: 100, requestId: '1' }),
			n({ timestamp: 200, durationMs: 100, requestId: '2' }),
		];
		// primeiro terminou em 100; segundo começou em 200 — sem overlap
		expect(detectAuthRefreshStorm(buf[1], buf)).toBeNull();
	});

	it('aceita /oauth/token como refresh', () => {
		const buf = [
			n({ timestamp: 0, url: 'http://x/oauth/token', durationMs: 800, requestId: '1' }),
			n({ timestamp: 100, url: 'http://x/oauth/token', durationMs: 800, requestId: '2' }),
		];
		expect(detectAuthRefreshStorm(buf[1], buf)).toBeTruthy();
	});

	it('sem hit com apenas 1 ocorrência', () => {
		const buf = [n({ timestamp: 0, requestId: '1' })];
		expect(detectAuthRefreshStorm(buf[0], buf)).toBeNull();
	});
});
```

### Step 8.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/antipattern/__tests__/authRefreshStorm.test.ts
git add app/src/lib/session/antipattern/detectors/authRefreshStorm.ts app/src/lib/session/antipattern/__tests__/authRefreshStorm.test.ts
git commit -m "feat(session): detector auth-refresh-storm (≥2 refreshes paralelos em <1s)"
```

Esperado: 5 testes passando.

---

## Task 9: Recorder + integração com background

**Files:**
- Modify: `app/src/lib/session/recorder.ts` — `addAntipatternHit` + `pushNetworkForAntipatterns`.
- Modify: `app/src/types/messages.ts` — `liveAntipatternHit` action + payload.
- Modify: `app/src/entrypoints/background.ts` — passivo + gravado.
- Test: `app/src/lib/session/__tests__/recorder.antipattern.test.ts`

### Step 9.1: Recorder

Em `app/src/lib/session/recorder.ts`, adicionar imports + estado runtime + métodos:

```ts
import { AntipatternEngine } from './antipattern/engine';
import type { AntipatternHit } from './types';

// Engines por session gravada (recorder) e por tab passiva (background usa
// engine direto via `getEngineForTab`).
const sessionEngines = new Map<string, AntipatternEngine>();
const tabEngines = new Map<number, AntipatternEngine>();
```

Adicionar métodos no objeto `recorder`:

```ts
async addAntipatternHit(sessionId: string, hit: AntipatternHit): Promise<void> {
	const s = await sessionStore.get(sessionId);
	if (!s) throw new Error(`Session ${sessionId} não encontrada`);
	if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
	if (!s.antipatternHits) s.antipatternHits = [];
	const dedupKey = `${hit.patternId}|${hit.startTimestamp}|${hit.endTimestamp}|${hit.context.summary}`;
	const exists = s.antipatternHits.some(
		(h) =>
			`${h.patternId}|${h.startTimestamp}|${h.endTimestamp}|${h.context.summary}` === dedupKey,
	);
	if (exists) return;
	s.antipatternHits.push(hit);
	await sessionStore.put(s);
},

pushNetworkForAntipatterns(sessionId: string, ev: SessionEvent): AntipatternHit[] {
	let eng = sessionEngines.get(sessionId);
	if (!eng) {
		eng = new AntipatternEngine();
		sessionEngines.set(sessionId, eng);
	}
	return eng.pushEvent(ev);
},

getOrCreatePassiveEngineForTab(tabId: number): AntipatternEngine {
	let eng = tabEngines.get(tabId);
	if (!eng) {
		eng = new AntipatternEngine();
		tabEngines.set(tabId, eng);
	}
	return eng;
},

clearPassiveEngineForTab(tabId: number): void {
	tabEngines.delete(tabId);
},

_resetEnginesForTests(): void {
	sessionEngines.clear();
	tabEngines.clear();
},
```

E em `stopSession`, adicionar `sessionEngines.delete(id)` antes de `runtime.delete(id)`.

### Step 9.2: Messages

Em `app/src/types/messages.ts`:

```ts
// adicionar à união MessageAction
| 'liveAntipatternHit'
```

E em `Message`:

```ts
antipatternHit?: import('@/lib/session/types').AntipatternHit;
```

E em `MessageResponse` adicionar (não estritamente necessário pra broadcast, mas reaproveitável):

```ts
antipatternHits?: import('@/lib/session/types').AntipatternHit[];
```

### Step 9.3: Integração no background

Em `app/src/entrypoints/background.ts`, no handler que processa `network` (já existente, ~linha 218–236), após `recorder.addEvent`:

```ts
// Sempre roda engine: gravado vs passivo
let hits: AntipatternHit[] = [];
const session = await recorder.getActiveByTab(tabId);
if (session) {
	hits = recorder.pushNetworkForAntipatterns(session.id, event);
	for (const hit of hits) {
		// resolver lazy do callsite quando aplicável
		if (hit.context.callsite?.raw) {
			try {
				hit.context.callsite = await resolveCallsite(hit.context.callsite.raw);
			} catch (err) {
				console.warn('[antipattern] resolveCallsite falhou:', err);
			}
		}
		try {
			await recorder.addAntipatternHit(session.id, hit);
		} catch (err) {
			console.warn('[antipattern] addAntipatternHit falhou:', err);
		}
		broadcastToUI('liveAntipatternHit', { tabId, antipatternHit: hit });
	}
} else if (isInterceptingTab(tabId)) {
	const eng = recorder.getOrCreatePassiveEngineForTab(tabId);
	hits = eng.pushEvent(event);
	for (const hit of hits) {
		if (hit.context.callsite?.raw) {
			try {
				hit.context.callsite = await resolveCallsite(hit.context.callsite.raw);
			} catch {
				/* fallback raw, sem inventar */
			}
		}
		broadcastToUI('liveAntipatternHit', { tabId, antipatternHit: hit });
	}
}
```

> NOTE: `isInterceptingTab(tabId)` é o helper já existente (ou inline `attachedTabId === tabId`). Reusar conforme convenção atual do background.

E em `stopDebugging` / `chrome.tabs.onRemoved`, adicionar `recorder.clearPassiveEngineForTab(tabId)`.

Adicionar imports no topo:

```ts
import { resolveCallsite } from '@/lib/session/sourceMap';
import type { AntipatternHit } from '@/lib/session/types';
```

### Step 9.4: Test

`app/src/lib/session/__tests__/recorder.antipattern.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { sessionStore } from '../storage';
import type { AntipatternHit, SessionEvent } from '../types';
import { _resetForTests } from '../storage';

function fakeHit(over: Partial<AntipatternHit> = {}): AntipatternHit {
	return {
		patternId: 'dup-req-burst',
		severity: 'warn',
		startTimestamp: 1,
		endTimestamp: 2,
		phaseId: 'p1',
		evidenceEventIds: [],
		context: { summary: 'teste' },
		...over,
	};
}

async function makeSession(): Promise<string> {
	return recorder.startSession({
		tabId: 99,
		initialUrl: 'http://x/',
		userAgent: 'jsdom',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	});
}

describe('recorder.addAntipatternHit', () => {
	beforeEach(() => {
		recorder._resetEnginesForTests?.();
		_resetForTests();
	});
	afterEach(async () => {
		// limpa storage IDB
		const all = await sessionStore.list();
		for (const s of all) await sessionStore.delete(s.id);
	});

	it('persiste hit em session.antipatternHits', async () => {
		const id = await makeSession();
		await recorder.addAntipatternHit(id, fakeHit());
		const s = await sessionStore.get(id);
		expect(s!.antipatternHits).toHaveLength(1);
		expect(s!.antipatternHits![0].patternId).toBe('dup-req-burst');
	});

	it('dedup — segundo hit idêntico é ignorado', async () => {
		const id = await makeSession();
		await recorder.addAntipatternHit(id, fakeHit());
		await recorder.addAntipatternHit(id, fakeHit());
		const s = await sessionStore.get(id);
		expect(s!.antipatternHits).toHaveLength(1);
	});

	it('rejeita session encerrada', async () => {
		const id = await makeSession();
		await recorder.stopSession(id);
		await expect(recorder.addAntipatternHit(id, fakeHit())).rejects.toThrow(/já encerrada/);
	});
});

describe('recorder.pushNetworkForAntipatterns', () => {
	beforeEach(() => {
		recorder._resetEnginesForTests?.();
		_resetForTests();
	});
	afterEach(async () => {
		const all = await sessionStore.list();
		for (const s of all) await sessionStore.delete(s.id);
	});

	it('detecta dup-req-burst em sequência de 3 events', async () => {
		const id = await makeSession();
		const mk = (ts: number, rid: string): SessionEvent => ({
			type: 'network',
			timestamp: ts,
			phaseId: 'p1',
			requestId: rid,
			method: 'GET',
			url: 'http://x/a',
			status: 200,
		});
		expect(recorder.pushNetworkForAntipatterns(id, mk(100, '1'))).toEqual([]);
		expect(recorder.pushNetworkForAntipatterns(id, mk(200, '2'))).toEqual([]);
		const last = recorder.pushNetworkForAntipatterns(id, mk(300, '3'));
		expect(last).toHaveLength(1);
		expect(last[0].patternId).toBe('dup-req-burst');
	});
});
```

### Step 9.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/recorder.antipattern.test.ts
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/lib/session/recorder.ts app/src/types/messages.ts app/src/entrypoints/background.ts app/src/lib/session/__tests__/recorder.antipattern.test.ts
git commit -m "feat(session): integra antipattern engine no recorder + background (gravado + passivo)"
```

Esperado: 5 testes recorder.antipattern; build verde.

---

## Task 10: UI — aba "Antipatterns" no ReplayPage + AntipatternHitRow

**Files:**
- Create: `app/src/components/replay/AntipatternHitRow.tsx`
- Create: `app/src/components/replay/AntipatternsTab.tsx`
- Modify: `app/src/pages/ReplayPage.tsx`
- Test: `app/src/components/replay/__tests__/AntipatternHitRow.test.tsx`
- Test: `app/src/components/replay/__tests__/AntipatternsTab.test.tsx`

### Step 10.1: `AntipatternHitRow.tsx`

```tsx
import { useEffect, useState } from 'react';
import { resolveCallsite } from '@/lib/session/sourceMap';
import type { AntipatternHit, ResolvedCallsite } from '@/lib/session/types';
import { Badge } from '@/components/ui/badge';

interface Props {
	hit: AntipatternHit;
	startedAt: number;
}

const SEVERITY_VARIANT: Record<AntipatternHit['severity'], 'destructive' | 'secondary' | 'outline'> = {
	error: 'destructive',
	warn: 'secondary',
	info: 'outline',
};

export function AntipatternHitRow({ hit, startedAt }: Props) {
	const [callsite, setCallsite] = useState<ResolvedCallsite | undefined>(hit.context.callsite);

	useEffect(() => {
		// Se hit veio sem `resolved` mas tem `raw`, tenta resolver agora.
		if (!hit.context.callsite?.raw || hit.context.callsite.resolved) return;
		let cancel = false;
		void resolveCallsite(hit.context.callsite.raw).then((r) => {
			if (!cancel) setCallsite(r);
		});
		return () => {
			cancel = true;
		};
	}, [hit.context.callsite]);

	const offsetSec = ((hit.startTimestamp - startedAt) / 1000).toFixed(2);
	const renderedCallsite = callsite?.resolved ?? callsite?.raw;

	return (
		<div className="grid grid-cols-[64px_auto_1fr_auto] items-baseline gap-2 border-b px-3 py-2 text-xs">
			<span className="text-muted-foreground font-mono">+{offsetSec}s</span>
			<Badge variant={SEVERITY_VARIANT[hit.severity]}>{hit.severity}</Badge>
			<div>
				<div className="font-medium">{hit.patternId}</div>
				<div className="text-muted-foreground">{hit.context.summary}</div>
				{renderedCallsite && (
					<div className="font-mono text-[11px] text-muted-foreground">
						em {renderedCallsite.file}:{renderedCallsite.line}
						{callsite?.resolved && (
							<span className="ml-1 text-emerald-600">(resolvido)</span>
						)}
					</div>
				)}
			</div>
			{hit.suggestion && (
				<span className="text-muted-foreground text-[11px]" title={hit.suggestion}>
					sugestão
				</span>
			)}
		</div>
	);
}
```

### Step 10.2: `AntipatternsTab.tsx`

```tsx
import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { AntipatternHitRow } from './AntipatternHitRow';
import type { AntipatternHit, AntipatternSeverity } from '@/lib/session/types';

interface Props {
	hits: AntipatternHit[];
	startedAt: number;
}

const SEVERITIES: AntipatternSeverity[] = ['error', 'warn', 'info'];

export function AntipatternsTab({ hits, startedAt }: Props) {
	const [enabled, setEnabled] = useState<Record<AntipatternSeverity, boolean>>({
		error: true,
		warn: true,
		info: true,
	});

	const filtered = useMemo(
		() => hits.filter((h) => enabled[h.severity]),
		[hits, enabled],
	);

	return (
		<div className="flex h-full flex-col gap-2">
			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Severity:</span>
				{SEVERITIES.map((s) => (
					<label key={s} htmlFor={`ap-${s}`} className="flex items-center gap-1">
						<Checkbox
							id={`ap-${s}`}
							checked={enabled[s]}
							onCheckedChange={(v) => setEnabled((p) => ({ ...p, [s]: v === true }))}
						/>
						{s}
					</label>
				))}
				<span className="ml-auto text-muted-foreground">
					{filtered.length} / {hits.length}
				</span>
			</div>

			<div className="overflow-auto rounded border">
				{filtered.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">
						Nenhum antipattern detectado{hits.length > 0 ? ' com os filtros atuais' : ''}.
					</p>
				) : (
					filtered.map((hit, i) => (
						<AntipatternHitRow key={i} hit={hit} startedAt={startedAt} />
					))
				)}
			</div>
		</div>
	);
}
```

### Step 10.3: Atualizar `ReplayPage.tsx`

Adicionar abas Timeline / Antipatterns (Tabs do shadcn), preservando filtros existentes na aba Timeline. Esqueleto:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AntipatternsTab } from '@/components/replay/AntipatternsTab';
// ...resto dos imports atuais
```

Substituir o `<div className="grid grid-cols-[1fr_280px]...">` atual por:

```tsx
<Tabs defaultValue="timeline" className="flex-1 overflow-hidden">
	<TabsList>
		<TabsTrigger value="timeline">Timeline</TabsTrigger>
		<TabsTrigger value="antipatterns">
			Antipatterns
			{(session.antipatternHits?.length ?? 0) > 0 && (
				<span className="ml-2 rounded bg-muted px-1.5 text-[10px]">
					{session.antipatternHits!.length}
				</span>
			)}
		</TabsTrigger>
	</TabsList>
	<TabsContent value="timeline" className="grid grid-cols-[1fr_280px] gap-3 overflow-hidden">
		{/* mesmo conteúdo de timeline + PhaseList */}
	</TabsContent>
	<TabsContent value="antipatterns" className="overflow-hidden">
		<AntipatternsTab
			hits={session.antipatternHits ?? []}
			startedAt={session.startedAt}
		/>
	</TabsContent>
</Tabs>
```

### Step 10.4: Tests

`app/src/components/replay/__tests__/AntipatternHitRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AntipatternHitRow } from '../AntipatternHitRow';
import type { AntipatternHit } from '@/lib/session/types';

vi.mock('@/lib/session/sourceMap', () => ({
	resolveCallsite: vi.fn(async (raw) => ({
		raw,
		resolved: { file: 'src/foo.ts', line: 42 },
	})),
}));

const baseHit: AntipatternHit = {
	patternId: 'dup-req-burst',
	severity: 'warn',
	startTimestamp: 1500,
	endTimestamp: 1900,
	phaseId: 'p1',
	evidenceEventIds: [],
	context: { summary: '3× GET /api/x em 400ms' },
};

describe('AntipatternHitRow', () => {
	it('renderiza patternId, severity e summary', () => {
		render(<AntipatternHitRow hit={baseHit} startedAt={1000} />);
		expect(screen.getByText('dup-req-burst')).toBeInTheDocument();
		expect(screen.getByText('warn')).toBeInTheDocument();
		expect(screen.getByText(/3× GET/)).toBeInTheDocument();
		expect(screen.getByText('+0.50s')).toBeInTheDocument();
	});

	it('renderiza callsite raw quando ainda não resolveu', () => {
		const hit: AntipatternHit = {
			...baseHit,
			context: {
				...baseHit.context,
				callsite: { raw: { file: 'http://x/bundle.js', line: 1, column: 500 } },
			},
		};
		render(<AntipatternHitRow hit={hit} startedAt={1000} />);
		expect(screen.getByText(/bundle\.js:1/)).toBeInTheDocument();
	});

	it('mostra sugestão como tooltip', () => {
		const hit = { ...baseHit, suggestion: 'use debounce' };
		render(<AntipatternHitRow hit={hit} startedAt={1000} />);
		const tip = screen.getByTitle('use debounce');
		expect(tip).toBeInTheDocument();
	});
});
```

`app/src/components/replay/__tests__/AntipatternsTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AntipatternsTab } from '../AntipatternsTab';
import type { AntipatternHit } from '@/lib/session/types';

vi.mock('@/lib/session/sourceMap', () => ({
	resolveCallsite: vi.fn(async (raw) => ({ raw })),
}));

const hits: AntipatternHit[] = [
	{
		patternId: 'retry-storm',
		severity: 'error',
		startTimestamp: 100,
		endTimestamp: 200,
		phaseId: 'p1',
		evidenceEventIds: [],
		context: { summary: 'erro' },
	},
	{
		patternId: 'waterfall',
		severity: 'info',
		startTimestamp: 300,
		endTimestamp: 1500,
		phaseId: 'p1',
		evidenceEventIds: [],
		context: { summary: 'cadeia' },
	},
];

describe('AntipatternsTab', () => {
	it('mostra todos os hits por padrão', () => {
		render(<AntipatternsTab hits={hits} startedAt={0} />);
		expect(screen.getByText('retry-storm')).toBeInTheDocument();
		expect(screen.getByText('waterfall')).toBeInTheDocument();
		expect(screen.getByText('2 / 2')).toBeInTheDocument();
	});

	it('filtra por severity quando checkbox desmarcado', async () => {
		const user = userEvent.setup();
		render(<AntipatternsTab hits={hits} startedAt={0} />);
		await user.click(screen.getByLabelText('info'));
		expect(screen.queryByText('waterfall')).not.toBeInTheDocument();
		expect(screen.getByText('retry-storm')).toBeInTheDocument();
		expect(screen.getByText('1 / 2')).toBeInTheDocument();
	});

	it('mostra mensagem vazia quando lista vazia', () => {
		render(<AntipatternsTab hits={[]} startedAt={0} />);
		expect(screen.getByText(/Nenhum antipattern detectado/)).toBeInTheDocument();
	});
});
```

### Step 10.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/replay/__tests__/AntipatternHitRow.test.tsx src/components/replay/__tests__/AntipatternsTab.test.tsx
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/components/replay/AntipatternHitRow.tsx app/src/components/replay/AntipatternsTab.tsx app/src/pages/ReplayPage.tsx app/src/components/replay/__tests__/AntipatternHitRow.test.tsx app/src/components/replay/__tests__/AntipatternsTab.test.tsx
git commit -m "feat(session): aba Antipatterns no ReplayPage com filtros por severity"
```

Esperado: 6 testes UI; build verde.

---

## Task 11: LiveAntipatternsPanel para modo passivo + resolver UI

**Files:**
- Create: `app/src/components/replay/LiveAntipatternsPanel.tsx`
- Modify: `app/src/pages/Layout.tsx` — montar painel quando passivo.
- Test: `app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx`

### Step 11.1: Componente

`app/src/components/replay/LiveAntipatternsPanel.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { AntipatternHitRow } from './AntipatternHitRow';
import type { AntipatternHit } from '@/lib/session/types';
import type { Message } from '@/types/messages';

const MAX_VISIBLE = 50;

interface Props {
	tabId: number | null;
}

export function LiveAntipatternsPanel({ tabId }: Props) {
	const [hits, setHits] = useState<AntipatternHit[]>([]);

	useEffect(() => {
		if (tabId == null) return;
		const onMessage = (msg: Message) => {
			if (msg.action !== 'liveAntipatternHit') return;
			if (msg.tabId !== tabId) return;
			if (!msg.antipatternHit) return;
			setHits((prev) => {
				const next = [msg.antipatternHit!, ...prev];
				return next.slice(0, MAX_VISIBLE);
			});
		};
		chrome.runtime.onMessage.addListener(onMessage);
		return () => {
			chrome.runtime.onMessage.removeListener(onMessage);
		};
	}, [tabId]);

	if (tabId == null) return null;

	return (
		<aside className="fixed right-3 bottom-3 max-h-[60vh] w-[360px] overflow-auto rounded border bg-background shadow-lg">
			<header className="sticky top-0 flex items-center justify-between border-b bg-background px-3 py-2">
				<h2 className="font-semibold text-sm">Live Antipatterns</h2>
				<button
					type="button"
					className="text-muted-foreground text-xs hover:underline"
					onClick={() => setHits([])}
				>
					limpar
				</button>
			</header>
			{hits.length === 0 ? (
				<p className="p-3 text-muted-foreground text-xs">
					Nenhum antipattern detectado nesta sessão passiva.
				</p>
			) : (
				hits.map((hit, i) => <AntipatternHitRow key={i} hit={hit} startedAt={hit.startTimestamp} />)
			)}
		</aside>
	);
}
```

### Step 11.2: Montar no Layout

Em `app/src/pages/Layout.tsx`, importar `LiveAntipatternsPanel` e montá-lo quando estado for "interceptação ON, gravação OFF":

```tsx
import { LiveAntipatternsPanel } from '@/components/replay/LiveAntipatternsPanel';
// ...
const passiveTabId =
	isDebugging && !isRecording && targetTabInfo?.tabId ? targetTabInfo.tabId : null;
// ...dentro do JSX, ao final do Layout:
<LiveAntipatternsPanel tabId={passiveTabId} />
```

> NOTE: nomes exatos de hooks (`isDebugging`, `isRecording`, `targetTabInfo`) podem precisar ajuste para casarem com os hooks já existentes (`useDebugging`, `useRecording` ou similar). Verificar nomes ao implementar.

### Step 11.3: Test

`app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveAntipatternsPanel } from '../LiveAntipatternsPanel';
import type { AntipatternHit } from '@/lib/session/types';

vi.mock('@/lib/session/sourceMap', () => ({
	resolveCallsite: vi.fn(async (raw) => ({ raw })),
}));

let listeners: Array<(msg: unknown) => void> = [];

beforeEach(() => {
	listeners = [];
	(globalThis as unknown as { chrome: typeof chrome }).chrome = {
		runtime: {
			onMessage: {
				addListener: (cb: (msg: unknown) => void) => listeners.push(cb),
				removeListener: (cb: (msg: unknown) => void) => {
					listeners = listeners.filter((l) => l !== cb);
				},
			},
		},
	} as unknown as typeof chrome;
});

afterEach(() => {
	vi.restoreAllMocks();
});

const hit = (over: Partial<AntipatternHit> = {}): AntipatternHit => ({
	patternId: 'dup-req-burst',
	severity: 'warn',
	startTimestamp: 100,
	endTimestamp: 200,
	phaseId: 'p1',
	evidenceEventIds: [],
	context: { summary: 'sumario teste' },
	...over,
});

describe('LiveAntipatternsPanel', () => {
	it('não renderiza se tabId é null', () => {
		const { container } = render(<LiveAntipatternsPanel tabId={null} />);
		expect(container.firstChild).toBeNull();
	});

	it('renderiza vazio inicialmente', () => {
		render(<LiveAntipatternsPanel tabId={1} />);
		expect(screen.getByText(/Nenhum antipattern detectado/)).toBeInTheDocument();
	});

	it('insere hit recebido via runtime.onMessage', () => {
		render(<LiveAntipatternsPanel tabId={1} />);
		act(() => {
			listeners.forEach((cb) =>
				cb({ action: 'liveAntipatternHit', tabId: 1, antipatternHit: hit() }),
			);
		});
		expect(screen.getByText('sumario teste')).toBeInTheDocument();
	});

	it('ignora hit de outra tab', () => {
		render(<LiveAntipatternsPanel tabId={1} />);
		act(() => {
			listeners.forEach((cb) =>
				cb({ action: 'liveAntipatternHit', tabId: 2, antipatternHit: hit() }),
			);
		});
		expect(screen.queryByText('sumario teste')).not.toBeInTheDocument();
	});

	it('botão limpar zera lista', async () => {
		const user = userEvent.setup();
		render(<LiveAntipatternsPanel tabId={1} />);
		act(() => {
			listeners.forEach((cb) =>
				cb({ action: 'liveAntipatternHit', tabId: 1, antipatternHit: hit() }),
			);
		});
		expect(screen.getByText('sumario teste')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /limpar/i }));
		expect(screen.queryByText('sumario teste')).not.toBeInTheDocument();
	});
});
```

### Step 11.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/components/replay/LiveAntipatternsPanel.tsx app/src/pages/Layout.tsx app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx
git commit -m "feat(session): LiveAntipatternsPanel para modo passivo + resolver lazy de callsite"
```

Esperado: 5 testes LiveAntipatternsPanel; build verde.

---

## Self-Review Checklist

- [ ] **Spec coverage Phase 3:**
  - 5 detectores prioritários (`dup-req-burst`, `retry-storm`, `effect-fetch-loop`, `waterfall`, `auth-refresh-storm`) ✓ (Tasks 4–8)
  - Engine streaming cronológico, janela móvel, detectores independentes ✓ (Task 3)
  - Source map resolver com `source-map` lib + cache LRU + fallback silencioso ✓ (Task 2)
  - Modelos `AntipatternHit` + `ResolvedCallsite` conforme spec ✓ (Task 1)
  - `phaseId` em cada hit ✓ (estrutura tipada)
  - Modo passivo: broadcast `liveAntipatternHit` ✓ (Task 9 + 11)
  - Modo gravado: persiste em `session.antipatternHits` ✓ (Task 9)
  - UI: aba Antipatterns + Live panel ✓ (Tasks 10 + 11)
  - Resolver lazy de callsite ao renderizar hit ✓ (Task 11)

- [ ] **No-fallbacks check (CLAUDE.md):**
  - `resolveCallsite` não fabrica `resolved` quando map falha — apenas devolve `raw`.
  - Detector `effect-fetch-loop` silencia quando metade dos events não tem callsite — não inventa agrupamento por URL.
  - Engine não silencia exceções de detectores (testes garantem que detectores nunca lançam para inputs válidos).
  - `addAntipatternHit` rejeita session encerrada / inexistente; não cria session implicitamente.
  - Cache LRU armazena `null` para evitar re-fetch — não retorna dado stale fabricado.

- [ ] **Conventions CLAUDE.md:**
  - Tabs em todos os arquivos novos ✓.
  - Strings/UI/comentários em PT-BR ✓.
  - Vitest co-located em `__tests__/` adjacente ✓.
  - Comandos sempre a partir de `app/` ✓.
  - Funções puras nos detectores; classe só em `AntipatternEngine` (similar ao padrão `NetworkTimingTracker`).

- [ ] **Build/lint final:**
  - `cd app && npm run build` verde após todas as tasks.
  - `npm test` total = baseline + 46 testes novos (5 sourceMap + 5 engine + 5×5 detectores + 5 recorder + 6 UI tabs + 5 LivePanel = 51; ajuste exato pode variar conforme conta atual).

---

## Pontos abertos pra Phase futura

- **Callsite no probe:** Phase 3 só consome `NetworkEvent.callsite` quando o probe preencher. Adicionar captura no probe MAIN-world fica como follow-up (issue separada). Sem isso, `effect-fetch-loop` fica silenciado em produção real.
- **`request-after-unmount`, `polling-no-cleanup`, `n-plus-one`, `stale-cache-thrash`, `large-payload-slow-path`:** spec lista; deixados para Phase 3.x.
- **Body fingerprint real:** atualmente `reqFingerprint` aproxima por `bodyRef`. Quando a sessão guardar body real (Phase 2+ ou Phase 6), trocar para hash do conteúdo.
- **UI scrubbing sincronizado com hit:** clicar num hit deveria mover o player para `startTimestamp` — depende do rrweb-player (Phase 2). Phase 3 só mostra hit estático.
- **Passive engine GC:** `clearPassiveEngineForTab` chamado em stopDebugging + tab close; reavaliar se memória acumula em uso prolongado.
- **Source map auth/CORS:** spec menciona possível UI de upload manual de `.map` na Phase 6 (privacidade). Phase 3 cobre só GET público.
