import { fireEvent, render, screen, within } from '@testing-library/react';
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

function makeOrderById(rules: Rule[]): Map<string, number> {
	const map = new Map<string, number>();
	rules.forEach((rule, index) => map.set(rule.id, index + 1));
	return map;
}

const callbacks = {
	onEdit: vi.fn(),
	onRemove: vi.fn(),
	onDuplicate: vi.fn(),
	onToggle: vi.fn(),
};

describe('RulesList', () => {
	test('mostra mensagem quando array filtrado é vazio mas total > 0', () => {
		render(<RulesList rules={[]} totalCount={3} orderById={new Map()} {...callbacks} />);
		expect(screen.getByText(/Nenhuma regra corresponde/)).toBeInTheDocument();
	});

	test('renderiza tabela shadcn com cabeçalhos esperados', () => {
		const rules = [makeRule(1)];
		render(
			<RulesList rules={rules} totalCount={1} orderById={makeOrderById(rules)} {...callbacks} />,
		);
		const table = screen.getByTestId('rules-table');
		expect(table).toBeInTheDocument();
		expect(within(table).getByText('Ordem')).toBeInTheDocument();
		expect(within(table).getByText('Status')).toBeInTheDocument();
		expect(within(table).getByText('Tipo')).toBeInTheDocument();
		expect(within(table).getByText('Matcher')).toBeInTheDocument();
		expect(within(table).getByText('Ação')).toBeInTheDocument();
		expect(within(table).getByText('Ações')).toBeInTheDocument();
	});

	test('renderiza todas as regras quando há ≤10', () => {
		const rules = [makeRule(1), makeRule(2), makeRule(3)];
		render(
			<RulesList rules={rules} totalCount={3} orderById={makeOrderById(rules)} {...callbacks} />,
		);
		expect(screen.getByText('Regra 1')).toBeInTheDocument();
		expect(screen.getByText('Regra 3')).toBeInTheDocument();
		expect(screen.queryByLabelText('Próxima página')).not.toBeInTheDocument();
	});

	test('mostra a coluna Ordem com a posição da regra na lista original', () => {
		const rules = [makeRule(1), makeRule(2), makeRule(3)];
		const orderById = makeOrderById(rules);
		render(<RulesList rules={rules} totalCount={3} orderById={orderById} {...callbacks} />);

		const row1 = screen.getByTestId('rule-row-r1');
		const row3 = screen.getByTestId('rule-row-r3');
		expect(within(row1).getByText('1')).toBeInTheDocument();
		expect(within(row3).getByText('3')).toBeInTheDocument();
	});

	test('badge de tipo aparece na coluna Tipo com label do tipo', () => {
		const rules = [
			makeRule(1, { action: { type: 'mock', enabled: true, status: 200, headers: {} } }),
			makeRule(2, { action: { type: 'delay', enabled: true, timeMs: 500 } }),
			makeRule(3, { action: { type: 'transform', enabled: true } }),
			makeRule(4, { action: { type: 'breakpoint', enabled: true } }),
		];
		render(
			<RulesList rules={rules} totalCount={4} orderById={makeOrderById(rules)} {...callbacks} />,
		);
		expect(screen.getByTestId('rule-type-badge-r1')).toHaveTextContent('Mock');
		expect(screen.getByTestId('rule-type-badge-r2')).toHaveTextContent('Latência');
		expect(screen.getByTestId('rule-type-badge-r3')).toHaveTextContent('Transform');
		expect(screen.getByTestId('rule-type-badge-r4')).toHaveTextContent('Breakpoint');
	});

	test('toggle de status alterna habilitado e clique chama onToggle', () => {
		const rules = [makeRule(1, { enabled: false })];
		const onToggle = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={1}
				orderById={makeOrderById(rules)}
				{...callbacks}
				onToggle={onToggle}
			/>,
		);
		const switchEl = screen.getByRole('switch');
		expect(switchEl).toHaveAttribute('aria-checked', 'false');
		fireEvent.click(switchEl);
		expect(onToggle).toHaveBeenCalledWith('r1');
	});

	test('botões de ação chamam callbacks corretos', () => {
		const rules = [makeRule(1)];
		const onEdit = vi.fn();
		const onDuplicate = vi.fn();
		const onRemove = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={1}
				orderById={makeOrderById(rules)}
				onToggle={vi.fn()}
				onEdit={onEdit}
				onDuplicate={onDuplicate}
				onRemove={onRemove}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Editar regra' }));
		expect(onEdit).toHaveBeenCalledWith(rules[0]);

		fireEvent.click(screen.getByRole('button', { name: 'Duplicar regra' }));
		expect(onDuplicate).toHaveBeenCalledWith(rules[0]);

		fireEvent.click(screen.getByRole('button', { name: 'Excluir regra' }));
		expect(onRemove).toHaveBeenCalledWith('r1');
	});

	test('paginação aparece quando há >10 regras e navega entre páginas', () => {
		const rules = Array.from({ length: 12 }, (_, i) => makeRule(i + 1));
		render(
			<RulesList rules={rules} totalCount={12} orderById={makeOrderById(rules)} {...callbacks} />,
		);

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
		const allOrder = makeOrderById(allRules);
		const { rerender } = render(
			<RulesList rules={allRules} totalCount={22} orderById={allOrder} {...callbacks} />,
		);

		fireEvent.click(screen.getByLabelText('Próxima página'));
		fireEvent.click(screen.getByLabelText('Próxima página'));
		expect(screen.getByText('Regra 21')).toBeInTheDocument();

		const trimmed = allRules.slice(0, 12);
		const trimmedOrder = makeOrderById(trimmed);
		rerender(<RulesList rules={trimmed} totalCount={12} orderById={trimmedOrder} {...callbacks} />);

		expect(screen.getByText('Regra 11')).toBeInTheDocument();
		expect(screen.getByText('Regra 12')).toBeInTheDocument();
		expect(screen.queryByText('Regra 1')).not.toBeInTheDocument();
	});
});
