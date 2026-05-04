# Session Replay — Insights & Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o engine de antipatterns por um engine de recomendações estilo Lighthouse (10 regras), estender framework detection com jQuery, fazer state capture funcionar com ou sem gravação, e refatorar `LiveAntipatternsPanel` para `LiveInsightsPanel` com 3 seções (Framework / Estado / Recomendações).

**Architecture:** Engine de recomendações em background como classe pura recebendo cada response interceptado; cada regra é função pura plugável em `lib/session/recommendations/rules/`. Probe injeta state taps incondicionalmente quando ativo; broadcast `liveStateChange` alimenta UI passiva via reducer in-memory. UI usa design tokens existentes (Plus Jakarta Sans, IBM Plex Mono, severities → `--color-destructive/warning/info`).

**Tech Stack:** TypeScript strict, React 19 + react-router-dom, Vitest + jsdom, Playwright (E2E), Tailwind v4, shadcn UI, Manifest V3 chrome.debugger, IndexedDB.

**Spec source:** [docs/superpowers/specs/2026-05-03-session-replay-insights-recommendations-design.md](docs/superpowers/specs/2026-05-03-session-replay-insights-recommendations-design.md)

---

## File structure overview

### Created
```
app/src/probe/detectors/libraries.ts
app/src/probe/detectors/__tests__/libraries.test.ts
app/src/lib/session/recommendations/types.ts
app/src/lib/session/recommendations/engine.ts
app/src/lib/session/recommendations/registry.ts
app/src/lib/session/recommendations/rules/compressionMissing.ts
app/src/lib/session/recommendations/rules/cacheMissing.ts
app/src/lib/session/recommendations/rules/mixedContent.ts
app/src/lib/session/recommendations/rules/cspMissing.ts
app/src/lib/session/recommendations/rules/hstsMissing.ts
app/src/lib/session/recommendations/rules/nosniffMissing.ts
app/src/lib/session/recommendations/rules/largePayload.ts
app/src/lib/session/recommendations/rules/imageNotOptimized.ts
app/src/lib/session/recommendations/rules/cookieInsecure.ts
app/src/lib/session/recommendations/rules/corsOpen.ts
app/src/lib/session/recommendations/__tests__/engine.test.ts
app/src/lib/session/recommendations/__tests__/rules/<one per rule>.test.ts (10 files)
app/src/components/replay/LiveInsightsPanel.tsx          (substitui LiveAntipatternsPanel)
app/src/components/replay/RecommendationRow.tsx
app/src/components/replay/RecommendationsTab.tsx         (substitui AntipatternsTab)
app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx
app/e2e/fixtures/passive-insights/index.html
app/e2e/fixtures/passive-insights/jquery-3.7.0.min.js
app/e2e/passive-insights.spec.ts
```

### Modified
```
app/src/lib/session/types.ts                            (Recommendation+, Antipattern-)
app/src/lib/session/fingerprint.ts                      (libraries em fingerprintsEqual)
app/src/lib/session/recorder.ts                         (addRecommendation+, addAntipatternHit-, engine wiring-)
app/src/lib/session/viewerTemplate.ts                   (renderiza recommendations; remove antipatterns)
app/src/probe/protocol.ts                               (remove withStateTaps)
app/src/probe/main.ts                                   (taps sempre on; libraries no fingerprint)
app/src/probe/bridge.ts                                 (sem mudança contratual; valida)
app/src/entrypoints/background.ts                       (engine wiring; live broadcasts)
app/src/types/messages.ts                               (liveAntipatternHit-; liveRecommendation+, liveStateChange+)
app/src/pages/Layout.tsx                                (LiveInsightsPanel import)
app/src/components/replay/StateInspector.tsx            (modo dual phase|liveSnapshot)
app/src/components/replay/PhaseList.tsx                 (badges de libraries)
app/src/lib/session/__tests__/fingerprint.test.ts       (libraries casos)
app/src/lib/session/__tests__/recorder.test.ts          (addRecommendation casos)
```

### Deleted
```
app/src/lib/session/antipattern/                        (todo o diretório, incluindo __tests__)
app/src/components/replay/AntipatternHitRow.tsx
app/src/components/replay/AntipatternsTab.tsx
app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx
app/src/lib/session/__tests__/recorder.antipattern.test.ts
```

---

## Pre-flight

### Task 0: Sync beads + create epic + claim

**Files:** none (only beads metadata)

- [ ] **Step 1: Sync beads**

```bash
bd dolt pull
```

- [ ] **Step 2: Create the epic for this refactor**

```bash
bd create \
  --title="Session Replay: refactor para Insights & Recommendations" \
  --description="Substitui antipattern engine por engine de recomendações (10 regras Lighthouse-style); adiciona detector jQuery; remove gate withStateTaps; refatora UI passiva. Spec: docs/superpowers/specs/2026-05-03-session-replay-insights-recommendations-design.md" \
  --type=feature \
  --priority=1
```

Take note of the returned id (call it `<EPIC_ID>`).

- [ ] **Step 3: Claim the epic**

```bash
bd update <EPIC_ID> --claim
```

- [ ] **Step 4: Verify everything green at start**

```bash
cd app && npm run lint && npx tsc --noEmit && npm test
```

Expected: all green. If anything fails, **stop** and triage with the user — refactor on a broken branch is a recipe for regressions.

---

## Phase A — Modelo de dados

### Task A1: Adicionar tipos `Recommendation`, `LibraryDetection`

**Files:**
- Modify: `app/src/lib/session/types.ts`

- [ ] **Step 1: Adicionar os tipos novos no final do arquivo (acima de `Session`)**

Edit `app/src/lib/session/types.ts` — adicionar antes da linha que define `Session`:

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
	id: string;
	ruleId: RecommendationRuleId;
	severity: RecommendationSeverity;
	timestamp: number;
	phaseId?: string;
	requestId?: string;
	url: string;
	host: string;
	summary: string;
	evidence: Record<string, string>;
	suggestion?: string;
}

export interface LibraryDetection {
	name: 'jquery';
	version?: string;
	confidence: 'high' | 'medium' | 'low';
}
```

- [ ] **Step 2: Adicionar `recommendations?` e `libraries` ao `EnvironmentFingerprint` e `Session`**

Edit the existing `EnvironmentFingerprint` interface — add the `libraries` line after `framework`:

```typescript
export interface EnvironmentFingerprint {
	framework: { name: FrameworkName; version?: string };
	libraries: LibraryDetection[];
	httpClients: HttpClientDetection[];
	dataFetching: DataFetchingDetection[];
	stateManagers: StateManagerDetection[];
	detectedAt: number;
	isProductionBuild: boolean;
}
```

Edit the existing `Session` interface — add the `recommendations?` line after `antipatternHits?`:

```typescript
recommendations?: Recommendation[];
```

(`antipatternHits?` será removido em Phase I — manter aqui por enquanto para não quebrar o build durante a refatoração.)

- [ ] **Step 3: Atualizar todos os call sites que constroem `EnvironmentFingerprint`**

Find every literal that constructs an `EnvironmentFingerprint`. As of writing, they live in:
- `app/src/probe/main.ts` — `buildFingerprint()` 
- `app/src/lib/session/recorder.ts` — `startSession` bootstrap
- Test fixtures in `app/src/lib/session/__tests__/*.test.ts` and `app/src/components/replay/__tests__/*.test.tsx`

Run:

```bash
cd app && grep -rn "framework: { name:" src --include="*.ts" --include="*.tsx"
```

For each file matched, add `libraries: []` to the literal. Example for `recorder.ts:259`:

```typescript
fingerprint: {
	framework: { name: 'vanilla' },
	libraries: [],
	httpClients: [],
	dataFetching: [],
	stateManagers: [],
	detectedAt: startedAt,
	isProductionBuild: false,
},
```

- [ ] **Step 4: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: PASS. Se falhar, há literal de fingerprint não atualizado — corrigir.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/types.ts app/src/probe/main.ts app/src/lib/session/recorder.ts app/src/lib/session/__tests__ app/src/components/replay/__tests__
git commit -m "feat(session): adiciona Recommendation, LibraryDetection e libraries[] em fingerprint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: `fingerprintsEqual` compara `libraries`

**Files:**
- Modify: `app/src/lib/session/fingerprint.ts`
- Modify: `app/src/lib/session/__tests__/fingerprint.test.ts`

- [ ] **Step 1: Write failing test — libraries diferentes abrem fase nova**

Append to `app/src/lib/session/__tests__/fingerprint.test.ts`:

```typescript
test('libraries diferentes resultam em fingerprints distintos', () => {
	const a: EnvironmentFingerprint = {
		framework: { name: 'react', version: '18.2.0' },
		libraries: [],
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	};
	const b: EnvironmentFingerprint = {
		...a,
		libraries: [{ name: 'jquery', version: '3.7.0', confidence: 'high' }],
	};
	expect(fingerprintsEqual(a, b)).toBe(false);
});

test('libraries iguais (ordem irrelevante) resultam em fingerprints iguais', () => {
	const lib1 = { name: 'jquery' as const, version: '3.7.0', confidence: 'high' as const };
	const a: EnvironmentFingerprint = {
		framework: { name: 'react' },
		libraries: [lib1],
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	};
	const b: EnvironmentFingerprint = {
		...a,
		libraries: [{ ...lib1 }],
		detectedAt: 999,
	};
	expect(fingerprintsEqual(a, b)).toBe(true);
});
```

If `EnvironmentFingerprint` is not already imported, add `import type { EnvironmentFingerprint } from '../types';` at the top.

- [ ] **Step 2: Run test to verify failure**

```bash
cd app && npx vitest run src/lib/session/__tests__/fingerprint.test.ts
```

Expected: FAIL on the new tests (the existing comparator does not consider `libraries`).

- [ ] **Step 3: Implement — add `libraries` to `fingerprintsEqual`**

Edit `app/src/lib/session/fingerprint.ts`. Inside the function, add another `sameSet` call alongside the existing ones:

```typescript
sameSet(a.libraries, b.libraries, (l) => `${l.name}:${l.version ?? ''}:${l.confidence}`) &&
```

If `sameSet` is not already in the file, copy the helper from the existing implementation (search the file for `function sameSet`).

- [ ] **Step 4: Run test to verify passes**

```bash
cd app && npx vitest run src/lib/session/__tests__/fingerprint.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/fingerprint.ts app/src/lib/session/__tests__/fingerprint.test.ts
git commit -m "feat(session): fingerprintsEqual compara libraries

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: `recorder.addRecommendation`

**Files:**
- Modify: `app/src/lib/session/recorder.ts`
- Modify: `app/src/lib/session/__tests__/recorder.test.ts`

- [ ] **Step 1: Write failing test**

Append to `app/src/lib/session/__tests__/recorder.test.ts` (model after the existing addAntipatternHit test if helpful):

```typescript
import type { Recommendation } from '../types';

test('addRecommendation persiste em session.recommendations', async () => {
	const id = await recorder.startSession({
		tabId: 1,
		initialUrl: 'https://example.com',
		userAgent: 'test-ua',
		viewportSize: { w: 1024, h: 768 },
		canvasCaptureEnabled: false,
	});

	const rec: Recommendation = {
		id: 'rec-1',
		ruleId: 'compression-missing',
		severity: 'warn',
		timestamp: 100,
		url: 'https://example.com/api',
		host: 'example.com',
		summary: 'sem gzip',
		evidence: { 'content-encoding': 'absent' },
	};
	await recorder.addRecommendation(id, rec);

	const session = await recorder.getActiveByTab(1);
	expect(session?.recommendations).toEqual([rec]);
});

test('addRecommendation lança quando session encerrada', async () => {
	const id = await recorder.startSession({
		tabId: 2,
		initialUrl: 'https://example.com',
		userAgent: 'test-ua',
		viewportSize: { w: 1024, h: 768 },
		canvasCaptureEnabled: false,
	});
	await recorder.stopSession(id);

	const rec: Recommendation = {
		id: 'rec-2',
		ruleId: 'csp-missing',
		severity: 'error',
		timestamp: 100,
		url: 'https://example.com',
		host: 'example.com',
		summary: 'csp ausente',
		evidence: {},
	};
	await expect(recorder.addRecommendation(id, rec)).rejects.toThrow(/já encerrada/);
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.test.ts -t "addRecommendation"
```

Expected: FAIL — `addRecommendation` is not a method.

- [ ] **Step 3: Implement `addRecommendation` in recorder**

In `app/src/lib/session/recorder.ts`, immediately above `addAntipatternHit`, add:

```typescript
addRecommendation(sessionId: string, rec: Recommendation): Promise<void> {
	return serializeBySessionId(sessionId, async () => {
		const s = await getCachedOrLoad(sessionId);
		if (!s) throw new Error(`Session ${sessionId} não encontrada`);
		if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
		if (!s.recommendations) s.recommendations = [];
		s.recommendations.push(rec);
		scheduleFlush(sessionId);
	});
},
```

Add `Recommendation` to the existing `import type { ... } from './types';` block at the top.

- [ ] **Step 4: Run test to verify passes**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.test.ts -t "addRecommendation"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.test.ts
git commit -m "feat(session): recorder.addRecommendation persiste em sessão

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Detector de jQuery

### Task B1: `detectLibraries()` com TDD

**Files:**
- Create: `app/src/probe/detectors/libraries.ts`
- Create: `app/src/probe/detectors/__tests__/libraries.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/src/probe/detectors/__tests__/libraries.test.ts`:

```typescript
import { afterEach, describe, expect, test } from 'vitest';
import { detectLibraries } from '../libraries';

describe('detectLibraries', () => {
	const w = window as unknown as Record<string, unknown>;

	afterEach(() => {
		delete w.jQuery;
		delete w.$;
	});

	test('detecta jQuery via window.jQuery com versão', () => {
		w.jQuery = Object.assign(() => undefined, { fn: { jquery: '3.7.0' } });
		expect(detectLibraries()).toEqual([
			{ name: 'jquery', version: '3.7.0', confidence: 'high' },
		]);
	});

	test('detecta jQuery via window.$ com .fn.jquery', () => {
		w.$ = Object.assign(() => undefined, { fn: { jquery: '2.2.4' } });
		expect(detectLibraries()).toEqual([
			{ name: 'jquery', version: '2.2.4', confidence: 'high' },
		]);
	});

	test('prefere window.jQuery sobre window.$ quando ambos definidos', () => {
		w.jQuery = Object.assign(() => undefined, { fn: { jquery: '3.7.0' } });
		w.$ = Object.assign(() => undefined, { fn: { jquery: '2.2.4' } });
		const result = detectLibraries();
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: 'jquery', version: '3.7.0' });
	});

	test('retorna [] sem jQuery', () => {
		expect(detectLibraries()).toEqual([]);
	});

	test('descarta $ que não tem .fn.jquery (Prototype, Zepto, etc.)', () => {
		w.$ = Object.assign(() => undefined, { fn: { custom: 'something' } });
		expect(detectLibraries()).toEqual([]);
	});

	test('descarta $ não-função', () => {
		w.$ = { fn: { jquery: '3.0.0' } };
		expect(detectLibraries()).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/libraries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `detectLibraries`**

Create `app/src/probe/detectors/libraries.ts`:

```typescript
import type { LibraryDetection } from '@/lib/session/types';

export function detectLibraries(): LibraryDetection[] {
	const out: LibraryDetection[] = [];
	const w = window as unknown as {
		jQuery?: unknown;
		$?: unknown;
	};

	const jq = w.jQuery;
	if (
		typeof jq === 'function' &&
		typeof (jq as { fn?: { jquery?: unknown } }).fn?.jquery === 'string'
	) {
		const version = (jq as { fn: { jquery: string } }).fn.jquery;
		out.push({ name: 'jquery', version, confidence: 'high' });
		return out;
	}

	const $ = w.$;
	if (
		typeof $ === 'function' &&
		typeof ($ as { fn?: { jquery?: unknown } }).fn?.jquery === 'string'
	) {
		const version = ($ as { fn: { jquery: string } }).fn.jquery;
		out.push({ name: 'jquery', version, confidence: 'high' });
	}

	return out;
}
```

- [ ] **Step 4: Run to verify passes**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/libraries.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/probe/detectors/libraries.ts app/src/probe/detectors/__tests__/libraries.test.ts
git commit -m "feat(probe): detector de jQuery via window.jQuery e window.\$

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Integrar `detectLibraries` no probe `buildFingerprint`

**Files:**
- Modify: `app/src/probe/main.ts`

- [ ] **Step 1: Edit `buildFingerprint`**

Edit `app/src/probe/main.ts` — add the import at the top (near the other detector imports):

```typescript
import { detectLibraries } from './detectors/libraries';
```

Edit the `buildFingerprint` function:

```typescript
function buildFingerprint(): EnvironmentFingerprint {
	return {
		framework: detectFramework(),
		libraries: detectLibraries(),
		httpClients: detectHttpClients(),
		dataFetching: detectDataFetching(),
		stateManagers: detectStateManagers(),
		detectedAt: Date.now(),
		isProductionBuild: isProductionBuild(),
	};
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/probe/main.ts
git commit -m "feat(probe): integra detectLibraries em buildFingerprint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — State capture sem gating

### Task C1: Remover `withStateTaps` do protocolo e do probe

**Files:**
- Modify: `app/src/probe/protocol.ts`
- Modify: `app/src/probe/main.ts`
- Modify: `app/src/probe/bridge.ts`
- Modify: `app/src/probe/__tests__/passiveDetection.test.ts`

- [ ] **Step 1: Update protocol type**

Edit `app/src/probe/protocol.ts`. Replace the `probe:start-detection` variant:

```typescript
| {
		ns: typeof PROBE_NAMESPACE;
		type: 'probe:start-detection';
		reason: PageDetectionTrigger;
  }
```

Remove the `withStateTaps: boolean` field and its preceding comment block.

- [ ] **Step 2: Update probe/main.ts to install taps unconditionally**

Edit `app/src/probe/main.ts`. Replace the message handler block that installs taps:

```typescript
window.addEventListener('message', (e: MessageEvent) => {
	if (e.source !== window) return;
	if (!isProbeMessage(e.data)) return;
	if (e.data.type === 'probe:start-detection') {
		active = true;
		if (!historyPatched) {
			patchHistoryForSpaRouting();
			historyPatched = true;
		}
		// Taps são incondicionais agora: state capture funciona com ou sem
		// gravação ativa. UI consome via liveStateChange (passivo) ou via
		// recorder.addStateChange (gravação). Wrappers são idempotentes — chamadas
		// repetidas são no-op.
		installReduxTap();
		installZustandTap();
		installAngularHttpTap();
		installAngularSignalTap();
		installNgRxTap();
		emitDetection(e.data.reason);
	} else if (e.data.type === 'probe:idle') {
		active = false;
	}
});
```

- [ ] **Step 3: Update bridge.ts to drop the flag**

Edit `app/src/probe/bridge.ts`. In the `chrome.runtime.onMessage.addListener` block, replace the `probeStartDetection` branch:

```typescript
if (message?.action === 'probeStartDetection') {
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:start-detection',
		reason: message.reason,
	};
	window.postMessage(msg, location.origin);
}
```

(Remove the `withStateTaps` line.)

- [ ] **Step 4: Update existing tests**

Run:

```bash
cd app && grep -rn "withStateTaps" src
```

For each match, remove the property from the test fixture / message construction. Example for `passiveDetection.test.ts`:

```typescript
window.dispatchEvent(
	new MessageEvent('message', {
		source: window,
		origin: location.origin,
		data: {
			ns: PROBE_NAMESPACE,
			type: 'probe:start-detection',
			reason: 'initial',
		},
	}),
);
```

If a test was specifically asserting that taps were NOT installed when `withStateTaps:false`, that test premise is now obsolete — delete that test (record what was deleted in the commit message).

- [ ] **Step 5: Run typecheck + tests**

```bash
cd app && npx tsc --noEmit && npx vitest run src/probe
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/probe app/manifest.json
git commit -m "refactor(probe): remove flag withStateTaps; taps sempre instalados

State capture deixa de depender de gravação ativa. Wrappers Redux/
Zustand/Angular/NgRx são idempotentes; instalação incondicional não
adiciona overhead em re-injeção.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: Background remove `withStateTaps` dos sendMessage

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Find all sendMessage payloads with `withStateTaps`**

```bash
cd app && grep -n "withStateTaps" src/entrypoints/background.ts
```

Expected hits: 3 (lines around 777, 1789, 1951 per current file).

- [ ] **Step 2: Remove the property from each call site**

Each call looks like:

```typescript
await chrome.tabs.sendMessage(tabId, {
	action: 'probeStartDetection',
	reason: '...',
	withStateTaps: ...,
});
```

Becomes:

```typescript
await chrome.tabs.sendMessage(tabId, {
	action: 'probeStartDetection',
	reason: '...',
});
```

Also remove the obsolete passive-mode comments that explain the flag (they're stale now). Replace them with a single line: `// Taps são instalados pelo probe incondicionalmente — ver C1.`.

- [ ] **Step 3: Update `app/src/types/messages.ts`**

Remove `withStateTaps?: boolean;` from the `ProbeStartDetectionMessage` (or equivalent) shape.

- [ ] **Step 4: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/entrypoints/background.ts app/src/types/messages.ts
git commit -m "refactor(background): remove withStateTaps dos probeStartDetection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task C3: Background broadcast `liveStateChange`

**Files:**
- Modify: `app/src/types/messages.ts`
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Add the new message variant**

Edit `app/src/types/messages.ts`. Add to the `Message` union (and to the corresponding declared shape if there is a `BackgroundToUIMessage` discriminator):

```typescript
| {
		action: 'liveStateChange';
		tabId: number;
		payload: ProbeStateChangePayload;
  }
```

Make sure `ProbeStateChangePayload` is imported from `@/probe/protocol` if not already.

- [ ] **Step 2: Add the broadcast in the `stateChange` handler**

Edit `app/src/entrypoints/background.ts`. Find the existing `if (message.action === 'stateChange')` handler and add the broadcast at the start (regardless of session presence):

```typescript
if (message.action === 'stateChange') {
	const tabId = sender?.tab?.id;
	if (tabId !== undefined && message.statePayload) {
		broadcastToUI('liveStateChange', { tabId, payload: message.statePayload });
	}
	// ... resto do handler permanece (recorder.addStateChange quando há sessão)
}
```

If the existing handler already returns early when there is no session, refactor so the broadcast happens before the early return.

- [ ] **Step 3: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/messages.ts app/src/entrypoints/background.ts
git commit -m "feat(background): broadcast liveStateChange independente de sessão

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Engine de Recomendações

### Task D1: Tipos do engine

**Files:**
- Create: `app/src/lib/session/recommendations/types.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { Recommendation, RecommendationRuleId } from '../types';

export type { Recommendation, RecommendationRuleId };

export interface RuleContext {
	topFrameUrl: string | null;
}

export type RulePartial = Omit<Recommendation, 'id' | 'timestamp'>;

export type Rule = (
	ev: NetworkRuleEvent,
	ctx: RuleContext,
) => RulePartial | null;

export interface RuleDescriptor {
	id: RecommendationRuleId;
	rule: Rule;
}

/**
 * Subset do NetworkEvent (de session/types) que as regras leem. Modelado
 * apartado para que a engine não acoplhe o tipo completo do session — assim
 * conseguimos invocar regras de qualquer fonte (ex.: testes diretos com
 * fixture mínima) sem precisar montar uma `InterceptedResponse` completa.
 */
export interface NetworkRuleEvent {
	requestId?: string;
	method: string;
	url: string;
	status: number;
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
	contentLength?: number; // pode vir de response.headers['content-length'] OU encodedDataLength
	mimeType?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/session/recommendations/types.ts
git commit -m "feat(recommendations): tipos da engine (Rule, RuleContext, NetworkRuleEvent)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D2: Engine + dedup com TDD

**Files:**
- Create: `app/src/lib/session/recommendations/engine.ts`
- Create: `app/src/lib/session/recommendations/__tests__/engine.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/src/lib/session/recommendations/__tests__/engine.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { RecommendationEngine } from '../engine';
import type { NetworkRuleEvent, Rule, RuleDescriptor } from '../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://api.example.com/users',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

const alwaysHit: Rule = (ev) => ({
	ruleId: 'compression-missing',
	severity: 'warn',
	url: ev.url,
	host: new URL(ev.url).host,
	summary: 'always',
	evidence: {},
});

const desc: RuleDescriptor = { id: 'compression-missing', rule: alwaysHit };

describe('RecommendationEngine', () => {
	test('emite hit com id e timestamp na primeira ocorrência', () => {
		const engine = new RecommendationEngine([desc]);
		const result = engine.pushResponse(ev(), { topFrameUrl: null });
		expect(result).toHaveLength(1);
		expect(result[0].id).toMatch(/^[0-9a-f-]+$/i);
		expect(result[0].timestamp).toBeGreaterThan(0);
		expect(result[0].ruleId).toBe('compression-missing');
	});

	test('dedup por (ruleId|host|pathname) — mesma URL não repete', () => {
		const engine = new RecommendationEngine([desc]);
		engine.pushResponse(ev(), { topFrameUrl: null });
		const second = engine.pushResponse(ev(), { topFrameUrl: null });
		expect(second).toEqual([]);
	});

	test('mesmo path em hosts diferentes emite duas vezes', () => {
		const engine = new RecommendationEngine([desc]);
		const first = engine.pushResponse(ev({ url: 'https://a.com/api' }), { topFrameUrl: null });
		const second = engine.pushResponse(ev({ url: 'https://b.com/api' }), { topFrameUrl: null });
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
	});

	test('reset() libera a dedup', () => {
		const engine = new RecommendationEngine([desc]);
		engine.pushResponse(ev(), { topFrameUrl: null });
		engine.reset();
		const second = engine.pushResponse(ev(), { topFrameUrl: null });
		expect(second).toHaveLength(1);
	});

	test('FIFO eviction quando excede 1000 entradas', () => {
		const engine = new RecommendationEngine([desc]);
		// preenche dedup com 1000 paths distintos
		for (let i = 0; i < 1000; i++) {
			engine.pushResponse(ev({ url: `https://api.example.com/p${i}` }), { topFrameUrl: null });
		}
		// path 0 ainda dedup
		expect(
			engine.pushResponse(ev({ url: 'https://api.example.com/p0' }), { topFrameUrl: null }),
		).toEqual([]);
		// adicionar o 1001-ésimo evicta o p0
		engine.pushResponse(ev({ url: 'https://api.example.com/p1000' }), { topFrameUrl: null });
		// agora p0 pode reemitir
		const reemit = engine.pushResponse(ev({ url: 'https://api.example.com/p0' }), {
			topFrameUrl: null,
		});
		expect(reemit).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/engine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement engine**

Create `app/src/lib/session/recommendations/engine.ts`:

```typescript
import type { NetworkRuleEvent, Recommendation, RuleContext, RuleDescriptor } from './types';

const MAX_DEDUP = 1000;

export class RecommendationEngine {
	private dedup = new Set<string>();
	private dedupOrder: string[] = [];

	constructor(private readonly rules: RuleDescriptor[]) {}

	pushResponse(ev: NetworkRuleEvent, ctx: RuleContext): Recommendation[] {
		const out: Recommendation[] = [];
		for (const { rule } of this.rules) {
			const partial = rule(ev, ctx);
			if (!partial) continue;
			const key = this.dedupKey(partial.ruleId, partial.url, partial.host);
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

	private dedupKey(ruleId: string, url: string, host: string): string {
		let pathname: string;
		try {
			pathname = new URL(url).pathname;
		} catch {
			pathname = url;
		}
		return `${ruleId}|${host}|${pathname}`;
	}

	private evictIfNeeded(): void {
		while (this.dedupOrder.length > MAX_DEDUP) {
			const oldest = this.dedupOrder.shift();
			if (oldest !== undefined) this.dedup.delete(oldest);
		}
	}
}
```

- [ ] **Step 4: Run to verify passes**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/engine.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/engine.ts app/src/lib/session/recommendations/__tests__/engine.test.ts
git commit -m "feat(recommendations): engine com dedup ruleId|host|pathname (FIFO 1000)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D3: Regra `compression-missing`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/compressionMissing.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/compressionMissing.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from 'vitest';
import { compressionMissingRule } from '../../rules/compressionMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-type': 'application/json', 'content-length': '5000' },
	...overrides,
});

describe('compression-missing rule', () => {
	test('dispara quando JSON > 1KB sem content-encoding', () => {
		const r = compressionMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r).not.toBeNull();
		expect(r?.severity).toBe('warn');
		expect(r?.evidence['content-encoding']).toBe('absent');
	});

	test('não dispara quando há gzip', () => {
		const r = compressionMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'application/json', 'content-length': '5000', 'content-encoding': 'gzip' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em image/png', () => {
		const r = compressionMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'image/png', 'content-length': '5000' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em payload exatamente 1024 bytes (limite inclusivo)', () => {
		const r = compressionMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'application/json', 'content-length': '1024' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em status != 200', () => {
		const r = compressionMissingRule.rule(
			ev({ status: 304, responseHeaders: { 'content-type': 'application/json', 'content-length': '5000' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/rules/compressionMissing.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/src/lib/session/recommendations/rules/compressionMissing.ts`:

```typescript
import type { Rule, RuleDescriptor } from '../types';

const COMPRESSED = new Set(['gzip', 'br', 'deflate', 'zstd']);
const TEXT_PATTERNS = [
	/^text\//,
	/^application\/json/,
	/^application\/javascript/,
	/^application\/xml/,
	/\+json$/,
	/\+xml$/,
];

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const headers = ev.responseHeaders;
	const contentType = (headers['content-type'] ?? '').toLowerCase();
	if (!TEXT_PATTERNS.some((p) => p.test(contentType))) return null;

	const length = Number(headers['content-length']);
	if (!Number.isFinite(length) || length <= 1024) return null;

	const encoding = (headers['content-encoding'] ?? '').toLowerCase().trim();
	if (encoding && COMPRESSED.has(encoding.split(',')[0].trim())) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'compression-missing',
		severity: 'warn',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `compressão ausente em ${new URL(ev.url).pathname} (${length} bytes)`,
		evidence: {
			'content-type': contentType,
			'content-length': String(length),
			'content-encoding': encoding || 'absent',
		},
		suggestion: 'Habilite gzip/brotli no servidor para responses textuais > 1 KB.',
	};
};

export const compressionMissingRule: RuleDescriptor = {
	id: 'compression-missing',
	rule,
};
```

- [ ] **Step 4: Run to verify passes**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/rules/compressionMissing.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/compressionMissing.ts app/src/lib/session/recommendations/__tests__/rules/compressionMissing.test.ts
git commit -m "feat(recommendations): regra compression-missing (texto > 1KB sem gzip/br)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D4: Regra `cache-missing`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/cacheMissing.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/cacheMissing.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, test } from 'vitest';
import { cacheMissingRule } from '../../rules/cacheMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/static/app.js',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('cache-missing rule', () => {
	test('dispara em .js sem cache-control', () => {
		const r = cacheMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('info');
		expect(r?.evidence['cache-control']).toBe('absent');
	});

	test('dispara em .css com no-store', () => {
		const r = cacheMissingRule.rule(
			ev({ url: 'https://example.com/style.css', responseHeaders: { 'cache-control': 'no-store' } }),
			{ topFrameUrl: null },
		);
		expect(r?.evidence['cache-control']).toContain('no-store');
	});

	test('não dispara com cache-control immutable', () => {
		const r = cacheMissingRule.rule(
			ev({ responseHeaders: { 'cache-control': 'public, max-age=31536000, immutable' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em rota não-estática', () => {
		const r = cacheMissingRule.rule(ev({ url: 'https://example.com/api/users' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('detecta extensões com query string', () => {
		const r = cacheMissingRule.rule(ev({ url: 'https://example.com/app.js?v=123' }), { topFrameUrl: null });
		expect(r).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run failing**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/rules/cacheMissing.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/cacheMissing.ts
import type { Rule, RuleDescriptor } from '../types';

const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|woff2|webp|avif|ico|gif)(?:$|\?)/i;

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;

	let pathname: string;
	let host: string;
	try {
		const u = new URL(ev.url);
		pathname = u.pathname + u.search;
		host = u.host;
	} catch {
		return null;
	}

	if (!STATIC_EXT.test(pathname)) return null;

	const cc = (ev.responseHeaders['cache-control'] ?? '').toLowerCase();
	if (cc && !cc.includes('no-store')) return null;

	return {
		ruleId: 'cache-missing',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `estático ${new URL(ev.url).pathname} sem cache de longa duração`,
		evidence: { 'cache-control': cc || 'absent' },
		suggestion:
			'Estáticos versionados podem usar `Cache-Control: public, max-age=31536000, immutable`.',
	};
};

export const cacheMissingRule: RuleDescriptor = { id: 'cache-missing', rule };
```

- [ ] **Step 4: Run passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/cacheMissing.ts app/src/lib/session/recommendations/__tests__/rules/cacheMissing.test.ts
git commit -m "feat(recommendations): regra cache-missing (estáticos sem cache-control)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D5: Regra `mixed-content`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/mixedContent.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/mixedContent.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { mixedContentRule } from '../../rules/mixedContent';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'http://insecure.example.com/img.png',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('mixed-content rule', () => {
	test('dispara quando page é HTTPS e subresource é HTTP', () => {
		const r = mixedContentRule.rule(ev(), { topFrameUrl: 'https://example.com' });
		expect(r?.severity).toBe('error');
	});

	test('não dispara quando page é HTTP', () => {
		const r = mixedContentRule.rule(ev(), { topFrameUrl: 'http://example.com' });
		expect(r).toBeNull();
	});

	test('não dispara quando subresource é HTTPS', () => {
		const r = mixedContentRule.rule(ev({ url: 'https://x.com/img' }), { topFrameUrl: 'https://example.com' });
		expect(r).toBeNull();
	});

	test('não dispara quando topFrameUrl é null', () => {
		const r = mixedContentRule.rule(ev(), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('ignora data: e blob:', () => {
		const r1 = mixedContentRule.rule(ev({ url: 'data:image/png;base64,iVBOR' }), { topFrameUrl: 'https://x.com' });
		const r2 = mixedContentRule.rule(ev({ url: 'blob:https://x.com/abc' }), { topFrameUrl: 'https://x.com' });
		expect(r1).toBeNull();
		expect(r2).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/mixedContent.ts
import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev, ctx) => {
	if (!ctx.topFrameUrl) return null;
	if (!ctx.topFrameUrl.startsWith('https:')) return null;
	if (!ev.url.startsWith('http:')) return null; // exclui https:, data:, blob:

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'mixed-content',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `subresource HTTP em página HTTPS: ${ev.url}`,
		evidence: { page: ctx.topFrameUrl, subresource: ev.url },
		suggestion: 'Migre o subresource para HTTPS — navegadores bloqueiam mixed content em produção.',
	};
};

export const mixedContentRule: RuleDescriptor = { id: 'mixed-content', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/mixedContent.ts app/src/lib/session/recommendations/__tests__/rules/mixedContent.test.ts
git commit -m "feat(recommendations): regra mixed-content (subresource HTTP em página HTTPS)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D6: Regra `csp-missing`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/cspMissing.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/cspMissing.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { cspMissingRule } from '../../rules/cspMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/index.html',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-type': 'text/html; charset=utf-8' },
	...overrides,
});

describe('csp-missing rule', () => {
	test('dispara em HTML 200 sem CSP', () => {
		const r = cspMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('error');
	});

	test('não dispara com content-security-policy presente', () => {
		const r = cspMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'" } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara com report-only', () => {
		const r = cspMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'text/html', 'content-security-policy-report-only': "default-src 'self'" } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em response não-HTML', () => {
		const r = cspMissingRule.rule(ev({ responseHeaders: { 'content-type': 'application/json' } }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('não dispara em status != 200', () => {
		const r = cspMissingRule.rule(ev({ status: 404 }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/cspMissing.ts
import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const ct = (ev.responseHeaders['content-type'] ?? '').toLowerCase();
	if (!ct.includes('text/html')) return null;

	if (ev.responseHeaders['content-security-policy']) return null;
	if (ev.responseHeaders['content-security-policy-report-only']) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'csp-missing',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `HTML sem Content-Security-Policy: ${host}`,
		evidence: { 'content-type': ct, 'content-security-policy': 'absent' },
		suggestion: 'Adicione `Content-Security-Policy` para mitigar XSS.',
	};
};

export const cspMissingRule: RuleDescriptor = { id: 'csp-missing', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/cspMissing.ts app/src/lib/session/recommendations/__tests__/rules/cspMissing.test.ts
git commit -m "feat(recommendations): regra csp-missing (HTML sem CSP)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D7: Regra `hsts-missing`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/hstsMissing.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/hstsMissing.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { hstsMissingRule } from '../../rules/hstsMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('hsts-missing rule', () => {
	test('dispara em HTTPS sem strict-transport-security', () => {
		const r = hstsMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('error');
	});

	test('não dispara com strict-transport-security presente', () => {
		const r = hstsMissingRule.rule(
			ev({ responseHeaders: { 'strict-transport-security': 'max-age=31536000' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em URL HTTP', () => {
		const r = hstsMissingRule.rule(ev({ url: 'http://example.com/api' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/hstsMissing.ts
import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (!ev.url.startsWith('https:')) return null;
	if (ev.responseHeaders['strict-transport-security']) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'hsts-missing',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `HTTPS sem HSTS: ${host}`,
		evidence: { 'strict-transport-security': 'absent' },
		suggestion: 'Adicione `Strict-Transport-Security: max-age=31536000; includeSubDomains` para forçar HTTPS.',
	};
};

export const hstsMissingRule: RuleDescriptor = { id: 'hsts-missing', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/hstsMissing.ts app/src/lib/session/recommendations/__tests__/rules/hstsMissing.test.ts
git commit -m "feat(recommendations): regra hsts-missing (HTTPS sem Strict-Transport-Security)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D8: Regra `nosniff-missing`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/nosniffMissing.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/nosniffMissing.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { nosniffMissingRule } from '../../rules/nosniffMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('nosniff-missing rule', () => {
	test('dispara em response sem x-content-type-options', () => {
		const r = nosniffMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('warn');
	});

	test('não dispara com nosniff presente', () => {
		const r = nosniffMissingRule.rule(
			ev({ responseHeaders: { 'x-content-type-options': 'nosniff' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em status != 200', () => {
		const r = nosniffMissingRule.rule(ev({ status: 304 }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/nosniffMissing.ts
import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const v = (ev.responseHeaders['x-content-type-options'] ?? '').toLowerCase().trim();
	if (v === 'nosniff') return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'nosniff-missing',
		severity: 'warn',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `response sem X-Content-Type-Options: ${host}`,
		evidence: { 'x-content-type-options': v || 'absent' },
		suggestion: 'Adicione `X-Content-Type-Options: nosniff` para impedir MIME sniffing.',
	};
};

export const nosniffMissingRule: RuleDescriptor = { id: 'nosniff-missing', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/nosniffMissing.ts app/src/lib/session/recommendations/__tests__/rules/nosniffMissing.test.ts
git commit -m "feat(recommendations): regra nosniff-missing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D9: Regra `large-payload`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/largePayload.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/largePayload.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { largePayloadRule } from '../../rules/largePayload';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api/data',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-length': String(2 * 1024 * 1024) },
	...overrides,
});

describe('large-payload rule', () => {
	test('dispara em payload > 1 MB sem paginação', () => {
		const r = largePayloadRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('info');
	});

	test('não dispara quando query tem ?page=', () => {
		const r = largePayloadRule.rule(ev({ url: 'https://example.com/api/data?page=1' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('não dispara quando query tem ?cursor=', () => {
		const r = largePayloadRule.rule(ev({ url: 'https://example.com/api/data?cursor=abc' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('não dispara abaixo de 1 MB', () => {
		const r = largePayloadRule.rule(ev({ responseHeaders: { 'content-length': '1024' } }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/largePayload.ts
import type { Rule, RuleDescriptor } from '../types';

const PAGINATION_KEYS = ['page', 'limit', 'offset', 'cursor', 'after', 'before', 'pagesize'];

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const length = Number(ev.responseHeaders['content-length']);
	if (!Number.isFinite(length) || length <= 1_048_576) return null;

	let u: URL;
	try {
		u = new URL(ev.url);
	} catch {
		return null;
	}
	const params = u.searchParams;
	for (const key of PAGINATION_KEYS) {
		if (params.has(key)) return null;
	}

	return {
		ruleId: 'large-payload',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `payload de ${(length / 1024 / 1024).toFixed(1)} MB sem paginação detectada`,
		evidence: { 'content-length': String(length) },
		suggestion: 'Considere paginação ou compressão semântica.',
	};
};

export const largePayloadRule: RuleDescriptor = { id: 'large-payload', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/largePayload.ts app/src/lib/session/recommendations/__tests__/rules/largePayload.test.ts
git commit -m "feat(recommendations): regra large-payload (>1MB sem paginação)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D10: Regra `image-not-optimized`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/imageNotOptimized.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/imageNotOptimized.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { imageNotOptimizedRule } from '../../rules/imageNotOptimized';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/photo.png',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-type': 'image/png', 'content-length': String(800 * 1024) },
	...overrides,
});

describe('image-not-optimized rule', () => {
	test('dispara em PNG > 500KB com accept webp', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ requestHeaders: { accept: 'image/webp,image/avif,*/*' } }),
			{ topFrameUrl: null },
		);
		expect(r?.severity).toBe('info');
		expect(r?.evidence.accept).toContain('webp');
	});

	test('dispara em JPEG > 500KB sem accept (evidence sinaliza absent)', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ url: 'https://example.com/p.jpg', responseHeaders: { 'content-type': 'image/jpeg', 'content-length': String(800 * 1024) } }),
			{ topFrameUrl: null },
		);
		expect(r).not.toBeNull();
		expect(r?.evidence.accept).toBe('absent');
	});

	test('não dispara em image/webp', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ responseHeaders: { 'content-type': 'image/webp', 'content-length': String(800 * 1024) } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara abaixo de 500KB', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ responseHeaders: { 'content-type': 'image/png', 'content-length': '102400' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/imageNotOptimized.ts
import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const ct = (ev.responseHeaders['content-type'] ?? '').toLowerCase();
	if (ct !== 'image/png' && ct !== 'image/jpeg') return null;
	const length = Number(ev.responseHeaders['content-length']);
	if (!Number.isFinite(length) || length <= 524_288) return null;

	const accept = ev.requestHeaders.accept ?? ev.requestHeaders.Accept ?? '';

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'image-not-optimized',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `imagem de ${(length / 1024).toFixed(0)} KB em formato não otimizado (${ct})`,
		evidence: {
			'content-type': ct,
			'content-length': String(length),
			accept: accept || 'absent',
		},
		suggestion: 'Sirva WebP/AVIF para clientes modernos — economia típica de 30-50%. Verifique `Accept` do cliente real antes de migrar.',
	};
};

export const imageNotOptimizedRule: RuleDescriptor = { id: 'image-not-optimized', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/imageNotOptimized.ts app/src/lib/session/recommendations/__tests__/rules/imageNotOptimized.test.ts
git commit -m "feat(recommendations): regra image-not-optimized (PNG/JPEG >500KB)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D11: Regra `cookie-insecure`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/cookieInsecure.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/cookieInsecure.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { cookieInsecureRule } from '../../rules/cookieInsecure';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api/login',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('cookie-insecure rule', () => {
	test('dispara em HTTPS com cookie sem Secure', () => {
		const r = cookieInsecureRule.rule(
			ev({ responseHeaders: { 'set-cookie': 'sid=abc; HttpOnly; Path=/' } }),
			{ topFrameUrl: null },
		);
		expect(r?.severity).toBe('error');
		expect(r?.evidence.missing).toContain('Secure');
	});

	test('dispara em HTTP com cookie sem HttpOnly', () => {
		const r = cookieInsecureRule.rule(
			ev({ url: 'http://example.com/api', responseHeaders: { 'set-cookie': 'sid=abc; Path=/' } }),
			{ topFrameUrl: null },
		);
		expect(r?.evidence.missing).toContain('HttpOnly');
	});

	test('não dispara com Secure;HttpOnly em HTTPS', () => {
		const r = cookieInsecureRule.rule(
			ev({ responseHeaders: { 'set-cookie': 'sid=abc; Secure; HttpOnly; Path=/' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara sem set-cookie', () => {
		const r = cookieInsecureRule.rule(ev(), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/cookieInsecure.ts
import type { Rule, RuleDescriptor } from '../types';

function parseFirstCookieFlags(setCookie: string): { name: string; flags: Set<string> } {
	// Split em ',' não é seguro porque Expires=Wed, 01... contém vírgula. Em CDP
	// `set-cookie` chega como string concatenada por '\n' quando há múltiplos.
	// Pegamos só o primeiro.
	const first = setCookie.split('\n')[0] ?? setCookie;
	const parts = first.split(';').map((p) => p.trim());
	const [nameAndValue, ...attrs] = parts;
	const name = nameAndValue.split('=')[0]?.trim() ?? '';
	const flags = new Set(attrs.map((a) => a.split('=')[0]!.toLowerCase()));
	return { name, flags };
}

const rule: Rule = (ev) => {
	const sc = ev.responseHeaders['set-cookie'];
	if (!sc) return null;

	const { name, flags } = parseFirstCookieFlags(sc);
	const isHttps = ev.url.startsWith('https:');
	const missing: string[] = [];
	if (isHttps && !flags.has('secure')) missing.push('Secure');
	if (!flags.has('httponly')) missing.push('HttpOnly');
	if (missing.length === 0) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'cookie-insecure',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `cookie ${name || '?'} sem ${missing.join('+')} em ${host}`,
		evidence: { cookie: name || '?', missing: missing.join(';') },
		suggestion: 'Adicione flags `Secure; HttpOnly` (e considere `SameSite=Lax`).',
	};
};

export const cookieInsecureRule: RuleDescriptor = { id: 'cookie-insecure', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/cookieInsecure.ts app/src/lib/session/recommendations/__tests__/rules/cookieInsecure.test.ts
git commit -m "feat(recommendations): regra cookie-insecure (Secure/HttpOnly)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D12: Regra `cors-open`

**Files:**
- Create: `app/src/lib/session/recommendations/rules/corsOpen.ts`
- Create: `app/src/lib/session/recommendations/__tests__/rules/corsOpen.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, test } from 'vitest';
import { corsOpenRule } from '../../rules/corsOpen';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://api.example.com/users',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'access-control-allow-origin': '*' },
	...overrides,
});

describe('cors-open rule', () => {
	test('dispara em ACAO=*', () => {
		const r = corsOpenRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('warn');
	});

	test('não dispara em ACAO=* com credentials=true (combinação inválida; o navegador rejeita)', () => {
		const r = corsOpenRule.rule(
			ev({ responseHeaders: { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em ACAO restrito', () => {
		const r = corsOpenRule.rule(
			ev({ responseHeaders: { 'access-control-allow-origin': 'https://app.example.com' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara sem header CORS', () => {
		const r = corsOpenRule.rule(ev({ responseHeaders: {} }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
```

- [ ] **Step 2: Failing**
- [ ] **Step 3: Implement**

```typescript
// app/src/lib/session/recommendations/rules/corsOpen.ts
import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	const acao = (ev.responseHeaders['access-control-allow-origin'] ?? '').trim();
	if (acao !== '*') return null;
	const creds = (ev.responseHeaders['access-control-allow-credentials'] ?? '').toLowerCase().trim();
	if (creds === 'true') return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'cors-open',
		severity: 'warn',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `Access-Control-Allow-Origin: * em ${host}`,
		evidence: { 'access-control-allow-origin': '*' },
		suggestion: 'Restrinja `Access-Control-Allow-Origin` ao(s) origin(s) confiável(eis).',
	};
};

export const corsOpenRule: RuleDescriptor = { id: 'cors-open', rule };
```

- [ ] **Step 4: Passes**
- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recommendations/rules/corsOpen.ts app/src/lib/session/recommendations/__tests__/rules/corsOpen.test.ts
git commit -m "feat(recommendations): regra cors-open (ACAO=* sem credentials)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task D13: Registry consolidado

**Files:**
- Create: `app/src/lib/session/recommendations/registry.ts`

- [ ] **Step 1: Create**

```typescript
import type { RuleDescriptor } from './types';
import { cacheMissingRule } from './rules/cacheMissing';
import { compressionMissingRule } from './rules/compressionMissing';
import { cookieInsecureRule } from './rules/cookieInsecure';
import { corsOpenRule } from './rules/corsOpen';
import { cspMissingRule } from './rules/cspMissing';
import { hstsMissingRule } from './rules/hstsMissing';
import { imageNotOptimizedRule } from './rules/imageNotOptimized';
import { largePayloadRule } from './rules/largePayload';
import { mixedContentRule } from './rules/mixedContent';
import { nosniffMissingRule } from './rules/nosniffMissing';

export const REGISTRY: RuleDescriptor[] = [
	compressionMissingRule,
	cacheMissingRule,
	mixedContentRule,
	cspMissingRule,
	hstsMissingRule,
	nosniffMissingRule,
	largePayloadRule,
	imageNotOptimizedRule,
	cookieInsecureRule,
	corsOpenRule,
];
```

- [ ] **Step 2: Verify lint + typecheck**

```bash
cd app && npm run lint && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/session/recommendations/registry.ts
git commit -m "feat(recommendations): registry exporta as 10 regras

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — Background integration

### Task E1: Helper `getTopFrameUrl` com cache

**Files:**
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Add the helper near the top-level utility helpers (above `handleRequestPaused`)**

```typescript
// Cache de top-frame URL por tab. Recommendations regra `mixed-content`
// precisa saber o origin da página principal — invalidamos a cada onCommitted.
const topFrameUrlCache = new Map<number, string>();

async function getTopFrameUrl(tabId: number): Promise<string | null> {
	const cached = topFrameUrlCache.get(tabId);
	if (cached !== undefined) return cached;
	try {
		const tab = await chrome.tabs.get(tabId);
		const url = tab.url ?? null;
		if (url) topFrameUrlCache.set(tabId, url);
		return url;
	} catch {
		return null;
	}
}

function invalidateTopFrameUrl(tabId: number): void {
	topFrameUrlCache.delete(tabId);
}
```

In the existing `chrome.webNavigation.onCommitted` listener (top-frame branch), add:

```typescript
if (details.frameId === 0) {
	invalidateTopFrameUrl(details.tabId);
}
```

(Place it near the top of the listener body before existing logic.)

- [ ] **Step 2: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/entrypoints/background.ts
git commit -m "feat(background): cache de top-frame URL por tab (mixed-content lookup)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task E2: Engine wiring no background

**Files:**
- Modify: `app/src/entrypoints/background.ts`
- Modify: `app/src/types/messages.ts`

- [ ] **Step 1: Add `liveRecommendation` ao Message union**

Edit `app/src/types/messages.ts`. Add to the union:

```typescript
| {
		action: 'liveRecommendation';
		tabId: number;
		recommendation: Recommendation;
  }
```

Make sure `Recommendation` is imported from `@/lib/session/types`.

- [ ] **Step 2: Instantiate engine + helper**

Edit `app/src/entrypoints/background.ts`. Near the top imports, add:

```typescript
import { RecommendationEngine } from '@/lib/session/recommendations/engine';
import { REGISTRY as RECOMMENDATION_REGISTRY } from '@/lib/session/recommendations/registry';
import type { NetworkRuleEvent } from '@/lib/session/recommendations/types';
```

Below the `topFrameUrlCache` block, add:

```typescript
const recommendationEngine = new RecommendationEngine(RECOMMENDATION_REGISTRY);

function buildNetworkRuleEvent(
	requestId: string | undefined,
	r: InterceptedResponse,
): NetworkRuleEvent {
	const responseHeaders: Record<string, string> = {};
	for (const [k, v] of Object.entries(r.response?.headers ?? r.headers ?? {})) {
		responseHeaders[k.toLowerCase()] = v;
	}
	const requestHeaders: Record<string, string> = {};
	for (const [k, v] of Object.entries(r.request?.headers ?? {})) {
		requestHeaders[k.toLowerCase()] = v;
	}
	return {
		requestId,
		method: r.method ?? 'GET',
		url: r.url,
		status: r.status,
		requestHeaders,
		responseHeaders,
		mimeType: r.mimeType,
	};
}
```

- [ ] **Step 3: Hook em `handleRequestPaused`**

Find the call site of `persistRequest(...)` inside `handleRequestPaused` (or whichever function persists the response after `Fetch.getResponseBody`). Right after that call, add:

```typescript
try {
	const ruleEv = buildNetworkRuleEvent(networkId ?? requestId, response);
	const ctx = { topFrameUrl: await getTopFrameUrl(tabId) };
	const hits = recommendationEngine.pushResponse(ruleEv, ctx);
	for (const hit of hits) {
		broadcastToUI('liveRecommendation', { tabId, recommendation: hit });
		const session = await recorder.getActiveByTab(tabId);
		if (session) {
			await recorder.addRecommendation(session.id, hit);
		}
	}
} catch (err) {
	console.warn('[recommendations] pushResponse falhou:', err);
}
```

(`networkId`, `requestId`, `response`, `tabId` are existing locals in the handler — confirm names with the current code.)

- [ ] **Step 4: Reset engine em `startDebugging` e em `webNavigation.onCommitted`**

In `startDebugging`, after `chrome.debugger.attach` success:

```typescript
recommendationEngine.reset();
```

In the existing `chrome.webNavigation.onCommitted` listener (top-frame branch, after `invalidateTopFrameUrl`):

```typescript
recommendationEngine.reset();
```

- [ ] **Step 5: Run typecheck + tests**

```bash
cd app && npx tsc --noEmit && npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/entrypoints/background.ts app/src/types/messages.ts
git commit -m "feat(background): wire RecommendationEngine em handleRequestPaused

Engine emite liveRecommendation para UI passiva e persiste em
session.recommendations quando há gravação ativa. Reset em
startDebugging e em onCommitted top-frame.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase F — Mensagens

### Task F1: Remover `liveAntipatternHit`, garantir `liveRecommendation` e `liveStateChange`

**Files:**
- Modify: `app/src/types/messages.ts`

- [ ] **Step 1: Remove the `liveAntipatternHit` variant from the `Message` union**

Open `app/src/types/messages.ts`. Delete the entire variant block:

```typescript
| {
		action: 'liveAntipatternHit';
		tabId: number;
		antipatternHit?: AntipatternHit;
  }
```

Remove the corresponding `import type { AntipatternHit }` if no other variant uses it.

- [ ] **Step 2: Confirm `liveRecommendation` (Phase E2) and `liveStateChange` (Phase C3) are present**

Re-open the file and verify both unions exist. If either is missing, add the corresponding block now.

- [ ] **Step 3: Run typecheck — expect failures from broadcasters and listeners of `liveAntipatternHit`**

```bash
cd app && npx tsc --noEmit
```

Take note of every TS error pointing to `liveAntipatternHit`. They will be fixed in Phase G/I (UI cleanup) — for now, surface them.

- [ ] **Step 4: DO NOT commit yet**

The build is intentionally broken between F1 and the cleanup tasks. Continue without committing.

---

## Phase G — UI

### Task G1: `StateInspector` modo dual

**Files:**
- Modify: `app/src/components/replay/StateInspector.tsx`

- [ ] **Step 1: Update Props**

Edit `app/src/components/replay/StateInspector.tsx`. Replace the `Props` interface:

```typescript
import type { DetectionPhase, SessionEvent, StoreKind } from '@/lib/session/types';

interface LiveSnapshotEntry {
	storeKind: StoreKind;
	current: unknown;
	recentChanges: number;
	lastChangeAt: number;
}

export interface LiveStateSnapshot {
	byStoreId: Record<string, LiveSnapshotEntry>;
}

interface Props {
	// Modo gravado (replay):
	phase?: DetectionPhase | null;
	events?: SessionEvent[];
	playheadTimestamp?: number;
	// Modo passivo (live):
	liveSnapshot?: LiveStateSnapshot;
}
```

- [ ] **Step 2: Branch the rendering**

Replace the top of the component body with:

```typescript
export function StateInspector({ phase, events, playheadTimestamp, liveSnapshot }: Props) {
	if (process.env.NODE_ENV !== 'production' && liveSnapshot && phase) {
		console.warn('[StateInspector] liveSnapshot e phase fornecidos juntos — usando liveSnapshot.');
	}

	if (liveSnapshot) {
		return <LiveView snapshot={liveSnapshot} />;
	}

	// Lógica atual de modo gravado segue inalterada abaixo
	const storeIds = useMemo(() => {
		if (!phase) return [];
		return Object.keys(phase.stateBaseline ?? {});
	}, [phase]);
	// ... resto
}

function LiveView({ snapshot }: { snapshot: LiveStateSnapshot }) {
	const ids = Object.keys(snapshot.byStoreId);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const effectiveId = selectedId && ids.includes(selectedId) ? selectedId : ids[0] ?? null;
	const entry = effectiveId ? snapshot.byStoreId[effectiveId] : null;

	if (ids.length === 0) {
		return (
			<p className="p-3 text-muted-foreground text-sm">
				Nenhum store de estado detectado nesta página.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center gap-2">
				<label htmlFor="state-store-live" className="text-xs">
					Store:
				</label>
				<select
					id="state-store-live"
					className="rounded border bg-background px-2 py-1 text-xs"
					value={effectiveId ?? ''}
					onChange={(e) => setSelectedId(e.target.value)}
				>
					{ids.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
				{entry && (
					<>
						<span className="rounded bg-muted px-2 py-0.5 font-medium text-[10px]">
							{entry.storeKind}
						</span>
						<span className="text-muted-foreground text-xs" aria-label="mutações">
							● {entry.recentChanges} mut.
						</span>
					</>
				)}
			</div>
			{entry && (
				<div className="overflow-auto rounded border p-2">
					<JsonTree value={entry.current} />
				</div>
			)}
		</div>
	);
}
```

(Add `import * as React from 'react';` if `React` is not in scope.)

- [ ] **Step 3: Verify existing tests still pass**

```bash
cd app && npx vitest run src/components/replay
```

If a test imports `StateInspector` without the new optional props, types still pass (they're optional).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/replay/StateInspector.tsx
git commit -m "feat(replay): StateInspector ganha modo liveSnapshot (passivo)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task G2: `LiveInsightsPanel` shell + seção Framework

**Files:**
- Create: `app/src/components/replay/LiveInsightsPanel.tsx`
- Delete: `app/src/components/replay/LiveAntipatternsPanel.tsx` (after switch in Layout)

> Note: We create the new file alongside the old in this task. Old file gets removed at Phase I.

- [ ] **Step 1: Create the file**

```typescript
import { useEffect, useReducer, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ProbeStateChangePayload } from '@/probe/protocol';
import type { EnvironmentFingerprint, Recommendation, StoreKind } from '@/lib/session/types';
import type { Message } from '@/types/messages';
import type { LiveStateSnapshot } from './StateInspector';
import { StateInspector } from './StateInspector';
import { RecommendationRow } from './RecommendationRow';

const MAX_RECOMMENDATIONS = 50;

interface LiveDetection {
	url: string;
	fingerprint: EnvironmentFingerprint;
	timestamp: number;
}

interface PanelState {
	detection: LiveDetection | null;
	state: LiveStateSnapshot;
	recommendations: Recommendation[];
}

type PanelAction =
	| { type: 'detection'; payload: LiveDetection }
	| { type: 'state-change'; payload: ProbeStateChangePayload }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'reset-state' };

const INITIAL: PanelState = {
	detection: null,
	state: { byStoreId: {} },
	recommendations: [],
};

function reducer(s: PanelState, a: PanelAction): PanelState {
	switch (a.type) {
		case 'detection':
			return { ...s, detection: a.payload };
		case 'state-change': {
			const id = a.payload.storeId;
			const prev = s.state.byStoreId[id];
			return {
				...s,
				state: {
					byStoreId: {
						...s.state.byStoreId,
						[id]: {
							storeKind: a.payload.storeKind,
							current: a.payload.next,
							recentChanges: (prev?.recentChanges ?? 0) + 1,
							lastChangeAt: a.payload.timestamp,
						},
					},
				},
			};
		}
		case 'recommendation':
			return {
				...s,
				recommendations: [a.payload, ...s.recommendations].slice(0, MAX_RECOMMENDATIONS),
			};
		case 'clear':
			return INITIAL;
		case 'reset-state':
			return { ...s, state: { byStoreId: {} } };
	}
}

interface Props {
	tabId: number | null;
}

export function LiveInsightsPanel({ tabId }: Props) {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const [open, setOpen] = useState({ framework: true, state: true, recommendations: true });

	useEffect(() => {
		dispatch({ type: 'clear' });
		if (tabId == null) return;
		const onMessage = (msg: Message) => {
			if (!('tabId' in msg) || msg.tabId !== tabId) return;
			if (msg.action === 'liveDetection' && msg.payload) {
				dispatch({
					type: 'detection',
					payload: {
						url: msg.payload.url,
						fingerprint: msg.payload.fingerprint,
						timestamp: msg.payload.timestamp,
					},
				});
				if (msg.payload.triggerType === 'navigation') {
					dispatch({ type: 'reset-state' });
				}
			} else if (msg.action === 'liveStateChange') {
				dispatch({ type: 'state-change', payload: msg.payload });
			} else if (msg.action === 'liveRecommendation') {
				dispatch({ type: 'recommendation', payload: msg.recommendation });
			}
		};
		chrome.runtime.onMessage.addListener(onMessage);
		return () => chrome.runtime.onMessage.removeListener(onMessage);
	}, [tabId]);

	if (tabId == null) return null;

	return (
		<aside
			className="fixed right-3 bottom-3 max-h-[70vh] w-[360px] overflow-auto rounded border bg-background shadow-lg"
			aria-label="Live Insights"
		>
			<header className="sticky top-0 flex items-center justify-between border-b bg-background px-3 py-2">
				<h2 className="font-semibold text-sm">Live Insights</h2>
				<button
					type="button"
					className="text-muted-foreground text-xs hover:underline"
					onClick={() => dispatch({ type: 'clear' })}
				>
					limpar
				</button>
			</header>

			<Section
				title="Framework & Libraries"
				open={open.framework}
				onToggle={() => setOpen((o) => ({ ...o, framework: !o.framework }))}
			>
				<FrameworkSection detection={state.detection} />
			</Section>

			<Section
				title="Estado ao vivo"
				open={open.state}
				onToggle={() => setOpen((o) => ({ ...o, state: !o.state }))}
			>
				<StateInspector liveSnapshot={state.state} />
			</Section>

			<Section
				title={`Recomendações (${state.recommendations.length})`}
				open={open.recommendations}
				onToggle={() => setOpen((o) => ({ ...o, recommendations: !o.recommendations }))}
			>
				<RecommendationsSection items={state.recommendations} />
			</Section>
		</aside>
	);
}

function Section({
	title,
	open,
	onToggle,
	children,
}: {
	title: string;
	open: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	return (
		<section className="border-t">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between px-3 py-2 font-medium text-muted-foreground text-xs uppercase hover:bg-muted/40"
			>
				<span>{title}</span>
				<span aria-hidden>{open ? '▾' : '▸'}</span>
			</button>
			{open && <div>{children}</div>}
		</section>
	);
}

function FrameworkSection({ detection }: { detection: LiveDetection | null }) {
	if (!detection) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Aguardando primeira detecção do probe…
			</p>
		);
	}
	const fp = detection.fingerprint;
	return (
		<div className="space-y-1.5 px-3 py-2">
			<div className="flex flex-wrap items-center gap-1.5">
				<Badge variant="default" className="text-xs">
					{fp.framework.name}
					{fp.framework.version ? ` ${fp.framework.version}` : ''}
				</Badge>
				{fp.libraries.map((l) => (
					<Badge key={`lib-${l.name}`} variant="secondary" className="text-xs">
						{l.name}
						{l.version ? ` ${l.version}` : ''}
						{l.confidence !== 'high' ? ` (${l.confidence})` : ''}
					</Badge>
				))}
				{fp.httpClients.map((c) => (
					<Badge key={`http-${c.name}`} variant="secondary" className="text-xs">
						{c.name}
						{c.confidence !== 'high' ? ` (${c.confidence})` : ''}
					</Badge>
				))}
				{fp.dataFetching.map((d) => (
					<Badge
						key={`data-${d.name}`}
						variant={d.treatment === 'tracked' ? 'secondary' : 'outline'}
						className="text-xs"
					>
						{d.name}
						{d.version ? ` ${d.version}` : ''}
						{d.treatment === 'detection-only' ? ' · detect-only' : ''}
					</Badge>
				))}
				{fp.stateManagers.map((s) => (
					<Badge key={`state-${s.name}`} variant="secondary" className="text-xs">
						{s.name}
						{s.storesDetected > 0 ? ` ×${s.storesDetected}` : ''}
					</Badge>
				))}
			</div>
			<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
				{detection.url}
			</p>
		</div>
	);
}

function RecommendationsSection({ items }: { items: Recommendation[] }) {
	if (items.length === 0) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Nenhuma recomendação até agora. Carregue recursos da página para acionar regras.
			</p>
		);
	}
	return (
		<div>
			{items.map((r) => (
				<RecommendationRow key={r.id} item={r} />
			))}
		</div>
	);
}
```

- [ ] **Step 2: Run typecheck** (will fail until G3 creates `RecommendationRow`)

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

Expected: error pointing to missing `./RecommendationRow`.

- [ ] **Step 3: Do not commit yet** — bundled with G3.

---

### Task G3: `RecommendationRow` component

**Files:**
- Create: `app/src/components/replay/RecommendationRow.tsx`

- [ ] **Step 1: Create**

```typescript
import { useState } from 'react';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';

const SEVERITY_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'border-l-destructive bg-destructive/5',
	warn: 'border-l-warning bg-warning/5',
	info: 'border-l-info bg-info/5',
};

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
	error: 'erro',
	warn: 'aviso',
	info: 'info',
};

export function RecommendationRow({ item }: { item: Recommendation }) {
	const [open, setOpen] = useState(false);
	return (
		<button
			type="button"
			onClick={() => setOpen((o) => !o)}
			className={`flex w-full flex-col items-start gap-1 border-l-2 border-b px-3 py-2 text-left text-xs hover:bg-muted/40 ${SEVERITY_CLASSES[item.severity]} animate-in fade-in-0 slide-in-from-right-1 duration-200`}
		>
			<div className="flex w-full items-center gap-2">
				<span className="font-medium uppercase text-[10px]">{SEVERITY_LABEL[item.severity]}</span>
				<span className="font-medium">{item.ruleId}</span>
				<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
					{item.host}
				</span>
			</div>
			<p className="font-mono text-[11px] text-muted-foreground">{item.summary}</p>
			{open && (
				<div className="mt-1 w-full space-y-1 rounded bg-background p-2">
					{Object.entries(item.evidence).map(([k, v]) => (
						<div key={k} className="grid grid-cols-[max-content_1fr] gap-2 font-mono text-[11px]">
							<span className="text-muted-foreground">{k}:</span>
							<span className="break-all">{v}</span>
						</div>
					))}
					{item.suggestion && (
						<p className="border-t pt-1 text-[11px]">{item.suggestion}</p>
					)}
				</div>
			)}
		</button>
	);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

Note: there will still be errors at the `liveAntipatternHit` removal sites in `LiveAntipatternsPanel.tsx`. Those are addressed in I1. Verify the new files (`LiveInsightsPanel.tsx`, `RecommendationRow.tsx`) themselves compile cleanly.

- [ ] **Step 3: Commit (bundle G2 + G3 together)**

```bash
git add app/src/components/replay/LiveInsightsPanel.tsx app/src/components/replay/RecommendationRow.tsx
git commit -m "feat(replay): LiveInsightsPanel substitui LiveAntipatternsPanel (3 seções)

Painel passivo agora mostra Framework & Libraries, Estado ao vivo
(StateInspector reusado em modo liveSnapshot), e Recomendações.
RecommendationRow expandível com evidence e suggestion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task G4: Layout integra `LiveInsightsPanel`

**Files:**
- Modify: `app/src/pages/Layout.tsx`

- [ ] **Step 1: Swap import + JSX**

Edit `app/src/pages/Layout.tsx`:

```typescript
// import line:
import { LiveInsightsPanel } from '@/components/replay/LiveInsightsPanel';

// JSX (where LiveAntipatternsPanel was rendered):
<LiveInsightsPanel tabId={passiveTabId} />
```

Remove the old `LiveAntipatternsPanel` import.

- [ ] **Step 2: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: PASS modulo the cleanup tasks ahead.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/Layout.tsx
git commit -m "refactor(layout): swap LiveAntipatternsPanel por LiveInsightsPanel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase H — Replay UI (recommendations tab)

### Task H1: `RecommendationsTab` substitui `AntipatternsTab`

**Files:**
- Create: `app/src/components/replay/RecommendationsTab.tsx`

- [ ] **Step 1: Create**

```typescript
import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';
import { RecommendationRow } from './RecommendationRow';

interface Props {
	items: Recommendation[];
}

const SEVERITIES: RecommendationSeverity[] = ['error', 'warn', 'info'];

export function RecommendationsTab({ items }: Props) {
	const [enabled, setEnabled] = useState<Record<RecommendationSeverity, boolean>>({
		error: true,
		warn: true,
		info: true,
	});

	const filtered = useMemo(() => items.filter((h) => enabled[h.severity]), [items, enabled]);

	return (
		<div className="flex h-full flex-col gap-2">
			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Severity:</span>
				{SEVERITIES.map((s) => (
					<label key={s} htmlFor={`rec-${s}`} className="flex items-center gap-1">
						<Checkbox
							id={`rec-${s}`}
							checked={enabled[s]}
							onCheckedChange={(v) => setEnabled((p) => ({ ...p, [s]: v === true }))}
						/>
						{s}
					</label>
				))}
				<span className="ml-auto text-muted-foreground">
					{filtered.length} / {items.length}
				</span>
			</div>

			<div className="overflow-auto rounded border">
				{filtered.length === 0 ? (
					<p className="p-3 text-muted-foreground text-sm">
						Nenhuma recomendação{items.length > 0 ? ' com os filtros atuais' : ''}.
					</p>
				) : (
					filtered.map((h) => <RecommendationRow key={h.id} item={h} />)
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Find and update the consumer (replay page)**

```bash
cd app && grep -rn "AntipatternsTab" src/components src/pages
```

For each match, replace with `RecommendationsTab` and change the prop name from `hits` to `items`. The data source changes from `session.antipatternHits ?? []` to `session.recommendations ?? []`.

- [ ] **Step 3: Run typecheck**

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/replay/RecommendationsTab.tsx
# Plus the consumer files updated in Step 2
git add app/src/pages/ReplayPage.tsx  # or wherever AntipatternsTab was consumed
git commit -m "feat(replay): RecommendationsTab substitui AntipatternsTab no replay

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task H2: `PhaseList` mostra badges de `libraries`

**Files:**
- Modify: `app/src/components/replay/PhaseList.tsx`

- [ ] **Step 1: Add libraries map**

Edit `app/src/components/replay/PhaseList.tsx`. Within each phase row JSX (after the `dataFetching` map), add:

```tsx
{p.fingerprint.libraries.length > 0 && (
	<div className="mt-1 flex flex-wrap gap-1">
		{p.fingerprint.libraries.map((lib) => (
			<span key={lib.name} className="rounded bg-slate-100 px-1 text-[10px]">
				{lib.name}
				{lib.version ? ` ${lib.version}` : ''}
			</span>
		))}
	</div>
)}
```

- [ ] **Step 2: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/replay/PhaseList.tsx
git commit -m "feat(replay): PhaseList mostra badges de libraries

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase I — Cleanup

### Task I1: Apagar antipattern engine + componentes

**Files:**
- Delete: `app/src/lib/session/antipattern/` (recursive)
- Delete: `app/src/components/replay/AntipatternHitRow.tsx`
- Delete: `app/src/components/replay/AntipatternsTab.tsx`
- Delete: `app/src/components/replay/LiveAntipatternsPanel.tsx`
- Delete: `app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx`
- Delete: `app/src/lib/session/__tests__/recorder.antipattern.test.ts`

- [ ] **Step 1: Run the deletions**

```bash
rm -rf app/src/lib/session/antipattern
rm app/src/components/replay/AntipatternHitRow.tsx
rm app/src/components/replay/AntipatternsTab.tsx
rm app/src/components/replay/LiveAntipatternsPanel.tsx
rm app/src/components/replay/__tests__/LiveAntipatternsPanel.test.tsx
rm app/src/lib/session/__tests__/recorder.antipattern.test.ts
```

- [ ] **Step 2: Remove orphan imports / methods in `recorder.ts`**

Edit `app/src/lib/session/recorder.ts`:

- Remove `import { AntipatternEngine } from './antipattern/engine';`
- Remove `import type { AntipatternHit, ...` — keep other items, drop `AntipatternHit`.
- Remove the local `sessionEngines` and `tabEngines` maps and references.
- Remove methods: `addAntipatternHit`, `pushNetworkForAntipatterns`, `getOrCreatePassiveEngineForTab`, `clearPassiveEngineForTab`.
- Remove their references in `_resetEnginesForTests`, `stopSession`, `_resetLimitsForTests`.

- [ ] **Step 3: Remove orphan references in `background.ts`**

```bash
cd app && grep -n "AntipatternEngine\|AntipatternHit\|antipattern\|liveAntipatternHit\|getOrCreatePassiveEngineForTab\|pushNetworkForAntipatterns\|addAntipatternHit\|clearPassiveEngineForTab" src/entrypoints/background.ts
```

For each match, remove it. Most will be in:
- the `Fetch.requestPaused` handler (calls to `pushNetworkForAntipatterns`)
- the `liveAntipatternHit` broadcast block
- the passive-tab engine setup/teardown in `startDebugging`/`stopDebugging`/`tabs.onRemoved`

- [ ] **Step 4: Update `messages.ts` imports (already done in F1 but verify)**

```bash
cd app && grep -n "AntipatternHit" src/types/messages.ts
```

Expected: no matches.

- [ ] **Step 5: Run typecheck + lint + tests**

```bash
cd app && npx tsc --noEmit && npm run lint && npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove antipattern engine e UI relacionada

Substituídos por engine de Recomendações (Phase D-G). Sessions
exportadas com antipatternHits continuam abrindo (campo opcional
ignorado no viewer).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task I2: Remover tipos `AntipatternHit/Severity/Id` e campo `Session.antipatternHits`

**Files:**
- Modify: `app/src/lib/session/types.ts`

- [ ] **Step 1: Delete the three types and the field**

In `app/src/lib/session/types.ts`:

- Delete the `AntipatternSeverity` type alias.
- Delete the `AntipatternId` type alias.
- Delete the `AntipatternHit` interface.
- In the `Session` interface, delete the `antipatternHits?: AntipatternHit[];` line.

- [ ] **Step 2: Run typecheck**

```bash
cd app && npx tsc --noEmit
```

Expected: PASS. Importers still pass since I1 already removed all references.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/session/types.ts
git commit -m "refactor(types): remove AntipatternHit/Severity/Id e Session.antipatternHits

Sessões exportadas com o campo continuam compatíveis (campo opcional
em JSON; importer não rejeita propriedades extras).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task I3: `viewerTemplate.ts` renderiza `recommendations` (remove antipatterns)

**Files:**
- Modify: `app/src/lib/session/viewerTemplate.ts`

- [ ] **Step 1: Find the antipatterns rendering block**

Open `app/src/lib/session/viewerTemplate.ts`. Search for any block emitting markup from `session.antipatternHits`. There may be:
- A tab/section literal in the HTML template string.
- A loop iterating over hits.

- [ ] **Step 2: Replace with `recommendations` rendering**

Replace the block with markup iterating `session.recommendations ?? []`. Each entry shows `severity`, `ruleId`, `host`, `summary`, and an expandable evidence/suggestion. Use inline styles (the viewer is a static `.html` artifact — no Tailwind). Example skeleton:

```javascript
const recsHtml = (session.recommendations ?? [])
	.map(
		(r) => `
		<details class="rec rec-${r.severity}">
			<summary>
				<span class="sev">${r.severity.toUpperCase()}</span>
				<span class="rule">${r.ruleId}</span>
				<span class="host">${r.host}</span>
			</summary>
			<p class="summary">${r.summary}</p>
			<table class="evidence">
				${Object.entries(r.evidence)
					.map(([k, v]) => `<tr><th>${k}</th><td>${escape(v)}</td></tr>`)
					.join('')}
			</table>
			${r.suggestion ? `<p class="suggestion">${escape(r.suggestion)}</p>` : ''}
		</details>`,
	)
	.join('');
```

(Adapt to the existing template structure — keep the `escape()` helper if it already exists, otherwise add a tiny one.)

- [ ] **Step 3: Run viewer tests**

```bash
cd app && npx vitest run src/lib/session/__tests__/viewerTemplate
```

Expected: PASS. If a snapshot test references "Antipatterns", update the snapshot.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/session/viewerTemplate.ts app/src/lib/session/__tests__/viewerTemplate-rrweb.test.ts
git commit -m "refactor(viewer): renderiza recommendations (remove antipatterns block)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase J — E2E

### Task J1: Caso E2E para Live Insights em modo passivo

**Files:**
- Create: `app/e2e/fixtures/passive-insights/index.html`
- Create: `app/e2e/fixtures/passive-insights/jquery-3.7.0.min.js`
- Create: `app/e2e/passive-insights.spec.ts`

- [ ] **Step 1: Provision the fixture HTML**

Create `app/e2e/fixtures/passive-insights/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
	<head>
		<meta charset="utf-8" />
		<title>Passive Insights Fixture</title>
		<script src="/passive-insights/jquery-3.7.0.min.js"></script>
	</head>
	<body>
		<div id="root"></div>
		<button id="trigger">Carregar</button>
		<script>
			// Mark React-like for detector via fiber container
			const root = document.getElementById('root');
			Object.defineProperty(root, '__reactContainer$abc', {
				value: { stateNode: {} },
				enumerable: true,
			});

			document.getElementById('trigger').addEventListener('click', () => {
				fetch('/passive-insights/api/products', { method: 'GET' });
			});
		</script>
	</body>
</html>
```

- [ ] **Step 2: Vendor jQuery offline**

```bash
mkdir -p app/e2e/fixtures/passive-insights
curl -L https://code.jquery.com/jquery-3.7.0.min.js -o app/e2e/fixtures/passive-insights/jquery-3.7.0.min.js
```

- [ ] **Step 3: Update fixture server to serve `/passive-insights/*` and `/passive-insights/api/products` without `Content-Encoding`**

Edit `app/e2e/fixture-server.ts` (or whichever file boots the Express server). Add:

```typescript
app.use('/passive-insights', express.static(path.join(__dirname, 'fixtures/passive-insights')));
app.get('/passive-insights/api/products', (_req, res) => {
	const body = JSON.stringify({ products: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `P${i}` })) });
	res.set('content-type', 'application/json');
	res.set('content-length', String(body.length));
	// Deliberately no Content-Encoding to trigger compression-missing
	res.send(body);
});
```

- [ ] **Step 4: Write the spec**

Create `app/e2e/passive-insights.spec.ts`:

```typescript
import { expect, test } from './fixtures/extension';

test('Live Insights em modo passivo mostra framework, jquery e recomendação', async ({
	context,
	extensionId,
}) => {
	// 1. Navega na fixture
	const target = await context.newPage();
	await target.goto('http://localhost:3100/passive-insights/');

	// 2. Abre a UI da extensão (options page) e ativa interceptação
	const options = await context.newPage();
	await options.goto(`chrome-extension://${extensionId}/options.html`);
	// Selecionar a tab da fixture (ajustar seletores conforme SelectTabDialog)
	await options.click('text=Selecionar aba');
	await options.click('text=Passive Insights Fixture');
	await options.click('text=Iniciar interceptação');

	// 3. Garantir que NÃO está gravando
	const recordingSwitch = options.locator('[role="switch"][aria-label*="ravação"]');
	if (await recordingSwitch.isChecked()) {
		await recordingSwitch.click();
	}

	// 4. Disparar request na fixture
	await target.click('#trigger');

	// 5. Esperar painel passivo (LiveInsightsPanel)
	const panel = options.locator('aside[aria-label="Live Insights"]');
	await expect(panel).toBeVisible({ timeout: 5000 });

	// 6. Badges de framework + jquery
	await expect(panel.getByText(/react/i)).toBeVisible();
	await expect(panel.getByText(/jquery 3.7/i)).toBeVisible();

	// 7. Recomendação compression-missing
	await expect(panel.getByText('compression-missing')).toBeVisible();

	// 8. Screenshot evidência
	await panel.screenshot({ path: 'app/e2e/evidence/live-insights-passive.png' });
});
```

(Adjust `fixtures/extension` and selectors to match the existing E2E harness.)

- [ ] **Step 5: Run**

```bash
cd app && npm run build && npm run e2e -- passive-insights
```

Expected: PASS. If selectors don't match the actual UI, adjust them.

- [ ] **Step 6: Commit**

```bash
git add app/e2e/fixtures/passive-insights app/e2e/passive-insights.spec.ts app/e2e/fixture-server.ts
git commit -m "test(e2e): live insights em passivo (react+jquery+compression-missing)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase K — Beads & verificação final

### Task K1: Fechar bead `c49`

- [ ] **Step 1: Close**

```bash
bd close chrome-extension-debug-buddy-c49 --reason="feature substituída por engine de Recomendações (épico <EPIC_ID>)"
```

- [ ] **Step 2: Push beads**

```bash
bd dolt push
```

---

### Task K2: Verificação final do epic

- [ ] **Step 1: Run full quality gate**

```bash
cd app && npm run lint && npx tsc --noEmit && npm test
```

Expected: ALL PASS.

- [ ] **Step 2: Build the extension and load it in Chrome**

```bash
cd app && npm run build
```

Manual smoke: `chrome://extensions` → recarregar Debug Buddy → abrir options → ativar interceptação numa aba real (sem gravar) → confirmar painel `Live Insights` aparece e exibe framework + libs + recomendações conforme requests da página.

- [ ] **Step 3: Close epic**

```bash
bd close <EPIC_ID> --reason="implementação completa; ver commit log feature/session-replay"
bd dolt push
```

- [ ] **Step 4: Final commit if needed**

If anything was uncommitted (lockfile churn, etc.):

```bash
git add -A
git commit -m "chore: sync beads do epic Insights & Recommendations

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Plan self-review checklist

Run these checks before handing the plan to the executor:

- [ ] **Spec coverage:** every section in the spec maps to at least one task above (§1→A1+A2+A3+B+C; §2→A1; §3→B; §4→C+G1+G2; §5→D+E; §6→G; §7→F; §8→I; §9→D tests + J; §10→implicitly via design; §11→non-goals don't need tasks; §12→this plan; §13→A3 negative test, dedup test).
- [ ] **No placeholders:** plan contains no "TBD", "TODO", "fill in details".
- [ ] **Type consistency:** `Recommendation`, `RuleDescriptor`, `NetworkRuleEvent`, `LiveStateSnapshot`, `LibraryDetection` are defined in exactly one place each and reused everywhere.
- [ ] **Commits:** every implementation step has an accompanying commit step. The only intentional "no commit" point is between F1 and I1 (build deliberately broken during cleanup).

---

## Notes for the executor

- `<EPIC_ID>` is the bead id created in Task 0; substitute throughout.
- If a test step shows code that depends on imports not yet added, add the import as part of that step — every code block must compile after step 3 of each task.
- The plan assumes you're on `feature/session-replay`. If you're not, **stop** and ask the user before continuing — branching mid-epic loses checkpoint history.
