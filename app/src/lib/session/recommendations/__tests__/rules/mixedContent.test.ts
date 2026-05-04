import { describe, expect, test } from 'vitest';
import { mixedContentRule } from '../../rules/mixedContent';
import type { NetworkRuleEvent } from '../../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'http://insecure.example.com/img.png',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

describe('mixed-content rule', () => {
	test('dispara quando page é HTTPS e subresource é HTTP', () => {
		const r = mixedContentRule.rule(ev(), { topFrameUrl: 'https://example.com' });
		expect(r?.severity).toBe('error');
	});

	test('não dispara quando page é HTTP', () => {
		const r = mixedContentRule.rule(ev(), { topFrameUrl: 'http://example.com' });
		expect(r).toBeNull();
	});

	test('não dispara quando subresource é HTTPS', () => {
		const r = mixedContentRule.rule(ev({ url: 'https://x.com/img' }), { topFrameUrl: 'https://example.com' });
		expect(r).toBeNull();
	});

	test('não dispara quando topFrameUrl é null', () => {
		const r = mixedContentRule.rule(ev(), { topFrameUrl: null });
		expect(r).toBeNull();
	});

	test('ignora data: e blob:', () => {
		const r1 = mixedContentRule.rule(ev({ url: 'data:image/png;base64,iVBOR' }), { topFrameUrl: 'https://x.com' });
		const r2 = mixedContentRule.rule(ev({ url: 'blob:https://x.com/abc' }), { topFrameUrl: 'https://x.com' });
		expect(r1).toBeNull();
		expect(r2).toBeNull();
	});
});
