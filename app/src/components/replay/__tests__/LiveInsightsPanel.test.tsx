import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Recommendation } from '@/lib/session/types';
import { LiveInsightsPanel } from '../LiveInsightsPanel';

interface MockChrome {
	runtime: {
		onMessage: {
			addListener: ReturnType<typeof vi.fn>;
			removeListener: ReturnType<typeof vi.fn>;
		};
		sendMessage: ReturnType<typeof vi.fn>;
	};
}

let messageListeners: Array<(msg: unknown) => void> = [];
let sendMessageImpl: (msg: unknown) => Promise<unknown> = () =>
	Promise.resolve({ ok: true, liveSnapshot: { detection: null, state: {}, recommendations: [] } });

function installChromeMock(): void {
	messageListeners = [];
	const mock: MockChrome = {
		runtime: {
			onMessage: {
				addListener: vi.fn((cb: (msg: unknown) => void) => {
					messageListeners.push(cb);
				}),
				removeListener: vi.fn((cb: (msg: unknown) => void) => {
					messageListeners = messageListeners.filter((l) => l !== cb);
				}),
			},
			sendMessage: vi.fn((msg: unknown) => sendMessageImpl(msg)),
		},
	};
	(globalThis as unknown as { chrome: typeof chrome }).chrome = mock as unknown as typeof chrome;
}

function deliverMessage(msg: unknown): void {
	for (const listener of [...messageListeners]) listener(msg);
}

const baseDetectionPayload = {
	url: 'https://example.com/page',
	timestamp: 1,
	triggerType: 'initial' as const,
	fingerprint: {
		framework: { name: 'react' as const, version: '18.2.0' },
		libraries: [{ name: 'jquery' as const, version: '3.7.0', confidence: 'high' as const }],
		httpClients: [
			{ name: 'fetch' as const, confidence: 'high' as const },
			{ name: 'xhr' as const, confidence: 'high' as const },
		],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 1,
		isProductionBuild: false,
	},
};

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
	return {
		id: crypto.randomUUID(),
		ruleId: 'csp-missing',
		severity: 'error',
		timestamp: Date.now(),
		url: 'https://example.com/x',
		host: 'example.com',
		summary: 'sumário de teste',
		evidence: {},
		...overrides,
	};
}

beforeEach(() => {
	installChromeMock();
	sendMessageImpl = () =>
		Promise.resolve({
			ok: true,
			liveSnapshot: { detection: null, state: {}, recommendations: [] },
		});
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('LiveInsightsPanel', () => {
	test('mostra estado vazio antes de qualquer detecção', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		expect(await screen.findByText(/Aguardando primeira detecção do probe…/)).toBeInTheDocument();
		expect(screen.getByText(/Nenhum store de estado detectado/)).toBeInTheDocument();
		expect(screen.getByText(/Nenhuma recomendação até agora/)).toBeInTheDocument();
	});

	test('mostra banner quando interceptação está desligada', () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={false} />);
		expect(
			screen.getByText(/Inicie a interceptação para coletar insights desta página/),
		).toBeInTheDocument();
	});

	test('omite seção HTTP Clients quando só fetch/xhr (universais) presentes', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: baseDetectionPayload,
		});

		await waitFor(() =>
			expect(screen.getByRole('heading', { level: 4, name: /^Framework$/ })).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole('heading', { level: 4, name: /^HTTP Clients$/ }),
		).not.toBeInTheDocument();
	});

	test('mostra HTTP Clients quando há clients além de fetch/xhr', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: {
				...baseDetectionPayload,
				fingerprint: {
					...baseDetectionPayload.fingerprint,
					httpClients: [
						{ name: 'fetch' as const, confidence: 'high' as const },
						{ name: 'xhr' as const, confidence: 'high' as const },
						{ name: 'angular-http' as const, confidence: 'medium' as const },
					],
				},
			},
		});

		await waitFor(() =>
			expect(screen.getByRole('heading', { level: 4, name: /^HTTP Clients$/ })).toBeInTheDocument(),
		);
		expect(screen.getByText(/angular-http \(medium\)/)).toBeInTheDocument();
	});

	test('agrupa recomendações em Segurança / Performance com counters', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error' }),
		});
		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'compression-missing', severity: 'warn' }),
		});

		await waitFor(() => expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument());
		expect(screen.getByText(/Performance \(1\)/)).toBeInTheDocument();
	});

	test('omite categoria de recomendações com 0 hits', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error' }),
		});

		await waitFor(() => expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument());
		expect(screen.queryByText(/^Performance \(/)).not.toBeInTheDocument();
	});

	test('hidrata painel via getLiveSnapshot ao montar', async () => {
		const rec = makeRec({ ruleId: 'csp-missing', severity: 'error' });
		sendMessageImpl = () =>
			Promise.resolve({
				ok: true,
				liveSnapshot: {
					detection: {
						url: 'https://hydrated.com/',
						timestamp: 1,
						fingerprint: baseDetectionPayload.fingerprint,
					},
					state: {},
					recommendations: [rec],
				},
			});

		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);

		await waitFor(() =>
			expect(
				(globalThis as { chrome: typeof chrome }).chrome.runtime.sendMessage,
			).toHaveBeenCalledWith(expect.objectContaining({ action: 'getLiveSnapshot', tabId: 1 })),
		);
		expect(await screen.findByText('https://hydrated.com/')).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument());
	});

	test('descarta mensagens de outras tabs', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveRecommendation',
			tabId: 999,
			recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error' }),
		});

		expect(screen.queryByText(/Segurança \(/)).not.toBeInTheDocument();
		expect(screen.getByText(/Nenhuma recomendação até agora/)).toBeInTheDocument();
	});
});
