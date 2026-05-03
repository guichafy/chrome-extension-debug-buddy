import { afterEach, beforeEach, expect, test } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { recorder } from '../recorder';
import { sessionStore } from '../storage';

beforeEach(async () => {
	await sessionStore.clear();
});

afterEach(async () => {
	recorder._resetLimitsForTests();
	await sessionStore.clear();
});

test('patchNetworkEventRequest atualiza event.request e durationMs (strip body)', async () => {
	recorder._resetLimitsForTests();
	await sessionStore.clear();
	const id = await recorder.startSession({
		tabId: 50,
		initialUrl: 'https://example.com/',
		userAgent: 'test',
		viewportSize: { w: 800, h: 600 },
		canvasCaptureEnabled: false,
	});
	const baseRequest: InterceptedResponse = {
		url: 'https://api.test/x',
		method: 'POST',
		status: 0,
		statusText: '',
		headers: {},
		type: 'xhr',
		timestamp: 100,
		isWaiting: true,
		// nenhum body — Replay não usa body, e ev.request agora é slim por design.
	};
	await recorder.addEvent(id, {
		type: 'network',
		timestamp: 100,
		phaseId: `bootstrap-${id}`,
		requestId: 'req-1',
		method: 'POST',
		url: 'https://api.test/x',
		status: 0,
		request: baseRequest,
	});

	await recorder.patchNetworkEventRequest(id, 'req-1', {
		isWaiting: false,
		status: 200,
		body: 'aprovado',
		editedAtRuntime: true,
		duration: 42,
	});

	await recorder._flushForTests(id);
	const s = await sessionStore.get(id);
	const ev = s?.events.find((e) => e.type === 'network' && e.requestId === 'req-1');
	expect(ev).toBeDefined();
	if (ev?.type !== 'network') throw new Error('type guard');
	expect(ev.request?.isWaiting).toBe(false);
	expect(ev.request?.status).toBe(200);
	// body é stripado — Replay não usa body, e a sessão não pode crescer a cada patch.
	expect(ev.request?.body).toBeUndefined();
	expect(ev.request?.editedAtRuntime).toBe(true);
	expect(ev.request?.duration).toBe(42);
	// top-level espelhado
	expect(ev.status).toBe(200);
	expect(ev.durationMs).toBe(42);
});

test('patchNetworkEventRequest no-op em session inexistente', async () => {
	recorder._resetLimitsForTests();
	await sessionStore.clear();
	// não lança — só retorna silencioso (idempotente)
	await expect(
		recorder.patchNetworkEventRequest('sess_inexistente', 'req-x', { status: 500 }),
	).resolves.toBeUndefined();
});
