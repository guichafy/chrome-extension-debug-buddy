import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AntipatternHit } from '@/lib/session/types';
import { AntipatternsTab } from '../AntipatternsTab';

vi.mock('@/lib/session/sourceMap', () => ({
	resolveCallsite: vi.fn(async (raw) => ({ raw })),
}));

const hits: AntipatternHit[] = [
	{
		patternId: 'retry-storm',
		severity: 'error',
		startTimestamp: 100,
		endTimestamp: 200,
		phaseId: 'p1',
		evidenceEventIds: [],
		context: { summary: 'erro' },
	},
	{
		patternId: 'waterfall',
		severity: 'info',
		startTimestamp: 300,
		endTimestamp: 1500,
		phaseId: 'p1',
		evidenceEventIds: [],
		context: { summary: 'cadeia' },
	},
];

describe('AntipatternsTab', () => {
	it('mostra todos os hits por padrão', () => {
		render(<AntipatternsTab hits={hits} startedAt={0} />);
		expect(screen.getByText('retry-storm')).toBeInTheDocument();
		expect(screen.getByText('waterfall')).toBeInTheDocument();
		expect(screen.getByText('2 / 2')).toBeInTheDocument();
	});

	it('filtra por severity quando checkbox desmarcado', async () => {
		const user = userEvent.setup();
		render(<AntipatternsTab hits={hits} startedAt={0} />);
		await user.click(screen.getByLabelText('info'));
		expect(screen.queryByText('waterfall')).not.toBeInTheDocument();
		expect(screen.getByText('retry-storm')).toBeInTheDocument();
		expect(screen.getByText('1 / 2')).toBeInTheDocument();
	});

	it('mostra mensagem vazia quando lista vazia', () => {
		render(<AntipatternsTab hits={[]} startedAt={0} />);
		expect(screen.getByText(/Nenhum antipattern detectado/)).toBeInTheDocument();
	});
});
