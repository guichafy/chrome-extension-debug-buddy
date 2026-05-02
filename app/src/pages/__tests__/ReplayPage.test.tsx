import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetForTests, sessionStore } from '@/lib/session/storage';
import { ReplayPage } from '../ReplayPage';
import type { Session } from '@/lib/session/types';

const baseSession = (): Session => ({
	id: 'sess_x',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 5_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [
		{
			id: 'phase_1',
			startTimestamp: 1_000,
			endTimestamp: 1_500,
			fingerprint: {
				framework: { name: 'react', version: '18.2.0' },
				httpClients: [{ name: 'fetch', confidence: 'high' }],
				dataFetching: [],
				stateManagers: [],
				detectedAt: 1_000,
				isProductionBuild: false,
			},
			pages: [
				{
					url: 'https://example/',
					timestamp: 1_000,
					fingerprint: {} as never,
					triggerType: 'initial',
				},
			],
		},
	],
	events: [
		{
			type: 'network',
			timestamp: 2_000,
			phaseId: 'phase_1',
			requestId: 'r1',
			method: 'GET',
			url: 'https://api/x',
			status: 200,
		},
		{
			type: 'console',
			timestamp: 2_500,
			phaseId: 'phase_1',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'hello' }],
		},
	],
});

beforeEach(async () => {
	_resetForTests();
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('ReplayPage', () => {
	it('renderiza eventos da sessão e contagem', async () => {
		await sessionStore.put(baseSession());
		render(
			<MemoryRouter initialEntries={['/replay/sess_x']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText(/Replay/i)).toBeInTheDocument());
		expect(screen.getByText(/2 eventos · 1 fases/i)).toBeInTheDocument();
		expect(screen.getByText(/\[GET\]/)).toBeInTheDocument();
		expect(screen.getByText(/\[LOG\] hello/)).toBeInTheDocument();
	});

	it('renderiza fase com framework', async () => {
		await sessionStore.put(baseSession());
		render(
			<MemoryRouter initialEntries={['/replay/sess_x']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText(/react/i)).toBeInTheDocument());
	});

	it('mostra "Carregando…" quando sessionId não encontrado', () => {
		render(
			<MemoryRouter initialEntries={['/replay/inexistente']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
	});
});
