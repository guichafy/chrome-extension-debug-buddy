import { describe, expect, test } from 'vitest';
import { cspMissingRule } from '../../rules/cspMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/index.html',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-type': 'text/html; charset=utf-8' },
	...overrides,
});

describe('csp-missing rule', () => {
	test('dispara em HTML 200 sem CSP', () => {
		const r = cspMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('error');
	});

	test('não dispara com content-security-policy presente', () => {
		const r = cspMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'" } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara com report-only', () => {
		const r = cspMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'text/html', 'content-security-policy-report-only': "default-src 'self'" } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em response não-HTML', () => {
		const r = cspMissingRule.rule(ev({ responseHeaders: { 'content-type': 'application/json' } }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('não dispara em status != 200', () => {
		const r = cspMissingRule.rule(ev({ status: 404 }), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
