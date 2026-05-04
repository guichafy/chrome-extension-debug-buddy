import { describe, expect, it, test } from 'vitest';
import {
	pageDetectionsHaveSameTechs,
	sameSet,
	groupConsecutiveDetections,
} from '../fingerprint';
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

describe('sameSet', () => {
	it('compara conjuntos por chave canônica, ignorando ordem', () => {
		expect(sameSet([1, 2, 3], [3, 2, 1], (n) => `${n}`)).toBe(true);
		expect(sameSet([1, 2], [1, 2, 3], (n) => `${n}`)).toBe(false);
		expect(sameSet([], [], (n) => `${n}`)).toBe(true);
	});
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

describe('groupConsecutiveDetections', () => {
	it('agrupa detections consecutivas com techs idênticas em uma fase', () => {
		const techs = [{ name: 'React', cats: [12], confidence: 100, evidence: [] }];
		const phases = groupConsecutiveDetections([
			page('https://x.test/a', 1, techs),
			page('https://x.test/b', 2, techs),
			page('https://x.test/c', 3, techs),
		]);
		expect(phases).toHaveLength(1);
		expect(phases[0].pages.map((p) => p.url)).toEqual([
			'https://x.test/a',
			'https://x.test/b',
			'https://x.test/c',
		]);
		expect(phases[0].startTimestamp).toBe(1);
		expect(phases[0].endTimestamp).toBe(3);
	});

	it('cria nova fase quando techs mudam', () => {
		const reactTechs = [{ name: 'React', cats: [12], confidence: 100, evidence: [] }];
		const angularTechs = [{ name: 'Angular', cats: [12], confidence: 100, evidence: [] }];
		const phases = groupConsecutiveDetections([
			page('https://r.test/', 1, reactTechs),
			page('https://r.test/x', 2, reactTechs),
			page('https://a.test/', 3, angularTechs),
		]);
		expect(phases).toHaveLength(2);
		expect(phases[0].pages).toHaveLength(2);
		expect(phases[1].pages).toHaveLength(1);
		expect(phases[1].pages[0].techs?.[0].name).toBe('Angular');
	});

	it('cada fase recebe id único', () => {
		const reactTechs = [{ name: 'React', cats: [12], confidence: 100, evidence: [] }];
		const angularTechs = [{ name: 'Angular', cats: [12], confidence: 100, evidence: [] }];
		const phases = groupConsecutiveDetections([
			page('https://a/', 1, reactTechs),
			page('https://b/', 2, angularTechs),
		]);
		expect(phases[0].id).not.toBe(phases[1].id);
	});

	it('lista vazia → array vazio', () => {
		expect(groupConsecutiveDetections([])).toEqual([]);
	});

	it('detections sem techs (undefined) agrupam na mesma fase', () => {
		const phases = groupConsecutiveDetections([
			page('https://x/a', 1),
			page('https://x/b', 2),
		]);
		expect(phases).toHaveLength(1);
	});
});

test('techs diferentes resultam em fases distintas', () => {
	const a = page('https://x/', 1, [{ name: 'React', cats: [12], confidence: 100, evidence: [] }]);
	const b = page('https://x/', 2, [{ name: 'Vue', cats: [12], confidence: 100, evidence: [] }]);
	const phases = groupConsecutiveDetections([a, b]);
	expect(phases).toHaveLength(2);
});

test('techs iguais (ordem irrelevante) agrupam na mesma fase', () => {
	const techs1 = [
		{ name: 'React', cats: [12], confidence: 100, evidence: [] },
		{ name: 'jQuery', cats: [1], confidence: 75, evidence: [] },
	];
	const techs2 = [
		{ name: 'jQuery', cats: [1], confidence: 80, evidence: [] },
		{ name: 'React', cats: [12], confidence: 90, evidence: [] },
	];
	const a = page('https://x/', 1, techs1);
	const b = page('https://x/', 2, techs2);
	const phases = groupConsecutiveDetections([a, b]);
	expect(phases).toHaveLength(1);
});
