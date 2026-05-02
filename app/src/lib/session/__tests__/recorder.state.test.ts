import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';
import type { PageDetection } from '../types';

const fp = {
	framework: { name: 'react' as const, version: '18' },
	httpClients: [],
	dataFetching: [],
	stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' as const }],
	detectedAt: 0,
	isProductionBuild: false,
};

async function startWithPhase(): Promise<string> {
	const id = await recorder.startSession({
		tabId: 1,
		initialUrl: 'https://x/',
		userAgent: 'jsdom',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	});
	const det: PageDetection = {
		url: 'https://x/',
		timestamp: Date.now(),
		fingerprint: fp,
		triggerType: 'initial',
	};
	await recorder.addPage(id, det);
	return id;
}

describe('recorder.addStateChange', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
		recorder._resetStateLimitsForTests();
	});

	afterEach(() => {
		recorder._resetLimitsForTests();
		recorder._resetStateLimitsForTests();
	});

	it('escreve baseline na primeira mudança e gera StateChangeEvent', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: Date.now(),
			prev: { a: 1 },
			next: { a: 2 },
		});
		const s = await sessionStore.get(id);
		expect(s).toBeTruthy();
		const phase = s?.detectionPhases[0];
		expect(phase?.stateBaseline?.['redux:1']?.data).toEqual({ a: 1 });
		const stateEvents = (s?.events ?? []).filter((e) => e.type === 'state');
		expect(stateEvents).toHaveLength(1);
	});

	it('gera keyframe a cada N diffs', async () => {
		recorder._setStateLimitsForTests({ everyNDiffs: 3, everyTMs: 1_000_000 });
		const id = await startWithPhase();
		for (let i = 1; i <= 5; i++) {
			await recorder.addStateChange(id, {
				storeId: 'redux:1',
				storeKind: 'redux',
				timestamp: Date.now() + i,
				prev: { a: i - 1 },
				next: { a: i },
			});
		}
		const s = await sessionStore.get(id);
		expect((s?.detectionPhases[0].stateKeyframes ?? []).length).toBeGreaterThanOrEqual(1);
	});

	it('gera keyframe a cada T ms', async () => {
		recorder._setStateLimitsForTests({ everyNDiffs: 1_000, everyTMs: 50 });
		const id = await startWithPhase();
		const t0 = Date.now();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: t0,
			prev: { a: 0 },
			next: { a: 1 },
		});
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: t0 + 100,
			prev: { a: 1 },
			next: { a: 2 },
		});
		const s = await sessionStore.get(id);
		expect((s?.detectionPhases[0].stateKeyframes ?? []).length).toBeGreaterThanOrEqual(1);
	});

	it('rejeita state-change sem fase ativa', async () => {
		const id = await recorder.startSession({
			tabId: 2,
			initialUrl: 'https://y/',
			userAgent: 'jsdom',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await expect(
			recorder.addStateChange(id, {
				storeId: 'redux:1',
				storeKind: 'redux',
				timestamp: Date.now(),
				prev: {},
				next: { a: 1 },
			}),
		).rejects.toThrow(/antes da primeira DetectionPhase/);
	});

	it('múltiplos stores na mesma fase têm baselines independentes', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: Date.now(),
			prev: { a: 0 },
			next: { a: 1 },
		});
		await recorder.addStateChange(id, {
			storeId: 'zustand:1',
			storeKind: 'zustand',
			timestamp: Date.now(),
			prev: { x: 'init' },
			next: { x: 'next' },
		});
		const s = await sessionStore.get(id);
		expect(Object.keys(s?.detectionPhases[0].stateBaseline ?? {})).toEqual(
			expect.arrayContaining(['redux:1', 'zustand:1']),
		);
	});

	it('ignora mudança quando diff é vazio (sem ops)', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: Date.now(),
			prev: { a: 1 },
			next: { a: 1 },
		});
		const s = await sessionStore.get(id);
		const stateEvents = (s?.events ?? []).filter((e) => e.type === 'state');
		expect(stateEvents).toHaveLength(0);
	});
});
