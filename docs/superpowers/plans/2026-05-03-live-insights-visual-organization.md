# Live Insights v2 — Visual & Organização Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o `LiveInsightsPanel` para (a) agrupar recomendações por categoria (Segurança / Performance) com seções colapsáveis; (b) usar paleta de severidades dedicada (red/amber/sky) que distingue ERRO/AVISO/INFO; (c) reorganizar Framework & Libraries em sub-headings; (d) esconder fetch/xhr (universais) e resolver duplicata `angular-http`.

**Architecture:** Map estático `RULE_CATEGORIES` em `recommendations/categories.ts` (sem migrar schema de sessão); UI de recomendações usa `<details>` HTML nativo para colapsar; cores via paleta Tailwind direta (sem mexer em tokens globais); fix de bug em `detectDataFetching` removendo branch que duplica `angular-http`.

**Tech Stack:** TypeScript strict, React 19, Tailwind v4, shadcn UI (Badge, Sheet), Vitest + jsdom.

**Spec source:** [docs/superpowers/specs/2026-05-03-live-insights-visual-organization-design.md](docs/superpowers/specs/2026-05-03-live-insights-visual-organization-design.md)

---

## File structure overview

### Created
```
app/src/lib/session/recommendations/categories.ts
app/src/lib/session/recommendations/__tests__/categories.test.ts
```

### Modified
```
app/src/probe/detectors/dataFetching.ts                                 (remove angular-http branch)
app/src/probe/detectors/__tests__/dataFetching.test.ts                  (atualizar test)
app/src/components/replay/RecommendationRow.tsx                         (paleta dedicada)
app/src/components/replay/LiveInsightsPanel.tsx                         (refactor 2 sections)
app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx          (novos casos)
```

---

## Pre-flight

### Task 0: Sync + claim bead + verify baseline

- [ ] **Step 1: Verify branch + clean tree**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git status
```

Expected: on `feature/session-replay`, no uncommitted changes (or only `.beads/issues.jsonl` from previous syncs).

- [ ] **Step 2: Create or reuse the tracking bead**

```bash
bd create \
  --title="Live Insights v2: agrupamento por categoria + paleta dedicada" \
  --description="Implementa spec docs/superpowers/specs/2026-05-03-live-insights-visual-organization-design.md. Resolve: (a) cores ERRO/AVISO indistinguíveis; (b) lista plana de 27+ recomendações; (c) Framework & Libraries com angular-http duplicado e fetch/xhr poluindo." \
  --type=task \
  --priority=2
```

Take note of the returned id (call it `<EPIC_ID>`).

- [ ] **Step 3: Claim it**

```bash
bd update <EPIC_ID> --claim
```

- [ ] **Step 4: Baseline checks**

```bash
cd app && npm run lint && npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: lint clean, tsc clean, **1149 tests passing** (post-Phase M baseline).

---

## Task 1: Criar `recommendations/categories.ts`

**Files:**
- Create: `app/src/lib/session/recommendations/categories.ts`
- Create: `app/src/lib/session/recommendations/__tests__/categories.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/src/lib/session/recommendations/__tests__/categories.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { CATEGORY_LABEL, CATEGORY_ORDER, RULE_CATEGORIES } from '../categories';
import type { RecommendationRuleId } from '../../types';

describe('RULE_CATEGORIES', () => {
	test('cobre todas as 10 RecommendationRuleIds', () => {
		const expected: RecommendationRuleId[] = [
			'compression-missing',
			'cache-missing',
			'mixed-content',
			'csp-missing',
			'hsts-missing',
			'nosniff-missing',
			'large-payload',
			'image-not-optimized',
			'cookie-insecure',
			'cors-open',
		];
		const actual = Object.keys(RULE_CATEGORIES) as RecommendationRuleId[];
		expect(actual.sort()).toEqual(expected.sort());
	});

	test('classifica security e performance corretamente', () => {
		const security: RecommendationRuleId[] = [
			'csp-missing',
			'hsts-missing',
			'cookie-insecure',
			'mixed-content',
			'cors-open',
			'nosniff-missing',
		];
		const performance: RecommendationRuleId[] = [
			'compression-missing',
			'cache-missing',
			'large-payload',
			'image-not-optimized',
		];
		for (const id of security) expect(RULE_CATEGORIES[id]).toBe('security');
		for (const id of performance) expect(RULE_CATEGORIES[id]).toBe('performance');
	});

	test('CATEGORY_ORDER ordena security primeiro', () => {
		expect(CATEGORY_ORDER).toEqual(['security', 'performance']);
	});

	test('CATEGORY_LABEL mapeia para pt-BR', () => {
		expect(CATEGORY_LABEL.security).toBe('Segurança');
		expect(CATEGORY_LABEL.performance).toBe('Performance');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/categories.test.ts
```

Expected: FAIL — module `../categories` not found.

- [ ] **Step 3: Implement `categories.ts`**

Create `app/src/lib/session/recommendations/categories.ts`:

```typescript
import type { RecommendationRuleId } from '../types';

export type RecommendationCategory = 'security' | 'performance';

export const RULE_CATEGORIES: Record<RecommendationRuleId, RecommendationCategory> = {
	'csp-missing': 'security',
	'hsts-missing': 'security',
	'cookie-insecure': 'security',
	'mixed-content': 'security',
	'cors-open': 'security',
	'nosniff-missing': 'security',
	'compression-missing': 'performance',
	'cache-missing': 'performance',
	'large-payload': 'performance',
	'image-not-optimized': 'performance',
};

export const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
	security: 'Segurança',
	performance: 'Performance',
};

export const CATEGORY_ORDER: RecommendationCategory[] = ['security', 'performance'];
```

The `Record<RecommendationRuleId, ...>` type forces exhaustivity — adding a new rule without an entry here triggers a compile error.

- [ ] **Step 4: Run test to verify passes**

```bash
cd app && npx vitest run src/lib/session/recommendations/__tests__/categories.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Verify lint + typecheck**

```bash
cd app && npm run lint && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/session/recommendations/categories.ts app/src/lib/session/recommendations/__tests__/categories.test.ts
git commit -m "$(cat <<'EOF'
feat(recommendations): map estático de categorias (security/performance)

Categoria deriva de RecommendationRuleId via Record<...> exhaustivo —
não migra schema de sessão. Adicionar regra nova sem entrada aqui
gera erro de compilação.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Remover `angular-http` de `detectDataFetching`

**Files:**
- Modify: `app/src/probe/detectors/dataFetching.ts`
- Modify: `app/src/probe/detectors/__tests__/dataFetching.test.ts`

- [ ] **Step 1: Inspect current state**

```bash
grep -n "angular-http\|app-root" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/probe/detectors/dataFetching.ts
```

Expected output: lines pushing `{ name: 'angular-http', treatment: 'tracked' }` and the `hasAppRoot` check.

- [ ] **Step 2: Write/update failing test**

Open `app/src/probe/detectors/__tests__/dataFetching.test.ts`. Find any test that asserts `detectDataFetching()` returns `angular-http`. **Remove that assertion**.

If no test exists for the new "negative" case, add one:

```typescript
test('não emite angular-http mesmo com <app-root> presente (angular-http é HTTP client, não data fetching)', () => {
	document.body.innerHTML = '<app-root></app-root>';
	const result = detectDataFetching();
	expect(result.find((d) => d.name === 'angular-http')).toBeUndefined();
});
```

If the file doesn't have a `beforeEach` clearing `document.body.innerHTML`, add one at the top of the `describe` block:

```typescript
beforeEach(() => {
	document.body.innerHTML = '';
	delete (window as unknown as { __APOLLO_CLIENT__?: unknown }).__APOLLO_CLIENT__;
	delete (window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown }).__TANSTACK_QUERY_CLIENT__;
	delete (window as unknown as { ng?: unknown }).ng;
});
```

(Imports: `import { beforeEach, describe, expect, test } from 'vitest';` if not already imported.)

- [ ] **Step 3: Run test to confirm new test fails (and any positive test about angular-http now fails too)**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/dataFetching.test.ts
```

Expected: FAIL on the new negative test (current `dataFetching.ts` still emits angular-http).

- [ ] **Step 4: Edit `dataFetching.ts` — remove the angular-http block**

In `app/src/probe/detectors/dataFetching.ts`, delete this block entirely:

```typescript
// Angular HttpClient é tratado como "tracked" (interceptamos via XHR tap em
// angularHttpTap.ts). Marcamos presença sempre que detectamos contexto Angular.
const ng = (window as unknown as { ng?: { getComponent?: unknown } }).ng;
const hasAppRoot = !!document.querySelector('app-root');
if (ng?.getComponent || hasAppRoot) {
	out.push({ name: 'angular-http', treatment: 'tracked' });
}
```

The function should now read in full:

```typescript
import type { DataFetchingDetection } from '@/lib/session/types';

export function detectDataFetching(): DataFetchingDetection[] {
	const out: DataFetchingDetection[] = [];

	const apollo = (window as unknown as { __APOLLO_CLIENT__?: { version?: string } })
		.__APOLLO_CLIENT__;
	if (apollo) {
		const entry: DataFetchingDetection = { name: 'apollo', treatment: 'detection-only' };
		if (apollo.version) entry.version = apollo.version;
		out.push(entry);
	}

	const tanstack = (window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown })
		.__TANSTACK_QUERY_CLIENT__;
	if (tanstack) {
		out.push({ name: 'tanstack-query', treatment: 'detection-only' });
	}

	// SWR, urql, Relay, RTK Query: signatures de comportamento ficam pra v1.x.

	return out;
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/dataFetching.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run wider test sweep**

```bash
cd app && npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: tsc clean, all tests pass. Test count may increase by 1 (the new negative test) and decrease by however many old tests asserted `angular-http` in `dataFetching` output.

- [ ] **Step 7: Commit**

```bash
git add app/src/probe/detectors/dataFetching.ts app/src/probe/detectors/__tests__/dataFetching.test.ts
git commit -m "$(cat <<'EOF'
fix(probe): remove angular-http duplicado de detectDataFetching

angular-http é cliente HTTP (não framework de data fetching).
Continua presente em detectHttpClients quando contexto Angular é
detectado. Resolve duplicata visual no LiveInsightsPanel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Paleta dedicada de severidades em `RecommendationRow`

**Files:**
- Modify: `app/src/components/replay/RecommendationRow.tsx`

- [ ] **Step 1: Read current file**

```bash
cat /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/components/replay/RecommendationRow.tsx
```

Confirm current structure: maps `SEVERITY_CLASSES` and `SEVERITY_LABEL` based on tokens `border-l-destructive bg-destructive/5` etc.

- [ ] **Step 2: Replace the entire file with paleta dedicada**

Overwrite `app/src/components/replay/RecommendationRow.tsx`:

```typescript
import { useState } from 'react';
import type { Recommendation, RecommendationSeverity } from '@/lib/session/types';

// Paleta dedicada — não usa --color-warning global (que está em hue 19,
// rosa-avermelhado, conflita com --color-destructive em hue 22). Tailwind v4
// inclui paleta red/amber/sky por default.
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

export function RecommendationRow({ item }: { item: Recommendation }) {
	const [open, setOpen] = useState(false);
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
			{open && (
				<div className="mt-1 w-full space-y-1 rounded bg-background p-2">
					{Object.entries(item.evidence).map(([k, v]) => (
						<div key={k} className="grid grid-cols-[max-content_1fr] gap-2 font-mono text-[11px]">
							<span className="text-muted-foreground">{k}:</span>
							<span className="break-all">{v}</span>
						</div>
					))}
					{item.suggestion && <p className="border-t pt-1 text-[11px]">{item.suggestion}</p>}
				</div>
			)}
		</button>
	);
}
```

Changes vs the current file:
- `border-l-destructive bg-destructive/5` → `border-l-red-500 bg-red-50 dark:bg-red-950/30` (and similar for warn/info).
- New `SEVERITY_LABEL_CLASSES` map applied to the label span — color reinforces severity even when row background is subtle.
- Label changed from `font-medium uppercase text-[10px]` to `font-semibold text-[10px]` (already uppercase via the constant value `'ERRO'/'AVISO'/'INFO'`).

- [ ] **Step 3: Verify lint + typecheck**

```bash
cd app && npm run lint && npx tsc --noEmit
```

- [ ] **Step 4: Run any existing tests for this component**

```bash
cd app && npx vitest run src/components/replay
```

Expected: PASS. If a snapshot test exists for `RecommendationRow`, the diff is intentional (color classes changed). Update with `npx vitest -u` only after confirming visual change is desired.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/replay/RecommendationRow.tsx
git commit -m "$(cat <<'EOF'
fix(insights): paleta dedicada para severidades em RecommendationRow

red/amber/sky em vez de --color-destructive/warning/info globais.
--warning está em hue 19 (rosa-avermelhado), conflita visualmente com
--destructive (hue 22). Tailwind v4 inclui paleta dedicada por default;
suporte a dark mode via 950/30.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Refatorar `RecommendationsSection` em `LiveInsightsPanel` (agrupamento por categoria)

**Files:**
- Modify: `app/src/components/replay/LiveInsightsPanel.tsx`

- [ ] **Step 1: Add imports at top of file**

In `app/src/components/replay/LiveInsightsPanel.tsx`, find the existing imports block. Add:

```typescript
import {
	CATEGORY_LABEL,
	CATEGORY_ORDER,
	RULE_CATEGORIES,
	type RecommendationCategory,
} from '@/lib/session/recommendations/categories';
```

- [ ] **Step 2: Replace `RecommendationsSection` body**

Find the existing `RecommendationsSection` function. Replace its body with:

```typescript
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
						<div>
							{grouped[cat].map((r) => (
								<RecommendationRow key={r.id} item={r} />
							))}
						</div>
					</details>
				),
			)}
		</div>
	);
}
```

Behavior:
- Empty state preserved.
- `<details open>` provides native collapse/expand. User clicks summary to toggle.
- Categories with 0 items return `null` (omitted from DOM).
- Counter `(N)` shown in summary, but the global header above ("Recomendações (N)") still shows total — that header lives in the parent `LiveInsightsPanel`, untouched.

- [ ] **Step 3: Verify build**

```bash
cd app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Run existing tests for LiveInsightsPanel**

```bash
cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx
```

If tests fail because they assumed flat list of `RecommendationRow` instances, update them in Task 6. For now, **note failures but don't commit**. Move on to Task 5.

If tests pass (unlikely if any tested grouping), commit now:

```bash
git add app/src/components/replay/LiveInsightsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(insights): agrupa recomendações por categoria em <details> colapsáveis

Segurança / Performance via RULE_CATEGORIES. Categoria com 0 itens
omitida do DOM. Default expandida. Counter por categoria.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If commit deferred, proceed to Task 5 — both are in the same file and one commit at end of Task 5 covers both.

---

## Task 5: Refatorar `FrameworkSection` em `LiveInsightsPanel` (sub-headings + filtros)

**Files:**
- Modify: `app/src/components/replay/LiveInsightsPanel.tsx`

- [ ] **Step 1: Replace `FrameworkSection` body and add a `SubSection` helper**

In the same file (`LiveInsightsPanel.tsx`), find the existing `FrameworkSection` function. Replace its body and add a small helper component above it (or just below imports — pick a spot that mirrors the file's organization):

```typescript
function SubSection({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<h4 className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</h4>
			<div className="flex flex-wrap items-center gap-1.5">{children}</div>
		</div>
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
	const interestingHttp = fp.httpClients.filter((c) => c.name !== 'fetch' && c.name !== 'xhr');

	return (
		<div className="space-y-3 px-3 py-2">
			<SubSection label="URL">
				<p
					className="break-all font-mono text-[11px] text-muted-foreground"
					title={detection.url}
				>
					{detection.url}
				</p>
			</SubSection>

			<SubSection label="Framework">
				<Badge variant="default" className="text-xs">
					{fp.framework.name}
					{fp.framework.version ? ` ${fp.framework.version}` : ''}
				</Badge>
			</SubSection>

			{fp.libraries.length > 0 && (
				<SubSection label="Libraries">
					{fp.libraries.map((l) => (
						<Badge key={`lib-${l.name}`} variant="secondary" className="text-xs">
							{l.name}
							{l.version ? ` ${l.version}` : ''}
							{l.confidence !== 'high' ? ` (${l.confidence})` : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{interestingHttp.length > 0 && (
				<SubSection label="HTTP Clients">
					{interestingHttp.map((c) => (
						<Badge key={`http-${c.name}`} variant="secondary" className="text-xs">
							{c.name}
							{c.confidence !== 'high' ? ` (${c.confidence})` : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{fp.dataFetching.length > 0 && (
				<SubSection label="Data Fetching">
					{fp.dataFetching.map((d) => (
						<Badge
							key={`data-${d.name}`}
							variant={d.treatment === 'tracked' ? 'secondary' : 'outline'}
							className="text-xs"
							title={
								d.treatment === 'detection-only'
									? 'Detectada nesta versão; sem agrupamento de operations / cache inspector dedicado.'
									: undefined
							}
						>
							{d.name}
							{d.version ? ` ${d.version}` : ''}
							{d.treatment === 'detection-only' ? ' · detect-only' : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{fp.stateManagers.length > 0 && (
				<SubSection label="State">
					{fp.stateManagers.map((s) => (
						<Badge key={`state-${s.name}`} variant="secondary" className="text-xs">
							{s.name}
							{s.storesDetected > 0 ? ` ×${s.storesDetected}` : ''}
						</Badge>
					))}
				</SubSection>
			)}
		</div>
	);
}
```

If `React` namespace isn't already imported, add `import * as React from 'react';` at the top (the `React.ReactNode` type in `SubSection`).

Key behavior:
- URL fica num bloco "URL" próprio em sub-heading.
- Framework é o único `variant="default"` (visualmente é o destaque).
- Filter de fetch/xhr aplicado (`interestingHttp`).
- Categorias com 0 entries não renderizam (sub-headings somem).

- [ ] **Step 2: Verify build**

```bash
cd app && npm run lint && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Run tests for LiveInsightsPanel**

```bash
cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -30
```

If failures appear that relate to (a) flat recommendation list, (b) `fetch`/`xhr` badges expected in render, (c) `SubSection` headings not present — they will be addressed in Task 6.

- [ ] **Step 4: Commit (covers Task 4 + Task 5)**

```bash
git add app/src/components/replay/LiveInsightsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(insights): liveinsightspanel reorganizado (sub-headings + agrupamento)

Recomendações: <details> colapsáveis por categoria security/performance.
Framework & Libraries: sub-headings (URL, Framework, Libraries, HTTP,
Data Fetching, State); fetch/xhr filtrados; categorias vazias omitidas;
framework com variant default (destaque visual).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Atualizar testes do `LiveInsightsPanel`

**Files:**
- Modify: `app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx`

- [ ] **Step 1: Read the existing test file**

```bash
cat /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx
```

Note the existing structure (mocks, helpers, what cases are already covered). The Phase G/M baseline tests likely:
- Mount `<LiveInsightsPanel tabId={N} isInterceptionActive={true} />`.
- Stub `chrome.runtime.onMessage` and `chrome.runtime.sendMessage`.
- Assert empty states, badges, hits.

- [ ] **Step 2: Run them now to know current passes/fails**

```bash
cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -30
```

If any tests fail because of Task 4/5 changes:
- Tests asserting `text=fetch` or `text=xhr` badges → update assertions to confirm those badges are NOT rendered.
- Tests asserting flat `RecommendationRow` count under "Recomendações" → update to look inside `<details>` for the right category.

- [ ] **Step 3: Add 4 new test cases at the end of the file**

Append to the test file (use `it`/`test` per the file's existing convention):

```typescript
test('omite seção HTTP Clients quando só fetch/xhr (universais) presentes', async () => {
	const tabId = 99;
	render(<LiveInsightsPanel tabId={tabId} isInterceptionActive={true} />);

	// Usa o helper já existente para entregar liveDetection. Se não há
	// helper, dispatcha onMessage manualmente como nos outros casos do arquivo.
	await dispatchOnMessage({
		action: 'liveDetection',
		tabId,
		payload: {
			url: 'https://example.com',
			timestamp: 1,
			triggerType: 'initial',
			fingerprint: {
				framework: { name: 'vanilla' },
				libraries: [],
				httpClients: [
					{ name: 'fetch', confidence: 'high' },
					{ name: 'xhr', confidence: 'high' },
				],
				dataFetching: [],
				stateManagers: [],
				detectedAt: 1,
				isProductionBuild: false,
			},
		},
	});

	// Sub-heading "HTTP Clients" não aparece quando nada além de fetch/xhr existe.
	expect(screen.queryByText(/^HTTP Clients$/)).not.toBeInTheDocument();
});

test('mostra HTTP Clients quando há clients além de fetch/xhr', async () => {
	const tabId = 100;
	render(<LiveInsightsPanel tabId={tabId} isInterceptionActive={true} />);

	await dispatchOnMessage({
		action: 'liveDetection',
		tabId,
		payload: {
			url: 'https://example.com',
			timestamp: 1,
			triggerType: 'initial',
			fingerprint: {
				framework: { name: 'angular' },
				libraries: [],
				httpClients: [
					{ name: 'fetch', confidence: 'high' },
					{ name: 'xhr', confidence: 'high' },
					{ name: 'angular-http', confidence: 'medium' },
				],
				dataFetching: [],
				stateManagers: [],
				detectedAt: 1,
				isProductionBuild: false,
			},
		},
	});

	expect(screen.getByText('HTTP Clients')).toBeInTheDocument();
	expect(screen.getByText(/angular-http/)).toBeInTheDocument();
	// fetch/xhr não viram badges
	expect(screen.queryByText('fetch')).not.toBeInTheDocument();
	expect(screen.queryByText('xhr')).not.toBeInTheDocument();
});

test('agrupa recomendações em Segurança / Performance', async () => {
	const tabId = 101;
	render(<LiveInsightsPanel tabId={tabId} isInterceptionActive={true} />);

	const baseRec = (overrides: Partial<Recommendation>): Recommendation => ({
		id: crypto.randomUUID(),
		ruleId: 'csp-missing',
		severity: 'error',
		timestamp: Date.now(),
		url: 'https://example.com/x',
		host: 'example.com',
		summary: 'x',
		evidence: {},
		...overrides,
	});

	await dispatchOnMessage({
		action: 'liveRecommendation',
		tabId,
		recommendation: baseRec({ ruleId: 'csp-missing', severity: 'error' }),
	});
	await dispatchOnMessage({
		action: 'liveRecommendation',
		tabId,
		recommendation: baseRec({ ruleId: 'compression-missing', severity: 'warn' }),
	});

	expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument();
	expect(screen.getByText(/Performance \(1\)/)).toBeInTheDocument();
});

test('omite categoria de recomendações quando há 0 hits naquela categoria', async () => {
	const tabId = 102;
	render(<LiveInsightsPanel tabId={tabId} isInterceptionActive={true} />);

	await dispatchOnMessage({
		action: 'liveRecommendation',
		tabId,
		recommendation: {
			id: 'r1',
			ruleId: 'csp-missing',
			severity: 'error',
			timestamp: 1,
			url: 'https://example.com',
			host: 'example.com',
			summary: 'x',
			evidence: {},
		},
	});

	expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument();
	// Performance não aparece (nenhuma rule de perf disparou)
	expect(screen.queryByText(/^Performance/)).not.toBeInTheDocument();
});
```

The helper `dispatchOnMessage` matches whatever pattern the file already uses to deliver `chrome.runtime.onMessage` events. If the file uses a different pattern (e.g., direct call to a captured listener), adapt accordingly.

If `Recommendation` isn't imported, add `import type { Recommendation } from '@/lib/session/types';`.

- [ ] **Step 4: Run all tests**

```bash
cd app && npx vitest run src/components/replay/__tests__/LiveInsightsPanel.test.tsx 2>&1 | tail -20
```

Expected: PASS (all existing + 4 new = at least 4 more passing).

- [ ] **Step 5: Run full suite**

```bash
cd app && npm run lint && npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: lint clean, tsc clean, **1149 + 4 (new categories.test.ts) + 4 (new LiveInsightsPanel cases) = 1157 tests** (or more if dataFetching gained a test). Some old tests may have been deleted/updated — adjust expectation accordingly.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/replay/__tests__/LiveInsightsPanel.test.tsx
git commit -m "$(cat <<'EOF'
test(insights): cobertura para agrupamento e filtros visuais

4 testes novos: HTTP Clients omitido quando só fetch/xhr; HTTP Clients
visível quando há clients além de fetch/xhr; agrupamento Segurança/
Performance em recomendações; categoria omitida quando 0 hits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Verificação final + close epic

- [ ] **Step 1: Full quality gate**

```bash
cd app && npm run lint && npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: ALL PASS.

- [ ] **Step 2: Build the extension**

```bash
cd app && npm run build 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 3: Manual smoke test guidance**

Manual smoke (do not actually run a browser from the agent — describe steps):

```
chrome://extensions → recarregar Debug Buddy
abrir options.html ou side panel
selecionar tab → "Iniciar interceptação"
navegar para https://formio.github.io/angular-demo/#/
clicar ícone Activity → drawer "Live Insights"
```

Expected:
- **Framework & Libraries** com sub-headings: URL, Framework (`angular` em badge default), Libraries (`jquery 3.7.1`), HTTP Clients (apenas `angular-http (medium)` — sem fetch/xhr; sem duplicata), State (se redux detectado).
- **Recomendações (N)** com 2 sub-seções `<details>`: `Segurança (N1)` em vermelho/amarelo, `Performance (N2)` em amarelo/azul.
- ERRO/AVISO/INFO visualmente distinguíveis (red/amber/sky).

- [ ] **Step 4: Close epic**

```bash
bd close <EPIC_ID> --reason="Live Insights v2 entregue: agrupamento por categoria, paleta dedicada de severidades, sub-headings em Framework & Libraries, fix de duplicata angular-http."
```

- [ ] **Step 5: Sync beads commit (if needed)**

```bash
git add .beads/issues.jsonl
git status  # confirm only beads metadata staged
git commit -m "$(cat <<'EOF'
chore: sync beads do live insights v2

Fecha bead da Phase Live Insights v2 (agrupamento + paleta).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Skip if there's nothing to commit.)

---

## Plan self-review

- **Spec coverage:**
  - Spec §1 decision 1 (agrupamento) → Task 1 (categories.ts) + Task 4 (UI agrupamento). ✓
  - Spec §1 decision 2 (seções colapsáveis) → Task 4 (`<details open>`). ✓
  - Spec §1 decision 3 (paleta dedicada) → Task 3 (RecommendationRow). ✓
  - Spec §1 decision 4 (sub-headings F&L) → Task 5 (FrameworkSection). ✓
  - Spec §1 decision 5 (esconder fetch/xhr) → Task 5 (`interestingHttp` filter). ✓
  - Spec §1 decision 6 (resolver angular-http duplicado) → Task 2 (detectDataFetching). ✓
  - Spec §1 decision 7 (hierarquia visual: framework default, resto secondary) → Task 5 (Badge variants). ✓
  - Spec §9.1 testes unit → Task 1 (categories), Task 2 (dataFetching negative), Task 6 (LiveInsightsPanel cases). ✓
  - Spec §10 rollback (sem migração) → garantido por Task 1 (map externo) + Task 3 (sem mexer em globals.css). ✓

- **Placeholders:** nenhum "TBD/TODO". `<EPIC_ID>` é placeholder explícito definido em Task 0 e referenciado em Task 7.

- **Type consistency:**
  - `RecommendationCategory`, `RULE_CATEGORIES`, `CATEGORY_LABEL`, `CATEGORY_ORDER` definidos em Task 1, importados em Task 4.
  - `RecommendationSeverity` (já existente) usado consistentemente em Task 3 mappings.
  - `Recommendation` (já existente) importado em Task 6 quando necessário.
  - `interestingHttp` é local, não cross-task.
  - `SubSection` definido em Task 5 e usado dentro do mesmo arquivo (não exportado).

---

## Notes for the executor

- Plan assumes `feature/session-replay` branch with Phase A–M already committed (baseline 1149 tests).
- Tasks 4 e 5 mexem no mesmo arquivo (`LiveInsightsPanel.tsx`); Task 5 commit cobre ambos. Se preferir commits separados por clareza histórica, faça commit ao fim de Task 4 antes de Task 5.
- Para Task 6: o helper `dispatchOnMessage` deve casar o pattern já usado no arquivo de teste. Se ele usa `chrome.runtime.onMessage.addListener` capturando o callback, basta chamar o callback armazenado com a mensagem. Não invente shape — leia o que está lá.
- Sobre o test de severity colors: testes JSDOM não exercem CSS real; basta confirmar a presença das classes (ex.: `expect(row).toHaveClass('border-l-red-500')`) se quiser validar paleta. Não adicionei isso para manter Task 6 enxuta — se quiser, é uma adição local.
