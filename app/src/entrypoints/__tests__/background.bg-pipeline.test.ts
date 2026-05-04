import { describe, expect, test } from 'vitest';
import { COMPILED_CATALOG } from '@/lib/insights/catalog';
import { extractBackgroundSignals } from '@/lib/insights/bgSignals';
import { mergeHits } from '@/lib/insights/mergeHits';
import { Scorer } from '@/lib/insights/scorer';
import type { CompiledTech, TechHit } from '@/lib/insights/types';
import type { InterceptedResponse } from '@/types/intercepted';

const compiledByName = new Map<string, CompiledTech>(COMPILED_CATALOG.map((t) => [t.name, t]));

function intercepted(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'document',
		timestamp: Date.now(),
		...overrides,
	};
}

describe('bg pipeline integration — extractBackgroundSignals + Scorer', () => {
	test('PHP detection via X-Powered-By header', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { 'X-Powered-By': 'PHP/8.1.0' },
			}),
		);
		const scorer = new Scorer(COMPILED_CATALOG);
		scorer.pushSignals(sigs);
		const techs = scorer.snapshot();
		expect(techs.find((t) => t.name === 'PHP')).toBeDefined();
	});

	test('Cloudflare detection via Server header', () => {
		const sigs = extractBackgroundSignals(
			intercepted({
				type: 'document',
				headers: { Server: 'cloudflare', 'CF-RAY': 'abc-XXX' },
			}),
		);
		const scorer = new Scorer(COMPILED_CATALOG);
		scorer.pushSignals(sigs);
		const techs = scorer.snapshot();
		expect(techs.find((t) => t.name === 'Cloudflare')).toBeDefined();
	});

	test('image resourceType produces no url-kind signal', () => {
		const sigs = extractBackgroundSignals(
			intercepted({ type: 'image', url: 'https://example.com/foo.png' }),
		);
		expect(sigs.find((s) => s.kind === 'url')).toBeUndefined();
		expect(sigs.find((s) => s.kind === 'scriptSrc')).toBeUndefined();
	});
});

describe('bg pipeline integration — mergeHits with implications', () => {
	test('merges probe-emitted techs with bg-detected techs and applies implies', () => {
		const probeTechs: TechHit[] = [
			{ name: 'WordPress', cats: [1, 11], confidence: 100, evidence: [] },
		];
		const bgTechs: TechHit[] = [{ name: 'Cloudflare', cats: [31], confidence: 50, evidence: [] }];
		const merged = mergeHits(probeTechs, bgTechs, compiledByName);
		const names = merged.map((h) => h.name).sort();
		// WordPress + Cloudflare detectados; PHP implicado por WordPress
		expect(names).toContain('WordPress');
		expect(names).toContain('Cloudflare');
		expect(names).toContain('PHP'); // implies de WordPress
	});

	test('does not duplicate hit when probe and bg both detect same tech', () => {
		const probeTechs: TechHit[] = [
			{ name: 'WordPress', cats: [1, 11], confidence: 60, evidence: [] },
		];
		const bgTechs: TechHit[] = [{ name: 'WordPress', cats: [1, 11], confidence: 50, evidence: [] }];
		const merged = mergeHits(probeTechs, bgTechs, compiledByName);
		const wp = merged.filter((h) => h.name === 'WordPress');
		expect(wp).toHaveLength(1);
		expect(wp[0].confidence).toBe(100); // 60+50=110 capa em 100
	});
});
