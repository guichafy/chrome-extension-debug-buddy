import { describe, expect, test } from 'vitest';
import type { Action, Matcher, Rule, RuleStage } from '../../types/rules';
import { findUnreachableRuleIds, isRuleUnreachable } from '../ruleReachability';

let nextId = 0;
function makeRule(overrides: Partial<Rule> = {}): Rule {
	const id = `r${++nextId}`;
	return {
		id,
		name: `Rule ${id}`,
		enabled: true,
		stage: 'response',
		matchers: [],
		actions: [{ type: 'mock', enabled: true, status: 200, headers: {} } as Action],
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

const urlMatcher = (pattern: string, enabled = true): Matcher => ({
	type: 'url',
	enabled,
	pattern,
	isRegex: false,
});

const methodMatcher = (method: string | string[], enabled = true): Matcher => ({
	type: 'method',
	enabled,
	method,
});

describe('findUnreachableRuleIds', () => {
	test('lista vazia retorna conjunto vazio', () => {
		expect(findUnreachableRuleIds([])).toEqual(new Set());
	});

	test('regra única nunca é inalcançável', () => {
		const rule = makeRule({ matchers: [urlMatcher('/api')] });
		expect(findUnreachableRuleIds([rule])).toEqual(new Set());
	});

	test('regra catch-all terminal acima torna todas posteriores do mesmo stage inalcançáveis', () => {
		const blocker = makeRule({
			matchers: [],
			actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
		});
		const r2 = makeRule({ matchers: [urlMatcher('/api')] });
		const r3 = makeRule({ matchers: [urlMatcher('/other')] });
		const result = findUnreachableRuleIds([blocker, r2, r3]);
		expect(result).toEqual(new Set([r2.id, r3.id]));
	});

	test('regra catch-all NÃO-terminal não bloqueia (modify acima continua a chain)', () => {
		const modifier = makeRule({
			matchers: [],
			actions: [{ type: 'responseModify', enabled: true }],
		});
		const r2 = makeRule({ matchers: [urlMatcher('/api')] });
		expect(findUnreachableRuleIds([modifier, r2])).toEqual(new Set());
	});

	test('regra catch-all com action terminal disabled não bloqueia', () => {
		const blocker = makeRule({
			matchers: [],
			actions: [{ type: 'mock', enabled: false, status: 500, headers: {} }],
		});
		const r2 = makeRule({ matchers: [urlMatcher('/api')] });
		expect(findUnreachableRuleIds([blocker, r2])).toEqual(new Set());
	});

	test('regra acima disabled não bloqueia ninguém', () => {
		const blocker = makeRule({
			enabled: false,
			matchers: [],
			actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
		});
		const r2 = makeRule({ matchers: [urlMatcher('/api')] });
		expect(findUnreachableRuleIds([blocker, r2])).toEqual(new Set());
	});

	test('catch-all terminal em stage=request NÃO bloqueia regras de stage=response', () => {
		const blockerRequest = makeRule({
			stage: 'request',
			matchers: [],
			actions: [{ type: 'block', enabled: true, errorReason: 'Failed' }],
		});
		const responseRule = makeRule({ stage: 'response', matchers: [urlMatcher('/api')] });
		expect(findUnreachableRuleIds([blockerRequest, responseRule])).toEqual(new Set());
	});

	test('regras com matchers idênticos: segunda é inalcançável quando primeira é terminal', () => {
		const r1 = makeRule({
			matchers: [urlMatcher('/api/users')],
			actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
		});
		const r2 = makeRule({
			matchers: [urlMatcher('/api/users')],
			actions: [{ type: 'mock', enabled: true, status: 404, headers: {} }],
		});
		expect(findUnreachableRuleIds([r1, r2])).toEqual(new Set([r2.id]));
	});

	test('matchers idênticos mas em ordem diferente ainda contam como iguais', () => {
		const r1 = makeRule({
			matchers: [urlMatcher('/api'), methodMatcher('GET')],
			actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
		});
		const r2 = makeRule({
			matchers: [methodMatcher('GET'), urlMatcher('/api')],
			actions: [{ type: 'breakpoint', enabled: true }],
		});
		expect(findUnreachableRuleIds([r1, r2])).toEqual(new Set([r2.id]));
	});

	test('matchers desabilitados são ignorados ao comparar assinatura', () => {
		const r1 = makeRule({
			matchers: [urlMatcher('/api'), methodMatcher('GET', false)],
			actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
		});
		const r2 = makeRule({
			matchers: [urlMatcher('/api')],
			actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
		});
		expect(findUnreachableRuleIds([r1, r2])).toEqual(new Set([r2.id]));
	});

	test('regras com matchers diferentes (não idênticos, não catch-all acima) NÃO marcam inalcançável', () => {
		const r1 = makeRule({
			matchers: [urlMatcher('/api/users')],
			actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
		});
		const r2 = makeRule({
			matchers: [urlMatcher('/api/products')],
			actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
		});
		expect(findUnreachableRuleIds([r1, r2])).toEqual(new Set());
	});

	test('regra sem actions habilitadas não é terminal (não bloqueia)', () => {
		const candidate = makeRule({
			matchers: [],
			actions: [
				{ type: 'mock', enabled: false, status: 500, headers: {} },
				{ type: 'responseModify', enabled: false },
			],
		});
		const r2 = makeRule({ matchers: [urlMatcher('/api')] });
		expect(findUnreachableRuleIds([candidate, r2])).toEqual(new Set());
	});

	test('chain de regras: modify catch-all acima + terminal catch-all bloqueia abaixo', () => {
		const modifier = makeRule({
			matchers: [],
			actions: [{ type: 'responseModify', enabled: true }],
		});
		const blocker = makeRule({
			matchers: [],
			actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
		});
		const r3 = makeRule({ matchers: [urlMatcher('/api')] });
		const result = findUnreachableRuleIds([modifier, blocker, r3]);
		expect(result).toEqual(new Set([r3.id]));
	});

	test('Phase 6: bloqueio por stage é independente — request e response têm tracking separado', () => {
		const blockerResp = makeRule({
			stage: 'response',
			matchers: [],
			actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
		});
		const blockerReq = makeRule({
			stage: 'request',
			matchers: [],
			actions: [{ type: 'block', enabled: true, errorReason: 'Failed' }],
		});
		const r3resp = makeRule({ stage: 'response', matchers: [urlMatcher('/api')] });
		const r4req = makeRule({ stage: 'request', matchers: [urlMatcher('/api')] });
		const result = findUnreachableRuleIds([blockerResp, blockerReq, r3resp, r4req]);
		expect(result).toEqual(new Set([r3resp.id, r4req.id]));
	});
});

describe('isRuleUnreachable', () => {
	test('retorna true para regra contida em findUnreachableRuleIds', () => {
		const blocker = makeRule({
			matchers: [],
			actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
		});
		const r2 = makeRule({ matchers: [urlMatcher('/api')] });
		expect(isRuleUnreachable(r2, [blocker, r2])).toBe(true);
		expect(isRuleUnreachable(blocker, [blocker, r2])).toBe(false);
	});
});

// Garante exportação esperada de RuleStage para uso pela UI (smoke).
const _stages: RuleStage[] = ['request', 'response'];
void _stages;
