import { describe, expect, it } from 'vitest';
import { pageDetectionsHaveSameTechs } from '../fingerprint';
import type { EnvironmentFingerprint, PageDetection } from '../types';

const fp = (): EnvironmentFingerprint => ({
	detectedAt: 0,
	isProductionBuild: false,
});

const page = (
	url: string,
	ts: number,
	techs: PageDetection['techs'] = [],
): PageDetection => ({
	url,
	timestamp: ts,
	fingerprint: fp(),
	triggerType: 'navigation',
	techs,
});

describe('pageDetectionsHaveSameTechs', () => {
	it('retorna true quando ambas não têm techs', () => {
		expect(pageDetectionsHaveSameTechs(page('https://x/', 1), page('https://y/', 2))).toBe(true);
	});

	it('retorna true quando techs têm os mesmos nomes (ordem irrelevante)', () => {
		const a = page('https://x/', 1, [
			{ name: 'React', cats: [12], confidence: 100, evidence: [] },
			{ name: 'jQuery', cats: [1], confidence: 75, evidence: [] },
		]);
		const b = page('https://y/', 2, [
			{ name: 'jQuery', cats: [1], confidence: 80, evidence: [] },
			{ name: 'React', cats: [12], confidence: 90, evidence: [] },
		]);
		expect(pageDetectionsHaveSameTechs(a, b)).toBe(true);
	});

	it('retorna false quando techs diferem', () => {
		const a = page('https://x/', 1, [{ name: 'React', cats: [12], confidence: 100, evidence: [] }]);
		const b = page('https://y/', 2, [{ name: 'Angular', cats: [12], confidence: 100, evidence: [] }]);
		expect(pageDetectionsHaveSameTechs(a, b)).toBe(false);
	});

	it('retorna false quando b tem tech adicional', () => {
		const a = page('https://x/', 1, [{ name: 'React', cats: [12], confidence: 100, evidence: [] }]);
		const b = page('https://y/', 2, [
			{ name: 'React', cats: [12], confidence: 100, evidence: [] },
			{ name: 'jQuery', cats: [1], confidence: 75, evidence: [] },
		]);
		expect(pageDetectionsHaveSameTechs(a, b)).toBe(false);
	});
});
