import { describe, expect, test } from 'vitest';
import { cacheMissingRule } from '../../rules/cacheMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/static/app.js',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('cache-missing rule', () => {
	test('dispara em .js sem cache-control', () => {
		const r = cacheMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r?.severity).toBe('info');
		expect(r?.evidence['cache-control']).toBe('absent');
	});

	test('dispara em .css com no-store', () => {
		const r = cacheMissingRule.rule(
			ev({ url: 'https://example.com/style.css', responseHeaders: { 'cache-control': 'no-store' } }),
			{ topFrameUrl: null },
		);
		expect(r?.evidence['cache-control']).toContain('no-store');
	});

	test('não dispara com cache-control immutable', () => {
		const r = cacheMissingRule.rule(
			ev({ responseHeaders: { 'cache-control': 'public, max-age=31536000, immutable' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em rota não-estática', () => {
		const r = cacheMissingRule.rule(ev({ url: 'https://example.com/api/users' }), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('detecta extensões com query string', () => {
		const r = cacheMissingRule.rule(ev({ url: 'https://example.com/app.js?v=123' }), { topFrameUrl: null });
		expect(r).not.toBeNull();
	});
});
