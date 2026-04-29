import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { FilterBar } from '../FilterBar';

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

(globalThis as any).ResizeObserver = ResizeObserverMock;
Element.prototype.scrollIntoView = vi.fn();

describe('FilterBar', () => {
	test('mantém sugestões abertas ao focar e clicar no campo vazio', async () => {
		render(<FilterBar filters={[]} onFiltersChange={vi.fn()} requests={{}} />);

		const input = screen.getByPlaceholderText(
			'Filtrar por method:, status:, state: ou texto livre',
		);

		fireEvent.focus(input);

		expect(screen.getByText('Sugestões')).toBeInTheDocument();
		expect(screen.getByText('Apenas pendentes')).toBeInTheDocument();

		await waitFor(() => expect(screen.getByText('Sugestões')).toBeInTheDocument());

		fireEvent.pointerDown(input, { button: 0, pointerType: 'mouse' });

		expect(screen.getByText('Sugestões')).toBeInTheDocument();
		expect(screen.getByText('Apenas pendentes')).toBeInTheDocument();
	});
});
