import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import { RuleListItem } from '../RuleListItem';

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

function makeProps(overrides: Partial<Rule> = {}) {
	return {
		rule: { ...baseRule, ...overrides },
		onEdit: vi.fn(),
		onRemove: vi.fn(),
		onDuplicate: vi.fn(),
		onToggle: vi.fn(),
	};
}

describe('RuleListItem', () => {
	test('renderiza nome, badge de condições e resumo match → then', () => {
		const props = makeProps();
		render(<RuleListItem {...props} />);
		expect(screen.getByText('Pokemon')).toBeInTheDocument();
		expect(screen.getByText('2 condições')).toBeInTheDocument();
		expect(screen.getByText('GET .*kalos')).toBeInTheDocument();
		expect(screen.getByText(/Mock 500/)).toBeInTheDocument();
	});

	test('switch reflete enabled true', () => {
		const props = makeProps();
		render(<RuleListItem {...props} />);
		const sw = screen.getByRole('switch');
		expect(sw).toHaveAttribute('aria-checked', 'true');
		expect(sw).toHaveAccessibleName('Pausar regra');
	});

	test('switch reflete enabled false', () => {
		const props = makeProps({ enabled: false });
		render(<RuleListItem {...props} />);
		const sw = screen.getByRole('switch');
		expect(sw).toHaveAttribute('aria-checked', 'false');
		expect(sw).toHaveAccessibleName('Ativar regra');
	});

	test('clicar switch chama onToggle com id', () => {
		const props = makeProps();
		render(<RuleListItem {...props} />);
		fireEvent.click(screen.getByRole('switch'));
		expect(props.onToggle).toHaveBeenCalledWith('r1');
	});

	test('botões de ação chamam callbacks corretos', () => {
		const props = makeProps();
		render(<RuleListItem {...props} />);

		fireEvent.click(screen.getByRole('button', { name: 'Editar regra' }));
		expect(props.onEdit).toHaveBeenCalledWith(props.rule);

		fireEvent.click(screen.getByRole('button', { name: 'Duplicar regra' }));
		expect(props.onDuplicate).toHaveBeenCalledWith(props.rule);

		fireEvent.click(screen.getByRole('button', { name: 'Excluir regra' }));
		expect(props.onRemove).toHaveBeenCalledWith('r1');
	});

	test('singular "1 condição" para regra com 1 matcher habilitado', () => {
		const props = makeProps({
			matchers: [{ type: 'url', enabled: true, pattern: '/x', isRegex: false }],
		});
		render(<RuleListItem {...props} />);
		expect(screen.getByText('1 condição')).toBeInTheDocument();
	});
});
