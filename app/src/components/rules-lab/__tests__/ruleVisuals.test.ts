import { describe, expect, test } from 'vitest';
import type { Action, Matcher, Rule } from '@/types/rules';
import {
	getActionSummary,
	getActionVisuals,
	getMatcherSummary,
	getRuleMethods,
} from '../ruleVisuals';

describe('getActionVisuals', () => {
	test.each([
		['mock', 'server-crash'],
		['delay', 'timer'],
		['transform', 'file-edit'],
		['breakpoint', 'octagon-alert'],
	])('retorna ícone certo para action %s', (type, iconName) => {
		const action = buildAction(type as Action['type']);
		expect(getActionVisuals(action).iconName).toBe(iconName);
	});

	test('lança para tipo de ação não suportado', () => {
		const bogus = { type: 'unknown', enabled: true } as unknown as Action;
		expect(() => getActionVisuals(bogus)).toThrow(/não suportado/);
	});
});

describe('getActionSummary', () => {
	test('mock com latência fixa inclui delay no resumo', () => {
		const summary = getActionSummary({
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: {},
			latency: { mode: 'fixed', delayMs: 1500 },
		});
		expect(summary).toContain('1500ms');
	});

	test('mock com latência range inclui faixa no resumo', () => {
		const summary = getActionSummary({
			type: 'mock',
			enabled: true,
			status: 200,
			headers: {},
			latency: { mode: 'range', minMs: 200, maxMs: 800 },
		});
		expect(summary).toContain('200–800ms');
	});

	test('delay action devolve "Atrasar Xms"', () => {
		expect(getActionSummary({ type: 'delay', enabled: true, timeMs: 750 })).toBe('Atrasar 750ms');
	});

	test('transform com operações declarativas mostra contagem', () => {
		expect(
			getActionSummary({
				type: 'transform',
				enabled: true,
				mode: 'declarative',
				operations: [
					{ id: 'a', type: 'replace', path: '$.x', value: '1' },
					{ id: 'b', type: 'remove', path: '$.y' },
				],
			}),
		).toBe('Transform · 2 operações');
	});

	test('transform com 1 operação usa singular', () => {
		expect(
			getActionSummary({
				type: 'transform',
				enabled: true,
				mode: 'declarative',
				operations: [{ id: 'a', type: 'replace', path: '$.x', value: '1' }],
			}),
		).toBe('Transform · 1 operação');
	});

	test('transform sem operações cai no resumo padrão', () => {
		expect(getActionSummary({ type: 'transform', enabled: true })).toBe('Transform resposta');
		expect(getActionSummary({ type: 'transform', enabled: true, status: 500 })).toBe(
			'Transform (status 500)',
		);
	});

	test('transform em modo avançado com script mostra "script avançado"', () => {
		expect(
			getActionSummary({
				type: 'transform',
				enabled: true,
				mode: 'advanced',
				advancedScript: 'return response;',
			}),
		).toBe('Transform · script avançado');
	});

	test('transform em modo avançado sem script mostra "script vazio"', () => {
		expect(
			getActionSummary({
				type: 'transform',
				enabled: true,
				mode: 'advanced',
				advancedScript: '',
			}),
		).toBe('Transform · script vazio');
		expect(
			getActionSummary({
				type: 'transform',
				enabled: true,
				mode: 'advanced',
			}),
		).toBe('Transform · script vazio');
	});

	test('breakpoint sem descrição', () => {
		expect(getActionSummary({ type: 'breakpoint', enabled: true })).toBe('Breakpoint');
	});

	test('breakpoint com descrição', () => {
		expect(getActionSummary({ type: 'breakpoint', enabled: true, description: 'pause auth' })).toBe(
			'Breakpoint — pause auth',
		);
	});
});

describe('getMatcherSummary', () => {
	test('combina método e URL quando ambos estão habilitados', () => {
		const matchers: Matcher[] = [
			{ type: 'method', enabled: true, method: 'POST' },
			{ type: 'url', enabled: true, pattern: '/api/login', isRegex: false },
		];
		expect(getMatcherSummary(matchers)).toBe('POST /api/login');
	});

	test('omite método ANY', () => {
		const matchers: Matcher[] = [
			{ type: 'method', enabled: true, method: 'ANY' },
			{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
		];
		expect(getMatcherSummary(matchers)).toBe('/api');
	});

	test('mostra "(qualquer URL)" quando pattern é vazio', () => {
		const matchers: Matcher[] = [{ type: 'url', enabled: true, pattern: '', isRegex: false }];
		expect(getMatcherSummary(matchers)).toBe('(qualquer URL)');
	});

	test('cai para descrição de header quando não há URL', () => {
		const matchers: Matcher[] = [
			{ type: 'header', enabled: true, name: 'authorization', value: '', headerType: 'request' },
		];
		expect(getMatcherSummary(matchers)).toContain('header authorization');
	});

	test('"Sem condições" se nenhum matcher está habilitado', () => {
		const matchers: Matcher[] = [{ type: 'url', enabled: false, pattern: '/x', isRegex: false }];
		expect(getMatcherSummary(matchers)).toBe('Sem condições');
	});
});

describe('getRuleMethods', () => {
	function buildRule(matchers: Matcher[]): Rule {
		return {
			id: 'r1',
			name: 'rule',
			enabled: true,
			matchers,
			action: { type: 'mock', enabled: true, status: 200, headers: {} },
			createdAt: 1,
			updatedAt: 1,
		};
	}

	test('retorna ["ANY"] quando não há MethodMatcher', () => {
		const rule = buildRule([{ type: 'url', enabled: true, pattern: '/x', isRegex: false }]);
		expect(getRuleMethods(rule)).toEqual(['ANY']);
	});

	test('retorna ["ANY"] quando MethodMatcher está desabilitado', () => {
		const rule = buildRule([{ type: 'method', enabled: false, method: 'GET' }]);
		expect(getRuleMethods(rule)).toEqual(['ANY']);
	});

	test('retorna método em UPPERCASE para MethodMatcher string', () => {
		const rule = buildRule([{ type: 'method', enabled: true, method: 'get' }]);
		expect(getRuleMethods(rule)).toEqual(['GET']);
	});

	test('expande array de métodos preservando ordem e dedupe', () => {
		const rule = buildRule([{ type: 'method', enabled: true, method: ['POST', 'PUT', 'POST'] }]);
		expect(getRuleMethods(rule)).toEqual(['POST', 'PUT']);
	});

	test('inclui ANY quando o matcher tem ANY explicitamente', () => {
		const rule = buildRule([{ type: 'method', enabled: true, method: ['ANY', 'GET'] }]);
		expect(getRuleMethods(rule)).toEqual(['ANY', 'GET']);
	});
});

function buildAction(type: Action['type']): Action {
	switch (type) {
		case 'mock':
			return { type: 'mock', enabled: true, status: 200, headers: {} };
		case 'delay':
			return { type: 'delay', enabled: true, timeMs: 100 };
		case 'transform':
			return { type: 'transform', enabled: true };
		case 'breakpoint':
			return { type: 'breakpoint', enabled: true };
	}
}
