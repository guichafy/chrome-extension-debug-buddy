import { describe, expect, test } from 'vitest';
import { expandVersion, parsePattern } from '../pattern';

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
