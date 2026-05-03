# Live Insights — Probe Wappalyzer Detector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o probe MAIN-world para emitir um array `techs[]` baseado no catálogo Wappalyzer + Scorer do Sub-projeto 1, ao lado do `fingerprint` legado (aditivo).

**Architecture:** Novo detector único `app/src/probe/detectors/wappalyzer.ts` orquestra (a) `signals.ts` que coleta MAIN-world signals (js/dom/meta/cookies/html/scripts/scriptSrc/css/text/url) com caps, (b) `domEval.ts` que avalia DOM rules em paralelo (workaround para matcher pure não ter Document), e (c) merge final reaplica `applyImplications`. `probe/main.ts` chama `detectTechs(window, document)` e inclui o resultado em `payload.techs`. Detectors legados ficam intactos.

**Tech Stack:** TypeScript strict, Vitest + jsdom, Biome, lib `app/src/lib/insights/` do Sub-projeto 1.

**Spec:** [docs/superpowers/specs/2026-05-03-live-insights-probe-wappalyzer-design.md](../specs/2026-05-03-live-insights-probe-wappalyzer-design.md)

**bd:** chrome-extension-debug-buddy-pkp

---

## File Map

**Created:**
- `app/src/probe/detectors/wappalyzer.ts` — `detectTechs(win, doc)` entrypoint
- `app/src/probe/detectors/wappalyzer/signals.ts` — `collectMainWorldSignals` + caps
- `app/src/probe/detectors/wappalyzer/domEval.ts` — `evaluateDomRules` + `matchDomRuleAgainstElement`
- `app/src/probe/detectors/wappalyzer/jsPath.ts` — `readDottedPath` + `serializeJsValue`
- `app/src/probe/detectors/__tests__/wappalyzer.test.ts`
- `app/src/probe/detectors/__tests__/signals.test.ts`
- `app/src/probe/detectors/__tests__/domEval.test.ts`
- `app/src/probe/detectors/__tests__/jsPath.test.ts`

**Modified:**
- `app/src/probe/protocol.ts` — `payload.techs?: TechHit[]`
- `app/src/lib/session/types.ts` — `PageDetection.techs?: TechHit[]`
- `app/src/types/messages.ts` — `Message.payload.techs?: TechHit[]`
- `app/src/probe/main.ts` — `emitDetection` chama `detectTechs` e inclui no payload

---

## Task 1: jsPath helpers (readDottedPath + serializeJsValue)

**Files:**
- Create: `app/src/probe/detectors/__tests__/jsPath.test.ts`
- Create: `app/src/probe/detectors/wappalyzer/jsPath.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/probe/detectors/__tests__/jsPath.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { JS_PATH_MAX_DEPTH, readDottedPath, serializeJsValue } from '../wappalyzer/jsPath';

describe('readDottedPath', () => {
	test('reads top-level property', () => {
		expect(readDottedPath({ foo: 'bar' }, 'foo')).toBe('bar');
	});

	test('reads nested property', () => {
		expect(readDottedPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
	});

	test('returns undefined when intermediate is missing', () => {
		expect(readDottedPath({ a: {} }, 'a.b.c')).toBeUndefined();
	});

	test('returns undefined when intermediate is null', () => {
		expect(readDottedPath({ a: null }, 'a.b')).toBeUndefined();
	});

	test('returns undefined when intermediate is primitive', () => {
		expect(readDottedPath({ a: 'string' }, 'a.b')).toBeUndefined();
	});

	test('returns undefined when path exceeds max depth', () => {
		const path = Array.from({ length: JS_PATH_MAX_DEPTH + 1 }, (_, i) => `p${i}`).join('.');
		expect(readDottedPath({}, path)).toBeUndefined();
	});

	test('handles getter that throws — returns undefined', () => {
		const root = {};
		Object.defineProperty(root, 'thrower', {
			get() {
				throw new Error('nope');
			},
		});
		expect(readDottedPath(root, 'thrower.value')).toBeUndefined();
	});

	test('reads function as value (window globals can be functions)', () => {
		const fn = () => 42;
		expect(readDottedPath({ jQuery: fn }, 'jQuery')).toBe(fn);
	});

	test('reads property on a function', () => {
		const fn = () => 0;
		(fn as unknown as { fn: { jquery: string } }).fn = { jquery: '3.6.0' };
		expect(readDottedPath({ $: fn }, '$.fn.jquery')).toBe('3.6.0');
	});
});

describe('serializeJsValue', () => {
	test('serializes string as-is', () => {
		expect(serializeJsValue('hello')).toBe('hello');
	});

	test('serializes number/boolean/null/undefined', () => {
		expect(serializeJsValue(42)).toBe('42');
		expect(serializeJsValue(true)).toBe('true');
		expect(serializeJsValue(null)).toBe('null');
		expect(serializeJsValue(undefined)).toBe('');
	});

	test('functions become <function> sentinel', () => {
		expect(serializeJsValue(() => 0)).toBe('<function>');
	});

	test('objects are JSON-stringified and capped at 200 chars', () => {
		const big = { items: Array.from({ length: 200 }, (_, i) => i) };
		const out = serializeJsValue(big);
		expect(out.length).toBeLessThanOrEqual(200);
		expect(out.startsWith('{"items":[')).toBe(true);
	});

	test('circular references return <object> sentinel without throwing', () => {
		const a: Record<string, unknown> = {};
		a.self = a;
		expect(serializeJsValue(a)).toBe('<object>');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/jsPath.test.ts`
Expected: FAIL — module `../wappalyzer/jsPath` not found.

- [ ] **Step 3: Implement jsPath**

Create `app/src/probe/detectors/wappalyzer/jsPath.ts`:

```ts
export const JS_PATH_MAX_DEPTH = 6;

export function readDottedPath(root: unknown, path: string): unknown {
	const parts = path.split('.');
	if (parts.length > JS_PATH_MAX_DEPTH) return undefined;
	let cur: unknown = root;
	for (const p of parts) {
		if (cur === null || cur === undefined) return undefined;
		if (typeof cur !== 'object' && typeof cur !== 'function') return undefined;
		try {
			cur = (cur as Record<string, unknown>)[p];
		} catch {
			// proxies ou getters podem throw — não fabricamos valor
			return undefined;
		}
	}
	return cur;
}

export function serializeJsValue(v: unknown): string {
	if (v === null) return 'null';
	if (v === undefined) return '';
	const t = typeof v;
	if (t === 'string') return v as string;
	if (t === 'number' || t === 'boolean') return String(v);
	if (t === 'function') return '<function>';
	try {
		const s = JSON.stringify(v);
		return s ? s.slice(0, 200) : '<object>';
	} catch {
		// circular ou TypeError em getters
		return '<object>';
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/jsPath.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/probe/detectors/wappalyzer/jsPath.ts app/src/probe/detectors/__tests__/jsPath.test.ts
git commit -m "$(cat <<'EOF'
feat(probe): jsPath helpers para wappalyzer detector

sub-projeto 2, task 1: readDottedPath com depth cap e proteção contra
getter throws; serializeJsValue com sentinels para function/circular.

bd: chrome-extension-debug-buddy-pkp

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: signals — collectMainWorldSignals com caps

**Files:**
- Create: `app/src/probe/detectors/__tests__/signals.test.ts`
- Create: `app/src/probe/detectors/wappalyzer/signals.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/probe/detectors/__tests__/signals.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { parsePattern } from '@/lib/insights/pattern';
import type { CompiledTech } from '@/lib/insights/types';
import { CSS_CAP, HTML_CAP, INLINE_SCRIPT_CAP, TEXT_CAP, collectMainWorldSignals } from '../wappalyzer/signals';

function tech(name: string, overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name,
		cats: [12],
		website: 'https://example.com',
		patterns: {},
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
		...overrides,
	};
}

describe('collectMainWorldSignals — js paths', () => {
	beforeEach(() => {
		// limpa globais entre testes para evitar vazamento
		delete (window as unknown as Record<string, unknown>).jQuery;
		delete (window as unknown as Record<string, unknown>).Shopify;
	});

	test('reads only js paths that are in the catalog', () => {
		(window as unknown as Record<string, unknown>).jQuery = { fn: { jquery: '3.6.0' } };
		(window as unknown as Record<string, unknown>).Shopify = 'something'; // não no catálogo

		const cat = [
			tech('jQuery', { patterns: { js: { 'jQuery.fn.jquery': parsePattern('([0-9.]+)') } } }),
			// note: Shopify tech intencionalmente sem entry js
		];
		const sigs = collectMainWorldSignals(cat, window, document);
		const jsSigs = sigs.filter((s) => s.kind === 'js');
		expect(jsSigs).toHaveLength(1);
		expect(jsSigs[0]).toMatchObject({ name: 'jQuery.fn.jquery', value: '3.6.0' });
	});

	test('skips js path when value is undefined', () => {
		const cat = [tech('jQuery', { patterns: { js: { 'jQuery.fn.jquery': parsePattern('') } } })];
		const sigs = collectMainWorldSignals(cat, window, document);
		expect(sigs.filter((s) => s.kind === 'js')).toHaveLength(0);
	});
});

describe('collectMainWorldSignals — DOM signals', () => {
	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
	});

	test('extracts meta tags by name and property', () => {
		document.head.innerHTML = `
			<meta name="generator" content="WordPress 6.4.2" />
			<meta property="og:type" content="website" />
		`;
		const sigs = collectMainWorldSignals([], window, document);
		const metaSigs = sigs.filter((s) => s.kind === 'meta');
		expect(metaSigs).toContainEqual({ kind: 'meta', name: 'generator', value: 'WordPress 6.4.2' });
		expect(metaSigs).toContainEqual({ kind: 'meta', name: 'og:type', value: 'website' });
	});

	test('skips meta tags without name+content', () => {
		document.head.innerHTML = `
			<meta name="just-a-name" />
			<meta content="no-name" />
		`;
		const sigs = collectMainWorldSignals([], window, document);
		expect(sigs.filter((s) => s.kind === 'meta')).toHaveLength(0);
	});

	test('extracts scriptSrc and inline script content', () => {
		document.body.innerHTML = `
			<script src="https://cdn.example.com/lib.min.js"></script>
			<script>window.foo = 1;</script>
		`;
		const sigs = collectMainWorldSignals([], window, document);
		expect(sigs).toContainEqual({ kind: 'scriptSrc', value: 'https://cdn.example.com/lib.min.js' });
		expect(sigs.some((s) => s.kind === 'script' && s.value.includes('window.foo'))).toBe(true);
	});

	test('caps inline script at INLINE_SCRIPT_CAP', () => {
		const big = 'x'.repeat(INLINE_SCRIPT_CAP * 2);
		const script = document.createElement('script');
		script.textContent = big;
		document.body.appendChild(script);
		const sigs = collectMainWorldSignals([], window, document);
		const inline = sigs.find((s) => s.kind === 'script');
		expect(inline?.value.length).toBe(INLINE_SCRIPT_CAP);
	});

	test('caps html at HTML_CAP', () => {
		// gera body grande
		document.body.innerHTML = `<div>${'x'.repeat(HTML_CAP * 2)}</div>`;
		const sigs = collectMainWorldSignals([], window, document);
		const html = sigs.find((s) => s.kind === 'html');
		expect(html?.value.length).toBe(HTML_CAP);
	});

	test('caps text at TEXT_CAP', () => {
		document.body.textContent = 'a'.repeat(TEXT_CAP * 2);
		const sigs = collectMainWorldSignals([], window, document);
		const text = sigs.find((s) => s.kind === 'text');
		expect(text?.value.length).toBe(TEXT_CAP);
	});

	test('emits url signal as location.href', () => {
		const sigs = collectMainWorldSignals([], window, document);
		const url = sigs.find((s) => s.kind === 'url');
		expect(url?.value).toBe(window.location.href);
	});
});

describe('collectMainWorldSignals — cookies', () => {
	test('parses document.cookie into name/value pairs', () => {
		// jsdom permite setar document.cookie diretamente
		document.cookie = 'session=abc123';
		document.cookie = 'wordpress_test_cookie=WP%20Cookie%20check';
		const sigs = collectMainWorldSignals([], window, document);
		const cookieSigs = sigs.filter((s) => s.kind === 'cookie');
		expect(cookieSigs.find((c) => c.name === 'session')?.value).toBe('abc123');
		expect(cookieSigs.find((c) => c.name === 'wordpress_test_cookie')?.value).toBe(
			'WP%20Cookie%20check',
		);
	});
});

describe('collectMainWorldSignals — css', () => {
	test('aggregates cssText from accessible stylesheets', () => {
		const style = document.createElement('style');
		style.textContent = '.foo { color: red; }';
		document.head.appendChild(style);
		const sigs = collectMainWorldSignals([], window, document);
		const css = sigs.find((s) => s.kind === 'css');
		expect(css?.value).toContain('.foo');
	});

	test('caps css at CSS_CAP and respects cap mid-stylesheet', () => {
		const long = `.x { content: '${'a'.repeat(CSS_CAP)}'; }`;
		const style = document.createElement('style');
		style.textContent = long;
		document.head.appendChild(style);
		const sigs = collectMainWorldSignals([], window, document);
		const css = sigs.find((s) => s.kind === 'css');
		expect(css?.value.length).toBeLessThanOrEqual(CSS_CAP);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/signals.test.ts`
Expected: FAIL — module `../wappalyzer/signals` not found.

- [ ] **Step 3: Implement signals**

Create `app/src/probe/detectors/wappalyzer/signals.ts`:

```ts
import type { CompiledTech, Signal } from '@/lib/insights/types';
import { readDottedPath, serializeJsValue } from './jsPath';

export const HTML_CAP = 100_000;
export const TEXT_CAP = 50_000;
export const CSS_CAP = 50_000;
export const INLINE_SCRIPT_CAP = 20_000;

export function collectMainWorldSignals(
	catalog: CompiledTech[],
	win: Window,
	doc: Document,
): Signal[] {
	const out: Signal[] = [];

	// js — só lê paths que aparecem em algum tech do catálogo
	const jsKeys = new Set<string>();
	for (const t of catalog) {
		if (t.patterns.js) for (const k of Object.keys(t.patterns.js)) jsKeys.add(k);
	}
	for (const path of jsKeys) {
		const value = readDottedPath(win, path);
		if (value === undefined) continue;
		out.push({ kind: 'js', name: path, value: serializeJsValue(value) });
	}

	// meta — <meta name=X content=Y> e <meta property=X content=Y>
	const metas = doc.head?.querySelectorAll('meta') ?? [];
	for (const m of metas) {
		const name = m.getAttribute('name') ?? m.getAttribute('property');
		const content = m.getAttribute('content');
		if (name && content) out.push({ kind: 'meta', name, value: content });
	}

	// cookies — document.cookie (não-HttpOnly)
	for (const part of doc.cookie.split(';')) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const eq = trimmed.indexOf('=');
		const name = eq === -1 ? trimmed : trimmed.slice(0, eq);
		const value = eq === -1 ? '' : trimmed.slice(eq + 1);
		if (name) out.push({ kind: 'cookie', name, value });
	}

	// scriptSrc + scripts (inline) — DOM pass único
	for (const s of doc.querySelectorAll('script')) {
		const src = s.getAttribute('src');
		if (src) {
			out.push({ kind: 'scriptSrc', value: src });
		} else if (s.textContent) {
			out.push({ kind: 'script', value: s.textContent.slice(0, INLINE_SCRIPT_CAP) });
		}
	}

	// html — outerHTML capado
	const outer = doc.documentElement?.outerHTML;
	if (outer) out.push({ kind: 'html', value: outer.slice(0, HTML_CAP) });

	// text — body textContent capado
	const text = doc.body?.textContent;
	if (text) out.push({ kind: 'text', value: text.slice(0, TEXT_CAP) });

	// css — agrega cssText de stylesheets acessíveis
	let cssBuf = '';
	outer_loop: for (const ss of Array.from(doc.styleSheets)) {
		try {
			for (const rule of Array.from(ss.cssRules)) {
				cssBuf += rule.cssText;
				if (cssBuf.length >= CSS_CAP) break outer_loop;
			}
		} catch {
			// cross-origin stylesheet — sem acesso por design do browser, pulamos
			// sem fabricar valor
		}
	}
	if (cssBuf) out.push({ kind: 'css', value: cssBuf.slice(0, CSS_CAP) });

	// url — location.href
	out.push({ kind: 'url', value: win.location.href });

	return out;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/signals.test.ts`
Expected: PASS — 11 tests.

If a test fails because jsdom doesn't expose `cssRules` or behaves differently, debug — but do not relax assertions or remove the cap test.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/probe/detectors/wappalyzer/signals.ts app/src/probe/detectors/__tests__/signals.test.ts
git commit -m "$(cat <<'EOF'
feat(probe): collectMainWorldSignals com caps

sub-projeto 2, task 2: coleta js (catálogo-dirigida)/meta/cookies/scripts
inline+src/html/text/css/url do MAIN-world. caps: html=100k, text=50k,
css=50k, inline-script=20k. cross-origin stylesheets pulados sem
fabricar valor.

bd: chrome-extension-debug-buddy-pkp

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: domEval — evaluateDomRules + matchDomRuleAgainstElement

**Files:**
- Create: `app/src/probe/detectors/__tests__/domEval.test.ts`
- Create: `app/src/probe/detectors/wappalyzer/domEval.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/probe/detectors/__tests__/domEval.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { parsePattern } from '@/lib/insights/pattern';
import type { CompiledDomRule, CompiledTech } from '@/lib/insights/types';
import { evaluateDomRules } from '../wappalyzer/domEval';

function tech(name: string, dom: CompiledDomRule[]): CompiledTech {
	return {
		name,
		cats: [12],
		website: 'https://example.com',
		patterns: { dom },
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
	};
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('evaluateDomRules', () => {
	test('matches exists-only rule when selector finds elements', () => {
		document.body.innerHTML = '<div class="wp-block-group"></div>';
		const cat = [tech('WP', [{ selector: 'div.wp-block-group', exists: true }])];
		const hits = evaluateDomRules(cat, document);
		expect(hits).toHaveLength(1);
		expect(hits[0].name).toBe('WP');
		expect(hits[0].confidence).toBe(100);
		expect(hits[0].evidence[0].signal).toBe('dom');
	});

	test('returns empty hit list when no rule matches', () => {
		document.body.innerHTML = '<p>nothing</p>';
		const cat = [tech('WP', [{ selector: 'div.wp-block-group', exists: true }])];
		expect(evaluateDomRules(cat, document)).toEqual([]);
	});

	test('matches attribute regex', () => {
		document.body.innerHTML = '<link rel="stylesheet" href="cdn.shopify.com/x.css" />';
		const cat = [
			tech('Shopify', [
				{
					selector: 'link[href]',
					attributes: { href: parsePattern('cdn\\.shopify\\.com\\;confidence:50') },
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits).toHaveLength(1);
		expect(hits[0].confidence).toBe(50);
	});

	test('captures version from attribute regex group', () => {
		document.body.innerHTML = '<div data-react-version="18.2.0"></div>';
		const cat = [
			tech('React', [
				{
					selector: 'div[data-react-version]',
					attributes: {
						'data-react-version': parsePattern('([0-9.]+)\\;version:\\1'),
					},
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits[0].version).toBe('18.2.0');
	});

	test('matches text content regex', () => {
		document.body.innerHTML = '<p class="footer">Powered by Magento</p>';
		const cat = [
			tech('Magento', [
				{ selector: 'p.footer', text: parsePattern('Powered by Magento') },
			]),
		];
		expect(evaluateDomRules(cat, document)).toHaveLength(1);
	});

	test('skips rule with invalid CSS selector without throwing', () => {
		const cat = [tech('Bad', [{ selector: 'this is :: not valid', exists: true }])];
		expect(() => evaluateDomRules(cat, document)).not.toThrow();
		expect(evaluateDomRules(cat, document)).toEqual([]);
	});

	test('caps evidence at 8 even with many matching elements', () => {
		const html = Array.from({ length: 20 }, (_, i) => `<div class="x" id="i${i}"></div>`).join('');
		document.body.innerHTML = html;
		const cat = [tech('T', [{ selector: 'div.x', exists: true }])];
		const hits = evaluateDomRules(cat, document);
		expect(hits[0].evidence.length).toBeLessThanOrEqual(8);
	});

	test('multiple rules contribute confidence per tech, capped at 100', () => {
		document.body.innerHTML = `
			<link rel="stylesheet" href="/wp-content/x.css" />
			<link rel="stylesheet" href="/wp-includes/y.css" />
		`;
		const cat = [
			tech('WP', [
				{
					selector: 'link[href*="/wp-content/"]',
					exists: true,
				},
				{
					selector: 'link[href*="/wp-includes/"]',
					exists: true,
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits[0].confidence).toBe(100); // 100+100 capa em 100
	});

	test('reads property via element subscript', () => {
		document.body.innerHTML = '<input id="x" />';
		const el = document.getElementById('x') as HTMLInputElement;
		(el as unknown as Record<string, unknown>).customProp = 'custom-value';
		const cat = [
			tech('PropTech', [
				{
					selector: '#x',
					properties: { customProp: parsePattern('custom-value') },
				},
			]),
		];
		const hits = evaluateDomRules(cat, document);
		expect(hits).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/domEval.test.ts`
Expected: FAIL — module `../wappalyzer/domEval` not found.

- [ ] **Step 3: Implement domEval**

Create `app/src/probe/detectors/wappalyzer/domEval.ts`:

```ts
import { expandVersion } from '@/lib/insights/pattern';
import type {
	CompiledDomRule,
	CompiledPattern,
	CompiledTech,
	MatchEvidence,
	TechHit,
} from '@/lib/insights/types';

interface ElementMatchResult {
	confidence: number;
	version?: string;
	matchedName?: string;
}

function tryMatch(
	value: string | null,
	pattern: CompiledPattern,
): ElementMatchResult | null {
	if (value === null) return null;
	const m = value.match(pattern.regex);
	if (!m) return null;
	return {
		confidence: pattern.confidence,
		version: expandVersion(pattern.versionTemplate, m),
	};
}

function readProperty(el: Element, prop: string): string | null {
	try {
		const v = (el as unknown as Record<string, unknown>)[prop];
		if (v === null || v === undefined) return null;
		if (typeof v === 'string') return v;
		if (typeof v === 'number' || typeof v === 'boolean') return String(v);
		return null;
	} catch {
		// getter pode throw — não fabricamos
		return null;
	}
}

function matchDomRuleAgainstElement(
	rule: CompiledDomRule,
	el: Element,
): ElementMatchResult | null {
	let totalConfidence = 0;
	let version: string | undefined;
	let matchedName: string | undefined;
	let anyHit = false;

	if (rule.attributes) {
		for (const [attr, pattern] of Object.entries(rule.attributes)) {
			const r = tryMatch(el.getAttribute(attr), pattern);
			if (r) {
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
				if (!matchedName) matchedName = `attr:${attr}`;
				anyHit = true;
			}
		}
	}
	if (rule.properties) {
		for (const [prop, pattern] of Object.entries(rule.properties)) {
			const r = tryMatch(readProperty(el, prop), pattern);
			if (r) {
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
				if (!matchedName) matchedName = `prop:${prop}`;
				anyHit = true;
			}
		}
	}
	if (rule.text) {
		const r = tryMatch(el.textContent, rule.text);
		if (r) {
			totalConfidence += r.confidence;
			if (!version && r.version) version = r.version;
			if (!matchedName) matchedName = 'text';
			anyHit = true;
		}
	}

	if (!anyHit) return null;
	return { confidence: totalConfidence, version, matchedName };
}

export function evaluateDomRules(catalog: CompiledTech[], doc: Document): TechHit[] {
	const out: TechHit[] = [];
	for (const tech of catalog) {
		if (!tech.patterns.dom) continue;
		const evidence: MatchEvidence[] = [];
		let totalConfidence = 0;
		let version: string | undefined;

		for (const rule of tech.patterns.dom) {
			if (evidence.length >= 8) break; // cap por tech
			let els: NodeListOf<Element>;
			try {
				els = doc.querySelectorAll(rule.selector);
			} catch {
				// selector inválido — pula sem fabricar match
				continue;
			}
			if (els.length === 0) continue;
			if (!rule.attributes && !rule.properties && !rule.text) {
				evidence.push({ signal: 'dom', pattern: rule.selector });
				totalConfidence += 100;
				continue;
			}
			for (const el of Array.from(els)) {
				if (evidence.length >= 8) break;
				const r = matchDomRuleAgainstElement(rule, el);
				if (!r) continue;
				evidence.push({
					signal: 'dom',
					pattern: rule.selector,
					matchedName: r.matchedName,
				});
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
			}
		}

		if (evidence.length === 0) continue;
		out.push({
			name: tech.name,
			cats: tech.cats,
			confidence: Math.min(100, totalConfidence),
			version,
			icon: tech.icon,
			website: tech.website,
			description: tech.description,
			evidence,
		});
	}
	return out;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/domEval.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/probe/detectors/wappalyzer/domEval.ts app/src/probe/detectors/__tests__/domEval.test.ts
git commit -m "$(cat <<'EOF'
feat(probe): evaluateDomRules — DOM matcher para wappalyzer

sub-projeto 2, task 3: avalia rules dom (selector + attributes/properties
/text com pattern matching e captura de versão). selector inválido pula
sem fabricar match. cap de evidence em 8 entradas por tech.

bd: chrome-extension-debug-buddy-pkp

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: wappalyzer entrypoint — detectTechs

**Files:**
- Create: `app/src/probe/detectors/__tests__/wappalyzer.test.ts`
- Create: `app/src/probe/detectors/wappalyzer.ts`

- [ ] **Step 1: Write failing tests (integration with real catalog)**

Create `app/src/probe/detectors/__tests__/wappalyzer.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { detectTechs } from '../wappalyzer';

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	// limpa globais comuns
	for (const k of ['jQuery', '$', '__NEXT_DATA__', 'Shopify', 'wp']) {
		delete (window as unknown as Record<string, unknown>)[k];
	}
});

afterEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
});

describe('detectTechs — empty page', () => {
	test('returns empty array on a blank document', () => {
		const techs = detectTechs(window, document);
		expect(techs).toEqual([]);
	});
});

describe('detectTechs — WordPress page', () => {
	test('detects WordPress and implies PHP', () => {
		document.head.innerHTML = `
			<meta name="generator" content="WordPress 6.4.2" />
			<link rel="stylesheet" href="/wp-content/themes/twentytwentyfour/style.css" />
			<link rel="stylesheet" href="/wp-includes/css/dist/block-library/style.min.css" />
		`;
		document.body.innerHTML = `
			<script src="/wp-content/plugins/jetpack/jet.js"></script>
			<script src="/wp-includes/js/wp-emoji.js"></script>
		`;

		const techs = detectTechs(window, document);
		const names = techs.map((t) => t.name);
		expect(names).toContain('WordPress');
		expect(names).toContain('PHP'); // implies
	});

	test('captures WordPress version from meta generator', () => {
		document.head.innerHTML = `<meta name="generator" content="WordPress 6.4.2" />`;
		document.body.innerHTML = `<script src="/wp-content/x.js"></script>`;
		const techs = detectTechs(window, document);
		const wp = techs.find((t) => t.name === 'WordPress');
		expect(wp?.version).toBe('6.4.2');
	});
});

describe('detectTechs — Shopify page', () => {
	test('detects Shopify from CDN scripts', () => {
		document.body.innerHTML = `
			<script src="https://cdn.shopify.com/s/files/1/0001/0001/t/2/assets/theme.js"></script>
		`;
		const techs = detectTechs(window, document);
		expect(techs.map((t) => t.name)).toContain('Shopify');
	});
});

describe('detectTechs — Next.js page', () => {
	test('detects Next.js via __NEXT_DATA__ global and implies React', () => {
		(window as unknown as Record<string, unknown>).__NEXT_DATA__ = { props: {} };
		const techs = detectTechs(window, document);
		const names = techs.map((t) => t.name);
		expect(names).toContain('Next.js');
		expect(names).toContain('React');
	});
});

describe('detectTechs — jQuery via window global', () => {
	test('detects jQuery and captures version', () => {
		const fn = function jQueryStub() {};
		(fn as unknown as { fn: { jquery: string } }).fn = { jquery: '3.6.0' };
		(window as unknown as Record<string, unknown>).jQuery = fn;
		const techs = detectTechs(window, document);
		const jq = techs.find((t) => t.name === 'jQuery');
		expect(jq).toBeDefined();
		expect(jq?.version).toBe('3.6.0');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/wappalyzer.test.ts`
Expected: FAIL — module `../wappalyzer` not found.

- [ ] **Step 3: Implement wappalyzer**

Create `app/src/probe/detectors/wappalyzer.ts`:

```ts
import { COMPILED_CATALOG } from '@/lib/insights/catalog';
import { applyImplications } from '@/lib/insights/implications';
import { Scorer } from '@/lib/insights/scorer';
import type { CompiledTech, TechHit } from '@/lib/insights/types';
import { evaluateDomRules } from './wappalyzer/domEval';
import { collectMainWorldSignals } from './wappalyzer/signals';

const EVIDENCE_CAP = 8;

export function detectTechs(win: Window, doc: Document): TechHit[] {
	const scorer = new Scorer(COMPILED_CATALOG);
	scorer.pushSignals(collectMainWorldSignals(COMPILED_CATALOG, win, doc));
	const sigHits = scorer.snapshot();

	const domHits = evaluateDomRules(COMPILED_CATALOG, doc);

	const map = new Map<string, TechHit>(sigHits.map((h) => [h.name, h]));
	for (const dh of domHits) {
		const existing = map.get(dh.name);
		if (!existing) {
			map.set(dh.name, dh);
			continue;
		}
		existing.confidence = Math.min(100, existing.confidence + dh.confidence);
		if (!existing.version && dh.version) existing.version = dh.version;
		for (const ev of dh.evidence) {
			if (existing.evidence.length >= EVIDENCE_CAP) break;
			existing.evidence.push(ev);
		}
	}

	// Re-aplica implications: DOM matches podem ter adicionado techs novos.
	const byName = new Map<string, CompiledTech>(COMPILED_CATALOG.map((t) => [t.name, t]));
	applyImplications(map, byName);
	return [...map.values()];
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/probe/detectors/__tests__/wappalyzer.test.ts`
Expected: PASS — 6 tests.

If tests fail:
- "WordPress detected" — inspect `app/src/lib/insights/catalog/w.json` for the WordPress patterns; the DOM/HTML markup in fixture must trigger at least one (`scriptSrc` matching `/wp-(?:content|includes)/`, or `meta.generator`, or any `dom` selector with a `link[href*='/wp-content/']`).
- "Next.js detected" — confirm `n.json` has `js.__NEXT_DATA__` with empty pattern (any value matches).
- If Shopify isn't detected: the catalog has scriptSrc patterns `cdn\.shopify\.com` and `sdks\.shopifycdn\.com`. The fixture URL must match.

Don't relax expectations to make tests pass — fix the fixture markup or escalate.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/probe/detectors/wappalyzer.ts app/src/probe/detectors/__tests__/wappalyzer.test.ts
git commit -m "$(cat <<'EOF'
feat(probe): detectTechs orquestrador wappalyzer

sub-projeto 2, task 4: orquestra collectMainWorldSignals + evaluateDomRules,
mergeia hits, re-aplica implications. testes de integração jsdom para
wordpress/shopify/next.js/jquery.

bd: chrome-extension-debug-buddy-pkp

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Protocol + types extensions

**Files:**
- Modify: `app/src/probe/protocol.ts`
- Modify: `app/src/lib/session/types.ts`
- Modify: `app/src/types/messages.ts`

- [ ] **Step 1: Read current protocol.ts**

Run: `cat app/src/probe/protocol.ts | head -40`

Identify the `ProbeMessage` interface and its `payload` field.

- [ ] **Step 2: Add techs field to ProbeMessage**

Edit `app/src/probe/protocol.ts`:

Add this import near the other imports:

```ts
import type { TechHit } from '@/lib/insights/types';
```

Inside `ProbeMessage.payload`, add:

```ts
techs?: TechHit[];
```

The full payload type should match this shape (preserve all existing fields):

```ts
payload?: {
	url?: string;
	timestamp?: number;
	triggerType?: PageDetectionTrigger;
	fingerprint?: EnvironmentFingerprint;
	techs?: TechHit[]; // NOVO — sub-projeto 2
};
```

- [ ] **Step 3: Add techs field to PageDetection**

Edit `app/src/lib/session/types.ts`:

Find the `PageDetection` interface (around line 40-46). Add the `techs?: TechHit[]` field. Add the import for `TechHit` at the top of the file:

```ts
import type { TechHit } from '@/lib/insights/types';
```

Updated interface:

```ts
export interface PageDetection {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	techs?: TechHit[]; // NOVO — sub-projeto 2; ausente em sessões antigas
	triggerType: PageDetectionTrigger;
}
```

- [ ] **Step 4: Add techs field to Message.payload**

Edit `app/src/types/messages.ts`:

Find the `payload?` field definition inside the `Message` interface (search for `payload?:`). Add `techs?: TechHit[];` to the payload's nested type. Add import:

```ts
import type { TechHit } from '@/lib/insights/types';
```

Update the payload to:

```ts
payload?: {
	url: string;
	timestamp: number;
	triggerType: PageDetectionTrigger;
	fingerprint: EnvironmentFingerprint;
	techs?: TechHit[]; // NOVO — sub-projeto 2
};
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: no errors. If there are errors about unused imports, ignore them (the imports are used in the field types).

- [ ] **Step 6: Run all tests to confirm no regression**

Run: `cd app && npm test`
Expected: all tests pass (no behavior changed yet).

- [ ] **Step 7: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/probe/protocol.ts app/src/lib/session/types.ts app/src/types/messages.ts
git commit -m "$(cat <<'EOF'
feat(probe): adiciona techs[] opcional aos payloads probe e bridge

sub-projeto 2, task 5: ProbeMessage.payload.techs, PageDetection.techs e
Message.payload.techs (todos opcionais para compat). campo será populado
pelo probe na task 6.

bd: chrome-extension-debug-buddy-pkp

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: probe/main.ts integration

**Files:**
- Modify: `app/src/probe/main.ts`

- [ ] **Step 1: Read current probe/main.ts**

Run: `cat app/src/probe/main.ts`

Identify `emitDetection` and the imports section.

- [ ] **Step 2: Add detectTechs import**

Edit the imports section of `app/src/probe/main.ts`. Add this import next to the other detector imports:

```ts
import { detectTechs } from './detectors/wappalyzer';
```

- [ ] **Step 3: Modify emitDetection to include techs**

Replace the `emitDetection` function body — preserving the original structure but adding `techs` to the payload:

```ts
function emitDetection(triggerType: PageDetectionTrigger): void {
	if (!active) return;
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:detection',
		payload: {
			url: location.href,
			timestamp: Date.now(),
			triggerType,
			fingerprint: buildFingerprint(),
			techs: detectTechs(window, document),
		},
	};
	window.postMessage(msg, location.origin);
}
```

- [ ] **Step 4: Run all tests**

Run: `cd app && npm test`
Expected: all tests pass. The probe-related tests should continue passing because we haven't changed `buildFingerprint` or any existing legacy behavior — just added a new field to the payload.

- [ ] **Step 5: Run lint + tsc + build**

Run: `cd app && npm run lint && npx tsc --noEmit && npm run build`
Expected: all clean. Note the size of `dist/probe-main.js` — should be ≤ ~35KB (was ~4.3KB; catalog adds ~30KB).

If `probe-main.js` exceeds 50KB, escalate — we may need to lazy-load the catalog.

- [ ] **Step 6: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/probe/main.ts
git commit -m "$(cat <<'EOF'
feat(probe): emitDetection chama detectTechs e inclui techs no payload

sub-projeto 2, task 6: probe MAIN agora roda o detector wappalyzer ao
lado dos 4 detectors legados; payload de probe:detection carrega techs
e fingerprint simultaneamente.

bd: chrome-extension-debug-buddy-pkp

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification + close bd + push

- [ ] **Step 1: Run full test suite**

Run: `cd app && npm test`
Expected: all tests pass. Insights+probe tests count: ~30 new tests added by this sub-project.

- [ ] **Step 2: Run lint**

Run: `cd app && npm run lint`
Expected: zero errors. Apply `npm run lint:fix` if needed and re-run.

- [ ] **Step 3: Run tsc + build**

Run: `cd app && npx tsc --noEmit && npm run build`
Expected: both clean. Note `dist/probe-main.js` size: should be ≤35KB.

- [ ] **Step 4: Verify legacy detectors are intact**

Run:
```bash
ls /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/probe/detectors/
```
Expected output includes: `dataFetching.ts framework.ts httpClients.ts libraries.ts wappalyzer.ts wappalyzer/`. The four legacy files are present and unchanged.

Verify `buildFingerprint` still works:
```bash
grep -n "buildFingerprint" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/probe/main.ts
```
Expected: function definition + call inside emitDetection.

- [ ] **Step 5: Close bd issue + push**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
bd close chrome-extension-debug-buddy-pkp --reason="Sub-projeto 2 completo: probe MAIN reescrito (detector wappalyzer) emite techs[] ao lado de fingerprint. Detectors legados intactos. Background ainda ignora techs[] — Sub-projeto 3 cobre."
git pull --rebase 2>&1 | tail -5
bd dolt push 2>&1 | tail -3
git push 2>&1 | tail -5
git status
```

Expected: `git status` shows "up to date with origin".

If `git pull --rebase` fails due to unrelated unstaged work in `app/src/lib/session/types.ts`, that's OK — push directly without pulling (the working tree state was the same when we started). Verify push succeeds.

---

## Self-Review Notes

**Spec coverage:** Tasks 1-7 cover all spec criteria:
- Task 1 → `jsPath.ts` (readDottedPath, serializeJsValue, JS_PATH_MAX_DEPTH)
- Task 2 → `signals.ts` (collectMainWorldSignals, all caps, all signal kinds)
- Task 3 → `domEval.ts` (evaluateDomRules + matchDomRuleAgainstElement)
- Task 4 → `wappalyzer.ts` (detectTechs orchestrator + integration tests)
- Task 5 → protocol/types extensions
- Task 6 → probe/main.ts emitDetection integration
- Task 7 → verification + dormancy check (legacy intact) + close bd

**Type consistency:** `Signal`, `TechHit`, `CompiledTech`, `MatchEvidence`, `CompiledPattern`, `CompiledDomRule`, `ImpliedRef` all imported from `@/lib/insights/types` (Sub-projeto 1) — consistent. `parsePattern`, `expandVersion`, `applyImplications`, `Scorer`, `COMPILED_CATALOG` imported from their respective lib modules — consistent. `detectTechs(win, doc)` signature consistent across Tasks 4 and 6.

**No placeholders:** Every step has actual code or exact commands. Troubleshooting hints exist in Tasks 4 and 6 but they are concrete (specific files to inspect, specific behaviors to verify) — not "add appropriate handling".

**Critical assumption:** Task 4 fixture markup must trigger upstream catalog patterns. Spot-checked against `w.json` (WordPress: meta.generator, scriptSrc /wp-(content|includes)/), `s.json` (Shopify: cdn.shopify.com), `n.json` (Next.js: js.__NEXT_DATA__ empty pattern). All should match the fixture markup as written. If any fails, the troubleshooting notes in Task 4 cover the debug path.
