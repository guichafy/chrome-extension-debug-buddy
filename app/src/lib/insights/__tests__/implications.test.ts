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
