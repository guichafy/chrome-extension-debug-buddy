import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { _resetForTests, sessionStore } from '../storage';
import type { RrwebEvent, SessionEvent } from '../types';

const META = {
	initialUrl: 'https://example.test/',
	userAgent: 'jsdom',
	viewportSize: { w: 1280, h: 720 },
	canvasCaptureEnabled: false,
};

const consoleEv = (timestamp: number, msg: string): SessionEvent => ({
	type: 'console',
	timestamp,
	phaseId: 'p1',
	source: 'app',
	level: 'log',
	args: [{ type: 'string', description: msg }],
});

const networkEv = (timestamp: number, url: string): SessionEvent => ({
	type: 'network',
	timestamp,
	phaseId: 'p1',
	requestId: `r_${timestamp}`,
	method: 'GET',
	url,
	status: 200,
});

const rrwebEv = (timestamp: number): RrwebEvent => ({
	type: 3,
	data: { source: 1, x: 0, y: 0 },
	timestamp,
});

describe('recorder — serialização de mutations concorrentes (bd 2qa)', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
	});

	it('addEvent + addRrwebEvents concorrentes não perdem writes', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });

		// Dispara 10 chamadas em paralelo. Sem serialização cada par
		// `get → put` poderia se sobrepor e perder eventos.
		await Promise.all([
			recorder.addEvent(id, networkEv(1, 'https://a/1')),
			recorder.addRrwebEvents(id, [rrwebEv(2), rrwebEv(3)]),
			recorder.addEvent(id, networkEv(4, 'https://a/2')),
			recorder.addRrwebEvents(id, [rrwebEv(5)]),
			recorder.addEvent(id, networkEv(6, 'https://a/3')),
			recorder.addRrwebEvents(id, [rrwebEv(7), rrwebEv(8), rrwebEv(9)]),
			recorder.addEvent(id, networkEv(10, 'https://a/4')),
			recorder.addRrwebEvents(id, [rrwebEv(11)]),
			recorder.addEvent(id, networkEv(12, 'https://a/5')),
			recorder.addEvent(id, networkEv(13, 'https://a/6')),
		]);

		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		expect(s).not.toBeNull();
		// 6 network events e 1+2+1+3+1 = 8 rrweb events.
		expect(s?.events.filter((e) => e.type === 'network').length).toBe(6);
		expect(s?.rrwebEvents?.length).toBe(7);
	});

	it('coalesce de console funciona sob concorrência (preserva semantics)', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });

		// 3 mensagens idênticas concorrentes — devem coalescer em uma única entrada
		// com coalesceCount=3 (a serialização garante a ordem em que chegam).
		await Promise.all([
			recorder.addEvent(id, consoleEv(1, 'rendered')),
			recorder.addEvent(id, consoleEv(2, 'rendered')),
			recorder.addEvent(id, consoleEv(3, 'rendered')),
		]);

		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		const consoles = (s?.events ?? []).filter((e) => e.type === 'console');
		expect(consoles).toHaveLength(1);
		const ev = consoles[0];
		if (ev.type !== 'console') throw new Error('coalesce produziu evento de tipo errado');
		expect(ev.coalesceCount).toBe(3);
	});

	it('falha em uma mutation não envenena as próximas', async () => {
		const id = await recorder.startSession({ tabId: 1, ...META });

		// addEvent em sessão fictícia rejeita; mas o slot do sessionId real continua
		// funcional para chamadas subsequentes.
		const failing = recorder.addEvent('sess_missing', networkEv(1, 'https://x'));
		await expect(failing).rejects.toThrow(/não encontrada/);

		await recorder.addEvent(id, networkEv(2, 'https://b/1'));
		await recorder._flushForTests(id);
		const s = await sessionStore.get(id);
		expect(s?.events.filter((e) => e.type === 'network').length).toBe(1);
	});
});
