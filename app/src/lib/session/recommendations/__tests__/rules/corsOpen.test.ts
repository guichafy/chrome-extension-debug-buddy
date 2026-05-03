import { describe, expect, test } from 'vitest';
import { corsOpenRule } from '../../rules/corsOpen';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://api.example.com/users',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'access-control-allow-origin': '*' },
	...overrides,
});

describe('cors-open rule', () => {
	test('dispara em ACAO=*', () => {
		const r = corsOpenRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('warn');
	});

	test('não dispara em ACAO=* com credentials=true (combinação inválida; o navegador rejeita)', () => {
		const r = corsOpenRule.rule(
			ev({ responseHeaders: { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em ACAO restrito', () => {
		const r = corsOpenRule.rule(
			ev({ responseHeaders: { 'access-control-allow-origin': 'https://app.example.com' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara sem header CORS', () => {
		const r = corsOpenRule.rule(ev({ responseHeaders: {} }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
