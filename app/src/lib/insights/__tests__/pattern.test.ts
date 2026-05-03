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
