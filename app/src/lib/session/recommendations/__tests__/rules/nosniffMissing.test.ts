import { describe, expect, test } from 'vitest';
import { nosniffMissingRule } from '../../rules/nosniffMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('nosniff-missing rule', () => {
	test('dispara em response sem x-content-type-options', () => {
		const r = nosniffMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('warn');
	});

	test('não dispara com nosniff presente', () => {
		const r = nosniffMissingRule.rule(
			ev({ responseHeaders: { 'x-content-type-options': 'nosniff' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em status != 200', () => {
		const r = nosniffMissingRule.rule(ev({ status: 304 }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
