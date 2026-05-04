import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
		// Sem hosts, picker não é renderizado.
		expect(screen.queryByTestId('live-insights-host-picker')).not.toBeInTheDocument();
	});

	test('mostra banner quando interceptação está desligada', () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={false} />);
		expect(
			screen.getByText(/Inicie a interceptação para coletar insights desta página/),
		).toBeInTheDocument();
	});

	test('mostra empty state de techs quando detection chega sem techs', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: baseDetectionPayload,
		});

		await waitFor(() =>
			expect(
				screen.getByText(/Nenhuma tecnologia detectada para este host ainda/),
			).toBeInTheDocument(),
		);
		// URL do host deve aparecer mesmo no empty state.
		expect(screen.getByText('https://example.com/page')).toBeInTheDocument();
	});

	test('renderiza TechCategorySection quando techs chegam junto com a detection', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: {
				...baseDetectionPayload,
				techs: [{ name: 'React', cats: [12], confidence: 100, evidence: [] }],
			},
		});

		// Tech aparece tanto no picker badge quanto no TechItem — usar getAllByText.
		await waitFor(() => expect(screen.getAllByText('React').length).toBeGreaterThan(0));
		// Não deve mostrar o empty state de techs.
		expect(
			screen.queryByText(/Nenhuma tecnologia detectada para este host ainda/),
		).not.toBeInTheDocument();
	});

	test('agrupa recomendações em Segurança / Performance com counters (host único)', async () => {
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
		const detailsEl = ruleLabel.closest('details');
		expect(detailsEl).not.toBeNull();
		expect(detailsEl?.hasAttribute('open')).toBe(false);
	});

	test('picker aparece quando há ao menos 1 host e foca no mais recente', async () => {
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

		// b.com foi a última detection: select inicia nele.
		const trigger = await screen.findByTestId('live-insights-host-picker');
		expect(trigger).toHaveTextContent('b.com');
		expect(trigger).toHaveTextContent('angular 17.0.0');
		// URL detalhada do host selecionado aparece no corpo.
		expect(screen.getByText('https://b.com/page')).toBeInTheDocument();
		// URL do host não selecionado NÃO está no DOM (foco em um host de cada vez).
		expect(screen.queryByText('https://a.com/page')).not.toBeInTheDocument();
		// Subtítulo do header reflete totais.
		expect(screen.getByText(/2 hosts/)).toBeInTheDocument();
	});

	test('trocar de host via picker re-renderiza apenas o conteúdo do novo host', async () => {
		const user = userEvent.setup();
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		// Setup: 2 hosts com recomendações distintas. b.com é o mais recente.
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

		// Default: b.com selecionado → vê Performance (compression).
		await waitFor(() => expect(screen.getByText(/Performance \(1\)/)).toBeInTheDocument());
		expect(screen.queryByText(/Segurança \(/)).not.toBeInTheDocument();

		// Abre o picker e seleciona a.com.
		const trigger = screen.getByTestId('live-insights-host-picker');
		await user.click(trigger);
		const aOption = await screen.findByTestId('live-insights-host-option-a.com');
		await user.click(aOption);

		await waitFor(() => expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument());
		expect(screen.queryByText(/Performance \(/)).not.toBeInTheDocument();
		expect(screen.getByText('https://a.com/page')).toBeInTheDocument();
		expect(screen.queryByText('https://b.com/page')).not.toBeInTheDocument();
	});

	test('host com recomendações mas sem detection ainda aparece no picker', async () => {
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveRecommendation',
			tabId: 1,
			recommendation: makeRec({ ruleId: 'csp-missing', severity: 'error', host: 'cdn.com' }),
		});

		const trigger = await screen.findByTestId('live-insights-host-picker');
		expect(trigger).toHaveTextContent('cdn.com');
		expect(screen.getByText(/Sem detecção do probe para este host/)).toBeInTheDocument();
		expect(screen.getByText(/Segurança \(1\)/)).toBeInTheDocument();
	});

	test('limpar reseta seleção e volta para empty state', async () => {
		const user = userEvent.setup();
		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);
		await waitFor(() => expect(messageListeners.length).toBeGreaterThan(0));

		deliverMessage({
			action: 'liveDetection',
			tabId: 1,
			payload: baseDetectionPayload,
		});
		await waitFor(() =>
			expect(screen.getByTestId('live-insights-host-picker')).toBeInTheDocument(),
		);

		await user.click(screen.getByRole('button', { name: 'limpar' }));

		expect(screen.queryByTestId('live-insights-host-picker')).not.toBeInTheDocument();
		expect(screen.getByText(/Aguardando primeira detecção do probe…/)).toBeInTheDocument();
	});
});

describe('LiveInsightsPanel — techs flow', () => {
	test('hidratação carrega techs do snapshot', async () => {
		const sendMessage = vi.fn(async (msg: { action: string }) => {
			if (msg.action === 'getLiveSnapshot') {
				return {
					ok: true,
					liveSnapshot: {
						detections: [
							{
								host: 'wordpress.org',
								url: 'https://wordpress.org/',
								timestamp: Date.now(),
								fingerprint: legacyFingerprint(),
								techs: [{ name: 'WordPress', cats: [1], confidence: 100, evidence: [] }],
							},
						],
						recommendations: [],
					},
				};
			}
			return undefined;
		});
		(chrome.runtime as unknown as { sendMessage: typeof sendMessage }).sendMessage = sendMessage;

		render(<LiveInsightsPanel tabId={1} isInterceptionActive={true} />);

		// WordPress aparece tanto no picker badge quanto no TechItem — usar findAllByText.
		expect((await screen.findAllByText('WordPress')).length).toBeGreaterThan(0);
	});
});

function legacyFingerprint() {
	return {
		framework: { name: 'vanilla' as const },
		libraries: [],
		httpClients: [],
		dataFetching: [],
		detectedAt: Date.now(),
		isProductionBuild: false,
	};
}
