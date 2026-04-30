import { fireEvent, render, screen } from '@testing-library/react';
import type { MetricsAggregate } from '@/lib/networkMetrics';
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

describe('NetworkMetricsBar', () => {
	it('mostra placeholder quando totalRequests da aba ativa é 0', () => {
		render(
			<NetworkMetricsBar
				session={agg()}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={false}
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
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		expect(screen.getByText('1.2 MB')).toBeInTheDocument();
		expect(screen.getByText('245 ms')).toBeInTheDocument();
		// pills "lentas" (3) e "falhas" (1) — qualquer um dos dois pode duplicar texto se igual
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
			/>,
		);
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
	});
});
