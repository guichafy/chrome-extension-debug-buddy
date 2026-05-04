import { fireEvent, render, screen, within } from '@testing-library/react';
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

	// Regressão Bug 3 + Phase 7 (body capture): clique numa linha abre o
	// drawer com headers e body persistido. Snapshot abaixo simula o que
	// applyBodyPolicy entrega para o session.event.request.
	test('click em linha abre drawer com aba Response renderizando headers + body', () => {
		const reqWithBody: InterceptedResponse = {
			...reqA,
			mimeType: 'application/json',
			headers: { 'content-type': 'application/json' },
			response: {
				headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
				body: '{"users":[]}',
			},
			body: '{"users":[]}',
			request: {
				headers: { authorization: 'Bearer xxx' },
			},
		};
		const evWithBody: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: reqA.url,
				status: 200,
				request: reqWithBody,
			},
		];
		render(<ReplayRequestsTab events={evWithBody} cutoffTimestamp={Number.MAX_SAFE_INTEGER} />);

		// A tabela do command-center registra onClick na célula da URL.
		fireEvent.click(screen.getByText(reqA.url));

		const dialog = screen.getByRole('dialog');
		// Default tab é Overview — não tem headers ainda.
		expect(within(dialog).getByText(/Resource type/)).toBeInTheDocument();

		// Switcha pra Response — headers da resposta + body devem renderizar.
		fireEvent.mouseDown(within(dialog).getByRole('tab', { name: /response/i }), {
			button: 0,
		});
		expect(within(dialog).getByText('x-trace')).toBeInTheDocument();
		// Body de response renderizado por BodyViewer.
		expect(within(dialog).getAllByText(/users/).length).toBeGreaterThan(0);

		// Switcha pra Request — header authorization aparece.
		fireEvent.mouseDown(within(dialog).getByRole('tab', { name: /^request$/i }), {
			button: 0,
		});
		expect(within(dialog).getByText('authorization')).toBeInTheDocument();
	});

	test('drawer mostra reason quando body indisponivel (binario/over-cap)', () => {
		const reqNoBody: InterceptedResponse = {
			...reqA,
			mimeType: 'image/png',
			headers: { 'content-type': 'image/png' },
			bodyUnavailableReason: 'Body de response omitido: tipo image/png nao e textual.',
			response: { headers: { 'content-type': 'image/png' } },
		};
		const ev: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: reqA.url,
				status: 200,
				request: reqNoBody,
			},
		];
		render(<ReplayRequestsTab events={ev} cutoffTimestamp={Number.MAX_SAFE_INTEGER} />);
		fireEvent.click(screen.getByText(reqA.url));
		const dialog = screen.getByRole('dialog');
		fireEvent.mouseDown(within(dialog).getByRole('tab', { name: /response/i }), {
			button: 0,
		});
		expect(within(dialog).getByText(/nao e textual/)).toBeInTheDocument();
	});
});
