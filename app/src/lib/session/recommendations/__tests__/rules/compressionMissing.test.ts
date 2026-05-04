import { describe, expect, test } from 'vitest';
import { compressionMissingRule } from '../../rules/compressionMissing';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/api',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-type': 'application/json', 'content-length': '5000' },
	...overrides,
});

describe('compression-missing rule', () => {
	test('dispara quando JSON > 1KB sem content-encoding', () => {
		const r = compressionMissingRule.rule(ev(), { topFrameUrl: null });
		expect(r).not.toBeNull();
		expect(r?.severity).toBe('warn');
		expect(r?.evidence['content-encoding']).toBe('absent');
	});

	test('não dispara quando há gzip', () => {
		const r = compressionMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'application/json', 'content-length': '5000', 'content-encoding': 'gzip' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em image/png', () => {
		const r = compressionMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'image/png', 'content-length': '5000' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em payload exatamente 1024 bytes (limite inclusivo)', () => {
		const r = compressionMissingRule.rule(
			ev({ responseHeaders: { 'content-type': 'application/json', 'content-length': '1024' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara em status != 200', () => {
		const r = compressionMissingRule.rule(
			ev({ status: 304, responseHeaders: { 'content-type': 'application/json', 'content-length': '5000' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});
});
