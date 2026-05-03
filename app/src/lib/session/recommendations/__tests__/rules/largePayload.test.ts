import { describe, expect, test } from 'vitest';
import { largePayloadRule } from '../../rules/largePayload';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api/data',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-length': String(2 * 1024 * 1024) },
	...overrides,
});

describe('large-payload rule', () => {
	test('dispara em payload > 1 MB sem paginação', () => {
		const r = largePayloadRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('info');
	});

	test('não dispara quando query tem ?page=', () => {
		const r = largePayloadRule.rule(ev({ url: 'https://example.com/api/data?page=1' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('não dispara quando query tem ?cursor=', () => {
		const r = largePayloadRule.rule(ev({ url: 'https://example.com/api/data?cursor=abc' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('não dispara abaixo de 1 MB', () => {
		const r = largePayloadRule.rule(ev({ responseHeaders: { 'content-length': '1024' } }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
