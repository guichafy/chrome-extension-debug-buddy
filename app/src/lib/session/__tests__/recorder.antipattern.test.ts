import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';
import type { AntipatternHit, SessionEvent } from '../types';

function fakeHit(over: Partial<AntipatternHit> = {}): AntipatternHit {
	return {
		patternId: 'dup-req-burst',
		severity: 'warn',
		startTimestamp: 1,
		endTimestamp: 2,
		phaseId: 'p1',
		evidenceEventIds: [],
		context: { summary: 'teste' },
		...over,
	};
}

async function makeSession(): Promise<string> {
	return recorder.startSession({
		tabId: 99,
		initialUrl: 'http://x/',
		userAgent: 'jsdom',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	});
}

describe('recorder.addAntipatternHit', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
		recorder._resetEnginesForTests();
	});
	afterEach(() => {
		recorder._resetLimitsForTests();
		recorder._resetEnginesForTests();
	});

	it('persiste hit em session.antipatternHits', async () => {
		const id = await makeSession();
		await recorder.addAntipatternHit(id, fakeHit());
		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		expect(s?.antipatternHits).toHaveLength(1);
		expect(s?.antipatternHits?.[0].patternId).toBe('dup-req-burst');
	});

	it('dedup — segundo hit idêntico é ignorado', async () => {
		const id = await makeSession();
		await recorder.addAntipatternHit(id, fakeHit());
		await recorder.addAntipatternHit(id, fakeHit());
		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		expect(s?.antipatternHits).toHaveLength(1);
	});

	it('rejeita session encerrada', async () => {
		const id = await makeSession();
		await recorder.stopSession(id);
		await expect(recorder.addAntipatternHit(id, fakeHit())).rejects.toThrow(/já encerrada/);
	});
});

describe('recorder.pushNetworkForAntipatterns', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
		recorder._resetEnginesForTests();
	});
	afterEach(() => {
		recorder._resetLimitsForTests();
		recorder._resetEnginesForTests();
	});

	it('detecta dup-req-burst em sequência de 3 events', async () => {
		const id = await makeSession();
		const mk = (ts: number, rid: string): SessionEvent => ({
			type: 'network',
			timestamp: ts,
			phaseId: 'p1',
			requestId: rid,
			method: 'GET',
			url: 'http://x/a',
			status: 200,
		});
		expect(recorder.pushNetworkForAntipatterns(id, mk(100, '1'))).toEqual([]);
		expect(recorder.pushNetworkForAntipatterns(id, mk(200, '2'))).toEqual([]);
		const last = recorder.pushNetworkForAntipatterns(id, mk(300, '3'));
		expect(last).toHaveLength(1);
		expect(last[0].patternId).toBe('dup-req-burst');
	});
});
