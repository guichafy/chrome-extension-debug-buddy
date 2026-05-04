import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetForTests, sessionStore } from '../storage';
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

describe('sessionStore', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
	});

	afterEach(async () => {
		await sessionStore.clear();
	});

	it('persiste e recupera uma session pelo id', async () => {
		const s = baseSession();
		await sessionStore.put(s);
		const got = await sessionStore.get('sess-1');
		expect(got).toEqual(s);
	});

	it('lista sessions ordenadas por startedAt desc', async () => {
		await sessionStore.put(baseSession({ id: 'a', startedAt: 1 }));
		await sessionStore.put(baseSession({ id: 'b', startedAt: 3 }));
		await sessionStore.put(baseSession({ id: 'c', startedAt: 2 }));
		const list = await sessionStore.list();
		expect(list.map((s) => s.id)).toEqual(['b', 'c', 'a']);
	});

	it('encontra session ativa por tabId (endedAt === null)', async () => {
		await sessionStore.put(baseSession({ id: 'closed', tabId: 7, endedAt: 5 }));
		await sessionStore.put(baseSession({ id: 'active', tabId: 7, endedAt: null }));
		const active = await sessionStore.findActiveByTab(7);
		expect(active?.id).toBe('active');
	});

	it('retorna null quando não há session ativa pra tab', async () => {
		const active = await sessionStore.findActiveByTab(99);
		expect(active).toBeNull();
	});

	it('delete remove a session', async () => {
		await sessionStore.put(baseSession({ id: 'gone' }));
		await sessionStore.delete('gone');
		expect(await sessionStore.get('gone')).toBeNull();
	});

	it('count retorna número total', async () => {
		await sessionStore.put(baseSession({ id: 'a' }));
		await sessionStore.put(baseSession({ id: 'b' }));
		expect(await sessionStore.count()).toBe(2);
	});

	it('findActiveByTab com duas active sessions na mesma tab retorna a primeira encontrada', async () => {
		// Invariante violada (recorder não deveria criar dupla), mas o storage deve responder
		// determinísticamente em vez de explodir. Documenta o comportamento atual.
		await sessionStore.put(baseSession({ id: 'a', tabId: 5, endedAt: null, startedAt: 1 }));
		await sessionStore.put(baseSession({ id: 'b', tabId: 5, endedAt: null, startedAt: 2 }));
		const active = await sessionStore.findActiveByTab(5);
		expect(active).not.toBeNull();
		expect(['a', 'b']).toContain(active?.id);
	});
});
