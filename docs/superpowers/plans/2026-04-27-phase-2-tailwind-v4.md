# Phase 2 — Tailwind v4 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from Tailwind CSS 3.4 to Tailwind CSS 4.x (CSS-first, Lightning CSS), collapse the design tokens to dark-only, and replace `tailwindcss-animate` with `tw-animate-css` (the official v4 replacement). No source-behavior changes; the UI should render identically (still dark theme, same shadcn components animating the same way).

**Architecture:** The Tailwind library swap is necessarily atomic — both versions can't coexist in `node_modules`. Task 1 lands the entire library replacement plus the rewritten `globals.css` plus the Vite plugin in a single commit so the build is green at every commit on the branch. Tasks 2 and 3 then mechanically apply v4 class renames and clean up the now-unused JS config files.

**Tech Stack:** Tailwind CSS 4.x, `@tailwindcss/vite` 4.x, `tw-animate-css` 1.x, Vite 6.

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 2 — Tailwind v4".

**Working directory:** `app/` for npm/biome/vitest commands; repo root for git.

**Worktree:** Execute in a dedicated worktree (e.g. `/.claude/worktrees/<name>`) created from `main` (Phase 1 already merged via PR #33).

**Spec deviation acknowledged:** The Phase 2 spec said `tailwindcss-animate` could be "rewritten in CSS" because "Tailwind v4 covers the shadcn keyframes." That is incorrect — v4 ships the basic `animate-spin/pulse/bounce/ping` utilities, but the Radix-targeted ones the shadcn primitives use (`animate-in`, `animate-out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`, `slide-out-to-*`) are NOT in core Tailwind. The de facto replacement that the shadcn community adopted for v4 is **`tw-animate-css`**, a drop-in package that re-exposes the same utility classes for v4. We use it here.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `app/package.json` | Modify | Swap deps (add `tailwindcss@^4`, `@tailwindcss/vite@^4`, `tw-animate-css@^1`; remove `tailwindcss@^3`, `autoprefixer`, `postcss`, `tailwindcss-animate`) |
| `app/package-lock.json` | Modify (regenerated) | Side-effect of install/uninstall |
| `app/postcss.config.cjs` | Delete | Tailwind v4 uses Lightning CSS via the Vite plugin; no PostCSS pipeline needed |
| `app/tailwind.config.cjs` | Delete (Task 3) | Tailwind v4 reads config from CSS `@theme` blocks; no JS config file |
| `app/vite.config.mts` | Modify | Add `@tailwindcss/vite` plugin to the plugins array |
| `app/src/ui/globals.css` | Rewrite | v4 syntax: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@theme` block with dark-only `--color-*` tokens, inline `@keyframes` for accordion + blink, base layer apply rules |
| `app/components.json` | Modify (Task 3) | `tailwind.config: ""` (v4 has no JS config); `tailwind.css` already correct |
| `app/src/ui/components/shadcn/*.tsx` | Modify (Task 2) | Mechanical class renames: `shadow-sm` → `shadow-xs`, `rounded-sm` → `rounded-xs`, `outline-none` → `outline-hidden`, bare `shadow` → `shadow-sm` |
| `app/src/ui/components/ResponseDialog.tsx` | Modify (Task 2) | Remove `dark:bg-[#1a1a1a]` paired with `bg-[#f5f5f5]` (collapse to `bg-[#1a1a1a]` since the project is dark-only) |

No new test files (existing tests should continue to pass without modification).

---

## Task 1: Atomic Tailwind v4 swap

**Why:** The library can't coexist with v3. This task atomically installs v4, removes v3 and its PostCSS toolchain, swaps the Vite plugin, and rewrites `globals.css` for the v4 syntax. After this commit, the build must be green and the UI must render visually identical (modulo the class-rename pixel diffs that Task 2 sweeps up — most are imperceptible).

**Files:**
- Modify: `app/package.json` (devDeps swap)
- Modify: `app/package-lock.json` (regenerated)
- Modify: `app/vite.config.mts` (add `@tailwindcss/vite` plugin)
- Delete: `app/postcss.config.cjs`
- Rewrite: `app/src/ui/globals.css`

- [ ] **Step 1: Install Tailwind v4 stack**

Run from `app/`:
```bash
npm install --save-dev tailwindcss@^4.1.0 @tailwindcss/vite@^4.1.0 tw-animate-css@^1.2.0
```

Expected: succeeds. `package.json` `devDependencies` gains the three packages.

- [ ] **Step 2: Remove v3 stack**

Run from `app/`:
```bash
npm uninstall autoprefixer postcss tailwindcss-animate
```

Note: `tailwindcss` is replaced (not uninstalled) by Step 1's `tailwindcss@^4` install — the `^3.4` constraint was overwritten when v4 went in. Verify:
```bash
grep '"tailwindcss"' package.json
```
Expected: shows `"tailwindcss": "^4.x.x"` (or whatever the latest patch in `^4.1.0` resolved to). NO entry for `autoprefixer`, `postcss`, or `tailwindcss-animate`.

- [ ] **Step 3: Delete `app/postcss.config.cjs`**

Run from repo root:
```bash
git rm app/postcss.config.cjs
```

Expected: file staged as deletion. Tailwind v4 uses Lightning CSS via the Vite plugin; no PostCSS pipeline.

- [ ] **Step 4: Update `app/vite.config.mts`**

Edit `app/vite.config.mts`. Apply this exact diff:

```diff
 import { defineConfig } from 'vite';
 import react from '@vitejs/plugin-react';
+import tailwindcss from '@tailwindcss/vite';
 import { viteStaticCopy } from 'vite-plugin-static-copy';
 import path from 'path';

@@ ...

   plugins: [
     react(),
+    tailwindcss(),
     viteStaticCopy({
       targets: [
         { src: 'manifest.json', dest: '.' },
         { src: 'images', dest: '.' },
         { src: 'lib', dest: '.' },
       ],
     }),
   ],
 });
```

The plugin order matters: `react()` first, `tailwindcss()` second, then static-copy. Tailwind v4's plugin processes CSS imports during the Vite build pipeline.

- [ ] **Step 5: Rewrite `app/src/ui/globals.css`**

Replace the entire file with this exact content (tabs, size 2):

```css
/* Tailwind v4 entry — replaces @tailwind base/components/utilities */
@import 'tailwindcss';

/* Animations for shadcn primitives (Radix-targeted enter/exit transitions) */
@import 'tw-animate-css';

/*
 * Design tokens — dark only.
 * Tailwind v4 generates utility classes (bg-foo, text-foo, border-foo, ring-foo)
 * automatically from any --color-* variable declared in the @theme block.
 * No :root light variant. No .dark class. The whole UI is dark-by-default.
 */
@theme {
	/* Surfaces */
	--color-background: hsl(222.2 84% 4.9%);
	--color-foreground: hsl(210 40% 98%);

	--color-card: hsl(222.2 84% 4.9%);
	--color-card-foreground: hsl(210 40% 98%);

	--color-popover: hsl(222.2 84% 4.9%);
	--color-popover-foreground: hsl(210 40% 98%);

	/* Interactive */
	--color-primary: hsl(210 40% 98%);
	--color-primary-foreground: hsl(222.2 47.4% 11.2%);

	--color-secondary: hsl(217.2 32.6% 17.5%);
	--color-secondary-foreground: hsl(210 40% 98%);

	--color-muted: hsl(217.2 32.6% 17.5%);
	--color-muted-foreground: hsl(215 20.2% 65.1%);

	--color-accent: hsl(217.2 32.6% 17.5%);
	--color-accent-foreground: hsl(210 40% 98%);

	--color-destructive: hsl(0 62.8% 30.6%);
	--color-destructive-foreground: hsl(210 40% 98%);

	/* Form chrome */
	--color-border: hsl(217.2 32.6% 17.5%);
	--color-input: hsl(217.2 32.6% 17.5%);
	--color-ring: hsl(212.7 26.8% 83.9%);

	/* Sidebar (own scale because it sits on the canvas, not the card) */
	--color-sidebar: hsl(240 5.9% 10%);
	--color-sidebar-foreground: hsl(240 4.8% 95.9%);
	--color-sidebar-primary: hsl(224.3 76.3% 48%);
	--color-sidebar-primary-foreground: hsl(0 0% 100%);
	--color-sidebar-accent: hsl(240 3.7% 15.9%);
	--color-sidebar-accent-foreground: hsl(240 4.8% 95.9%);
	--color-sidebar-border: hsl(240 3.7% 15.9%);
	--color-sidebar-ring: hsl(217.2 91.2% 59.8%);

	/* Radius */
	--radius-lg: 0.5rem;
	--radius-md: calc(0.5rem - 2px);
	--radius-sm: calc(0.5rem - 4px);

	/* Animation utilities (generates animate-accordion-down / animate-accordion-up classes) */
	--animate-accordion-down: accordion-down 0.2s ease-out;
	--animate-accordion-up: accordion-up 0.2s ease-out;
}

/* Keyframes referenced by --animate-* tokens in @theme */
@keyframes accordion-down {
	from {
		height: 0;
	}
	to {
		height: var(--radix-accordion-content-height);
	}
}

@keyframes accordion-up {
	from {
		height: var(--radix-accordion-content-height);
	}
	to {
		height: 0;
	}
}

/* Status indicator pulse used by SiteHeader */
@keyframes blink {
	0% {
		background-color: rgb(34, 197, 94);
	}
	50% {
		background-color: rgb(239, 68, 68);
	}
	100% {
		background-color: rgb(34, 197, 94);
	}
}

@layer base {
	* {
		@apply border-border;
	}
	body {
		@apply bg-background text-foreground;
	}
}

.status-indicator-blinking {
	animation: blink 1.5s infinite;
}
```

Explanation of the major changes vs. the v3 file:
- `@tailwind base/components/utilities` → single `@import 'tailwindcss';`.
- Two design-token blocks (`:root` + `.dark`) collapse to one `@theme` block with dark values only.
- All `--background`, `--foreground`, etc. variables are renamed to `--color-background`, `--color-foreground`, etc. — the v4 convention that auto-generates utility classes (so `bg-background` works without any JS config mapping).
- `darkMode: ["class"]` and the `tailwindcss-animate` plugin import disappear (their effects are achieved by being dark-only and by `@import 'tw-animate-css'`).
- Keyframes that lived inside `theme.extend.keyframes` in `tailwind.config.cjs` are now top-level CSS `@keyframes` blocks. The `--animate-*` tokens in `@theme` register them as utility classes.

- [ ] **Step 6: Run lint, build, test**

Run from `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected:
- Lint: clean (3 pre-existing `useExhaustiveDependencies` warnings).
- Build: succeeds. The Vite output should still emit `dist/main.js`, `dist/background.js`, and `dist/assets/main-*.css` (filename hash will differ).
- Test: 59 passed + 1 skipped (existing baseline).

If `npm run build` fails with a CSS error like "Cannot resolve `@import 'tailwindcss'`" or "unknown rule `@theme`", the Vite plugin isn't wired up correctly — re-check Step 4.

If `npm run build` succeeds but the resulting `dist/assets/main-*.css` is suspiciously small (under 5 KB), the `@import 'tw-animate-css'` may not be resolving — check that `tw-animate-css` is in `node_modules` and that the import path is exact (`tw-animate-css`, not `@tw-animate-css/...`).

- [ ] **Step 7: Visual sanity check (manual, before commit)**

Run from `app/`:
```bash
npm run build
```

Then open the extension in Chrome (load `app/dist/` unpacked). The UI should render visually identical to the pre-Phase-2 state:
- Sidebar dark
- Background dark
- Text light
- Buttons, inputs, dialogs all readable
- Accordion expand/collapse animates
- Dialog open/close animates (fade + zoom)
- Tooltips fade in
- Status indicator blinks green/red

If anything looks broken (white background, missing animations, broken alignment), STOP and investigate before committing. The most likely culprits at this point are:
- `--color-*` token name typo (compare against the var names in the spec)
- Missing `@import 'tw-animate-css'` (animations broken)
- Wrong Vite plugin order

- [ ] **Step 8: Commit**

Run from repo root:
```bash
git add app/package.json app/package-lock.json app/vite.config.mts app/src/ui/globals.css
# postcss.config.cjs already staged via `git rm` in Step 3
git commit -m "$(cat <<'EOF'
build(css): migrate to Tailwind v4 with dark-only theme

- tailwindcss@^4 + @tailwindcss/vite plugin (Lightning CSS pipeline)
- tw-animate-css replaces tailwindcss-animate for shadcn enter/exit transitions
- globals.css rewritten with @import + @theme block (dark-only --color-* tokens)
- Removed PostCSS toolchain (autoprefixer, postcss, postcss.config.cjs)
- darkMode: ["class"] gone; the entire UI is dark by default

JS config (tailwind.config.cjs) and components.json fixup land in Task 3.
v4 class renames (shadow-sm → shadow-xs, rounded-sm → rounded-xs, etc.) land in Task 2.
EOF
)"
```

---

## Task 2: Apply v4 class renames in source files

**Why:** Tailwind v4 renamed several utility classes to make the small/medium/large scale more consistent. The renames are mechanical and don't change visual rendering. Applying them now keeps the codebase aligned with v4 conventions and avoids future migrations.

**Renames (per the official v4 upgrade guide):**

| v3 class | v4 class | Rationale |
|---|---|---|
| `shadow-sm` | `shadow-xs` | v4's `shadow-xs` matches v3's `shadow-sm` visual |
| bare `shadow` | `shadow-sm` | v4's `shadow-sm` matches v3's bare `shadow` visual |
| `rounded-sm` | `rounded-xs` | Same scale shift |
| `outline-none` | `outline-hidden` | v4's `outline-none` is now "transparent outline"; `outline-hidden` actually hides |

We do NOT touch:
- `shadow-md`, `shadow-lg`, `shadow-xl` — these names are kept in v4
- `rounded-md`, `rounded-lg`, `rounded-xl` — kept
- `ring`, `ring-2`, `ring-offset-*` — already explicit widths, no rename needed

**Files affected (audited):**
- Multiple shadcn primitives (`alert-dialog.tsx`, `card.tsx`, `checkbox.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `sheet.tsx`, `sidebar.tsx`, `tabs.tsx`, `tooltip.tsx`)
- `app/src/ui/components/requests/data-table.tsx` (uses `shadow-md`)
- `app/src/ui/components/ResponseDialog.tsx` (uses `dark:bg-[#1a1a1a]` + `focus:outline-none`)

- [ ] **Step 1: Inventory current class usage**

Run from repo root:
```bash
grep -rE '\bshadow-sm\b' app/src --include='*.ts' --include='*.tsx' | wc -l
grep -rE '\brounded-sm\b' app/src --include='*.ts' --include='*.tsx' | wc -l
grep -rE '\boutline-none\b' app/src --include='*.ts' --include='*.tsx' | wc -l
grep -rE 'className=.*\bshadow\b[^-]' app/src --include='*.tsx' | wc -l
```

Capture the counts. They should each be in the single or low double digits. If any is much larger than expected (>50), STOP — something is mis-targeted.

- [ ] **Step 2: Apply `shadow-sm` → `shadow-xs`**

Run from repo root:
```bash
find app/src \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 perl -i -pe 's/\bshadow-sm\b/shadow-xs/g'
```

Verify:
```bash
grep -rE '\bshadow-sm\b' app/src --include='*.ts' --include='*.tsx'
```
Expected: no output.

- [ ] **Step 3: Apply `rounded-sm` → `rounded-xs`**

```bash
find app/src \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 perl -i -pe 's/\brounded-sm\b/rounded-xs/g'
```

Verify:
```bash
grep -rE '\brounded-sm\b' app/src --include='*.ts' --include='*.tsx'
```
Expected: no output.

- [ ] **Step 4: Apply `outline-none` → `outline-hidden`**

```bash
find app/src \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 perl -i -pe 's/\boutline-none\b/outline-hidden/g'
```

Verify:
```bash
grep -rE '\boutline-none\b' app/src --include='*.ts' --include='*.tsx'
```
Expected: no output.

- [ ] **Step 5: Apply bare `shadow` → `shadow-sm`**

This rename is trickier — `shadow` matched alone (no following `-md`, `-xs`, etc.) needs to become `shadow-sm`. Use a negative lookahead:

```bash
find app/src \( -name '*.ts' -o -name '*.tsx' \) -print0 | xargs -0 perl -i -pe 's/\bshadow(?![\w-])/shadow-sm/g'
```

This regex says: match `shadow` followed by a non-word, non-hyphen character (i.e. a quote, space, or end of string within a class string). It will leave `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-xs`, `shadow-2xl`, `data-shadow-foo`, etc. alone.

Verify:
```bash
grep -rE 'className=.*\bshadow\b[^-]' app/src --include='*.tsx'
```
Expected: no output (the only previous site was sidebar.tsx, now `shadow-sm`).

If you find any `shadow-mdshadow-sm` or other concatenations, the regex over-matched — STOP and inspect.

- [ ] **Step 6: Remove the `dark:` prefix in `ResponseDialog.tsx`**

The file has one `dark:bg-[#1a1a1a]` paired with `bg-[#f5f5f5]` for image preview backdrop. Since the project is dark-only, the `bg-[#f5f5f5]` light fallback never applies. Collapse to just the dark color.

Edit `app/src/ui/components/ResponseDialog.tsx`. Find this line (around line 700):

```tsx
<div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-[#f5f5f5] dark:bg-[#1a1a1a]">
```

Replace with:

```tsx
<div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-[#1a1a1a]">
```

Verify there are no other `dark:` prefixes in source:
```bash
grep -rE '\bdark:' app/src --include='*.ts' --include='*.tsx'
```
Expected: no output.

- [ ] **Step 7: Run lint + build + test**

Run from `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all three green.

- [ ] **Step 8: Visual sanity check (manual)**

Reload the extension in Chrome (`chrome://extensions` → reload Debug Buddy). Confirm the visual rendering is the same as after Task 1. Specifically:
- The dialog's image preview area is still dark (the `bg-[#1a1a1a]` change).
- Buttons, cards, badges all still have visible shadows (`shadow-xs` is the same pixel value as v3's `shadow-sm`).
- Tabs and dropdown menu items still have their pill/rounded corners (`rounded-xs` matches v3's `rounded-sm`).
- Focus rings on inputs/buttons still appear (`outline-hidden` keeps the focus state visible because the ring is provided by `focus:ring-2`).

If anything looks visually different, the rename was mis-applied — investigate before committing.

- [ ] **Step 9: Commit**

Run from repo root:
```bash
git add app/src
git commit -m "$(cat <<'EOF'
style(css): apply Tailwind v4 utility class renames

- shadow-sm → shadow-xs (v4 visual shift)
- bare shadow → shadow-sm (v4 visual shift)
- rounded-sm → rounded-xs (v4 visual shift)
- outline-none → outline-hidden (v4 semantic change; outline-none now means transparent)
- Removed dark:bg-[#1a1a1a] companion of bg-[#f5f5f5] in ResponseDialog (project is dark-only)

No visual rendering change. Mechanical perl-driven renames + one manual edit.
EOF
)"
```

---

## Task 3: Cleanup old config files

**Why:** Tailwind v4 reads its configuration from CSS `@theme` blocks. The JS config file (`tailwind.config.cjs`) is dead code after Task 1. The shadcn CLI config (`components.json`) needs its `tailwind.config` field cleared (v4 has no JS config to point at).

**Files:**
- Delete: `app/tailwind.config.cjs`
- Modify: `app/components.json`

- [ ] **Step 1: Verify nothing else references `tailwind.config.cjs`**

Run from repo root:
```bash
grep -rn 'tailwind.config' app/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.cjs' --include='*.mts' --include='*.json' 2>&1 | grep -v node_modules
```

Expected output should show only:
- `app/components.json` (the shadcn CLI ref we're about to update)
- Possibly the docs files if any reference `tailwind.config.cjs` for historical context — those are out of scope.

If anything else (e.g. a script in `package.json` or a hidden import) references `tailwind.config.cjs`, STOP and report.

- [ ] **Step 2: Delete `app/tailwind.config.cjs`**

Run from repo root:
```bash
git rm app/tailwind.config.cjs
```

Expected: file staged as deletion. 93 lines gone.

- [ ] **Step 3: Update `app/components.json`**

Edit `app/components.json`. In the `tailwind` object, change `config`:

```diff
   "tailwind": {
-    "config": "tailwind.config.cjs",
+    "config": "",
     "css": "src/ui/globals.css",
     "baseColor": "slate",
     "cssVariables": true
   },
```

(`""` is the official shadcn v4 marker for "no JS config; v4 reads CSS-first." The shadcn CLI 2.x detects this and adapts.)

Verify the JSON is still valid:
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('app/components.json','utf8')).tailwind)"
```
Expected: `{ config: '', css: 'src/ui/globals.css', baseColor: 'slate', cssVariables: true }`.

- [ ] **Step 4: Run lint + build + test**

Run from `app/`:
```bash
npm run lint && npm run build && npm test
```

Expected: all three green. (`tailwind.config.cjs` was never imported by Vite — it was only consumed by the v3 plugin, which is now gone — so removing it is a no-op for the build.)

- [ ] **Step 5: Commit**

Run from repo root:
```bash
git add app/components.json
# tailwind.config.cjs already staged via git rm in Step 2
git commit -m "build(css): drop tailwind.config.cjs and update components.json for v4"
```

---

## Task 4: End-to-end verification

**Why:** Phase gate. No commit. Confirms the cumulative effect of Tasks 1–3 produced a clean, consistent v4 baseline.

- [ ] **Step 1: Clean install from scratch**

Run from `app/`:
```bash
rm -rf node_modules
npm ci
```

Expected: succeeds. The lockfile is internally consistent.

- [ ] **Step 2: Lint via Biome**

Run from `app/`:
```bash
npm run lint
```

Expected: zero errors. 3 pre-existing `useExhaustiveDependencies` warnings (carried over from Phase 1).

- [ ] **Step 3: Build**

Run from `app/`:
```bash
npm run build
```

Expected: succeeds in <2s. `app/dist/` populated. The `dist/assets/main-*.css` should be roughly comparable in size to the pre-Phase-2 baseline (within 10%) — Tailwind v4 generates leaner CSS than v3, but the additional `tw-animate-css` rules add some bytes. Net change is small.

Capture the CSS file size:
```bash
ls -lh app/dist/assets/main-*.css
```

- [ ] **Step 4: Tests**

Run from `app/`:
```bash
npm test
```

Expected: 10 test files, 59 passed + 1 skipped.

- [ ] **Step 5: Coverage**

Run from `app/`:
```bash
npm run test:coverage 2>&1 | tail -5
```

Expected: succeeds; coverage report emitted.

- [ ] **Step 6: Hooks smoke test**

From repo root:
```bash
git commit --allow-empty -m "wip" 2>&1 | tail -10 || true
git commit --allow-empty -m "chore: phase 2 hooks smoke test"
git reset --hard HEAD~1
```

Expected: first commit rejected by commitlint; second succeeds; reset returns to clean state.

- [ ] **Step 7: Manual smoke test in Chrome**

Load `app/dist/` unpacked in `chrome://extensions`. Confirm:
1. UI loads with dark theme.
2. Sidebar visible and styled.
3. Click "Select Tab" — dialog opens with fade-in/zoom-in animation.
4. Pick a tab, click "Start Debugging" — chrome's debug warning bar appears on target tab.
5. Trigger requests on target tab; they appear in Request History.
6. Open a request's details — dropdown menu has the same animation as before.
7. Status indicator in the header pulses (green → red → green) when there's a debugging session.
8. Click "Stop Debugging" — clean shutdown.
9. No new console errors in the service worker DevTools or the interceptor page.

**This is the most important verification step.** Tailwind v4 migrations occasionally have subtle visual regressions (color drift, spacing changes from default theme shifts) that aren't caught by automated tests.

- [ ] **Step 8: Confirm git history**

From repo root:
```bash
git log --oneline -5
```

Expected (newest first):
```
<hash> build(css): drop tailwind.config.cjs and update components.json for v4
<hash> style(css): apply Tailwind v4 utility class renames
<hash> build(css): migrate to Tailwind v4 with dark-only theme
<hash> docs: implementation plan for Phase 2 (tailwind v4)
<hash> ... (Phase 1 final commit on main)
```

- [ ] **Step 9: Bisect-safety verification (optional but recommended)**

For each commit on the branch (excluding the plan), `npm ci && npm run build && npm test` should be green. Quick check:

```bash
for sha in $(git log --format=%h main..HEAD | head -3); do
  echo "=== $sha ==="
  git checkout $sha -- app/
  cd app && npm ci > /dev/null 2>&1 && npm run build > /dev/null 2>&1 && echo "BUILD OK" || echo "BUILD FAIL"
  cd ..
done
git checkout HEAD -- app/   # restore final state
```

Each iteration should print "BUILD OK". If any prints "BUILD FAIL", the commit isn't bisect-safe — investigate before merging.

---

## Done criteria

- All 3 task commits present on the branch (Task 4 is verification, no commit).
- `npm ci && npm run lint && npm run build && npm test` from `app/` is green on a freshly-installed tree.
- Manual smoke test in Chrome: extension loads, all animations work, status indicator pulses, dialogs/dropdowns/tooltips animate as before.
- `git status` is clean.
- `app/tailwind.config.cjs` and `app/postcss.config.cjs` are gone.
- `app/biome.json` is unchanged (Tailwind migration didn't touch lint config).
- The `useExhaustiveDependencies` warning count is the same as before Phase 2 (3 pre-existing).

Once those boxes are ticked, Phase 2 is ready to merge into `main` (via PR, mirroring Phase 0/1). The next plan (Phase 3 — cleanup of legacy rule formats and type unification) depends on this baseline.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `tw-animate-css` doesn't fully match `tailwindcss-animate`'s utility set, breaking some shadcn animations | Low | The package is the official replacement and documents 1:1 parity with tailwindcss-animate; Step 7 of Task 1 catches any visible breakage. Fallback: import `tailwindcss-animate` via `@plugin` directive in CSS (v4 supports JS plugins as fallback). |
| Color drift after the `--color-*` rename | Medium | Verified by manual Chrome smoke test in Step 7. Each token's HSL value is preserved verbatim from the v3 `.dark` block. |
| Class rename regex over-matches | Low | Each step has a verification grep that should return empty. Steps 2-5 of Task 2 explicitly check post-rename. |
| Lockfile churn obscures the real diff | Low | `package-lock.json` is the bulk of the diff but only reflects v3-tree removal + v4-tree addition. Reviewers can use `--stat` to focus on intentional source changes. |
| `@theme` block doesn't auto-generate utility classes | Low | Tailwind v4 docs explicitly cover this; the `--color-*` prefix is the documented mechanism. Build will fail loudly if misconfigured. |
| `shadow` bare regex (Task 2 Step 5) corrupts unrelated patterns | Low | The negative lookahead `\bshadow(?![\w-])` is precise; verification grep catches any accident. |
