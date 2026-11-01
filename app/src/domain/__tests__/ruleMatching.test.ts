import { describe, expect, test } from 'vitest';
import type { Action, Matcher, Rule, RuleStage } from '../../types/rules';
import {
	explainMatchers,
	findMatchingRuleAction,
	findMatchingRulesChain,
	validateMatchersForStage,
} from '../ruleMatching';

const baseRule = (overrides: Partial<Rule>): Rule => ({
	id: 'rule-1',
	name: 'rule',
	enabled: true,
	stage: 'response',
	matchers: [{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false }],
	actions: [{ type: 'breakpoint', enabled: true }],
	createdAt: 1,
	updatedAt: 1,
	...overrides,
});

describe('findMatchingRuleAction', () => {
	test('retorna mock mantendo body ausente quando a action nao define body', () => {
		const rule = baseRule({
			actions: [
				{
					type: 'mock',
					enabled: true,
					status: 204,
					headers: {},
				},
			],
		});

		const match = findMatchingRuleAction([rule], {
			url: 'https://example.test/api/users',
			method: 'GET',
			headers: {},
		});

		expect(match).toEqual({ type: 'mock', rule, action: rule.actions[0] });
		expect(match?.type).toBe('mock');
		expect(match && 'body' in match.action).toBe(false);
	});

	test('retorna requestDelay quando a regra de Latência casa', () => {
		const rule = baseRule({
			stage: 'request',
			actions: [
				{
					type: 'requestDelay',
					enabled: true,
					timeMs: 1500,
				},
			],
		});

		const match = findMatchingRuleAction([rule], {
			url: 'https://example.test/api/users',
			method: 'GET',
			headers: {},
		});

		expect(match).toEqual({ type: 'requestDelay', rule, action: rule.actions[0] });
	});

	test('retorna transform quando a regra casa (regressão: antes era pulado)', () => {
		const rule = baseRule({
			actions: [
				{
					type: 'transform',
					enabled: true,
					mode: 'declarative',
					operations: [{ id: 'op1', type: 'replace', path: '$.x', value: '"y"' }],
				},
			],
		});

		const match = findMatchingRuleAction([rule], {
			url: 'https://example.test/api/users',
			method: 'GET',
			headers: {},
		});

		expect(match).toEqual({ type: 'transform', rule, action: rule.actions[0] });
	});

	test('corresponde metodo ANY sem fabricar metodo ausente', () => {
		const rule = baseRule({
			matchers: [
				{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
				{ type: 'method', enabled: true, method: 'ANY' },
			],
			actions: [{ type: 'breakpoint', enabled: true }],
		});

		expect(
			findMatchingRuleAction([rule], {
				url: 'https://example.test/api',
				method: 'OPTIONS',
				headers: {},
			}),
		).toEqual({ type: 'breakpoint', rule, action: rule.actions[0] });
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
			actions: [{ type: 'breakpoint', enabled: true }],
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
			findMatchingRuleAction([baseRule({ actions: [{ type: 'breakpoint', enabled: false }] })], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			}),
		).toBeUndefined();
	});

	describe('prioridade de matching (primeira que casa vence)', () => {
		test('quando duas regras casam o mesmo request, retorna apenas a primeira', () => {
			const first = baseRule({
				id: 'first',
				name: 'first',
				actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
			});
			const second = baseRule({
				id: 'second',
				name: 'second',
				actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
			});

			const match = findMatchingRuleAction([first, second], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			});

			expect(match?.rule.id).toBe('first');
			expect(match?.type).toBe('mock');
			expect(match?.type === 'mock' && match.action.status).toBe(200);
		});

		test('regra mock antes de breakpoint: mock vence mesmo com breakpoint casando depois', () => {
			const mockRule = baseRule({
				id: 'mock-rule',
				actions: [{ type: 'mock', enabled: true, status: 418, headers: {} }],
			});
			const breakpointRule = baseRule({
				id: 'breakpoint-rule',
				actions: [{ type: 'breakpoint', enabled: true }],
			});

			const match = findMatchingRuleAction([mockRule, breakpointRule], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			});

			expect(match?.type).toBe('mock');
			expect(match?.rule.id).toBe('mock-rule');
		});

		test('regra breakpoint antes de mock: breakpoint vence mesmo com mock casando depois', () => {
			const breakpointRule = baseRule({
				id: 'breakpoint-rule',
				actions: [{ type: 'breakpoint', enabled: true }],
			});
			const mockRule = baseRule({
				id: 'mock-rule',
				actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
			});

			const match = findMatchingRuleAction([breakpointRule, mockRule], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			});

			expect(match?.type).toBe('breakpoint');
			expect(match?.rule.id).toBe('breakpoint-rule');
		});

		test('reordenar o array muda quem vence sem alterar nada nas matchers', () => {
			const ruleA = baseRule({
				id: 'rule-a',
				actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
			});
			const ruleB = baseRule({
				id: 'rule-b',
				actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
			});

			expect(
				findMatchingRuleAction([ruleA, ruleB], {
					url: 'https://example.test/api/users',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-a');

			expect(
				findMatchingRuleAction([ruleB, ruleA], {
					url: 'https://example.test/api/users',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-b');
		});

		test('regra desabilitada nao bloqueia regra subsequente que casa', () => {
			const disabledFirst = baseRule({
				id: 'disabled-first',
				enabled: false,
				actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
			});
			const enabledSecond = baseRule({
				id: 'enabled-second',
				actions: [{ type: 'mock', enabled: true, status: 500, headers: {} }],
			});

			const match = findMatchingRuleAction([disabledFirst, enabledSecond], {
				url: 'https://example.test/api/users',
				method: 'GET',
				headers: {},
			});

			expect(match?.rule.id).toBe('enabled-second');
			expect(match?.type === 'mock' && match.action.status).toBe(500);
		});
	});

	describe('matcher de URL com wildcards', () => {
		test('padrao com `*` casa qualquer sequencia de caracteres', () => {
			const rule = baseRule({
				matchers: [{ type: 'url', enabled: true, pattern: '/api/users/*', isRegex: false }],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/users/42',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/users/42/posts',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/teams/42',
					method: 'GET',
					headers: {},
				}),
			).toBeUndefined();
		});

		test('padrao com varios `*` casa entre segmentos', () => {
			const rule = baseRule({
				matchers: [{ type: 'url', enabled: true, pattern: '/api/*/posts/*', isRegex: false }],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/users/posts/100',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/users/comments/100',
					method: 'GET',
					headers: {},
				}),
			).toBeUndefined();
		});

		test('padrao sem wildcard mantem comportamento de includes', () => {
			const rule = baseRule({
				matchers: [{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false }],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/users/42',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
		});

		test('caracteres regex especiais no padrao com wildcard sao escapados', () => {
			const rule = baseRule({
				matchers: [{ type: 'url', enabled: true, pattern: '/api/v1.0/*', isRegex: false }],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/v1.0/users',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
			// `.` literal nao casa qualquer caractere
			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api/v1X0/users',
					method: 'GET',
					headers: {},
				}),
			).toBeUndefined();
		});
	});

	describe('matcher de metodo com multi-select', () => {
		test('array com multiplos metodos casa qualquer um deles', () => {
			const rule = baseRule({
				matchers: [
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: ['GET', 'POST'] },
				],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api',
					method: 'GET',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api',
					method: 'POST',
					headers: {},
				})?.rule.id,
			).toBe('rule-1');
			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api',
					method: 'PUT',
					headers: {},
				}),
			).toBeUndefined();
		});

		test('array vazio nao casa nenhum metodo', () => {
			const rule = baseRule({
				matchers: [
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: [] },
				],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api',
					method: 'GET',
					headers: {},
				}),
			).toBeUndefined();
		});

		test('array com ANY casa qualquer metodo', () => {
			const rule = baseRule({
				matchers: [
					{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method', enabled: true, method: ['ANY'] },
				],
			});

			expect(
				findMatchingRuleAction([rule], {
					url: 'https://example.test/api',
					method: 'PATCH',
					headers: {},
				})?.type,
			).toBe('breakpoint');
		});
	});
});

describe('explainMatchers', () => {
	test('retorna check pass=true para URL com wildcard que casa', () => {
		const matchers: Matcher[] = [
			{ type: 'url', enabled: true, pattern: '/api/users/*', isRegex: false },
		];
		const result = explainMatchers(matchers, {
			url: 'https://example.test/api/users/42',
			method: 'GET',
			headers: {},
		});
		expect(result.overall).toBe(true);
		expect(result.checks).toHaveLength(1);
		expect(result.checks[0].pass).toBe(true);
		expect(result.checks[0].outcome).toBe('match');
	});

	test('retorna check pass=false quando URL não casa', () => {
		const matchers: Matcher[] = [
			{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false },
		];
		const result = explainMatchers(matchers, {
			url: 'https://example.test/admin',
			method: 'GET',
			headers: {},
		});
		expect(result.overall).toBe(false);
		expect(result.checks[0].pass).toBe(false);
		expect(result.checks[0].outcome).toBe('noMatch');
	});

	test('matcher desabilitado é reportado como ignorado e não bloqueia overall', () => {
		const matchers: Matcher[] = [
			{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
			{ type: 'method', enabled: false, method: 'POST' },
		];
		const result = explainMatchers(matchers, {
			url: 'https://example.test/api',
			method: 'GET',
			headers: {},
		});
		expect(result.overall).toBe(true);
		expect(result.checks[1].outcome).toBe('disabled');
	});

	test('URL pattern vazio é reportado com mensagem específica', () => {
		const matchers: Matcher[] = [{ type: 'url', enabled: true, pattern: '', isRegex: false }];
		const result = explainMatchers(matchers, {
			url: 'https://example.test/api',
			method: 'GET',
			headers: {},
		});
		expect(result.overall).toBe(false);
		expect(result.checks[0].outcome).toBe('emptyPattern');
	});

	test('multi-method com array contendo o método de teste retorna pass', () => {
		const matchers: Matcher[] = [
			{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
			{ type: 'method', enabled: true, method: ['GET', 'POST'] },
		];
		const result = explainMatchers(matchers, {
			url: 'https://example.test/api',
			method: 'POST',
			headers: {},
		});
		expect(result.overall).toBe(true);
	});

	test('lista vazia retorna overall=false (precisa de ao menos um matcher)', () => {
		const result = explainMatchers([], {
			url: 'https://example.test/api',
			method: 'GET',
			headers: {},
		});
		expect(result.overall).toBe(false);
		expect(result.checks).toHaveLength(0);
	});
});

const chainRule = (
	id: string,
	actions: Action[],
	stage: RuleStage = 'response',
	matchers: Matcher[] = [{ type: 'url', enabled: true, pattern: '/api', isRegex: false }],
): Rule => ({
	id,
	name: id,
	enabled: true,
	stage,
	matchers,
	actions,
	createdAt: 0,
	updatedAt: 0,
});

describe('findMatchingRulesChain', () => {
	test('chain vazio quando nenhuma regra casa', () => {
		const rule = chainRule('r1', [{ type: 'breakpoint', enabled: true }]);
		const chain = findMatchingRulesChain([rule], 'response', {
			url: 'https://x.test/no-match',
			method: 'GET',
			headers: {},
		});
		expect(chain).toEqual([]);
	});

	test('chain inclui apenas regras do stage solicitado', () => {
		const reqRule = chainRule(
			'r-req',
			[{ type: 'requestModify', enabled: true, addHeaders: { x: '1' } }],
			'request',
		);
		const resRule = chainRule(
			'r-res',
			[{ type: 'responseModify', enabled: true, setHeaders: { y: '2' } }],
			'response',
		);
		const input = { url: 'https://x.test/api', method: 'GET', headers: {} };
		expect(
			findMatchingRulesChain([reqRule, resRule], 'request', input).map((m) => m.rule.id),
		).toEqual(['r-req']);
		expect(
			findMatchingRulesChain([reqRule, resRule], 'response', input).map((m) => m.rule.id),
		).toEqual(['r-res']);
	});

	test('chain ordena na mesma ordem do array `rules`', () => {
		const r1 = chainRule(
			'r1',
			[{ type: 'requestModify', enabled: true, addHeaders: { a: '1' } }],
			'request',
		);
		const r2 = chainRule(
			'r2',
			[{ type: 'requestModify', enabled: true, addHeaders: { b: '2' } }],
			'request',
		);
		const r3 = chainRule(
			'r3',
			[{ type: 'requestModify', enabled: true, addHeaders: { c: '3' } }],
			'request',
		);
		const chain = findMatchingRulesChain([r1, r2, r3], 'request', {
			url: 'https://x.test/api',
			method: 'GET',
			headers: {},
		});
		expect(chain.map((m) => m.rule.id)).toEqual(['r1', 'r2', 'r3']);
	});

	test('chain corta após regra com ação terminal (block/mock/breakpoint)', () => {
		const modify = chainRule(
			'r-mod',
			[{ type: 'requestModify', enabled: true, addHeaders: { x: '1' } }],
			'request',
		);
		const block = chainRule(
			'r-block',
			[{ type: 'block', enabled: true, errorReason: 'Failed' }],
			'request',
		);
		const after = chainRule(
			'r-after',
			[{ type: 'requestModify', enabled: true, addHeaders: { y: '2' } }],
			'request',
		);
		const chain = findMatchingRulesChain([modify, block, after], 'request', {
			url: 'https://x.test/api',
			method: 'GET',
			headers: {},
		});
		expect(chain.map((m) => m.rule.id)).toEqual(['r-mod', 'r-block']);
	});

	test('chain ignora regras com enabled=false', () => {
		const r1 = chainRule(
			'r1',
			[{ type: 'requestModify', enabled: true, addHeaders: { a: '1' } }],
			'request',
		);
		const r2 = {
			...chainRule(
				'r2',
				[{ type: 'requestModify', enabled: true, addHeaders: { b: '2' } }],
				'request',
			),
			enabled: false,
		};
		const r3 = chainRule(
			'r3',
			[{ type: 'requestModify', enabled: true, addHeaders: { c: '3' } }],
			'request',
		);
		const chain = findMatchingRulesChain([r1, r2, r3], 'request', {
			url: 'https://x.test/api',
			method: 'GET',
			headers: {},
		});
		expect(chain.map((m) => m.rule.id)).toEqual(['r1', 'r3']);
	});

	test('chain só retorna actions enabled=true de cada regra', () => {
		const r1 = chainRule(
			'r1',
			[
				{ type: 'requestModify', enabled: false, addHeaders: { a: '1' } },
				{ type: 'requestDelay', enabled: true, timeMs: 100 },
			],
			'request',
		);
		const chain = findMatchingRulesChain([r1], 'request', {
			url: 'https://x.test/api',
			method: 'GET',
			headers: {},
		});
		expect(chain).toHaveLength(1);
		expect(chain[0].actions.map((a) => a.type)).toEqual(['requestDelay']);
	});

	test('chain pula regras com matchers inválidos para o stage', () => {
		const invalid = chainRule(
			'r-invalid',
			[{ type: 'requestModify', enabled: true, addHeaders: { x: '1' } }],
			'request',
			[
				{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
				{
					type: 'header',
					enabled: true,
					name: 'X-Foo',
					value: 'bar',
					headerType: 'response',
				},
			],
		);
		const chain = findMatchingRulesChain([invalid], 'request', {
			url: 'https://x.test/api',
			method: 'GET',
			headers: { 'X-Foo': 'bar' },
		});
		expect(chain).toEqual([]);
	});

	test('matcher header.headerType=response casa em stage=response quando header presente', () => {
		const rule = chainRule(
			'r1',
			[{ type: 'responseModify', enabled: true, setHeaders: { x: 'v' } }],
			'response',
			[
				{
					type: 'header',
					enabled: true,
					name: 'X-Foo',
					value: 'bar',
					headerType: 'response',
				},
			],
		);
		const chain = findMatchingRulesChain([rule], 'response', {
			url: 'https://x.test/api',
			method: 'GET',
			headers: { 'X-Foo': 'bar' },
		});
		expect(chain).toHaveLength(1);
	});

	test('matcher body usa input.body (engine injeta postData em req, response body em res)', () => {
		const rule = chainRule(
			'r1',
			[{ type: 'requestModify', enabled: true, addHeaders: { z: 'z' } }],
			'request',
			[
				{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
				{ type: 'body', enabled: true, pattern: 'magic', isRegex: false },
			],
		);
		const matched = findMatchingRulesChain([rule], 'request', {
			url: 'https://x.test/api',
			method: 'POST',
			headers: {},
			body: 'has magic word',
		});
		const unmatched = findMatchingRulesChain([rule], 'request', {
			url: 'https://x.test/api',
			method: 'POST',
			headers: {},
			body: 'no match here',
		});
		expect(matched).toHaveLength(1);
		expect(unmatched).toEqual([]);
	});
});

describe('validateMatchersForStage', () => {
	test('ok quando todos os matchers são válidos para o stage', () => {
		const result = validateMatchersForStage(
			[
				{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			'request',
		);
		expect(result).toEqual({ ok: true });
	});

	test('rejeita header.headerType=response em stage=request', () => {
		const result = validateMatchersForStage(
			[
				{
					type: 'header',
					enabled: true,
					name: 'X-Foo',
					value: 'bar',
					headerType: 'response',
				},
			],
			'request',
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].reason).toMatch(/headerType='response'/);
	});

	test('aceita header.headerType=response em stage=response', () => {
		const result = validateMatchersForStage(
			[
				{
					type: 'header',
					enabled: true,
					name: 'X-Foo',
					value: 'bar',
					headerType: 'response',
				},
			],
			'response',
		);
		expect(result).toEqual({ ok: true });
	});
});
