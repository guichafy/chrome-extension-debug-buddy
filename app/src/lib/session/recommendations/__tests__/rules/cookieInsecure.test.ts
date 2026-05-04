import { describe, expect, test } from 'vitest';
import { cookieInsecureRule } from '../../rules/cookieInsecure';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api/login',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('cookie-insecure rule', () => {
	test('dispara em HTTPS com cookie sem Secure', () => {
		const r = cookieInsecureRule.rule(
			ev({ responseHeaders: { 'set-cookie': 'sid=abc; HttpOnly; Path=/' } }),
			{ topFrameUrl: null },
		);
		expect(r?.severity).toBe('error');
		expect(r?.evidence.missing).toContain('Secure');
	});

	test('dispara em HTTP com cookie sem HttpOnly', () => {
		const r = cookieInsecureRule.rule(
			ev({ url: 'http://example.com/api', responseHeaders: { 'set-cookie': 'sid=abc; Path=/' } }),
			{ topFrameUrl: null },
		);
		expect(r?.evidence.missing).toContain('HttpOnly');
	});

	test('não dispara com Secure;HttpOnly em HTTPS', () => {
		const r = cookieInsecureRule.rule(
			ev({ responseHeaders: { 'set-cookie': 'sid=abc; Secure; HttpOnly; Path=/' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara sem set-cookie', () => {
		const r = cookieInsecureRule.rule(ev(), { topFrameUrl: null });
		expect(r).toBeNull();
	});
});
