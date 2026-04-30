import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import type { SessionMarker } from '@/types/sessionMarker';
import { NetworkMetricsBar } from '../NetworkMetricsBar';

function agg(overrides: Partial<MetricsAggregate> = {}): MetricsAggregate {
	return {
		totalRequests: 0,
		totalBytes: null,
		avgTtfbMs: null,
		slowCount: 0,
		failedCount: 0,
		...overrides,
	};
}

const emptyMarker: SessionMarker = {
	sessionStartedAt: null,
	currentPageUrl: null,
	currentPageNavigatedAt: null,
};

describe('NetworkMetricsBar', () => {
	it('mostra placeholder quando totalRequests da aba ativa é 0', () => {
		render(
			<NetworkMetricsBar
				session={agg()}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={false}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getByText(/sem requests/i)).toBeInTheDocument();
	});

	it('renderiza as 5 pills da Sessão por padrão', () => {
		render(
			<NetworkMetricsBar
				session={agg({
					totalRequests: 47,
					totalBytes: 1024 * 1024 * 1.2,
					avgTtfbMs: 245,
					slowCount: 3,
					failedCount: 1,
				})}
				currentPage={agg()}
				hasCurrentPage={true}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		expect(screen.getByText('1.2 MB')).toBeInTheDocument();
		expect(screen.getByText('245 ms')).toBeInTheDocument();
		expect(screen.getAllByText('3').length).toBeGreaterThan(0);
		expect(screen.getAllByText('1').length).toBeGreaterThan(0);
	});

	it('alterna para janela "Página atual" ao clicar na tab', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 47 })}
				currentPage={agg({ totalRequests: 12 })}
				hasCurrentPage={true}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		// Radix Tabs reage a mouseDown (não click); jsdom não dispara o ciclo completo.
		fireEvent.mouseDown(screen.getByRole('tab', { name: /página/i }));
		expect(screen.getByText('12')).toBeInTheDocument();
	});

	it('desabilita tab "Página" quando hasCurrentPage é false', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		const pageTab = screen.getByRole('tab', { name: /página/i });
		expect(pageTab).toBeDisabled();
	});

	it('aplica classe de cor de aviso quando slowCount > 0', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 2 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		const slowPill = container.querySelector('[data-pill="slow"]');
		expect(slowPill?.className).toMatch(/text-amber/);
	});

	it('aplica classe destrutiva quando failedCount > 0', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, failedCount: 1 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		const failPill = container.querySelector('[data-pill="failed"]');
		expect(failPill?.className).toMatch(/text-destructive/);
	});

	it('renderiza "—" para totalBytes/avgTtfbMs nulls', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, totalBytes: null, avgTtfbMs: null })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
	});

	it('Pill clicável vira <button> e chama onPillClick', () => {
		const onClick = vi.fn();
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 2 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				onPillClick={onClick}
			/>,
		);
		const slowButton = document.querySelector('[data-pill="slow"]');
		expect(slowButton?.tagName).toBe('BUTTON');
		(slowButton as HTMLButtonElement)?.click();
		expect(onClick).toHaveBeenCalledWith('slow');
	});

	it('Pill binária com 0 fica aria-disabled', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 0, failedCount: 0 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				onPillClick={vi.fn()}
			/>,
		);
		const slowEl = document.querySelector('[data-pill="slow"]');
		expect(slowEl?.getAttribute('aria-disabled')).toBe('true');
	});

	it('aceita sessionDetails sem crash quando fornecido', () => {
		// Conteúdo do tooltip só renderiza quando o usuário hover/focus na pill —
		// Radix Tooltip + jsdom não simula hover real de forma confiável. O smoke
		// check visual cobre a renderização do detail. Aqui apenas garantimos que
		// passar `sessionDetails` não quebra a montagem do componente.
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				sessionDetails={{
					total: { byMethod: [['GET', 5]], byStatusRange: { '2xx': 5, '3xx': 0, '4xx5xx': 0 } },
					bytes: { top: [] },
					ttfb: null,
					slow: { top: [] },
					failed: { list: [] },
				}}
			/>,
		);
		expect(container.querySelector('[data-pill="total"]')).not.toBeNull();
	});
});
