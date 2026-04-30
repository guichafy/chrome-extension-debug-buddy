import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { ActionType } from '@/types/rules';
import { type RulesSortOption, RulesToolbar } from '../RulesToolbar';

function defaults() {
	const actionCounts: Record<ActionType, number> = {
		mock: 3,
		delay: 1,
		transform: 0,
		breakpoint: 1,
	};
	const methodCounts: Record<string, number> = {
		GET: 2,
		POST: 1,
		PUT: 0,
		DELETE: 0,
		PATCH: 0,
		ANY: 4,
	};
	return {
		search: '',
		onSearchChange: vi.fn(),
		actionFilters: [] as ActionType[],
		onActionFiltersChange: vi.fn(),
		methodFilters: [] as string[],
		onMethodFiltersChange: vi.fn(),
		sort: 'updated_desc' as RulesSortOption,
		onSortChange: vi.fn(),
		actionCounts,
		methodCounts,
		totalCount: 5,
	};
}

describe('RulesToolbar', () => {
	test('renderiza chips de tipo com contagens', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		expect(screen.getByTestId('filter-chip-type-mock')).toHaveTextContent(/Mock\s*3/);
		expect(screen.getByTestId('filter-chip-type-transform')).toHaveTextContent(/Transform\s*0/);
		expect(screen.getByTestId('filter-chip-type-delay')).toHaveTextContent(/Latência\s*1/);
		expect(screen.getByTestId('filter-chip-type-breakpoint')).toHaveTextContent(/Breakpoint\s*1/);
	});

	test('renderiza chips de método (GET/POST/PUT/DELETE/PATCH/ANY)', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY']) {
			expect(screen.getByTestId(`filter-chip-method-${m}`)).toBeInTheDocument();
		}
		expect(screen.getByTestId('filter-chip-method-GET')).toHaveTextContent(/GET\s*2/);
		expect(screen.getByTestId('filter-chip-method-ANY')).toHaveTextContent(/ANY\s*4/);
	});

	test('clicar chip de tipo adiciona em onActionFiltersChange', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		fireEvent.click(screen.getByTestId('filter-chip-type-mock'));
		expect(props.onActionFiltersChange).toHaveBeenCalledWith(['mock']);
	});

	test('clicar chip de tipo já ativo remove da seleção', () => {
		const props = { ...defaults(), actionFilters: ['mock', 'delay'] as ActionType[] };
		render(<RulesToolbar {...props} />);
		fireEvent.click(screen.getByTestId('filter-chip-type-mock'));
		expect(props.onActionFiltersChange).toHaveBeenCalledWith(['delay']);
	});

	test('multi-seleção de tipo: clicar 2 chips diferentes acumula no array', () => {
		const props = { ...defaults(), actionFilters: ['mock'] as ActionType[] };
		render(<RulesToolbar {...props} />);
		fireEvent.click(screen.getByTestId('filter-chip-type-delay'));
		expect(props.onActionFiltersChange).toHaveBeenCalledWith(['mock', 'delay']);
	});

	test('clicar chip de método adiciona em onMethodFiltersChange', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		fireEvent.click(screen.getByTestId('filter-chip-method-GET'));
		expect(props.onMethodFiltersChange).toHaveBeenCalledWith(['GET']);
	});

	test('clicar chip de método ANY adiciona em onMethodFiltersChange', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		fireEvent.click(screen.getByTestId('filter-chip-method-ANY'));
		expect(props.onMethodFiltersChange).toHaveBeenCalledWith(['ANY']);
	});

	test('chip ativo tem aria-pressed=true', () => {
		const props = { ...defaults(), actionFilters: ['mock'] as ActionType[] };
		render(<RulesToolbar {...props} />);
		expect(screen.getByTestId('filter-chip-type-mock')).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByTestId('filter-chip-type-delay')).toHaveAttribute('aria-pressed', 'false');
	});

	test('digitar na busca chama onSearchChange', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		fireEvent.change(screen.getByLabelText('Buscar regras'), {
			target: { value: 'foo' },
		});
		expect(props.onSearchChange).toHaveBeenCalledWith('foo');
	});

	test('botão "Limpar filtros" aparece quando há filtros ativos e reseta tudo', () => {
		const props = {
			...defaults(),
			actionFilters: ['mock'] as ActionType[],
			methodFilters: ['GET'],
			search: 'abc',
		};
		render(<RulesToolbar {...props} />);
		const clearBtn = screen.getByTestId('filter-clear');
		fireEvent.click(clearBtn);
		expect(props.onSearchChange).toHaveBeenCalledWith('');
		expect(props.onActionFiltersChange).toHaveBeenCalledWith([]);
		expect(props.onMethodFiltersChange).toHaveBeenCalledWith([]);
	});

	test('botão "Limpar filtros" não aparece quando não há filtros ativos', () => {
		const props = defaults();
		render(<RulesToolbar {...props} />);
		expect(screen.queryByTestId('filter-clear')).not.toBeInTheDocument();
	});
});
