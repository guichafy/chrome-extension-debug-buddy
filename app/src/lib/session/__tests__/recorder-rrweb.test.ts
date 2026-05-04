import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';
import type { RrwebEvent } from '../types';

const ev = (type: number, timestamp: number, payload: unknown = {}): RrwebEvent => ({
	type,
	data: payload,
	timestamp,
});

const META = {
	initialUrl: 'https://example.test/',
	userAgent: 'jsdom',
	viewportSize: { w: 1280, h: 720 },
	canvasCaptureEnabled: false,
};

describe('recorder.addRrwebEvents', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
	});

	afterEach(() => {
		recorder._resetLimitsForTests();
	});

	it('append eventos a session.rrwebEvents (cria array se ausente)', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.addRrwebEvents(id, [ev(2, 1), ev(3, 2)]);
		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		expect(s?.rrwebEvents?.length).toBe(2);
		expect(s?.rrwebEvents?.[0].type).toBe(2);
	});

	it('append acumulativo entre batches', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.addRrwebEvents(id, [ev(2, 1)]);
		await recorder.addRrwebEvents(id, [ev(3, 2), ev(3, 3)]);
		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		expect(s?.rrwebEvents?.length).toBe(3);
	});

	it('é no-op com array vazio', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.addRrwebEvents(id, []);
		const s = await sessionStore.get(id);
		expect(s?.rrwebEvents).toBeUndefined();
	});

	it('lança erro em sessão inexistente', async () => {
		await expect(recorder.addRrwebEvents('sess_missing', [ev(2, 1)])).rejects.toThrow(
			/não encontrada/,
		);
	});

	it('lança erro em sessão encerrada', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });
		await recorder.stopSession(id);
		await expect(recorder.addRrwebEvents(id, [ev(2, 1)])).rejects.toThrow(/já encerrada/);
	});

	it('dispara hard limit por size quando bytes excedem', async () => {
		recorder._setLimitsForTests({ sizeBytes: 500, durationMs: 60_000 });
		const id = await recorder.startSession({ tabId: 1, ...META });
		const big = ev(2, 1, { html: 'x'.repeat(600) });
		await recorder.addRrwebEvents(id, [big]);
		const s = await sessionStore.get(id);
		expect(s?.endedAt).not.toBeNull();
		expect(s?.telemetry?.hitHardLimit).toBe(true);
		expect(s?.telemetry?.hardLimitReason).toBe('size');
	});
});
