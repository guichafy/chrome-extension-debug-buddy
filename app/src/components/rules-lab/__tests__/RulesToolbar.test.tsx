import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { type RulesActionFilter, type RulesSortOption, RulesToolbar } from '../RulesToolbar';

function defaults() {
	const counts: Record<RulesActionFilter, number> = {
		all: 5,
		mock: 3,
		delay: 1,
		transform: 0,
		breakpoint: 1,
	};
	return {
		search: '',
		onSearchChange: vi.fn(),
		actionFilter: 'all' as RulesActionFilter,
		onActionFilterChange: vi.fn(),
		sort: 'updated_desc' as RulesSortOption,
		onSortChange: vi.fn(),
		counts,
	};
}

describe('RulesToolbar', () => {
	test('renderiza chips com contagens', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		expect(screen.getByTestId('filter-chip-all')).toHaveTextContent(/Todas\s*5/);
		expect(screen.getByTestId('filter-chip-mock')).toHaveTextContent(/Mock\s*3/);
		expect(screen.getByTestId('filter-chip-transform')).toHaveTextContent(/Transform\s*0/);
	});

	test('clicar chip chama onActionFilterChange', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		fireEvent.click(screen.getByTestId('filter-chip-mock'));
		expect(props.onActionFilterChange).toHaveBeenCalledWith('mock');
	});

	test('digitar na busca chama onSearchChange', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		fireEvent.change(screen.getByLabelText('Buscar regras'), {
			target: { value: 'foo' },
		});
		expect(props.onSearchChange).toHaveBeenCalledWith('foo');
	});

	test('chip ativo tem aria-pressed=true', () => {
		const props = { ...defaults(), actionFilter: 'mock' as RulesActionFilter };
		render(<RulesToolbar {...props} />);
		expect(screen.getByTestId('filter-chip-mock')).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByTestId('filter-chip-all')).toHaveAttribute('aria-pressed', 'false');
	});
});
