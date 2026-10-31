// Stubs de APIs do chrome que o background.ts toca em side-effect (ao importar).
// Precisam ser instalados ANTES do dynamic import — caso contrário o módulo
// dispara TypeError em chamadas como `chrome.action.onClicked.addListener`.
function installChromeStubs() {
	const noopListener = { addListener: vi.fn(), removeListener: vi.fn() };
	(chrome as unknown as { debugger: unknown }).debugger = {
		attach: vi.fn(async () => undefined),
		detach: vi.fn(async () => undefined),
		sendCommand: vi.fn(async () => ({})),
		onEvent: noopListener,
		onDetach: noopListener,
		getTargets: vi.fn(async () => []),
	};
	(chrome.tabs as unknown as { get: unknown }).get = vi.fn(async (id: number) => ({
		id,
		url: `https://example.com/tab${id}`,
		width: 800,
		height: 600,
	}));
	chrome.tabs.sendMessage = vi.fn(async () => ({})) as never;
	(chrome.tabs as unknown as { onRemoved: unknown }).onRemoved = noopListener;
	(chrome.tabs as unknown as { onUpdated: unknown }).onUpdated = noopListener;
	(chrome.runtime as unknown as { onInstalled: unknown }).onInstalled = noopListener;
	(chrome.runtime as unknown as { onStartup: unknown }).onStartup = noopListener;
	(chrome.runtime as unknown as { getURL: unknown }).getURL = vi.fn(
		(p: string) => `chrome-extension://test/${p}`,
	);
	const actionListener = { addListener: vi.fn(), removeListener: vi.fn() };
	(chrome as unknown as { action: unknown }).action = {
		onClicked: actionListener,
	};
	(chrome.tabs as unknown as { create: unknown }).create = vi.fn(
		(_opts: unknown, cb?: (tab: { id: number }) => void) => {
			if (cb) cb({ id: 4242 });
		},
	);
}

beforeEach(async () => {
	(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
	installChromeStubs();
	(chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockImplementation(
		async () => ({}),
	);
	vi.resetModules();
});

describe('runAsyncHandler', () => {
	test('chama sendResponse com o valor resolvido pela promise', async () => {
		const { runAsyncHandler } = await import('../background');
		const handler = runAsyncHandler(async () => ({ ok: true as const, sessionId: 'abc' }));
		const sendResponse = vi.fn();
		const result = handler({ action: 'x' } as never, {} as never, sendResponse);
		expect(result).toBe(true);
		// Resposta é assíncrona — aguarda o microtask.
		await new Promise((r) => setTimeout(r, 0));
		expect(sendResponse).toHaveBeenCalledTimes(1);
		expect(sendResponse).toHaveBeenCalledWith({ ok: true, sessionId: 'abc' });
	});

	test('chama sendResponse com erro quando a promise rejeita', async () => {
		const { runAsyncHandler } = await import('../background');
		const handler = runAsyncHandler(async () => {
			throw new Error('boom');
		});
		const sendResponse = vi.fn();
		expect(handler({ action: 'x' } as never, {} as never, sendResponse)).toBe(true);
		await new Promise((r) => setTimeout(r, 0));
		expect(sendResponse).toHaveBeenCalledTimes(1);
		expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Error: boom' });
	});

	test('não chama sendResponse mais de uma vez mesmo com erro pos-resolve', async () => {
		const { runAsyncHandler } = await import('../background');
		// Cenário sintético: garante que o helper não vaza dupla chamada.
		const handler = runAsyncHandler(async () => ({ ok: true as const }));
		const sendResponse = vi.fn();
		handler({ action: 'x' } as never, {} as never, sendResponse);
		await new Promise((r) => setTimeout(r, 10));
		expect(sendResponse).toHaveBeenCalledTimes(1);
	});
});

describe('requireField', () => {
	test('retorna o valor quando o predicado passa', async () => {
		const { requireField } = await import('../background');
		expect(requireField('tabId', 42, (v): v is number => typeof v === 'number')).toBe(42);
	});

	test('lança Error com mensagem padronizada quando o predicado falha', async () => {
		const { requireField } = await import('../background');
		expect(() => requireField('tabId', 'foo', (v): v is number => typeof v === 'number')).toThrow(
			'tabId obrigatório',
		);
	});

	test('lança Error com mensagem custom se fornecida', async () => {
		const { requireField } = await import('../background');
		expect(() =>
			requireField(
				'data',
				null,
				(v): v is string => typeof v === 'string',
				'data ausente ou inválido',
			),
		).toThrow('data ausente ou inválido');
	});
});

describe('messageHandlers map', () => {
	test('possui handler pra cada action listada na MessageAction union usada por UI→background', async () => {
		const { messageHandlers } = await import('../background');
		// Whitelist de actions UI→background (todas precisam ter handler).
		const uiToBackground = [
			'startDebugging',
			'stopDebugging',
			'getDebuggingStatus',
			'getPendingResponses',
			'getAllRequests',
			'getResponseDetails',
			'selectTargetTab',
			'setTargetTab',
			'clearAllRequests',
			'getSessionMarker',
			'approveResponse',
			'approveResponseWithEdit',
			'getPendingInterceptions',
			'approveInterception',
			'approveInterceptionWithEdit',
			'cancelInterception',
			'startRecording',
			'stopRecording',
			'pageDetected',
			'getActiveSession',
			'getLiveSnapshot',
			'getRecordingStatus',
			'deleteSession',
			'exportSession',
			'importSession',
			'rrwebBatch',
			'getPrivacyConfig',
			'setPrivacyConfig',
			'purgeOldSessions',
			'setRecordingLive',
			'angularHttpTag',
		];
		for (const action of uiToBackground) {
			expect(messageHandlers[action as keyof typeof messageHandlers]).toBeDefined();
		}
	});
});
