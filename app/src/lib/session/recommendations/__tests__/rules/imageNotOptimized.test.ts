import { describe, expect, test } from 'vitest';
import { imageNotOptimizedRule } from '../../rules/imageNotOptimized';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://example.com/photo.png',
	status: 200,
	requestHeaders: {},
	responseHeaders: { 'content-type': 'image/png', 'content-length': String(800 * 1024) },
	...overrides,
});

describe('image-not-optimized rule', () => {
	test('dispara em PNG > 500KB com accept webp', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ requestHeaders: { accept: 'image/webp,image/avif,*/*' } }),
			{ topFrameUrl: null },
		);
		expect(r?.severity).toBe('info');
		expect(r?.evidence.accept).toContain('webp');
	});

	test('dispara em JPEG > 500KB sem accept (evidence sinaliza absent)', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ url: 'https://example.com/p.jpg', responseHeaders: { 'content-type': 'image/jpeg', 'content-length': String(800 * 1024) } }),
			{ topFrameUrl: null },
		);
		expect(r).not.toBeNull();
		expect(r?.evidence.accept).toBe('absent');
	});

	test('não dispara em image/webp', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ responseHeaders: { 'content-type': 'image/webp', 'content-length': String(800 * 1024) } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});

	test('não dispara abaixo de 500KB', () => {
		const r = imageNotOptimizedRule.rule(
			ev({ responseHeaders: { 'content-type': 'image/png', 'content-length': '102400' } }),
			{ topFrameUrl: null },
		);
		expect(r).toBeNull();
	});
});
