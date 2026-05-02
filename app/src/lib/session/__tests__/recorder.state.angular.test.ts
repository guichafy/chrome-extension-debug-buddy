import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';
import type { PageDetection } from '../types';

const fp = {
	framework: { name: 'angular' as const, version: '17' },
	httpClients: [],
	dataFetching: [],
	stateManagers: [
		{ name: 'angular-signal', storesDetected: 0, treatment: 'tracked' as const },
	],
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

describe('recorder.addStateChange — Phase 5 (angular-signal e ngrx)', () => {
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

	it('aceita storeKind angular-signal e persiste baseline', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'sig:1',
			storeKind: 'angular-signal',
			timestamp: Date.now(),
			prev: { value: 0 },
			next: { value: 1 },
		});
		const s = await sessionStore.get(id);
		expect(s?.detectionPhases[0].stateBaseline?.['sig:1']?.storeKind).toBe('angular-signal');
		const stateEvents = (s?.events ?? []).filter((e) => e.type === 'state');
		expect(stateEvents).toHaveLength(1);
		const ev = stateEvents[0];
		if (ev.type !== 'state') throw new Error('tipo inesperado');
		expect(ev.storeKind).toBe('angular-signal');
	});

	it('aceita storeKind ngrx e preserva storeId encapsulando actionType', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'ngrx:root#[Counter] Increment',
			storeKind: 'ngrx',
			timestamp: Date.now(),
			prev: { count: 0 },
			next: { count: 1 },
		});
		const s = await sessionStore.get(id);
		const ev = (s?.events ?? []).find((e) => e.type === 'state');
		if (!ev || ev.type !== 'state') throw new Error('evento state ausente');
		expect(ev.storeKind).toBe('ngrx');
		expect(ev.storeId).toContain('Increment');
	});
});
