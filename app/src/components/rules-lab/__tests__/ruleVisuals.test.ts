import { describe, expect, test } from 'vitest';
import type { Action, Matcher } from '@/types/rules';
import { getActionSummary, getActionVisuals, getMatcherSummary } from '../ruleVisuals';

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
