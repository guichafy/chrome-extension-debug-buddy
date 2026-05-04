import { describe, expect, test } from 'vitest';
import { mergeHits } from '../mergeHits';
import type { CompiledTech, MatchEvidence, TechHit } from '../types';

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

function hit(name: string, overrides: Partial<TechHit> = {}): TechHit {
	return {
		name,
		cats: [],
		confidence: 100,
		evidence: [],
		...overrides,
	};
}

const ev = (n: number): MatchEvidence[] =>
	Array.from({ length: n }, (_, i) => ({ signal: 'header', pattern: `p${i}` }));

describe('mergeHits', () => {
	test('returns incoming when existing is empty', () => {
		const incoming = [hit('A'), hit('B')];
		const result = mergeHits([], incoming, new Map());
		expect(result.map((h) => h.name).sort()).toEqual(['A', 'B']);
	});

	test('returns existing when incoming is empty', () => {
		const existing = [hit('A')];
		const result = mergeHits(existing, [], new Map());
		expect(result.map((h) => h.name)).toEqual(['A']);
	});

	test('combines confidence with cap 100', () => {
		const existing = [hit('X', { confidence: 70 })];
		const incoming = [hit('X', { confidence: 50 })];
		const result = mergeHits(existing, incoming, new Map());
		expect(result[0].confidence).toBe(100);
	});

	test('first version wins', () => {
		const existing = [hit('X', { version: '1.0' })];
		const incoming = [hit('X', { version: '2.0' })];
		expect(mergeHits(existing, incoming, new Map())[0].version).toBe('1.0');
	});

	test('fills version if existing has none', () => {
		const existing = [hit('X')];
		const incoming = [hit('X', { version: '2.0' })];
		expect(mergeHits(existing, incoming, new Map())[0].version).toBe('2.0');
	});

	test('caps merged evidence at 8', () => {
		const existing = [hit('X', { evidence: ev(6) })];
		const incoming = [hit('X', { evidence: ev(5) })];
		expect(mergeHits(existing, incoming, new Map())[0].evidence.length).toBe(8);
	});

	test('applies implications after merge', () => {
		const wp = tech('WordPress', { implies: [{ name: 'PHP', confidence: 100 }] });
		const php = tech('PHP', { cats: [27] });
		const cmap = new Map<string, CompiledTech>([
			['WordPress', wp],
			['PHP', php],
		]);
		const result = mergeHits([], [hit('WordPress')], cmap);
		expect(result.map((h) => h.name).sort()).toEqual(['PHP', 'WordPress']);
		const phpHit = result.find((h) => h.name === 'PHP');
		expect(phpHit?.implied).toBe(true);
	});

	test('preenche icon/website/description do incoming quando existing não os tem', () => {
		const existing: TechHit[] = [
			{ name: 'X', cats: [12], confidence: 50, evidence: [], website: '' },
		];
		const incoming: TechHit[] = [
			{
				name: 'X',
				cats: [12],
				confidence: 50,
				evidence: [],
				website: 'https://example.com',
				icon: 'X.svg',
				description: 'A test tech',
			},
		];
		const merged = mergeHits(existing, incoming, new Map());
		expect(merged[0].website).toBe('https://example.com');
		expect(merged[0].icon).toBe('X.svg');
		expect(merged[0].description).toBe('A test tech');
	});

	test('não sobrescreve icon/website/description quando existing já os tem', () => {
		const existing: TechHit[] = [
			{
				name: 'X',
				cats: [12],
				confidence: 50,
				evidence: [],
				website: 'https://existing.com',
				icon: 'old.svg',
				description: 'old description',
			},
		];
		const incoming: TechHit[] = [
			{
				name: 'X',
				cats: [12],
				confidence: 50,
				evidence: [],
				website: 'https://incoming.com',
				icon: 'new.svg',
				description: 'new description',
			},
		];
		const merged = mergeHits(existing, incoming, new Map());
		expect(merged[0].website).toBe('https://existing.com');
		expect(merged[0].icon).toBe('old.svg');
		expect(merged[0].description).toBe('old description');
	});

	test('does not mutate input arrays', () => {
		const existing = [hit('X', { confidence: 50, evidence: [] })];
		const incoming = [hit('X', { confidence: 30 })];
		const before = JSON.stringify(existing);
		mergeHits(existing, incoming, new Map());
		expect(JSON.stringify(existing)).toBe(before);
	});
});
