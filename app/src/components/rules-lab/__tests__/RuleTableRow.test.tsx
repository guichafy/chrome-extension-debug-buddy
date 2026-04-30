import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Table, TableBody } from '@/components/ui/table';
import type { Rule } from '@/types/rules';
import { RuleTableRow } from '../RuleTableRow';

const baseRule: Rule = {
	id: 'r1',
	name: 'Pokemon',
	enabled: true,
	matchers: [
		{ type: 'url', enabled: true, pattern: '.*kalos', isRegex: true },
		{ type: 'method', enabled: true, method: 'GET' },
	],
	action: { type: 'mock', enabled: true, status: 500, headers: {} },
	createdAt: 0,
	updatedAt: Date.parse('2026-04-29T12:00:00Z'),
};

function renderRow(overrides: Partial<Rule> = {}, order = 1) {
	const props = {
		rule: { ...baseRule, ...overrides },
		order,
		onEdit: vi.fn(),
		onRemove: vi.fn(),
		onDuplicate: vi.fn(),
		onToggle: vi.fn(),
	};
	const utils = render(
		<Table>
			<TableBody>
				<RuleTableRow {...props} />
			</TableBody>
		</Table>,
	);
	return { ...utils, props };
}

describe('RuleTableRow', () => {
	test('renderiza nome, matcher e resumo da ação', () => {
		renderRow();
		expect(screen.getByText('Pokemon')).toBeInTheDocument();
		expect(screen.getByText('GET .*kalos')).toBeInTheDocument();
		expect(screen.getByText(/Mock 500/)).toBeInTheDocument();
	});

	test('renderiza coluna Ordem com o número fornecido', () => {
		renderRow({}, 7);
		expect(screen.getByText('7')).toBeInTheDocument();
	});

	test('switch reflete enabled true e clique chama onToggle com id', () => {
		const { props } = renderRow();
		const sw = screen.getByRole('switch');
		expect(sw).toHaveAttribute('aria-checked', 'true');
		expect(sw).toHaveAccessibleName('Pausar regra');
		fireEvent.click(sw);
		expect(props.onToggle).toHaveBeenCalledWith('r1');
	});

	test('switch reflete enabled false e linha tem aparência apagada', () => {
		renderRow({ enabled: false });
		const sw = screen.getByRole('switch');
		expect(sw).toHaveAttribute('aria-checked', 'false');
		expect(sw).toHaveAccessibleName('Ativar regra');
		const row = screen.getByTestId('rule-row-r1');
		expect(row.className).toMatch(/opacity-50/);
	});

	test('botões de ação chamam callbacks corretos', () => {
		const { props } = renderRow();
		fireEvent.click(screen.getByRole('button', { name: 'Editar regra' }));
		expect(props.onEdit).toHaveBeenCalledWith(props.rule);

		fireEvent.click(screen.getByRole('button', { name: 'Duplicar regra' }));
		expect(props.onDuplicate).toHaveBeenCalledWith(props.rule);

		fireEvent.click(screen.getByRole('button', { name: 'Excluir regra' }));
		expect(props.onRemove).toHaveBeenCalledWith('r1');
	});

	test('por padrão (canReorder=false) não renderiza handle de drag e linha não é arrastável', () => {
		renderRow();
		expect(screen.queryByTestId('rule-drag-handle-r1')).not.toBeInTheDocument();
		const row = screen.getByTestId('rule-row-r1');
		expect(row).not.toHaveAttribute('draggable', 'true');
	});

	test('canReorder=true renderiza handle de drag e marca linha como draggable', () => {
		const props = {
			rule: baseRule,
			order: 1,
			onEdit: vi.fn(),
			onRemove: vi.fn(),
			onDuplicate: vi.fn(),
			onToggle: vi.fn(),
			canReorder: true,
		};
		render(
			<Table>
				<TableBody>
					<RuleTableRow {...props} />
				</TableBody>
			</Table>,
		);
		expect(screen.getByTestId('rule-drag-handle-r1')).toBeInTheDocument();
		const row = screen.getByTestId('rule-row-r1');
		expect(row).toHaveAttribute('draggable', 'true');
		expect(row).toHaveAttribute('tabIndex', '0');
	});
});
