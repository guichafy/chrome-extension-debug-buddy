import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { TabSearchBar } from '../TabSearchBar';

vi.mock('../../ui/lucide-icon', () => ({
	LucideIcon: ({ name, className }: any) => (
		<span data-testid="lucide-icon" data-name={name} className={className} />
	),
}));

describe('TabSearchBar', () => {
	it('renderiza ícone de busca e badge "/"', () => {
		render(<TabSearchBar value="" onChange={vi.fn()} />);
		expect(screen.getByTestId('lucide-icon')).toHaveAttribute('data-name', 'search');
		expect(screen.getByText('/')).toBeInTheDocument();
	});

	it('dispara onChange com o novo valor ao digitar', () => {
		const onChange = vi.fn();
		render(<TabSearchBar value="" onChange={onChange} />);
		fireEvent.change(screen.getByRole('searchbox'), {
			target: { value: 'github' },
		});
		expect(onChange).toHaveBeenCalledWith('github');
	});

	it('expõe foco programático via ref', () => {
		const ref = React.createRef<HTMLInputElement>();
		render(<TabSearchBar value="" onChange={vi.fn()} inputRef={ref} />);
		expect(ref.current).toBeInstanceOf(HTMLInputElement);
		ref.current?.focus();
		expect(document.activeElement).toBe(ref.current);
	});
});
