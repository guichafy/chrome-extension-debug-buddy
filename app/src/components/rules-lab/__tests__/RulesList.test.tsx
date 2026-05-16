import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import { RulesList } from '../RulesList';

function makeRule(i: number, overrides: Partial<Rule> = {}): Rule {
	return {
		id: `r${i}`,
		name: `Regra ${i}`,
		enabled: true,
		stage: 'response',
		matchers: [{ type: 'url', enabled: true, pattern: `/api/${i}`, isRegex: false }],
		actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
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
			makeRule(1, { actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }] }),
			makeRule(2, {
				stage: 'request',
				actions: [{ type: 'requestDelay', enabled: true, timeMs: 500 }],
			}),
			makeRule(3, { actions: [{ type: 'transform', enabled: true }] }),
			makeRule(4, { actions: [{ type: 'breakpoint', enabled: true }] }),
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

	test('canReorder=true exibe handle de drag em cada linha + dica visual', () => {
		const rules = [makeRule(1), makeRule(2)];
		render(
			<RulesList
				rules={rules}
				totalCount={2}
				orderById={makeOrderById(rules)}
				{...callbacks}
				canReorder={true}
				onReorder={vi.fn()}
				onMove={vi.fn()}
			/>,
		);
		expect(screen.getByTestId('rules-reorder-hint')).toBeInTheDocument();
		expect(screen.getByTestId('rule-drag-handle-r1')).toBeInTheDocument();
		expect(screen.getByTestId('rule-drag-handle-r2')).toBeInTheDocument();
	});

	test('canReorder=false esconde handles de drag', () => {
		const rules = [makeRule(1)];
		render(
			<RulesList rules={rules} totalCount={1} orderById={makeOrderById(rules)} {...callbacks} />,
		);
		expect(screen.queryByTestId('rules-reorder-hint')).not.toBeInTheDocument();
		expect(screen.queryByTestId('rule-drag-handle-r1')).not.toBeInTheDocument();
	});

	test('drag-and-drop chama onReorder com fromId, toId e position', () => {
		const rules = [makeRule(1), makeRule(2), makeRule(3)];
		const onReorder = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={3}
				orderById={makeOrderById(rules)}
				{...callbacks}
				canReorder={true}
				onReorder={onReorder}
				onMove={vi.fn()}
			/>,
		);

		const row1 = screen.getByTestId('rule-row-r1');
		const row3 = screen.getByTestId('rule-row-r3');

		// jsdom retorna rect zerado por padrão; estabilizamos para o cálculo de posição.
		Object.defineProperty(row3, 'getBoundingClientRect', {
			configurable: true,
			value: () =>
				({
					top: 100,
					bottom: 140,
					height: 40,
					left: 0,
					right: 0,
					width: 0,
					x: 0,
					y: 100,
				}) as DOMRect,
		});

		const dataTransfer = {
			data: {} as Record<string, string>,
			effectAllowed: '',
			dropEffect: '',
			setData(key: string, value: string) {
				this.data[key] = value;
			},
			getData(key: string) {
				return this.data[key] ?? '';
			},
		};

		const dragStartEvt = createEvent.dragStart(row1);
		Object.defineProperty(dragStartEvt, 'dataTransfer', { value: dataTransfer });
		fireEvent(row1, dragStartEvt);
		// Cursor na metade superior da linha alvo → 'before' (clientY=105 dentro de [100..140]).
		const dragOverEvt = createEvent.dragOver(row3);
		Object.defineProperty(dragOverEvt, 'dataTransfer', { value: dataTransfer });
		Object.defineProperty(dragOverEvt, 'clientY', { value: 105 });
		fireEvent(row3, dragOverEvt);
		const dropEvt = createEvent.drop(row3);
		Object.defineProperty(dropEvt, 'dataTransfer', { value: dataTransfer });
		Object.defineProperty(dropEvt, 'clientY', { value: 105 });
		fireEvent(row3, dropEvt);

		expect(onReorder).toHaveBeenCalledWith('r1', 'r3', 'before');
	});

	test('drop na metade inferior chama onReorder com position=after', () => {
		const rules = [makeRule(1), makeRule(2), makeRule(3)];
		const onReorder = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={3}
				orderById={makeOrderById(rules)}
				{...callbacks}
				canReorder={true}
				onReorder={onReorder}
				onMove={vi.fn()}
			/>,
		);
		const row1 = screen.getByTestId('rule-row-r1');
		const row3 = screen.getByTestId('rule-row-r3');
		row3.getBoundingClientRect = () =>
			({ top: 100, bottom: 140, height: 40, left: 0, right: 0, width: 0, x: 0, y: 100 }) as DOMRect;

		const dataTransfer = {
			data: {} as Record<string, string>,
			effectAllowed: '',
			dropEffect: '',
			setData(_k: string, _v: string) {},
			getData() {
				return '';
			},
		};
		const dragStartEvt = createEvent.dragStart(row1);
		Object.defineProperty(dragStartEvt, 'dataTransfer', { value: dataTransfer });
		fireEvent(row1, dragStartEvt);
		// Cursor na metade inferior → 'after' (clientY=135 ≥ midpoint=120).
		const dragOverEvt = createEvent.dragOver(row3);
		Object.defineProperty(dragOverEvt, 'dataTransfer', { value: dataTransfer });
		Object.defineProperty(dragOverEvt, 'clientY', { value: 135 });
		fireEvent(row3, dragOverEvt);
		const dropEvt = createEvent.drop(row3);
		Object.defineProperty(dropEvt, 'dataTransfer', { value: dataTransfer });
		Object.defineProperty(dropEvt, 'clientY', { value: 135 });
		fireEvent(row3, dropEvt);
		expect(onReorder).toHaveBeenCalledWith('r1', 'r3', 'after');
	});

	test('Ctrl+ArrowDown na linha chama onMove com direction=down', () => {
		const rules = [makeRule(1), makeRule(2)];
		const onMove = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={2}
				orderById={makeOrderById(rules)}
				{...callbacks}
				canReorder={true}
				onReorder={vi.fn()}
				onMove={onMove}
			/>,
		);

		const row1 = screen.getByTestId('rule-row-r1');
		fireEvent.keyDown(row1, { key: 'ArrowDown', ctrlKey: true });
		expect(onMove).toHaveBeenCalledWith('r1', 'down');
	});

	test('Cmd+ArrowUp na linha chama onMove com direction=up', () => {
		const rules = [makeRule(1), makeRule(2)];
		const onMove = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={2}
				orderById={makeOrderById(rules)}
				{...callbacks}
				canReorder={true}
				onReorder={vi.fn()}
				onMove={onMove}
			/>,
		);

		const row2 = screen.getByTestId('rule-row-r2');
		fireEvent.keyDown(row2, { key: 'ArrowUp', metaKey: true });
		expect(onMove).toHaveBeenCalledWith('r2', 'up');
	});

	test('seta sem Ctrl/Cmd não chama onMove', () => {
		const rules = [makeRule(1)];
		const onMove = vi.fn();
		render(
			<RulesList
				rules={rules}
				totalCount={1}
				orderById={makeOrderById(rules)}
				{...callbacks}
				canReorder={true}
				onReorder={vi.fn()}
				onMove={onMove}
			/>,
		);
		fireEvent.keyDown(screen.getByTestId('rule-row-r1'), { key: 'ArrowDown' });
		expect(onMove).not.toHaveBeenCalled();
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
