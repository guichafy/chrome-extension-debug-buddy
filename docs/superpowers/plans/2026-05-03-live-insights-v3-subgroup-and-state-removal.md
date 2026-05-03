# Live Insights v3 — Sub-agrupamento + State Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** (a) Sub-agrupar recomendações por `ruleId` dentro de cada categoria com `<details>` collapsed por default; (b) remover toda a feature de state detection (probe taps, recorder methods, types, UI, viewer rendering, mensagens) preservando `angularHttpTap`, `detectAngular fallback`, recommendations engine e live snapshot cache (sem field `state`).

**Architecture:** Phase 1 (`Group A`) muda apenas UI de recomendações — escopo curto, baixo risco. Phase 2 (`Group B`) é remoção em cascata: types → probe → recorder → background → UI → tests. TS strict captura imports orfãos automaticamente.

**Tech Stack:** TypeScript strict, React 19, Tailwind v4, shadcn UI, Vitest, jsdom.

**Spec source:** [docs/superpowers/specs/2026-05-03-live-insights-v3-subgroup-and-state-removal-design.md](docs/superpowers/specs/2026-05-03-live-insights-v3-subgroup-and-state-removal-design.md)

---

## Pre-flight

### Task 0: Bead + baseline

- [ ] **Step 1: Sync + branch check**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && git status
```

Expected: on `feature/session-replay`, clean tree (or only `.beads/`).

- [ ] **Step 2: Create bead**

```bash
bd create \
  --title="Live Insights v3: sub-agrupamento + remoção de state detection" \
  --description="Implementa spec docs/superpowers/specs/2026-05-03-live-insights-v3-subgroup-and-state-removal-design.md. (a) Sub-agrupa recomendações por ruleId; (b) remove state detection completa (probe taps, recorder.addStateChange, types, UI section, mensagens, viewer)." \
  --type=task \
  --priority=2
```

Note the returned id (`<EPIC_ID>`).

- [ ] **Step 3: Claim**

```bash
bd update <EPIC_ID> --claim
```

- [ ] **Step 4: Baseline**

```bash
cd app && npm run lint && npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: clean, ~1162 tests passing.

---

## Group A — Sub-agrupamento (UI only)

### Task A1: Extrair `ExpandedDetails` em `RecommendationRow`

**File:** Modify `app/src/components/replay/RecommendationRow.tsx`

- [ ] **Step 1: Read current file**

```bash
cat /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/components/replay/RecommendationRow.tsx
```

- [ ] **Step 2: Replace with new structure (full + compact mode + extracted ExpandedDetails)**

Overwrite `app/src/components/replay/RecommendationRow.tsx`:

```typescript
import { useState } from 'react';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';

const SEVERITY_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'border-l-red-500 bg-red-50 dark:bg-red-950/30',
	warn: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
	info: 'border-l-sky-500 bg-sky-50 dark:bg-sky-950/30',
};

const SEVERITY_LABEL_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'text-red-700 dark:text-red-400',
	warn: 'text-amber-700 dark:text-amber-400',
	info: 'text-sky-700 dark:text-sky-400',
};

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
	error: 'ERRO',
	warn: 'AVISO',
	info: 'INFO',
};

export const RECOMMENDATION_ROW_TOKENS = {
	classes: SEVERITY_CLASSES,
	labelClasses: SEVERITY_LABEL_CLASSES,
	label: SEVERITY_LABEL,
};

function ExpandedDetails({ item }: { item: Recommendation }) {
	return (
		<div className="mt-1 w-full space-y-1 rounded bg-background p-2">
			{Object.entries(item.evidence).map(([k, v]) => (
				<div key={k} className="grid grid-cols-[max-content_1fr] gap-2 font-mono text-[11px]">
					<span className="text-muted-foreground">{k}:</span>
					<span className="break-all">{v}</span>
				</div>
			))}
			{item.suggestion && <p className="border-t pt-1 text-[11px]">{item.suggestion}</p>}
		</div>
	);
}

interface Props {
	item: Recommendation;
	compact?: boolean;
}

export function RecommendationRow({ item, compact = false }: Props) {
	const [open, setOpen] = useState(false);

	if (compact) {
		const pathname = (() => {
			try {
				return new URL(item.url).pathname;
			} catch {
				return item.url;
			}
		})();
		return (
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full flex-col items-start gap-1 border-b px-4 py-1.5 text-left text-xs hover:bg-muted/40"
			>
				<div className="flex w-full items-center gap-2">
					<span className="break-all font-mono">{pathname}</span>
					<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
						{item.host}
					</span>
				</div>
				{open && <ExpandedDetails item={item} />}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setOpen((o) => !o)}
			className={`flex w-full flex-col items-start gap-1 border-b border-l-2 px-3 py-2 text-left text-xs hover:bg-muted/40 ${SEVERITY_CLASSES[item.severity]} animate-in fade-in-0 slide-in-from-right-1 duration-200`}
		>
			<div className="flex w-full items-center gap-2">
				<span className={`font-semibold text-[10px] ${SEVERITY_LABEL_CLASSES[item.severity]}`}>
					{SEVERITY_LABEL[item.severity]}
				</span>
				<span className="font-medium">{item.ruleId}</span>
				<span className="ml-auto font-mono text-muted-foreground" title={item.url}>
					{item.host}
				</span>
			</div>
			<p className="font-mono text-[11px] text-muted-foreground">{item.summary}</p>
			{open && <ExpandedDetails item={item} />}
		</button>
	);
}
```

Key changes vs current:
- New `compact` prop (default `false`).
- Compact mode renders only `pathname` + `host` (no severity badge, no border-left).
- `ExpandedDetails` extracted as private component (reused in both modes).
- Exports `RECOMMENDATION_ROW_TOKENS` so `LiveInsightsPanel`'s `RuleGroup` can reuse the same severity colors/labels.

- [ ] **Step 3: Verify**

```bash
cd app && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/replay/RecommendationRow.tsx
git commit -m "$(cat <<'EOF'
refactor(insights): recommendationrow ganha modo compact + tokens exportados

Compact mode renderiza só path + host (severity vai no header do
sub-grupo). ExpandedDetails extraído como subcomponente reusado.
RECOMMENDATION_ROW_TOKENS exportado para reuso em RuleGroup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A2: Sub-agrupar recomendações em `LiveInsightsPanel`

**File:** Modify `app/src/components/replay/LiveInsightsPanel.tsx`

- [ ] **Step 1: Read current `RecommendationsSection`**

```bash
grep -n "RecommendationsSection\|RuleGroup" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/components/replay/LiveInsightsPanel.tsx
```

- [ ] **Step 2: Replace `RecommendationsSection` body and add `RuleGroup` helper**

Locate `RecommendationsSection` in the file and replace its entire body. Add `RuleGroup` helper just below it (or above — match file style).

```typescript
import { RECOMMENDATION_ROW_TOKENS, RecommendationRow } from './RecommendationRow';
import type { RecommendationRuleId } from '@/lib/session/types';

function RecommendationsSection({ items }: { items: Recommendation[] }) {
	if (items.length === 0) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-xs">
				Nenhuma recomendação até agora. Carregue recursos da página para acionar regras.
			</p>
		);
	}

	const grouped: Record<RecommendationCategory, Recommendation[]> = {
		security: [],
		performance: [],
	};
	for (const r of items) {
		const cat = RULE_CATEGORIES[r.ruleId];
		if (cat) grouped[cat].push(r);
	}

	return (
		<div>
			{CATEGORY_ORDER.map((cat) =>
				grouped[cat].length === 0 ? null : (
					<details key={cat} open className="border-b last:border-b-0">
						<summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider hover:bg-muted/40">
							{CATEGORY_LABEL[cat]} ({grouped[cat].length})
						</summary>
						<RuleGroups items={grouped[cat]} />
					</details>
				),
			)}
		</div>
	);
}

function RuleGroups({ items }: { items: Recommendation[] }) {
	const byRule = new Map<RecommendationRuleId, Recommendation[]>();
	for (const r of items) {
		const arr = byRule.get(r.ruleId) ?? [];
		arr.push(r);
		byRule.set(r.ruleId, arr);
	}

	return (
		<div>
			{[...byRule.entries()].map(([ruleId, instances]) => (
				<RuleGroup key={ruleId} ruleId={ruleId} instances={instances} />
			))}
		</div>
	);
}

function RuleGroup({
	ruleId,
	instances,
}: {
	ruleId: RecommendationRuleId;
	instances: Recommendation[];
}) {
	const severity = instances[0].severity;
	const borderClass = RECOMMENDATION_ROW_TOKENS.classes[severity].split(' ')[0]; // e.g. 'border-l-red-500'
	const labelClass = RECOMMENDATION_ROW_TOKENS.labelClasses[severity];
	const label = RECOMMENDATION_ROW_TOKENS.label[severity];

	return (
		<details className="border-t first:border-t-0">
			<summary
				className={`flex cursor-pointer select-none items-center gap-2 border-l-2 px-4 py-1.5 text-xs hover:bg-muted/40 ${borderClass}`}
			>
				<span className={`font-semibold text-[10px] ${labelClass}`}>{label}</span>
				<span className="font-medium">{ruleId}</span>
				<span className="ml-auto text-muted-foreground">({instances.length})</span>
			</summary>
			<div>
				{instances.map((r) => (
					<RecommendationRow key={r.id} item={r} compact />
				))}
			</div>
		</details>
	);
}
```

- [ ] **Step 3: Verify**

```bash
cd app && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Run tests**

```bash
cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -30
```

Some existing tests may need updates (e.g., a test asserting that all `csp-missing` instances render side by side with severity label might now find the label only in the group header). Update assertions to match the new structure. **Tests added in Group B's task A3 will cover the new shape.**

- [ ] **Step 5: Commit**

```bash
git add app/src/components/replay/LiveInsightsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(insights): sub-agrupa recomendações por ruleid dentro de categoria

Cada categoria <details open> contém um <details> collapsed por
ruleId. Header do sub-grupo mostra severity label + ruleId + count.
Instâncias usam RecommendationRow compact (só path + host).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A3: Atualizar/adicionar testes do `LiveInsightsPanel`

**File:** Modify `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx`

- [ ] **Step 1: Read current tests**

```bash
cat /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx
```

- [ ] **Step 2: Update tests broken by Group A**

Some existing tests:
- `agrupa recomendações em Segurança / Performance com counters` — still works (queries category counters).
- `omite categoria de recomendações com 0 hits` — still works.
- `hidrata painel via getLiveSnapshot ao montar` — adjust if it expects severity label visible without expanding the group.

If a test queries for "ERRO" or "AVISO" labels via `getByText`, the labels are now inside `<details>` (collapsed by default) — not visible without expanding the group. Adjust expectations or expand the group programmatically (`fireEvent.click(screen.getByText('csp-missing'))`).

- [ ] **Step 3: Add tests for sub-grouping**

Append to the test file:

```typescript
test('agrupa instâncias da mesma rule sob um sub-grupo (ruleId × N)', async () => {
	render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
	await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

	deliverMessage({
		action: 'liveRecommendation',
		tabId: 1,
		recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error', host: 'a.com' }),
	});
	deliverMessage({
		action: 'liveRecommendation',
		tabId: 1,
		recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error', host: 'b.com' }),
	});
	deliverMessage({
		action: 'liveRecommendation',
		tabId: 1,
		recommendation: makeRec({ ruleId: 'hsts-missing', severity: 'error' }),
	});

	// Header da categoria Segurança aparece com 3 hits
	expect(await screen.findByText(/Segurança \(3\)/)).toBeInTheDocument();
	// Sub-grupo csp-missing existe com count 2
	expect(screen.getByText('csp-missing')).toBeInTheDocument();
	expect(screen.getByText(/^\(2\)$/)).toBeInTheDocument();
	// Sub-grupo hsts-missing existe com count 1
	expect(screen.getByText('hsts-missing')).toBeInTheDocument();
});

test('grupos de regras começam collapsed (instâncias não visíveis até expandir)', async () => {
	render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
	await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

	deliverMessage({
		action: 'liveRecommendation',
		tabId: 1,
		recommendation: makeRec({
			ruleId: 'csp-missing',
			severity: 'error',
			url: 'https://x.com/api/users',
			host: 'x.com',
		}),
	});

	await screen.findByText('csp-missing');
	// Path da instância NÃO aparece (grupo collapsed)
	expect(screen.queryByText('/api/users')).not.toBeInTheDocument();
});
```

If the helpers `messageListeners` and `deliverMessage` aren't already in the test file (from Phase v2), look for the existing pattern and reuse.

- [ ] **Step 4: Run tests**

```bash
cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -20
```

Iterate until all pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx
git commit -m "$(cat <<'EOF'
test(insights): cobertura para sub-agrupamento por ruleid

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Group B — Remoção de state detection

### Task B1: Remover types e fingerprint de state

**Files:**
- Modify: `app/src/lib/session/types.ts`
- Modify: `app/src/lib/session/fingerprint.ts`

This task triggers cascading TS errors throughout the codebase that subsequent tasks will resolve.

- [ ] **Step 1: Edit `types.ts`**

Remove the following from `app/src/lib/session/types.ts`:

```typescript
// DELETE these:
export type StoreKind = 'redux' | 'zustand' | 'angular-signal' | 'ngrx';

export interface StateSnapshot { /* ... */ }
export interface StateKeyframe { /* ... */ }
export interface StateManagerDetection { /* ... */ }
```

In `EnvironmentFingerprint`, remove the line:
```typescript
stateManagers: StateManagerDetection[];
```

In `DetectionPhase`, remove:
```typescript
stateBaseline?: Record<string, StateSnapshot>;
stateKeyframes?: StateKeyframe[];
```

In the `SessionEvent` union, remove the variant:
```typescript
| {
		type: 'state';
		timestamp: number;
		phaseId: string;
		storeId: string;
		storeKind: StoreKind;
		diffCompressed: string;
		sequenceNum: number;
  }
```

- [ ] **Step 2: Edit `fingerprint.ts`**

Remove the `sameSet(a.stateManagers, ...)` line from `fingerprintsEqual`. Add a comment if needed: `// state detection removida em Live Insights v3`.

- [ ] **Step 3: Edit `__tests__/fingerprint.test.ts`**

Find tests that build `EnvironmentFingerprint` literals — remove `stateManagers: []` from each. Remove any test specifically about `stateManagers` comparison.

- [ ] **Step 4: Don't commit yet — many other files now have TS errors. Continue with Task B2.**

### Task B2: Apagar arquivos de state (probe + lib)

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
rm -f app/src/probe/state/reduxTap.ts
rm -f app/src/probe/state/zustandTap.ts
rm -f app/src/probe/state/angularSignalTap.ts
rm -f app/src/probe/state/ngrxTap.ts
rm -rf app/src/probe/state/__tests__/reduxTap.test.ts
rm -rf app/src/probe/state/__tests__/zustandTap.test.ts
rm -rf app/src/probe/state/__tests__/angularSignalTap.test.ts
rm -rf app/src/probe/state/__tests__/ngrxTap.test.ts
rm -f app/src/probe/detectors/stateManagers.ts
rm -f app/src/probe/detectors/__tests__/stateManagers.test.ts
rm -rf app/src/lib/session/state
rm -f app/src/components/replay/StateInspector.tsx
rm -f app/src/components/replay/__tests__/StateInspector.test.tsx
rm -f app/src/lib/session/__tests__/recorder.state.test.ts
rm -f app/src/lib/session/__tests__/recorder.state.angular.test.ts
```

(Some files may not exist — `rm -f` is idempotent.)

Confirm `app/src/probe/state/angularHttpTap.ts` is **NOT** deleted:

```bash
ls /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/probe/state/
```

Expected: `angularHttpTap.ts` present (and possibly its test).

### Task B3: Limpar `probe/main.ts`, `probe/protocol.ts`, `probe/bridge.ts`

**Files:**
- Modify: `app/src/probe/main.ts`
- Modify: `app/src/probe/protocol.ts`
- Modify: `app/src/probe/bridge.ts`

#### `probe/main.ts`

Remove imports:
```typescript
import { installAngularSignalTap } from './state/angularSignalTap';
import { installNgRxTap } from './state/ngrxTap';
import { installReduxTap } from './state/reduxTap';
import { installZustandTap } from './state/zustandTap';
import { detectStateManagers } from './detectors/stateManagers';
```

Keep:
```typescript
import { installAngularHttpTap } from './state/angularHttpTap';
```

In the `probe:start-detection` handler, remove these calls:
```typescript
installReduxTap();
installZustandTap();
installAngularSignalTap();
installNgRxTap();
```

Keep `installAngularHttpTap();`.

In `buildFingerprint`, remove the line:
```typescript
stateManagers: detectStateManagers(),
```

#### `probe/protocol.ts`

Remove:
- The `'probe:state-change'` variant from `ProbeMessage` union.
- The interface `ProbeStateChangePayload`.

#### `probe/bridge.ts`

Remove the branch that handles `'probe:state-change'` (relays as `'stateChange'`). Keep all other branches (`'probe:detection'`, `'probe:angular-http-tag'`).

### Task B4: Limpar `recorder.ts`

**File:** Modify `app/src/lib/session/recorder.ts`

Remove:
- `import { compressDiff, compressSnapshot, computeDiff } from './state/diff';`
- `StoreKind`, `StateKeyframe` from the existing `import type { ... } from './types';` line.
- `interface StoreRuntime` and `interface SessionStateRuntime`.
- Constants `DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS`, `DEFAULT_STATE_KEYFRAME_EVERY_T_MS`.
- Module-scoped variables `stateKeyframeEveryN`, `stateKeyframeEveryT`.
- Module-scoped `const stateRuntime = new Map<...>();`.
- Function `stateRuntimeFor(...)`.
- Interface `StateChangePayload`.
- Method `addStateChange`.
- Methods `_setStateLimitsForTests`, `_resetStateLimitsForTests`.
- In `stopSession`: line `stateRuntime.delete(id);`.
- In `_resetEnginesForTests` / `_resetLimitsForTests`: lines that reference `stateRuntime`.

Keep all other recorder methods/state intact.

### Task B5: Limpar `messages.ts`

**File:** Modify `app/src/types/messages.ts`

Remove from `MessageAction` union:
- `'stateChange'`
- `'liveStateChange'`

Remove from the `Message` interface:
- `statePayload?: ProbeStateChangePayload;`

Remove the import:
```typescript
import type { ProbeStateChangePayload } from '@/probe/protocol';
```

### Task B6: Limpar `background.ts`

**File:** Modify `app/src/entrypoints/background.ts`

Remove imports of `ProbeStateChangePayload`, `StoreKind` (any place that imports just for `state` types).

Remove:
- `interface LiveStateEntry`.
- Field `state: Record<string, LiveStateEntry>` from `interface LiveSnapshot`.
- Function `applyLiveStateChange`.
- The entire `if (message.action === 'stateChange')` handler block.

In `getOrInitLiveSnapshot`:
```typescript
function getOrInitLiveSnapshot(tabId: number): LiveSnapshot {
	let snap = liveSnapshotByTab.get(tabId);
	if (!snap) {
		snap = { detection: null, recommendations: [] };
		liveSnapshotByTab.set(tabId, snap);
	}
	return snap;
}
```

In `resetLiveSnapshotForNavigation`:
```typescript
function resetLiveSnapshotForNavigation(tabId: number): void {
	const snap = liveSnapshotByTab.get(tabId);
	if (!snap) return;
	snap.recommendations = [];
}
```

In `getLiveSnapshot` handler — return the new shape:
```typescript
const snapshot = liveSnapshotByTab.get(tabId) ?? {
	detection: null,
	recommendations: [],
};
sendResponse({ ok: true, snapshot });
```

(Keep the `liveSnapshot` field name in `MessageResponse` — only inner shape changes.)

### Task B7: Limpar `LiveInsightsPanel.tsx`

**File:** Modify `app/src/components/replay/LiveInsightsPanel.tsx`

Remove:
- Import `import { StateInspector, type LiveStateSnapshot } from './StateInspector';`
- Import `StoreKind` and `ProbeStateChangePayload` (if imported for the panel's reducer).
- The entire `Section` rendering "Estado ao vivo" + its `StateInspector` usage.
- Reducer actions `'state-change'` and `'reset-state'`.
- Field `state` from `interface PanelState`.
- The `case 'state-change':` and `case 'reset-state':` reducer branches.
- In the `'hydrate'` reducer case: remove `state: { byStoreId: a.snapshot.state },`.
- In the `useEffect` listener: remove the branch `else if (msg.action === 'liveStateChange') { ... }`.
- In the `INITIAL` constant: remove the `state` field.
- Local `useState` for the section's open/closed: remove `state` from the `open` object (`useState({ framework: true, state: true, recommendations: true })` → `useState({ framework: true, recommendations: true })`).

### Task B8: Limpar `LiveInsightsPanel.test.tsx`

**File:** Modify `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx`

Remove tests:
- "mostra estado vazio antes de qualquer detecção" — keep, but adjust to remove the assertion about "Nenhum store de estado detectado".

Or simpler: change the assertion list inside that test to drop the state-related expectations. Read the file before editing.

Remove any helpers/types referring to `liveStateChange`, `statePayload`, `StoreKind`, etc.

### Task B9: Replay page — remover aba Estado (se existir)

**Files:** depends on what `grep` finds.

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && grep -rn "StateInspector\|state-tab\|state\":\\?" app/src/pages app/src/routes.tsx 2>&1 | grep -v "node_modules"
```

For each match (excluding the file `StateInspector.tsx` itself, already deleted):
- Remove the `<TabsTrigger value="state">…</TabsTrigger>` and matching `<TabsContent value="state">…</TabsContent>`.
- Remove import of `StateInspector`.

Likely files: `app/src/pages/ReplayPage.tsx` (if it embeds tabs).

### Task B10: `viewerTemplate.ts` — remover renderização de state

**File:** Modify `app/src/lib/session/viewerTemplate.ts`

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && grep -n "state\|StateInspector" app/src/lib/session/viewerTemplate.ts
```

Remove any block that renders `session.events` filtered by `type === 'state'` or that renders `stateBaseline`/`stateKeyframes`.

### Task B11: Atualizar `recorder.ts` callsites em `__tests__`

**Files:** any remaining test files that build `EnvironmentFingerprint` literals.

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && grep -rn "stateManagers" app/src --include="*.ts" --include="*.tsx"
```

For each match: remove `stateManagers: []` from the literal.

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && grep -rn "stateBaseline\|stateKeyframes\|StoreKind" app/src --include="*.ts" --include="*.tsx"
```

For each match in non-deleted files: remove or adjust.

### Task B12: Verify everything compiles + tests pass

```bash
cd app && npm run lint 2>&1 | tail -10
cd app && npx tsc --noEmit 2>&1 | tail -20
cd app && npm test 2>&1 | tail -10
cd app && npm run build 2>&1 | tail -5
```

All must pass. Test count should DECREASE significantly (deleted ~46 tests from state detection).

If any TS errors remain that aren't covered by previous tasks, fix locally:
- Orphan imports: remove.
- References to removed types: replace with available type or remove the code path entirely.

### Task B13: Commit (single commit for entire Group B)

```bash
git add -A
git status  # confirm what's staged — review for any unintended changes
git commit -m "$(cat <<'EOF'
refactor: remove state detection (probe taps, recorder, ui, viewer)

Feature de captura de estado (Redux/Zustand/NgRx/Angular Signals)
removida por completo — não trazia valor em apps prod (probe taps
dependem de globais de devtools que sites públicos não expõem).

Mantém: angularHttpTap (HTTP, não state), detectAngular fallback
prod, recommendations engine, live snapshot cache (sem state field).

Backward compat: sessões antigas com state events continuam abrindo
no importer (campos extras silenciosamente ignorados).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B14: Fechar beads obsoletos

```bash
bd close chrome-extension-debug-buddy-6ue --reason="State detection removida em Live Insights v3."
bd close chrome-extension-debug-buddy-4pl --reason="liveStateChange removido em Live Insights v3."
```

### Task B15: Verificação final + close epic

```bash
cd app && npm run lint && npx tsc --noEmit && npm test 2>&1 | tail -5
cd app && npm run build 2>&1 | tail -5
```

All green. Then:

```bash
bd close <EPIC_ID> --reason="Live Insights v3 entregue: sub-agrupamento por ruleId + remoção total de state detection."
git add .beads/issues.jsonl 2>/dev/null
git commit -m "chore: sync beads do live insights v3" 2>/dev/null || true
```

---

## Plan self-review

- **Spec coverage:**
  - §2 sub-agrupamento → A1 (RecommendationRow compact) + A2 (RuleGroup) + A3 (tests). ✓
  - §3 file deletions → B2. ✓
  - §3 file modifications → B1, B3, B4, B5, B6, B7, B8, B9, B10, B11. ✓
  - §3.3 beads cleanup → B14. ✓
  - §4 testes → A3 (sub-grouping cases) + B8 (panel cleanup) + B11 (fixture updates). ✓
  - §6 rollback / backward compat → covered via §3.2 ("backward compat" notes inline). ✓

- **Placeholders:** none (`<EPIC_ID>` is explicit placeholder defined in Task 0).

- **Type consistency:**
  - `RECOMMENDATION_ROW_TOKENS` defined in A1, used in A2.
  - `RecommendationCategory`, `RULE_CATEGORIES`, `CATEGORY_LABEL`, `CATEGORY_ORDER` from existing `categories.ts`.
  - `RecommendationRuleId` from existing `types.ts`.
  - `LiveSnapshot` shape change (drop `state` field) consistent across B6 (background) and B7 (panel reducer).

---

## Notes for the executor

- Group A is independent (UI only) — completes cleanly before Group B starts.
- Group B is a cascade — TS errors from B1 are resolved by B3-B11. Run `npx tsc --noEmit` only at end of Group B (not after every task), otherwise too noisy.
- Test count after Group B will DROP by ~30–50 (state detection coverage). Expected.
- `angularHttpTap.ts` stays. Verify before any rm.
- `RECOMMENDATION_ROW_TOKENS` is the single source of severity colors/labels — don't duplicate the maps in `RuleGroup`.
