import { render, screen } from '@testing-library/react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionEvent } from '@/lib/session/types';
import { ReplayRequestsTab } from '../ReplayRequestsTab';

// Não mockamos RequestTimeline aqui — queremos render real para verificar
// que a integração funciona. As columns do Command Center exibem URL e método
// como texto cru, sem depender de contexto externo (já validado em columns.test).

describe('ReplayRequestsTab', () => {
	const reqA: InterceptedResponse = {
		url: 'https://api.test/users',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'xhr',
		timestamp: 100,
	};
	const reqB: InterceptedResponse = {
		url: 'https://api.test/posts',
		method: 'POST',
		status: 201,
		statusText: 'Created',
		headers: {},
		type: 'xhr',
		timestamp: 500,
	};
	const events: SessionEvent[] = [
		{
			type: 'network',
			timestamp: 100,
			phaseId: 'p1',
			requestId: 'r1',
			method: 'GET',
			url: 'https://api.test/users',
			status: 200,
			request: reqA,
		},
		{
			type: 'network',
			timestamp: 500,
			phaseId: 'p1',
			requestId: 'r2',
			method: 'POST',
			url: 'https://api.test/posts',
			status: 201,
			request: reqB,
		},
	];

	test('renderiza apenas requests <= cutoff', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={200} />);
		expect(screen.getByText(reqA.url)).toBeInTheDocument();
		expect(screen.queryByText(reqB.url)).not.toBeInTheDocument();
	});

	test('empty state quando nada capturado antes do playhead', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={50} />);
		expect(screen.getByText(/Nenhuma requisição capturada até este ponto/i)).toBeInTheDocument();
	});

	test('empty state especial para sessao antiga sem snapshot', () => {
		const oldEvents: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://api.test/users',
				status: 200,
				// sem request — sessão pré-Fase 7
			},
		];
		render(<ReplayRequestsTab events={oldEvents} cutoffTimestamp={Number.MAX_SAFE_INTEGER} />);
		expect(screen.getByText(/Sessão gravada antes da Fase 7/i)).toBeInTheDocument();
	});

	test('renderiza todas com cutoff infinito', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={Number.MAX_SAFE_INTEGER} />);
		expect(screen.getByText(reqA.url)).toBeInTheDocument();
		expect(screen.getByText(reqB.url)).toBeInTheDocument();
	});
});
