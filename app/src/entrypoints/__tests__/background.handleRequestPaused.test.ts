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
	(chrome as unknown as { webNavigation: unknown }).webNavigation = {
		onCommitted: noopListener,
	};
}

beforeEach(async () => {
	(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
	installChromeStubs();
	(chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockImplementation(
		async () => ({}),
	);
	vi.resetModules();
});

import { DEFAULT_REDACTION_CONFIG } from '@/lib/session/privacy/defaults';
import type { RedactionConfig } from '@/lib/session/types';

describe('applyPrivacyGate', () => {
	test('retorna false (não bloqueia) quando config é null', async () => {
		const { applyPrivacyGate } = await import('../background');
		expect(applyPrivacyGate('https://example.com/api', null)).toBe(false);
	});

	test('retorna false quando URL não casa com nenhum domínio bloqueado', async () => {
		const { applyPrivacyGate } = await import('../background');
		const cfg: RedactionConfig = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['blocked.com'] };
		expect(applyPrivacyGate('https://example.com/api', cfg)).toBe(false);
	});

	test('retorna true quando URL casa com domínio bloqueado', async () => {
		const { applyPrivacyGate } = await import('../background');
		const cfg: RedactionConfig = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['blocked.com'] };
		expect(applyPrivacyGate('https://blocked.com/foo', cfg)).toBe(true);
	});
});

import type { MatchedRuleAction } from '@/domain/ruleMatching';

describe('processRequestStage', () => {
	test('retorna { handled: true, kind: "mock" } quando matchedAction é mock+latency', async () => {
		const { processRequestStage } = await import('../background');
		const action: MatchedRuleAction = {
			type: 'mock',
			action: { latency: 100, status: 200, body: '', headers: {} } as never,
		} as never;
		expect(processRequestStage(action)).toEqual({ handled: true, kind: 'mock' });
	});

	test('retorna { handled: true, kind: "delay" } quando matchedAction é delay', async () => {
		const { processRequestStage } = await import('../background');
		const action: MatchedRuleAction = {
			type: 'delay',
			action: { timeMs: 5000 } as never,
		} as never;
		expect(processRequestStage(action)).toEqual({ handled: true, kind: 'delay', timeMs: 5000 });
	});

	test('retorna { handled: false } quando mock não tem latency', async () => {
		const { processRequestStage } = await import('../background');
		const action: MatchedRuleAction = {
			type: 'mock',
			action: { status: 200, body: '', headers: {} } as never,
		} as never;
		expect(processRequestStage(action)).toEqual({ handled: false });
	});

	test('retorna { handled: false } quando matchedAction é undefined', async () => {
		const { processRequestStage } = await import('../background');
		expect(processRequestStage(undefined)).toEqual({ handled: false });
	});
});

describe('buildResponseSnapshot', () => {
	test('monta snapshot completo com body, request e response', async () => {
		const { buildResponseSnapshot } = await import('../background');
		const snap = buildResponseSnapshot({
			url: 'https://api.test/x',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			responseHeaders: { 'content-type': 'application/json' },
			mimeType: 'application/json',
			resourceType: 'xhr',
			requestHeaders: { accept: 'application/json' },
			postData: undefined,
			body: '{"ok":true}',
			bodyUnavailableReason: undefined,
			timestamp: 100,
		});
		expect(snap.url).toBe('https://api.test/x');
		expect(snap.body).toBe('{"ok":true}');
		expect(snap.response?.body).toBe('{"ok":true}');
		expect(snap.request?.headers?.accept).toBe('application/json');
	});

	test('omite mimeType quando undefined (não cria campo undefined)', async () => {
		const { buildResponseSnapshot } = await import('../background');
		const snap = buildResponseSnapshot({
			url: 'https://api.test/x',
			method: 'GET',
			status: 204,
			statusText: 'No Content',
			responseHeaders: {},
			mimeType: undefined,
			resourceType: 'xhr',
			requestHeaders: {},
			postData: undefined,
			body: undefined,
			bodyUnavailableReason: 'redirect/204/HEAD',
			timestamp: 100,
		});
		expect('mimeType' in snap).toBe(false);
		expect(snap.bodyUnavailableReason).toBe('redirect/204/HEAD');
		expect(snap.body).toBeUndefined();
	});
});
