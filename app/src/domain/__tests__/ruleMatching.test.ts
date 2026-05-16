import { describe, expect, test } from 'vitest';
import type { Matcher, Rule } from '../../types/rules';
import { explainMatchers, findMatchingRuleAction } from '../ruleMatching';

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
		expect(result.checks[0].reason).toContain('casa');
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
		expect(result.checks[1].reason).toContain('desabilitado');
	});

	test('URL pattern vazio é reportado com mensagem específica', () => {
		const matchers: Matcher[] = [{ type: 'url', enabled: true, pattern: '', isRegex: false }];
		const result = explainMatchers(matchers, {
			url: 'https://example.test/api',
			method: 'GET',
			headers: {},
		});
		expect(result.overall).toBe(false);
		expect(result.checks[0].reason).toContain('vazio');
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
