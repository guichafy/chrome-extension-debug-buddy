import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionStorage } from '../storage';
import type { Session } from '../types';

const baseSession = (overrides: Partial<Session> = {}): Session => ({
	id: 'sess-1',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: null,
	origin: 'recorded',
	tabId: 42,
	metadata: {
		initialUrl: 'https://example.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
	...overrides,
});

describe('sessionStorage', () => {
	beforeEach(async () => {
		await sessionStorage.clear();
	});

	afterEach(async () => {
		await sessionStorage.clear();
	});

	it('persiste e recupera uma session pelo id', async () => {
		const s = baseSession();
		await sessionStorage.put(s);
		const got = await sessionStorage.get('sess-1');
		expect(got).toEqual(s);
	});

	it('lista sessions ordenadas por startedAt desc', async () => {
		await sessionStorage.put(baseSession({ id: 'a', startedAt: 1 }));
		await sessionStorage.put(baseSession({ id: 'b', startedAt: 3 }));
		await sessionStorage.put(baseSession({ id: 'c', startedAt: 2 }));
		const list = await sessionStorage.list();
		expect(list.map((s) => s.id)).toEqual(['b', 'c', 'a']);
	});

	it('encontra session ativa por tabId (endedAt === null)', async () => {
		await sessionStorage.put(baseSession({ id: 'closed', tabId: 7, endedAt: 5 }));
		await sessionStorage.put(baseSession({ id: 'active', tabId: 7, endedAt: null }));
		const active = await sessionStorage.findActiveByTab(7);
		expect(active?.id).toBe('active');
	});

	it('retorna null quando não há session ativa pra tab', async () => {
		const active = await sessionStorage.findActiveByTab(99);
		expect(active).toBeNull();
	});

	it('delete remove a session', async () => {
		await sessionStorage.put(baseSession({ id: 'gone' }));
		await sessionStorage.delete('gone');
		expect(await sessionStorage.get('gone')).toBeNull();
	});

	it('count retorna número total', async () => {
		await sessionStorage.put(baseSession({ id: 'a' }));
		await sessionStorage.put(baseSession({ id: 'b' }));
		expect(await sessionStorage.count()).toBe(2);
	});
});
