import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AntipatternHit } from '@/lib/session/types';
import { AntipatternHitRow } from '../AntipatternHitRow';

vi.mock('@/lib/session/sourceMap', () => ({
	resolveCallsite: vi.fn(async (raw) => ({
		raw,
		resolved: { file: 'src/foo.ts', line: 42 },
	})),
}));

const baseHit: AntipatternHit = {
	patternId: 'dup-req-burst',
	severity: 'warn',
	startTimestamp: 1500,
	endTimestamp: 1900,
	phaseId: 'p1',
	evidenceEventIds: [],
	context: { summary: '3× GET /api/x em 400ms' },
};

describe('AntipatternHitRow', () => {
	it('renderiza patternId, severity e summary', () => {
		render(<AntipatternHitRow hit={baseHit} startedAt={1000} />);
		expect(screen.getByText('dup-req-burst')).toBeInTheDocument();
		expect(screen.getByText('warn')).toBeInTheDocument();
		expect(screen.getByText(/3× GET/)).toBeInTheDocument();
		expect(screen.getByText('+0.50s')).toBeInTheDocument();
	});

	it('renderiza callsite raw quando ainda não resolveu', () => {
		const hit: AntipatternHit = {
			...baseHit,
			context: {
				...baseHit.context,
				callsite: { raw: { file: 'http://x/bundle.js', line: 1, column: 500 } },
			},
		};
		render(<AntipatternHitRow hit={hit} startedAt={1000} />);
		expect(screen.getByText(/bundle\.js:1/)).toBeInTheDocument();
	});

	it('mostra sugestão como tooltip', () => {
		const hit = { ...baseHit, suggestion: 'use debounce' };
		render(<AntipatternHitRow hit={hit} startedAt={1000} />);
		const tip = screen.getByTitle('use debounce');
		expect(tip).toBeInTheDocument();
	});
});
