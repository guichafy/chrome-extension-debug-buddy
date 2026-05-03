import { describe, expect, it, test } from 'vitest';
import {
	fingerprintsEqual,
	sameSet,
	groupConsecutiveDetections,
} from '../fingerprint';
import type { EnvironmentFingerprint, PageDetection } from '../types';

const fp = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
	framework: { name: 'react', version: '18.2.0' },
	libraries: [],
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

const base: EnvironmentFingerprint = {
	framework: { name: 'react', version: '18.2.0' },
	libraries: [],
	httpClients: [],
	dataFetching: [],
	stateManagers: [],
	detectedAt: 0,
	isProductionBuild: false,
};

describe('fingerprintsEqual — storesDetected sentinel', () => {
	it('considera 1 store e 5 stores equivalentes (sentinel hasStores)', () => {
		const a: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 5, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(true);
	});

	it('considera 0 stores e 1 store equivalentes (carregamento progressivo)', () => {
		const a: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 0, treatment: 'tracked' }],
		};
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(false);
	});

	it('considera ambiente sem state manager diferente de ambiente com Redux', () => {
		const a: EnvironmentFingerprint = { ...base, stateManagers: [] };
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(false);
	});

	it('considera Zustand e Redux diferentes mesmo com mesma quantidade de stores', () => {
		const a: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'zustand', storesDetected: 1, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(false);
	});
});

describe('fingerprintsEqual — Phase 5 Angular libs', () => {
	const baseFp = {
		framework: { name: 'angular' as const, version: '17' },
		libraries: [],
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	};

	it('fingerprintsEqual=false quando angular-http muda de detection-only para tracked', () => {
		const before = {
			...baseFp,
			httpClients: [{ name: 'angular-http', confidence: 'high' as const }],
			dataFetching: [{ name: 'angular-http', treatment: 'detection-only' as const }],
		};
		const after = {
			...before,
			dataFetching: [{ name: 'angular-http', treatment: 'tracked' as const }],
		};
		expect(fingerprintsEqual(before, after)).toBe(false);
	});

	it('fingerprintsEqual=true para dois snapshots com angular-signal tracked', () => {
		const a = {
			...baseFp,
			stateManagers: [
				{ name: 'angular-signal', storesDetected: 0, treatment: 'tracked' as const },
			],
		};
		const b = { ...a, detectedAt: 999 };
		expect(fingerprintsEqual(a, b)).toBe(true);
	});
});

test('libraries diferentes resultam em fingerprints distintos', () => {
	const a: EnvironmentFingerprint = {
		framework: { name: 'react', version: '18.2.0' },
		libraries: [],
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	};
	const b: EnvironmentFingerprint = {
		...a,
		libraries: [{ name: 'jquery', version: '3.7.0', confidence: 'high' }],
	};
	expect(fingerprintsEqual(a, b)).toBe(false);
});

test('libraries iguais (ordem irrelevante) resultam em fingerprints iguais', () => {
	const lib1 = { name: 'jquery' as const, version: '3.7.0', confidence: 'high' as const };
	const a: EnvironmentFingerprint = {
		framework: { name: 'react' },
		libraries: [lib1],
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	};
	const b: EnvironmentFingerprint = {
		...a,
		libraries: [{ ...lib1 }],
		detectedAt: 999,
	};
	expect(fingerprintsEqual(a, b)).toBe(true);
});
