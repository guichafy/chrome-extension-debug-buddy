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
		vi.restoreAllMocks();
	});

	test('persiste checkpoints mesmo quando eventos chegam a cada 100ms', async () => {
		const id = await recorder.startSession({
			tabId: 8,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const put = vi.spyOn(sessionStore, 'put').mockResolvedValue(undefined);
		vi.useFakeTimers();
		for (let i = 0; i < 30; i++) {
			await recorder.addEvent(id, {
				type: 'console',
				timestamp: Date.now(),
				phaseId: `bootstrap-${id}`,
				source: 'app',
				level: 'log',
				args: [{ type: 'string', description: `evento-${i}` }],
			});
			await vi.advanceTimersByTimeAsync(100);
		}
		expect(put.mock.calls.length).toBeGreaterThanOrEqual(3);
		expect(put.mock.calls.length).toBeLessThanOrEqual(4);
		put.mockRestore();
	});

	test('flush explícito propaga falha de persistência', async () => {
		const id = await recorder.startSession({
			tabId: 9,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const error = new Error('disco indisponível');
		const put = vi.spyOn(sessionStore, 'put').mockRejectedValueOnce(error);
		await expect(recorder._flushForTests(id)).rejects.toThrow(error);
		put.mockRestore();
	});

	test.each(['manual', 'limite'])(
		'permite repetir encerramento após falha de persistência: %s',
		async (mode) => {
			const id = await recorder.startSession({
				tabId: 12,
				initialUrl: 'https://x',
				userAgent: 'test',
				viewportSize: { w: 800, h: 600 },
				canvasCaptureEnabled: false,
			});
			const error = new Error('QuotaExceededError');
			vi.spyOn(sessionStore, 'put').mockRejectedValueOnce(error);
			if (mode === 'limite') {
				recorder._setLimitsForTests({ sizeBytes: 1, durationMs: 600_000 });
				await expect(
					recorder.addEvent(id, {
						type: 'console',
						timestamp: Date.now(),
						phaseId: `bootstrap-${id}`,
						source: 'app',
						level: 'log',
						args: [{ type: 'string', description: 'evento preservado' }],
					}),
				).rejects.toThrow(error);
			} else {
				await expect(recorder.stopSession(id)).rejects.toThrow(error);
			}
			await recorder.stopSession(id);
			const durable = await sessionStore.get(id);
			expect(durable!.endedAt).not.toBeNull();
			if (mode === 'limite') expect(durable!.events).toHaveLength(1);
		},
	);

	test('eventos sucessivos renovam debounce sem duplicar o checkpoint máximo', async () => {
		const id = await recorder.startSession({
			tabId: 10,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const put = vi.spyOn(sessionStore, 'put').mockResolvedValue(undefined);
		vi.useFakeTimers();
		for (let i = 0; i < 2; i++) {
			await recorder.addEvent(id, {
				type: 'console',
				timestamp: Date.now(),
				phaseId: `bootstrap-${id}`,
				source: 'app',
				level: 'log',
				args: [{ type: 'string', description: `evento-${i}` }],
			});
			await vi.advanceTimersByTimeAsync(100);
		}
		expect(put).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(100);
		expect(put).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(put).toHaveBeenCalledTimes(1);
	});

	test('aguarda checkpoint em voo antes do flush final sem sobrescrever sessão encerrada', async () => {
		const id = await recorder.startSession({
			tabId: 11,
			initialUrl: 'https://x',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		let release!: () => void;
		const checkpoint = new Promise<void>((resolve) => {
			release = resolve;
		});
		const snapshots: Array<number | null> = [];
		const put = vi.spyOn(sessionStore, 'put').mockImplementation(async (session) => {
			snapshots.push(session.endedAt);
			if (snapshots.length === 1) await checkpoint;
		});
		vi.useFakeTimers();
		await recorder.addEvent(id, {
			type: 'console',
			timestamp: Date.now(),
			phaseId: `bootstrap-${id}`,
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'evento' }],
		});
		await vi.advanceTimersByTimeAsync(200);
		const stop = recorder.stopSession(id);
		await vi.advanceTimersByTimeAsync(0);
		expect(put).toHaveBeenCalledTimes(1);
		release();
		await stop;
		expect(snapshots).toHaveLength(2);
		expect(snapshots[0]).toBeNull();
		expect(snapshots[1]).toBeTypeOf('number');
		await vi.advanceTimersByTimeAsync(1000);
		expect(put).toHaveBeenCalledTimes(2);
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
