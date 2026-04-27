# Phase 3 — Cleanup: Type Unification & Legacy Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the type drift documented in `CLAUDE.md` (`Message`/`MessageAction` declared inline in `background.ts` AND in `backend/types/index.ts`; `InterceptedResponse` declared in `background.ts` AND in `useResponses.ts`), migrate any remaining legacy storage shapes (`urlPatterns`, `mocks`) into the canonical `rules` format via a one-shot background-side migration, then delete every legacy code path so the codebase carries one source of truth for each concept.

**Architecture:** Three substantive code changes, each in its own commit and reviewable independently. Task 1 is the type consolidation foundation (no behavior change). Task 2 adds the background-side migration alongside the existing UI-side `migrateOldRules` (additive — old data still works). Task 3 removes the now-dead legacy reads in `background.ts`. Task 4 deletes UI artifacts that consumed legacy types. Task 5 is the verification gate. Bisect-safe: every commit leaves the project lint/build/test green and the extension functional.

**Tech Stack:** TypeScript 5.3 (still non-strict; Phase 4 revisits), Vite 6, Vitest 1.6, Biome 1.9.4, Chrome MV3 service worker.

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 3 — Cleanup de código e tipos".

**Working directory:** `app/` for npm/biome/vitest commands; repo root for git.

**Worktree:** Execute in a dedicated worktree (e.g. `/.claude/worktrees/<name>`) created from `main` (Phase 2 already merged via PR #34).

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `app/src/backend/types/messages.ts` | Create | Canonical `MessageAction` union + `Message` + `MessageResponse` (moves from inline `background.ts`) |
| `app/src/backend/types/intercepted.ts` | Create | Canonical `InterceptedResponse` + `ResponseModifications` (replaces duplicates in `background.ts` and `useResponses.ts`) |
| `app/src/backend/types/legacy.ts` | Create | Legacy-only types (`UrlPattern`, `MockConfig`) kept ONLY for the migration code; never re-exported from `index.ts` |
| `app/src/backend/types/index.ts` | Rewrite | Becomes a barrel that re-exports `messages.ts`, `intercepted.ts`, and `rules.ts`. The current stale `Message`/`MessageAction`/`InterceptedResponse` declarations are deleted (those were the drift). |
| `app/src/backend/services/legacyMigration.ts` | Create | Pure function `convertLegacyStorage(input) → output` unit-testable in isolation. Imported by `background.ts` startup. |
| `app/src/backend/services/__tests__/legacyMigration.test.ts` | Create | Vitest unit tests for the pure conversion function. |
| `app/src/backend/background.ts` | Modify | Remove inline type declarations (use imports). Add startup migration call. Remove `urlPatterns` global, legacy branches in `shouldInterceptUrl`/`checkForMock`/`checkForBreakpoint`, the legacy `getMocks` message action handler, and the `urlPatterns` listener in `chrome.storage.onChanged`. |
| `app/src/ui/hooks/useResponses.ts` | Modify | Import canonical `InterceptedResponse` and `ResponseModifications` from `@/backend/types/intercepted`. Remove the duplicate declarations. |
| `app/src/ui/hooks/useRules.ts` | Modify | Remove the now-redundant `migrateOldRules` (background does it; UI is a pure reader). Keep `createRuleFromLegacyUrlPattern` only if it's still used elsewhere; delete otherwise. |
| `app/src/ui/hooks/__tests__/useRules.test.ts` | Modify | Drop the `migrateOldRules` and `createRuleFromLegacyUrlPattern` tests. |
| `app/src/ui/hooks/useUrlPatterns.ts` | Delete | Legacy hook fully replaced by `useRules`. |
| `app/src/ui/hooks/__tests__/useUrlPatterns.test.ts` | Delete | Tests of the deleted hook. |
| `app/src/ui/components/rules/data-table.tsx` | Delete | Legacy table that displayed `UrlPattern[]`. The Settings page uses `RuleTable` (the new component) — verified via `grep` against `pages/Settings.tsx`. |
| `app/src/ui/components/rules/columns.tsx` | Delete | Legacy column defs that import `UrlPattern`. Same justification. |
| `CLAUDE.md` | Modify | Remove the "Quirks worth remembering" bullets that document the now-fixed type drift. Update the "Two coexisting rule formats" table to reflect that the legacy reads are gone. |
| `AGENTS.md` | Modify | Same as CLAUDE.md (parallel doc). |

No new test files beyond `legacyMigration.test.ts`. The existing 10 test files keep their current totals (59 passed + 1 skipped) modulo the deleted `useUrlPatterns.test.ts` and the dropped `useRules` migration tests; both will be accounted for in the final Vitest count.

---

## Task 1: Consolidate types (foundation)

**Why:** `CLAUDE.md` documents two type drift cases — `Message`/`MessageAction` declared in two places (with the inline one in `background.ts` being the source of truth, the one in `types/index.ts` stale), and `InterceptedResponse` declared in `background.ts` AND in `useResponses.ts`. Consolidate into single sources of truth before doing any other code change.

**Files:**
- Create: `app/src/backend/types/messages.ts`
- Create: `app/src/backend/types/intercepted.ts`
- Create: `app/src/backend/types/legacy.ts`
- Rewrite: `app/src/backend/types/index.ts`
- Modify: `app/src/backend/background.ts` (remove inline types; add imports)
- Modify: `app/src/ui/hooks/useResponses.ts` (remove duplicate; add import)

- [ ] **Step 1: Create `app/src/backend/types/messages.ts`**

Write this exact content (tabs, single quotes, trailing commas):

```ts
// Mensagens trocadas entre background.ts (service worker) e a UI React.
// Esta união é a fonte de verdade — quando adicionar uma nova action,
// edite ESTE arquivo e os dois lados (background + UI) recompilam.

export type MessageAction =
	| 'getMocks'
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
	| 'openSelectTabDialog';

import type { InterceptedResponse, ResponseModifications } from './intercepted';
import type { MockConfig } from './legacy';

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
	modifications?: ResponseModifications;
	updates?: Partial<InterceptedResponse>;
}

export interface MessageResponse {
	success?: boolean;
	error?: string;
	isDebugging?: boolean;
	pendingResponses?: Record<string, InterceptedResponse>;
	allRequests?: Record<string, InterceptedResponse>;
	response?: InterceptedResponse;
	mocks?: MockConfig[];
}
```

Note: the union extends the inline list with `'targetTabSelected'` and `'openSelectTabDialog'` (broadcast actions documented in CLAUDE.md but missing from the inline union). The `'hot_reload'` action from the inline union is dropped because Phase 0 deleted the only utility that emitted it. Verify by grepping `grep -n "'hot_reload'" app/src` — should return zero hits before and after this commit.

- [ ] **Step 2: Create `app/src/backend/types/intercepted.ts`**

```ts
// Forma canônica das requisições interceptadas. Compartilhada entre
// background.ts (writer) e useResponses.ts (reader).
//
// Notas (issue #19): atualmente `headers` carrega APENAS os response
// headers — request headers não são armazenados separadamente. Qualquer
// UI que se refira a "request headers" está exibindo response headers.

export interface InterceptedResponse {
	url: string;
	method?: string;
	/** Dados enviados no corpo da requisição original (commit 0bb0778). */
	request?: {
		postData?: string;
	};
	status: number;
	statusText: string;
	headers: Record<string, string>;
	mimeType: string;
	type: string;
	timestamp: number;
	body?: string;
	isWaiting?: boolean;
	isMocked?: boolean;
	captureError?: string;
	bodyUnavailableReason?: string;
	/** Tempo total da requisição em milissegundos (capturado via Network domain do CDP). */
	duration?: number;
}

export interface ResponseModifications {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
}
```

- [ ] **Step 3: Create `app/src/backend/types/legacy.ts`**

```ts
// Tipos legados mantidos APENAS para suporte à migração one-shot
// implementada em services/legacyMigration.ts. NÃO re-exportar deste arquivo
// para o resto do código — uma vez que a migração rode em produção e
// nenhum usuário tenha mais dados legados, este arquivo pode ser removido.

export interface UrlPattern {
	url: string;
	method: string;
	headerType?: string;
	headerName?: string;
	headerValue?: string;
	enabled?: boolean;
	isRegex?: boolean;
}

export interface MockConfig {
	urlPattern: string;
	method: string;
	status: number;
	headers: Record<string, string>;
	body: string;
	createdAt: number;
	enabled: boolean;
}
```

- [ ] **Step 4: Rewrite `app/src/backend/types/index.ts`**

Replace the entire file with:

```ts
// Barrel: re-exporta os tipos canônicos para consumidores que importam
// de '@/backend/types' sem se importar com o caminho exato. Os arquivos
// dedicados (messages.ts, intercepted.ts, rules.ts) são a fonte de verdade.

export type { MessageAction, Message, MessageResponse } from './messages';
export type { InterceptedResponse, ResponseModifications } from './intercepted';
export type {
	Rule,
	Action,
	ActionType,
	Matcher,
	MatcherType,
	BaseAction,
	BaseMatcher,
	UrlMatcher,
	MethodMatcher,
	HeaderMatcher,
	BodyMatcher,
	MockAction,
	DelayAction,
	ModifyAction,
	BreakpointAction,
} from './rules';
```

This barrel does NOT re-export `UrlPattern` or `MockConfig` — those live in `legacy.ts` and only the migration imports them.

- [ ] **Step 5: Update `app/src/backend/background.ts`**

In `app/src/backend/background.ts`, remove the inline type declarations (currently lines 4–127 approximately) and add imports at the top of the file. The exact replacement:

Find this block (starts at line 4, just after the imports of `indexedDBService` and `NetworkTimingTracker`):

```ts
// Tipos para padrões de URL
interface UrlPattern {
	url: string;
	...
}
...
// Tipos para mocks
interface MockConfig {
	...
}
...
type MessageAction =
	| 'getMocks'
	...;
...
interface Message {
	...
}
interface MessageResponse {
	...
}
// Tipos para as novas regras
interface Rule {
	...
}
interface Matcher {
	...
}
interface Action {
	...
}
```

Replace ALL of that with:

```ts
import type {
	InterceptedResponse,
	Message,
	MessageAction,
	MessageResponse,
	Rule,
	ResponseModifications,
} from './types';
import type { MockConfig, UrlPattern } from './types/legacy';
```

The `MockConfig` and `UrlPattern` imports are kept ONLY because the legacy code paths still reference them; Task 3 removes those references and these imports go away then.

After the edit, run a quick sanity check:
```bash
grep -nE '^interface (UrlPattern|InterceptedResponse|ResponseModifications|MockConfig|Message|MessageResponse|Rule|Matcher|Action)\b' app/src/backend/background.ts
```
Expected: no output.

- [ ] **Step 6: Update `app/src/ui/hooks/useResponses.ts`**

Replace the inline interface declarations at the top with imports.

Find these lines (currently lines 3–29):

```ts
export interface InterceptedResponse {
	url: string;
	...
}

export interface ResponseModifications {
	...
}
```

Replace with:

```ts
import type { InterceptedResponse, ResponseModifications } from '@/backend/types/intercepted';

export type { InterceptedResponse, ResponseModifications };
```

The `export type { ... }` re-export keeps backwards compatibility with other UI files that import `InterceptedResponse` from `useResponses.ts` (e.g. `useAllRequests.ts`, `Requests.tsx`, etc.). After Phase 6's restructure, those imports can be moved to `@/types/intercepted` directly.

- [ ] **Step 7: Run lint, build, test**

From `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all green. Same 59 passed + 1 skipped.

Spot-check that the import paths resolved:
```bash
npx tsc --noEmit 2>&1 | grep -E "Message|InterceptedResponse|MockConfig|UrlPattern" | head -10 || echo "no type errors related to consolidation"
```

If `tsc --noEmit` reports new errors specifically about the consolidated types, the imports are wrong. The 3 pre-existing TS6059 errors about `vite.config.mts`/`vitest.config.ts`/`vitest.setup.ts` outside `rootDir` are baseline noise.

- [ ] **Step 8: Commit**

From repo root:
```bash
git add app/src/backend/types app/src/backend/background.ts app/src/ui/hooks/useResponses.ts
git commit -m "$(cat <<'EOF'
refactor(types): consolidate Message/MessageAction and InterceptedResponse

Eliminates the two type drift cases documented in CLAUDE.md:

- Message/MessageAction were declared inline in background.ts (source of
  truth) AND in backend/types/index.ts (stale). Both consolidated into
  backend/types/messages.ts. The union also picks up two actions that
  had been documented in CLAUDE.md but were missing from the inline
  declaration: 'targetTabSelected' and 'openSelectTabDialog'.

- InterceptedResponse was declared inline in background.ts AND in
  useResponses.ts. Both consolidated into backend/types/intercepted.ts.
  useResponses.ts now imports + re-exports for backwards compatibility
  with downstream UI consumers.

Legacy types (UrlPattern, MockConfig) moved to backend/types/legacy.ts
and NOT re-exported from the barrel. They are kept only for the
migration code path that Task 2 introduces.

types/index.ts is now a barrel that re-exports the canonical types.

No behavior change. The 'hot_reload' action was dropped from the union
(its emitter was deleted in Phase 0).
EOF
)"
```

---

## Task 2: Background-side legacy migration (one-shot, idempotent)

**Why:** The current UI-side migration in `useRules.migrateOldRules` only runs when the user opens the UI. If the user has legacy data (`urlPatterns`, `mocks`) and never opens the UI, the data stays in legacy keys forever. Move the migration to background startup so it always runs at the right time.

The existing UI migration only handles `urlPatterns` (string-based or full `UrlPattern` objects → breakpoint `Rule`s). It does NOT migrate `mocks`. The new background migration handles BOTH.

**Files:**
- Create: `app/src/backend/services/legacyMigration.ts`
- Create: `app/src/backend/services/__tests__/legacyMigration.test.ts`
- Modify: `app/src/backend/background.ts` (call the migration at startup)

- [ ] **Step 1: Create `app/src/backend/services/legacyMigration.ts`**

Pure conversion function plus a stateful runner. The conversion function is unit-testable; the runner reads/writes `chrome.storage.local`.

```ts
import type { Rule } from '../types/rules';
import type { MockConfig, UrlPattern } from '../types/legacy';

/**
 * Backup gravado em chrome.storage.local antes de remover urlPatterns/mocks.
 * Mantido por 1 release como rede de segurança. A próxima fase do refactor
 * (ou um cleanup explícito) pode remover este backup quando ninguém mais
 * tiver dados legados.
 */
export interface LegacyBackup {
	urlPatterns?: (string | UrlPattern)[];
	mocks?: MockConfig[];
	migrated_at: number;
}

export interface MigrationInput {
	urlPatterns?: (string | UrlPattern)[];
	mocks?: MockConfig[];
	rules?: Rule[];
}

export interface MigrationOutput {
	rules: Rule[];
	hadLegacyData: boolean;
}

/**
 * Conversão pura: dado um snapshot de chrome.storage.local, retorna o
 * conjunto final de `rules` + flag indicando se havia dados legados.
 *
 * Esta função NÃO toca em chrome.storage — recebe entrada e devolve saída.
 * O runner em runLegacyMigration() lida com I/O e idempotência.
 */
export function convertLegacyStorage(
	input: MigrationInput,
	now: number = Date.now(),
	idGenerator: () => string = () => crypto.randomUUID(),
): MigrationOutput {
	const existingRules = input.rules ?? [];
	const newRules: Rule[] = [];

	const legacyUrlPatterns = input.urlPatterns ?? [];
	for (const entry of legacyUrlPatterns) {
		const pattern = typeof entry === 'string' ? entry : entry.url;
		if (!pattern) continue;
		const isRegex = typeof entry === 'object' ? Boolean(entry.isRegex) : false;
		const enabled = typeof entry === 'object' ? entry.enabled !== false : true;
		const method = typeof entry === 'object' ? entry.method : '';

		newRules.push({
			id: idGenerator(),
			name: pattern,
			enabled,
			matchers: [
				{ type: 'url', enabled: true, pattern, isRegex },
				...(method
					? [{ type: 'method' as const, enabled: true, method }]
					: []),
			],
			action: { type: 'breakpoint', enabled: true },
			createdAt: now,
			updatedAt: now,
		});
	}

	const legacyMocks = input.mocks ?? [];
	for (const mock of legacyMocks) {
		if (!mock.urlPattern) continue;
		newRules.push({
			id: idGenerator(),
			name: mock.urlPattern,
			enabled: mock.enabled !== false,
			matchers: [
				{ type: 'url', enabled: true, pattern: mock.urlPattern, isRegex: false },
				...(mock.method
					? [{ type: 'method' as const, enabled: true, method: mock.method }]
					: []),
			],
			action: {
				type: 'mock',
				enabled: true,
				status: mock.status,
				headers: mock.headers ?? {},
				body: mock.body ?? '',
				contentType: mock.headers?.['Content-Type'] ?? mock.headers?.['content-type'] ?? 'application/json',
			},
			createdAt: mock.createdAt ?? now,
			updatedAt: now,
		});
	}

	return {
		rules: [...existingRules, ...newRules],
		hadLegacyData: legacyUrlPatterns.length > 0 || legacyMocks.length > 0,
	};
}

/**
 * Runner stateful — idempotente via legacy_migrated_at.
 * Chamado uma vez em chrome.runtime.onInstalled e em chrome.runtime.onStartup.
 */
export async function runLegacyMigration(): Promise<{ migrated: boolean; reason?: string }> {
	const stored = await chrome.storage.local.get([
		'urlPatterns',
		'mocks',
		'rules',
		'legacy_migrated_at',
	]);

	if (stored.legacy_migrated_at) {
		return { migrated: false, reason: 'already_migrated' };
	}

	const result = convertLegacyStorage({
		urlPatterns: stored.urlPatterns,
		mocks: stored.mocks,
		rules: stored.rules,
	});

	if (!result.hadLegacyData) {
		// Marca como migrado mesmo sem dados, para não tentar de novo em todo startup.
		await chrome.storage.local.set({ legacy_migrated_at: Date.now() });
		return { migrated: false, reason: 'no_legacy_data' };
	}

	const backup: LegacyBackup = {
		urlPatterns: stored.urlPatterns,
		mocks: stored.mocks,
		migrated_at: Date.now(),
	};

	await chrome.storage.local.set({
		rules: result.rules,
		legacy_backup_v1: backup,
		legacy_migrated_at: Date.now(),
	});
	await chrome.storage.local.remove(['urlPatterns', 'mocks']);

	console.log(
		`[legacyMigration] Migrated ${(stored.urlPatterns ?? []).length} urlPatterns + ${(stored.mocks ?? []).length} mocks → ${result.rules.length} rules. Backup in legacy_backup_v1.`,
	);

	return { migrated: true };
}
```

- [ ] **Step 2: Create `app/src/backend/services/__tests__/legacyMigration.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { convertLegacyStorage } from '../legacyMigration';

const FIXED_NOW = 1700000000000;
let counter = 0;
const seqId = () => `id-${++counter}`;

describe('convertLegacyStorage', () => {
	test('returns existing rules unchanged when no legacy data', () => {
		const existing = [
			{
				id: 'r1',
				name: 'existing',
				enabled: true,
				matchers: [{ type: 'url' as const, enabled: true, pattern: 'foo', isRegex: false }],
				action: { type: 'breakpoint' as const, enabled: true },
				createdAt: 1,
				updatedAt: 1,
			},
		];
		const out = convertLegacyStorage({ rules: existing }, FIXED_NOW, seqId);
		expect(out.rules).toEqual(existing);
		expect(out.hadLegacyData).toBe(false);
	});

	test('converts string urlPatterns to breakpoint rules', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{ urlPatterns: ['api.example.com/users', '*.example.com/posts'] },
			FIXED_NOW,
			seqId,
		);
		expect(out.hadLegacyData).toBe(true);
		expect(out.rules).toHaveLength(2);
		expect(out.rules[0]).toMatchObject({
			id: 'id-1',
			name: 'api.example.com/users',
			enabled: true,
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false },
			],
			action: { type: 'breakpoint', enabled: true },
			createdAt: FIXED_NOW,
			updatedAt: FIXED_NOW,
		});
	});

	test('converts UrlPattern objects with method to rules with method matcher', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				urlPatterns: [
					{ url: 'api.example.com', method: 'POST', enabled: true, isRegex: false },
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect(out.rules[0].matchers).toEqual([
			{ type: 'url', enabled: true, pattern: 'api.example.com', isRegex: false },
			{ type: 'method', enabled: true, method: 'POST' },
		]);
	});

	test('disabled UrlPattern preserves enabled=false on the rule', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{ urlPatterns: [{ url: 'foo', method: '', enabled: false }] },
			FIXED_NOW,
			seqId,
		);
		expect(out.rules[0].enabled).toBe(false);
	});

	test('converts MockConfig to mock action rules', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				mocks: [
					{
						urlPattern: 'api/users/1',
						method: 'GET',
						status: 404,
						headers: { 'Content-Type': 'application/json' },
						body: '{"error":"not found"}',
						createdAt: 999,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect(out.rules[0]).toMatchObject({
			id: 'id-1',
			name: 'api/users/1',
			enabled: true,
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api/users/1', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			action: {
				type: 'mock',
				enabled: true,
				status: 404,
				headers: { 'Content-Type': 'application/json' },
				body: '{"error":"not found"}',
				contentType: 'application/json',
			},
			createdAt: 999,
			updatedAt: FIXED_NOW,
		});
	});

	test('mock without explicit Content-Type defaults to application/json', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				mocks: [
					{
						urlPattern: 'foo',
						method: '',
						status: 200,
						headers: {},
						body: '',
						createdAt: 0,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect((out.rules[0].action as { contentType: string }).contentType).toBe('application/json');
	});

	test('preserves existing rules and appends migrated ones', () => {
		counter = 0;
		const existing = [
			{
				id: 'existing-1',
				name: 'keep me',
				enabled: true,
				matchers: [{ type: 'url' as const, enabled: true, pattern: 'a', isRegex: false }],
				action: { type: 'breakpoint' as const, enabled: true },
				createdAt: 1,
				updatedAt: 1,
			},
		];
		const out = convertLegacyStorage(
			{ rules: existing, urlPatterns: ['legacy-1'] },
			FIXED_NOW,
			seqId,
		);
		expect(out.rules).toHaveLength(2);
		expect(out.rules[0]).toEqual(existing[0]);
		expect(out.rules[1].name).toBe('legacy-1');
	});

	test('skips entries without a usable pattern', () => {
		counter = 0;
		const out = convertLegacyStorage(
			{
				urlPatterns: ['', { url: '', method: 'GET' }],
				mocks: [
					{
						urlPattern: '',
						method: 'GET',
						status: 200,
						headers: {},
						body: '',
						createdAt: 0,
						enabled: true,
					},
				],
			},
			FIXED_NOW,
			seqId,
		);
		expect(out.rules).toEqual([]);
		expect(out.hadLegacyData).toBe(true);
	});
});
```

- [ ] **Step 3: Wire migration into `background.ts` startup**

In `app/src/backend/background.ts`, find the imports at the top (after Task 1 they should be:

```ts
import { indexedDBService } from './services/indexedDB';
import { NetworkTimingTracker } from './services/networkTiming';
import type { ... } from './types';
import type { ... } from './types/legacy';
```

Add a new import:

```ts
import { runLegacyMigration } from './services/legacyMigration';
```

Find the existing event listener registrations near the top of the file (search for `chrome.runtime.onInstalled` or the section where listeners are registered). If `chrome.runtime.onInstalled` doesn't exist, find the first explicit listener registration block and add:

```ts
chrome.runtime.onInstalled.addListener(async (details) => {
	console.log(`[background] onInstalled: ${details.reason}`);
	const result = await runLegacyMigration();
	if (result.migrated) {
		console.log('[background] Legacy storage migrated to rules format.');
	}
});

chrome.runtime.onStartup.addListener(async () => {
	console.log('[background] onStartup');
	await runLegacyMigration();
});
```

Place these AFTER the existing `chrome.tabs.onRemoved` listener (or wherever the existing top-level `chrome.runtime.*` setup lives). The migration runs:
- On extension install/update (`onInstalled`)
- On browser startup with extension already installed (`onStartup`)
- Idempotent: subsequent runs see `legacy_migrated_at` and short-circuit

- [ ] **Step 4: Run all gates**

From `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all green. Test count is now 59 + 7 (new) = 66 passed + 1 skipped (or similar — depends on whether vitest counts each `test()` block). The new file should add 7-8 tests.

Verify the new tests ran:
```bash
npm test -- --reporter=verbose 2>&1 | grep -E "convertLegacyStorage|legacyMigration"
```

- [ ] **Step 5: Commit**

```bash
git add app/src/backend/services/legacyMigration.ts \
        app/src/backend/services/__tests__/legacyMigration.test.ts \
        app/src/backend/background.ts
git commit -m "$(cat <<'EOF'
feat(migration): add background-side legacy storage migration

The UI-side migrateOldRules in useRules only runs when the user opens
the extension UI. Users with legacy data (urlPatterns, mocks) who never
open the UI never get migrated. Move the migration to background startup
so it always runs at extension install/update and on browser startup.

- New: services/legacyMigration.ts with a pure conversion function
  (convertLegacyStorage) and a stateful runner (runLegacyMigration).
  The runner is idempotent via chrome.storage.local.legacy_migrated_at.
- New: 7 unit tests against the pure conversion function.
- Migration handles BOTH urlPatterns and mocks (the existing UI-side
  migration only handled urlPatterns).
- Backs up legacy data to chrome.storage.local.legacy_backup_v1
  before deleting the legacy keys, kept for 1 release as a safety net.

Tasks 3 and 4 remove the legacy code paths now that data is migrated.
EOF
)"
```

---

## Task 3: Remove `background.ts` legacy code paths

**Why:** With Task 2's migration in place, no chrome.storage entry has `urlPatterns` or `mocks` after first install/update. The legacy reads in `background.ts` are dead code. Remove them.

**Files:**
- Modify: `app/src/backend/background.ts` (multiple sites)

- [ ] **Step 1: Inventory the legacy references**

From repo root:
```bash
grep -nE 'urlPatterns|MockConfig|mocks' app/src/backend/background.ts | head -40
```

Expected categories of hits (keep this list and confirm each is removed):
1. `let urlPatterns: ...` global state declaration (~line 131).
2. `chrome.storage.onChanged` listener handling `changes.urlPatterns` (~line 195–207).
3. The `getMocks` action handler (~line 272).
4. Legacy load at startup in the attach helper: `chrome.storage.local.get(['urlPatterns', 'rules'], ...)` (~line 672).
5. `urlPatterns.forEach(...)` to register attach interception (~line 1020).
6. `shouldInterceptUrl` legacy branch (~lines 1039–1100, the section commented "verificar as regras antigas (urlPatterns)").
7. `checkForMock` reading from `chrome.storage.local.get(['mocks'], ...)` (~lines 1171–1200, the part labeled "Vamos buscar os mocks do storage").
8. `MockConfig` parameter and return types in `checkForMock`.

The new behavior: every interception decision flows through the `rules` list only. `checkForMock` and `checkForBreakpoint` already have a `rules`-based primary branch (per CLAUDE.md "Two coexisting rule formats" — current `Rule[]` is the primary path). Just delete the secondary legacy branch in each.

- [ ] **Step 2: Remove `urlPatterns` global state and listener**

Delete the `let urlPatterns: (string | UrlPattern)[] = [];` line and the corresponding `changes.urlPatterns` block in the `chrome.storage.onChanged` listener.

After the edit, `chrome.storage.onChanged` should still handle `changes.rules` but no longer `changes.urlPatterns`.

- [ ] **Step 3: Remove the `getMocks` message action handler**

Delete the case block that handles `action: 'getMocks'`. The `'getMocks'` value in the `MessageAction` union (in `backend/types/messages.ts`) should ALSO be removed in this commit since nothing emits or consumes it anymore.

Run a sanity grep:
```bash
grep -rn "'getMocks'" app/src
```
Expected: no output.

- [ ] **Step 4: Remove legacy load at startup**

Find the helper that does `chrome.storage.local.get(['urlPatterns', 'rules'], ...)` and rewrite it to just `chrome.storage.local.get(['rules'])`. Drop the line that assigns `urlPatterns = result.urlPatterns || []`.

- [ ] **Step 5: Remove the `urlPatterns.forEach` registration**

The function that loops over `urlPatterns` to register URL-pattern-based interception attaches becomes a no-op. Remove the loop entirely. The new `Rule[]` doesn't need pre-registration — interception is decided per-request via `shouldInterceptUrl`.

- [ ] **Step 6: Simplify `shouldInterceptUrl`**

Find `function shouldInterceptUrl(...)`. Remove the section labeled "Primeiro, verificar as regras antigas (urlPatterns)" and everything that reads from `urlPatterns`/`currentUrlPatterns`. Keep the section that iterates over `rules` and matches each rule's `matchers`.

After the edit, `shouldInterceptUrl` should consist of:
- A single loop over `rules`
- For each enabled rule, check whether all `matchers` match the request
- Return true on first match, false otherwise

Test logic: this matches the documented "primary branch" in CLAUDE.md.

- [ ] **Step 7: Simplify `checkForMock`**

Find `async function checkForMock(...)`. Remove:
- The `chrome.storage.local.get(['mocks'], ...)` read
- The `MockConfig`-typed `mocks` array
- The branch that compares `mock.urlPattern` against the request URL

Keep:
- The branch that iterates over `rules`, finds rules with `action.type === 'mock'`, matches the request, and returns the mock action's `{status, headers, body, contentType}`.

The function's return type changes from `Promise<MockConfig | undefined>` to `Promise<MockAction | undefined>` (where `MockAction` is the type from `types/rules.ts`). Update the callsite (`handleRequestPaused`) to use the new shape — it accesses `.status`, `.headers`, `.body` which are present on both old and new types.

- [ ] **Step 8: Simplify `checkForBreakpoint`**

Same pattern: remove any legacy reads. Keep only the rules-based branch.

- [ ] **Step 9: Remove the `legacy.ts` import that's no longer needed**

After Steps 2–8, `background.ts` no longer references `MockConfig` or `UrlPattern`. Remove the line:

```ts
import type { MockConfig, UrlPattern } from './types/legacy';
```

(`legacy.ts` itself is kept — `legacyMigration.ts` still imports from it.)

- [ ] **Step 10: Run all gates**

From `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all green. Existing 10 test files + 1 new file = 11 files. Tests count slightly higher than before.

Manual smoke test (recommended): build, load `app/dist/` unpacked, click action icon, attach to a tab, exercise interception. The flow should work identically because the rule-based path was already the primary branch.

- [ ] **Step 11: Commit**

```bash
git add app/src/backend/background.ts app/src/backend/types/messages.ts
git commit -m "$(cat <<'EOF'
refactor(background): remove legacy urlPatterns/mocks code paths

After Task 2's background-side migration, no installation has data in
the legacy chrome.storage.local.urlPatterns / .mocks keys. The dead
code paths are removed in this commit:

- global 'urlPatterns' state and its chrome.storage.onChanged listener
- legacy load at attach (now reads only 'rules')
- urlPatterns.forEach() registration loop
- legacy branch in shouldInterceptUrl (only rules[] now)
- chrome.storage.local.get(['mocks']) and the MockConfig branch in
  checkForMock — uses the rules[] mock-action branch only
- 'getMocks' message action (no consumer)
- 'getMocks' value in the MessageAction union
- import of MockConfig/UrlPattern from types/legacy (legacy.ts itself
  is kept; only the migration code references it)

The 'rules' branch of each function was already the documented primary
path (per CLAUDE.md). No behavior change for any user with non-legacy
storage; users with legacy storage have it auto-migrated by Task 2's
runLegacyMigration() at install/update.
EOF
)"
```

---

## Task 4: Delete UI legacy artifacts

**Why:** Now that `useRules` is the only rule-management hook the UI needs, and the legacy components in `components/rules/data-table.tsx` + `columns.tsx` are unused (Settings.tsx imports `RuleTable` only, verified via grep), remove them.

Also remove `migrateOldRules` from `useRules` — the background does it now; the UI is a pure reader.

**Files:**
- Delete: `app/src/ui/hooks/useUrlPatterns.ts`
- Delete: `app/src/ui/hooks/__tests__/useUrlPatterns.test.ts`
- Delete: `app/src/ui/components/rules/data-table.tsx`
- Delete: `app/src/ui/components/rules/columns.tsx`
- Modify: `app/src/ui/hooks/useRules.ts` (remove `migrateOldRules` and `createRuleFromLegacyUrlPattern`)
- Modify: `app/src/ui/hooks/__tests__/useRules.test.ts` (drop the related tests)
- Modify: `CLAUDE.md` and `AGENTS.md` (update Quirks + Rule formats sections)

- [ ] **Step 1: Confirm zero consumers of legacy UI**

```bash
grep -rn "useUrlPatterns\|components/rules/data-table\|components/rules/columns" app/src --include='*.ts' --include='*.tsx' | grep -v "__tests__\|hooks/useUrlPatterns\|components/rules/data-table\|components/rules/columns"
```
Expected: no output. (The grep filters out the files that ARE the legacy artifacts being deleted.)

If anything matches, STOP and report — there's a live consumer that wasn't accounted for.

- [ ] **Step 2: Delete the legacy hook and its test**

```bash
git rm app/src/ui/hooks/useUrlPatterns.ts \
       app/src/ui/hooks/__tests__/useUrlPatterns.test.ts
```

- [ ] **Step 3: Delete the legacy table components**

```bash
git rm app/src/ui/components/rules/data-table.tsx \
       app/src/ui/components/rules/columns.tsx
```

- [ ] **Step 4: Strip migration helpers from `useRules.ts`**

In `app/src/ui/hooks/useRules.ts`, remove:
- The `migrateOldRules` function and any references to it (e.g. it being returned from the hook).
- The `createRuleFromLegacyUrlPattern` function (was exported; verify no consumer remains).
- The auto-migration `useEffect` that called `migrateOldRules` on mount.
- The `urlPatterns` storage reads (e.g. `chrome.storage.local.get(['urlPatterns'])`).

After the edit, `useRules` becomes a thin reader: load `rules` from storage, expose `addRule`/`updateRule`/`deleteRule`, listen to `chrome.storage.onChanged.rules` to stay reactive.

Run a grep to confirm cleanup:
```bash
grep -nE 'migrateOldRules|createRuleFromLegacyUrlPattern|urlPatterns' app/src/ui/hooks/useRules.ts
```
Expected: no output.

- [ ] **Step 5: Update `useRules.test.ts`**

In `app/src/ui/hooks/__tests__/useRules.test.ts`, delete:
- The entire `describe('createRuleFromLegacyUrlPattern', ...)` block.
- Any tests asserting `migrateOldRules` behavior.
- The import of `createRuleFromLegacyUrlPattern` from `../useRules`.

Keep all other tests (the `describe('useRules', ...)` block stays).

- [ ] **Step 6: Update `CLAUDE.md` and `AGENTS.md`**

Both files have a "Two coexisting rule formats" section (around line 100) and a "Quirks worth remembering" section.

In the "Two coexisting rule formats" section, replace the table that lists legacy + current with a paragraph noting that Phase 3 unified to a single format:

```
The codebase uses a single rule schema (`Rule[]` from `app/src/backend/types/rules.ts`).
Earlier versions had a separate `urlPatterns`/`mocks` storage keys; those are
migrated one-shot at extension install/update via `services/legacyMigration.ts`
and removed from runtime code paths. A backup is kept at
`chrome.storage.local.legacy_backup_v1` for one release as a safety net.

`Rule.action.type` is one of `'mock' | 'delay' | 'modify' | 'breakpoint'`.
On UI mount, `useRules` is a pure reader — the background owns migration
and writes; the UI only adds/updates/deletes rules through messages.
```

In the "Quirks worth remembering" section, delete the bullet that says "The `Message`/`MessageAction` types in `app/src/backend/types/index.ts` are stale" (it's no longer stale — Phase 3 fixed the drift). Keep the bullets about `request.postData` and `headers` being response-only (those are issue #19 territory).

The wording should match the project's convention; mirror exactly between the two files (only the title and intro line should differ).

- [ ] **Step 7: Run all gates**

```bash
npm run lint && npm run build && npm test
```

Expected: all green. Test count drops by however many tests `useUrlPatterns.test.ts` had + the dropped `createRuleFromLegacyUrlPattern` tests, but stays clean.

Verify the Settings page builds:
```bash
ls -lh app/dist/main.js
```

The bundle should be slightly smaller (fewer modules).

- [ ] **Step 8: Commit**

```bash
git add app/src/ui CLAUDE.md AGENTS.md
git commit -m "$(cat <<'EOF'
refactor(ui): delete legacy useUrlPatterns hook and unused rule components

After Task 2 moved the legacy migration to the background and Task 3
removed the legacy reads, the UI no longer needs:

- useUrlPatterns.ts (replaced by useRules)
- components/rules/data-table.tsx (legacy UrlPattern table; Settings
  uses RuleTable, verified via grep)
- components/rules/columns.tsx (legacy column defs)
- useRules.migrateOldRules (background owns migration now)
- useRules.createRuleFromLegacyUrlPattern (no consumer)

Tests updated: useUrlPatterns.test.ts deleted; useRules.test.ts has
the createRuleFromLegacyUrlPattern block removed.

Docs refreshed: CLAUDE.md and AGENTS.md no longer document the
'two coexisting rule formats' or the Message/MessageAction stale
declaration (both are fixed now).
EOF
)"
```

---

## Task 5: End-to-end verification

**Why:** Phase gate. No commit. Confirms cumulative effect.

- [ ] **Step 1: Clean install**

From `app/`:
```bash
rm -rf node_modules
npm ci
```

Expected: succeeds.

- [ ] **Step 2: All CI gates**

```bash
npm run lint && npm run build && npm test
```

Expected: all green. Vitest count = (Phase 2 baseline of 59) − (deleted `useUrlPatterns.test.ts` count) − (deleted `createRuleFromLegacyUrlPattern` test count) + (7 new `legacyMigration.test.ts` tests). Net should be near 60 ± 5.

Capture the exact count for the PR description.

- [ ] **Step 3: Coverage**

```bash
npm run test:coverage 2>&1 | tail -8
```

Expected: succeeds; new `legacyMigration.ts` has high coverage (the unit tests directly exercise it).

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: 3 pre-existing TS6059 errors about config files outside `rootDir`. **No new errors.**

- [ ] **Step 5: Hooks smoke test**

```bash
git commit --allow-empty -m "wip" 2>&1 | tail -5 || true
git commit --allow-empty -m "chore: phase 3 hook smoke test"
git reset --hard HEAD~1
```

Expected: invalid message rejected; valid commit lands; reset returns to clean state.

- [ ] **Step 6: Manual smoke test in Chrome (CRITICAL)**

This phase changes runtime behavior — the legacy migration runs at install. Verify carefully:

1. Build: `npm run build` from `app/`.
2. **Test the migration with legacy data first**:
   - Before installing the new build, in the existing extension's UI manually create a URL pattern (legacy) using the dev console:
     ```js
     await chrome.storage.local.set({ urlPatterns: ['api.example.com'], mocks: [{ urlPattern: 'foo', method: 'GET', status: 200, headers: {}, body: '{}', createdAt: Date.now(), enabled: true }] });
     ```
   - (Or skip this step if you don't have legacy data — the migration runs as a no-op.)
3. In `chrome://extensions`, click "Reload" on Debug Buddy (or remove + load unpacked again).
4. Open the extension's service worker DevTools (`chrome://extensions` → Service Worker → "Inspect"). Look for log lines:
   ```
   [background] onInstalled: update
   [legacyMigration] Migrated N urlPatterns + M mocks → K rules. Backup in legacy_backup_v1.
   ```
5. Open the interceptor UI. Verify:
   - Settings page shows the migrated rules (a breakpoint rule for each URL pattern, a mock rule for each mock).
   - The legacy data is gone: in DevTools console `await chrome.storage.local.get(['urlPatterns', 'mocks', 'legacy_backup_v1', 'legacy_migrated_at'])` — `urlPatterns` and `mocks` should be absent (or empty); `legacy_backup_v1` should hold the original data; `legacy_migrated_at` should be a timestamp.
6. Pick a target tab and Start Debugging. Trigger requests on the target tab. Confirm:
   - Requests appear in Request History (Phase 0+ behavior).
   - The migrated breakpoint rule still pauses requests matching its pattern.
   - The migrated mock rule still returns the configured response for matching requests.
7. Stop Debugging. No console errors.

If any of those steps fail, **STOP** and investigate before merging.

- [ ] **Step 7: Confirm git history**

```bash
git log --oneline main..HEAD
```

Expected (newest first):
```
<hash> refactor(ui): delete legacy useUrlPatterns hook and unused rule components
<hash> refactor(background): remove legacy urlPatterns/mocks code paths
<hash> feat(migration): add background-side legacy storage migration
<hash> refactor(types): consolidate Message/MessageAction and InterceptedResponse
<hash> docs: implementation plan for Phase 3 (cleanup types and legacy)
```

If the order or messages differ, do not amend — report.

---

## Done criteria

- All 4 task commits present on the branch (Task 5 is verification, no commit).
- `npm ci && npm run lint && npm run build && npm test` from `app/` is green on a freshly-installed tree.
- `tsc --noEmit` shows the same 3 pre-existing TS6059 errors and no new ones.
- Manual smoke test: legacy migration runs, migrates urlPatterns + mocks to rules, backs up to `legacy_backup_v1`, sets `legacy_migrated_at`. Interception works for both migrated breakpoint rules and migrated mock rules.
- No source file imports from `@/types/legacy` outside of `services/legacyMigration.ts`.
- No source file declares `interface MessageAction`, `interface InterceptedResponse`, or `interface Message` (only `messages.ts` and `intercepted.ts` do).
- `CLAUDE.md` and `AGENTS.md` no longer describe the type drift or "two coexisting rule formats" — those are resolved.
- `git status` is clean.

Once those boxes are ticked, Phase 3 is ready to merge into `main` (via PR, mirroring Phase 0/1/2). The next plan (Phase 4 — strict TS gradual rollout) depends on this baseline.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing user with legacy data loses their rules | Low | Migration is idempotent (`legacy_migrated_at` flag); backup written to `legacy_backup_v1` before deletion. Manual smoke test in Step 6 of Task 5 exercises this. |
| `MockAction.contentType` derivation drops or mangles a header | Medium | Conversion preserves the original `Content-Type` header verbatim with a fallback to `application/json`. Unit test in Task 2 covers both branches. |
| `runLegacyMigration` fires before `chrome.storage` is ready | Low | Async listener pattern (`onInstalled.addListener(async ...)`) waits for the resolved promise. Chrome guarantees `storage` is available within service worker lifetime. |
| `shouldInterceptUrl` rules-only branch was incomplete vs. legacy branch | Medium | Manual smoke test (Step 6 of Task 5) verifies a rule-based interception still works. If a regression surfaces, the fix is to re-add the missing matcher logic to the rules branch — not to revert the legacy branch (which had its own bugs). |
| `getMocks` action removal breaks an external caller | Low | Repo-wide grep confirms no consumer outside `background.ts`. The MessageAction union update in Task 3 ensures any future caller errors at compile time. |
| The `targetTabSelected`/`openSelectTabDialog` additions to MessageAction expose a previously-untyped emitter | Low | These were already documented in CLAUDE.md and emitted in code; just unioned now. No runtime change. |
| Vitest test count change confuses readers | Low | Capture exact before/after counts in Task 5 Step 2 and include in the PR description. |
| Manual smoke test is skipped due to oversight | Medium | Mark it CRITICAL in this plan; PR description must list it as a checkbox in the Test plan. |
