import { describe, expect, it } from 'vitest';
import {
	fingerprintsEqual,
	sameSet,
	groupConsecutiveDetections,
} from '../fingerprint';
import type { EnvironmentFingerprint, PageDetection } from '../types';

const fp = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
	framework: { name: 'react', version: '18.2.0' },
	httpClients: [{ name: 'fetch', confidence: 'high' }],
	dataFetching: [],
	stateManagers: [],
	detectedAt: 0,
	isProductionBuild: false,
	...overrides,
});

const page = (url: string, ts: number, fingerprint: EnvironmentFingerprint): PageDetection => ({
	url,
	timestamp: ts,
	fingerprint,
	triggerType: 'navigation',
});

describe('sameSet', () => {
	it('compara conjuntos por chave canônica, ignorando ordem', () => {
		expect(sameSet([1, 2, 3], [3, 2, 1], (n) => `${n}`)).toBe(true);
		expect(sameSet([1, 2], [1, 2, 3], (n) => `${n}`)).toBe(false);
		expect(sameSet([], [], (n) => `${n}`)).toBe(true);
	});
});

describe('fingerprintsEqual', () => {
	it('retorna true para fingerprints estruturalmente idênticos', () => {
		expect(fingerprintsEqual(fp(), fp())).toBe(true);
	});

	it('ignora detectedAt e isProductionBuild na comparação', () => {
		expect(
			fingerprintsEqual(
				fp({ detectedAt: 1, isProductionBuild: true }),
				fp({ detectedAt: 999, isProductionBuild: false }),
			),
		).toBe(true);
	});

	it('detecta versão de framework diferente', () => {
		expect(
			fingerprintsEqual(
				fp({ framework: { name: 'react', version: '18.2.0' } }),
				fp({ framework: { name: 'react', version: '17.0.0' } }),
			),
		).toBe(false);
	});

	it('detecta framework diferente', () => {
		expect(
			fingerprintsEqual(
				fp({ framework: { name: 'react' } }),
				fp({ framework: { name: 'angular' } }),
			),
		).toBe(false);
	});

	it('detecta lib nova adicionada', () => {
		expect(
			fingerprintsEqual(
				fp({ dataFetching: [] }),
				fp({ dataFetching: [{ name: 'apollo', treatment: 'detection-only' }] }),
			),
		).toBe(false);
	});

	it('detecta confidence diferente em http client', () => {
		expect(
			fingerprintsEqual(
				fp({ httpClients: [{ name: 'fetch', confidence: 'high' }] }),
				fp({ httpClients: [{ name: 'fetch', confidence: 'low' }] }),
			),
		).toBe(false);
	});
});

describe('groupConsecutiveDetections', () => {
	it('agrupa detections consecutivas com fingerprint idêntico em uma fase', () => {
		const f = fp();
		const phases = groupConsecutiveDetections([
			page('https://x.test/a', 1, f),
			page('https://x.test/b', 2, f),
			page('https://x.test/c', 3, f),
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

	it('cria nova fase quando fingerprint muda', () => {
		const reactFp = fp();
		const angularFp = fp({ framework: { name: 'angular', version: '17' } });
		const phases = groupConsecutiveDetections([
			page('https://r.test/', 1, reactFp),
			page('https://r.test/x', 2, reactFp),
			page('https://a.test/', 3, angularFp),
		]);
		expect(phases).toHaveLength(2);
		expect(phases[0].pages).toHaveLength(2);
		expect(phases[1].pages).toHaveLength(1);
		expect(phases[1].fingerprint.framework.name).toBe('angular');
	});

	it('cada fase recebe id único', () => {
		const phases = groupConsecutiveDetections([
			page('https://a/', 1, fp()),
			page('https://b/', 2, fp({ framework: { name: 'angular' } })),
		]);
		expect(phases[0].id).not.toBe(phases[1].id);
	});

	it('lista vazia → array vazio', () => {
		expect(groupConsecutiveDetections([])).toEqual([]);
	});
});
