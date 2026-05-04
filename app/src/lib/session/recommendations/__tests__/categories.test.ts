import { describe, expect, test } from 'vitest';
import { CATEGORY_LABEL, CATEGORY_ORDER, RULE_CATEGORIES } from '../categories';
import type { RecommendationRuleId } from '../../types';

describe('RULE_CATEGORIES', () => {
	test('cobre todas as 10 RecommendationRuleIds', () => {
		const expected: RecommendationRuleId[] = [
			'compression-missing',
			'cache-missing',
			'mixed-content',
			'csp-missing',
			'hsts-missing',
			'nosniff-missing',
			'large-payload',
			'image-not-optimized',
			'cookie-insecure',
			'cors-open',
		];
		const actual = Object.keys(RULE_CATEGORIES) as RecommendationRuleId[];
		expect(actual.sort()).toEqual(expected.sort());
	});

	test('classifica security e performance corretamente', () => {
		const security: RecommendationRuleId[] = [
			'csp-missing',
			'hsts-missing',
			'cookie-insecure',
			'mixed-content',
			'cors-open',
			'nosniff-missing',
		];
		const performance: RecommendationRuleId[] = [
			'compression-missing',
			'cache-missing',
			'large-payload',
			'image-not-optimized',
		];
		for (const id of security) expect(RULE_CATEGORIES[id]).toBe('security');
		for (const id of performance) expect(RULE_CATEGORIES[id]).toBe('performance');
	});

	test('CATEGORY_ORDER ordena security primeiro', () => {
		expect(CATEGORY_ORDER).toEqual(['security', 'performance']);
	});

	test('CATEGORY_LABEL mapeia para pt-BR', () => {
		expect(CATEGORY_LABEL.security).toBe('Segurança');
		expect(CATEGORY_LABEL.performance).toBe('Performance');
	});
});
