import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RulesLab from '../RulesLab';
import { useRules } from '@/hooks/useRules';

vi.mock('@/hooks/useRules');

const existingRule = {
	id: 'r1',
	name: 'Existing rule',
	enabled: true,
	matchers: [{ type: 'url', enabled: true, pattern: 'api/x', isRegex: false }],
	action: { type: 'mock', enabled: true, status: 200, headers: {} },
	createdAt: 1,
	updatedAt: 1,
};

describe('RulesLab', () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.mocked(useRules).mockReturnValue({
			rules: [existingRule],
			addRule: vi.fn().mockResolvedValue(existingRule),
			updateRule: vi.fn().mockResolvedValue(true),
			removeRule: vi.fn().mockResolvedValue(true),
			toggleRuleEnabled: vi.fn().mockResolvedValue(true),
		} as any);
	});

	afterEach(() => {
		sessionStorage.clear();
	});

	test('mostra header, toolbar e lista quando há regras', () => {
		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		expect(screen.getByText('Gestão de Regras')).toBeInTheDocument();
		expect(screen.getByText('Existing rule')).toBeInTheDocument();
		expect(screen.getByLabelText('Buscar regras')).toBeInTheDocument();
	});

	test('subtítulo reflete contagem de ativas e pausadas', () => {
		vi.mocked(useRules).mockReturnValueOnce({
			rules: [existingRule, { ...existingRule, id: 'r2', name: 'Outra', enabled: false }],
			addRule: vi.fn(),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
		} as any);

		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		expect(screen.getByText(/2 regras · 1 ativa, 1 pausada/)).toBeInTheDocument();
	});

	test('clicar "+ Nova regra" abre welcome screen com templates', () => {
		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		const buttons = screen.getAllByRole('button', { name: /Nova regra/ });
		fireEvent.click(buttons[0]);
		expect(screen.getByText('Começar do zero')).toBeInTheDocument();
		expect(screen.getByText('Usar template')).toBeInTheDocument();
		expect(screen.getByText('Erro 500 (Internal Server Error)')).toBeInTheDocument();
		expect(screen.getByText('Atrasar resposta em 3s')).toBeInTheDocument();
	});

	test('mostra empty state quando não há regras', () => {
		vi.mocked(useRules).mockReturnValueOnce({
			rules: [],
			addRule: vi.fn(),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
		} as any);

		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		expect(screen.getByTestId('rules-empty-state')).toBeInTheDocument();
		expect(screen.getByText('Crie sua primeira regra')).toBeInTheDocument();
	});

	test('abre o editor automaticamente quando ?rule=<id> está presente', () => {
		render(
			<MemoryRouter initialEntries={['/?rule=r1']}>
				<Routes>
					<Route path="/" element={<RulesLab />} />
				</Routes>
			</MemoryRouter>,
		);
		expect(screen.getByText(/Editar Regra/i)).toBeInTheDocument();
	});
});

describe('RulesLab — busca e filtros (US-004)', () => {
	const mockRule = {
		id: 'r-mock',
		name: 'Mock login',
		enabled: true,
		matchers: [
			{ type: 'method' as const, enabled: true, method: 'POST' },
			{ type: 'url' as const, enabled: true, pattern: '/api/login', isRegex: false },
		],
		action: { type: 'mock' as const, enabled: true, status: 401, headers: {} },
		createdAt: 1,
		updatedAt: 1,
	};
	const delayRule = {
		id: 'r-delay',
		name: 'Delay search',
		enabled: true,
		matchers: [
			{ type: 'method' as const, enabled: true, method: 'GET' },
			{ type: 'url' as const, enabled: true, pattern: '/api/search', isRegex: false },
		],
		action: { type: 'delay' as const, enabled: true, timeMs: 500 },
		createdAt: 2,
		updatedAt: 2,
	};
	const transformAnyRule = {
		id: 'r-transform',
		name: 'Transform CORS',
		enabled: true,
		matchers: [{ type: 'url' as const, enabled: true, pattern: '/api/*', isRegex: false }],
		action: { type: 'transform' as const, enabled: true, mode: 'declarative' as const },
		createdAt: 3,
		updatedAt: 3,
	};
	const breakpointRule = {
		id: 'r-breakpoint',
		name: 'Breakpoint admin',
		enabled: true,
		matchers: [
			{ type: 'method' as const, enabled: true, method: ['DELETE', 'PUT'] },
			{ type: 'url' as const, enabled: true, pattern: '/admin', isRegex: false },
		],
		action: { type: 'breakpoint' as const, enabled: true },
		createdAt: 4,
		updatedAt: 4,
	};

	const allRules = [mockRule, delayRule, transformAnyRule, breakpointRule];

	beforeEach(() => {
		sessionStorage.clear();
		vi.mocked(useRules).mockReturnValue({
			rules: allRules,
			addRule: vi.fn(),
			updateRule: vi.fn(),
			removeRule: vi.fn(),
			toggleRuleEnabled: vi.fn(),
			duplicateRule: vi.fn(),
			reorderRules: vi.fn(),
			moveRule: vi.fn(),
		} as any);
	});

	afterEach(() => {
		sessionStorage.clear();
	});

	function renderLab() {
		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
	}

	test('busca filtra por substring de nome em tempo real', () => {
		renderLab();
		fireEvent.change(screen.getByLabelText('Buscar regras'), { target: { value: 'login' } });
		expect(screen.getByText('Mock login')).toBeInTheDocument();
		expect(screen.queryByText('Delay search')).not.toBeInTheDocument();
		expect(screen.queryByText('Transform CORS')).not.toBeInTheDocument();
	});

	test('busca filtra por substring de URL pattern', () => {
		renderLab();
		fireEvent.change(screen.getByLabelText('Buscar regras'), { target: { value: '/admin' } });
		expect(screen.getByText('Breakpoint admin')).toBeInTheDocument();
		expect(screen.queryByText('Mock login')).not.toBeInTheDocument();
		expect(screen.queryByText('Delay search')).not.toBeInTheDocument();
	});

	test('filtro por tipo (multi-seleção): mock + delay', () => {
		renderLab();
		fireEvent.click(screen.getByTestId('filter-chip-type-mock'));
		fireEvent.click(screen.getByTestId('filter-chip-type-delay'));
		expect(screen.getByText('Mock login')).toBeInTheDocument();
		expect(screen.getByText('Delay search')).toBeInTheDocument();
		expect(screen.queryByText('Transform CORS')).not.toBeInTheDocument();
		expect(screen.queryByText('Breakpoint admin')).not.toBeInTheDocument();
	});

	test('filtro por método (multi-seleção): GET + DELETE', () => {
		renderLab();
		fireEvent.click(screen.getByTestId('filter-chip-method-GET'));
		expect(screen.getByText('Delay search')).toBeInTheDocument();
		expect(screen.queryByText('Mock login')).not.toBeInTheDocument();

		fireEvent.click(screen.getByTestId('filter-chip-method-DELETE'));
		expect(screen.getByText('Delay search')).toBeInTheDocument();
		expect(screen.getByText('Breakpoint admin')).toBeInTheDocument();
		expect(screen.queryByText('Mock login')).not.toBeInTheDocument();
	});

	test('filtro de método ANY mostra apenas regras sem MethodMatcher', () => {
		renderLab();
		fireEvent.click(screen.getByTestId('filter-chip-method-ANY'));
		expect(screen.getByText('Transform CORS')).toBeInTheDocument();
		expect(screen.queryByText('Mock login')).not.toBeInTheDocument();
		expect(screen.queryByText('Delay search')).not.toBeInTheDocument();
	});

	test('filtros e busca combinam (AND)', () => {
		renderLab();
		fireEvent.click(screen.getByTestId('filter-chip-type-mock'));
		fireEvent.click(screen.getByTestId('filter-chip-type-delay'));
		fireEvent.change(screen.getByLabelText('Buscar regras'), { target: { value: '/api/login' } });
		expect(screen.getByText('Mock login')).toBeInTheDocument();
		expect(screen.queryByText('Delay search')).not.toBeInTheDocument();
	});

	test('estado dos filtros persiste entre re-mounts (sessionStorage)', () => {
		const { unmount } = render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByTestId('filter-chip-type-mock'));
		fireEvent.change(screen.getByLabelText('Buscar regras'), { target: { value: 'login' } });
		unmount();

		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		expect(screen.getByLabelText('Buscar regras')).toHaveValue('login');
		expect(screen.getByTestId('filter-chip-type-mock')).toHaveAttribute('aria-pressed', 'true');
	});

	test('botão "Limpar filtros" reseta busca, tipo e método', () => {
		renderLab();
		fireEvent.click(screen.getByTestId('filter-chip-type-mock'));
		fireEvent.click(screen.getByTestId('filter-chip-method-POST'));
		fireEvent.change(screen.getByLabelText('Buscar regras'), { target: { value: 'login' } });

		fireEvent.click(screen.getByTestId('filter-clear'));

		expect(screen.getByLabelText('Buscar regras')).toHaveValue('');
		expect(screen.getByTestId('filter-chip-type-mock')).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByTestId('filter-chip-method-POST')).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByText('Mock login')).toBeInTheDocument();
		expect(screen.getByText('Delay search')).toBeInTheDocument();
	});

	test('contagens dos chips de tipo refletem rules', () => {
		renderLab();
		expect(screen.getByTestId('filter-chip-type-mock')).toHaveTextContent(/Mock\s*1/);
		expect(screen.getByTestId('filter-chip-type-delay')).toHaveTextContent(/Latência\s*1/);
		expect(screen.getByTestId('filter-chip-type-transform')).toHaveTextContent(/Transform\s*1/);
		expect(screen.getByTestId('filter-chip-type-breakpoint')).toHaveTextContent(/Breakpoint\s*1/);
	});

	test('contagens dos chips de método refletem rules', () => {
		renderLab();
		expect(screen.getByTestId('filter-chip-method-GET')).toHaveTextContent(/GET\s*1/);
		expect(screen.getByTestId('filter-chip-method-POST')).toHaveTextContent(/POST\s*1/);
		expect(screen.getByTestId('filter-chip-method-DELETE')).toHaveTextContent(/DELETE\s*1/);
		expect(screen.getByTestId('filter-chip-method-PUT')).toHaveTextContent(/PUT\s*1/);
		expect(screen.getByTestId('filter-chip-method-ANY')).toHaveTextContent(/ANY\s*1/);
	});

	test('mensagem "Nenhuma regra corresponde aos filtros" quando combinação vazia', () => {
		renderLab();
		fireEvent.change(screen.getByLabelText('Buscar regras'), {
			target: { value: 'inexistente-xyz' },
		});
		expect(screen.getByText(/Nenhuma regra corresponde/)).toBeInTheDocument();
	});
});
