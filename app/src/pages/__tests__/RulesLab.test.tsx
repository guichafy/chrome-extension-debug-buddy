import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

	test('renderiza cards de presets e listagem de regras', () => {
		render(
			<MemoryRouter>
				<RulesLab />
			</MemoryRouter>,
		);
		expect(screen.getByText(/Erro 500/)).toBeInTheDocument();
		expect(screen.getByText(/Latência fixa/)).toBeInTheDocument();
		expect(screen.getByText('Existing rule')).toBeInTheDocument();
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
