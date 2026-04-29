import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { RequestTimeline } from '../RequestTimeline';

describe('RequestTimeline', () => {
	const requests = {
		r1: {
			url: 'https://api.example.com/users',
			method: 'GET',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'XHR',
			timestamp: 1,
		},
	};

	test('chama onSelect ao clicar em uma linha', () => {
		const onSelect = vi.fn();
		render(
			<RequestTimeline
				requests={requests as any}
				selectedId={null}
				onSelect={onSelect}
				filters={[]}
				onFiltersChange={vi.fn()}
				onClearHistory={vi.fn()}
				autoRefreshEnabled
				pauseAutoRefresh={vi.fn()}
				enableAutoRefresh={vi.fn()}
			/>,
		);
		const row = screen.getByText(/users/);
		fireEvent.click(row);
		expect(onSelect).toHaveBeenCalledWith('r1');
	});

	test('marca a linha selecionada com data-state="selected"', () => {
		const { container } = render(
			<RequestTimeline
				requests={requests as any}
				selectedId="r1"
				onSelect={vi.fn()}
				filters={[]}
				onFiltersChange={vi.fn()}
				onClearHistory={vi.fn()}
				autoRefreshEnabled
				pauseAutoRefresh={vi.fn()}
				enableAutoRefresh={vi.fn()}
			/>,
		);
		const selected = container.querySelector('[data-state="selected"]');
		expect(selected).not.toBeNull();
	});
});
