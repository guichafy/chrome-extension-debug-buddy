import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { compressDiff, computeDiff } from '@/lib/session/state/diff';
import type { DetectionPhase, SessionEvent } from '@/lib/session/types';
import { StateInspector } from '../StateInspector';

function makePhase(): DetectionPhase {
	return {
		id: 'p1',
		startTimestamp: 0,
		endTimestamp: 1000,
		fingerprint: {
			framework: { name: 'react' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: 0,
			isProductionBuild: false,
		},
		pages: [],
		stateBaseline: {
			'redux:1': {
				storeId: 'redux:1',
				storeKind: 'redux',
				data: { count: 0 },
				timestamp: 100,
			},
			'zustand:1': {
				storeId: 'zustand:1',
				storeKind: 'zustand',
				data: { theme: 'light' },
				timestamp: 100,
			},
		},
		stateKeyframes: [],
	};
}

describe('StateInspector', () => {
	it('mostra mensagem quando não há fase', () => {
		render(<StateInspector phase={null} events={[]} playheadTimestamp={0} />);
		expect(screen.getByText(/Sem fase selecionada/)).toBeInTheDocument();
	});

	it('mostra mensagem quando fase não tem stores', () => {
		const phase = makePhase();
		phase.stateBaseline = {};
		render(<StateInspector phase={phase} events={[]} playheadTimestamp={100} />);
		expect(screen.getByText(/Nenhum store de estado capturado/)).toBeInTheDocument();
	});

	it('renderiza estado do store selecionado e troca via select', () => {
		const phase = makePhase();
		const events: SessionEvent[] = [
			{
				type: 'state',
				timestamp: 200,
				phaseId: 'p1',
				storeId: 'redux:1',
				storeKind: 'redux',
				diffCompressed: compressDiff(computeDiff({ count: 0 }, { count: 7 })),
				sequenceNum: 1,
			},
		];
		render(<StateInspector phase={phase} events={events} playheadTimestamp={250} />);
		expect(screen.getByText('count:')).toBeInTheDocument();
		expect(screen.getByText('7')).toBeInTheDocument();

		const select = screen.getByLabelText('Store:') as HTMLSelectElement;
		fireEvent.change(select, { target: { value: 'zustand:1' } });
		expect(screen.getByText('theme:')).toBeInTheDocument();
		expect(screen.getByText('"light"')).toBeInTheDocument();
	});
});

describe('StateInspector — Phase 5 storeKinds', () => {
	function makeAngularPhase(): DetectionPhase {
		return {
			id: 'p1',
			startTimestamp: 0,
			endTimestamp: 1000,
			fingerprint: {
				framework: { name: 'angular' as const, version: '17' },
				httpClients: [],
				dataFetching: [],
				stateManagers: [],
				detectedAt: 0,
				isProductionBuild: false,
			},
			pages: [],
			stateBaseline: {
				'sig:1': {
					storeId: 'sig:1',
					storeKind: 'angular-signal' as const,
					data: 0,
					timestamp: 100,
				},
			},
		};
	}

	it('renderiza label "Angular Signal" para storeKind=angular-signal', () => {
		render(<StateInspector phase={makeAngularPhase()} events={[]} playheadTimestamp={100} />);
		expect(screen.getByText('Angular Signal')).toBeInTheDocument();
	});

	it('renderiza label "NgRx" para storeKind=ngrx', () => {
		const phase = makeAngularPhase();
		phase.stateBaseline = {
			'ngrx:root': {
				storeId: 'ngrx:root',
				storeKind: 'ngrx' as const,
				data: { count: 0 },
				timestamp: 100,
			},
		};
		render(<StateInspector phase={phase} events={[]} playheadTimestamp={100} />);
		expect(screen.getByText('NgRx')).toBeInTheDocument();
	});
});
