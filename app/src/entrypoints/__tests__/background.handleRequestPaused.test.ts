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

describe('Phase 7 — requestModified em terminais do Request stage', () => {
	test('buildRequestMockResponse SEM requestModified gera appliedTypes=[mock] e sem snapshot', async () => {
		const { buildRequestMockResponse } = await import('../background');
		const out = buildRequestMockResponse(
			{
				url: 'https://api.test/users',
				method: 'GET',
				resourceType: 'xhr',
				requestHeaders: { accept: 'application/json' },
				postData: undefined,
			},
			{ status: 200, statusPhrase: 'OK', headers: {}, body: '[]' },
			Date.now(),
		);
		expect(out.requestModified).toBeUndefined();
		expect(out.appliedTypes).toEqual(['mock']);
	});

	test('buildRequestMockResponse COM requestModified anexa snapshot + appliedTypes inclui requestModify', async () => {
		const { buildRequestMockResponse } = await import('../background');
		const out = buildRequestMockResponse(
			{
				url: 'https://api.test/users',
				method: 'GET',
				resourceType: 'xhr',
				requestHeaders: { accept: 'application/json' },
				postData: undefined,
			},
			{ status: 200, statusPhrase: 'OK', headers: {}, body: '[]' },
			Date.now(),
			{ headers: { accept: 'application/json', 'x-injected': '1' } },
		);
		expect(out.requestModified).toEqual({
			headers: { accept: 'application/json', 'x-injected': '1' },
		});
		expect(out.appliedTypes).toEqual(['requestModify', 'mock']);
	});

	test('buildRequestBlockResponse COM requestModified anexa snapshot + appliedTypes inclui requestModify', async () => {
		const { buildRequestBlockResponse } = await import('../background');
		const out = buildRequestBlockResponse(
			{
				url: 'https://api.test/users',
				method: 'POST',
				resourceType: 'xhr',
				requestHeaders: { accept: 'application/json' },
				postData: '{"old":true}',
			},
			'Failed',
			{ postData: '{"new":true}' },
		);
		expect(out.requestModified).toEqual({ postData: '{"new":true}' });
		expect(out.appliedTypes).toEqual(['requestModify', 'block']);
		expect(out.status).toBe(0);
	});
});
