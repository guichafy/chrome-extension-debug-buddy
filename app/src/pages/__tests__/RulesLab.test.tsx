import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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
		vi.mocked(useRules).mockReturnValue({
			rules: [existingRule],
			addRule: vi.fn().mockResolvedValue(existingRule),
			updateRule: vi.fn().mockResolvedValue(true),
			removeRule: vi.fn().mockResolvedValue(true),
			toggleRuleEnabled: vi.fn().mockResolvedValue(true),
		} as any);
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

	test('clicar "+ Nova regra" abre welcome screen com presets', () => {
		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		const buttons = screen.getAllByRole('button', { name: /Nova regra/ });
		fireEvent.click(buttons[0]);
		expect(screen.getByText('Começar em branco')).toBeInTheDocument();
		expect(screen.getByText('Erro 500 (Internal Server Error)')).toBeInTheDocument();
		expect(screen.getByText('Latência fixa (1s)')).toBeInTheDocument();
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
