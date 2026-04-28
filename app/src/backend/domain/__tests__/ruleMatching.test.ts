import { describe, expect, test } from 'vitest';
import type { Rule } from '../../types/rules';
import { findMatchingRuleAction } from '../ruleMatching';

const baseRule = (overrides: Partial<Rule>): Rule => ({
	id: 'rule-1',
	name: 'rule',
	enabled: true,
	matchers: [{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false }],
	action: { type: 'breakpoint', enabled: true },
	createdAt: 1,
	updatedAt: 1,
	...overrides,
});

describe('findMatchingRuleAction', () => {
	test('retorna mock mantendo body ausente quando a action nao define body', () => {
		const rule = baseRule({
			action: {
				type: 'mock',
				enabled: true,
				status: 204,
				headers: {},
			},
		});

		const match = findMatchingRuleAction([rule], {
			url: 'https://example.test/api/users',
			method: 'GET',
			headers: {},
		});

		expect(match).toEqual({ type: 'mock', rule, action: rule.action });
		expect(match?.type).toBe('mock');
		expect(match && 'body' in match.action).toBe(false);
	});

	test('corresponde metodo ANY sem fabricar metodo ausente', () => {
		const rule = baseRule({
			matchers: [
				{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
				{ type: 'method', enabled: true, method: 'ANY' },
			],
			action: { type: 'breakpoint', enabled: true },
		});

		expect(
			findMatchingRuleAction([rule], {
				url: 'https://example.test/api',
				method: 'OPTIONS',
				headers: {},
			}),
		).toEqual({ type: 'breakpoint', rule, action: rule.action });
	});

	test('usa request headers reais para matcher de header', () => {
		const rule = baseRule({
			matchers: [
				{ type: 'url', enabled: true, pattern: '/secure', isRegex: false },
				{
					type: 'header',
					enabled: true,
					headerType: 'request',
					name: 'authorization',
					value: 'Bearer token',
				},
			],
			action: { type: 'breakpoint', enabled: true },
		});

		expect(
			findMatchingRuleAction([rule], {
				url: 'https://example.test/secure',
				method: 'GET',
				headers: { Authorization: 'Bearer token' },
			})?.type,
		).toBe('breakpoint');
		expect(
			findMatchingRuleAction([rule], {
				url: 'https://example.test/secure',
				method: 'GET',
				headers: { Authorization: 'Bearer other' },
			}),
		).toBeUndefined();
	});

	test('ignora regra desabilitada ou action desabilitada', () => {
		expect(
			findMatchingRuleAction([baseRule({ enabled: false })], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			}),
		).toBeUndefined();
		expect(
			findMatchingRuleAction([baseRule({ action: { type: 'breakpoint', enabled: false } })], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			}),
		).toBeUndefined();
	});
});
