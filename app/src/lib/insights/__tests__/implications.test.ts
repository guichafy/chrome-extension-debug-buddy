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
