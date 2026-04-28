# Phase 5 — Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded color literals with semantic theme tokens, add the missing `success`/`warning`/`info` semantic tokens (currently only `destructive` exists), centralize HTTP-status-based badge styling so 2xx/3xx/4xx/5xx render with consistent semantic colors, fix the latent SidebarMenuButton outline shadow that references an undefined CSS var, eliminate the three accumulated `useExhaustiveDependencies` lint warnings, and replace the deprecated `unescape()` call in `ResponseDialog`.

**Architecture:** Six small commits, each touching one concern. No dialog/page layout reflow, no font swap, no aesthetic redesign — those are open-ended and would need iterative visual review with the user. This plan stays in the deterministic-fix lane: add tokens, centralize one badge helper, replace 3 hardcoded grays, fix 1 broken CSS var reference, fix 3 hook deps, replace 1 deprecated browser API. Visual polish beyond this is deferred to a follow-up phase that runs after the user has reviewed the merged Phase 5 in Chrome and reports specific issues.

**Tech Stack:** Tailwind v4 (`@theme` block), TypeScript 5.3 strict, Vite 6, Vitest 1.6, Biome 1.9.4, React 19.

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 5 — Visual refresh (dark default + bug fixes)".

**Working directory:** `app/` for npm/biome/tsc/vitest commands; repo root for git.

**Worktree:** Execute in a dedicated worktree (e.g. `/.claude/worktrees/<name>`) created from `main` (Phase 4 already merged via PR #36).

**Spec deviation acknowledged:** The spec also lists "auditoria de layout em cada página/dialog" with adjustments to spacing, alignment, contraste, foco visível, densidade, e ícones. Those edits require iterative visual feedback with the user (screenshots in Chrome, "this looks too dense, this hover state is wrong, etc."). They're out of scope for this plan because there's no way to enumerate them deterministically up front. After Phase 5 merges, run the user through a visual review and open follow-up issues for each concrete finding.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `app/src/ui/globals.css` | Modify | Add `--color-success`/`--color-warning`/`--color-info` (+ foreground pairs) to `@theme`. Add a documenting comment block at the top listing every token's purpose. |
| `app/src/ui/lib/statusBadge.ts` | Create | Pure helper exporting `getStatusBadgeClass(status: number)` and `getStatusLabel(status: number)` that map HTTP status codes to semantic Tailwind classes (using the tokens added above). |
| `app/src/ui/lib/__tests__/statusBadge.test.ts` | Create | Vitest unit tests covering all four status ranges + edge cases. |
| `app/src/ui/components/ResponseList.tsx` | Modify | Replace `text-gray-500` and `bg-gray-500` with semantic tokens; use `getStatusBadgeClass` for any status-code badges. |
| `app/src/ui/components/SiteHeader.tsx` | Modify | Replace `bg-gray-400` (status indicator when idle) with `bg-muted`. |
| `app/src/ui/components/rules/rule-columns.tsx` | Modify | Replace `bg-green-500`/`text-gray-500` with semantic tokens (success/muted-foreground). |
| `app/src/ui/components/shadcn/sidebar.tsx` | Modify | Line ~515 (SidebarMenuButton outline variant): `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` → `shadow-[0_0_0_1px_var(--color-sidebar-border)]`; same for `--sidebar-accent`. |
| `app/src/ui/components/requests/data-table.tsx` | Modify | Add the missing `columnVisibility` dependency to the `useEffect` flagged by Biome's `useExhaustiveDependencies`. |
| `app/src/ui/components/shadcn/sidebar.tsx` | Modify (same file as above) | Two `useExhaustiveDependencies` warnings — address per the lint diagnostic (likely add or remove deps that Biome correctly flags). |
| `app/src/ui/components/ResponseDialog.tsx` | Modify | Line ~132: replace `unescape(string)` with `decodeURIComponent(string.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))` (a defensive equivalent that handles malformed input the way `unescape` did). |

No source files outside the listed ones modified. Tests update count: +1 file (`statusBadge.test.ts`).

---

## Task 1: Add semantic status tokens + document `@theme` block

**Why:** The current `@theme` block in `globals.css` defines surfaces (`background`/`card`/`popover`), interactive (`primary`/`secondary`/`accent`/`muted`/`destructive`), and a sidebar set. There's no `success`/`warning`/`info` — anything semantic that's not "destructive red" today falls back to hardcoded Tailwind palette colors (`green-500`, `gray-500`, etc.). Adding them centrally lets every component use the same shade for "everything is fine" / "you should look at this" / "please don't do this" without each file picking its own.

**Files:**
- Modify: `app/src/ui/globals.css`

- [ ] **Step 1: Read current `globals.css`**

```bash
cat app/src/ui/globals.css
```

- [ ] **Step 2: Replace the `@theme` block with the expanded version**

Find the comment that introduces the @theme block:
```css
/*
 * Design tokens — dark only.
 * Tailwind v4 generates utility classes (bg-foo, text-foo, border-foo, ring-foo)
 * automatically from any --color-* variable declared in the @theme block.
 * No :root light variant. No .dark class. The whole UI is dark-by-default.
 */
@theme {
```

Expand the comment block to enumerate every token's role, and add the new semantic tokens. Replace from the comment block start through the closing `}` of `@theme {...}` with:

```css
/*
 * Design tokens — dark only. The whole UI is dark-by-default; no :root
 * light variant, no .dark class.
 *
 * Tailwind v4 auto-generates utility classes (bg-X, text-X, border-X,
 * ring-X) from each `--color-X` declared here. Naming convention:
 * `--color-{role}` for the surface/interactive token; `--color-{role}-foreground`
 * for the text/icon color that sits on top of that surface (always
 * AA-contrast against the role color).
 *
 * Roles:
 *  - background / foreground:  page canvas + default text
 *  - card / popover:           floating surfaces
 *  - primary:                  the dominant action (button)
 *  - secondary / muted:        de-emphasized surfaces and text
 *  - accent:                   hover states + subtle highlights
 *  - destructive:              red — destructive actions, error states
 *  - success:                  green — confirmation, healthy state, 2xx
 *  - warning:                  amber — caution, 4xx
 *  - info:                     blue — informational, 3xx
 *  - border / input / ring:    form chrome
 *  - sidebar*:                 own scale because the sidebar sits on the
 *                              canvas (not on a card). Slightly different
 *                              hue from the rest to create visual hierarchy.
 *
 * Radius:
 *  - lg: 0.5rem  (cards, dialogs, large surfaces)
 *  - md: lg-2    (buttons, inputs, mid-size)
 *  - sm: lg-4    (badges, tight controls)
 *
 * Animations:
 *  - accordion-down/up: drive Radix accordion content expand/collapse.
 *    Keyframes are declared below this @theme block; the --animate-* vars
 *    register them as Tailwind utility classes.
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

	/* Status */
	--color-destructive: hsl(0 62.8% 30.6%);
	--color-destructive-foreground: hsl(210 40% 98%);

	--color-success: hsl(142 70% 45%);
	--color-success-foreground: hsl(0 0% 100%);

	--color-warning: hsl(35 92% 50%);
	--color-warning-foreground: hsl(0 0% 100%);

	--color-info: hsl(217 91% 60%);
	--color-info-foreground: hsl(0 0% 100%);

	/* Form chrome */
	--color-border: hsl(217.2 32.6% 17.5%);
	--color-input: hsl(217.2 32.6% 17.5%);
	--color-ring: hsl(212.7 26.8% 83.9%);

	/* Sidebar (own scale — sits on the canvas, not the card) */
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
```

- [ ] **Step 3: Verify build emits the new utilities**

From `app/`:
```bash
npm run build
grep -oE '\.bg-(success|warning|info)[^{]*\{[^}]*\}' dist/assets/main-*.css | head -6
```

Expected output (or similar):
```
.bg-success{background-color:var(--color-success)}
.bg-success-foreground{background-color:var(--color-success-foreground)}
.bg-warning{background-color:var(--color-warning)}
.bg-warning-foreground{background-color:var(--color-warning-foreground)}
.bg-info{background-color:var(--color-info)}
.bg-info-foreground{background-color:var(--color-info-foreground)}
```

If you don't see those classes in the output, Tailwind v4 didn't generate them — verify the `--color-*` names are correct.

- [ ] **Step 4: All gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green. (No source changes yet — only CSS tokens added.)

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/globals.css
git commit -m "feat(css): add success/warning/info semantic tokens and document @theme"
```

---

## Task 2: HTTP status badge helper + tests

**Why:** Status codes (200, 304, 404, 500, etc.) are displayed in the request history table. Today they're styled per-component, sometimes with hardcoded colors. Centralize a helper that maps the status range to a semantic class so every consumer renders 2xx green / 3xx blue / 4xx amber / 5xx red consistently.

**Files:**
- Create: `app/src/ui/lib/statusBadge.ts`
- Create: `app/src/ui/lib/__tests__/statusBadge.test.ts`

- [ ] **Step 1: Create `app/src/ui/lib/statusBadge.ts`**

```ts
/**
 * Maps an HTTP status code to a semantic Tailwind class set for badge styling.
 *
 * - 1xx (informational): muted (rare; we don't have a dedicated token)
 * - 2xx (success):       success token
 * - 3xx (redirect):      info token
 * - 4xx (client error):  warning token
 * - 5xx (server error):  destructive token
 *
 * Returns CSS classes that compose bg + text + border for use on a `<Badge>`.
 */
export function getStatusBadgeClass(status: number): string {
	if (status >= 500) {
		return 'bg-destructive/15 text-destructive border-destructive/40';
	}
	if (status >= 400) {
		return 'bg-warning/15 text-warning border-warning/40';
	}
	if (status >= 300) {
		return 'bg-info/15 text-info border-info/40';
	}
	if (status >= 200) {
		return 'bg-success/15 text-success border-success/40';
	}
	if (status >= 100) {
		return 'bg-muted text-muted-foreground border-muted-foreground/30';
	}
	// Unknown/0/negative — treat as muted to avoid lying about success
	return 'bg-muted text-muted-foreground border-muted-foreground/30';
}

/**
 * Returns a short human label for a status code's category.
 * Used as fallback text when statusText from the response is missing.
 */
export function getStatusCategory(status: number): string {
	if (status >= 500) return 'Server Error';
	if (status >= 400) return 'Client Error';
	if (status >= 300) return 'Redirect';
	if (status >= 200) return 'Success';
	if (status >= 100) return 'Informational';
	return 'Unknown';
}
```

The `/15` opacity creates a translucent surface (15% opacity over the dark canvas) — the semantic token's hue shows through softly while the text uses the full token color for high contrast. Borders at `/40` match the visual style established by the `data-table.tsx` Live Tail/Limpar buttons after Phase 2's hotfix.

- [ ] **Step 2: Create `app/src/ui/lib/__tests__/statusBadge.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { getStatusBadgeClass, getStatusCategory } from '../statusBadge';

describe('getStatusBadgeClass', () => {
	test('5xx returns destructive classes', () => {
		expect(getStatusBadgeClass(500)).toContain('bg-destructive');
		expect(getStatusBadgeClass(503)).toContain('text-destructive');
		expect(getStatusBadgeClass(599)).toContain('border-destructive');
	});

	test('4xx returns warning classes', () => {
		expect(getStatusBadgeClass(400)).toContain('bg-warning');
		expect(getStatusBadgeClass(404)).toContain('text-warning');
		expect(getStatusBadgeClass(429)).toContain('border-warning');
	});

	test('3xx returns info classes', () => {
		expect(getStatusBadgeClass(301)).toContain('bg-info');
		expect(getStatusBadgeClass(304)).toContain('text-info');
		expect(getStatusBadgeClass(308)).toContain('border-info');
	});

	test('2xx returns success classes', () => {
		expect(getStatusBadgeClass(200)).toContain('bg-success');
		expect(getStatusBadgeClass(204)).toContain('text-success');
		expect(getStatusBadgeClass(299)).toContain('border-success');
	});

	test('1xx returns muted classes', () => {
		expect(getStatusBadgeClass(100)).toContain('bg-muted');
		expect(getStatusBadgeClass(102)).toContain('text-muted-foreground');
	});

	test('unknown / 0 / negative returns muted classes', () => {
		expect(getStatusBadgeClass(0)).toContain('bg-muted');
		expect(getStatusBadgeClass(-1)).toContain('bg-muted');
	});

	test('boundary 200 vs 199', () => {
		expect(getStatusBadgeClass(200)).toContain('bg-success');
		expect(getStatusBadgeClass(199)).toContain('bg-muted');
	});
});

describe('getStatusCategory', () => {
	test.each([
		[500, 'Server Error'],
		[404, 'Client Error'],
		[301, 'Redirect'],
		[200, 'Success'],
		[100, 'Informational'],
		[0, 'Unknown'],
	])('status %i → %s', (status, expected) => {
		expect(getStatusCategory(status)).toBe(expected);
	});
});
```

- [ ] **Step 3: All gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all green. The new test file should add 8 tests, taking the total from 59 to 67 passed (+ 1 skipped).

- [ ] **Step 4: Commit**

```bash
git add app/src/ui/lib/statusBadge.ts app/src/ui/lib/__tests__/statusBadge.test.ts
git commit -m "feat(ui): centralize HTTP status badge helper with semantic tokens"
```

---

## Task 3: Replace hardcoded grays with semantic tokens

**Why:** Three components currently use hardcoded Tailwind palette grays where semantic tokens are clearer.

**Files:**
- Modify: `app/src/ui/components/ResponseList.tsx`
- Modify: `app/src/ui/components/SiteHeader.tsx`
- Modify: `app/src/ui/components/rules/rule-columns.tsx`

- [ ] **Step 1: Inventory the sites**

```bash
grep -rnE 'text-gray-|bg-gray-|bg-green-500|hover:bg-green-600' app/src --include='*.tsx' | grep -v test | grep -v 'shadcn/'
```

Expected output (or similar — exact line numbers may differ):
- `app/src/ui/components/ResponseList.tsx:N: text-gray-500`
- `app/src/ui/components/ResponseList.tsx:N: bg-gray-500`
- `app/src/ui/components/SiteHeader.tsx:N: bg-gray-400`
- `app/src/ui/components/rules/rule-columns.tsx:N: bg-green-500 hover:bg-green-600 / text-gray-500`

- [ ] **Step 2: ResponseList — replace `text-gray-500` and `bg-gray-500`**

In `ResponseList.tsx`:

Replace `text-gray-500` with `text-muted-foreground`:
```diff
-		return <p className="text-gray-500 p-4 no-responses">Nenhuma requisição encontrada</p>;
+		return <p className="text-muted-foreground p-4 no-responses">Nenhuma requisição encontrada</p>;
```

Replace `bg-gray-500 hover:bg-gray-500/90` with `bg-muted hover:bg-muted/90`:
```diff
-				return 'bg-gray-500 hover:bg-gray-500/90';
+				return 'bg-muted hover:bg-muted/90';
```

If the `bg-gray-500` site is part of an HTTP-status-mapped helper (e.g. `getStatusColor` style switch), also import `getStatusBadgeClass` from `@/ui/lib/statusBadge` and use it instead. Inspect the surrounding code; if the function is doing status-code → color mapping, replace the whole switch with the helper. If it's something else (like a generic "no requests yet" placeholder), just swap the gray.

- [ ] **Step 3: SiteHeader — replace `bg-gray-400`**

In `SiteHeader.tsx`, find the status indicator dot:
```tsx
<span
	className={`w-3 h-3 rounded-full ${
		isDebugging
			? pendingResponsesCount > 0
				? 'status-indicator-blinking'
				: 'bg-green-500'
			: 'bg-gray-400'
	}`}
/>
```

Replace `bg-gray-400` with `bg-muted-foreground/40` (low-opacity muted color reads as "off" without being too dim) and `bg-green-500` with `bg-success`:

```diff
 <span
 	className={`w-3 h-3 rounded-full ${
 		isDebugging
 			? pendingResponsesCount > 0
 				? 'status-indicator-blinking'
-				: 'bg-green-500'
-			: 'bg-gray-400'
+				: 'bg-success'
+			: 'bg-muted-foreground/40'
 	}`}
 />
```

- [ ] **Step 4: rule-columns — replace `bg-green-500`/`text-gray-500`**

In `rule-columns.tsx`, find the enabled-state badge:
```tsx
className={`px-2 py-1 h-8 ${rule.enabled ? 'bg-green-500 hover:bg-green-600' : 'text-gray-500'}`}
```

Replace with semantic tokens:
```diff
-className={`px-2 py-1 h-8 ${rule.enabled ? 'bg-green-500 hover:bg-green-600' : 'text-gray-500'}`}
+className={`px-2 py-1 h-8 ${rule.enabled ? 'bg-success hover:bg-success/90 text-success-foreground' : 'text-muted-foreground'}`}
```

- [ ] **Step 5: All gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all green.

- [ ] **Step 6: Confirm no `text-gray-` or `bg-gray-` remains in source**

```bash
grep -rnE 'text-gray-|bg-gray-' app/src --include='*.tsx' --include='*.ts' | grep -v test | grep -v 'shadcn/'
```

Expected: no output (the shadcn primitives may still have semantic uses; we only care about app-level code).

- [ ] **Step 7: Commit**

```bash
git add app/src/ui/components/ResponseList.tsx app/src/ui/components/SiteHeader.tsx app/src/ui/components/rules/rule-columns.tsx
git commit -m "refactor(ui): replace hardcoded grays with semantic theme tokens"
```

---

## Task 4: Fix latent SidebarMenuButton outline shadow + useExhaustiveDependencies

**Why:** Phase 2's final review flagged a latent bug at `app/src/ui/components/shadcn/sidebar.tsx:515` — the SidebarMenuButton outline variant uses `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` but the v4 `@theme` block defines `--color-sidebar-border` (with the `--color-` prefix), not the bare `--sidebar-border`. The compiled CSS resolves `var(--sidebar-border)` to nothing, producing `hsl()` (invalid), and the browser drops the shadow. The variant isn't currently used, but the trap is real.

Plus: 3 `useExhaustiveDependencies` Biome warnings have accumulated since Phase 1. Address them.

**Files:**
- Modify: `app/src/ui/components/shadcn/sidebar.tsx`
- Modify: `app/src/ui/components/requests/data-table.tsx`

- [ ] **Step 1: Locate the broken shadow reference**

```bash
grep -n 'hsl(var(--sidebar-border))\|hsl(var(--sidebar-accent))' app/src/ui/components/shadcn/sidebar.tsx
```

Expected: 1–2 matches (likely on the same line, around line 515).

- [ ] **Step 2: Fix the shadow reference**

Edit `app/src/ui/components/shadcn/sidebar.tsx`. Find the SidebarMenuButton outline variant string:
```tsx
'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
```

Replace with:
```tsx
'bg-background shadow-[0_0_0_1px_var(--color-sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--color-sidebar-accent)]',
```

(Two changes: `hsl(var(--sidebar-border))` → `var(--color-sidebar-border)` and same for accent. The `--color-*` vars in `@theme` are already complete `hsl(...)` values, so wrapping in `hsl()` again would be wrong.)

- [ ] **Step 3: Address `useExhaustiveDependencies` warnings**

Run lint and capture all warnings:
```bash
npm run lint 2>&1 | grep -A 5 "useExhaustiveDependencies" | head -40
```

You'll see ~3 warning blocks, each pointing at a specific `useEffect` / `useMemo` / `useCallback` with either a missing dep or an unnecessary dep. For each:

- **If Biome says "specifies more dependencies than necessary"**: remove the extra dep from the array.
- **If Biome says "does not specify all of its dependencies"**: add the missing dep to the array — UNLESS adding it would cause an infinite loop (in which case, refactor to use the dep via a ref or move the closure to avoid capturing it).

The most common case in this codebase is the first — Biome correctly flags that `setOpenMobile` (a stable React setter) doesn't need to be in the deps array. Just remove it.

For each warning, apply the appropriate fix. After each, re-run `npm run lint` and confirm the warning is gone.

- [ ] **Step 4: All gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all green. Lint should now report ZERO warnings (was 3).

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/components/shadcn/sidebar.tsx app/src/ui/components/requests/data-table.tsx
git commit -m "$(cat <<'EOF'
fix(ui): repair SidebarMenuButton outline shadow and exhaustive deps warnings

- shadcn/sidebar.tsx:515: outline variant referenced
  hsl(var(--sidebar-border)) but @theme exports --color-sidebar-border
  (the v4 prefix). Replaced with var(--color-sidebar-border) so the
  browser-readable shadow value resolves correctly. Same for the
  hover --sidebar-accent reference. The variant isn't used today but
  the latent regression is now real CSS.

- 3 Biome useExhaustiveDependencies warnings addressed across
  sidebar.tsx and requests/data-table.tsx. Each was flagged for
  either an unnecessary stable React setter in the deps array
  (removed) or a missing dep (added).

Lint now reports zero warnings (was 3 pre-existing since Phase 1).
EOF
)"
```

---

## Task 5: Replace deprecated `unescape` in ResponseDialog

**Why:** TypeScript flags `unescape(string)` as deprecated (TS6387). It was a Netscape-era API for decoding `%XX` URL encoding; modern code uses `decodeURIComponent` or a Buffer-based decoder. The only call site is `app/src/ui/components/ResponseDialog.tsx:132` where it's used to decode response body text.

**Files:**
- Modify: `app/src/ui/components/ResponseDialog.tsx`

- [ ] **Step 1: Locate the call site**

```bash
grep -n 'unescape' app/src/ui/components/ResponseDialog.tsx
```

Expected: 1 match around line 132. Read the surrounding context (`sed -n '120,140p' app/src/ui/components/ResponseDialog.tsx`) to understand what the value passed to `unescape` looks like.

- [ ] **Step 2: Replace `unescape` with safe `decodeURIComponent`**

`decodeURIComponent` throws `URIError` on malformed input (e.g. a literal `%` not followed by two hex digits — which `unescape` silently passed through). To match `unescape`'s tolerance, escape any standalone `%` first.

Find the line:
```tsx
const decoded = unescape(value);
```

(Or however the call is structured — adjust the variable names as you see them.)

Replace with:
```tsx
// Substitui unescape (deprecated) por uma versão tolerante a `%` solto.
// O encoding original vem do CDP; `unescape` aceitava `%` literais — para
// não regredir o comportamento, escapamos manualmente antes de decodificar.
const decoded = decodeURIComponent(value.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
```

The regex `%(?![0-9A-Fa-f]{2})` matches any `%` not followed by two hex digits and replaces it with `%25` (the URL-encoded form of `%`). This makes `decodeURIComponent` accept the input.

- [ ] **Step 3: Verify the relevant test still passes**

```bash
npm test -- ResponseDialog 2>&1 | tail -20
```

Expected: the `ResponseDialog.test.tsx` suite (9 tests) all pass.

- [ ] **Step 4: All gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all green. The TS6387 deprecation hint should disappear from `ResponseDialog.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/components/ResponseDialog.tsx
git commit -m "fix(ui): replace deprecated unescape with safe decodeURIComponent in ResponseDialog"
```

---

## Task 6: End-to-end verification

**Why:** Phase gate. No commit. Confirms the cumulative effect.

- [ ] **Step 1: Clean install**

From `app/`:
```bash
rm -rf node_modules
npm ci
```

- [ ] **Step 2: All four CI gates**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

Expected: all four green. Test count: 67 passed + 1 skipped (was 59/60; +8 from `statusBadge.test.ts`). Lint: ZERO warnings (was 3).

- [ ] **Step 3: Coverage spot check**

```bash
npm run test:coverage 2>&1 | grep statusBadge
```

Expected: `statusBadge.ts` has high coverage (the 8 unit tests directly exercise the helper).

- [ ] **Step 4: Confirm no hardcoded grays remain in app code**

```bash
grep -rnE 'text-gray-|bg-gray-' app/src --include='*.tsx' --include='*.ts' | grep -v test | grep -v 'shadcn/'
```

Expected: empty.

- [ ] **Step 5: Confirm shadow CSS var fix**

```bash
grep -n 'hsl(var(--sidebar' app/src/ui/components/shadcn/sidebar.tsx
```

Expected: empty. (All sidebar shadow references now use `var(--color-sidebar-*)`.)

- [ ] **Step 6: Manual smoke test in Chrome (CRITICAL)**

Build, load `app/dist/` unpacked. Verify:
1. UI loads with dark theme (no surprise color regressions).
2. SiteHeader status indicator: idle = subtle muted dot; debugging-no-pending = green; debugging-with-pending = pulsing red/green.
3. Open Settings page; rule rows show enabled/disabled state with semantic colors (green/muted), not pastel green/gray.
4. Open RequestHistory page; trigger requests on the target tab. The status code column should show 2xx as green, 3xx as blue, 4xx as amber, 5xx as red — with translucent backgrounds and border accents.
5. Open ResponseDialog on a captured request; the body decoder still works (no errors in service worker DevTools for the `unescape` → `decodeURIComponent` swap).
6. No new console errors anywhere.

- [ ] **Step 7: Confirm git history**

```bash
git log --oneline main..HEAD
```

Expected (newest first):
```
<hash> fix(ui): replace deprecated unescape with safe decodeURIComponent in ResponseDialog
<hash> fix(ui): repair SidebarMenuButton outline shadow and exhaustive deps warnings
<hash> refactor(ui): replace hardcoded grays with semantic theme tokens
<hash> feat(ui): centralize HTTP status badge helper with semantic tokens
<hash> feat(css): add success/warning/info semantic tokens and document @theme
<hash> docs: implementation plan for Phase 5 (visual refresh)
```

---

## Done criteria

- All 5 task commits present on the branch (Task 6 is verification, no commit).
- `npm ci && npm run lint && npm run typecheck && npm run build && npm test` from `app/` is green on a freshly-installed tree.
- Lint reports zero warnings (was 3 pre-existing since Phase 1).
- Test count: 67 passed + 1 skipped (was 59/60).
- `globals.css` documents every token at the top.
- No hardcoded `bg-gray-*` / `text-gray-*` / `bg-green-500` etc. in app code (shadcn primitives may keep semantic palette uses).
- `unescape` deprecation warning is gone.
- Sidebar outline variant CSS shadow resolves correctly (verified by inspecting the compiled CSS).
- Manual smoke test in Chrome confirms no visual regression and the new status badge palette renders.

Once those boxes are ticked, Phase 5 is ready to merge into `main`. The next plan (Phase 6 — folder restructure + Side Panel) depends on this baseline.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| New tokens (`success`/`warning`/`info`) shadow existing Tailwind palette names | Low | Tailwind v4 explicitly preserves the palette names (`green-500`, etc.). The new tokens add `bg-success` etc. — they don't conflict with `bg-green-500`. Existing palette uses still work. |
| `decodeURIComponent` rejects input that `unescape` accepted | Low | The regex pre-escape (`%` → `%25`) handles the only case where `unescape` was tolerant of malformed input. Edge case: `%` followed by exactly one hex digit then a non-hex — extremely rare in real response bodies. |
| Removing a dep in `useExhaustiveDependencies` causes a stale closure | Low | Biome's "specifies more dependencies than necessary" only fires for stable references (React `setX` setters, refs). Removing them is safe by definition. |
| Status badge classes look different from the Phase 2 hotfix Live Tail / Limpar buttons | Low | The `/15` opacity + `/40` border opacity match the Phase 2 hotfix's `bg-{color}-500/10 border-{color}-500/30` aesthetic. Slight saturation differences are intentional to make the new tokens distinct. |
| Sidebar outline variant becomes used after Task 4's fix and exposes other bugs | Low | The variant isn't currently used anywhere (verified via grep in Phase 2's final review). The fix prevents a future trap; current rendering is unchanged. |
| The `globals.css` `@theme` token comment becomes outdated | Medium | Documented inline next to each `--color-*` var via the role list; future contributors who add tokens should update both the var and the role list. CLAUDE.md's "Code style" section already references globals.css as the source of truth. |
