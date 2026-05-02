import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AntipatternHit } from '@/lib/session/types';
import { LiveAntipatternsPanel } from '../LiveAntipatternsPanel';

vi.mock('@/lib/session/sourceMap', () => ({
	resolveCallsite: vi.fn(async (raw) => ({ raw })),
}));

let listeners: Array<(msg: unknown) => void> = [];

beforeEach(() => {
	listeners = [];
	(globalThis as unknown as { chrome: typeof chrome }).chrome = {
		runtime: {
			onMessage: {
				addListener: (cb: (msg: unknown) => void) => listeners.push(cb),
				removeListener: (cb: (msg: unknown) => void) => {
					listeners = listeners.filter((l) => l !== cb);
				},
			},
		},
	} as unknown as typeof chrome;
});

afterEach(() => {
	vi.restoreAllMocks();
});

const hit = (over: Partial<AntipatternHit> = {}): AntipatternHit => ({
	patternId: 'dup-req-burst',
	severity: 'warn',
	startTimestamp: 100,
	endTimestamp: 200,
	phaseId: 'p1',
	evidenceEventIds: [],
	context: { summary: 'sumario teste' },
	...over,
});

describe('LiveAntipatternsPanel', () => {
	it('não renderiza se tabId é null', () => {
		const { container } = render(<LiveAntipatternsPanel tabId={null} />);
		expect(container.firstChild).toBeNull();
	});

	it('renderiza vazio inicialmente', () => {
		render(<LiveAntipatternsPanel tabId={1} />);
		expect(screen.getByText(/Nenhum antipattern detectado/)).toBeInTheDocument();
	});

	it('insere hit recebido via runtime.onMessage', () => {
		render(<LiveAntipatternsPanel tabId={1} />);
		act(() => {
			listeners.forEach((cb) =>
				cb({ action: 'liveAntipatternHit', tabId: 1, antipatternHit: hit() }),
			);
		});
		expect(screen.getByText('sumario teste')).toBeInTheDocument();
	});

	it('ignora hit de outra tab', () => {
		render(<LiveAntipatternsPanel tabId={1} />);
		act(() => {
			listeners.forEach((cb) =>
				cb({ action: 'liveAntipatternHit', tabId: 2, antipatternHit: hit() }),
			);
		});
		expect(screen.queryByText('sumario teste')).not.toBeInTheDocument();
	});

	it('botão limpar zera lista', async () => {
		const user = userEvent.setup();
		render(<LiveAntipatternsPanel tabId={1} />);
		act(() => {
			listeners.forEach((cb) =>
				cb({ action: 'liveAntipatternHit', tabId: 1, antipatternHit: hit() }),
			);
		});
		expect(screen.getByText('sumario teste')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /limpar/i }));
		expect(screen.queryByText('sumario teste')).not.toBeInTheDocument();
	});
});
