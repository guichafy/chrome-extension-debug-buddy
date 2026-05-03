import { describe, expect, test } from 'vitest';
import { hstsMissingRule } from '../../rules/hstsMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('hsts-missing rule', () => {
	test('dispara em HTTPS sem strict-transport-security', () => {
		const r = hstsMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('error');
	});

	test('não dispara com strict-transport-security presente', () => {
		const r = hstsMissingRule.rule(
			ev({ responseHeaders: { 'strict-transport-security': 'max-age=31536000' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em URL HTTP', () => {
		const r = hstsMissingRule.rule(ev({ url: 'http://example.com/api' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
