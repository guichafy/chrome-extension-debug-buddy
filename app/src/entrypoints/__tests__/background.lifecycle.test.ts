import { recorder } from '@/lib/session/recorder';
import { setRecordingDisabled } from '@/lib/session/recordingPreference';
import { _resetForTests, sessionStore } from '@/lib/session/storage';

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
	(chrome as unknown as { action: unknown }).action = {
		onClicked: noopListener,
	};
	(chrome as unknown as { webNavigation: unknown }).webNavigation = {
		onCommitted: noopListener,
	};
}

describe('lifecycle binding (background)', () => {
	beforeEach(async () => {
		recorder._resetLimitsForTests();
		_resetForTests();
		await sessionStore.clear();
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
		installChromeStubs();
		// `broadcastRecordingState` chama `chrome.runtime.sendMessage(...).catch(...)`,
		// então o mock precisa devolver um thenable — `vi.fn()` puro retorna undefined
		// e quebra o `.catch`. Cada teste sobrescreve para um Promise resolvido.
		(chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			async () => ({}),
		);
		// Reset module cache para que cada teste re-importe background com state limpo.
		vi.resetModules();
	});

	test('startDebugging inicia gravacao quando recordingDisabled=false', async () => {
		const { _testStartDebugging } = await import('../background');
		await _testStartDebugging(123);
		const session = await sessionStore.findActiveByTab(123);
		expect(session).not.toBeNull();
		expect(session!.endedAt).toBeNull();
	});

	test('startDebugging broadcasta recordingStateChanged via runtime.sendMessage (sidepanel reach)', async () => {
		const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
		sendMessageMock.mockClear();
		const { _testStartDebugging } = await import('../background');
		await _testStartDebugging(321);
		const calls = sendMessageMock.mock.calls.map((c) => c[0] as Record<string, unknown>);
		const recordingBroadcast = calls.find(
			(c) => c?.action === 'recordingStateChanged' && c?.active === true,
		);
		expect(recordingBroadcast).toBeDefined();
		expect(recordingBroadcast).toMatchObject({
			action: 'recordingStateChanged',
			tabId: 321,
			active: true,
		});
		expect(typeof (recordingBroadcast as { sessionId?: unknown }).sessionId).toBe('string');
	});

	test('startDebugging NAO inicia gravacao quando recordingDisabled=true', async () => {
		await setRecordingDisabled(true);
		const { _testStartDebugging } = await import('../background');
		await _testStartDebugging(124);
		const session = await sessionStore.findActiveByTab(124);
		expect(session).toBeNull();
	});

	test('stopDebugging encerra gravacao ativa', async () => {
		const { _testStartDebugging, _testStopDebugging } = await import('../background');
		await _testStartDebugging(125);
		const before = await sessionStore.findActiveByTab(125);
		expect(before).not.toBeNull();
		await _testStopDebugging();
		const after = await sessionStore.findActiveByTab(125);
		expect(after).toBeNull(); // findActiveByTab retorna null pra sessões com endedAt setado
	});

	test('auto-start faz rollback da sessao se Runtime.enable falha', async () => {
		// Substitui o sendCommand stub padrão por um que falha em Runtime.enable.
		// Ordem real em startDebugging: Network.enable, Page.enable, Fetch.enable,
		// e (em tryAutoStartRecording) Runtime.enable, Log.enable. Como Page.enable
		// está num try/catch interno, a falha em Runtime.enable não compromete os
		// enable anteriores — somente abate o auto-start.
		const sendCommand = chrome.debugger.sendCommand as unknown as ReturnType<typeof vi.fn>;
		sendCommand.mockImplementation(async (_target: unknown, cmd: string) => {
			if (cmd === 'Runtime.enable') {
				throw new Error('Debugger detached');
			}
			return {};
		});
		const { _testStartDebugging } = await import('../background');
		await _testStartDebugging(200);
		// Sessão foi criada por startSession e depois encerrada via rollback —
		// findActiveByTab retorna null porque endedAt foi setado.
		const session = await sessionStore.findActiveByTab(200);
		expect(session).toBeNull();
	});
});
