import { render, screen } from '@testing-library/react';
import type { SessionEvent } from '@/lib/session/types';
import { ReplayRequestsTab } from '../ReplayRequestsTab';

describe('ReplayRequestsTab', () => {
	const events: SessionEvent[] = [
		{
			type: 'network',
			timestamp: 100,
			phaseId: 'p1',
			requestId: 'r1',
			method: 'GET',
			url: 'https://api.test/users',
			status: 200,
			durationMs: 30,
		},
		{
			type: 'network',
			timestamp: 500,
			phaseId: 'p1',
			requestId: 'r2',
			method: 'POST',
			url: 'https://api.test/users',
			status: 201,
			durationMs: 80,
		},
	];

	test('renderiza apenas requests <= cutoffTimestamp', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={200} />);
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.queryByText('POST')).not.toBeInTheDocument();
	});

	test('empty state quando nenhuma request capturada antes do playhead', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={50} />);
		expect(screen.getByText(/Nenhuma requisição capturada até este ponto/i)).toBeInTheDocument();
	});

	test('renderiza todas quando cutoff cobre tudo', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={Number.MAX_SAFE_INTEGER} />);
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.getByText('POST')).toBeInTheDocument();
	});
});
