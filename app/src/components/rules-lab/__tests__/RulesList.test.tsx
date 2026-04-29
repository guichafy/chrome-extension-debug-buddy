import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import { RulesList } from '../RulesList';

function makeRule(i: number, overrides: Partial<Rule> = {}): Rule {
	return {
		id: `r${i}`,
		name: `Regra ${i}`,
		enabled: true,
		matchers: [{ type: 'url', enabled: true, pattern: `/api/${i}`, isRegex: false }],
		action: { type: 'mock', enabled: true, status: 200, headers: {} },
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

const callbacks = {
	onEdit: vi.fn(),
	onRemove: vi.fn(),
	onDuplicate: vi.fn(),
	onToggle: vi.fn(),
};

describe('RulesList', () => {
	test('mostra mensagem quando array filtrado é vazio mas total > 0', () => {
		render(<RulesList rules={[]} totalCount={3} {...callbacks} />);
		expect(screen.getByText(/Nenhuma regra corresponde/)).toBeInTheDocument();
	});

	test('renderiza todas as regras quando há ≤10', () => {
		const rules = [makeRule(1), makeRule(2), makeRule(3)];
		render(<RulesList rules={rules} totalCount={3} {...callbacks} />);
		expect(screen.getByText('Regra 1')).toBeInTheDocument();
		expect(screen.getByText('Regra 3')).toBeInTheDocument();
		expect(screen.queryByLabelText('Próxima página')).not.toBeInTheDocument();
	});

	test('paginação aparece quando há >10 regras e navega entre páginas', () => {
		const rules = Array.from({ length: 12 }, (_, i) => makeRule(i + 1));
		render(<RulesList rules={rules} totalCount={12} {...callbacks} />);

		expect(screen.getByText('Regra 1')).toBeInTheDocument();
		expect(screen.queryByText('Regra 11')).not.toBeInTheDocument();
		expect(screen.getByText(/Mostrando 1–10 de 12/)).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText('Próxima página'));
		expect(screen.queryByText('Regra 1')).not.toBeInTheDocument();
		expect(screen.getByText('Regra 11')).toBeInTheDocument();
		expect(screen.getByText('Regra 12')).toBeInTheDocument();
	});

	test('reduzir lista para nova última página mantém usuário na página final, não reseta', () => {
		const allRules = Array.from({ length: 22 }, (_, i) => makeRule(i + 1));
		const { rerender } = render(<RulesList rules={allRules} totalCount={22} {...callbacks} />);

		fireEvent.click(screen.getByLabelText('Próxima página'));
		fireEvent.click(screen.getByLabelText('Próxima página'));
		expect(screen.getByText('Regra 21')).toBeInTheDocument();

		const trimmed = allRules.slice(0, 12);
		rerender(<RulesList rules={trimmed} totalCount={12} {...callbacks} />);

		expect(screen.getByText('Regra 11')).toBeInTheDocument();
		expect(screen.getByText('Regra 12')).toBeInTheDocument();
		expect(screen.queryByText('Regra 1')).not.toBeInTheDocument();
	});
});
