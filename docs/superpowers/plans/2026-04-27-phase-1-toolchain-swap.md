# Phase 1 — Toolchain Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ESLint+Prettier with Biome, Jest with Vitest, and add commit-time discipline via Husky+lint-staged+commitlint. Update CI to Node 22 LTS and the new commands. No source-behavior change — purely toolchain.

**Architecture:** Migrate test runtime first (Vitest), then linter/formatter (Biome), then commit hooks, then CI. Each substack lands in two commits — *add new* and *remove old* — so any commit on the branch is bisect-safe with both stacks momentarily coexisting between them.

**Tech Stack:** Vitest 1.x (jsdom environment, jest-dom matchers), `@biomejs/biome` 1.x, husky 9.x, lint-staged 15.x, `@commitlint/cli` + `@commitlint/config-conventional` 19.x, Node 22 LTS in CI.

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 1 — Toolchain swap (Biome + Vitest + hooks)".

**Working directory:** `app/` for npm/biome/vitest commands; repo root for git, `.github/workflows/`, and `.husky/`.

**Worktree:** Execute in a dedicated worktree (e.g. `/.claude/worktrees/<name>`) created from `feature/refactor` (or whatever branch is currently the integration target). Phase 0 already merged into `feature/refactor` via PR #32 → `main`.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `app/package.json` | Modify | Swap deps (add Vitest/Biome/hooks; remove Jest/ESLint/Prettier); rewrite `scripts`; add `lint-staged` block |
| `app/package-lock.json` | Modify (regenerated) | Side-effect of `npm install` |
| `app/vitest.config.ts` | Create | Vitest config: `jsdom`, `globals: true`, alias `@`→`src`, setup files |
| `app/vitest.setup.ts` | Create | Replaces `jest.setup.js` — `chrome` mock with `vi.fn()` + `@testing-library/jest-dom/vitest` import |
| `app/jest.config.cjs` | Delete | Replaced by `vitest.config.ts` |
| `app/jest.setup.js` | Delete | Replaced by `vitest.setup.ts` |
| `app/biome.json` | Create | Biome config: tabs 2, lineWidth 100, single-quote, trailingCommas all, recommended rules with disables matching current ESLint |
| `app/eslint.config.js` | Delete | Replaced by `biome.json` |
| `app/.prettierrc` | Delete | Replaced by `biome.json` |
| `app/commitlint.config.cjs` | Create | Extends `@commitlint/config-conventional` |
| `.husky/pre-commit` | Create (repo root) | Runs `cd app && npx lint-staged` |
| `.husky/commit-msg` | Create (repo root) | Runs `cd app && npx --no -- commitlint --edit "$1"` |
| `app/src/**/*.test.{ts,tsx}` | Modify | `jest.fn()` → `vi.fn()`, `jest.Mock` casts → `vi.mocked()`, `jest.spyOn` → `vi.spyOn`, `jest.mock` → `vi.mock` |
| `.github/workflows/ci.yml` | Modify | Node 22, new lint/test commands |
| `app/.gitignore` | Possibly modify | Ensure `.husky/_/` is ignored (husky 9 generates a `_` subdir) |

No source files outside tests are modified.

---

## Task 1: Add Vitest stack (no Jest removal yet)

**Why:** Land Vitest alongside Jest first. `vitest.config.ts` and `vitest.setup.ts` exist but the `test` script still runs Jest. This commit is bisect-safe (Jest still works); the next commit migrates test files.

**Files:**
- Modify: `app/package.json` (add devDeps, do not change scripts yet)
- Create: `app/vitest.config.ts`
- Create: `app/vitest.setup.ts`

- [ ] **Step 1: Install Vitest stack**

Run from `app/`:
```bash
npm install --save-dev vitest@^1.6.0 @vitest/ui@^1.6.0 jsdom@^24.0.0
```

Expected: succeeds; `package.json` `devDependencies` gains `vitest`, `@vitest/ui`, `jsdom`. `@testing-library/jest-dom` is already present and works for both Jest and Vitest — keep it.

- [ ] **Step 2: Create `app/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: [
			'src/**/__tests__/**/*.{ts,tsx}',
			'src/**/*.{test,spec}.{ts,tsx}',
		],
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
});
```

Tabs (size 2), single-quote, trailing-comma all — matches project style.

- [ ] **Step 3: Create `app/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfills para TextEncoder/TextDecoder
if (typeof TextEncoder === 'undefined') {
	(globalThis as any).TextEncoder = require('util').TextEncoder;
}

if (typeof TextDecoder === 'undefined') {
	(globalThis as any).TextDecoder = require('util').TextDecoder;
}

// Mock para o objeto chrome
(globalThis as any).chrome = {
	runtime: {
		sendMessage: vi.fn(),
		onMessage: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
		connect: vi.fn().mockReturnValue({
			onMessage: {
				addListener: vi.fn(),
			},
		}),
	},
	storage: {
		local: {
			get: vi.fn(),
			set: vi.fn(),
		},
	},
	tabs: {
		query: vi.fn(),
	},
};
```

Mirrors the existing `jest.setup.js` 1:1, only `jest.fn()` → `vi.fn()` and adds the explicit `vi` import (setup files run before globals are wired).

- [ ] **Step 4: Sanity check the new config (without yet running anything)**

Run from `app/`:
```bash
npx vitest --version
node -e "require('./vitest.config.ts')" 2>&1 || true   # may fail without vite — fine
```

Expected: `vitest --version` prints a version. Loading the config via `require` may fail (TS file); that's acceptable — Vitest's own loader will handle it in Task 2.

- [ ] **Step 5: Confirm Jest still works (regression net)**

Run from `app/`:
```bash
npm test
```

Expected: 10 suites pass, 59 passed + 1 skipped. Jest is unchanged in this commit.

- [ ] **Step 6: Commit**

Run from repo root:
```bash
git add app/package.json app/package-lock.json app/vitest.config.ts app/vitest.setup.ts
git commit -m "build(test): add Vitest stack alongside Jest"
```

---

## Task 2: Migrate test files Jest → Vitest API

**Why:** With Vitest configured, rewrite `jest.fn()` / `jest.Mock` casts to `vi.fn()` / `vi.mocked()` so test files run on Vitest. Keep imports out — `globals: true` exposes `vi`, `describe`, `test`, `expect`, etc.

**Files:**
- Modify: every `.test.ts` / `.test.tsx` file under `app/src/`. Inventory (10 files):
  - `app/src/ui/components/requests/__tests__/duration.test.ts`
  - `app/src/ui/components/__tests__/ResponseDialog.test.tsx`
  - `app/src/ui/components/__tests__/AppSidebar.test.tsx`
  - `app/src/ui/components/__tests__/ResponseList.test.tsx`
  - `app/src/ui/components/__tests__/SiteHeader.test.tsx`
  - `app/src/ui/hooks/__tests__/useRules.test.ts`
  - `app/src/ui/hooks/__tests__/useUrlPatterns.test.ts`
  - `app/src/ui/pages/__tests__/RequestHistory.test.tsx`
  - `app/src/ui/pages/__tests__/Requests.test.tsx`
  - `app/src/backend/services/__tests__/networkTiming.test.ts`

- [ ] **Step 1: Inventory Jest API usage**

Run from repo root:
```bash
grep -rn 'jest\.\(fn\|Mock\|spyOn\|mock\|useFakeTimers\|useRealTimers\|clearAllMocks\|resetAllMocks\|restoreAllMocks\|clearAllTimers\)\b' app/src --include='*.test.ts' --include='*.test.tsx' | sort -u
```

Capture the output. Every match is a migration target. If a Jest API appears that isn't in the list above (e.g. `jest.requireActual`, `jest.advanceTimersByTime`), STOP and consult the controller — every Jest API has a Vitest equivalent, but the mapping needs explicit choice.

- [ ] **Step 2: Replace `jest.fn()` with `vi.fn()`**

Run from repo root:
```bash
find app/src -name '*.test.ts' -o -name '*.test.tsx' | xargs sed -i '' 's/\bjest\.fn(/vi.fn(/g'
```

(`-i ''` is the macOS `sed` form. On Linux use `sed -i`.)

Verify:
```bash
grep -rn 'jest\.fn(' app/src --include='*.test.ts' --include='*.test.tsx'
```
Expected: no output.

- [ ] **Step 3: Replace `(X as jest.Mock)` casts with `vi.mocked(X)`**

Run from repo root:
```bash
find app/src -name '*.test.ts' -o -name '*.test.tsx' | xargs perl -i -pe 's/\(\s*([A-Za-z_][A-Za-z0-9_]*)\s+as\s+jest\.Mock\s*\)/vi.mocked($1)/g'
```

Verify:
```bash
grep -rn 'as jest\.Mock' app/src --include='*.test.ts' --include='*.test.tsx'
```
Expected: no output.

- [ ] **Step 4: Replace remaining `jest.<api>` calls**

Run from repo root:
```bash
find app/src -name '*.test.ts' -o -name '*.test.tsx' | xargs sed -i '' 's/\bjest\.spyOn\b/vi.spyOn/g; s/\bjest\.mock\b/vi.mock/g; s/\bjest\.useFakeTimers\b/vi.useFakeTimers/g; s/\bjest\.useRealTimers\b/vi.useRealTimers/g; s/\bjest\.clearAllMocks\b/vi.clearAllMocks/g; s/\bjest\.resetAllMocks\b/vi.resetAllMocks/g; s/\bjest\.restoreAllMocks\b/vi.restoreAllMocks/g; s/\bjest\.clearAllTimers\b/vi.clearAllTimers/g'
```

Verify there are no leftovers:
```bash
grep -rn 'jest\.' app/src --include='*.test.ts' --include='*.test.tsx'
```
Expected: no output. If any leftover remains (e.g. a Jest API not in the sed list), report BLOCKED — do not improvise.

- [ ] **Step 5: Run Vitest**

Run from `app/`:
```bash
npx vitest run
```

Expected: 10 test files pass, 59 passed + 1 skipped, 0 failed. Same totals as Jest.

If a test fails, fix the migration (typically a missed pattern). Common gotchas:
- `vi.mocked(X).mockReturnValue(...)` works the same as `(X as jest.Mock).mockReturnValue(...)`.
- `expect(...).toBeInTheDocument()` requires `@testing-library/jest-dom/vitest` — already imported in `vitest.setup.ts`.
- Asynchronous test imports may need `await import()` instead of `require()` — flag if you see `require` in test files.

- [ ] **Step 6: Confirm Jest is unaffected (regression net)**

Run from `app/`:
```bash
npm test
```

Expected: still 59 passed + 1 skipped. The migrated `jest.fn` → `vi.fn` would break Jest, BUT Vitest exposes `vi` as a global only via Vitest config; Jest doesn't define `vi`. So this step likely **fails**.

If `npm test` (Jest) fails because `vi is not defined`, that's expected — accept it. Note in the commit body that Jest is now broken (intentionally; will be removed in Task 3). DO NOT try to make Jest still work.

- [ ] **Step 7: Commit**

Run from repo root:
```bash
git add app/src
git commit -m "test: migrate test files from Jest API to Vitest API

jest.fn() → vi.fn(), (X as jest.Mock) → vi.mocked(X), jest.spyOn/mock/useFakeTimers/clearAllMocks
→ vi.* equivalents. Vitest globals: true exposes vi without explicit import.

Jest test runner is intentionally broken after this commit (no vi global in Jest).
Task 3 removes the Jest stack; Vitest is the sole runner from there on."
```

---

## Task 3: Remove Jest stack and switch test scripts to Vitest

**Why:** Migration is one-way after Task 2. Now delete Jest config/setup files and uninstall Jest devDeps; rewrite `test` scripts to invoke Vitest.

**Files:**
- Delete: `app/jest.config.cjs`
- Delete: `app/jest.setup.js`
- Modify: `app/package.json` (rewrite `scripts.test`, `test:watch`, `test:coverage`; remove Jest devDeps)
- Modify: `app/package-lock.json` (regenerated)

- [ ] **Step 1: Delete Jest config files**

Run from repo root:
```bash
git rm app/jest.config.cjs app/jest.setup.js
```

Expected: both files staged as deletions.

- [ ] **Step 2: Update `scripts` block in `app/package.json`**

Edit `app/package.json`. In the `"scripts"` block, replace exactly these three lines:

```diff
-    "test": "jest",
-    "test:watch": "jest --watch",
-    "test:coverage": "jest --coverage",
+    "test": "vitest run",
+    "test:watch": "vitest",
+    "test:coverage": "vitest run --coverage",
```

(The `lint` and `lint:fix` lines are still ESLint-based; they're updated in Task 5.)

- [ ] **Step 3: Remove Jest devDeps**

Run from `app/`:
```bash
npm uninstall jest jest-environment-jsdom ts-jest @types/jest
```

Expected: succeeds. `package.json` no longer lists `jest`, `jest-environment-jsdom`, `ts-jest`, `@types/jest` in `devDependencies`. Lockfile shrinks.

`@testing-library/jest-dom` is **kept** — it works with both Jest and Vitest (we use the `/vitest` subpath).

- [ ] **Step 4: Update `tsconfig.json` types array**

Edit `app/tsconfig.json`. In the `compilerOptions.types` array, replace `"jest"` with `"vitest/globals"`:

```diff
-    "types": ["jest", "@testing-library/jest-dom", "chrome"]
+    "types": ["vitest/globals", "@testing-library/jest-dom", "chrome"]
```

This makes TypeScript pick up Vitest's global types (since `globals: true`) and drops the now-removed Jest types.

- [ ] **Step 5: Run `npm install` to refresh lockfile**

Run from `app/`:
```bash
npm install
```

- [ ] **Step 6: Run all CI gates**

Run from `app/`:
```bash
npm run lint && npm test && npm run build
```

Expected: lint clean (still ESLint, until Task 5), `npm test` (now Vitest) passes 59/60, build succeeds.

- [ ] **Step 7: `tsc --noEmit` sanity check**

Run from `app/`:
```bash
npx tsc --noEmit
```

Expected: same pre-existing errors as Phase 0 baseline (TS6059 for `vite.config.mts` rootDir; possibly the same module-resolution warnings). **No new errors from removing `@types/jest`.** If a test file has a leftover `jest.*` reference that survived Task 2, it surfaces here.

- [ ] **Step 8: Commit**

Run from repo root:
```bash
git add app/package.json app/package-lock.json app/tsconfig.json
git commit -m "build(test): remove Jest stack; Vitest is the sole test runner"
```

(`git rm` from Step 1 already staged the deletions; they go in the same commit.)

---

## Task 4: Add Biome stack alongside ESLint+Prettier

**Why:** Same pattern as Task 1 — install + config first, no removals. ESLint+Prettier still authoritative until Task 5 swaps the scripts.

**Files:**
- Modify: `app/package.json` (add devDep)
- Modify: `app/package-lock.json` (regenerated)
- Create: `app/biome.json`

- [ ] **Step 1: Install Biome**

Run from `app/`:
```bash
npm install --save-dev --save-exact @biomejs/biome@1.9.4
```

`--save-exact` because Biome's rule set evolves between minors; pinning avoids surprise diffs during the migration window.

- [ ] **Step 2: Create `app/biome.json`**

```json
{
	"$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
	"vcs": {
		"enabled": true,
		"clientKind": "git",
		"useIgnoreFile": true
	},
	"files": {
		"ignore": [
			"dist/**",
			"node_modules/**",
			"coverage/**",
			"lib/**",
			"images/**",
			"package-lock.json",
			"src/types/codemirror.d.ts"
		]
	},
	"formatter": {
		"enabled": true,
		"indentStyle": "tab",
		"indentWidth": 2,
		"lineWidth": 100,
		"lineEnding": "lf"
	},
	"javascript": {
		"formatter": {
			"quoteStyle": "single",
			"trailingCommas": "all",
			"semicolons": "always",
			"arrowParentheses": "always",
			"jsxQuoteStyle": "double"
		}
	},
	"organizeImports": {
		"enabled": false
	},
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"suspicious": {
				"noExplicitAny": "off",
				"noArrayIndexKey": "off",
				"noConsoleLog": "off"
			},
			"style": {
				"useTemplate": "off",
				"noUselessElse": "off",
				"noNonNullAssertion": "off",
				"useImportType": "off"
			},
			"complexity": {
				"noUselessFragments": "off"
			},
			"correctness": {
				"noUnusedVariables": "off",
				"noUnusedImports": "off",
				"useExhaustiveDependencies": "warn"
			},
			"a11y": {
				"useKeyWithClickEvents": "off"
			}
		}
	}
}
```

Rule rationale: mirrors the current `eslint.config.js` posture. The current ESLint config explicitly turns off `no-unused-vars` and `no-explicit-any`; Biome's equivalents (`noUnusedVariables`, `noExplicitAny`) are turned off here too. `useExhaustiveDependencies` is `warn` (it's the React Hooks deps check; current ESLint stack runs `eslint-plugin-react-hooks` so it was already enforced). Other rules use Biome's `recommended` defaults.

- [ ] **Step 3: Smoke check Biome's view of the codebase**

Run from `app/`:
```bash
npx biome check src --max-diagnostics=20
```

Expected: lots of warnings/errors (formatting differences vs. Prettier are likely; some lint hits may exceed the disable list). Capture the count of errors/warnings — DO NOT auto-fix yet. The next task applies fixes systematically.

If Biome can't load the config (JSON schema error), STOP and fix the config before continuing.

- [ ] **Step 4: Commit**

Run from repo root:
```bash
git add app/package.json app/package-lock.json app/biome.json
git commit -m "build(lint): add Biome stack alongside ESLint and Prettier"
```

---

## Task 5: Apply Biome formatting and switch lint scripts

**Why:** Run `biome check --apply` once across `src/` to bring the codebase to Biome's formatting. Then point `lint`/`lint:fix`/`format` scripts at Biome. ESLint+Prettier still installed; removed in Task 6.

**Files:**
- Modify: `app/package.json` (rewrite `lint`, `lint:fix`; add `format`)
- Modify: many files under `app/src/` (formatter-driven; no behavior change)

- [ ] **Step 1: Apply Biome auto-fixes and formatting**

Run from `app/`:
```bash
npx biome check --apply src
```

Expected: rewrites whitespace/style across many files. The diff should be tabs/quote-style/trailing-comma — purely cosmetic.

If `biome check --apply` produces non-cosmetic diffs (logic changes, removed lines beyond formatting), STOP and report — Biome is misconfigured.

- [ ] **Step 2: Verify the diff is formatting-only**

Run from repo root:
```bash
git diff --stat
git diff app/src/backend/background.ts | head -60
```

Sanity-read the `background.ts` diff. Expected: tabs, semicolons, trailing commas, line wrapping at 100. No removed function calls, no swapped operators, no logic edits.

If anything looks like a behavior change, revert that file's edit (`git checkout -- app/src/backend/background.ts`) and STOP for review.

- [ ] **Step 3: Run remaining lint diagnostics (no auto-fix possible)**

Run from `app/`:
```bash
npx biome check src
```

Expected: zero errors. If lint warnings remain (e.g. `useExhaustiveDependencies`), accept them as warnings — they don't block.

If errors remain that aren't covered by the rule disables in `biome.json`, choose: (a) add a targeted rule disable to `biome.json`, or (b) fix the source. Default to (b) for ≤3 sites; (a) if it's a pattern across the codebase. Report the choice in the commit body.

- [ ] **Step 4: Update `scripts` block in `app/package.json`**

Edit `app/package.json`. Replace exactly these two lines and add a third:

```diff
-    "lint": "eslint src --ext .ts,.tsx,.js,.jsx",
-    "lint:fix": "eslint src --ext .ts,.tsx,.js,.jsx --fix",
+    "lint": "biome check src",
+    "lint:fix": "biome check --apply src",
+    "format": "biome format --write src",
```

- [ ] **Step 5: Confirm CI gates with Biome**

Run from `app/`:
```bash
npm run lint && npm test && npm run build
```

Expected: all three green. `npm run lint` is now Biome.

- [ ] **Step 6: Commit (formatting + scripts together)**

Run from repo root:
```bash
git add app/package.json app/src
git commit -m "style: format codebase with Biome and switch lint scripts

biome check --apply src normalized whitespace, semicolons, trailing commas, and
line wrapping. No behavior change. lint/lint:fix scripts now invoke Biome;
'format' script added. ESLint+Prettier devDeps remain installed (Task 6)."
```

The diff is large (formatting), but every change is mechanical. Commit body documents that.

---

## Task 6: Remove ESLint and Prettier stack

**Why:** Biome is now the linter+formatter; legacy stack is dead weight.

**Files:**
- Delete: `app/eslint.config.js`
- Delete: `app/.prettierrc`
- Modify: `app/package.json` (remove ESLint/Prettier devDeps)
- Modify: `app/package-lock.json` (regenerated)

- [ ] **Step 1: Delete the config files**

Run from repo root:
```bash
git rm app/eslint.config.js app/.prettierrc
```

- [ ] **Step 2: Uninstall ESLint+Prettier devDeps**

Run from `app/`:
```bash
npm uninstall eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser typescript-eslint eslint-config-google eslint-config-prettier eslint-plugin-jsx-a11y eslint-plugin-prettier eslint-plugin-react eslint-plugin-react-hooks prettier globals
```

Expected: succeeds; many packages removed. `globals` is removed because it was only used by the ESLint flat config.

If any of these packages are unexpectedly required by something else (e.g. another devDep depends on `prettier`), `npm uninstall` will leave it as a transitive — that's fine, the top-level entry is gone.

- [ ] **Step 3: Verify nothing else imports them**

Run from repo root:
```bash
grep -rn "from 'eslint'\|require('eslint')\|from 'prettier'\|require('prettier')" app/src
```

Expected: no output.

- [ ] **Step 4: Run all CI gates**

Run from `app/`:
```bash
rm -rf node_modules
npm ci
npm run lint && npm test && npm run build
```

Clean install confirms the lockfile is consistent and no peer-dep was hiding behind ESLint.

Expected: all green.

- [ ] **Step 5: Commit**

Run from repo root:
```bash
git add app/package.json app/package-lock.json
git commit -m "build(lint): remove ESLint and Prettier; Biome is the sole linter+formatter"
```

---

## Task 7: Add Husky + lint-staged + commitlint

**Why:** Enforce conventional-commits at commit time and auto-format staged files. Locks in the toolchain swap.

**Files:**
- Modify: `app/package.json` (add devDeps + `lint-staged` block + `prepare` script)
- Create: `app/commitlint.config.cjs`
- Create: `.husky/pre-commit` (repo root)
- Create: `.husky/commit-msg` (repo root)
- Modify: `.gitignore` if needed (husky 9 generates `.husky/_/`)

**Note on directory:** husky lives at the **repo root**, not under `app/`. The hook scripts `cd` into `app/` before running their commands. This matches `.github/workflows/ci.yml`'s `working-directory: app` pattern.

- [ ] **Step 1: Install hooks devDeps**

Run from `app/`:
```bash
npm install --save-dev husky@^9.1.0 lint-staged@^15.2.0 @commitlint/cli@^19.5.0 @commitlint/config-conventional@^19.5.0
```

- [ ] **Step 2: Add `prepare` script and `lint-staged` config to `app/package.json`**

Edit `app/package.json`. In the `"scripts"` block, add:

```diff
     "format": "biome format --write src",
+    "prepare": "cd .. && husky"
   },
```

(`cd ..` from `app/` puts husky at repo root, where `.husky/` will live.)

After `"scripts"`, before `"keywords"`, add a new top-level block:

```json
  "lint-staged": {
    "src/**/*.{ts,tsx,js,jsx,json}": [
      "biome check --apply --no-errors-on-unmatched"
    ]
  },
```

- [ ] **Step 3: Run `npm install` to trigger `prepare` and initialize husky**

Run from `app/`:
```bash
npm install
```

Expected: husky 9 creates `.husky/` at repo root (with a `_/` subdirectory containing internal scripts) and adds itself to `core.hooksPath` automatically.

- [ ] **Step 4: Create the pre-commit hook**

Create `.husky/pre-commit` at repo root with this exact content:

```sh
cd app && npx lint-staged
```

Then make it executable:
```bash
chmod +x .husky/pre-commit
```

- [ ] **Step 5: Create the commit-msg hook**

Create `.husky/commit-msg` at repo root with this exact content:

```sh
cd app && npx --no -- commitlint --edit "$1"
```

Then make it executable:
```bash
chmod +x .husky/commit-msg
```

- [ ] **Step 6: Create `app/commitlint.config.cjs`**

```js
module.exports = {
	extends: ['@commitlint/config-conventional'],
};
```

- [ ] **Step 7: Confirm `.husky/_/` is gitignored**

Run from repo root:
```bash
grep -E '^\.husky/_$|^\.husky/_/$' .gitignore || echo "not ignored"
```

If `not ignored`, append a line:
```bash
printf '\n# husky internals (auto-generated)\n.husky/_/\n' >> .gitignore
```

If already present, skip this step.

- [ ] **Step 8: Test the commit-msg hook (negative test)**

Run from repo root:
```bash
git add .husky/pre-commit .husky/commit-msg .gitignore app/package.json app/package-lock.json app/commitlint.config.cjs
git commit -m "wip" 2>&1 | head -20 || true
```

Expected: commit is **rejected** by commitlint with a message like "subject may not be empty / type may not be empty". Confirms the hook is wired.

(`|| true` keeps the shell from exiting on the expected failure.)

- [ ] **Step 9: Test the pre-commit hook (positive test)**

Modify any file under `app/src/` with a stray formatting issue (e.g. swap a tab for two spaces in a comment), then attempt a properly-named commit. The pre-commit hook should run lint-staged → biome auto-fix → re-stage the file. Final commit succeeds.

If the hook doesn't fire at all, confirm `git config --get core.hooksPath` reports `.husky` (or empty + husky 9 manages it via `~/.husky-init` style — depends on husky version). Inspect `.husky/_/` if present.

After verification, revert the throwaway formatting change.

- [ ] **Step 10: Commit with a valid Conventional Commit message**

Run from repo root:
```bash
git commit -m "build(hooks): add Husky, lint-staged, and commitlint for conventional commits"
```

Expected: commit-msg passes, pre-commit passes (no staged formatting issues), commit lands.

---

## Task 8: Update CI workflow

**Why:** CI was running `npm run lint`/`npm test` against ESLint/Jest. Now that those are gone, the workflow must use the new commands. Also bumps Node 20 → 22 LTS.

**Files:**
- Modify: `.github/workflows/ci.yml` (repo root)

- [ ] **Step 1: Read current workflow**

Run from repo root:
```bash
cat .github/workflows/ci.yml
```

The Phase 0 baseline: `node-version: 20`, steps `lint` (was eslint), `build`, `test` (was jest). Working directory `app`.

- [ ] **Step 2: Update node-version and step names**

Edit `.github/workflows/ci.yml`. Replace the entire file with:

```yaml
name: CI

on:
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Lint (Biome)
        run: npm run lint
      - name: Build
        run: npm run build
      - name: Test (Vitest)
        run: npm test
```

(Step names updated to be self-documenting; `npm run lint` and `npm test` now invoke Biome and Vitest respectively.)

- [ ] **Step 3: Validate YAML locally**

Run from repo root:
```bash
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))" 2>&1 | head -5 || echo "(js-yaml not available — skip)"
```

If `js-yaml` isn't available, run a simpler check:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 | head -5
```

Expected: no exception (no output means valid).

- [ ] **Step 4: Commit**

Run from repo root:
```bash
git add .github/workflows/ci.yml
git commit -m "ci: switch to Node 22, Biome lint, and Vitest test commands"
```

---

## Task 9: End-to-end verification

**Why:** Phase gate. No commit. Confirms the cumulative effect of Tasks 1–8 produced a clean, consistent stack.

- [ ] **Step 1: Clean install from scratch**

Run from `app/`:
```bash
rm -rf node_modules
npm ci
```

Expected: succeeds. Lockfile is internally consistent. The husky `prepare` script runs (installing the hooks from a known-good tree).

- [ ] **Step 2: Lint via Biome**

Run from `app/`:
```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 3: Format check (informational)**

Run from `app/`:
```bash
npx biome format --check src
```

Expected: zero diff. Confirms the codebase matches Biome's formatter exactly.

- [ ] **Step 4: Build**

Run from `app/`:
```bash
npm run build
```

Expected: succeeds. `app/dist/` populated as before (`background.js`, `index.html`, `main.js`, `manifest.json`, `styles.css`, `images/`, `lib/`).

- [ ] **Step 5: Test**

Run from `app/`:
```bash
npm test
```

Expected: 10 test files, 59 passed + 1 skipped, 0 failed. Same totals as Phase 0 baseline.

- [ ] **Step 6: Coverage check (sanity)**

Run from `app/`:
```bash
npm run test:coverage 2>&1 | tail -10
```

Expected: succeeds; outputs a coverage table. The exact percentages don't matter here — we're confirming the script runs.

If the coverage provider isn't available, install it as a follow-up: `npm install --save-dev @vitest/coverage-v8`. Mention it in the verification report.

- [ ] **Step 7: Hooks smoke test**

Run from repo root:
```bash
git commit --allow-empty -m "wip" 2>&1 | head -10 || true
git commit --allow-empty -m "chore: hooks smoke test"
```

Expected: first commit is rejected by commitlint ("type may not be empty" or similar). Second commit succeeds. Reset with:
```bash
git reset --hard HEAD~1
```

This leaves the branch clean.

- [ ] **Step 8: Confirm git history is in expected order**

Run from repo root:
```bash
git log --oneline -10
```

Expected (newest first; merge from main may shift the older entries):
```
<hash> ci: switch to Node 22, Biome lint, and Vitest test commands
<hash> build(hooks): add Husky, lint-staged, and commitlint for conventional commits
<hash> build(lint): remove ESLint and Prettier; Biome is the sole linter+formatter
<hash> style: format codebase with Biome and switch lint scripts
<hash> build(lint): add Biome stack alongside ESLint and Prettier
<hash> build(test): remove Jest stack; Vitest is the sole test runner
<hash> test: migrate test files from Jest API to Vitest API
<hash> build(test): add Vitest stack alongside Jest
<hash> ... (Phase 0 commits or earlier)
```

If the order or messages differ, do not amend — report to the controller.

- [ ] **Step 9: Manual smoke test (Chrome)**

Same procedure as Phase 0 verification: load `app/dist/` unpacked in `chrome://extensions`, click toolbar icon, pick a target tab, Start Debugging, trigger requests, confirm history populates, Stop Debugging.

Expected: identical UX to Phase 0. No new console errors in either the service worker or the interceptor page.

---

## Done criteria

- All 8 task commits present on the branch (Task 9 is verification, no commit).
- `npm ci && npm run lint && npm run build && npm test` from `app/` is green on a freshly-installed tree.
- `npx biome format --check src` reports zero diff.
- Commit-msg hook rejects non-conventional messages; pre-commit hook runs lint-staged on staged files.
- CI workflow uses Node 22, `biome check`, `vitest run`.
- Manual smoke test in Chrome: extension loads, debugging works, no new console errors.
- `git status` is clean.

Once those boxes are ticked, Phase 1 is ready to merge into `feature/refactor` (or `main`, if `feature/refactor` is being skipped now). The next plan (Phase 2 — Tailwind v4) depends on this baseline.
