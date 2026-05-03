import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
	Promise.resolve({ ok: true, liveSnapshot: { detections: [], recommendations: [] } });

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

const baseFingerprint = {
	framework: { name: 'react' as const, version: '18.2.0' },
	libraries: [{ name: 'jquery' as const, version: '3.7.0', confidence: 'high' as const }],
	httpClients: [
		{ name: 'fetch' as const, confidence: 'high' as const },
		{ name: 'xhr' as const, confidence: 'high' as const },
	],
	dataFetching: [],
	detectedAt: 1,
	isProductionBuild: false,
};

const baseDetectionPayload = {
	url: 'https://example.com/page',
	timestamp: 1,
	triggerType: 'initial' as const,
	fingerprint: baseFingerprint,
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
			liveSnapshot: { detections: [], recommendations: [] },
		});
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('LiveInsightsPanel', () => {
	test('mostra estado vazio antes de qualquer detecção', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		expect(await screen.findByText(/Aguardando primeira detecção do probe…/)).toBeInTheDocument();
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
		const rec = makeRec({ ruleId: 'csp-missing', severity: 'error', host: 'hydrated.com' });
		sendMessageImpl = () =>
			Promise.resolve({
				ok: true,
				liveSnapshot: {
					detections: [
						{
							host: 'hydrated.com',
							url: 'https://hydrated.com/',
							timestamp: 1,
							fingerprint: baseFingerprint,
						},
					],
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

	test('agrupa instâncias da mesma rule (mesmo host) sob um sub-grupo', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		// Duas instâncias da mesma rule no mesmo host devem agrupar; a terceira
		// (rule diferente) gera um segundo sub-grupo.
		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({
				ruleId: 'csp-missing',
				severity: 'error',
				host: 'a.com',
				url: 'https://a.com/p1',
			}),
		});
		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({
				ruleId: 'csp-missing',
				severity: 'error',
				host: 'a.com',
				url: 'https://a.com/p2',
			}),
		});
		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'hsts-missing', severity: 'error', host: 'a.com' }),
		});

		await waitFor(() => expect(screen.getByText(/Segurança \(3\)/)).toBeInTheDocument());
		expect(screen.getByText('csp-missing')).toBeInTheDocument();
		expect(screen.getByText(/^\(2\)$/)).toBeInTheDocument();
		expect(screen.getByText('hsts-missing')).toBeInTheDocument();
	});

	test('grupos de regras começam collapsed (details sem open)', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({
				ruleId: 'csp-missing',
				severity: 'error',
				url: 'https://x.com/api/users',
				host: 'x.com',
			}),
		});

		const ruleLabel = await screen.findByText('csp-missing');
		// Sub-grupo (<details>) deve estar collapsed por default — sem atributo `open`.
		const detailsEl = ruleLabel.closest('details');
		expect(detailsEl).not.toBeNull();
		expect(detailsEl?.hasAttribute('open')).toBe(false);
	});

	test('agrupa insights por host (DNS): cada host vira uma seção colapsável', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: { ...baseDetectionPayload, url: 'https://a.com/page' },
		});
		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: {
				...baseDetectionPayload,
				url: 'https://b.com/page',
				fingerprint: {
					...baseFingerprint,
					framework: { name: 'angular' as const, version: '17.0.0' },
				},
			},
		});

		await waitFor(() =>
			expect(screen.getByTestId('live-insights-host-toggle-a.com')).toBeInTheDocument(),
		);
		// b.com foi a última detecção: aparece no topo (mais recente primeiro).
		const sections = document.querySelectorAll('section[data-host]');
		expect(sections[0].getAttribute('data-host')).toBe('b.com');
		expect(sections[1].getAttribute('data-host')).toBe('a.com');
	});

	test('recomendações vão pra seção do host correto', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: { ...baseDetectionPayload, url: 'https://a.com/page' },
		});
		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: { ...baseDetectionPayload, url: 'https://b.com/page' },
		});
		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error', host: 'a.com' }),
		});
		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'compression-missing', severity: 'warn', host: 'b.com' }),
		});

		await waitFor(() => expect(screen.getByText(/2 hosts/)).toBeInTheDocument());
		expect(screen.getByText(/2 recomendações/)).toBeInTheDocument();

		// Cada host só renderiza suas próprias categorias.
		const aSection = document.querySelector('section[data-host="a.com"]') as HTMLElement | null;
		expect(aSection).not.toBeNull();
		expect(within(aSection as HTMLElement).getByText(/Segurança \(1\)/)).toBeInTheDocument();
		expect(within(aSection as HTMLElement).queryByText(/Performance/)).not.toBeInTheDocument();

		const bSection = document.querySelector('section[data-host="b.com"]') as HTMLElement | null;
		expect(bSection).not.toBeNull();
		expect(within(bSection as HTMLElement).getByText(/Performance \(1\)/)).toBeInTheDocument();
	});

	test('host fica colapsável: clique fecha o conteúdo do host', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: baseDetectionPayload,
		});

		const toggle = await screen.findByTestId('live-insights-host-toggle-example.com');
		expect(screen.getByRole('heading', { level: 4, name: /^Framework$/ })).toBeInTheDocument();

		fireEvent.click(toggle);
		expect(
			screen.queryByRole('heading', { level: 4, name: /^Framework$/ }),
		).not.toBeInTheDocument();
	});

	test('host com recomendações mas sem detection ainda aparece na lista', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error', host: 'cdn.com' }),
		});

		await waitFor(() =>
			expect(screen.getByTestId('live-insights-host-toggle-cdn.com')).toBeInTheDocument(),
		);
		const section = document.querySelector('section[data-host="cdn.com"]') as HTMLElement | null;
		expect(section).not.toBeNull();
		expect(within(section as HTMLElement).getByText(/Sem detecção do probe/)).toBeInTheDocument();
	});
});
