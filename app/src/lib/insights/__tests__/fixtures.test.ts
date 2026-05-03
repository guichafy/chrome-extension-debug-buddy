import { describe, expect, test } from 'vitest';
import { COMPILED_CATALOG } from '../catalog';
import { Scorer } from '../scorer';
import type { Signal } from '../types';
import wordpressFixture from './fixtures/wordpress.json';

interface Fixture {
	signals: Signal[];
	expectedHits: string[];
}

function runFixture(fixture: Fixture): string[] {
	const s = new Scorer(COMPILED_CATALOG);
	s.pushSignals(fixture.signals);
	return s.snapshot().map((h) => h.name).sort();
}

describe('fixtures — WordPress', () => {
	test('detects WordPress and implies PHP', () => {
		const detected = runFixture(wordpressFixture as Fixture);
		for (const expected of (wordpressFixture as Fixture).expectedHits) {
			expect(detected).toContain(expected);
		}
	});
});
