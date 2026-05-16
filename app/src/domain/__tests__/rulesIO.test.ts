import { describe, expect, test } from 'vitest';
import type { Rule } from '@/types/rules';
import { serializeRules, validateRuleImport } from '../rulesIO';

const sampleRule: Rule = {
	id: 'r1',
	name: 'Mock A',
	enabled: true,
	stage: 'response',
	matchers: [{ type: 'url', enabled: true, pattern: 'api/x', isRegex: false }],
	actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
	createdAt: 1,
	updatedAt: 1,
};

describe('serializeRules', () => {
	test('exporta envelope com schemaVersion v2 e rules', () => {
		const json = serializeRules([sampleRule]);
		const parsed = JSON.parse(json);
		expect(parsed).toMatchObject({
			schemaVersion: 2,
			rules: [sampleRule],
		});
	});
});

describe('validateRuleImport', () => {
	test('aceita JSON válido (schemaVersion 2)', () => {
		const result = validateRuleImport({ schemaVersion: 2, rules: [sampleRule] });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rules).toHaveLength(1);
	});

	test('rejeita objeto sem schemaVersion', () => {
		const result = validateRuleImport({ rules: [sampleRule] });
		expect(result.ok).toBe(false);
	});

	test('rejeita schemaVersion desconhecido', () => {
		const result = validateRuleImport({ schemaVersion: 99, rules: [sampleRule] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/schemaVersion/);
	});

	test('rejeita schemaVersion v1 (legado pré-dual-stage)', () => {
		const result = validateRuleImport({ schemaVersion: 1, rules: [sampleRule] });
		expect(result.ok).toBe(false);
	});

	test('rejeita rules não-array', () => {
		const result = validateRuleImport({ schemaVersion: 2, rules: 'foo' });
		expect(result.ok).toBe(false);
	});

	test('rejeita regra sem matchers', () => {
		const broken = { ...sampleRule, matchers: undefined };
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/matchers/);
	});

	test('rejeita action.type fora do conjunto', () => {
		const broken = {
			...sampleRule,
			actions: [{ ...sampleRule.actions[0], type: 'desconhecida' }],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
	});

	test('rejeita string crua', () => {
		expect(validateRuleImport('not an object').ok).toBe(false);
	});
});
