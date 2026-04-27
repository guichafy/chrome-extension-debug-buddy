# Phase 4 — Strict TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `strict: true` in `app/tsconfig.json` and add `tsc --noEmit` as a CI gate, so type errors fail the build instead of accumulating silently.

**Architecture:** The audit (run while planning) revealed only **7 pre-existing errors** under strict mode — all in test files, none in production source. The codebase is already strict-compliant in source code. The blockers are: (a) `tsconfig.json` has `include: "./**/*"` which catches config files (`vite.config.mts`, `vitest.config.ts`, `vitest.setup.ts`) outside `rootDir: "./src"` and produces TS6059 errors that abort tsc before it can type-check anything; (b) 6 test-mock fixtures use partial-shape objects that don't match the full hook return types; (c) 1 transitive type lookup for `jest` from `@testing-library/jest-dom` package.

**Tech Stack:** TypeScript 5.3, Vitest 1.6, Biome 1.9.4 (already enforced — strict TS doesn't conflict with Biome's lint-only ignores of `noUnusedImports`/`noUnusedVariables`).

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 4 — Strict TS gradual".

**Working directory:** `app/` for npm/biome/tsc commands; repo root for git, `.github/workflows/`, and the docs files.

**Worktree:** Execute in a dedicated worktree (e.g. `/.claude/worktrees/<name>`) created from `main` (Phase 3 already merged via PR #35).

**Spec deviation acknowledged:** The spec wording suggested using `// @ts-expect-error` for hard-to-fix sites with TODO + issue. The actual audit shows no such sites exist — every error is mechanically fixable in 1–10 lines of code. We do NOT introduce any `@ts-expect-error` directives.

---

## Audit summary (captured during planning)

Running `tsc --noEmit --strict --rootDir .` (rootDir override to bypass TS6059) on `main` produces:

| TS code | Count | Location | Meaning | Fix |
|---|---|---|---|---|
| TS2688 | 1 | `node_modules/@testing-library/jest-dom/types/jest.d.ts` | Cannot find type definition file for 'jest' | Enable `skipLibCheck: true` (industry standard for projects with mixed test deps) |
| TS2345 | 4 | `RequestHistory.test.tsx:43,48,54`, `Requests.test.tsx:46` | Partial mock objects don't satisfy widened hook return types | Cast each mock site to `any` with a justifying comment, OR provide complete mock objects |
| TS2353 | 2 | `RequestHistory.test.tsx:75`, `Requests.test.tsx:37` | Test fixtures specify `id` property that doesn't exist on `InterceptedResponse` | Drop the `id` field from the fixture (the property never existed on the production type; tests added it as test-only metadata) |

Total: **7 errors**, all in test files except the one transitive `node_modules` warning.

`--strict` does NOT include `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns` / `noFallthroughCasesInSwitch`. Those flags are kept off (matching the project's posture where Biome's `noUnusedImports`/`noUnusedVariables` are also disabled).

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `app/tsconfig.json` | Modify | Restrict `include` so config files don't match; flip `strict: true`; remove now-redundant individual strict-disable flags; add `skipLibCheck: true`. |
| `app/src/ui/pages/__tests__/RequestHistory.test.tsx` | Modify | Fix 4 type errors (3× partial mock; 1× obsolete `id` field). |
| `app/src/ui/pages/__tests__/Requests.test.tsx` | Modify | Fix 2 type errors (1× partial mock; 1× obsolete `id` field). |
| `app/package.json` | Modify | Add `"typecheck": "tsc --noEmit"` script. |
| `.github/workflows/ci.yml` | Modify | Add `Typecheck (tsc)` step between `Lint (Biome)` and `Build`. |
| `CLAUDE.md` | Modify | Remove the "TS is intentionally non-strict" sentence; replace with strict-mode language and a brief note on `@ts-expect-error` usage if needed. |
| `AGENTS.md` | Modify | Same as CLAUDE.md. |

No new files created. No source files outside the test fixtures modified.

---

## Task 1: Fix `tsconfig.json` structure (so `tsc` can complete a type-check)

**Why:** `tsconfig.json` has `"include": ["./**/*"]` plus `"rootDir": "./src"`. The include glob picks up `vite.config.mts`, `vitest.config.ts`, and `vitest.setup.ts` (all at `app/`), but those are outside `rootDir`. tsc reports TS6059 and aborts before type-checking source. We need tsc to complete the check, otherwise the strict flip is silent.

**Files:**
- Modify: `app/tsconfig.json`

- [ ] **Step 1: Read the current `app/tsconfig.json`**

```bash
cat app/tsconfig.json
```

Capture the full contents. Expected to look like this (lines may differ slightly):

```json
{
	"compileOnSave": true,
	"compilerOptions": {
		"target": "ES2020",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"jsx": "react-jsx",
		"strict": false,
		"noImplicitAny": false,
		"strictNullChecks": false,
		...
	},
	"include": ["./**/*"],
	"exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Restrict `include` and refine `exclude`**

Replace the `include` and `exclude` blocks with:

```json
	"include": ["./src/**/*"],
	"exclude": ["node_modules", "dist", "coverage", "lib", "vite.config.mts", "vitest.config.ts", "vitest.setup.ts"]
```

The redundant explicit excludes are belt-and-suspenders — `include: ./src/**/*` alone is sufficient, but listing the config files in `exclude` documents the intent and protects against future include-glob loosening.

- [ ] **Step 3: Verify tsc completes without TS6059**

Run from `app/`:
```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero TS6059 errors. May still show the 7 pre-existing errors documented in the audit (handled by Tasks 2 and 3) — but tsc reaches them, which proves it's actually type-checking the source.

- [ ] **Step 4: Confirm build still works**

```bash
npm run build
```

Expected: succeeds (Vite uses esbuild and ignores tsconfig.json's include for the build).

- [ ] **Step 5: Confirm tests still work**

```bash
npm test
```

Expected: 59/60 pass (Vitest ignores tsconfig.json's include — it has its own discovery via `vitest.config.ts`).

- [ ] **Step 6: Commit**

```bash
git add app/tsconfig.json
git commit -m "build(ts): restrict tsconfig include to src to allow tsc --noEmit"
```

---

## Task 2: Fix test-fixture type errors

**Why:** Six type errors in two test files. They're pre-existing — the test fixtures don't match the actual hook return shapes — but tsc never surfaced them because TS6059 aborted earlier and `strict: false` masked some of them. After Task 1, tsc reaches these. Fix before flipping strict.

**Files:**
- Modify: `app/src/ui/pages/__tests__/RequestHistory.test.tsx`
- Modify: `app/src/ui/pages/__tests__/Requests.test.tsx`

- [ ] **Step 1: Inventory the errors**

From `app/`:
```bash
npx tsc --noEmit 2>&1 | grep -E "RequestHistory.test|Requests.test" | head -20
```

Expected output: 6 errors (3 in each file). All TS2345 (partial mock) or TS2353 (extra property `id`).

- [ ] **Step 2: Inspect the failing call sites in `RequestHistory.test.tsx`**

Read the relevant lines:
```bash
sed -n '40,80p' app/src/ui/pages/__tests__/RequestHistory.test.tsx
```

You'll see calls like:
```tsx
vi.mocked(useResponses).mockReturnValue({
	ignoreResponse: vi.fn(),
	clearCurrentResponse: vi.fn(),
});
```

The hook's actual return type is `{ pendingResponses, currentResponseId, currentResponse, loading, ignoreResponse, ... }` — many more fields. The mock provides only 2.

- [ ] **Step 3: Apply the fix at each call site**

For each `vi.mocked(useXxx).mockReturnValue({ ... })` that's flagged, replace with `vi.mocked(useXxx).mockReturnValue({ ... } as any)` and add a one-line comment explaining the intent:

```tsx
// Partial mock — only the fields exercised by this test are populated.
vi.mocked(useResponses).mockReturnValue({
	ignoreResponse: vi.fn(),
	clearCurrentResponse: vi.fn(),
} as any);
```

`as any` is acceptable here for the same reason `noExplicitAny` is disabled in Biome — test fixtures are exempt from production type rigor, and the production code paths still get full type-checking.

Apply this pattern at three sites in `RequestHistory.test.tsx` (lines 43, 48, 54) and one site in `Requests.test.tsx` (line 46).

- [ ] **Step 4: Drop the obsolete `id` field from `InterceptedResponse` fixtures**

In `RequestHistory.test.tsx` line 75 area and `Requests.test.tsx` line 37 area, the test fixture builds an `InterceptedResponse` object with an `id` property that doesn't exist on the actual type. Inspect:
```bash
sed -n '70,85p' app/src/ui/pages/__tests__/RequestHistory.test.tsx
sed -n '32,45p' app/src/ui/pages/__tests__/Requests.test.tsx
```

The fixture probably looks like:
```tsx
const sampleResponse: InterceptedResponse = {
	id: 'sample-1',
	url: '...',
	...
};
```

Two options:
- **(a) Drop the `id` field** if it's not used elsewhere in the test.
- **(b) Cast as `InterceptedResponse & { id: string }`** if the test relies on `id` (e.g. for keying a Map).

Inspect the test bodies to decide. Most likely option (a): drop the field.

- [ ] **Step 5: Re-run `tsc --noEmit`**

From `app/`:
```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head
```

Expected: only 1 remaining error — the `TS2688: Cannot find type definition file for 'jest'` in `node_modules/@testing-library/jest-dom/types/jest.d.ts`. That's handled in Task 3 via `skipLibCheck`.

- [ ] **Step 6: Confirm tests still pass**

From `app/`:
```bash
npm test
```

Expected: 59/60 pass. The fixture changes are runtime no-ops (the production code never read `id` from the InterceptedResponse).

- [ ] **Step 7: Commit**

```bash
git add app/src/ui/pages/__tests__/RequestHistory.test.tsx app/src/ui/pages/__tests__/Requests.test.tsx
git commit -m "test: fix partial mocks and drop obsolete id field on InterceptedResponse"
```

---

## Task 3: Enable strict mode + add `tsc --noEmit` to CI

**Why:** With Tasks 1 and 2 done, `tsc --noEmit` runs cleanly except for the one transitive `jest.d.ts` error. Enable strict mode in `tsconfig.json`, add `skipLibCheck: true`, expose a `typecheck` npm script, and wire it into CI so type errors fail PRs.

**Files:**
- Modify: `app/tsconfig.json`
- Modify: `app/package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update `app/tsconfig.json` to flip strict mode**

Replace the `compilerOptions` block as follows. Find:
```json
		"strict": false,
		"noImplicitAny": false,
		"strictNullChecks": false,
		"strictFunctionTypes": false,
		"strictBindCallApply": false,
		"strictPropertyInitialization": false,
		"noImplicitThis": false,
		"alwaysStrict": false,
		"noUnusedLocals": false,
		"noUnusedParameters": false,
		"noImplicitReturns": false,
		"noFallthroughCasesInSwitch": false,
```

Replace with:
```json
		"strict": true,
		"skipLibCheck": true,
```

Drop the individual strict-disable flags (they were overriding strict to false). Keep `noUnusedLocals`/`noUnusedParameters`/`noImplicitReturns`/`noFallthroughCasesInSwitch` OFF — these are not part of `strict` and the project policy (matching Biome's `noUnusedImports`/`noUnusedVariables: off`) is to not enforce them.

`skipLibCheck: true` is the canonical fix for the `@testing-library/jest-dom` `jest.d.ts` issue. It tells tsc to skip type-checking declaration files in `node_modules`, which is industry standard for application projects (libraries should leave it off).

- [ ] **Step 2: Verify tsc is now clean**

From `app/`:
```bash
npx tsc --noEmit
```

Expected: exits 0. No errors.

- [ ] **Step 3: Add `typecheck` script to `app/package.json`**

In the `"scripts"` block, add:
```diff
		"format": "biome format --write src",
+		"typecheck": "tsc --noEmit",
		"prepare": "cd .. && husky"
```

- [ ] **Step 4: Wire `typecheck` into CI**

Edit `.github/workflows/ci.yml`. Add a `Typecheck (tsc)` step between `Lint (Biome)` and `Build`:

```diff
			- name: Lint (Biome)
				run: npm run lint
+			- name: Typecheck (tsc)
+				run: npm run typecheck
			- name: Build
				run: npm run build
			- name: Test (Vitest)
				run: npm test
```

(Tab-indented YAML keys; the project's `.editorconfig` has YAML on tabs — verify by reading the existing file before editing.)

- [ ] **Step 5: Run all gates locally to confirm CI parity**

From `app/`:
```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green.

- [ ] **Step 6: Commit**

```bash
git add app/tsconfig.json app/package.json .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
build(ts): enable strict mode and add tsc --noEmit to CI

- tsconfig.json: strict: true (drops the individual strict-disable
  flags that were overriding it). skipLibCheck: true to skip
  @testing-library/jest-dom's transitive jest.d.ts type lookup.
- noUnusedLocals/noUnusedParameters/noImplicitReturns/noFallthroughCasesInSwitch
  remain OFF — those are not part of 'strict' and the project policy
  (matching Biome's noUnusedImports/noUnusedVariables: off) is to not
  enforce them.
- package.json: 'typecheck' script runs tsc --noEmit.
- ci.yml: 'Typecheck (tsc)' step runs between Lint and Build.

Source code is already strict-clean (audited via tsc with --strict
override before this change). Only test-fixture type errors needed
fixing — Task 2 of this phase handled those.
EOF
)"
```

---

## Task 4: Refresh `CLAUDE.md` and `AGENTS.md`

**Why:** Both docs say "TS is intentionally non-strict" — the source of that statement was Phase 0, before strict was a real possibility. Now that strict is on, the line is misleading.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Locate the section**

Both files have a `## TypeScript & lint` section (around line 124–128). The bullet to update is:

```
- **TS is intentionally non-strict** (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, etc. — see `app/tsconfig.json`). Don't tighten globally without coordinating; lots of code relies on the looseness (e.g. `message: any` in the background listener). Phase 4 of the refactor will revisit this.
```

- [ ] **Step 2: Replace with strict-mode language**

In both `CLAUDE.md` and `AGENTS.md`, replace the bullet above with:

```
- **TS is strict** (`strict: true` in `app/tsconfig.json`). `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables` are all enforced. `tsc --noEmit` runs in CI as a separate step from `lint` and `build`. `noUnusedLocals`/`noUnusedParameters` are deliberately off (matching Biome's `noUnusedImports`/`noUnusedVariables` posture). When a third-party type is too loose to model precisely (rare), use `as any` with a one-line comment OR `// @ts-expect-error: <motivo>` with a TODO and an issue link — both should be uncommon.
```

The replacement is identical between the two files (per the parallel-doc convention; only the title and intro line differ).

- [ ] **Step 3: Verify parity between the two files**

From repo root:
```bash
diff CLAUDE.md AGENTS.md | head -8
```

Expected output: only the title/intro line differs (CLAUDE.md vs AGENTS.md, "Claude Code" vs "Codex"). All other content matches.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update CLAUDE.md and AGENTS.md to reflect strict TS"
```

---

## Task 5: End-to-end verification

**Why:** Phase gate. No commit. Confirms the cumulative effect.

- [ ] **Step 1: Clean install**

From `app/`:
```bash
rm -rf node_modules
npm ci
```

- [ ] **Step 2: All four CI gates**

From `app/`:
```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green.

- [ ] **Step 3: Coverage**

```bash
npm run test:coverage 2>&1 | tail -5
```

Expected: succeeds.

- [ ] **Step 4: Hooks smoke test**

From repo root:
```bash
git commit --allow-empty -m "wip" 2>&1 | tail -5 || true
git commit --allow-empty -m "chore: phase 4 hooks smoke test"
git reset --hard HEAD~1
```

Expected: commitlint rejects "wip"; valid commit lands; reset returns to clean state.

- [ ] **Step 5: Manual smoke test in Chrome**

Build, load `app/dist/` unpacked, exercise interception. Strict mode is a TS-only change with no runtime impact, but the smoke test confirms no surprise compile-time refactor leaked into runtime behavior.

- [ ] **Step 6: Confirm git history**

From repo root:
```bash
git log --oneline main..HEAD
```

Expected (newest first):
```
<hash> docs: update CLAUDE.md and AGENTS.md to reflect strict TS
<hash> build(ts): enable strict mode and add tsc --noEmit to CI
<hash> test: fix partial mocks and drop obsolete id field on InterceptedResponse
<hash> build(ts): restrict tsconfig include to src to allow tsc --noEmit
<hash> docs: implementation plan for Phase 4 (strict TS)
```

---

## Done criteria

- All 4 task commits present on the branch (Task 5 is verification, no commit).
- `npm ci && npm run lint && npm run typecheck && npm run build && npm test` from `app/` is green on a freshly-installed tree.
- `app/tsconfig.json` has `"strict": true` and `"skipLibCheck": true`.
- `.github/workflows/ci.yml` has a `Typecheck (tsc)` step between `Lint` and `Build`.
- `CLAUDE.md` and `AGENTS.md` document strict mode (no longer "intentionally non-strict").
- `git status` is clean.

Once those boxes are ticked, Phase 4 is ready to merge into `main`. The next plan (Phase 5 — Visual refresh) depends on this baseline.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hidden source-level strict errors that the rootDir-broken tsc never reached | Low | The Task 1 → Task 2 sequence forces tsc to complete a full pass. If new errors surface during execution, fix them before merging Task 3. |
| `as any` casts in test fixtures hide real production type drift | Low | Production code paths still get full strict checking. The `as any` is scoped to test-side mocks where the alternative is reproducing the entire hook return shape — verbose, no real safety win. |
| `skipLibCheck: true` masks a real `@testing-library/jest-dom` problem | Low | The specific issue is a transitive jest.d.ts type lookup that doesn't affect runtime. Vitest uses `@testing-library/jest-dom/vitest` directly. If a real type drift in `@testing-library/jest-dom` surfaces, the test runtime would catch it. |
| Adding `typecheck` to CI slows builds | Low | tsc on this codebase finishes in <2s. Negligible. |
| Future contributors disable `strict` to bypass an error | Medium | The `## TypeScript & lint` section in CLAUDE.md/AGENTS.md explicitly documents the policy. Strict bypass via `as any` is the documented escape hatch with a clear "should be uncommon" rule. |
| `useUnknownInCatchVariables` (part of strict) breaks existing `catch (e)` blocks | Medium | The audit in the plan's Architecture section explicitly tested with `--strict` and found 0 source errors. Any `catch (e)` blocks compile cleanly. If a `catch (e)` block accesses `e.message` directly, TypeScript would flag it. The audit ran on every source file and found zero such issues. |
