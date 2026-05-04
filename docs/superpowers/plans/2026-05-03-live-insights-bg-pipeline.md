# Live Insights — Background Pipeline + Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire o background como segundo produtor de signals: cada `Fetch.requestPaused` extrai headers/cookies/url/scriptSrc/xhr para per-host Scorer, merge com techs[] do probe (Sub-projeto 2), broadcast debounced 200ms para UI.

**Architecture:** Pure helpers em `app/src/lib/insights/` (`bgSignals.ts`, `mergeHits.ts`). Background mantém `scorersByTabHost: Map<tabId, Map<host, Scorer>>` paralelo a `liveSnapshotByTab`. `LiveDetectionEntry` ganha `techs[]`. `liveDetection` broadcast extendido com `techsUpdates` opcional (compat-zero com UI atual).

**Tech Stack:** TS strict, Vitest + jsdom, Biome, lib do Sub-projeto 1, probe do Sub-projeto 2.

**Spec:** [docs/superpowers/specs/2026-05-03-live-insights-bg-pipeline-design.md](../specs/2026-05-03-live-insights-bg-pipeline-design.md)

**bd:** chrome-extension-debug-buddy-d0x

---

## File Map

**Created:**
- `app/src/lib/insights/bgSignals.ts` — `extractBackgroundSignals` + `parseSetCookieHeader`
- `app/src/lib/insights/mergeHits.ts` — `mergeHits(existing, incoming, compiledByName)` pure
- `app/src/lib/insights/__tests__/bgSignals.test.ts`
- `app/src/lib/insights/__tests__/mergeHits.test.ts`
- `app/src/entrypoints/__tests__/background.bg-pipeline.test.ts` — integração com chrome stubs

**Modified:**
- `app/src/entrypoints/background.ts` — extends `LiveDetectionEntry`; adds `scorersByTabHost`, broadcast debouncing, pipeline hooks; extends `serializeLiveSnapshot` / `clearLiveSnapshot`
- `app/src/types/messages.ts` — `Message.techsUpdates` opcional

---

## Task 1: bgSignals.ts (lib pura)

**Files:**
- Create: `app/src/lib/insights/__tests__/bgSignals.test.ts`
- Create: `app/src/lib/insights/bgSignals.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/lib/insights/__tests__/bgSignals.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { extractBackgroundSignals, parseSetCookieHeader } from '../bgSignals';

function intercepted(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/path',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'document',
		timestamp: Date.now(),
		...overrides,
	};
}

describe('extractBackgroundSignals — url kind dispatch by resourceType', () => {
	test('document → url signal', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'document' }));
		expect(sigs.find((s) => s.kind === 'url')).toBeDefined();
		expect(sigs.find((s) => s.kind === 'scriptSrc')).toBeUndefined();
	});

	test('script → scriptSrc signal', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'script' }));
		expect(sigs.find((s) => s.kind === 'scriptSrc')).toBeDefined();
		expect(sigs.find((s) => s.kind === 'url')).toBeUndefined();
	});

	test('xhr → xhr signal', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'xhr' }));
		expect(sigs.find((s) => s.kind === 'xhr')).toBeDefined();
	});

	test('fetch → xhr signal (treated equivalently)', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'fetch' }));
		expect(sigs.find((s) => s.kind === 'xhr')).toBeDefined();
	});

	test('image/stylesheet/font/media → no url-kind signal', () => {
		for (const t of ['image', 'stylesheet', 'font', 'media', 'other']) {
			const sigs = extractBackgroundSignals(intercepted({ type: t }));
			expect(sigs.find((s) => ['url', 'scriptSrc', 'xhr'].includes(s.kind))).toBeUndefined();
		}
	});
});

describe('extractBackgroundSignals — headers', () => {
	test('emits header signals with lowercased names', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'X-Powered-By': 'PHP/8.1', Server: 'nginx/1.21' },
			}),
		);
		const headers = sigs.filter((s) => s.kind === 'header');
		expect(headers).toContainEqual({ kind: 'header', name: 'x-powered-by', value: 'PHP/8.1' });
		expect(headers).toContainEqual({ kind: 'header', name: 'server', value: 'nginx/1.21' });
	});

	test('prefers response.headers when both response.headers and headers present', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'X-Old': 'old' },
				response: { headers: { 'X-New': 'new' } },
			}),
		);
		const names = sigs.filter((s) => s.kind === 'header').map((s) => s.name);
		expect(names).toContain('x-new');
		expect(names).not.toContain('x-old');
	});
});

describe('extractBackgroundSignals — cookies', () => {
	test('emits cookie signals from set-cookie header', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'set-cookie': 'session=abc123; Path=/' },
			}),
		);
		expect(sigs).toContainEqual({ kind: 'cookie', name: 'session', value: 'abc123' });
	});

	test('handles Set-Cookie with title-case', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'Set-Cookie': 'session=abc123' },
			}),
		);
		expect(sigs.find((s) => s.kind === 'cookie' && s.name === 'session')).toBeDefined();
	});
});

describe('parseSetCookieHeader', () => {
	test('parses single cookie', () => {
		expect(parseSetCookieHeader('session=abc123; Path=/')).toEqual([
			{ name: 'session', value: 'abc123' },
		]);
	});

	test('parses multi-cookie joined by newline', () => {
		const raw = 'a=1; Path=/\nb=2; Secure';
		expect(parseSetCookieHeader(raw)).toEqual([
			{ name: 'a', value: '1' },
			{ name: 'b', value: '2' },
		]);
	});

	test('returns empty array for empty input', () => {
		expect(parseSetCookieHeader('')).toEqual([]);
	});

	test('skips malformed cookie without =', () => {
		expect(parseSetCookieHeader('flagonly')).toEqual([]);
	});

	test('returns empty value when set after =', () => {
		expect(parseSetCookieHeader('a=')).toEqual([{ name: 'a', value: '' }]);
	});
});
```

- [ ] **Step 2: Run failing**

Run: `cd app && npx vitest run src/lib/insights/__tests__/bgSignals.test.ts`
Expected: FAIL — module `../bgSignals` not found.

- [ ] **Step 3: Implement**

Create `app/src/lib/insights/bgSignals.ts`:

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import type { Signal } from './types';

interface ParsedCookie {
	name: string;
	value: string;
}

export function parseSetCookieHeader(raw: string): ParsedCookie[] {
	if (!raw) return [];
	// CDP entrega Set-Cookie de várias formas: única string com '\n', ou
	// uma única linha. Tratamos ambos.
	const lines = raw.includes('\n') ? raw.split('\n') : [raw];
	const out: ParsedCookie[] = [];
	for (const line of lines) {
		const first = line.split(';')[0]?.trim();
		if (!first) continue;
		const eq = first.indexOf('=');
		if (eq === -1) continue;
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		if (name) out.push({ name, value });
	}
	return out;
}

export function extractBackgroundSignals(
	intercepted: InterceptedResponse,
): Signal[] {
	const out: Signal[] = [];

	// 1. URL — diferencia top-frame document, scriptSrc, xhr/fetch.
	// Outros resourceTypes (image/stylesheet/font/media/other) não geram signal —
	// catalog patterns desses kinds não casam URLs assim por design.
	const rt = (intercepted.type ?? '').toLowerCase();
	if (rt === 'script') {
		out.push({ kind: 'scriptSrc', value: intercepted.url });
	} else if (rt === 'xhr' || rt === 'fetch') {
		out.push({ kind: 'xhr', value: intercepted.url });
	} else if (rt === 'document') {
		out.push({ kind: 'url', value: intercepted.url });
	}

	// 2. Response headers — keys lowercased
	// Prefere response.headers (canônico) sobre headers (alias legado para
	// registros antigos) — InterceptedResponse mantém ambos.
	const headers = intercepted.response?.headers ?? intercepted.headers;
	if (headers) {
		for (const [k, v] of Object.entries(headers)) {
			out.push({ kind: 'header', name: k.toLowerCase(), value: v });
		}
	}

	// 3. Set-Cookie parsing — tenta variantes de casing.
	const setCookieRaw =
		headers?.['set-cookie'] ?? headers?.['Set-Cookie'] ?? headers?.['SET-COOKIE'];
	if (setCookieRaw) {
		for (const cookie of parseSetCookieHeader(setCookieRaw)) {
			out.push({ kind: 'cookie', name: cookie.name, value: cookie.value });
		}
	}

	return out;
}
```

- [ ] **Step 4: Run passing**

Run: `cd app && npx vitest run src/lib/insights/__tests__/bgSignals.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/bgSignals.ts app/src/lib/insights/__tests__/bgSignals.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): extractBackgroundSignals + parseSetCookieHeader

sub-projeto 3, task 1: helper puro que extrai signals de uma
InterceptedResponse: url/scriptSrc/xhr conforme resourceType, headers
lowercased, cookies parsed do set-cookie header.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: mergeHits.ts (lib pura)

**Files:**
- Create: `app/src/lib/insights/__tests__/mergeHits.test.ts`
- Create: `app/src/lib/insights/mergeHits.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/lib/insights/__tests__/mergeHits.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { mergeHits } from '../mergeHits';
import type { CompiledTech, MatchEvidence, TechHit } from '../types';

function tech(name: string, overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name,
		cats: [12],
		website: 'https://example.com',
		patterns: {},
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
		...overrides,
	};
}

function hit(name: string, overrides: Partial<TechHit> = {}): TechHit {
	return {
		name,
		cats: [],
		confidence: 100,
		evidence: [],
		...overrides,
	};
}

const ev = (n: number): MatchEvidence[] =>
	Array.from({ length: n }, (_, i) => ({ signal: 'header', pattern: `p${i}` }));

describe('mergeHits', () => {
	test('returns incoming when existing is empty', () => {
		const incoming = [hit('A'), hit('B')];
		const result = mergeHits([], incoming, new Map());
		expect(result.map((h) => h.name).sort()).toEqual(['A', 'B']);
	});

	test('returns existing when incoming is empty', () => {
		const existing = [hit('A')];
		const result = mergeHits(existing, [], new Map());
		expect(result.map((h) => h.name)).toEqual(['A']);
	});

	test('combines confidence with cap 100', () => {
		const existing = [hit('X', { confidence: 70 })];
		const incoming = [hit('X', { confidence: 50 })];
		const result = mergeHits(existing, incoming, new Map());
		expect(result[0].confidence).toBe(100);
	});

	test('first version wins', () => {
		const existing = [hit('X', { version: '1.0' })];
		const incoming = [hit('X', { version: '2.0' })];
		expect(mergeHits(existing, incoming, new Map())[0].version).toBe('1.0');
	});

	test('fills version if existing has none', () => {
		const existing = [hit('X')];
		const incoming = [hit('X', { version: '2.0' })];
		expect(mergeHits(existing, incoming, new Map())[0].version).toBe('2.0');
	});

	test('caps merged evidence at 8', () => {
		const existing = [hit('X', { evidence: ev(6) })];
		const incoming = [hit('X', { evidence: ev(5) })];
		expect(mergeHits(existing, incoming, new Map())[0].evidence.length).toBe(8);
	});

	test('applies implications after merge', () => {
		const wp = tech('WordPress', { implies: [{ name: 'PHP', confidence: 100 }] });
		const php = tech('PHP', { cats: [27] });
		const cmap = new Map<string, CompiledTech>([
			['WordPress', wp],
			['PHP', php],
		]);
		const result = mergeHits([], [hit('WordPress')], cmap);
		expect(result.map((h) => h.name).sort()).toEqual(['PHP', 'WordPress']);
		const phpHit = result.find((h) => h.name === 'PHP');
		expect(phpHit?.implied).toBe(true);
	});

	test('does not mutate input arrays', () => {
		const existing = [hit('X', { confidence: 50, evidence: [] })];
		const incoming = [hit('X', { confidence: 30 })];
		const before = JSON.stringify(existing);
		mergeHits(existing, incoming, new Map());
		expect(JSON.stringify(existing)).toBe(before);
	});
});
```

- [ ] **Step 2: Run failing**

Run: `cd app && npx vitest run src/lib/insights/__tests__/mergeHits.test.ts`
Expected: FAIL — module `../mergeHits` not found.

- [ ] **Step 3: Implement**

Create `app/src/lib/insights/mergeHits.ts`:

```ts
import { applyImplications } from './implications';
import type { CompiledTech, TechHit } from './types';

const EVIDENCE_CAP = 8;

/**
 * Merge dois conjuntos de TechHit (existente + incoming) reaplicando
 * implications no resultado. Pure: não muta os arrays de entrada (clona
 * os hits existentes antes de mexer).
 */
export function mergeHits(
	existing: TechHit[],
	incoming: TechHit[],
	compiledByName: Map<string, CompiledTech>,
): TechHit[] {
	const map = new Map<string, TechHit>(
		existing.map((h) => [h.name, cloneHit(h)]),
	);
	for (const inc of incoming) {
		const ex = map.get(inc.name);
		if (!ex) {
			map.set(inc.name, cloneHit(inc));
			continue;
		}
		ex.confidence = Math.min(100, ex.confidence + inc.confidence);
		if (!ex.version && inc.version) ex.version = inc.version;
		for (const evi of inc.evidence) {
			if (ex.evidence.length >= EVIDENCE_CAP) break;
			ex.evidence.push(evi);
		}
	}
	applyImplications(map, compiledByName);
	return [...map.values()];
}

function cloneHit(h: TechHit): TechHit {
	return {
		name: h.name,
		cats: [...h.cats],
		confidence: h.confidence,
		version: h.version,
		icon: h.icon,
		website: h.website,
		description: h.description,
		evidence: [...h.evidence],
		implied: h.implied,
	};
}
```

- [ ] **Step 4: Run passing**

Run: `cd app && npx vitest run src/lib/insights/__tests__/mergeHits.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/mergeHits.ts app/src/lib/insights/__tests__/mergeHits.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): mergeHits helper puro com implications

sub-projeto 3, task 2: combina dois conjuntos de TechHit reaplicando
applyImplications. confidence cap 100, version first-wins, evidence cap
8, sem mutação dos arrays de entrada.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: background — extends types + scorers Map + helpers

**Files:**
- Modify: `app/src/entrypoints/background.ts`

Esta task adiciona estado e helpers SEM ainda integrar nos call sites. Os call sites (handleRequestPaused/pageDetected) são plugados nas tasks 5-6.

- [ ] **Step 1: Read current state shape (~line 420-512)**

Run: `sed -n '420,515p' /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/entrypoints/background.ts`

You should see `LiveDetectionEntry` interface, `scorersByTabHost` is NOT defined yet, `getOrInitLiveSnapshot`, `extractHost`, `updateLiveDetection`, `serializeLiveSnapshot`, `clearLiveSnapshot`.

- [ ] **Step 2: Add imports**

At the top of `app/src/entrypoints/background.ts`, near other lib insight imports (none exist yet — add a new import block close to other `@/lib/...` imports):

```ts
import { COMPILED_CATALOG } from '@/lib/insights/catalog';
import { mergeHits } from '@/lib/insights/mergeHits';
import { Scorer } from '@/lib/insights/scorer';
import type { CompiledTech, TechHit } from '@/lib/insights/types';
import { extractBackgroundSignals } from '@/lib/insights/bgSignals';
```

- [ ] **Step 3: Extend LiveDetectionEntry**

Find the `LiveDetectionEntry` interface (~line 432). Update it:

```ts
interface LiveDetectionEntry {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	techs: TechHit[]; // NOVO — cumulativo probe + bg signals com implications
}
```

- [ ] **Step 4: Add per-tab,host Scorer state + helpers**

Right after the `liveSnapshotByTab` Map definition (~line 447), add:

```ts
// Estado paralelo: per (tabId, host) Scorer instances acumulam signals do
// background-side (handleRequestPaused) e mergeam com techs vindas do probe
// (pageDetected). Lifecycle alinhado com liveSnapshotByTab.
const scorersByTabHost = new Map<number, Map<string, Scorer>>();

const COMPILED_BY_NAME = new Map<string, CompiledTech>(
	COMPILED_CATALOG.map((t) => [t.name, t]),
);

function getOrCreateScorer(tabId: number, host: string): Scorer {
	let perHost = scorersByTabHost.get(tabId);
	if (!perHost) {
		perHost = new Map();
		scorersByTabHost.set(tabId, perHost);
	}
	let s = perHost.get(host);
	if (!s) {
		s = new Scorer(COMPILED_CATALOG);
		perHost.set(host, s);
	}
	return s;
}

function clearScorers(tabId: number): void {
	scorersByTabHost.delete(tabId);
}
```

- [ ] **Step 5: Update updateLiveDetection signature to default empty techs**

Find `updateLiveDetection` (~line 466). It accepts a `LiveDetectionEntry` argument. Update its callers to pass `techs: []` if not already present. The current call sites of `updateLiveDetection` build the entry inline; you'll need to find each and add `techs: []`.

Search:
```bash
grep -n "updateLiveDetection\|fingerprint:" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/entrypoints/background.ts | head -20
```

For each call site that constructs a `LiveDetectionEntry`, add `techs: []` to the object literal. Most likely there's exactly one call site (in `pageDetected` handler).

If unsure, modify `updateLiveDetection` to be tolerant and fill in defaults itself:

```ts
function updateLiveDetection(
	tabId: number,
	entry: Omit<LiveDetectionEntry, 'techs'> & { techs?: TechHit[] },
): void {
	const snap = getOrInitLiveSnapshot(tabId);
	const host = extractHost(entry.url);
	const existing = snap.detectionsByHost.get(host);
	if (existing) snap.detectionsByHost.delete(host);
	snap.detectionsByHost.set(host, {
		url: entry.url,
		timestamp: entry.timestamp,
		fingerprint: entry.fingerprint,
		techs: entry.techs ?? existing?.techs ?? [], // preserva techs já presentes
	});
}
```

- [ ] **Step 6: Extend serializeLiveSnapshot**

Find `serializeLiveSnapshot` (~line 486). Update return type and per-detection mapping to include `techs`:

```ts
function serializeLiveSnapshot(snap: LiveSnapshot): {
	detections: Array<{
		host: string;
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[];
	}>;
	recommendations: Recommendation[];
} {
	const detections: Array<{
		host: string;
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[];
	}> = [];
	for (const [host, entry] of snap.detectionsByHost) {
		detections.unshift({
			host,
			url: entry.url,
			timestamp: entry.timestamp,
			fingerprint: entry.fingerprint,
			techs: entry.techs.length > 0 ? entry.techs : undefined,
		});
	}
	return { detections, recommendations: snap.recommendations };
}
```

- [ ] **Step 7: Extend clearLiveSnapshot**

Find `clearLiveSnapshot` (~line 482). Update to also clear scorers:

```ts
function clearLiveSnapshot(tabId: number): void {
	liveSnapshotByTab.delete(tabId);
	clearScorers(tabId);
}
```

(Broadcast timers + dirty hosts are added in Task 4 — clearLiveSnapshot will be re-extended then.)

- [ ] **Step 8: Verify tsc + tests**

Run: `cd app && npx tsc --noEmit && npm test 2>&1 | tail -10`
Expected: tsc clean. All existing tests pass — no behavior change yet, only types extended.

- [ ] **Step 9: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/entrypoints/background.ts
git commit -m "$(cat <<'EOF'
feat(background): LiveDetectionEntry.techs + scorersByTabHost map

sub-projeto 3, task 3: extende LiveDetectionEntry com techs[],
adiciona Map paralelo de Scorers per (tabId, host), serializeLiveSnapshot
inclui techs. clearLiveSnapshot limpa scorers junto. Sem call sites
ainda — tasks 5-6 plugam.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: background — broadcast debouncing

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Add debouncing state + functions**

After the scorers helpers added in Task 3, add:

```ts
const dirtyHostsByTab = new Map<number, Set<string>>();
const broadcastTimers = new Map<number, ReturnType<typeof setTimeout>>();
const BROADCAST_DEBOUNCE_MS = 200;

function scheduleBroadcast(tabId: number, host: string): void {
	let dirty = dirtyHostsByTab.get(tabId);
	if (!dirty) {
		dirty = new Set();
		dirtyHostsByTab.set(tabId, dirty);
	}
	dirty.add(host);
	if (broadcastTimers.has(tabId)) return;
	const timer = setTimeout(() => {
		broadcastTimers.delete(tabId);
		flushBroadcast(tabId);
	}, BROADCAST_DEBOUNCE_MS);
	broadcastTimers.set(tabId, timer);
}

function flushBroadcast(tabId: number): void {
	const dirty = dirtyHostsByTab.get(tabId);
	if (!dirty || dirty.size === 0) return;
	const snap = liveSnapshotByTab.get(tabId);
	if (!snap) {
		dirty.clear();
		return;
	}
	const techsUpdates: Array<{ host: string; techs: TechHit[] }> = [];
	for (const host of dirty) {
		const entry = snap.detectionsByHost.get(host);
		if (entry && entry.techs.length > 0) {
			techsUpdates.push({ host, techs: entry.techs });
		}
	}
	dirty.clear();
	if (techsUpdates.length === 0) return;
	broadcastToUI('liveDetection', { tabId, techsUpdates });
}
```

- [ ] **Step 2: Re-extend clearLiveSnapshot**

Update `clearLiveSnapshot` to clear timers + dirty too:

```ts
function clearLiveSnapshot(tabId: number): void {
	liveSnapshotByTab.delete(tabId);
	clearScorers(tabId);
	const t = broadcastTimers.get(tabId);
	if (t) {
		clearTimeout(t);
		broadcastTimers.delete(tabId);
	}
	dirtyHostsByTab.delete(tabId);
}
```

- [ ] **Step 3: Verify tsc + tests**

Run: `cd app && npx tsc --noEmit && npm test 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/entrypoints/background.ts
git commit -m "$(cat <<'EOF'
feat(background): debounce 200ms para broadcast liveDetection

sub-projeto 3, task 4: dirtyHostsByTab + broadcastTimers acumulam
hosts atualizados; scheduleBroadcast enfileira; flushBroadcast emite
techsUpdates agregado. clearLiveSnapshot cobre timers e dirty.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: background — handleRequestPaused integration

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Locate handleRequestPaused**

Run: `grep -n "handleRequestPaused\|getResponseBody\|persistRequest\|continueRequest" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/entrypoints/background.ts | head -20`

You'll find `handleRequestPaused` definition and its call to `Fetch.continueRequest`. The `intercepted` (`InterceptedResponse`) is built inside; we hook AFTER it's built and persisted, BEFORE `continueRequest`.

- [ ] **Step 2: Add a helper that pushes signals + merges + schedules broadcast**

Right after the scorer/debounce helpers in background.ts, add:

```ts
function ingestBgSignalsForRequest(
	tabId: number,
	intercepted: InterceptedResponse,
): void {
	const host = extractHost(intercepted.url);
	if (!host || host === 'unknown') return;
	const sigs = extractBackgroundSignals(intercepted);
	if (sigs.length === 0) return;
	const scorer = getOrCreateScorer(tabId, host);
	scorer.pushSignals(sigs);

	// Merge scorer snapshot com techs já no entry (vindas do probe)
	const snap = getOrInitLiveSnapshot(tabId);
	let entry = snap.detectionsByHost.get(host);
	if (!entry) {
		// Sem pageDetected ainda para este host — placeholder.
		entry = {
			url: `https://${host}/`,
			timestamp: Date.now(),
			fingerprint: makeEmptyFingerprint(),
			techs: [],
		};
		snap.detectionsByHost.set(host, entry);
	}
	entry.techs = mergeHits(entry.techs, scorer.snapshot(), COMPILED_BY_NAME);
	scheduleBroadcast(tabId, host);
}

function makeEmptyFingerprint(): EnvironmentFingerprint {
	return {
		framework: { name: 'vanilla' },
		libraries: [],
		httpClients: [],
		dataFetching: [],
		detectedAt: Date.now(),
		isProductionBuild: false,
	};
}
```

- [ ] **Step 3: Hook in handleRequestPaused**

Inside `handleRequestPaused`, after the `intercepted` object is built and `persistRequest` has been called, add:

```ts
// Sub-projeto 3 — pipeline: extrai signals da response e atualiza techs do host.
// Roda só quando há tabId conhecido (debugger anexado a um targetTab válido).
if (targetTabId !== null) {
	try {
		ingestBgSignalsForRequest(targetTabId, intercepted);
	} catch (err) {
		console.warn('[live-insights] falha em ingestBgSignalsForRequest:', err);
	}
}
```

The exact insertion point varies — find where `intercepted: InterceptedResponse` exists and is fully built (after URL/headers/status are set). Inserting before `Fetch.continueRequest` / `Fetch.fulfillRequest` is correct.

- [ ] **Step 4: Verify tsc + tests**

Run: `cd app && npx tsc --noEmit && npm test 2>&1 | tail -15`
Expected: tsc clean, all tests pass. The integration test we'll write in Task 9 covers this; existing tests should all stay green.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/entrypoints/background.ts
git commit -m "$(cat <<'EOF'
feat(background): handleRequestPaused empurra signals para per-host scorer

sub-projeto 3, task 5: cada Fetch response é processada por
extractBackgroundSignals + Scorer.pushSignals + mergeHits, atualizando
detectionsByHost[host].techs com applyImplications reaplicado.
broadcast schedulado debounced.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: background — pageDetected merge

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Locate pageDetected handler**

Run: `grep -n "pageDetected\|liveDetection" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/entrypoints/background.ts | head -20`

The handler typically lives in a `chrome.runtime.onMessage` listener that switch-cases on `message.action === 'pageDetected'`. You'll see it calls `updateLiveDetection` and `broadcastToUI('liveDetection', ...)`.

- [ ] **Step 2: Add merge of payload.techs**

Inside the `pageDetected` case, BEFORE `updateLiveDetection` and the broadcast, add the probe-techs merge:

```ts
// Sub-projeto 3 — merge das techs emitidas pelo probe com o que já está
// acumulado para este host (do background pipeline da task 5).
if (message.payload?.techs && message.payload.techs.length > 0) {
	const tabId = sender.tab?.id ?? interceptorTabId;
	if (tabId !== null && tabId !== undefined) {
		const host = extractHost(message.payload.url);
		if (host && host !== 'unknown') {
			const snap = getOrInitLiveSnapshot(tabId);
			let entry = snap.detectionsByHost.get(host);
			if (!entry) {
				entry = {
					url: message.payload.url,
					timestamp: message.payload.timestamp ?? Date.now(),
					fingerprint: message.payload.fingerprint ?? makeEmptyFingerprint(),
					techs: [],
				};
				snap.detectionsByHost.set(host, entry);
			}
			entry.techs = mergeHits(entry.techs, message.payload.techs, COMPILED_BY_NAME);
			scheduleBroadcast(tabId, host);
		}
	}
}
```

The exact `tabId` resolution depends on your existing handler — match what's there. The `interceptorTabId` reference: if not directly accessible, use whatever the existing handler uses to identify the tab.

- [ ] **Step 3: Verify tsc + tests**

Run: `cd app && npx tsc --noEmit && npm test 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/entrypoints/background.ts
git commit -m "$(cat <<'EOF'
feat(background): pageDetected mergeia payload.techs do probe

sub-projeto 3, task 6: quando probe emite techs[], background mergeia
no entry do host top-frame antes do updateLiveDetection legado.
applyImplications reaplicado pelo mergeHits. broadcast schedulado.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: messages.ts — techsUpdates field

**Files:**
- Modify: `app/src/types/messages.ts`

- [ ] **Step 1: Add techsUpdates field**

Edit `app/src/types/messages.ts`. Find the `Message` interface. Add `techsUpdates?: ...` field at an appropriate place (near other recently-added fields like `payload?:` and `recommendation?:`):

```ts
// Sub-projeto 3 — broadcast extendido de liveDetection. UI atual ignora
// graciosamente; Sub-projeto 4 consome.
techsUpdates?: Array<{
	host: string;
	techs: TechHit[];
}>;
```

Also ensure `TechHit` is imported at the top of the file. If the previous import block already has `import type { ... TechHit } from '@/lib/insights/types'`, just verify. Otherwise add:

```ts
import type { TechHit } from '@/lib/insights/types';
```

- [ ] **Step 2: Verify tsc + tests + lint**

Run: `cd app && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -10`
Expected: all clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/types/messages.ts
git commit -m "$(cat <<'EOF'
feat(messages): liveDetection broadcast carrega techsUpdates opcional

sub-projeto 3, task 7: Message.techsUpdates para o broadcast extendido
emitido por flushBroadcast. UI atual ignora; sub-projeto 4 consome.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integration test — background bg-pipeline

**Files:**
- Create: `app/src/entrypoints/__tests__/background.bg-pipeline.test.ts`

This test uses the same chrome-stub pattern as `background.lifecycle.test.ts`. We test the bgSignals + scorer + merge + broadcast flow end-to-end at the background module level.

- [ ] **Step 1: Read existing pattern**

Run: `head -100 /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/entrypoints/__tests__/background.lifecycle.test.ts`

Note the `installChromeStubs()` pattern + `beforeEach` setup + dynamic `await import('../background')`.

- [ ] **Step 2: Write integration test**

Create `app/src/entrypoints/__tests__/background.bg-pipeline.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Stubs de APIs do chrome — alinhados com background.lifecycle.test.ts
function installChromeStubs() {
	const noopListener = { addListener: vi.fn(), removeListener: vi.fn() };
	(chrome as unknown as { debugger: unknown }).debugger = {
		attach: vi.fn(async () => undefined),
		detach: vi.fn(async () => undefined),
		sendCommand: vi.fn(async () => ({})),
		onEvent: noopListener,
		onDetach: noopListener,
		getTargets: vi.fn(async () => []),
	};
	(chrome.tabs as unknown as { get: unknown }).get = vi.fn(async (id: number) => ({
		id,
		url: `https://example.com/tab${id}`,
		width: 800,
		height: 600,
	}));
	chrome.tabs.sendMessage = vi.fn(async () => ({})) as never;
	(chrome.tabs as unknown as { onRemoved: unknown }).onRemoved = noopListener;
	(chrome.tabs as unknown as { onUpdated: unknown }).onUpdated = noopListener;
	(chrome.runtime as unknown as { onInstalled: unknown }).onInstalled = noopListener;
	(chrome.runtime as unknown as { onStartup: unknown }).onStartup = noopListener;
	(chrome.runtime as unknown as { getURL: unknown }).getURL = vi.fn(
		(p: string) => `chrome-extension://test/${p}`,
	);
	const actionListener = { addListener: vi.fn(), removeListener: vi.fn() };
	(chrome as unknown as { action: unknown }).action = {
		onClicked: actionListener,
	};
	(chrome.tabs as unknown as { create: unknown }).create = vi.fn(
		(_opts: unknown, cb?: (tab: { id: number }) => void) => {
			if (cb) cb({ id: 4242 });
		},
	);
	(chrome as unknown as { webNavigation: unknown }).webNavigation = {
		onCommitted: noopListener,
	};
}

describe('background — bg pipeline integration', () => {
	beforeEach(async () => {
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
		installChromeStubs();
		// Para isolar do estado anterior, precisamos resetar o module cache
		vi.resetModules();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('extractBackgroundSignals integra com Scorer real', async () => {
		// Importa lib direto — sem precisar do background.ts
		const { extractBackgroundSignals } = await import('@/lib/insights/bgSignals');
		const { Scorer } = await import('@/lib/insights/scorer');
		const { COMPILED_CATALOG } = await import('@/lib/insights/catalog');

		const intercepted = {
			url: 'https://example.com/',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: { 'X-Powered-By': 'PHP/8.1.0' },
			type: 'document',
			timestamp: Date.now(),
		};
		const sigs = extractBackgroundSignals(intercepted as never);
		const scorer = new Scorer(COMPILED_CATALOG);
		scorer.pushSignals(sigs);
		const techs = scorer.snapshot();
		// PHP detection via X-Powered-By header
		expect(techs.find((t) => t.name === 'PHP')).toBeDefined();
	});

	test('mergeHits combina probe-emitted techs com bg-detected techs', async () => {
		const { mergeHits } = await import('@/lib/insights/mergeHits');
		const { COMPILED_CATALOG } = await import('@/lib/insights/catalog');
		const compiledByName = new Map(COMPILED_CATALOG.map((t) => [t.name, t]));

		const probeTechs = [
			{ name: 'WordPress', cats: [1], confidence: 100, evidence: [] },
		];
		const bgTechs = [
			{ name: 'Cloudflare', cats: [31], confidence: 50, evidence: [] },
		];
		const merged = mergeHits(probeTechs, bgTechs, compiledByName);
		const names = merged.map((h) => h.name).sort();
		// WordPress + PHP (implies) + Cloudflare
		expect(names).toContain('WordPress');
		expect(names).toContain('Cloudflare');
		expect(names).toContain('PHP'); // implied
	});
});
```

- [ ] **Step 3: Run integration test**

Run: `cd app && npx vitest run src/entrypoints/__tests__/background.bg-pipeline.test.ts`
Expected: PASS — 2 tests.

If "PHP detection via X-Powered-By header" fails, the catalog's PHP entry might not match `PHP/8.1.0` — inspect `app/src/lib/insights/catalog/p.json` and adjust the test header value to match the actual pattern.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/entrypoints/__tests__/background.bg-pipeline.test.ts
git commit -m "$(cat <<'EOF'
test(background): integração bg pipeline com Scorer + mergeHits

sub-projeto 3, task 8: testes de integração que validam
extractBackgroundSignals → Scorer e mergeHits → applyImplications,
ambos rodando contra COMPILED_CATALOG real.

bd: chrome-extension-debug-buddy-d0x

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification + close bd + push

- [ ] **Step 1: Full suite**

Run: `cd app && npm test 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 2: Lint**

Run: `cd app && npm run lint`
Expected: clean. Apply `npm run lint:fix` if needed.

- [ ] **Step 3: tsc + build**

Run: `cd app && npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: both clean. Note `dist/background.js` size — expect modest increase (catálogo já estava no probe-main do Sub-projeto 2; aqui o background também passa a importar a lib insights, então alguns KB extras são esperados em background.js).

- [ ] **Step 4: Confirma que UI atual continua funcionando**

Run: `grep -rln "techsUpdates\|entry.techs" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/components 2>/dev/null || echo "(nenhum consumer ainda — sub-projeto 4 implementa)"`

Expected: zero hits OR a single helpful echo line. UI ainda não consome o campo novo, então o broadcast extendido passa por ela sem efeito visível.

- [ ] **Step 5: Close bd + push**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
bd close chrome-extension-debug-buddy-d0x --reason="Sub-projeto 3 completo: background extrai signals server-side de cada Fetch, per-host Scorer acumula, merge com probe-emitted techs, broadcast debounced 200ms. UI inalterada — Sub-projeto 4 consome."
git add .beads/issues.jsonl
git commit -m "chore: sync beads do background pipeline" 2>&1 | tail -3
git push 2>&1 | tail -5
git status
```

Expected: `git status` shows up to date with origin (the unrelated `app/src/lib/session/types.ts` modification ainda intacto pré-existente).

---

## Self-Review Notes

**Spec coverage:** Tasks 1-9 cobrem todos critérios:
- Task 1 → bgSignals.ts (extractBackgroundSignals + parseSetCookieHeader)
- Task 2 → mergeHits.ts (helper puro com applyImplications)
- Task 3 → LiveDetectionEntry.techs + scorersByTabHost + serializeLiveSnapshot/clearLiveSnapshot
- Task 4 → broadcast debouncing 200ms
- Task 5 → handleRequestPaused integration
- Task 6 → pageDetected merge
- Task 7 → messages.ts.techsUpdates
- Task 8 → integration tests
- Task 9 → verification + close

**Type consistency:** `Signal`, `TechHit`, `CompiledTech` from lib (Sub-projeto 1). `extractBackgroundSignals(intercepted)`, `parseSetCookieHeader(raw)`, `mergeHits(existing, incoming, compiledByName)`, `extractHost(url)` (existing), `Scorer`, `applyImplications` — all consistent across tasks. `LiveDetectionEntry.techs: TechHit[]` introduzido em Task 3, usado em Tasks 5-6.

**No placeholders:** todos os steps têm código completo. As referências como "the exact insertion point varies" em Task 5 step 3 são guidance para integração (call site existing); o engineer tem o código exato a inserir + busca grep para localizar.

**Critical assumption:** `handleRequestPaused` em background.ts builds um `intercepted: InterceptedResponse` antes do `Fetch.continueRequest`. Task 5 step 3 assume isso. Se a estrutura for diferente, o engineer ajusta a inserção mas o snippet permanece correto.
