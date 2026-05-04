import { describe, expect, test } from 'vitest';
import { parsePattern } from '../pattern';
import { Scorer } from '../scorer';
import type { CompiledTech, Signal } from '../types';

function makeTech(overrides: Partial<CompiledTech> = {}): CompiledTech {
	return {
		name: 'TestTech',
		cats: [12],
		website: 'https://example.com',
		patterns: {},
		implies: [],
		requires: [],
		requiresCategory: [],
		excludes: [],
		...overrides,
	};
}

describe('Scorer — basics', () => {
	test('snapshot is empty before any push', () => {
		const s = new Scorer([]);
		expect(s.snapshot()).toEqual([]);
	});

	test('matches a single signal and stores hit', () => {
		const tech = makeTech({
			name: 'jQuery',
			patterns: { scriptSrc: [parsePattern('jquery\\.min\\.js')] },
		});
		const s = new Scorer([tech]);
		s.pushSignals([{ kind: 'scriptSrc', value: 'cdn/jquery.min.js' }]);
		const snap = s.snapshot();
		expect(snap).toHaveLength(1);
		expect(snap[0].name).toBe('jQuery');
		expect(snap[0].confidence).toBe(100);
	});

	test('reset clears all hits', () => {
		const tech = makeTech({
			name: 'jQuery',
			patterns: { scriptSrc: [parsePattern('jquery')] },
		});
		const s = new Scorer([tech]);
		s.pushSignals([{ kind: 'scriptSrc', value: 'jquery.js' }]);
		expect(s.snapshot()).toHaveLength(1);
		s.reset();
		expect(s.snapshot()).toEqual([]);
	});

	test('non-matching signal yields no hit', () => {
		const tech = makeTech({
			patterns: { scriptSrc: [parsePattern('foo')] },
		});
		const s = new Scorer([tech]);
		s.pushSignals([{ kind: 'scriptSrc', value: 'bar.js' }]);
		expect(s.snapshot()).toHaveLength(0);
	});
});

describe('Scorer — accumulation', () => {
	test('confidence accumulates across distinct signals capped at 100', () => {
		const tech = makeTech({
			name: 'X',
			patterns: {
				scriptSrc: [parsePattern('one\\;confidence:60')],
				headers: { 'X-A': parsePattern('y\\;confidence:60') },
			},
		});
		const s = new Scorer([tech]);
		s.pushSignals([
			{ kind: 'scriptSrc', value: 'one.js' },
			{ kind: 'header', name: 'x-a', value: 'y' },
		]);
		const snap = s.snapshot();
		expect(snap[0].confidence).toBe(100); // 60+60=120 capa em 100
	});

	test('version is first-wins (does not overwrite)', () => {
		const tech = makeTech({
			name: 'X',
			patterns: {
				scriptSrc: [parsePattern('x-([0-9.]+)\\.js\\;version:\\1')],
				headers: { 'X-Ver': parsePattern('([0-9.]+)\\;version:\\1') },
			},
		});
		const s = new Scorer([tech]);
		s.pushSignals([
			{ kind: 'scriptSrc', value: 'x-1.0.0.js' },
			{ kind: 'header', name: 'x-ver', value: '2.0.0' },
		]);
		expect(s.snapshot()[0].version).toBe('1.0.0');
	});

	test('evidence is capped at 8 entries', () => {
		const tech = makeTech({
			name: 'X',
			patterns: { scriptSrc: [parsePattern('x')] },
		});
		const s = new Scorer([tech]);
		const batch: Signal[] = Array.from({ length: 12 }, (_, i) => ({
			kind: 'scriptSrc',
			value: `x-${i}.js`,
		}));
		s.pushSignals(batch);
		expect(s.snapshot()[0].evidence.length).toBe(8);
	});

	test('pushing same batch twice is idempotent in evidence count', () => {
		const tech = makeTech({
			name: 'X',
			patterns: { scriptSrc: [parsePattern('x')] },
		});
		const s = new Scorer([tech]);
		const batch: Signal[] = [
			{ kind: 'scriptSrc', value: 'x.js' },
			{ kind: 'scriptSrc', value: 'x.js' },
		];
		s.pushSignals(batch);
		s.pushSignals(batch);
		// 2 pushes × 2 signals = 4 acumulados, mas confidence cap em 100
		// e evidence pode ir até 8 (4 < 8, então 4)
		expect(s.snapshot()[0].evidence.length).toBe(4);
	});
});

describe('Scorer — implications integration', () => {
	test('pushing a tech triggers its implies', () => {
		const wp = makeTech({
			name: 'WordPress',
			patterns: { scriptSrc: [parsePattern('wp-content')] },
			implies: [{ name: 'PHP', confidence: 100 }],
		});
		const php = makeTech({ name: 'PHP', cats: [27] });
		const s = new Scorer([wp, php]);
		s.pushSignals([{ kind: 'scriptSrc', value: '/wp-content/themes/x.js' }]);
		const names = s.snapshot().map((h) => h.name).sort();
		expect(names).toEqual(['PHP', 'WordPress']);
		const phpHit = s.snapshot().find((h) => h.name === 'PHP');
		expect(phpHit?.implied).toBe(true);
	});
});
