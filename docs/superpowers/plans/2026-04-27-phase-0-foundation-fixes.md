# Phase 0 — Foundation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply purely corrective changes that establish a consistent baseline for the rest of the refactor — no functional changes, no user-visible diffs.

**Architecture:** Five small commits, each touching one concern: React 19 type alignment, shadcn `components.json` path fixes, deletion of MV2 dead-code utilities, and removal of a useless self-referencing dependency. Verified end-to-end with `npm run lint && npm run build && npm test`.

**Tech Stack:** Node 22, npm, TypeScript 5.3, Vite 6, ESLint 9, Jest 29 (this phase predates the toolchain swap).

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 0 — Foundation fixes".

**Working directory:** All commands run from `app/` unless noted otherwise.

---

## File Structure

| File | Action | Why |
|---|---|---|
| `app/package.json` | Modify | Bump `@types/react` and `@types/react-dom` to `^19`; remove self-ref `chrome-interceptor: file:` |
| `app/package-lock.json` | Modify (regenerated) | Side-effect of `npm install` after `package.json` changes |
| `app/components.json` | Modify | `tailwind.config` and `tailwind.css` point to non-existent paths |
| `app/src/backend/utils/extension-reloader.ts` | Delete | MV2 API (`getPackageDirectoryEntry`), not wired into build, confirmed dead by `CLAUDE.md` |
| `app/src/backend/utils/hot-reload.ts` | Delete | Same as above |

No new files created. No existing source files modified beyond config.

---

## Task 1: Bump `@types/react` and `@types/react-dom` to v19

**Why:** `react@^19` and `react-dom@^19` are installed but `@types/react@^18.2.67` and `@types/react-dom@^18.2.22` create type drift — JSX types and `useTransition`/`useActionState` signatures diverge between runtime and types.

**Files:**
- Modify: `app/package.json` (devDependencies block)
- Modify (regenerated): `app/package-lock.json`

- [ ] **Step 1: Read current entries**

Run from `app/`:
```bash
grep -E '"@types/react(-dom)?"' package.json
```

Expected:
```
    "@types/react": "^18.2.67",
    "@types/react-dom": "^18.2.22",
```

- [ ] **Step 2: Update `package.json`**

Edit `app/package.json` — in the `devDependencies` block, change exactly these two lines:

```diff
-    "@types/react": "^18.2.67",
-    "@types/react-dom": "^18.2.22",
+    "@types/react": "^19.0.0",
+    "@types/react-dom": "^19.0.0",
```

- [ ] **Step 3: Reinstall to refresh lockfile**

Run from `app/`:
```bash
npm install
```

Expected: succeeds without errors. The output mentions `added` / `changed` packages including `@types/react` and `@types/react-dom`.

- [ ] **Step 4: Type-check the entire source tree**

Run from `app/`:
```bash
npx tsc --noEmit
```

Expected: exits with status 0. (The project's `tsconfig.json` is non-strict, so the bump is mostly a no-op type-wise — this step catches accidental regressions only.)

- [ ] **Step 5: Build to confirm Vite still works**

Run from `app/`:
```bash
npm run build
```

Expected: build succeeds, `app/dist/` is populated with `background.js`, `index.html`, `main.js`, `manifest.json`, `images/`, `lib/`.

- [ ] **Step 6: Commit**

Run from the repo root:
```bash
git add app/package.json app/package-lock.json
git commit -m "chore(deps): bump @types/react and @types/react-dom to v19"
```

---

## Task 2: Fix `components.json` paths

**Why:** `app/components.json` declares `tailwind.config: "tailwind.config.js"` and `tailwind.css: "src/globals.css"`, but the real files are `app/tailwind.config.cjs` and `app/src/ui/globals.css`. Running `npm run shadcn:add <name>` fails or writes to wrong locations.

**Files:**
- Modify: `app/components.json`

- [ ] **Step 1: Confirm current state**

Run from `app/`:
```bash
cat components.json && ls -1 tailwind.config.* src/ui/globals.css 2>/dev/null
```

Expected output (relevant lines):
```
"config": "tailwind.config.js",
...
"css": "src/globals.css",
...
tailwind.config.cjs
src/ui/globals.css
```

This confirms the mismatch (`config` and `css` point to files that don't exist).

- [ ] **Step 2: Update `components.json`**

Edit `app/components.json`. Replace exactly these two values:

```diff
   "tailwind": {
-    "config": "tailwind.config.js",
-    "css": "src/globals.css",
+    "config": "tailwind.config.cjs",
+    "css": "src/ui/globals.css",
     "baseColor": "slate",
     "cssVariables": true
   },
```

- [ ] **Step 3: Verify the file is valid JSON and points to existing files**

Run from `app/`:
```bash
node -e "
  const c = require('./components.json');
  const fs = require('fs');
  if (!fs.existsSync(c.tailwind.config)) throw new Error('config path wrong: ' + c.tailwind.config);
  if (!fs.existsSync(c.tailwind.css)) throw new Error('css path wrong: ' + c.tailwind.css);
  console.log('OK:', c.tailwind.config, c.tailwind.css);
"
```

Expected:
```
OK: tailwind.config.cjs src/ui/globals.css
```

- [ ] **Step 4: Build sanity check (no behavior change expected)**

Run from `app/`:
```bash
npm run build
```

Expected: success. `components.json` is consumed by the shadcn CLI only, not by Vite, so this is a no-op for the build — but we still run it as a regression net.

- [ ] **Step 5: Commit**

Run from repo root:
```bash
git add app/components.json
git commit -m "fix(shadcn): point components.json to actual tailwind config and globals.css"
```

---

## Task 3: Delete `extension-reloader.ts`

**Why:** Uses MV2-only `chrome.runtime.getPackageDirectoryEntry`. Not imported by the build (`vite.config.mts` only references `background.ts`, `main.tsx`, `index.html`). Confirmed dead by the "Quirks" section of `CLAUDE.md`.

**Files:**
- Delete: `app/src/backend/utils/extension-reloader.ts`

- [ ] **Step 1: Confirm no live imports**

Run from repo root:
```bash
grep -rn 'extension-reloader' app/src --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx'
```

Expected: no output (zero matches). If any file does import it, **stop and re-evaluate** — the spec assumes this is dead code; if it's live, the deletion is wrong.

- [ ] **Step 2: Delete the file**

Run from repo root:
```bash
git rm app/src/backend/utils/extension-reloader.ts
```

Expected: `rm 'app/src/backend/utils/extension-reloader.ts'`.

- [ ] **Step 3: Run lint + build + test**

Run from `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all three succeed.

- [ ] **Step 4: Commit**

Run from repo root:
```bash
git commit -m "chore: remove dead MV2 extension-reloader utility"
```

---

## Task 4: Delete `hot-reload.ts`

**Why:** Same MV2-era hot-reload utility, also dead. Not imported by the build.

**Files:**
- Delete: `app/src/backend/utils/hot-reload.ts`

- [ ] **Step 1: Confirm no live imports of the module**

Run from repo root:
```bash
grep -rn "from .*hot-reload'" app/src --include='*.ts' --include='*.tsx'
```

Expected: no output.

(Note: `grep -rn 'hot-reload' app/src` will find the literal string `'hot-reload'` *inside* `hot-reload.ts` itself — that's fine, it's a port name used in the file's own code. Only matches outside the file would be a problem, hence the `from .*hot-reload'` filter above.)

- [ ] **Step 2: Delete the file**

Run from repo root:
```bash
git rm app/src/backend/utils/hot-reload.ts
```

Expected: `rm 'app/src/backend/utils/hot-reload.ts'`.

- [ ] **Step 3: Verify the `utils/` directory is now empty (and remove if so)**

Run from repo root:
```bash
ls app/src/backend/utils/ 2>/dev/null && echo "still has files" || echo "directory gone or empty"
```

If the directory still exists and is empty, remove it:
```bash
rmdir app/src/backend/utils 2>/dev/null || true
```

(`git rm` already removed the tracked files. The `rmdir` only succeeds if empty; the `|| true` prevents failure when the dir is non-empty for any reason.)

- [ ] **Step 4: Run lint + build + test**

Run from `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all three succeed.

- [ ] **Step 5: Commit**

Run from repo root:
```bash
git commit -m "chore: remove dead MV2 hot-reload utility"
```

---

## Task 5: Remove self-referencing `chrome-interceptor` dependency

**Why:** `app/package.json` lists `"chrome-interceptor": "file:"` in `dependencies` — a self-reference that resolves to the package itself, contributes nothing, and confuses tools that walk the dependency graph (notably some auditors and `npm ls`).

**Files:**
- Modify: `app/package.json`
- Modify (regenerated): `app/package-lock.json`

- [ ] **Step 1: Confirm the entry exists**

Run from `app/`:
```bash
grep '"chrome-interceptor"' package.json
```

Expected:
```
    "chrome-interceptor": "file:",
```

- [ ] **Step 2: Remove the line from `package.json`**

Edit `app/package.json`. In the `dependencies` block, delete exactly this line:

```diff
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.0",
-    "chrome-interceptor": "file:",
     "glob": "^11.0.1",
```

(The exact surrounding lines may differ in your local copy — the rule is: delete the `chrome-interceptor` entry and only that line.)

- [ ] **Step 3: Refresh lockfile**

Run from `app/`:
```bash
npm install
```

Expected: succeeds. `npm ls chrome-interceptor` (run optionally) should now report only the top-level package itself, not a nested copy.

- [ ] **Step 4: Run lint + build + test**

Run from `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all three succeed.

- [ ] **Step 5: Commit**

Run from repo root:
```bash
git add app/package.json app/package-lock.json
git commit -m "chore: drop self-referencing chrome-interceptor dependency"
```

---

## Task 6: End-to-end verification

**Why:** Phase gate. Confirms the cumulative effect of Tasks 1–5 produced a clean, buildable, testable baseline. No commit at the end — this task only verifies.

- [ ] **Step 1: Clean install from scratch**

Run from `app/`:
```bash
rm -rf node_modules
npm ci
```

Expected: succeeds without warnings about peer-dep conflicts on `@types/react`. (Some unrelated warnings — e.g. deprecation notices — are acceptable.)

- [ ] **Step 2: Lint**

Run from `app/`:
```bash
npm run lint
```

Expected: exits 0, zero errors.

- [ ] **Step 3: Type-check + build**

Run from `app/`:
```bash
npm run build
```

Expected: exits 0. `app/dist/` contains `background.js`, `index.html`, `main.js`, `manifest.json`, `styles.css`, `images/`, `lib/`.

- [ ] **Step 4: Tests**

Run from `app/`:
```bash
npm test -- --runInBand
```

Expected: all suites pass, no skipped suites that weren't skipped before.

- [ ] **Step 5: Manual smoke test (Chrome)**

1. Open `chrome://extensions`.
2. Enable Developer mode (top right).
3. If a previous unpacked Debug Buddy is loaded, click "Remove".
4. Click "Load unpacked" and select `app/dist/`.
5. Click the Debug Buddy toolbar icon — the interceptor tab opens.
6. In the UI, click the tab selector, pick any non-extension tab.
7. Click "Start Debugging" — Chrome's "started debugging this browser" warning bar appears on the target tab.
8. Trigger any network request on the target tab (e.g. reload it).
9. Confirm the request appears in the "Request History" page of the interceptor.
10. Click "Stop Debugging".

Expected: every step works exactly as it did before this phase. No new console errors in the service-worker DevTools or the interceptor page.

- [ ] **Step 6: Confirm git history is clean and ordered**

Run from repo root:
```bash
git log --oneline -7
```

Expected: the last five commits are exactly (in order, newest first):
```
<hash> chore: drop self-referencing chrome-interceptor dependency
<hash> chore: remove dead MV2 hot-reload utility
<hash> chore: remove dead MV2 extension-reloader utility
<hash> fix(shadcn): point components.json to actual tailwind config and globals.css
<hash> chore(deps): bump @types/react and @types/react-dom to v19
<hash> docs: spec for incremental refactor and modernization
<hash> fix: surface capture failures, unblock pass-through, and time redirect hops
```

If the order or messages differ, **do not amend** — investigate and consult the user before fixing.

---

## Done criteria

- All five Task commits present on the branch.
- `npm ci && npm run lint && npm run build && npm test` from `app/` is green.
- Manual smoke test in Chrome: extension loads, debugging starts/stops, requests appear in history, no new console errors.
- `git status` is clean.

Once those four boxes are ticked, this phase is ready to merge into `main`. The next plan (`Phase 1 — Toolchain swap`) depends on this baseline.
