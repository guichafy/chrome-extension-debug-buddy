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
