# Live Insights — Tech Catalog & Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Wappalyzer-compatible technology detection lib (`app/src/lib/insights/`) backed by a curated ~200-tech subset of `webappanalyzer-main`. Lib pura, dormante até Sub-projeto 2.

**Architecture:** Pure TS lib in `app/src/lib/insights/` with `types.ts` + `pattern.ts` (parser) + `matcher.ts` (signal × tech) + `implications.ts` (excludes/requires/implies graph) + `scorer.ts` (stateful incremental class) + `catalog/` (subset bundled JSONs gerados por script). Build script `app/scripts/build-tech-catalog.ts` lê whitelist + repo upstream e popula `catalog/`. TDD-first com fixtures de sites reais.

**Tech Stack:** TypeScript strict, Vitest + jsdom, Biome (tabs, single quotes), zod (schema validation no build), tsx (script runner — já em deps). Sem novas runtime deps no bundle.

**Spec:** [docs/superpowers/specs/2026-05-03-live-insights-tech-catalog-engine-design.md](../specs/2026-05-03-live-insights-tech-catalog-engine-design.md)

**bd:** chrome-extension-debug-buddy-e84

---

## File Map

**Created:**
- `app/src/lib/insights/types.ts` — todos os types (Signal, TechHit, CompiledTech, etc.)
- `app/src/lib/insights/pattern.ts` — `parsePattern`, `expandVersion`
- `app/src/lib/insights/matcher.ts` — `matchTechAgainstSignal`
- `app/src/lib/insights/implications.ts` — `applyImplications`
- `app/src/lib/insights/scorer.ts` — `Scorer` class
- `app/src/lib/insights/catalog/index.ts` — `compileAll`, `COMPILED_CATALOG`, `CATEGORIES`
- `app/src/lib/insights/catalog/_.json…z.json` — gerados pelo build script
- `app/src/lib/insights/catalog/categories.json` — gerado
- `app/src/lib/insights/catalog/groups.json` — gerado
- `app/src/lib/insights/__tests__/pattern.test.ts`
- `app/src/lib/insights/__tests__/matcher.test.ts`
- `app/src/lib/insights/__tests__/implications.test.ts`
- `app/src/lib/insights/__tests__/scorer.test.ts`
- `app/src/lib/insights/__tests__/catalog.test.ts`
- `app/src/lib/insights/__tests__/fixtures/wordpress.json`
- `app/src/lib/insights/__tests__/fixtures/shopify.json`
- `app/src/lib/insights/__tests__/fixtures/nextjs.json`
- `app/src/lib/insights/__tests__/fixtures.test.ts`
- `app/scripts/tech-whitelist.json`
- `app/scripts/build-tech-catalog.ts`

**Modified:**
- `app/package.json` — adiciona `catalog:rebuild` script + dep `zod`

---

## Task 1: Types

**Files:**
- Create: `app/src/lib/insights/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// app/src/lib/insights/types.ts

export type Confidence = number; // 0-100. Display: high>=75, mid 50-74, low<50.

export type SignalKind =
	| 'js'
	| 'dom'
	| 'meta'
	| 'header'
	| 'cookie'
	| 'scriptSrc'
	| 'script'
	| 'html'
	| 'text'
	| 'css'
	| 'url'
	| 'xhr'
	| 'implied'; // sentinel — evidence sintética para hits derivados via `implies`

export interface Signal {
	kind: SignalKind;
	name?: string; // preenchido em header/cookie/meta/js/dom-prop
	value: string;
}

export interface MatchEvidence {
	signal: SignalKind;
	pattern: string;
	matchedName?: string;
}

export interface MatchResult {
	confidence: Confidence;
	version?: string;
	evidence: MatchEvidence;
}

export interface TechHit {
	name: string;
	cats: number[];
	confidence: Confidence;
	version?: string;
	icon?: string;
	website?: string;
	description?: string;
	evidence: MatchEvidence[]; // cap em 8
	implied?: boolean;
}

export interface CompiledPattern {
	regex: RegExp;
	confidence: Confidence;
	versionTemplate?: string;
	raw: string;
}

export interface CompiledDomRule {
	selector: string;
	exists?: boolean;
	attributes?: Record<string, CompiledPattern>;
	properties?: Record<string, CompiledPattern>;
	text?: CompiledPattern;
}

export interface ImpliedRef {
	name: string;
	confidence: Confidence;
}

export interface CompiledTech {
	name: string;
	cats: number[];
	icon?: string;
	website: string;
	description?: string;
	patterns: {
		js?: Record<string, CompiledPattern>;
		dom?: CompiledDomRule[];
		meta?: Record<string, CompiledPattern>;
		headers?: Record<string, CompiledPattern>;
		cookies?: Record<string, CompiledPattern>;
		scriptSrc?: CompiledPattern[];
		scripts?: CompiledPattern[];
		html?: CompiledPattern[];
		text?: CompiledPattern[];
		css?: CompiledPattern[];
		url?: CompiledPattern[];
		xhr?: CompiledPattern[];
	};
	implies: ImpliedRef[];
	requires: string[];
	requiresCategory: number[];
	excludes: string[];
}

export interface CategoryMeta {
	name: string;
	priority: number;
	groups?: number[];
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/types.ts
git commit -m "$(cat <<'EOF'
feat(insights): types base do tech catalog engine

Sub-projeto 1, Task 1: types.ts com Signal/TechHit/CompiledTech/etc.
Lib dormante — nenhum import ainda. Spec aprovada em
docs/superpowers/specs/2026-05-03-live-insights-tech-catalog-engine-design.md.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: parsePattern — regex + confidence

**Files:**
- Create: `app/src/lib/insights/__tests__/pattern.test.ts`
- Create: `app/src/lib/insights/pattern.ts`

- [ ] **Step 1: Write failing test for plain regex parse**

Create `app/src/lib/insights/__tests__/pattern.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { parsePattern } from '../pattern';

describe('parsePattern', () => {
	test('parses plain regex without modifiers', () => {
		const p = parsePattern('jquery-([0-9.]+)');
		expect(p.regex.source).toBe('jquery-([0-9.]+)');
		expect(p.regex.flags).toContain('i');
		expect(p.confidence).toBe(100);
		expect(p.versionTemplate).toBeUndefined();
		expect(p.raw).toBe('jquery-([0-9.]+)');
	});

	test('parses confidence modifier and clamps to 0-100', () => {
		expect(parsePattern('foo\\;confidence:50').confidence).toBe(50);
		expect(parsePattern('foo\\;confidence:0').confidence).toBe(0);
		expect(parsePattern('foo\\;confidence:120').confidence).toBe(100);
		expect(parsePattern('foo\\;confidence:-5').confidence).toBe(0);
	});

	test('non-numeric confidence falls back to default 100', () => {
		expect(parsePattern('foo\\;confidence:abc').confidence).toBe(100);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/insights/__tests__/pattern.test.ts`
Expected: FAIL — module `../pattern` not found.

- [ ] **Step 3: Implement parsePattern (regex + confidence)**

Create `app/src/lib/insights/pattern.ts`:

```ts
import type { CompiledPattern } from './types';

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

export function parsePattern(raw: string): CompiledPattern {
	const parts = raw.split('\\;');
	const regexSource = parts[0];
	let confidence = 100;
	let versionTemplate: string | undefined;
	for (let i = 1; i < parts.length; i++) {
		const p = parts[i];
		if (p.startsWith('confidence:')) {
			const n = Number(p.slice('confidence:'.length));
			if (Number.isFinite(n)) confidence = clamp(n, 0, 100);
		} else if (p.startsWith('version:')) {
			versionTemplate = p.slice('version:'.length);
		}
	}
	return {
		regex: new RegExp(regexSource, 'i'),
		confidence,
		versionTemplate,
		raw,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/insights/__tests__/pattern.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/pattern.ts app/src/lib/insights/__tests__/pattern.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): parsePattern com confidence modifier

Sub-projeto 1, Task 2: parser do formato `pat\;confidence:N`.
Clamp em [0,100], default 100, non-numeric volta a default.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: parsePattern — versionTemplate + expandVersion

**Files:**
- Modify: `app/src/lib/insights/__tests__/pattern.test.ts`
- Modify: `app/src/lib/insights/pattern.ts`

- [ ] **Step 1: Add failing tests for version template + expandVersion**

Append to `app/src/lib/insights/__tests__/pattern.test.ts`:

```ts
import { expandVersion } from '../pattern';

describe('parsePattern — version template', () => {
	test('extracts version template', () => {
		const p = parsePattern('jquery-([0-9.]+)\\;version:\\1');
		expect(p.versionTemplate).toBe('\\1');
	});

	test('combines confidence and version', () => {
		const p = parsePattern('foo-([0-9.]+)\\;confidence:50\\;version:\\1');
		expect(p.confidence).toBe(50);
		expect(p.versionTemplate).toBe('\\1');
	});
});

describe('expandVersion', () => {
	test('returns undefined when template is undefined', () => {
		expect(expandVersion(undefined, ['x'] as unknown as RegExpMatchArray)).toBeUndefined();
	});

	test('returns undefined when groups is null', () => {
		expect(expandVersion('\\1', null)).toBeUndefined();
	});

	test('expands single group reference', () => {
		const m = 'jquery-3.6.0'.match(/jquery-([0-9.]+)/);
		expect(expandVersion('\\1', m)).toBe('3.6.0');
	});

	test('expands multiple group references', () => {
		const m = 'v3.6.0-beta'.match(/v(\d+\.\d+)\.(\d+)/);
		expect(expandVersion('\\1.\\2', m)).toBe('3.6.0');
	});

	test('returns undefined when expansion is empty/whitespace', () => {
		const m = 'foo'.match(/foo/);
		expect(expandVersion('\\1', m)).toBeUndefined();
	});

	test('missing group reference resolves to empty', () => {
		const m = 'foo'.match(/foo/);
		expect(expandVersion('static-\\1', m)).toBe('static-');
	});
});
```

- [ ] **Step 2: Run tests to verify version + expandVersion fail**

Run: `cd app && npx vitest run src/lib/insights/__tests__/pattern.test.ts`
Expected: 2 new "parsePattern — version" tests PASS already (parser already preserves version field), 6 new "expandVersion" tests FAIL — `expandVersion` not exported.

- [ ] **Step 3: Implement expandVersion**

Append to `app/src/lib/insights/pattern.ts`:

```ts
export function expandVersion(
	template: string | undefined,
	groups: RegExpMatchArray | null,
): string | undefined {
	if (!template || !groups) return undefined;
	const expanded = template.replace(/\\(\d)/g, (_, d) => groups[Number(d)] ?? '');
	const trimmed = expanded.trim();
	return trimmed === '' ? undefined : trimmed;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/pattern.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/pattern.ts app/src/lib/insights/__tests__/pattern.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): expandVersion com template `\1`/`\2`

Sub-projeto 1, Task 3: captura de versão a partir de regex groups.
Template malformado / sem groups retorna undefined (no fallback).

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: matcher — string + key-value helpers

**Files:**
- Create: `app/src/lib/insights/__tests__/matcher.test.ts`
- Create: `app/src/lib/insights/matcher.ts`

- [ ] **Step 1: Write failing test for matchTechAgainstSignal**

Create `app/src/lib/insights/__tests__/matcher.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { parsePattern } from '../pattern';
import { matchTechAgainstSignal } from '../matcher';
import type { CompiledTech, Signal } from '../types';

function makeTech(overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name: 'TestTech',
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

describe('matchTechAgainstSignal — header', () => {
	test('matches header by name + value', () => {
		const tech = makeTech({
			patterns: {
				headers: { 'X-Powered-By': parsePattern('Express') },
			},
		});
		const sig: Signal = { kind: 'header', name: 'x-powered-by', value: 'Express/4.18.0' };
		const r = matchTechAgainstSignal(tech, sig);
		expect(r).not.toBeNull();
		expect(r?.evidence.signal).toBe('header');
		expect(r?.evidence.matchedName).toBe('x-powered-by');
	});

	test('returns null when header name does not match', () => {
		const tech = makeTech({
			patterns: { headers: { 'X-Powered-By': parsePattern('Express') } },
		});
		const sig: Signal = { kind: 'header', name: 'server', value: 'Express' };
		expect(matchTechAgainstSignal(tech, sig)).toBeNull();
	});

	test('captures version from header value', () => {
		const tech = makeTech({
			patterns: {
				headers: {
					'X-Powered-By': parsePattern('Express/([0-9.]+)\\;version:\\1'),
				},
			},
		});
		const sig: Signal = { kind: 'header', name: 'x-powered-by', value: 'Express/4.18.0' };
		const r = matchTechAgainstSignal(tech, sig);
		expect(r?.version).toBe('4.18.0');
	});
});

describe('matchTechAgainstSignal — string-typed signals', () => {
	test('matches scriptSrc', () => {
		const tech = makeTech({
			patterns: { scriptSrc: [parsePattern('jquery\\.min\\.js')] },
		});
		const sig: Signal = { kind: 'scriptSrc', value: 'https://cdn.example.com/jquery.min.js' };
		expect(matchTechAgainstSignal(tech, sig)?.evidence.signal).toBe('scriptSrc');
	});

	test('matches url', () => {
		const tech = makeTech({
			patterns: { url: [parsePattern('shopify\\.com')] },
		});
		expect(
			matchTechAgainstSignal(tech, { kind: 'url', value: 'https://my-store.shopify.com/' }),
		).not.toBeNull();
	});

	test('returns null when none of multiple patterns match', () => {
		const tech = makeTech({
			patterns: { scriptSrc: [parsePattern('foo'), parsePattern('bar')] },
		});
		expect(
			matchTechAgainstSignal(tech, { kind: 'scriptSrc', value: 'https://baz.js' }),
		).toBeNull();
	});

	test('returns first matching pattern when multiple defined', () => {
		const tech = makeTech({
			patterns: {
				scriptSrc: [
					parsePattern('foo\\;confidence:30'),
					parsePattern('jquery\\;confidence:80'),
				],
			},
		});
		const r = matchTechAgainstSignal(tech, {
			kind: 'scriptSrc',
			value: 'https://cdn.example.com/jquery.min.js',
		});
		expect(r?.confidence).toBe(80);
	});
});

describe('matchTechAgainstSignal — js', () => {
	test('matches dotted-path js signal', () => {
		const tech = makeTech({
			patterns: { js: { 'jQuery.fn.jquery': parsePattern('([0-9.]+)\\;version:\\1') } },
		});
		const sig: Signal = { kind: 'js', name: 'jQuery.fn.jquery', value: '3.6.0' };
		const r = matchTechAgainstSignal(tech, sig);
		expect(r?.version).toBe('3.6.0');
	});
});

describe('matchTechAgainstSignal — cookie', () => {
	test('matches cookie name with empty value pattern', () => {
		const tech = makeTech({
			patterns: { cookies: { wordpress_test_cookie: parsePattern('') } },
		});
		const sig: Signal = { kind: 'cookie', name: 'wordpress_test_cookie', value: 'WP%20Cookie%20check' };
		expect(matchTechAgainstSignal(tech, sig)).not.toBeNull();
	});
});

describe('matchTechAgainstSignal — kind without patterns returns null', () => {
	test('tech with only headers does not match url signal', () => {
		const tech = makeTech({ patterns: { headers: { Server: parsePattern('nginx') } } });
		expect(matchTechAgainstSignal(tech, { kind: 'url', value: 'nginx.com' })).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/insights/__tests__/matcher.test.ts`
Expected: FAIL — module `../matcher` not found.

- [ ] **Step 3: Implement matchTechAgainstSignal**

Create `app/src/lib/insights/matcher.ts`:

```ts
import { expandVersion } from './pattern';
import type {
	CompiledPattern,
	CompiledTech,
	MatchResult,
	Signal,
	SignalKind,
} from './types';

function buildResult(
	signal: SignalKind,
	pattern: CompiledPattern,
	groups: RegExpMatchArray,
	matchedName?: string,
): MatchResult {
	return {
		confidence: pattern.confidence,
		version: expandVersion(pattern.versionTemplate, groups),
		evidence: { signal, pattern: pattern.raw, matchedName },
	};
}

function matchString(
	value: string,
	patterns: CompiledPattern[] | undefined,
): { pattern: CompiledPattern; groups: RegExpMatchArray } | null {
	if (!patterns) return null;
	for (const p of patterns) {
		const m = value.match(p.regex);
		if (m) return { pattern: p, groups: m };
	}
	return null;
}

function matchKeyValue(
	signalName: string | undefined,
	signalValue: string,
	patternsByKey: Record<string, CompiledPattern> | undefined,
): { pattern: CompiledPattern; groups: RegExpMatchArray; key: string } | null {
	if (!patternsByKey || signalName === undefined) return null;
	for (const [key, p] of Object.entries(patternsByKey)) {
		// Schema upstream usa o nome como regex case-insensitive.
		const keyRegex = new RegExp(`^${key}$`, 'i');
		if (!keyRegex.test(signalName)) continue;
		// Pattern com source vazio = "qualquer valor". Match force-true.
		const m = p.regex.source === '(?:)' ? ['' as string] : signalValue.match(p.regex);
		if (m) return { pattern: p, groups: m as RegExpMatchArray, key };
	}
	return null;
}

export function matchTechAgainstSignal(
	tech: CompiledTech,
	signal: Signal,
): MatchResult | null {
	const pat = tech.patterns;
	switch (signal.kind) {
		case 'header': {
			const r = matchKeyValue(signal.name, signal.value, pat.headers);
			return r ? buildResult('header', r.pattern, r.groups, r.key) : null;
		}
		case 'cookie': {
			const r = matchKeyValue(signal.name, signal.value, pat.cookies);
			return r ? buildResult('cookie', r.pattern, r.groups, r.key) : null;
		}
		case 'meta': {
			const r = matchKeyValue(signal.name, signal.value, pat.meta);
			return r ? buildResult('meta', r.pattern, r.groups, r.key) : null;
		}
		case 'js': {
			const r = matchKeyValue(signal.name, signal.value, pat.js);
			return r ? buildResult('js', r.pattern, r.groups, r.key) : null;
		}
		case 'scriptSrc': {
			const r = matchString(signal.value, pat.scriptSrc);
			return r ? buildResult('scriptSrc', r.pattern, r.groups) : null;
		}
		case 'script': {
			const r = matchString(signal.value, pat.scripts);
			return r ? buildResult('script', r.pattern, r.groups) : null;
		}
		case 'html': {
			const r = matchString(signal.value, pat.html);
			return r ? buildResult('html', r.pattern, r.groups) : null;
		}
		case 'text': {
			const r = matchString(signal.value, pat.text);
			return r ? buildResult('text', r.pattern, r.groups) : null;
		}
		case 'css': {
			const r = matchString(signal.value, pat.css);
			return r ? buildResult('css', r.pattern, r.groups) : null;
		}
		case 'url': {
			const r = matchString(signal.value, pat.url);
			return r ? buildResult('url', r.pattern, r.groups) : null;
		}
		case 'xhr': {
			const r = matchString(signal.value, pat.xhr);
			return r ? buildResult('xhr', r.pattern, r.groups) : null;
		}
		case 'dom':
			// dom é tratado pelo detector do probe (Sub-projeto 2). Matcher genérico
			// não recebe Signal{kind:'dom'} desta fase em diante.
			return null;
		case 'implied':
			// 'implied' é evidence sintética emitida por applyImplications,
			// não um signal de match real.
			return null;
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/matcher.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/matcher.ts app/src/lib/insights/__tests__/matcher.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): matchTechAgainstSignal — dispatch por SignalKind

Sub-projeto 1, Task 4: matcher puro para signals de string e key-value.
Trata header/cookie/meta/js como key-value (chave também é regex);
scriptSrc/script/html/text/css/url/xhr como string-only. dom/implied
retornam null (tratados em outro lugar).

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: implications — excludes

**Files:**
- Create: `app/src/lib/insights/__tests__/implications.test.ts`
- Create: `app/src/lib/insights/implications.ts`

- [ ] **Step 1: Write failing test for excludes**

Create `app/src/lib/insights/__tests__/implications.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { applyImplications } from '../implications';
import type { CompiledTech, TechHit } from '../types';

function tech(name: string, overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name,
		cats: [],
		website: 'https://example.com',
		patterns: {},
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
		...overrides,
	};
}

function hit(name: string, overrides: Partial<TechHit> = {}): TechHit {
	return {
		name,
		cats: [],
		confidence: 100,
		evidence: [],
		...overrides,
	};
}

describe('applyImplications — excludes', () => {
	test('removes excluded techs from hits', () => {
		const wp = tech('WordPress', { excludes: ['Drupal'] });
		const drupal = tech('Drupal');
		const hits = new Map<string, TechHit>([
			['WordPress', hit('WordPress')],
			['Drupal', hit('Drupal')],
		]);
		const catalog = new Map<string, CompiledTech>([
			['WordPress', wp],
			['Drupal', drupal],
		]);

		applyImplications(hits, catalog);

		expect(hits.has('WordPress')).toBe(true);
		expect(hits.has('Drupal')).toBe(false);
	});

	test('exclude target not in hits is a no-op', () => {
		const wp = tech('WordPress', { excludes: ['Drupal'] });
		const hits = new Map<string, TechHit>([['WordPress', hit('WordPress')]]);
		const catalog = new Map<string, CompiledTech>([['WordPress', wp]]);

		applyImplications(hits, catalog);

		expect(hits.has('WordPress')).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/insights/__tests__/implications.test.ts`
Expected: FAIL — module `../implications` not found.

- [ ] **Step 3: Implement applyImplications with excludes only**

Create `app/src/lib/insights/implications.ts`:

```ts
import type { CompiledTech, TechHit } from './types';

const MAX_IMPLIES_DEPTH = 8;

export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES — techs detectadas removem rivais antes de qualquer derivação.
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/implications.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/implications.ts app/src/lib/insights/__tests__/implications.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): applyImplications — excludes

Sub-projeto 1, Task 5: techs detectadas removem rivais via excludes[].

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: implications — requires + requiresCategory

**Files:**
- Modify: `app/src/lib/insights/__tests__/implications.test.ts`
- Modify: `app/src/lib/insights/implications.ts`

- [ ] **Step 1: Add failing tests for requires**

Append to `app/src/lib/insights/__tests__/implications.test.ts`:

```ts
describe('applyImplications — requires', () => {
	test('drops tech whose requires is not satisfied', () => {
		const plugin = tech('WP-Plugin', { requires: ['WordPress'] });
		const hits = new Map<string, TechHit>([['WP-Plugin', hit('WP-Plugin')]]);
		const catalog = new Map<string, CompiledTech>([['WP-Plugin', plugin]]);

		applyImplications(hits, catalog);

		expect(hits.has('WP-Plugin')).toBe(false);
	});

	test('keeps tech when requires is satisfied', () => {
		const wp = tech('WordPress');
		const plugin = tech('WP-Plugin', { requires: ['WordPress'] });
		const hits = new Map<string, TechHit>([
			['WordPress', hit('WordPress')],
			['WP-Plugin', hit('WP-Plugin')],
		]);
		const catalog = new Map<string, CompiledTech>([
			['WordPress', wp],
			['WP-Plugin', plugin],
		]);

		applyImplications(hits, catalog);

		expect(hits.has('WordPress')).toBe(true);
		expect(hits.has('WP-Plugin')).toBe(true);
	});

	test('drops tech whose requiresCategory is not satisfied', () => {
		const t = tech('T', { requiresCategory: [12] });
		const hits = new Map<string, TechHit>([['T', hit('T')]]);
		const catalog = new Map<string, CompiledTech>([['T', t]]);

		applyImplications(hits, catalog);

		expect(hits.has('T')).toBe(false);
	});

	test('keeps tech when requiresCategory is satisfied by another hit', () => {
		const carrier = tech('Carrier', { cats: [12] });
		const t = tech('T', { requiresCategory: [12] });
		const hits = new Map<string, TechHit>([
			['Carrier', hit('Carrier', { cats: [12] })],
			['T', hit('T')],
		]);
		const catalog = new Map<string, CompiledTech>([
			['Carrier', carrier],
			['T', t],
		]);

		applyImplications(hits, catalog);

		expect(hits.has('T')).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/insights/__tests__/implications.test.ts`
Expected: 4 new tests FAIL (current impl ignores requires).

- [ ] **Step 3: Add requires logic to applyImplications**

Replace `applyImplications` body in `app/src/lib/insights/implications.ts`:

```ts
import type { CompiledTech, TechHit } from './types';

const MAX_IMPLIES_DEPTH = 8;

export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES — techs detectadas removem rivais.
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}

	// 2. REQUIRES — limpa órfãs (tech cujo dep não foi encontrado).
	const namesNow = new Set(hits.keys());
	const catsNow = new Set<number>();
	for (const h of hits.values()) for (const c of h.cats) catsNow.add(c);
	for (const hit of [...hits.values()]) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		const reqOk = tech.requires.every((r) => namesNow.has(r));
		const reqCatOk = tech.requiresCategory.every((c) => catsNow.has(c));
		if (!reqOk || !reqCatOk) hits.delete(hit.name);
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/implications.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/implications.ts app/src/lib/insights/__tests__/implications.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): applyImplications — requires/requiresCategory

Sub-projeto 1, Task 6: drop de techs órfãs cujo requires/requiresCategory
não foi satisfeito.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: implications — implies + cycle protection

**Files:**
- Modify: `app/src/lib/insights/__tests__/implications.test.ts`
- Modify: `app/src/lib/insights/implications.ts`

- [ ] **Step 1: Add failing tests for implies**

Append to `app/src/lib/insights/__tests__/implications.test.ts`:

```ts
describe('applyImplications — implies', () => {
	test('adds implied tech with implied=true and given confidence', () => {
		const wp = tech('WordPress', { implies: [{ name: 'PHP', confidence: 100 }] });
		const php = tech('PHP', { cats: [27] });
		const hits = new Map<string, TechHit>([['WordPress', hit('WordPress')]]);
		const catalog = new Map<string, CompiledTech>([
			['WordPress', wp],
			['PHP', php],
		]);

		applyImplications(hits, catalog);

		const phpHit = hits.get('PHP');
		expect(phpHit).toBeDefined();
		expect(phpHit?.implied).toBe(true);
		expect(phpHit?.confidence).toBe(100);
		expect(phpHit?.evidence[0].signal).toBe('implied');
		expect(phpHit?.evidence[0].pattern).toBe('implied by WordPress');
		expect(phpHit?.cats).toEqual([27]);
	});

	test('cascade — A → B → C', () => {
		const a = tech('A', { implies: [{ name: 'B', confidence: 100 }] });
		const b = tech('B', { implies: [{ name: 'C', confidence: 100 }] });
		const c = tech('C');
		const hits = new Map<string, TechHit>([['A', hit('A')]]);
		const catalog = new Map<string, CompiledTech>([
			['A', a],
			['B', b],
			['C', c],
		]);

		applyImplications(hits, catalog);

		expect(hits.has('B')).toBe(true);
		expect(hits.has('C')).toBe(true);
	});

	test('cycle protection — A → B → A does not loop', () => {
		const a = tech('A', { implies: [{ name: 'B', confidence: 100 }] });
		const b = tech('B', { implies: [{ name: 'A', confidence: 100 }] });
		const hits = new Map<string, TechHit>([['A', hit('A')]]);
		const catalog = new Map<string, CompiledTech>([
			['A', a],
			['B', b],
		]);

		applyImplications(hits, catalog);

		expect(hits.has('A')).toBe(true);
		expect(hits.has('B')).toBe(true);
		expect(hits.size).toBe(2);
	});

	test('does not overwrite existing detected hit with implied version', () => {
		const wp = tech('WordPress', { implies: [{ name: 'PHP', confidence: 50 }] });
		const php = tech('PHP');
		const hits = new Map<string, TechHit>([
			['WordPress', hit('WordPress')],
			['PHP', hit('PHP', { confidence: 80 })], // já detectado diretamente
		]);
		const catalog = new Map<string, CompiledTech>([
			['WordPress', wp],
			['PHP', php],
		]);

		applyImplications(hits, catalog);

		const phpHit = hits.get('PHP');
		expect(phpHit?.confidence).toBe(80);
		expect(phpHit?.implied).toBeUndefined();
	});

	test('implied tech missing from catalog is silently skipped', () => {
		const wp = tech('WordPress', { implies: [{ name: 'Unknown', confidence: 100 }] });
		const hits = new Map<string, TechHit>([['WordPress', hit('WordPress')]]);
		const catalog = new Map<string, CompiledTech>([['WordPress', wp]]);

		applyImplications(hits, catalog);

		expect(hits.has('Unknown')).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/insights/__tests__/implications.test.ts`
Expected: 5 new tests FAIL.

- [ ] **Step 3: Add implies logic with cycle guard**

Replace `applyImplications` in `app/src/lib/insights/implications.ts`:

```ts
import type { CompiledTech, TechHit } from './types';

const MAX_IMPLIES_DEPTH = 8;

export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}

	// 2. REQUIRES
	const namesNow = new Set(hits.keys());
	const catsNow = new Set<number>();
	for (const h of hits.values()) for (const c of h.cats) catsNow.add(c);
	for (const hit of [...hits.values()]) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		const reqOk = tech.requires.every((r) => namesNow.has(r));
		const reqCatOk = tech.requiresCategory.every((c) => catsNow.has(c));
		if (!reqOk || !reqCatOk) hits.delete(hit.name);
	}

	// 3. IMPLIES — loop com depth guard contra ciclos.
	let changed = true;
	let guard = MAX_IMPLIES_DEPTH;
	while (changed && guard-- > 0) {
		changed = false;
		for (const hit of [...hits.values()]) {
			const tech = catalog.get(hit.name);
			if (!tech) continue;
			for (const imp of tech.implies) {
				if (hits.has(imp.name)) continue;
				const implied = catalog.get(imp.name);
				if (!implied) continue;
				hits.set(imp.name, {
					name: implied.name,
					cats: implied.cats,
					confidence: imp.confidence,
					icon: implied.icon,
					website: implied.website,
					description: implied.description,
					evidence: [{ signal: 'implied', pattern: `implied by ${hit.name}` }],
					implied: true,
				});
				changed = true;
			}
		}
	}
	if (changed && guard <= 0) {
		// Ciclo / cadeia mais profunda do que MAX_IMPLIES_DEPTH. Para sem alterar
		// estado adicional. UI reflete o que já foi inferido até aqui.
		console.warn(
			`[insights] applyImplications atingiu depth máximo (${MAX_IMPLIES_DEPTH}); possível ciclo no catálogo`,
		);
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/implications.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/implications.ts app/src/lib/insights/__tests__/implications.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): applyImplications — implies em cascata com cycle guard

Sub-projeto 1, Task 7: implies adiciona techs derivadas; cascade A→B→C;
depth guard 8 contra ciclos; não sobrescreve hits já detectados.
Evidence usa signal:'implied'.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Scorer — basics (upsert/snapshot/reset)

**Files:**
- Create: `app/src/lib/insights/__tests__/scorer.test.ts`
- Create: `app/src/lib/insights/scorer.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/lib/insights/__tests__/scorer.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { parsePattern } from '../pattern';
import { Scorer } from '../scorer';
import type { CompiledTech, Signal } from '../types';

function makeTech(overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name: 'TestTech',
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

describe('Scorer — basics', () => {
	test('snapshot is empty before any push', () => {
		const s = new Scorer([]);
		expect(s.snapshot()).toEqual([]);
	});

	test('matches a single signal and stores hit', () => {
		const tech = makeTech({
			name: 'jQuery',
			patterns: { scriptSrc: [parsePattern('jquery\\.min\\.js')] },
		});
		const s = new Scorer([tech]);
		s.pushSignals([{ kind: 'scriptSrc', value: 'cdn/jquery.min.js' }]);
		const snap = s.snapshot();
		expect(snap).toHaveLength(1);
		expect(snap[0].name).toBe('jQuery');
		expect(snap[0].confidence).toBe(100);
	});

	test('reset clears all hits', () => {
		const tech = makeTech({
			name: 'jQuery',
			patterns: { scriptSrc: [parsePattern('jquery')] },
		});
		const s = new Scorer([tech]);
		s.pushSignals([{ kind: 'scriptSrc', value: 'jquery.js' }]);
		expect(s.snapshot()).toHaveLength(1);
		s.reset();
		expect(s.snapshot()).toEqual([]);
	});

	test('non-matching signal yields no hit', () => {
		const tech = makeTech({
			patterns: { scriptSrc: [parsePattern('foo')] },
		});
		const s = new Scorer([tech]);
		s.pushSignals([{ kind: 'scriptSrc', value: 'bar.js' }]);
		expect(s.snapshot()).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/insights/__tests__/scorer.test.ts`
Expected: FAIL — module `../scorer` not found.

- [ ] **Step 3: Implement Scorer**

Create `app/src/lib/insights/scorer.ts`:

```ts
import { applyImplications } from './implications';
import { matchTechAgainstSignal } from './matcher';
import type { CompiledTech, MatchResult, Signal, TechHit } from './types';

const EVIDENCE_CAP = 8;

export class Scorer {
	private hits = new Map<string, TechHit>();
	private compiledByName: Map<string, CompiledTech>;

	constructor(private readonly catalog: CompiledTech[]) {
		this.compiledByName = new Map(catalog.map((t) => [t.name, t]));
	}

	pushSignals(batch: Signal[]): void {
		for (const signal of batch) {
			for (const tech of this.catalog) {
				const m = matchTechAgainstSignal(tech, signal);
				if (!m) continue;
				this.upsertHit(tech, m);
			}
		}
		applyImplications(this.hits, this.compiledByName);
	}

	snapshot(): TechHit[] {
		return [...this.hits.values()];
	}

	reset(): void {
		this.hits.clear();
	}

	private upsertHit(tech: CompiledTech, m: MatchResult): void {
		const existing = this.hits.get(tech.name);
		if (!existing) {
			this.hits.set(tech.name, {
				name: tech.name,
				cats: tech.cats,
				confidence: m.confidence,
				version: m.version,
				icon: tech.icon,
				website: tech.website,
				description: tech.description,
				evidence: [m.evidence],
			});
			return;
		}
		existing.confidence = Math.min(100, existing.confidence + m.confidence);
		if (!existing.version && m.version) existing.version = m.version;
		if (existing.evidence.length < EVIDENCE_CAP) existing.evidence.push(m.evidence);
	}
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/scorer.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/scorer.ts app/src/lib/insights/__tests__/scorer.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): Scorer stateful (upsert/snapshot/reset)

Sub-projeto 1, Task 8: classe stateful para acumular TechHit ao longo
de batches de Signal. Integra matcher + applyImplications.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Scorer — confidence accumulation, version first-wins, evidence cap, idempotency

**Files:**
- Modify: `app/src/lib/insights/__tests__/scorer.test.ts`

- [ ] **Step 1: Add tests for accumulation behavior**

Append to `app/src/lib/insights/__tests__/scorer.test.ts`:

```ts
describe('Scorer — accumulation', () => {
	test('confidence accumulates across distinct signals capped at 100', () => {
		const tech = makeTech({
			name: 'X',
			patterns: {
				scriptSrc: [parsePattern('one\\;confidence:60')],
				headers: { 'X-A': parsePattern('y\\;confidence:60') },
			},
		});
		const s = new Scorer([tech]);
		s.pushSignals([
			{ kind: 'scriptSrc', value: 'one.js' },
			{ kind: 'header', name: 'x-a', value: 'y' },
		]);
		const snap = s.snapshot();
		expect(snap[0].confidence).toBe(100); // 60+60=120 capa em 100
	});

	test('version is first-wins (does not overwrite)', () => {
		const tech = makeTech({
			name: 'X',
			patterns: {
				scriptSrc: [parsePattern('x-([0-9.]+)\\.js\\;version:\\1')],
				headers: { 'X-Ver': parsePattern('([0-9.]+)\\;version:\\1') },
			},
		});
		const s = new Scorer([tech]);
		s.pushSignals([
			{ kind: 'scriptSrc', value: 'x-1.0.0.js' },
			{ kind: 'header', name: 'x-ver', value: '2.0.0' },
		]);
		expect(s.snapshot()[0].version).toBe('1.0.0');
	});

	test('evidence is capped at 8 entries', () => {
		const tech = makeTech({
			name: 'X',
			patterns: { scriptSrc: [parsePattern('x')] },
		});
		const s = new Scorer([tech]);
		const batch: Signal[] = Array.from({ length: 12 }, (_, i) => ({
			kind: 'scriptSrc',
			value: `x-${i}.js`,
		}));
		s.pushSignals(batch);
		expect(s.snapshot()[0].evidence.length).toBe(8);
	});

	test('pushing same batch twice is idempotent in evidence count', () => {
		const tech = makeTech({
			name: 'X',
			patterns: { scriptSrc: [parsePattern('x')] },
		});
		const s = new Scorer([tech]);
		const batch: Signal[] = [
			{ kind: 'scriptSrc', value: 'x.js' },
			{ kind: 'scriptSrc', value: 'x.js' },
		];
		s.pushSignals(batch);
		s.pushSignals(batch);
		// 2 pushes × 2 signals = 4 acumulados, mas confidence cap em 100
		// e evidence pode ir até 8 (4 < 8, então 4)
		expect(s.snapshot()[0].evidence.length).toBe(4);
	});
});

describe('Scorer — implications integration', () => {
	test('pushing a tech triggers its implies', () => {
		const wp = makeTech({
			name: 'WordPress',
			patterns: { scriptSrc: [parsePattern('wp-content')] },
			implies: [{ name: 'PHP', confidence: 100 }],
		});
		const php = makeTech({ name: 'PHP', cats: [27] });
		const s = new Scorer([wp, php]);
		s.pushSignals([{ kind: 'scriptSrc', value: '/wp-content/themes/x.js' }]);
		const names = s.snapshot().map((h) => h.name).sort();
		expect(names).toEqual(['PHP', 'WordPress']);
		const phpHit = s.snapshot().find((h) => h.name === 'PHP');
		expect(phpHit?.implied).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/scorer.test.ts`
Expected: PASS — 9 tests total. (Implementation já cobre estes casos; este passo só verifica.)

- [ ] **Step 3: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/__tests__/scorer.test.ts
git commit -m "$(cat <<'EOF'
test(insights): Scorer — accumulation + idempotency + implications

Sub-projeto 1, Task 9: cobre confidence cap em 100, version first-wins,
evidence cap em 8, idempotência de batch repetido, e integração com
applyImplications.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: tech-whitelist + zod schema validator

**Files:**
- Create: `app/scripts/tech-whitelist.json`
- Modify: `app/package.json` — adiciona `zod`

- [ ] **Step 1: Create whitelist file**

Create `app/scripts/tech-whitelist.json`:

```json
[
	"React",
	"Vue.js",
	"Angular",
	"Svelte",
	"SolidJS",
	"Preact",
	"Ember.js",
	"Nuxt.js",
	"Next.js",
	"Remix",
	"Astro",
	"Qwik",
	"jQuery",
	"Lodash",
	"Moment.js",
	"Day.js",
	"date-fns",
	"axios",
	"Apollo",
	"TanStack Query",
	"Redux",
	"Zustand",
	"MobX",
	"Immer",
	"WordPress",
	"Drupal",
	"Joomla",
	"Shopify",
	"Wix",
	"Ghost",
	"Google Analytics",
	"Plausible",
	"Fathom",
	"Mixpanel",
	"Segment",
	"Heap",
	"Hotjar",
	"FullStory",
	"Amplitude",
	"Matomo",
	"Google Tag Manager",
	"Adobe Launch",
	"Tealium",
	"mParticle",
	"Nginx",
	"Apache HTTP Server",
	"Caddy",
	"Microsoft IIS",
	"Express",
	"Vercel",
	"Cloudflare",
	"Fastly",
	"Amazon CloudFront",
	"Akamai",
	"Netlify",
	"KeyCDN",
	"BunnyCDN",
	"Heroku",
	"GitHub Pages",
	"Railway",
	"Render",
	"Fly.io",
	"WooCommerce",
	"Magento",
	"BigCommerce",
	"Salesforce Commerce Cloud",
	"PrestaShop",
	"OneTrust",
	"Cookiebot",
	"TrustArc",
	"Iubenda",
	"Didomi",
	"Optimizely",
	"VWO",
	"AB Tasty",
	"Adobe Target",
	"Google Optimize",
	"Stripe",
	"Braintree",
	"PayPal",
	"Mercado Pago",
	"PagSeguro",
	"PHP",
	"Ruby",
	"Python",
	"Java",
	"Ruby on Rails",
	"Django",
	"Laravel",
	"FastAPI",
	"Spring",
	"Phoenix Framework",
	"Bootstrap",
	"Tailwind CSS",
	"Material UI",
	"Ant Design",
	"Chakra UI",
	"Radix UI",
	"shadcn/ui",
	"Bulma",
	"webpack",
	"Vite",
	"Parcel",
	"Rollup",
	"esbuild",
	"Auth0",
	"Clerk",
	"Firebase",
	"Supabase",
	"Amazon Cognito",
	"Intercom",
	"Zendesk",
	"Drift",
	"HubSpot",
	"Crisp",
	"Sentry",
	"Bugsnag",
	"Rollbar",
	"LogRocket",
	"Datadog",
	"Marketo",
	"Pardot",
	"ActiveCampaign",
	"RD Station",
	"reCAPTCHA",
	"hCaptcha",
	"Cloudflare Turnstile",
	"FriendlyCaptcha",
	"Hugo",
	"Jekyll",
	"Eleventy",
	"Gatsby",
	"Algolia",
	"Elasticsearch",
	"Mapbox",
	"Google Maps"
]
```

- [ ] **Step 2: Add zod dep**

Run:
```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app
npm install --save-dev zod@3.x
```

Verify `app/package.json` has `"zod": "^3.x.x"` in `devDependencies`.

- [ ] **Step 3: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/scripts/tech-whitelist.json app/package.json app/package-lock.json
git commit -m "$(cat <<'EOF'
chore(insights): tech-whitelist.json + zod dep para build script

Sub-projeto 1, Task 10: lista de ~130 techs do subset curado e zod
para validação do schema Wappalyzer no build do catálogo.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: build-tech-catalog.ts

**Files:**
- Create: `app/scripts/build-tech-catalog.ts`
- Modify: `app/package.json` — adiciona script `catalog:rebuild`

- [ ] **Step 1: Create build script**

Create `app/scripts/build-tech-catalog.ts`:

```ts
#!/usr/bin/env tsx
// Build do catálogo de tecnologias do Live Insights.
// Lê whitelist + repo upstream do webappanalyzer e popula
// app/src/lib/insights/catalog/ com subset curado.

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const REPO_ROOT = path.resolve(__dirname, '..');
const WHITELIST_PATH = path.join(REPO_ROOT, 'scripts/tech-whitelist.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'src/lib/insights/catalog');
const UPSTREAM = process.env.WAPPALYZER_SRC ?? '/Users/guichafy/Workspaces/webappanalyzer-main/src';

const TechSchema = z.object({
	cats: z.array(z.number()).min(1),
	website: z.string().min(1),
	description: z.string().optional(),
	icon: z.string().optional(),
	cookies: z.record(z.string()).optional(),
	dom: z.union([z.array(z.string()), z.string(), z.record(z.unknown())]).optional(),
	js: z.record(z.string()).optional(),
	headers: z.record(z.string()).optional(),
	html: z.array(z.string()).optional(),
	text: z.array(z.string()).optional(),
	css: z.array(z.string()).optional(),
	meta: z.record(z.union([z.string(), z.array(z.string())])).optional(),
	scriptSrc: z.array(z.string()).optional(),
	scripts: z.array(z.string()).optional(),
	url: z.array(z.string()).optional(),
	xhr: z.array(z.string()).optional(),
	implies: z.array(z.string()).optional(),
	requires: z.array(z.string()).optional(),
	requiresCategory: z.array(z.number()).optional(),
	excludes: z.array(z.string()).optional(),
}).passthrough();

type RawTech = z.infer<typeof TechSchema>;

function readJson<T>(p: string): T {
	return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function writeJson(p: string, data: unknown): void {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, `${JSON.stringify(data, null, '\t')}\n`, 'utf8');
}

function bucketLetter(name: string): string {
	const ch = name[0]?.toLowerCase() ?? '_';
	return /[a-z]/.test(ch) ? ch : '_';
}

function loadUpstreamTech(): Map<string, RawTech> {
	const all = new Map<string, RawTech>();
	const files = fs.readdirSync(path.join(UPSTREAM, 'technologies'));
	for (const file of files) {
		if (!file.endsWith('.json')) continue;
		const data = readJson<Record<string, RawTech>>(
			path.join(UPSTREAM, 'technologies', file),
		);
		for (const [name, raw] of Object.entries(data)) {
			all.set(name, raw);
		}
	}
	return all;
}

function main(): void {
	const whitelist = readJson<string[]>(WHITELIST_PATH);
	const upstream = loadUpstreamTech();

	const subset = new Map<string, RawTech>();
	const missing: string[] = [];
	for (const name of whitelist) {
		const raw = upstream.get(name);
		if (!raw) {
			missing.push(name);
			continue;
		}
		// Valida — falha = erro fatal.
		try {
			TechSchema.parse(raw);
		} catch (err) {
			throw new Error(`[catalog] '${name}' falhou validação Zod: ${(err as Error).message}`);
		}
		subset.set(name, raw);
	}

	if (missing.length > 0) {
		console.error(
			`[catalog] aviso: ${missing.length} tech(s) na whitelist não encontrados no upstream:`,
		);
		for (const m of missing) console.error(`  - ${m}`);
	}

	// Avisos para implies/requires/excludes fora da whitelist.
	const inWhitelist = new Set(subset.keys());
	const orphans: Array<{ tech: string; field: string; target: string }> = [];
	for (const [name, raw] of subset) {
		for (const dep of raw.implies ?? []) {
			const targetName = dep.split('\\;')[0];
			if (!inWhitelist.has(targetName)) {
				orphans.push({ tech: name, field: 'implies', target: targetName });
			}
		}
		for (const r of raw.requires ?? []) {
			if (!inWhitelist.has(r)) orphans.push({ tech: name, field: 'requires', target: r });
		}
		for (const e of raw.excludes ?? []) {
			if (!inWhitelist.has(e)) orphans.push({ tech: name, field: 'excludes', target: e });
		}
	}
	if (orphans.length > 0) {
		console.error(
			`[catalog] aviso: ${orphans.length} referência(s) orphã (target fora da whitelist):`,
		);
		for (const o of orphans) {
			console.error(`  - ${o.tech}.${o.field} -> ${o.target}`);
		}
	}

	// Limpa output dir.
	if (fs.existsSync(OUTPUT_DIR)) {
		for (const f of fs.readdirSync(OUTPUT_DIR)) {
			if (f.endsWith('.json')) fs.unlinkSync(path.join(OUTPUT_DIR, f));
		}
	}

	// Buckets por letra inicial (mirroring upstream).
	const buckets = new Map<string, Record<string, RawTech>>();
	for (const [name, raw] of subset) {
		const letter = bucketLetter(name);
		const bucket = buckets.get(letter) ?? {};
		bucket[name] = raw;
		buckets.set(letter, bucket);
	}
	for (const [letter, bucket] of buckets) {
		writeJson(path.join(OUTPUT_DIR, `${letter}.json`), bucket);
	}

	// Filtra categories.json + groups.json.
	const upCats = readJson<Record<string, { name: string; priority: number; groups?: number[] }>>(
		path.join(UPSTREAM, 'categories.json'),
	);
	const upGroups = readJson<Record<string, { name: string }>>(
		path.join(UPSTREAM, 'groups.json'),
	);
	const usedCatIds = new Set<number>();
	for (const raw of subset.values()) for (const c of raw.cats) usedCatIds.add(c);
	const subsetCats: Record<string, { name: string; priority: number; groups?: number[] }> = {};
	const usedGroupIds = new Set<number>();
	for (const id of usedCatIds) {
		const c = upCats[String(id)];
		if (!c) continue;
		subsetCats[String(id)] = c;
		for (const g of c.groups ?? []) usedGroupIds.add(g);
	}
	const subsetGroups: Record<string, { name: string }> = {};
	for (const id of usedGroupIds) {
		const g = upGroups[String(id)];
		if (g) subsetGroups[String(id)] = g;
	}
	writeJson(path.join(OUTPUT_DIR, 'categories.json'), subsetCats);
	writeJson(path.join(OUTPUT_DIR, 'groups.json'), subsetGroups);

	// Sumário.
	const totalSize = fs.readdirSync(OUTPUT_DIR)
		.filter((f) => f.endsWith('.json'))
		.reduce((acc, f) => acc + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);
	console.log(
		`[catalog] sucesso: ${subset.size} techs, ${usedCatIds.size} categorias, ` +
			`${usedGroupIds.size} grupos, ${(totalSize / 1024).toFixed(1)} KB`,
	);
}

main();
```

- [ ] **Step 2: Add npm script**

Edit `app/package.json` — adicionar à seção `scripts` após `"test:coverage"`:

```json
"catalog:rebuild": "tsx scripts/build-tech-catalog.ts",
```

- [ ] **Step 3: Run the build script**

Run:
```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app
npm run catalog:rebuild
```

Expected output:
```
[catalog] sucesso: ~130 techs, ~30 categorias, ~10 grupos, ~XX KB
```

If "tech(s) na whitelist não encontrados no upstream" appears, those names need adjustment in `tech-whitelist.json` (the upstream uses specific casing/naming). Update the whitelist to match upstream names and re-run.

- [ ] **Step 4: Verify generated files**

Run:
```bash
ls /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/src/lib/insights/catalog/
```

Expected: `_.json a.json b.json … z.json categories.json groups.json` (one file per letter that has a tech).

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/scripts/build-tech-catalog.ts app/package.json app/src/lib/insights/catalog/
git commit -m "$(cat <<'EOF'
feat(insights): build-tech-catalog.ts + catálogo gerado

Sub-projeto 1, Task 11: script tsx que importa subset curado do
webappanalyzer-main, valida schema via zod e escreve buckets por letra
em app/src/lib/insights/catalog/. Output checked-in para reproducibilidade.

Run: npm run catalog:rebuild

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: catalog/index.ts — compileAll + load

**Files:**
- Create: `app/src/lib/insights/catalog/index.ts`
- Create: `app/src/lib/insights/__tests__/catalog.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/src/lib/insights/__tests__/catalog.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { COMPILED_CATALOG, CATEGORIES } from '../catalog';

describe('catalog', () => {
	test('loads at least 100 techs', () => {
		expect(COMPILED_CATALOG.length).toBeGreaterThanOrEqual(100);
	});

	test('every tech has a unique name', () => {
		const names = COMPILED_CATALOG.map((t) => t.name);
		expect(new Set(names).size).toBe(names.length);
	});

	test('every tech has a website', () => {
		for (const t of COMPILED_CATALOG) {
			expect(t.website).toMatch(/^https?:\/\//);
		}
	});

	test('every tech has at least one matchable pattern', () => {
		for (const t of COMPILED_CATALOG) {
			const p = t.patterns;
			const has =
				(p.js && Object.keys(p.js).length > 0) ||
				(p.dom && p.dom.length > 0) ||
				(p.meta && Object.keys(p.meta).length > 0) ||
				(p.headers && Object.keys(p.headers).length > 0) ||
				(p.cookies && Object.keys(p.cookies).length > 0) ||
				(p.scriptSrc && p.scriptSrc.length > 0) ||
				(p.scripts && p.scripts.length > 0) ||
				(p.html && p.html.length > 0) ||
				(p.text && p.text.length > 0) ||
				(p.css && p.css.length > 0) ||
				(p.url && p.url.length > 0) ||
				(p.xhr && p.xhr.length > 0);
			expect(has, `Tech '${t.name}' has no matchable pattern`).toBe(true);
		}
	});

	test('CATEGORIES covers every cat referenced by COMPILED_CATALOG', () => {
		const referenced = new Set<number>();
		for (const t of COMPILED_CATALOG) for (const c of t.cats) referenced.add(c);
		for (const id of referenced) {
			expect(CATEGORIES[String(id)], `cat ${id} not in CATEGORIES`).toBeDefined();
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/insights/__tests__/catalog.test.ts`
Expected: FAIL — module `../catalog` not found.

- [ ] **Step 3: Implement catalog/index.ts**

Create `app/src/lib/insights/catalog/index.ts`:

```ts
import { parsePattern } from '../pattern';
import type {
	CategoryMeta,
	CompiledDomRule,
	CompiledPattern,
	CompiledTech,
	ImpliedRef,
} from '../types';
import categoriesData from './categories.json';
// Vite eager glob: importa todos os JSONs de letra no boot.
const letterModules = import.meta.glob<Record<string, RawTech>>('./[a-z_].json', {
	eager: true,
	import: 'default',
});

interface RawTech {
	cats: number[];
	website: string;
	icon?: string;
	description?: string;
	cookies?: Record<string, string>;
	dom?: string[] | string | Record<string, unknown>;
	js?: Record<string, string>;
	headers?: Record<string, string>;
	html?: string[];
	text?: string[];
	css?: string[];
	meta?: Record<string, string | string[]>;
	scriptSrc?: string[];
	scripts?: string[];
	url?: string[];
	xhr?: string[];
	implies?: string[];
	requires?: string[];
	requiresCategory?: number[];
	excludes?: string[];
}

function safeParse(raw: string): CompiledPattern | null {
	try {
		return parsePattern(raw);
	} catch (err) {
		console.warn(`[insights] regex inválida descartada: '${raw}' — ${(err as Error).message}`);
		return null;
	}
}

function compileArray(raws: string[] | undefined): CompiledPattern[] | undefined {
	if (!raws) return undefined;
	const out: CompiledPattern[] = [];
	for (const r of raws) {
		const p = safeParse(r);
		if (p) out.push(p);
	}
	return out.length > 0 ? out : undefined;
}

function compileRecord(
	raw: Record<string, string> | undefined,
): Record<string, CompiledPattern> | undefined {
	if (!raw) return undefined;
	const out: Record<string, CompiledPattern> = {};
	for (const [k, v] of Object.entries(raw)) {
		const p = safeParse(v);
		if (p) out[k] = p;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

function compileMeta(
	raw: Record<string, string | string[]> | undefined,
): Record<string, CompiledPattern> | undefined {
	if (!raw) return undefined;
	const flat: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw)) {
		flat[k] = Array.isArray(v) ? v.join('|') : v;
	}
	return compileRecord(flat);
}

function compileDom(
	raw: string[] | string | Record<string, unknown> | undefined,
): CompiledDomRule[] | undefined {
	if (!raw) return undefined;
	const rules: CompiledDomRule[] = [];
	if (typeof raw === 'string') {
		rules.push({ selector: raw, exists: true });
	} else if (Array.isArray(raw)) {
		for (const sel of raw) rules.push({ selector: sel, exists: true });
	} else {
		for (const [selector, body] of Object.entries(raw)) {
			const rule: CompiledDomRule = { selector };
			if (typeof body === 'object' && body !== null) {
				const b = body as {
					exists?: string;
					attributes?: Record<string, string>;
					properties?: Record<string, string>;
					text?: string;
				};
				if (b.exists !== undefined) rule.exists = true;
				if (b.attributes) rule.attributes = compileRecord(b.attributes);
				if (b.properties) rule.properties = compileRecord(b.properties);
				if (b.text !== undefined) {
					const p = safeParse(b.text);
					if (p) rule.text = p;
				}
			}
			rules.push(rule);
		}
	}
	return rules.length > 0 ? rules : undefined;
}

function compileImplies(raws: string[] | undefined): ImpliedRef[] {
	if (!raws) return [];
	return raws
		.map((r) => {
			// formato `Name\;confidence:N`
			const parts = r.split('\\;');
			const name = parts[0];
			let confidence = 100;
			for (let i = 1; i < parts.length; i++) {
				const part = parts[i];
				if (part.startsWith('confidence:')) {
					const n = Number(part.slice('confidence:'.length));
					if (Number.isFinite(n)) confidence = Math.max(0, Math.min(100, n));
				}
			}
			return { name, confidence };
		})
		.filter((r) => r.name.length > 0);
}

function compileTech(name: string, raw: RawTech): CompiledTech | null {
	const patterns: CompiledTech['patterns'] = {};
	const js = compileRecord(raw.js);
	if (js) patterns.js = js;
	const dom = compileDom(raw.dom);
	if (dom) patterns.dom = dom;
	const meta = compileMeta(raw.meta);
	if (meta) patterns.meta = meta;
	const headers = compileRecord(raw.headers);
	if (headers) patterns.headers = headers;
	const cookies = compileRecord(raw.cookies);
	if (cookies) patterns.cookies = cookies;
	const scriptSrc = compileArray(raw.scriptSrc);
	if (scriptSrc) patterns.scriptSrc = scriptSrc;
	const scripts = compileArray(raw.scripts);
	if (scripts) patterns.scripts = scripts;
	const html = compileArray(raw.html);
	if (html) patterns.html = html;
	const text = compileArray(raw.text);
	if (text) patterns.text = text;
	const css = compileArray(raw.css);
	if (css) patterns.css = css;
	const url = compileArray(raw.url);
	if (url) patterns.url = url;
	const xhr = compileArray(raw.xhr);
	if (xhr) patterns.xhr = xhr;

	const hasAny =
		patterns.js ||
		patterns.dom ||
		patterns.meta ||
		patterns.headers ||
		patterns.cookies ||
		patterns.scriptSrc ||
		patterns.scripts ||
		patterns.html ||
		patterns.text ||
		patterns.css ||
		patterns.url ||
		patterns.xhr;
	if (!hasAny) {
		console.warn(`[insights] tech '${name}' sem pattern válida; descartado do catálogo`);
		return null;
	}

	return {
		name,
		cats: raw.cats,
		icon: raw.icon,
		website: raw.website,
		description: raw.description,
		patterns,
		implies: compileImplies(raw.implies),
		requires: raw.requires ?? [],
		requiresCategory: raw.requiresCategory ?? [],
		excludes: raw.excludes ?? [],
	};
}

function compileAll(): CompiledTech[] {
	const out: CompiledTech[] = [];
	for (const mod of Object.values(letterModules)) {
		for (const [name, raw] of Object.entries(mod)) {
			const c = compileTech(name, raw);
			if (c) out.push(c);
		}
	}
	return out;
}

export const COMPILED_CATALOG: CompiledTech[] = compileAll();
export const CATEGORIES: Record<string, CategoryMeta> = categoriesData as Record<
	string,
	CategoryMeta
>;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app && npx vitest run src/lib/insights/__tests__/catalog.test.ts`
Expected: PASS — 5 tests.

If "loads at least 100 techs" fails, the catalog has fewer than 100 — likely names in whitelist not matching upstream. Inspect the missing names from Task 11 step 3 output and adjust whitelist.

- [ ] **Step 5: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/catalog/index.ts app/src/lib/insights/__tests__/catalog.test.ts
git commit -m "$(cat <<'EOF'
feat(insights): catalog/index.ts compila CompiledTech via Vite glob

Sub-projeto 1, Task 12: compileAll() carrega buckets por letra via
import.meta.glob eager, parseia patterns com safeParse (warn+skip em
regex inválida), descarta techs sem pattern válida. Exporta
COMPILED_CATALOG e CATEGORIES.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Fixture — WordPress detection

**Files:**
- Create: `app/src/lib/insights/__tests__/fixtures/wordpress.json`
- Create: `app/src/lib/insights/__tests__/fixtures.test.ts`

- [ ] **Step 1: Create WordPress fixture**

Create `app/src/lib/insights/__tests__/fixtures/wordpress.json`:

```json
{
	"signals": [
		{ "kind": "header", "name": "x-powered-by", "value": "PHP/8.1.0" },
		{ "kind": "meta", "name": "generator", "value": "WordPress 6.4.2" },
		{ "kind": "scriptSrc", "value": "https://example.com/wp-content/plugins/jetpack/jet.js" },
		{ "kind": "scriptSrc", "value": "https://example.com/wp-includes/js/wp-emoji.js" },
		{ "kind": "url", "value": "https://example.com/wp-admin/" },
		{ "kind": "html", "value": "<link rel='stylesheet' href='/wp-content/themes/twentytwentyfour/style.css' />" }
	],
	"expectedHits": ["WordPress", "PHP"]
}
```

- [ ] **Step 2: Write failing test**

Create `app/src/lib/insights/__tests__/fixtures.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { COMPILED_CATALOG } from '../catalog';
import { Scorer } from '../scorer';
import type { Signal } from '../types';
import wordpressFixture from './fixtures/wordpress.json';

interface Fixture {
	signals: Signal[];
	expectedHits: string[];
}

function runFixture(fixture: Fixture): string[] {
	const s = new Scorer(COMPILED_CATALOG);
	s.pushSignals(fixture.signals);
	return s.snapshot().map((h) => h.name).sort();
}

describe('fixtures — WordPress', () => {
	test('detects WordPress and implies PHP', () => {
		const detected = runFixture(wordpressFixture as Fixture);
		for (const expected of (wordpressFixture as Fixture).expectedHits) {
			expect(detected).toContain(expected);
		}
	});
});
```

- [ ] **Step 3: Run test**

Run: `cd app && npx vitest run src/lib/insights/__tests__/fixtures.test.ts`
Expected: PASS. If it fails, the WordPress entry in upstream needs inspection — open `/Users/guichafy/Workspaces/webappanalyzer-main/src/technologies/w.json`, find `"WordPress"`, see which patterns it ships with, and adjust fixture signals to match (the fixture must contain values that the upstream patterns will recognize).

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/__tests__/fixtures/wordpress.json app/src/lib/insights/__tests__/fixtures.test.ts
git commit -m "$(cat <<'EOF'
test(insights): fixture WordPress + implies PHP

Sub-projeto 1, Task 13: signals reais de uma página WordPress detectam
'WordPress' e auto-derivam 'PHP' via implies.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Fixture — Shopify

**Files:**
- Create: `app/src/lib/insights/__tests__/fixtures/shopify.json`
- Modify: `app/src/lib/insights/__tests__/fixtures.test.ts`

- [ ] **Step 1: Create Shopify fixture**

Create `app/src/lib/insights/__tests__/fixtures/shopify.json`:

```json
{
	"signals": [
		{ "kind": "url", "value": "https://my-store.myshopify.com/products/x" },
		{ "kind": "scriptSrc", "value": "https://cdn.shopify.com/s/files/1/0001/0001/t/2/assets/theme.js" },
		{ "kind": "header", "name": "x-shopid", "value": "12345" },
		{ "kind": "header", "name": "x-shopify-stage", "value": "production" }
	],
	"expectedHits": ["Shopify"]
}
```

- [ ] **Step 2: Add failing test**

Append to `app/src/lib/insights/__tests__/fixtures.test.ts`:

```ts
import shopifyFixture from './fixtures/shopify.json';

describe('fixtures — Shopify', () => {
	test('detects Shopify from CDN scriptSrc + headers', () => {
		const detected = runFixture(shopifyFixture as Fixture);
		for (const expected of (shopifyFixture as Fixture).expectedHits) {
			expect(detected).toContain(expected);
		}
	});
});
```

- [ ] **Step 3: Run test**

Run: `cd app && npx vitest run src/lib/insights/__tests__/fixtures.test.ts`
Expected: PASS. If fails, inspect upstream `s.json` for "Shopify" and align fixture signals.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/__tests__/fixtures/shopify.json app/src/lib/insights/__tests__/fixtures.test.ts
git commit -m "$(cat <<'EOF'
test(insights): fixture Shopify

Sub-projeto 1, Task 14: detecta Shopify via cdn.shopify.com + x-shopid.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Fixture — Next.js + React (implies test in real catalog)

**Files:**
- Create: `app/src/lib/insights/__tests__/fixtures/nextjs.json`
- Modify: `app/src/lib/insights/__tests__/fixtures.test.ts`

- [ ] **Step 1: Create Next.js fixture**

Create `app/src/lib/insights/__tests__/fixtures/nextjs.json`:

```json
{
	"signals": [
		{ "kind": "scriptSrc", "value": "/_next/static/chunks/main-abc123.js" },
		{ "kind": "scriptSrc", "value": "/_next/static/runtime/main-def456.js" },
		{ "kind": "html", "value": "<script id=\"__NEXT_DATA__\" type=\"application/json\">{}</script>" },
		{ "kind": "meta", "name": "next-head-count", "value": "3" }
	],
	"expectedHits": ["Next.js", "React"]
}
```

- [ ] **Step 2: Add failing test**

Append to `app/src/lib/insights/__tests__/fixtures.test.ts`:

```ts
import nextjsFixture from './fixtures/nextjs.json';

describe('fixtures — Next.js', () => {
	test('detects Next.js and implies React', () => {
		const detected = runFixture(nextjsFixture as Fixture);
		for (const expected of (nextjsFixture as Fixture).expectedHits) {
			expect(detected).toContain(expected);
		}
	});
});
```

- [ ] **Step 3: Run test**

Run: `cd app && npx vitest run src/lib/insights/__tests__/fixtures.test.ts`
Expected: PASS. If fails, inspect upstream `n.json` for "Next.js" and align signals.

- [ ] **Step 4: Commit**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
git add app/src/lib/insights/__tests__/fixtures/nextjs.json app/src/lib/insights/__tests__/fixtures.test.ts
git commit -m "$(cat <<'EOF'
test(insights): fixture Next.js + implies React

Sub-projeto 1, Task 15: detecta Next.js via /_next/static + __NEXT_DATA__
e auto-deriva React.

bd: chrome-extension-debug-buddy-e84

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Final verification — full suite + lint + build

- [ ] **Step 1: Run full test suite**

Run: `cd app && npm test`
Expected: all tests pass, including all `__tests__/insights/*` files.

- [ ] **Step 2: Run lint**

Run: `cd app && npm run lint`
Expected: zero errors. Apply `npm run lint:fix` if formatting drift exists, then re-run.

- [ ] **Step 3: Run build**

Run: `cd app && npm run build`
Expected: build succeeds. Inspect bundle size:
```bash
ls -lh /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/dist/
```
Catalog JSON should be tree-shaken-friendly inside the main bundle (or split). Total bundle size delta should be ≤200KB vs main branch.

- [ ] **Step 4: tsc --noEmit**

Run: `cd app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify lib is dormant — no imports yet**

Run:
```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
grep -rln "from '@/lib/insights" app/src --include="*.ts" --include="*.tsx" | grep -v "src/lib/insights/" | grep -v "__tests__"
```
Expected: empty output. The lib is bundled but no production code imports it (except its own internal modules and tests). This satisfies the "dormante até Sub-projeto 2" goal.

- [ ] **Step 6: Close bd issue + push**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy
bd close chrome-extension-debug-buddy-e84 --reason="Sub-projeto 1 completo: catálogo + engine. Lib pura em app/src/lib/insights/, dormante até Sub-projeto 2."
git pull --rebase
bd dolt push
git push
git status
```
Expected: `git status` shows "up to date with origin".

---

## Self-Review Notes

**Spec coverage:** Tasks 1-16 cobrem todos os critérios de aceitação do spec:
- Task 1 → types
- Tasks 2-3 → pattern parser + expandVersion
- Task 4 → matcher
- Tasks 5-7 → implications graph (excludes/requires/implies)
- Tasks 8-9 → Scorer
- Tasks 10-11 → whitelist + build script + zod validation
- Task 12 → catalog/index.ts
- Tasks 13-15 → fixtures
- Task 16 → final verification (lint, build, dormant check)

**Type consistency:** `Scorer`, `applyImplications`, `matchTechAgainstSignal`, `parsePattern`, `expandVersion` aparecem com a mesma assinatura em todas as tasks. `MatchResult`, `MatchEvidence`, `TechHit`, `CompiledTech` são definidos em Task 1 e usados consistentemente.

**No placeholders:** Todos os steps têm código completo e comandos exatos. Não há "TBD"/"TODO"/"add appropriate handling".

**Order of TDD:** Cada task que adiciona comportamento segue o ciclo write-test → run-fail → implement → run-pass → commit. Tasks de pure data (types, whitelist, fixtures) pulam o ciclo de teste falho onde não se aplica.
