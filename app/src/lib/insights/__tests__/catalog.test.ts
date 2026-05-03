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
