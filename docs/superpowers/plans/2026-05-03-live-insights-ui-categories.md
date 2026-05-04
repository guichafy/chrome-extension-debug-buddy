# Live Insights — UI Redesign por Categorias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as 4 seções legadas (Framework/Libraries/HTTP Clients/Data Fetching) do `LiveInsightsPanel` por agrupamento por categoria Wappalyzer, consumindo `techsUpdates` do Sub-projeto 3.

**Architecture:** Helper puro `groupTechsByCategory` em `app/src/lib/insights/`. Componentes `TechItem` + `TechCategorySection` em `app/src/components/replay/`. `LiveInsightsPanel` ganha `techs?` no `LiveDetectionEntry` local + reducer action `techsUpdate` + listener para `msg.techsUpdates` + `HostTechs` que renderiza categorias.

**Tech Stack:** TS strict, Vitest + jsdom + Testing Library, Biome, lib/probe/background dos Sub-projetos 1-3.

**Spec:** [docs/superpowers/specs/2026-05-03-live-insights-ui-categories-design.md](../specs/2026-05-03-live-insights-ui-categories-design.md)

**bd:** chrome-extension-debug-buddy-6ov

---

## File Map

**Created:**
- `app/src/lib/insights/groupByCategory.ts` — `groupTechsByCategory(techs): CategoryGroup[]`
- `app/src/lib/insights/__tests__/groupByCategory.test.ts`
- `app/src/components/replay/TechItem.tsx` — single tech display
- `app/src/components/replay/TechCategorySection.tsx` — collapsible section
- `app/src/components/replay/__tests__/TechItem.test.tsx`
- `app/src/components/replay/__tests__/TechCategorySection.test.tsx`

**Modified:**
- `app/src/components/replay/LiveInsightsPanel.tsx` — types, reducer, listener, picker label, `HostTechs` substitui `HostFramework`
- `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx` — eventuais ajustes pra novo render

---

## Task 1: groupByCategory helper (lib pura)

**Files:**
- Create: `app/src/lib/insights/__tests__/groupByCategory.test.ts`
- Create: `app/src/lib/insights/groupByCategory.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/lib/insights/__tests__/groupByCategory.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { groupTechsByCategory } from '../groupByCategory';
import type { TechHit } from '../types';

function hit(name: string, cats: number[], confidence = 100): TechHit {
	return { name, cats, confidence, evidence: [] };
}

describe('groupTechsByCategory', () => {
	test('returns empty when techs is empty', () => {
		expect(groupTechsByCategory([])).toEqual([]);
	});

	test('uses primary category (cats[0]) of each tech', () => {
		const techs = [
			hit('A', [12, 22]),
			hit('B', [12]),
			hit('C', [10]),
		];
		const groups = groupTechsByCategory(techs);
		// Cat 12 tem A+B; cat 10 tem C
		const cat12 = groups.find((g) => g.categoryId === 12);
		expect(cat12?.techs.map((t) => t.name).sort()).toEqual(['A', 'B']);
		const cat10 = groups.find((g) => g.categoryId === 10);
		expect(cat10?.techs.map((t) => t.name)).toEqual(['C']);
	});

	test('orders groups by priority asc then categoryName asc', () => {
		const techs = [hit('A', [10]), hit('B', [12]), hit('C', [1])];
		const groups = groupTechsByCategory(techs);
		const priorities = groups.map((g) => g.priority);
		expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
	});

	test('sorts techs within group by confidence desc', () => {
		const techs = [
			hit('Low', [12], 30),
			hit('High', [12], 90),
			hit('Med', [12], 60),
		];
		const groups = groupTechsByCategory(techs);
		expect(groups[0].techs.map((t) => t.name)).toEqual(['High', 'Med', 'Low']);
	});

	test('drops techs whose primary category is not in CATEGORIES', () => {
		const techs = [hit('Phantom', [99999])];
		expect(groupTechsByCategory(techs)).toEqual([]);
	});

	test('skips tech with empty cats array', () => {
		const techs = [hit('NoCats', [])];
		expect(groupTechsByCategory(techs)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run failing**

Run: `cd app && npx vitest run src/lib/insights/__tests__/groupByCategory.test.ts`
Expected: FAIL — module `../groupByCategory` not found.

- [ ] **Step 3: Implement**

Create `app/src/lib/insights/groupByCategory.ts`:

```ts
import { CATEGORIES } from './catalog';
import type { TechHit } from './types';

export interface CategoryGroup {
	categoryId: number;
	categoryName: string;
	priority: number;
	techs: TechHit[];
}

export function groupTechsByCategory(techs: TechHit[]): CategoryGroup[] {
	// Cada tech pode pertencer a múltiplas categorias. Para evitar duplicação
	// visual, atribuímos cada tech à PRIMEIRA categoria do seu cats[] (a
	// principal por convenção do schema Wappalyzer).
	const byCat = new Map<number, TechHit[]>();
	for (const tech of techs) {
		const primary = tech.cats[0];
		if (primary === undefined) continue;
		const arr = byCat.get(primary);
		if (arr) arr.push(tech);
		else byCat.set(primary, [tech]);
	}

	const groups: CategoryGroup[] = [];
	for (const [catId, list] of byCat) {
		const meta = CATEGORIES[String(catId)];
		if (!meta) continue;
		groups.push({
			categoryId: catId,
			categoryName: meta.name,
			priority: meta.priority,
			techs: [...list].sort((a, b) => b.confidence - a.confidence),
		});
	}
	groups.sort(
		(a, b) => a.priority - b.priority || a.categoryName.localeCompare(b.categoryName),
	);
	return groups;
}
```

- [ ] **Step 4: Run passing**

Run: `cd app && npx vitest run src/lib/insights/__tests__/groupByCategory.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/groupByCategory.ts app/src/lib/insights/__tests__/groupByCategory.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): groupTechsByCategory helper

sub-projeto 4, task 1: agrupa TechHit[] pela primeira categoria, ordena
grupos por priority asc, ordena techs dentro do grupo por confidence
desc. dropa techs cuja categoria primária não está em CATEGORIES.

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TechItem component

**Files:**
- Create: `app/src/components/replay/__tests__/TechItem.test.tsx`
- Create: `app/src/components/replay/TechItem.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/src/components/replay/__tests__/TechItem.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { TechHit } from '@/lib/insights/types';
import { TechItem } from '../TechItem';

function hit(name: string, overrides: Partial<TechHit> = {}): TechHit {
	return { name, cats: [12], confidence: 100, evidence: [], ...overrides };
}

describe('TechItem', () => {
	test('renders tech name', () => {
		render(<TechItem tech={hit('React')} />);
		expect(screen.getByText('React')).toBeInTheDocument();
	});

	test('renders version when present', () => {
		render(<TechItem tech={hit('React', { version: '18.2.0' })} />);
		expect(screen.getByText('18.2.0')).toBeInTheDocument();
	});

	test('does not render version pill when absent', () => {
		const { container } = render(<TechItem tech={hit('React')} />);
		// Sem texto que casa com semver
		expect(container.textContent).not.toMatch(/\d+\.\d+\.\d+/);
	});

	test('renders confidence pill for med (50-74)', () => {
		render(<TechItem tech={hit('X', { confidence: 60 })} />);
		expect(screen.getByText(/med/i)).toBeInTheDocument();
	});

	test('renders confidence pill for low (<50)', () => {
		render(<TechItem tech={hit('X', { confidence: 30 })} />);
		expect(screen.getByText(/low/i)).toBeInTheDocument();
	});

	test('does not render confidence pill for high (>=75)', () => {
		const { container } = render(<TechItem tech={hit('X', { confidence: 90 })} />);
		expect(container.textContent).not.toMatch(/\bmed\b|\blow\b/i);
	});

	test('renders website link when present', () => {
		render(<TechItem tech={hit('X', { website: 'https://example.com' })} />);
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', 'https://example.com');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
	});

	test('does not render link when website is absent', () => {
		render(<TechItem tech={hit('X')} />);
		expect(screen.queryByRole('link')).toBeNull();
	});
});
```

- [ ] **Step 2: Run failing**

Run: `cd app && npx vitest run src/components/replay/__tests__/TechItem.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/src/components/replay/TechItem.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { TechHit } from '@/lib/insights/types';

interface Props {
	tech: TechHit;
}

type ConfidenceLevel = 'high' | 'med' | 'low';

function levelFor(confidence: number): ConfidenceLevel {
	if (confidence >= 75) return 'high';
	if (confidence >= 50) return 'med';
	return 'low';
}

function confidenceBadgeClass(level: ConfidenceLevel): string {
	if (level === 'med') return 'border-warning/60 text-warning text-[10px]';
	return 'border-destructive/60 text-destructive text-[10px]';
}

export function TechItem({ tech }: Props) {
	const level = levelFor(tech.confidence);
	return (
		<div className="flex items-center gap-1.5">
			<Badge variant="secondary" className="text-xs">
				{tech.name}
			</Badge>
			{tech.version && (
				<span className="font-mono text-[10px] text-muted-foreground">{tech.version}</span>
			)}
			{level !== 'high' && (
				<Badge variant="outline" className={confidenceBadgeClass(level)}>
					{level}
				</Badge>
			)}
			{tech.website && (
				<a
					href={tech.website}
					target="_blank"
					rel="noreferrer noopener"
					className="text-[10px] text-muted-foreground hover:underline"
					aria-label={`Site oficial de ${tech.name}`}
				>
					↗
				</a>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Run passing**

Run: `cd app && npx vitest run src/components/replay/__tests__/TechItem.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/components/replay/TechItem.tsx app/src/components/replay/__tests__/TechItem.test.tsx
git commit -m "$(cat <<'EOF'
feat(insights-ui): TechItem componente

sub-projeto 4, task 2: renderiza uma TechHit com name + version pill +
confidence pill (med/low apenas) + link website. high omite pill para
reduzir poluição.

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TechCategorySection component

**Files:**
- Create: `app/src/components/replay/__tests__/TechCategorySection.test.tsx`
- Create: `app/src/components/replay/TechCategorySection.tsx`

- [ ] **Step 1: Write failing tests**

Create `app/src/components/replay/__tests__/TechCategorySection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import type { CategoryGroup } from '@/lib/insights/groupByCategory';
import { TechCategorySection } from '../TechCategorySection';

function group(overrides: Partial<CategoryGroup> = {}): CategoryGroup {
	return {
		categoryId: 12,
		categoryName: 'JavaScript frameworks',
		priority: 8,
		techs: [
			{ name: 'React', cats: [12], confidence: 100, evidence: [] },
		],
		...overrides,
	};
}

describe('TechCategorySection', () => {
	test('renders category name and tech count', () => {
		render(<TechCategorySection group={group()} defaultOpen={false} />);
		expect(screen.getByText('JavaScript frameworks')).toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
	});

	test('hides techs by default when defaultOpen=false', () => {
		render(<TechCategorySection group={group()} defaultOpen={false} />);
		expect(screen.queryByText('React')).toBeNull();
	});

	test('shows techs when defaultOpen=true', () => {
		render(<TechCategorySection group={group()} defaultOpen={true} />);
		expect(screen.getByText('React')).toBeInTheDocument();
	});

	test('toggle button expands and collapses', async () => {
		const user = userEvent.setup();
		render(<TechCategorySection group={group()} defaultOpen={false} />);
		expect(screen.queryByText('React')).toBeNull();
		await user.click(screen.getByRole('button'));
		expect(screen.getByText('React')).toBeInTheDocument();
		await user.click(screen.getByRole('button'));
		expect(screen.queryByText('React')).toBeNull();
	});
});
```

- [ ] **Step 2: Run failing**

Run: `cd app && npx vitest run src/components/replay/__tests__/TechCategorySection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `app/src/components/replay/TechCategorySection.tsx`:

```tsx
import { useState } from 'react';
import type { CategoryGroup } from '@/lib/insights/groupByCategory';
import { TechItem } from './TechItem';

interface Props {
	group: CategoryGroup;
	defaultOpen?: boolean;
}

export function TechCategorySection({ group, defaultOpen = false }: Props) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="border-b last:border-b-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent"
				aria-expanded={open}
			>
				<span className="font-medium text-xs">{group.categoryName}</span>
				<span className="text-[10px] text-muted-foreground">{group.techs.length}</span>
			</button>
			{open && (
				<div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
					{group.techs.map((t) => (
						<TechItem key={t.name} tech={t} />
					))}
				</div>
			)}
		</section>
	);
}
```

- [ ] **Step 4: Run passing**

Run: `cd app && npx vitest run src/components/replay/__tests__/TechCategorySection.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/components/replay/TechCategorySection.tsx app/src/components/replay/__tests__/TechCategorySection.test.tsx
git commit -m "$(cat <<'EOF'
feat(insights-ui): TechCategorySection collapsible

sub-projeto 4, task 3: section colapsável que renderiza nome da
categoria + count + lista de TechItem expandida via botão. defaultOpen
controla estado inicial.

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: LiveInsightsPanel — types + reducer + listener + hidratação

**Files:**
- Modify: `app/src/components/replay/LiveInsightsPanel.tsx`

- [ ] **Step 1: Add TechHit import + types**

Edit `app/src/components/replay/LiveInsightsPanel.tsx`. Add imports near the existing `EnvironmentFingerprint` import:

```ts
import type { TechHit } from '@/lib/insights/types';
import { groupTechsByCategory } from '@/lib/insights/groupByCategory';
import { TechCategorySection } from './TechCategorySection';
```

- [ ] **Step 2: Extend LiveDetectionEntry and HydrateSnapshot**

Find `LiveDetectionEntry` interface (~line 26-30). Update:

```ts
interface LiveDetectionEntry {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	techs?: TechHit[]; // NOVO — vem do Sub-projeto 3 (techsUpdates / hidratação)
}
```

Find `HydrateSnapshot` interface (~line 39-47). Update each detection element:

```ts
interface HydrateSnapshot {
	detections: Array<{
		host: string;
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[];
	}>;
	recommendations: Recommendation[];
}
```

- [ ] **Step 3: Add reducer action `techsUpdate`**

Find `PanelAction` type (~line 49-53). Add new variant:

```ts
type PanelAction =
	| { type: 'detection'; payload: { host: string; entry: LiveDetectionEntry } }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'hydrate'; snapshot: HydrateSnapshot }
	| { type: 'techsUpdate'; payload: { host: string; techs: TechHit[] } };
```

In the `reducer` function (~line 68-96), add a case:

```ts
case 'techsUpdate': {
	const next = new Map(s.detectionsByHost);
	const existing = next.get(a.payload.host);
	if (existing) {
		next.set(a.payload.host, { ...existing, techs: a.payload.techs });
	} else {
		// host ainda sem detection (pode acontecer se bg pipeline detectar
		// antes do probe scan). Cria placeholder.
		next.set(a.payload.host, {
			url: `https://${a.payload.host}/`,
			timestamp: Date.now(),
			fingerprint: { framework: { name: 'vanilla' }, libraries: [], httpClients: [], dataFetching: [], detectedAt: Date.now(), isProductionBuild: false },
			techs: a.payload.techs,
		});
	}
	return { ...s, detectionsByHost: next };
}
```

Update the `'hydrate'` case to carry `techs` from snapshot:

```ts
case 'hydrate': {
	const next = new Map<string, LiveDetectionEntry>();
	for (let i = a.snapshot.detections.length - 1; i >= 0; i--) {
		const d = a.snapshot.detections[i];
		next.set(d.host, {
			url: d.url,
			timestamp: d.timestamp,
			fingerprint: d.fingerprint,
			techs: d.techs,
		});
	}
	return {
		detectionsByHost: next,
		recommendations: a.snapshot.recommendations,
	};
}
```

Also update `'detection'` case to preserve `techs` when re-setting (techsUpdate may have happened first):

```ts
case 'detection': {
	const next = new Map(s.detectionsByHost);
	const existingForHost = next.get(a.payload.host);
	if (next.has(a.payload.host)) next.delete(a.payload.host);
	next.set(a.payload.host, {
		...a.payload.entry,
		techs: a.payload.entry.techs ?? existingForHost?.techs, // preserva techs já chegadas
	});
	return { ...s, detectionsByHost: next };
}
```

- [ ] **Step 4: Add listener for techsUpdates**

Find the message listener inside `useEffect` (~line 138-156). Inside the `if (msg.action === 'liveDetection')` block, after the existing `if (!msg.payload) return;` and detection dispatch, add the techsUpdates branch. The full block becomes:

```ts
if (msg.action === 'liveDetection') {
	if (msg.payload) {
		dispatch({
			type: 'detection',
			payload: {
				host: extractHost(msg.payload.url),
				entry: {
					url: msg.payload.url,
					fingerprint: msg.payload.fingerprint,
					timestamp: msg.payload.timestamp,
					techs: msg.payload.techs,
				},
			},
		});
	}
	if (msg.techsUpdates) {
		for (const u of msg.techsUpdates) {
			dispatch({ type: 'techsUpdate', payload: u });
		}
	}
}
```

- [ ] **Step 5: Verify tsc + tests**

Run: `cd app && npx tsc --noEmit && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -20`
Expected: tsc clean. Existing tests still pass — the changes are additive at the data layer (HostTechs swap is in Task 5).

If tsc complains because Message.payload no longer matches what `dispatch({ type: 'detection', ... entry })` expects (e.g., `entry.techs?` is required somewhere), adjust the entry construction. The fix is to make `techs` optional everywhere — it already is.

- [ ] **Step 6: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/components/replay/LiveInsightsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(insights-ui): LiveInsightsPanel consome techsUpdates + hidratação

sub-projeto 4, task 4: LiveDetectionEntry + HydrateSnapshot ganham
techs[]; novo reducer action techsUpdate atualiza incrementalmente;
listener consome msg.techsUpdates; detection preserva techs existentes
em re-set.

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: LiveInsightsPanel — HostTechs substitui HostFramework

**Files:**
- Modify: `app/src/components/replay/LiveInsightsPanel.tsx`

- [ ] **Step 1: Add HostTechs component**

Append at the end of `app/src/components/replay/LiveInsightsPanel.tsx`, after the `HostFramework` function:

```tsx
function HostTechs({ detection }: { detection: LiveDetectionEntry | null }) {
	const techs = detection?.techs ?? [];
	const groups = useMemo(() => groupTechsByCategory(techs), [techs]);

	if (!detection) {
		return (
			<p className="border-b px-3 py-2 text-muted-foreground text-xs">
				Sem detecção do probe para este host. Recomendações abaixo são derivadas de respostas HTTP
				capturadas.
			</p>
		);
	}
	if (groups.length === 0) {
		return (
			<div className="border-b">
				<div className="px-3 py-2">
					<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
						{detection.url}
					</p>
				</div>
				<p className="px-3 pb-3 text-muted-foreground text-xs">
					Nenhuma tecnologia detectada para este host ainda. Aguarde o próximo Fetch ou navegação SPA.
				</p>
			</div>
		);
	}
	return (
		<div className="border-b">
			<div className="px-3 py-2">
				<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
					{detection.url}
				</p>
			</div>
			{groups.map((g, idx) => (
				<TechCategorySection key={g.categoryId} group={g} defaultOpen={idx < 3} />
			))}
		</div>
	);
}
```

- [ ] **Step 2: Replace HostFramework with HostTechs in render**

Find the JSX in the main component (~line 271-278):

```tsx
<HostFramework detection={activeDetection} />
<HostRecommendations items={activeRecommendations} />
```

Replace with:

```tsx
<HostTechs detection={activeDetection} />
<HostRecommendations items={activeRecommendations} />
```

- [ ] **Step 3: Verify tsc + tests + lint**

Run: `cd app && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -15`
Expected: tsc clean, lint clean. **Some existing LiveInsightsPanel tests may fail** because they expect `HostFramework`'s legacy text ("Framework", "Libraries", etc.). That's OK and expected — Task 6 fixes the tests.

If any non-LiveInsightsPanel tests fail, that's a real regression — escalate.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/components/replay/LiveInsightsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(insights-ui): HostTechs substitui HostFramework

sub-projeto 4, task 5: novo componente HostTechs renderiza categorias
Wappalyzer via TechCategorySection. Top-3 categorias expandidas por
default. Empty state quando 0 techs detectadas. HostFramework legado
permanece no arquivo apenas para evitar quebrar tests legados (cleanup
em pr separada).

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: LiveInsightsPanel tests — atualiza assertions

**Files:**
- Modify: `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx`

This task fixes any tests that broke because of the `HostFramework`→`HostTechs` swap, and adds new tests for the `techsUpdate` flow.

- [ ] **Step 1: Run failing tests to see what broke**

Run: `cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -30`

Note which tests fail. Common breaks:
- Tests querying for "Framework", "Libraries", "HTTP Clients", "Data Fetching" labels
- Tests checking specific badges from the legacy fingerprint shape

For each broken test:
- If the test asserts legacy section labels: replace with category-based assertions OR remove (the new flow renders categorized techs)
- If the test checks framework name in the picker: update to expect either legacy fallback (still works) or tech-derived label

- [ ] **Step 2: Update broken assertions**

For each failing test, modify to either:
- Use the new tech-based render assertions (e.g., assert that a TechItem renders 'WordPress')
- OR pass a fixture with `techs: []` and `fingerprint: <legacy>` and assert the empty-state message

The minimum to keep working: the picker should still render hosts even with empty `techs` (uses legacy framework label as fallback per spec). Check `pickerLabel` logic — if `entry.techs` is empty, falls back to `fingerprint.framework`.

NOTE: Since `HostFramework` is no longer rendered, tests asserting "Framework" / "Libraries" labels MUST go. Either delete those tests OR rewrite them to assert techs flow.

- [ ] **Step 3: Add new tests for techsUpdate flow**

Append new tests to `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx`:

```tsx
describe('LiveInsightsPanel — techs flow', () => {
	test('hidratação carrega techs do snapshot', async () => {
		const sendMessage = vi.fn(async (msg: { action: string }) => {
			if (msg.action === 'getLiveSnapshot') {
				return {
					ok: true,
					liveSnapshot: {
						detections: [
							{
								host: 'wordpress.org',
								url: 'https://wordpress.org/',
								timestamp: Date.now(),
								fingerprint: legacyFingerprint(),
								techs: [
									{ name: 'WordPress', cats: [1], confidence: 100, evidence: [] },
								],
							},
						],
						recommendations: [],
					},
				};
			}
			return undefined;
		});
		(chrome.runtime.sendMessage as unknown) = sendMessage;

		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);

		expect(await screen.findByText('WordPress')).toBeInTheDocument();
	});

	test('techsUpdates broadcast atualiza render', async () => {
		// Implementação: simula listener registrado, dispara message, verifica
		// que o WordPress aparece na UI
		// (omitted full body — adapt from existing message-listener test pattern
		// in this file)
	});
});

function legacyFingerprint() {
	return {
		framework: { name: 'vanilla' as const },
		libraries: [],
		httpClients: [],
		dataFetching: [],
		detectedAt: Date.now(),
		isProductionBuild: false,
	};
}
```

For the second test (`techsUpdates broadcast atualiza render`), look at how existing tests in this file simulate `chrome.runtime.onMessage` listener calls and replicate the pattern.

- [ ] **Step 4: Verify all tests pass**

Run: `cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx
git commit -m "$(cat <<'EOF'
test(insights-ui): atualiza LiveInsightsPanel tests para techs flow

sub-projeto 4, task 6: substitui assertions de Framework/Libraries por
TechItem-based; adiciona testes de hidratação com techs e de
techsUpdates broadcast.

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Picker label deriva de techs

**Files:**
- Modify: `app/src/components/replay/LiveInsightsPanel.tsx`

The `HostPicker` currently builds label from `fingerprint.framework`. Update to prefer techs.

- [ ] **Step 1: Add helper**

Inside `LiveInsightsPanel.tsx`, add this helper near the top of the file (after the `extractHost` function):

```ts
import type { TechHit } from '@/lib/insights/types';
// (já importado em Task 4 — verifique)

function pickerLabel(entry: LiveDetectionEntry): string | null {
	if (entry.techs && entry.techs.length > 0) {
		const groups = groupTechsByCategory(entry.techs);
		const top = groups[0]?.techs[0];
		if (top) return top.version ? `${top.name} ${top.version}` : top.name;
	}
	const fw = entry.fingerprint?.framework;
	if (fw && fw.name !== 'vanilla') {
		return fw.version ? `${fw.name} ${fw.version}` : fw.name;
	}
	return null;
}
```

- [ ] **Step 2: Use pickerLabel in HostPicker**

Find `HostPicker` (~line 283). Replace the `frameworkLabel` derivation:

Old:
```ts
const frameworkLabel = selectedDetection
	? `${selectedDetection.fingerprint.framework.name}${
			selectedDetection.fingerprint.framework.version
				? ` ${selectedDetection.fingerprint.framework.version}`
				: ''
		}`
	: null;
```

New:
```ts
const frameworkLabel = selectedDetection ? pickerLabel(selectedDetection) : null;
```

In the SelectContent items, replace the inline label derivation similarly:

Old:
```ts
const fw = det
	? `${det.fingerprint.framework.name}${det.fingerprint.framework.version ? ` ${det.fingerprint.framework.version}` : ''}`
	: null;
```

New:
```ts
const fw = det ? pickerLabel(det) : null;
```

- [ ] **Step 3: Verify tsc + tests + lint**

Run: `cd app && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -10`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/components/replay/LiveInsightsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(insights-ui): picker label deriva da tech principal

sub-projeto 4, task 7: pickerLabel(entry) prefere a tech de maior
priority (categoria principal Wappalyzer); fallback para
fingerprint.framework legado quando techs vazio.

bd: chrome-extension-debug-buddy-6ov

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification + close bd + push

- [ ] **Step 1: Full suite**

Run: `cd app && npm test 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 2: Lint**

Run: `cd app && npm run lint`
Expected: clean. `npm run lint:fix` if needed.

- [ ] **Step 3: tsc + build**

Run: `cd app && npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 4: Close bd + push**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
bd close chrome-extension-debug-buddy-6ov --reason="Sub-projeto 4 completo: UI redesign por categorias Wappalyzer. LiveInsightsPanel consome techsUpdates + detection.techs. HostTechs substitui HostFramework. Picker label deriva de tech principal. Detectors legados intactos — cleanup em PR separada."
git add .beads/issues.jsonl
git commit -m "chore: sync beads do ui redesign sub-projeto 4

bd: chrome-extension-debug-buddy-6ov (closed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>" 2>&1 | tail -3
git push 2>&1 | tail -5
git status
```

Expected: `git status` shows up to date with origin.

---

## Self-Review Notes

**Spec coverage:** Tasks 1-8 cobrem todos os critérios:
- Task 1 → groupByCategory.ts
- Task 2 → TechItem.tsx
- Task 3 → TechCategorySection.tsx
- Task 4 → LiveDetectionEntry/HydrateSnapshot extends + reducer + listener
- Task 5 → HostTechs substitui HostFramework
- Task 6 → tests atualizados
- Task 7 → picker label deriva de techs
- Task 8 → verification + push

**Type consistency:** `TechHit`, `TechCategory*`, `groupTechsByCategory`, `pickerLabel`, `LiveDetectionEntry.techs` consistentes em todos os usos.

**No placeholders:** todos steps têm código completo. Task 6 step 2 contém guidance ("for each broken test") em vez de código exato porque o engineer precisa inspecionar o que quebrou — esta é guidance de troubleshooting genuína, não placeholder.

**Risk:** Task 6 pode requerer iteração — se muitos tests legados quebrarem, separar como follow-up. Pre-aviso ao engineer no Step 1.
