import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetForTests, sessionStore } from '@/lib/session/storage';
import type { Session } from '@/lib/session/types';
import { ReplayPage } from '../ReplayPage';

// Mock RrwebPlayer pra evitar montar rrweb-player real (já testado isolado).
vi.mock('@/components/replay/RrwebPlayer', () => ({
	RrwebPlayer: () => <div data-testid="rrweb-player-mock" />,
}));

const baseSession = (overrides: Partial<Session> = {}): Session => ({
	id: 'sess_test',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
	...overrides,
});

function renderAt(sessionId: string) {
	return render(
		<MemoryRouter initialEntries={[`/replay/${sessionId}`]}>
			<Routes>
				<Route path="/replay/:sessionId" element={<ReplayPage />} />
			</Routes>
		</MemoryRouter>,
	);
}

beforeEach(async () => {
	_resetForTests();
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('ReplayPage', () => {
	it('mostra fallback quando rrwebEvents ausente', async () => {
		await sessionStore.put(baseSession());
		renderAt('sess_test');
		await waitFor(() => {
			expect(screen.getByText(/Sessão sem captura visual/i)).toBeInTheDocument();
		});
	});

	it('renderiza RrwebPlayer quando rrwebEvents tem >=2 eventos', async () => {
		await sessionStore.put(
			baseSession({
				id: 'sess_with_rrweb',
				rrwebEvents: [
					{ type: 4, timestamp: 1_000, data: {} },
					{ type: 2, timestamp: 1_001, data: {} },
				],
			}),
		);
		renderAt('sess_with_rrweb');
		await waitFor(() => {
			expect(screen.getByTestId('rrweb-player-mock')).toBeInTheDocument();
		});
	});

	it('inicialmente filtra eventos com timestamp > startedAt + currentMs (currentMs=0)', async () => {
		await sessionStore.put(
			baseSession({
				id: 'sess_filter',
				events: [
					{
						type: 'route',
						timestamp: 1_500,
						phaseId: 'p1',
						url: 'https://x',
						triggerType: 'initial',
					},
				],
			}),
		);
		renderAt('sess_filter');
		await waitFor(() => {
			// currentMs=0 → cutoff=1000, evento em 1500 NÃO aparece
			expect(screen.getByText(/Nenhum evento até o ponto atual/i)).toBeInTheDocument();
		});
	});

	it('expoe aba Requisicoes', async () => {
		await sessionStore.put(
			baseSession({
				id: 'sess_requests_tab',
				events: [
					{
						type: 'network',
						timestamp: 1_100,
						phaseId: 'p',
						requestId: 'r1',
						method: 'GET',
						url: 'https://api/users',
						status: 200,
						durationMs: 30,
					},
				],
			}),
		);
		renderAt('sess_requests_tab');
		expect(await screen.findByText(/Requisições/)).toBeInTheDocument();
	});
});
