import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetForTests, sessionStore } from '../../storage';
import type { Session } from '../../types';
import { purgeOldSessions } from '../autoPurge';

const session = (id: string, endedAt: number | null): Session => ({
	id,
	schemaVersion: 1,
	startedAt: endedAt ?? Date.now(),
	endedAt,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'http://e/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
});

describe('purgeOldSessions', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
	});

	afterEach(async () => {
		await sessionStore.clear();
		_resetForTests();
	});

	it('deleta sessões antigas (endedAt < cutoff)', async () => {
		const now = 1_000_000_000_000;
		const oneDayMs = 24 * 60 * 60 * 1000;
		await sessionStore.put(session('old', now - 60 * oneDayMs));
		await sessionStore.put(session('mid', now - 5 * oneDayMs));
		await sessionStore.put(session('new', now - 1 * oneDayMs));

		const deleted = await purgeOldSessions(30, now);
		expect(deleted).toBe(1);

		const remaining = (await sessionStore.list()).map((s) => s.id).sort();
		expect(remaining).toEqual(['mid', 'new']);
	});

	it('preserva sessões em gravação (endedAt=null)', async () => {
		const now = 1_000_000_000_000;
		await sessionStore.put(session('active', null));
		const deleted = await purgeOldSessions(1, now);
		expect(deleted).toBe(0);
		expect(await sessionStore.get('active')).not.toBeNull();
	});

	it('lança em retentionDays inválido', async () => {
		await expect(purgeOldSessions(0)).rejects.toThrow(RangeError);
		await expect(purgeOldSessions(Number.NaN)).rejects.toThrow(RangeError);
	});
});
