import { render, screen } from '@testing-library/react';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import { NetworkMetricsBar } from '../NetworkMetricsBar';

function agg(overrides: Partial<MetricsAggregate> = {}): MetricsAggregate {
	return {
		totalRequests: 0,
		totalBytes: null,
		totalResourceBytes: null,
		avgTtfbMs: null,
		slowCount: 0,
		failedCount: 0,
		...overrides,
	};
}

describe('NetworkMetricsBar', () => {
	it('mostra placeholder quando totalRequests da sessão é 0', () => {
		render(<NetworkMetricsBar session={agg()} />);
		expect(screen.getByText(/sem requests/i)).toBeInTheDocument();
	});

	it('renderiza as três pills do footer com valores formatados', () => {
		render(
			<NetworkMetricsBar
				session={agg({
					totalRequests: 5,
					totalBytes: 19763, // ~19.3 KB
					totalResourceBytes: 7270, // ~7.1 KB
				})}
			/>,
		);
		expect(screen.getByText('5 requests')).toBeInTheDocument();
		expect(screen.getByText(/19\.3 KB transferred/)).toBeInTheDocument();
		expect(screen.getByText(/7\.1 KB resources/)).toBeInTheDocument();
	});

	it('mostra "—" para bytes/resources nulls (sem fallback fictício)', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 3, totalBytes: null, totalResourceBytes: null })}
			/>,
		);
		expect(screen.getByText('3 requests')).toBeInTheDocument();
		expect(screen.getByText('— transferred')).toBeInTheDocument();
		expect(screen.getByText('— resources')).toBeInTheDocument();
	});

	it('cada pill tem data-pill identificável e renderiza como <span>', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 1, totalBytes: 100, totalResourceBytes: 50 })}
			/>,
		);
		for (const name of ['requests', 'transferred', 'resources']) {
			const pill = container.querySelector(`[data-pill="${name}"]`);
			expect(pill).not.toBeNull();
			expect(pill?.tagName).toBe('SPAN');
		}
	});
});
