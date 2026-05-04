import { describe, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { extractBackgroundSignals, parseSetCookieHeader } from '../bgSignals';

function intercepted(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/path',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'document',
		timestamp: Date.now(),
		...overrides,
	};
}

describe('extractBackgroundSignals — url kind dispatch by resourceType', () => {
	test('document → url signal', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'document' }));
		expect(sigs.find((s) => s.kind === 'url')).toBeDefined();
		expect(sigs.find((s) => s.kind === 'scriptSrc')).toBeUndefined();
	});

	test('script → scriptSrc signal', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'script' }));
		expect(sigs.find((s) => s.kind === 'scriptSrc')).toBeDefined();
		expect(sigs.find((s) => s.kind === 'url')).toBeUndefined();
	});

	test('xhr → xhr signal', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'xhr' }));
		expect(sigs.find((s) => s.kind === 'xhr')).toBeDefined();
	});

	test('fetch → xhr signal (treated equivalently)', () => {
		const sigs = extractBackgroundSignals(intercepted({ type: 'fetch' }));
		expect(sigs.find((s) => s.kind === 'xhr')).toBeDefined();
	});

	test('image/stylesheet/font/media → no url-kind signal', () => {
		for (const t of ['image', 'stylesheet', 'font', 'media', 'other']) {
			const sigs = extractBackgroundSignals(intercepted({ type: t }));
			expect(sigs.find((s) => ['url', 'scriptSrc', 'xhr'].includes(s.kind))).toBeUndefined();
		}
	});
});

describe('extractBackgroundSignals — headers', () => {
	test('emits header signals with lowercased names', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'X-Powered-By': 'PHP/8.1', Server: 'nginx/1.21' },
			}),
		);
		const headers = sigs.filter((s) => s.kind === 'header');
		expect(headers).toContainEqual({ kind: 'header', name: 'x-powered-by', value: 'PHP/8.1' });
		expect(headers).toContainEqual({ kind: 'header', name: 'server', value: 'nginx/1.21' });
	});

	test('prefers response.headers when both response.headers and headers present', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'X-Old': 'old' },
				response: { headers: { 'X-New': 'new' } },
			}),
		);
		const names = sigs.filter((s) => s.kind === 'header').map((s) => s.name);
		expect(names).toContain('x-new');
		expect(names).not.toContain('x-old');
	});
});

describe('extractBackgroundSignals — cookies', () => {
	test('emits cookie signals from set-cookie header', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'set-cookie': 'session=abc123; Path=/' },
			}),
		);
		expect(sigs).toContainEqual({ kind: 'cookie', name: 'session', value: 'abc123' });
	});

	test('handles Set-Cookie with title-case', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'Set-Cookie': 'session=abc123' },
			}),
		);
		expect(sigs.find((s) => s.kind === 'cookie' && s.name === 'session')).toBeDefined();
	});
});

describe('parseSetCookieHeader', () => {
	test('parses single cookie', () => {
		expect(parseSetCookieHeader('session=abc123; Path=/')).toEqual([
			{ name: 'session', value: 'abc123' },
		]);
	});

	test('parses multi-cookie joined by newline', () => {
		const raw = 'a=1; Path=/\nb=2; Secure';
		expect(parseSetCookieHeader(raw)).toEqual([
			{ name: 'a', value: '1' },
			{ name: 'b', value: '2' },
		]);
	});

	test('returns empty array for empty input', () => {
		expect(parseSetCookieHeader('')).toEqual([]);
	});

	test('skips malformed cookie without =', () => {
		expect(parseSetCookieHeader('flagonly')).toEqual([]);
	});

	test('returns empty value when set after =', () => {
		expect(parseSetCookieHeader('a=')).toEqual([{ name: 'a', value: '' }]);
	});
});
