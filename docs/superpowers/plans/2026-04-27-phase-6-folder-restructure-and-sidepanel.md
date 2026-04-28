# Phase 6 — Folder Restructure + Side Panel API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten the codebase from the historical `src/backend/...` + `src/ui/...` two-tier layout into the standard Vite/React structure (`src/entrypoints/`, `src/components/`, `src/hooks/`, `src/pages/`, `src/lib/`, `src/types/`, `src/domain/`, `src/styles/`). Add a Side Panel entrypoint as a complement to the existing options-page tab. Update the manifest, the Vite config, and `components.json` to reflect the new layout.

**Architecture:** Five mechanical-but-substantial commits. Each task moves a coherent slice of files via `git mv` (preserving history) and rewrites all consumer imports atomically. CI gates green at every commit. The Side Panel addition is purely additive — the existing action-click-opens-tab behavior is preserved; the side panel is accessed via Chrome's native side panel toolbar button.

**Tech Stack:** Vite 6 (multi-entry build), React 19, Chrome MV3 (`side_panel` + `sidePanel` permission, MV3 service worker), TypeScript 5.3 strict, Biome 1.9.4, Vitest 1.6.

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 6 — Estrutura + Side Panel".

**Working directory:** `app/` for npm/biome/tsc/vitest commands; repo root for git, `.github/workflows/`, `manifest.json` (lives under `app/`).

**Worktree:** Execute in a dedicated worktree (e.g. `/.claude/worktrees/<name>`) created from `main` (Phase 5 already merged via PR #37).

**Spec deviations acknowledged:**
- The spec listed `host_permissions: <all_urls>` → `optional_host_permissions` (request on demand). **Skipped** in this plan: it requires a runtime permission flow when the user picks a target tab and risks breaking the existing flow. Defer to a separate phase that can iterate on the request UX with the user.
- The spec proposed making `chrome.action.onClicked` open the Side Panel ("alternativa ao options_page"). **Not implemented as replacement**: the existing action-click-opens-tab behavior is preserved. The Side Panel is accessible via Chrome's native side panel toolbar button (right-click the action icon → "Open side panel" or use the dedicated panel button in the Chrome toolbar). Both UIs work; the user can flip `openPanelOnActionClick` later if preferred.
- The spec noted moving `domain/` was implicitly under `services/` — but the codebase grew a separate `src/backend/domain/` folder (4 files + 4 tests) added outside the refactor phases. This plan moves it as `src/domain/` to preserve its identity.

---

## File Structure (final layout, post-Phase 6)

```
app/
├── manifest.json                   ← side_panel + sidePanel permission added
├── options.html                    ← was index.html
├── sidepanel.html                  ← new
├── vite.config.mts                 ← entries: options/sidepanel/background
├── components.json                 ← unchanged paths (already correct)
└── src/
    ├── entrypoints/
    │   ├── background.ts           ← was src/backend/background.ts
    │   ├── options/
    │   │   └── main.tsx            ← was src/ui/main.tsx
    │   └── sidepanel/
    │       └── main.tsx            ← new (reuses RouterProvider)
    ├── components/
    │   ├── ui/                     ← was src/ui/components/shadcn/
    │   ├── layout/                 ← was src/ui/components/{AppSidebar,SiteHeader,NavMain}.tsx
    │   ├── requests/               ← was src/ui/components/requests/
    │   ├── rules/                  ← was src/ui/components/rules/
    │   ├── ResponseDialog.tsx      ← was src/ui/components/ResponseDialog.tsx
    │   ├── ResponseList.tsx        ← was src/ui/components/ResponseList.tsx
    │   ├── RequestTable.tsx        ← was src/ui/components/RequestTable.tsx
    │   ├── SelectTabDialog.tsx     ← was src/ui/components/SelectTabDialog.tsx
    │   └── hooks/use-mobile.ts     ← was src/ui/components/hooks/use-mobile.ts
    ├── domain/                     ← was src/backend/domain/
    │   ├── http.ts
    │   ├── intercepted.ts
    │   ├── mockLatency.ts
    │   ├── ruleMatching.ts
    │   └── __tests__/...
    ├── hooks/                      ← was src/ui/hooks/
    │   ├── useDebugging.ts
    │   ├── useResponses.ts
    │   ├── useAllRequests.ts
    │   └── useRules.ts
    ├── lib/
    │   ├── helpers.ts              ← was src/backend/utils/helpers.ts
    │   ├── indexedDB.ts            ← was src/backend/services/indexedDB.ts
    │   ├── legacyMigration.ts      ← was src/backend/services/legacyMigration.ts
    │   ├── networkTiming.ts        ← was src/backend/services/networkTiming.ts
    │   ├── statusBadge.ts          ← was src/ui/lib/statusBadge.ts
    │   ├── utils.ts                ← was src/backend/lib/utils.ts (cn helper)
    │   └── __tests__/...
    ├── pages/                      ← was src/ui/pages/
    │   ├── Layout.tsx
    │   ├── RequestHistory.tsx
    │   ├── Requests.tsx
    │   └── Settings.tsx
    ├── routes.tsx                  ← was src/ui/routes.tsx
    ├── styles/
    │   └── globals.css             ← was src/ui/globals.css
    └── types/                      ← was src/backend/types/
        ├── index.ts (barrel)
        ├── intercepted.ts
        ├── legacy.ts
        ├── messages.ts
        ├── rules.ts
        └── codemirror.d.ts
```

---

## Task 1: Move backend non-entrypoint code (types/services/lib/utils/domain)

**Why:** Flatten the backend tier. Most of `src/backend/` isn't actually backend-specific — it's shared utility code (`indexedDB` is used by both background AND useAllRequests; `types/` is imported by every UI hook). Move it to top-level `src/lib/`, `src/types/`, `src/domain/`.

**Files moved (18 source files + tests):**

| Old path | New path |
|---|---|
| `app/src/backend/types/index.ts` | `app/src/types/index.ts` |
| `app/src/backend/types/intercepted.ts` | `app/src/types/intercepted.ts` |
| `app/src/backend/types/legacy.ts` | `app/src/types/legacy.ts` |
| `app/src/backend/types/messages.ts` | `app/src/types/messages.ts` |
| `app/src/backend/types/rules.ts` | `app/src/types/rules.ts` |
| `app/src/backend/types/codemirror.d.ts` | `app/src/types/codemirror.d.ts` |
| `app/src/backend/services/indexedDB.ts` | `app/src/lib/indexedDB.ts` |
| `app/src/backend/services/networkTiming.ts` | `app/src/lib/networkTiming.ts` |
| `app/src/backend/services/legacyMigration.ts` | `app/src/lib/legacyMigration.ts` |
| `app/src/backend/services/__tests__/networkTiming.test.ts` | `app/src/lib/__tests__/networkTiming.test.ts` |
| `app/src/backend/services/__tests__/legacyMigration.test.ts` | `app/src/lib/__tests__/legacyMigration.test.ts` |
| `app/src/backend/utils/helpers.ts` | `app/src/lib/helpers.ts` |
| `app/src/backend/lib/utils.ts` | `app/src/lib/utils.ts` |
| `app/src/backend/domain/http.ts` | `app/src/domain/http.ts` |
| `app/src/backend/domain/intercepted.ts` | `app/src/domain/intercepted.ts` |
| `app/src/backend/domain/mockLatency.ts` | `app/src/domain/mockLatency.ts` |
| `app/src/backend/domain/ruleMatching.ts` | `app/src/domain/ruleMatching.ts` |
| `app/src/backend/domain/__tests__/http.test.ts` | `app/src/domain/__tests__/http.test.ts` |
| `app/src/backend/domain/__tests__/intercepted.test.ts` | `app/src/domain/__tests__/intercepted.test.ts` |
| `app/src/backend/domain/__tests__/mockLatency.test.ts` | `app/src/domain/__tests__/mockLatency.test.ts` |
| `app/src/backend/domain/__tests__/ruleMatching.test.ts` | `app/src/domain/__tests__/ruleMatching.test.ts` |

After the moves, `src/backend/` should contain only `background.ts` (moved in Task 3).

- [ ] **Step 1: Create the destination directories**

From `app/`:
```bash
mkdir -p src/types src/lib src/lib/__tests__ src/domain src/domain/__tests__
```

- [ ] **Step 2: Move with `git mv`**

Run from repo root (preserves git rename history):
```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/<phase-6-worktree>

# Types
git mv app/src/backend/types/index.ts app/src/types/index.ts
git mv app/src/backend/types/intercepted.ts app/src/types/intercepted.ts
git mv app/src/backend/types/legacy.ts app/src/types/legacy.ts
git mv app/src/backend/types/messages.ts app/src/types/messages.ts
git mv app/src/backend/types/rules.ts app/src/types/rules.ts
git mv app/src/backend/types/codemirror.d.ts app/src/types/codemirror.d.ts

# Services → lib
git mv app/src/backend/services/indexedDB.ts app/src/lib/indexedDB.ts
git mv app/src/backend/services/networkTiming.ts app/src/lib/networkTiming.ts
git mv app/src/backend/services/legacyMigration.ts app/src/lib/legacyMigration.ts
git mv app/src/backend/services/__tests__/networkTiming.test.ts app/src/lib/__tests__/networkTiming.test.ts
git mv app/src/backend/services/__tests__/legacyMigration.test.ts app/src/lib/__tests__/legacyMigration.test.ts

# Utils + lib → lib
git mv app/src/backend/utils/helpers.ts app/src/lib/helpers.ts
git mv app/src/backend/lib/utils.ts app/src/lib/utils.ts

# Domain
git mv app/src/backend/domain/http.ts app/src/domain/http.ts
git mv app/src/backend/domain/intercepted.ts app/src/domain/intercepted.ts
git mv app/src/backend/domain/mockLatency.ts app/src/domain/mockLatency.ts
git mv app/src/backend/domain/ruleMatching.ts app/src/domain/ruleMatching.ts
git mv app/src/backend/domain/__tests__/http.test.ts app/src/domain/__tests__/http.test.ts
git mv app/src/backend/domain/__tests__/intercepted.test.ts app/src/domain/__tests__/intercepted.test.ts
git mv app/src/backend/domain/__tests__/mockLatency.test.ts app/src/domain/__tests__/mockLatency.test.ts
git mv app/src/backend/domain/__tests__/ruleMatching.test.ts app/src/domain/__tests__/ruleMatching.test.ts
```

- [ ] **Step 3: Remove the now-empty backend subdirectories**

```bash
rmdir app/src/backend/types
rmdir app/src/backend/services/__tests__
rmdir app/src/backend/services
rmdir app/src/backend/utils
rmdir app/src/backend/lib
rmdir app/src/backend/domain/__tests__
rmdir app/src/backend/domain
```

`app/src/backend/` should now contain only `background.ts` (Task 3 will move that).

- [ ] **Step 4: Rewrite all imports across the codebase**

Use `perl -i -pe` to update import paths in TypeScript files. This is a mass substitution; verify each transformation.

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/<phase-6-worktree>

# Update @/ alias paths (used by UI hooks, components, tests)
find app/src -name '*.ts' -o -name '*.tsx' | xargs perl -i -pe '
  s|@/backend/types/|@/types/|g;
  s|@/backend/services/|@/lib/|g;
  s|@/backend/lib/utils|@/lib/utils|g;
  s|@/backend/utils/helpers|@/lib/helpers|g;
  s|@/backend/domain/|@/domain/|g;
  s|@/ui/lib/statusBadge|@/lib/statusBadge|g;
'

# Update relative imports inside background.ts (still at app/src/backend/background.ts in Task 1)
# It currently does:
#   import { indexedDBService } from './services/indexedDB';
#   import { runLegacyMigration } from './services/legacyMigration';
#   import { NetworkTimingTracker } from './services/networkTiming';
#   import type { ... } from './types';
# All relative paths are now broken since those folders are gone. Switch to @/ aliases:
perl -i -pe '
  s|from .\./services/indexedDB.|from '\''@/lib/indexedDB'\''|g;
  s|from .\./services/legacyMigration.|from '\''@/lib/legacyMigration'\''|g;
  s|from .\./services/networkTiming.|from '\''@/lib/networkTiming'\''|g;
  s|from .\./types.|from '\''@/types'\''|g;
  s|from .\./types/legacy.|from '\''@/types/legacy'\''|g;
  s|from .\./domain/|from '\''@/domain/|g;
' app/src/backend/background.ts
```

(Adjust the perl substitutions to match the actual import statements in `background.ts`. Read the file first, then write targeted substitutions.)

- [ ] **Step 5: Move statusBadge from src/ui/lib/ to src/lib/**

Note: this file was added in Phase 5. Move it now to consolidate `lib/`:

```bash
git mv app/src/ui/lib/statusBadge.ts app/src/lib/statusBadge.ts
git mv app/src/ui/lib/__tests__/statusBadge.test.ts app/src/lib/__tests__/statusBadge.test.ts
rmdir app/src/ui/lib/__tests__
rmdir app/src/ui/lib
```

The `@/ui/lib/statusBadge` → `@/lib/statusBadge` substitution in Step 4 already covers consumers. Verify:
```bash
grep -rn 'ui/lib/statusBadge\|backend/services/\|backend/types/\|backend/utils/\|backend/lib/' app/src --include='*.ts' --include='*.tsx'
```
Expected: no output.

Also adjust the relative import inside the moved test file (`statusBadge.test.ts`):
```bash
# was: from '../statusBadge'  (still correct — same relative position)
grep -n 'statusBadge' app/src/lib/__tests__/statusBadge.test.ts
```
Expected: `from '../statusBadge'` — unchanged because both file moved together.

Same for the relative import in `legacyMigration.test.ts` (which imports `../legacyMigration`).

- [ ] **Step 6: Run all gates**

```bash
cd app
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green. If imports were missed, tsc will fail loudly with TS2307 errors — fix each and re-run.

- [ ] **Step 7: Confirm git rename detection**

```bash
git diff main...HEAD --stat -M
```

Expected: rename entries show as `R100` or `R0xx` for each moved file (history preserved). If any file shows as full delete + add, the rewrite-imports step changed too many lines for git's heuristic; that's OK but the blame history is broken for that file.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(structure): flatten backend non-entrypoint code to src root

Moves to top-level src/:
- types/        was src/backend/types/
- lib/          was src/backend/services/, src/backend/utils/, src/backend/lib/
- domain/       was src/backend/domain/
- lib/statusBadge.ts  was src/ui/lib/statusBadge.ts (consolidate utilities)

src/backend/ now contains only background.ts (Task 3 moves that to
src/entrypoints/). All consumer imports updated via @/ alias paths.

The 18 source files + tests preserved git rename history.
EOF
)"
```

---

## Task 2: Move UI subfolders (components/hooks/pages/styles + reorganize)

**Why:** Continue the flattening. UI-side code moves out of `src/ui/` into the conventional `src/components/`, `src/hooks/`, `src/pages/`, `src/styles/` layout. The shadcn primitives folder gets renamed from `shadcn/` to `ui/` (the standard shadcn convention). Layout-y components (AppSidebar, SiteHeader, NavMain) get a `layout/` subfolder.

**Files moved (~40):**

| Old path | New path |
|---|---|
| `app/src/ui/hooks/useAllRequests.ts` | `app/src/hooks/useAllRequests.ts` |
| `app/src/ui/hooks/useDebugging.ts` | `app/src/hooks/useDebugging.ts` |
| `app/src/ui/hooks/useResponses.ts` | `app/src/hooks/useResponses.ts` |
| `app/src/ui/hooks/useRules.ts` | `app/src/hooks/useRules.ts` |
| `app/src/ui/pages/Layout.tsx` | `app/src/pages/Layout.tsx` |
| `app/src/ui/pages/RequestHistory.tsx` | `app/src/pages/RequestHistory.tsx` |
| `app/src/ui/pages/Requests.tsx` | `app/src/pages/Requests.tsx` |
| `app/src/ui/pages/Settings.tsx` | `app/src/pages/Settings.tsx` |
| `app/src/ui/pages/__tests__/RequestHistory.test.tsx` | `app/src/pages/__tests__/RequestHistory.test.tsx` |
| `app/src/ui/pages/__tests__/Requests.test.tsx` | `app/src/pages/__tests__/Requests.test.tsx` |
| `app/src/ui/routes.tsx` | `app/src/routes.tsx` |
| `app/src/ui/globals.css` | `app/src/styles/globals.css` |
| `app/src/ui/components/AppSidebar.tsx` | `app/src/components/layout/AppSidebar.tsx` |
| `app/src/ui/components/SiteHeader.tsx` | `app/src/components/layout/SiteHeader.tsx` |
| `app/src/ui/components/NavMain.tsx` | `app/src/components/layout/NavMain.tsx` |
| `app/src/ui/components/RequestTable.tsx` | `app/src/components/RequestTable.tsx` |
| `app/src/ui/components/ResponseDialog.tsx` | `app/src/components/ResponseDialog.tsx` |
| `app/src/ui/components/ResponseList.tsx` | `app/src/components/ResponseList.tsx` |
| `app/src/ui/components/SelectTabDialog.tsx` | `app/src/components/SelectTabDialog.tsx` |
| `app/src/ui/components/__tests__/*.test.tsx` (4) | `app/src/components/__tests__/*.test.tsx` |
| `app/src/ui/components/hooks/use-mobile.ts` | `app/src/components/hooks/use-mobile.ts` |
| `app/src/ui/components/shadcn/*.tsx` (~20) | `app/src/components/ui/*.tsx` |
| `app/src/ui/components/requests/*` | `app/src/components/requests/*` (path stays under components/) |
| `app/src/ui/components/rules/*` | `app/src/components/rules/*` |

- [ ] **Step 1: Create destination directories**

```bash
cd app
mkdir -p src/hooks src/pages src/pages/__tests__ src/styles src/components/layout src/components/__tests__ src/components/ui src/components/requests src/components/rules src/components/hooks
```

- [ ] **Step 2: Move via `git mv`**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/<phase-6-worktree>

# Hooks
for f in useAllRequests useDebugging useResponses useRules; do
  git mv "app/src/ui/hooks/$f.ts" "app/src/hooks/$f.ts"
done

# Pages
for f in Layout RequestHistory Requests Settings; do
  git mv "app/src/ui/pages/$f.tsx" "app/src/pages/$f.tsx"
done
git mv app/src/ui/pages/__tests__/RequestHistory.test.tsx app/src/pages/__tests__/RequestHistory.test.tsx
git mv app/src/ui/pages/__tests__/Requests.test.tsx app/src/pages/__tests__/Requests.test.tsx

# Routes + globals
git mv app/src/ui/routes.tsx app/src/routes.tsx
git mv app/src/ui/globals.css app/src/styles/globals.css

# Layout components
git mv app/src/ui/components/AppSidebar.tsx app/src/components/layout/AppSidebar.tsx
git mv app/src/ui/components/SiteHeader.tsx app/src/components/layout/SiteHeader.tsx
git mv app/src/ui/components/NavMain.tsx app/src/components/layout/NavMain.tsx

# Feature components (kept at root)
git mv app/src/ui/components/RequestTable.tsx app/src/components/RequestTable.tsx
git mv app/src/ui/components/ResponseDialog.tsx app/src/components/ResponseDialog.tsx
git mv app/src/ui/components/ResponseList.tsx app/src/components/ResponseList.tsx
git mv app/src/ui/components/SelectTabDialog.tsx app/src/components/SelectTabDialog.tsx

# Component tests
git mv app/src/ui/components/__tests__/AppSidebar.test.tsx app/src/components/__tests__/AppSidebar.test.tsx
git mv app/src/ui/components/__tests__/ResponseDialog.test.tsx app/src/components/__tests__/ResponseDialog.test.tsx
git mv app/src/ui/components/__tests__/ResponseList.test.tsx app/src/components/__tests__/ResponseList.test.tsx
git mv app/src/ui/components/__tests__/SiteHeader.test.tsx app/src/components/__tests__/SiteHeader.test.tsx

# Component-internal hooks
git mv app/src/ui/components/hooks/use-mobile.ts app/src/components/hooks/use-mobile.ts

# shadcn primitives → components/ui/
for f in alert-dialog avatar badge button card checkbox dialog dropdown-menu icon input label scroll-area select separator sheet sidebar skeleton table tabs textarea tooltip; do
  git mv "app/src/ui/components/shadcn/$f.tsx" "app/src/components/ui/$f.tsx"
done

# Feature subfolders (move whole directories)
# requests/
git mv app/src/ui/components/requests/columns.tsx app/src/components/requests/columns.tsx
git mv app/src/ui/components/requests/data-table.tsx app/src/components/requests/data-table.tsx
git mv app/src/ui/components/requests/duration.ts app/src/components/requests/duration.ts
git mv app/src/ui/components/requests/__tests__/duration.test.ts app/src/components/requests/__tests__/duration.test.ts

# rules/
git mv app/src/ui/components/rules/ActionEditor.tsx app/src/components/rules/ActionEditor.tsx
git mv app/src/ui/components/rules/MatcherEditor.tsx app/src/components/rules/MatcherEditor.tsx
git mv app/src/ui/components/rules/RuleEditor.tsx app/src/components/rules/RuleEditor.tsx
git mv app/src/ui/components/rules/RuleTable.tsx app/src/components/rules/RuleTable.tsx
git mv app/src/ui/components/rules/rule-columns.tsx app/src/components/rules/rule-columns.tsx
git mv app/src/ui/components/rules/rule-data-table.tsx app/src/components/rules/rule-data-table.tsx
git mv app/src/ui/components/rules/__tests__/ActionEditor.test.tsx app/src/components/rules/__tests__/ActionEditor.test.tsx
```

- [ ] **Step 3: Remove now-empty src/ui/ subdirectories**

```bash
rmdir app/src/ui/hooks
rmdir app/src/ui/pages/__tests__ app/src/ui/pages
rmdir app/src/ui/components/shadcn
rmdir app/src/ui/components/__tests__
rmdir app/src/ui/components/hooks
rmdir app/src/ui/components/requests/__tests__
rmdir app/src/ui/components/requests
rmdir app/src/ui/components/rules/__tests__
rmdir app/src/ui/components/rules
rmdir app/src/ui/components
rmdir app/src/ui
```

After this, `src/ui/` should not exist; `src/backend/` only contains `background.ts`.

- [ ] **Step 4: Rewrite imports**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/<phase-6-worktree>

find app/src -name '*.ts' -o -name '*.tsx' | xargs perl -i -pe '
  # @/ alias paths
  s|@/ui/hooks/|@/hooks/|g;
  s|@/ui/pages/|@/pages/|g;
  s|@/ui/routes|@/routes|g;
  s|@/ui/components/shadcn/|@/components/ui/|g;
  s|@/ui/components/|@/components/|g;
'
```

Then audit relative imports (the ones starting with `./` or `../`). For each moved file, look at its imports and verify they still resolve. The mass substitution above handles `@/` paths; relative imports inside moved files may need targeted fixes.

For example, in `RequestTable.tsx` (was at `src/ui/components/`, now at `src/components/`), an old relative import like `from '../hooks/useResponses'` was pointing at `src/ui/hooks/useResponses` — which is now `src/hooks/useResponses`. The relative path needs to become `from '../hooks/useResponses'`? No — wait. From `src/components/RequestTable.tsx`, `../hooks` resolves to `src/hooks`. Same! So relative imports may still work.

The trickier case: `src/components/__tests__/AppSidebar.test.tsx` has `import AppSidebar from '../AppSidebar'`. `AppSidebar` was at `src/ui/components/AppSidebar.tsx`, now at `src/components/layout/AppSidebar.tsx`. So `../AppSidebar` resolves to `src/components/AppSidebar` — wrong. It should be `../layout/AppSidebar`.

After the bulk substitution, do a focused review:
```bash
# Find any tests that import from a parent that's now layout/
grep -rn "from '\\.\\./AppSidebar\\|from '\\.\\./SiteHeader\\|from '\\.\\./NavMain'" app/src --include='*.tsx'
```

Edit those tests to add `layout/` to the relative path.

Also — `src/styles/globals.css` is referenced from `src/entrypoints/options/main.tsx` (currently still at `src/ui/main.tsx`). It needs `import '@/styles/globals.css'` after Task 3 moves main.tsx. For now (Task 2), main.tsx still imports `'./globals.css'` — that file moved, so the import is broken until Task 3 fixes the main.tsx import path. But this means **Task 2's gates may fail temporarily**. Mitigation: add an explicit fix in Task 2 — update main.tsx (still at `src/ui/main.tsx`) to import `from '@/styles/globals.css'` so it works regardless of main.tsx's location.

```bash
# Update main.tsx's globals.css import
perl -i -pe "s|import '\\./globals\\.css'|import '@/styles/globals.css'|g" app/src/ui/main.tsx
```

- [ ] **Step 5: Update components.json**

The `components.json` references `tailwind.css`. Update to the new path:

Find:
```json
"css": "src/ui/globals.css",
```

Replace with:
```json
"css": "src/styles/globals.css",
```

Use Edit tool with that exact substitution.

- [ ] **Step 6: All gates**

```bash
cd app
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green. If lint flags issues from Biome's `useExhaustiveDependencies` checking the new file paths, they should be old warnings (none should be new from the moves).

If anything fails:
- TS2307 (cannot find module) → an import wasn't updated; grep for the failing path
- Vitest "module not found" → same
- Build "could not resolve" → same

Iterate until green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(structure): flatten UI subfolders to src/components, src/hooks, src/pages, src/styles

Reorganization:
- src/ui/hooks/      → src/hooks/
- src/ui/pages/      → src/pages/
- src/ui/routes.tsx  → src/routes.tsx
- src/ui/globals.css → src/styles/globals.css
- src/ui/components/shadcn/   → src/components/ui/   (shadcn convention)
- src/ui/components/{AppSidebar,SiteHeader,NavMain} → src/components/layout/
- src/ui/components/{ResponseDialog,ResponseList,RequestTable,SelectTabDialog} → src/components/
- src/ui/components/{requests,rules,hooks} → src/components/{requests,rules,hooks}/

components.json css path updated to match.

src/ui/ directory removed entirely. All consumer imports updated via @/ aliases plus targeted relative-import fixes for the moved test files.
EOF
)"
```

---

## Task 3: Move entrypoints (background, options) + update vite + manifest

**Why:** With Tasks 1 and 2 done, the `src/backend/` directory contains only `background.ts`, and `src/ui/main.tsx` still lives where it shouldn't. Move them to `src/entrypoints/` per the standard convention. Rename `index.html` to `options.html` since it's specifically the options-page entry. Update Vite to reference the new paths. Update manifest.json's `options_page` to `options.html`.

**Files moved:**

| Old path | New path |
|---|---|
| `app/src/backend/background.ts` | `app/src/entrypoints/background.ts` |
| `app/src/ui/main.tsx` | `app/src/entrypoints/options/main.tsx` |
| `app/index.html` | `app/options.html` |

After this, `app/src/backend/` and `app/src/ui/` should both be empty and removable.

- [ ] **Step 1: Create destination dirs**

```bash
mkdir -p app/src/entrypoints/options
```

- [ ] **Step 2: Move files via `git mv`**

```bash
git mv app/src/backend/background.ts app/src/entrypoints/background.ts
git mv app/src/ui/main.tsx app/src/entrypoints/options/main.tsx
git mv app/index.html app/options.html
rmdir app/src/backend app/src/ui
```

- [ ] **Step 3: Update `app/options.html` script reference**

The HTML file references `main.tsx`. Update the script src from:
```html
<script type="module" src="./src/ui/main.tsx"></script>
```

to:
```html
<script type="module" src="/src/entrypoints/options/main.tsx"></script>
```

(Use absolute path with leading `/` — Vite resolves it relative to project root.)

Use Edit tool to make this change in `app/options.html`.

- [ ] **Step 4: Update `app/vite.config.mts`**

Change the rollupOptions input map. Find:
```ts
rollupOptions: {
  input: {
    index: path.resolve(__dirname, 'index.html'),
    background: path.resolve(__dirname, 'src/backend/background.ts'),
    main: path.resolve(__dirname, 'src/ui/main.tsx'),
  },
  output: {
    entryFileNames: '[name].js',
  },
},
```

Replace with:
```ts
rollupOptions: {
  input: {
    options: path.resolve(__dirname, 'options.html'),
    background: path.resolve(__dirname, 'src/entrypoints/background.ts'),
    main: path.resolve(__dirname, 'src/entrypoints/options/main.tsx'),
  },
  output: {
    entryFileNames: '[name].js',
  },
},
```

(`index` becomes `options`; `src/backend/background.ts` → `src/entrypoints/background.ts`; `src/ui/main.tsx` → `src/entrypoints/options/main.tsx`. The HTML output filename derives from the input filename — `options.html` → `dist/options.html`.)

- [ ] **Step 5: Update `app/manifest.json` `options_page`**

Change:
```json
"options_page": "index.html",
```

to:
```json
"options_page": "options.html",
```

- [ ] **Step 6: Verify build**

```bash
cd app && npm run build
ls -la dist/
```

Expected output (relevant entries):
- `dist/options.html`
- `dist/main.js`
- `dist/background.js`
- `dist/manifest.json` (copied via vite-plugin-static-copy)
- `dist/assets/main-*.css`

If `dist/index.html` still exists (instead of `options.html`), the vite config didn't pick up the rename. Re-check.

- [ ] **Step 7: All gates**

```bash
cd app
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(structure): move entrypoints to src/entrypoints/

- app/src/backend/background.ts → app/src/entrypoints/background.ts
- app/src/ui/main.tsx           → app/src/entrypoints/options/main.tsx
- app/index.html                → app/options.html

vite.config.mts: rollupOptions.input renamed 'index' to 'options',
paths updated to src/entrypoints/...

manifest.json: options_page now points at options.html.

src/backend/ and src/ui/ no longer exist; src/entrypoints/ holds all
non-asset entry points.
EOF
)"
```

---

## Task 4: Add Side Panel entrypoint

**Why:** Modern MV3 extensions can dock UI as a side panel that's always accessible without navigating away from the page being debugged. Adding it as a complement (not replacement) to the options-page tab gives users both UIs.

**Files added:**

| New path | Purpose |
|---|---|
| `app/sidepanel.html` | Entry HTML for the side panel; references the new main.tsx |
| `app/src/entrypoints/sidepanel/main.tsx` | React entry; mounts the same RouterProvider tree as options |

**Files modified:**
- `app/vite.config.mts` (add sidepanel input)
- `app/manifest.json` (add `side_panel` block + `sidePanel` permission)

- [ ] **Step 1: Create `app/sidepanel.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Debug Buddy — Side Panel</title>
		<link rel="icon" href="images/icon_64px.png" type="image/png" />
	</head>
	<body class="bg-background text-foreground">
		<div id="root"></div>
		<script type="module" src="/src/entrypoints/sidepanel/main.tsx"></script>
	</body>
</html>
```

Mirror the structure of `options.html`. Tabs (size 2) per `.editorconfig`.

- [ ] **Step 2: Create `app/src/entrypoints/sidepanel/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';
import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
```

This is essentially identical to `options/main.tsx`. Both entrypoints share the same routing/page tree — the only difference is which HTML file mounts them.

If `options/main.tsx` exports the router differently (e.g. inline `createHashRouter` instead of importing from `@/routes`), reuse the same pattern in sidepanel/main.tsx. Read `options/main.tsx` first to confirm the exact import shape.

- [ ] **Step 3: Update `app/vite.config.mts`** to add the sidepanel entry

```ts
rollupOptions: {
  input: {
    options: path.resolve(__dirname, 'options.html'),
    sidepanel: path.resolve(__dirname, 'sidepanel.html'),
    background: path.resolve(__dirname, 'src/entrypoints/background.ts'),
    main: path.resolve(__dirname, 'src/entrypoints/options/main.tsx'),
  },
  output: {
    entryFileNames: '[name].js',
  },
},
```

(The `sidepanel.html` entry implicitly bundles `src/entrypoints/sidepanel/main.tsx` because it's referenced via the `<script src="...">`. Vite handles the chunk extraction automatically.)

- [ ] **Step 4: Update `app/manifest.json`**

Add `"sidePanel"` to permissions:
```diff
   "permissions": [
     "debugger",
     "tabs",
-    "storage"
+    "storage",
+    "sidePanel"
   ],
```

Add `side_panel` block (after `"action": {...}`):
```json
"side_panel": {
  "default_path": "sidepanel.html"
},
```

The new manifest, in full, should look like:
```json
{
  "name": "Debug Buddy",
  "short_name": "DbgBuddy",
  ...
  "permissions": ["debugger", "tabs", "storage", "sidePanel"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { ... },
  "side_panel": { "default_path": "sidepanel.html" },
  "options_page": "options.html",
  "web_accessible_resources": [...],
  ...
}
```

- [ ] **Step 5: Verify build emits `sidepanel.html`**

```bash
cd app && npm run build
ls -la dist/
```

Expected: `dist/sidepanel.html` exists alongside `dist/options.html`.

- [ ] **Step 6: All gates**

```bash
cd app
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(sidepanel): add Side Panel entrypoint as complement to options page

- New: app/sidepanel.html
- New: app/src/entrypoints/sidepanel/main.tsx (reuses RouterProvider
  + page tree from options entrypoint)
- vite.config.mts: adds sidepanel as a rollup input
- manifest.json: side_panel block + sidePanel permission

Side Panel is accessible via Chrome's native side-panel toolbar button
(or right-click action icon → "Open side panel"). The action icon's
existing "open interceptor in tab" behavior is preserved as the
primary access path.
EOF
)"
```

---

## Task 5: Refresh CLAUDE.md and AGENTS.md

**Why:** Both docs reference `app/src/backend/...` and `app/src/ui/...` paths that no longer exist. Update to the new layout.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Inventory stale references**

```bash
grep -nE 'src/backend/|src/ui/' CLAUDE.md AGENTS.md
```

You'll see various mentions in:
- The `## Architecture overview` section (talks about background.ts, services, IndexedDB)
- The `## Frontend layout` section (talks about main.tsx, hooks, components/shadcn/, etc.)
- The `## Tests` section (talks about jest.setup.js — already wrong since Phase 1 — and test file conventions)

- [ ] **Step 2: Update `CLAUDE.md`**

Search-and-replace common path patterns:
- `src/backend/background.ts` → `src/entrypoints/background.ts`
- `src/backend/services/indexedDB.ts` → `src/lib/indexedDB.ts`
- `src/backend/services/networkTiming.ts` → `src/lib/networkTiming.ts`
- `src/backend/types/...` → `src/types/...`
- `src/ui/main.tsx` → `src/entrypoints/options/main.tsx`
- `src/ui/components/shadcn/` → `src/components/ui/`
- `src/ui/components/` → `src/components/`
- `src/ui/hooks/` → `src/hooks/`
- `src/ui/pages/` → `src/pages/`
- `src/ui/globals.css` → `src/styles/globals.css`
- `index.html` (when meant as the options entry) → `options.html`

Also update the "Frontend layout" section's bullet list to mention the new `src/entrypoints/sidepanel/` and the renamed shadcn folder.

After the substitution, re-read both files end-to-end and clean up any prose that's now grammatically off (e.g. "the four moving parts" if a path-based count is now wrong).

- [ ] **Step 3: Mirror to `AGENTS.md`**

Apply the identical changes to `AGENTS.md`. Verify parity:
```bash
diff CLAUDE.md AGENTS.md | head -10
```

Expected: only the title and intro line differ.

- [ ] **Step 4: All gates (sanity)**

```bash
cd app
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green. Doc changes don't affect any of these.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update CLAUDE.md and AGENTS.md for the flat src/ structure"
```

---

## Task 6: End-to-end verification

**Why:** Phase gate. No commit. Confirms the cumulative effect.

- [ ] **Step 1: Clean install**

```bash
cd app
rm -rf node_modules
npm ci
```

- [ ] **Step 2: All four CI gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green. Test count unchanged from Phase 5 (72 passed + 1 skipped).

- [ ] **Step 3: Verify build output**

```bash
ls -la dist/
```

Expected files (or similar):
- `dist/options.html`
- `dist/sidepanel.html`
- `dist/main.js`
- `dist/background.js`
- `dist/manifest.json`
- `dist/styles.css` or `dist/assets/main-*.css`
- `dist/images/`
- `dist/lib/` (vendored prettier/codemirror)

If `dist/index.html` exists, Task 3 didn't fully rename. Investigate.

- [ ] **Step 4: Confirm directory structure**

```bash
find app/src -maxdepth 2 -type d | sort
```

Expected (or similar):
```
app/src
app/src/components
app/src/components/__tests__
app/src/components/hooks
app/src/components/layout
app/src/components/requests
app/src/components/rules
app/src/components/ui
app/src/domain
app/src/domain/__tests__
app/src/entrypoints
app/src/entrypoints/options
app/src/entrypoints/sidepanel
app/src/hooks
app/src/lib
app/src/lib/__tests__
app/src/pages
app/src/pages/__tests__
app/src/styles
app/src/types
```

NO `app/src/ui` and NO `app/src/backend` should appear.

- [ ] **Step 5: Manual smoke test in Chrome (CRITICAL)**

Build, load `app/dist/` unpacked. Verify both UIs:

1. **Options page (existing UX):** Click the action icon → opens the interceptor in a new tab. Pick a target tab. Start Debugging. Trigger requests. Confirm history populates. Stop Debugging.

2. **Side Panel (new):** With the extension loaded, open Chrome's side panel toolbar button (right side of address bar) → see "Debug Buddy" in the list → click. The same UI should appear docked as a side panel. Pick a target tab from the dialog (the Side Panel shares the same `targetTabId` state via `chrome.storage.local`). Start Debugging. Confirm requests appear in the docked panel. Stop Debugging.

3. **Both UIs simultaneously:** Open both the options-page tab AND the side panel. Make a rule change in one — confirm it propagates to the other (via `chrome.storage.onChanged`).

4. **No console errors** in either: the service worker DevTools console, the options-page tab console, or the side panel console.

- [ ] **Step 6: Confirm git history**

```bash
git log --oneline main..HEAD
```

Expected (newest first):
```
<hash> docs: update CLAUDE.md and AGENTS.md for the flat src/ structure
<hash> feat(sidepanel): add Side Panel entrypoint as complement to options page
<hash> refactor(structure): move entrypoints to src/entrypoints/
<hash> refactor(structure): flatten UI subfolders to src/components, src/hooks, src/pages, src/styles
<hash> refactor(structure): flatten backend non-entrypoint code to src root
<hash> docs: implementation plan for Phase 6 (folder restructure + Side Panel)
```

---

## Done criteria

- All 5 task commits present on the branch (Task 6 is verification, no commit).
- `npm ci && npm run lint && npm run typecheck && npm run build && npm test` from `app/` is green.
- `app/src/backend/` and `app/src/ui/` no longer exist.
- `app/src/entrypoints/{background.ts,options/,sidepanel/}` populated.
- `dist/` produces both `options.html` and `sidepanel.html` plus `background.js`, `main.js`.
- Manifest registers `side_panel.default_path: "sidepanel.html"` and `sidePanel` permission.
- Manual smoke test in Chrome: both options-page tab AND side panel function correctly with shared state.
- Test count unchanged (72 passed + 1 skipped).
- CLAUDE.md and AGENTS.md describe the new layout (both files in sync).

Once those boxes are ticked, Phase 6 is ready to merge into `main`. The next plan (Phase 7 — CI/release with release-please + web-ext lint + chrome-webstore-upload-cli) depends on this baseline.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bulk import substitution misses a path pattern, breaking the build | Medium | Tasks 1, 2, 3 each run all 4 gates BEFORE committing. Failures surface as TS2307 / module-not-found. Iterate until green. |
| Vite output structure changes when input paths change (e.g. nested `dist/src/entrypoints/options/main.html`) | Low | `entryFileNames: '[name].js'` plus root-level html files (`options.html`, `sidepanel.html`) keep the output flat. Verified in Step 6 of Task 3. |
| Side Panel main.tsx diverges from options/main.tsx unintentionally | Low | Both files import from `@/routes` and `@/styles/globals.css`. Identical mount logic. Future routing changes update the shared `routes.tsx`, both entrypoints stay in sync automatically. |
| Manifest's `sidePanel` permission triggers re-prompt on update | Medium | Adding a permission to an existing extension shows a re-prompt to existing users. Acceptable UX cost for opt-in to the new UI; document in the PR description. |
| Chrome doesn't know to use the side panel by default | Low | `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })` is the default. Users opt in by clicking the side-panel toolbar button. |
| `host_permissions` change deferred — extension still requests <all_urls> | Low | Out of scope per the spec deviation note at the top. Phase 7+ can revisit with a proper permission request flow. |
| `git mv` rename detection breaks for files where Task 1's import-rewrite changes too many lines | Medium | Acceptable trade-off; the diff itself is correct, only `git blame` history is broken for those files. The spec says "preserving git rename history" as a strong preference, not a hard constraint. |
| Tests using relative imports (e.g. `../AppSidebar`) silently break after move | Medium | Step 4 of Task 2 has an explicit grep for these patterns. Each test that fails surfaces as a Vitest "module not found" error. |
| `components.json` references stale `tailwind.css` path after Task 2 | Low | Task 2 Step 5 updates the path. Verified before commit. |

## Open follow-ups (not addressed in this plan)

These were flagged in earlier phase reviews but are explicitly out of Phase 6's scope:

1. **`getStatusBadgeClass` consumer wiring.** Phase 5's Task 6 commit (`f9232ee`) was not included in the rebase-merge to main, so the helper still has zero production consumers. Wire it into the request history Status column in a follow-up. Likely 1 file, 1 commit.
2. **Typed factory builders for test mocks.** Phase 4 follow-up — replace the ~55 `: any` annotations in test fixtures with strongly-typed mock factories.
3. **`getMethodColor` palette migration in `ResponseList.tsx`.** Phase 5 follow-up — its `default` branch uses `bg-muted` while siblings still use literal `bg-{green,blue,amber,red,purple}-500`. Consolidate to semantic tokens.
4. **Pre-existing `try/catch` fallback sites in `ResponseDialog.tsx`** (lines 84/110/133). Phase 5 follow-up — return `''` on errors, violates "no fallbacks" rule.
5. **`getStatusCategory` consumer.** Phase 5 sibling helper, no production use yet. Could be wired into ResponseDialog as a fallback label when `statusText` is empty.
6. **`host_permissions` → `optional_host_permissions`.** Phase 6 spec deviation. Requires a runtime permission flow.
7. **`chrome.action.onClicked` opens Side Panel instead of options tab.** Phase 6 spec deviation. UX preference; can be flipped later.
