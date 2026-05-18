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

describe('validateRuleImport — invariantes da chain', () => {
	test('rejeita action incompatível com o stage (block em response)', () => {
		const broken: Rule = {
			...sampleRule,
			stage: 'response',
			actions: [{ type: 'block', enabled: true, errorReason: 'Failed' }],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/'block'.*não é válida.*'response'/);
	});

	test('rejeita action incompatível com o stage (transform em request)', () => {
		const broken: Rule = {
			...sampleRule,
			stage: 'request',
			actions: [{ type: 'transform', enabled: true, mode: 'declarative', operations: [] }],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/'transform'.*não é válida.*'request'/);
	});

	test('rejeita chain com 2 actions terminais', () => {
		const broken: Rule = {
			...sampleRule,
			stage: 'request',
			actions: [
				{ type: 'block', enabled: true, errorReason: 'Failed' },
				{ type: 'mock', enabled: true, status: 200, headers: {} },
			],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/2 actions terminais/);
	});

	test('rejeita terminal antes da última posição', () => {
		const broken: Rule = {
			...sampleRule,
			stage: 'request',
			actions: [
				{ type: 'block', enabled: true, errorReason: 'Failed' },
				{ type: 'requestDelay', enabled: true, timeMs: 100 },
			],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/terminal.*última/);
	});

	test('rejeita chain response com 2+ actions (limite temporário até executeChain do Response stage)', () => {
		const broken: Rule = {
			...sampleRule,
			stage: 'response',
			actions: [
				{ type: 'responseModify', enabled: true },
				{ type: 'mock', enabled: true, status: 200, headers: {} },
			],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [broken] });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/2\+ actions em stage=response/);
	});

	test('aceita chain request com modifier + terminal na última posição', () => {
		const rule: Rule = {
			...sampleRule,
			stage: 'request',
			actions: [
				{ type: 'requestDelay', enabled: true, timeMs: 100 },
				{ type: 'mock', enabled: true, status: 200, headers: {} },
			],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [rule] });
		expect(result.ok).toBe(true);
	});

	test('aceita chain só com modificadores (sem terminal)', () => {
		const rule: Rule = {
			...sampleRule,
			stage: 'request',
			actions: [
				{ type: 'requestModify', enabled: true, addHeaders: { 'X-Foo': 'bar' } },
				{ type: 'requestDelay', enabled: true, timeMs: 100 },
			],
		};
		const result = validateRuleImport({ schemaVersion: 2, rules: [rule] });
		expect(result.ok).toBe(true);
	});
});
