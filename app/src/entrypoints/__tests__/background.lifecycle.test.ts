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
});
