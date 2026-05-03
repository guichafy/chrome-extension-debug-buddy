import { recorder } from '../recorder';
import { sessionStore } from '../storage';

describe('recorder debounce flush', () => {
	beforeEach(async () => {
		recorder._resetLimitsForTests();
		await sessionStore.clear();
	});
	afterEach(() => {
		// Garante que cleanup com timers reais — fake-indexeddb usa timers internos.
		vi.useRealTimers();
	});

	test('addEvent não escreve em IDB sincronicamente — só agenda flush', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		// startSession faz 1 put inicial — confirma que está em IDB.
		const initial = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(initial!.events).toHaveLength(0);

		const putSpy = vi.spyOn(sessionStore, 'put');
		putSpy.mockClear();

		// Switch pra fake timers só durante a janela do debounce — fake-indexeddb
		// usa timers reais e travaria caso ativássemos fake antes do startSession.
		vi.useFakeTimers();
		void recorder.addEvent(id, {
			type: 'console',
			timestamp: Date.now(),
			phaseId: `bootstrap-${id}`,
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'test' }],
		});

		// Aguarda a microtask da serialização rodar.
		await vi.advanceTimersByTimeAsync(0);
		// Antes do timeout: NENHUM put aconteceu.
		expect(putSpy).not.toHaveBeenCalled();

		// Avança 200ms — flush dispara.
		await vi.advanceTimersByTimeAsync(200);
		vi.useRealTimers();
		expect(putSpy).toHaveBeenCalledTimes(1);

		// Sessão final em IDB tem o evento.
		const final = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(final!.events).toHaveLength(1);
		putSpy.mockRestore();
	});

	test('múltiplos addEvent na janela de debounce coalesce em 1 put', async () => {
		const id = await recorder.startSession({
			tabId: 2,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const putSpy = vi.spyOn(sessionStore, 'put');
		putSpy.mockClear();
		// 5 events em rápida sucessão
		for (let i = 0; i < 5; i++) {
			await recorder.addEvent(id, {
				type: 'console',
				timestamp: Date.now() + i,
				phaseId: `bootstrap-${id}`,
				source: 'app',
				level: 'log',
				args: [{ type: 'string', description: `evt ${i}` }],
			});
		}
		// Sem flush ainda — todos events só agendaram timers.
		expect(putSpy).not.toHaveBeenCalled();
		// Force flush imediato pra observar o coalescing.
		await recorder._flushForTests(id);
		expect(putSpy).toHaveBeenCalledTimes(1);
		const final = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(final!.events).toHaveLength(5);
		putSpy.mockRestore();
	});

	test('stopSession força flush imediato — sem aguardar timer', async () => {
		const id = await recorder.startSession({
			tabId: 3,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		await recorder.addEvent(id, {
			type: 'console',
			timestamp: Date.now(),
			phaseId: `bootstrap-${id}`,
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'last' }],
		});
		await recorder.stopSession(id);
		// SEM advanceTimers — flush deve ter sido forçado pelo stopSession.
		const final = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(final!.endedAt).not.toBeNull();
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(final!.events).toHaveLength(1);
	});

	test('getActiveByTab retorna versão cached (mid-debounce)', async () => {
		const id = await recorder.startSession({
			tabId: 4,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		await recorder.addEvent(id, {
			type: 'console',
			timestamp: Date.now(),
			phaseId: `bootstrap-${id}`,
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'cached' }],
		});
		// Sem flush ainda — cache tem 1 evento, IDB tem 0.
		const fromIdb = await sessionStore.get(id);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(fromIdb!.events).toHaveLength(0);
		const cached = await recorder.getActiveByTab(4);
		// biome-ignore lint/style/noNonNullAssertion: teste — sessão recém-criada
		expect(cached!.events).toHaveLength(1); // versão cached
	});
});
