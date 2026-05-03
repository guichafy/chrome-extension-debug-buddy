import { describe, expect, test } from 'vitest';
import { RecommendationEngine } from '../engine';
import type { NetworkRuleEvent, Rule, RuleDescriptor } from '../types';

const ev = (overrides: Partial<NetworkRuleEvent> = {}): NetworkRuleEvent => ({
	method: 'GET',
	url: 'https://api.example.com/users',
	status: 200,
	requestHeaders: {},
	responseHeaders: {},
	...overrides,
});

const alwaysHit: Rule = (ev) => ({
	ruleId: 'compression-missing',
	severity: 'warn',
	url: ev.url,
	host: new URL(ev.url).host,
	summary: 'always',
	evidence: {},
});

const desc: RuleDescriptor = { id: 'compression-missing', rule: alwaysHit };

describe('RecommendationEngine', () => {
	test('emite hit com id e timestamp na primeira ocorrência', () => {
		const engine = new RecommendationEngine([desc]);
		const result = engine.pushResponse(ev(), { topFrameUrl: null });
		expect(result).toHaveLength(1);
		expect(result[0].id).toMatch(/^[0-9a-f-]+$/i);
		expect(result[0].timestamp).toBeGreaterThan(0);
		expect(result[0].ruleId).toBe('compression-missing');
	});

	test('dedup por (ruleId|host|pathname) — mesma URL não repete', () => {
		const engine = new RecommendationEngine([desc]);
		engine.pushResponse(ev(), { topFrameUrl: null });
		const second = engine.pushResponse(ev(), { topFrameUrl: null });
		expect(second).toEqual([]);
	});

	test('mesmo path em hosts diferentes emite duas vezes', () => {
		const engine = new RecommendationEngine([desc]);
		const first = engine.pushResponse(ev({ url: 'https://a.com/api' }), { topFrameUrl: null });
		const second = engine.pushResponse(ev({ url: 'https://b.com/api' }), { topFrameUrl: null });
		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
	});

	test('reset() libera a dedup', () => {
		const engine = new RecommendationEngine([desc]);
		engine.pushResponse(ev(), { topFrameUrl: null });
		engine.reset();
		const second = engine.pushResponse(ev(), { topFrameUrl: null });
		expect(second).toHaveLength(1);
	});

	test('FIFO eviction quando excede 1000 entradas', () => {
		const engine = new RecommendationEngine([desc]);
		// preenche dedup com 1000 paths distintos
		for (let i = 0; i < 1000; i++) {
			engine.pushResponse(ev({ url: `https://api.example.com/p${i}` }), { topFrameUrl: null });
		}
		// path 0 ainda dedup
		expect(
			engine.pushResponse(ev({ url: 'https://api.example.com/p0' }), { topFrameUrl: null }),
		).toEqual([]);
		// adicionar o 1001-ésimo evicta o p0
		engine.pushResponse(ev({ url: 'https://api.example.com/p1000' }), { topFrameUrl: null });
		// agora p0 pode reemitir
		const reemit = engine.pushResponse(ev({ url: 'https://api.example.com/p0' }), {
			topFrameUrl: null,
		});
		expect(reemit).toHaveLength(1);
	});
});
