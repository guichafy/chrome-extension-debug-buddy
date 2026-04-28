import { describe, expect, test } from 'vitest';
import type { UrlMatcher } from '@/types/rules';
import { createPresetRule } from '../rulePresets';

const baseUrlMatcher: UrlMatcher = {
	type: 'url',
	enabled: true,
	pattern: 'api.example.com/data',
	isRegex: false,
};

describe('createPresetRule', () => {
	test('http_error_500 cria mock com status 500 e statusPhrase real', () => {
		const draft = createPresetRule('http_error_500');
		expect(draft.action).toMatchObject({
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
		});
	});

	test.each([
		['http_error_404', 404, 'Not Found'],
		['http_error_401', 401, 'Unauthorized'],
		['http_error_403', 403, 'Forbidden'],
	] as const)('%s gera status %d / phrase %s', (id, status, phrase) => {
		const draft = createPresetRule(id);
		expect(draft.action).toMatchObject({ type: 'mock', status, statusPhrase: phrase });
	});

	test('latency_fixed cria mock com latency mode=fixed', () => {
		const draft = createPresetRule('latency_fixed');
		expect(draft.action).toMatchObject({
			type: 'mock',
			latency: { mode: 'fixed', delayMs: 1000 },
		});
	});

	test('latency_range cria mock com latency mode=range', () => {
		const draft = createPresetRule('latency_range');
		expect(draft.action).toMatchObject({
			type: 'mock',
			latency: { mode: 'range', minMs: 500, maxMs: 2000 },
		});
	});

	test('empty_response cria mock com body vazio (não undefined)', () => {
		const draft = createPresetRule('empty_response');
		expect(draft.action).toMatchObject({ type: 'mock', body: '', status: 200 });
	});

	test('broken_json cria mock com body inválido sintaticamente e content-type json', () => {
		const draft = createPresetRule('broken_json');
		const action = draft.action;
		expect(action.type).toBe('mock');
		if (action.type !== 'mock') return;
		expect(action.contentType).toBe('application/json');
		expect(() => JSON.parse(action.body ?? '')).toThrow();
	});

	test('aceita baseMatcher e o coloca antes dos defaults', () => {
		const draft = createPresetRule('http_error_500', baseUrlMatcher);
		expect(draft.matchers[0]).toEqual(baseUrlMatcher);
	});

	test('sem baseMatcher gera matcher de URL vazio para o usuário preencher (mas marcado disabled para não dar match amplo)', () => {
		const draft = createPresetRule('http_error_500');
		const url = draft.matchers.find((m) => m.type === 'url');
		expect(url).toEqual({ type: 'url', enabled: false, pattern: '', isRegex: false });
	});
});
