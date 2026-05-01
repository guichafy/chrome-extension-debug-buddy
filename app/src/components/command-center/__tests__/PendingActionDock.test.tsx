import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PendingActionDock } from '../PendingActionDock';

const noopHandlers = () => ({
	onApproveNext: vi.fn(),
	onEditNext: vi.fn(),
	onCreateMockNext: vi.fn(),
	onIgnoreAll: vi.fn(),
	onViewPending: vi.fn(),
});

describe('PendingActionDock', () => {
	test('não renderiza quando pendingCount é 0', () => {
		const handlers = noopHandlers();
		const { container } = render(
			<PendingActionDock
				pendingCount={0}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl={null}
				{...handlers}
			/>,
		);
		expect(container.firstChild).toBeNull();
	});

	test('renderiza contador no singular quando há 1 pausada', () => {
		render(
			<PendingActionDock
				pendingCount={1}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/users/42"
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-action-dock-counter')).toHaveTextContent('1 pausada');
	});

	test('renderiza contador no plural quando há N>1 pausadas', () => {
		render(
			<PendingActionDock
				pendingCount={3}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/users/42"
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-action-dock-counter')).toHaveTextContent('3 pausadas');
	});

	test('exibe a URL truncada da próxima pausada e ações principais', () => {
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/users/42"
				{...noopHandlers()}
			/>,
		);
		const url = screen.getByTestId('pending-action-dock-next-url');
		expect(url).toHaveTextContent('https://api.example.com/users/42');
		expect(url).toHaveAttribute('title', 'https://api.example.com/users/42');
		expect(screen.getByTestId('pending-action-dock-approve-next')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-edit-next')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-view-pending')).toBeInTheDocument();
		expect(screen.getByTestId('pending-action-dock-ignore-all')).toBeInTheDocument();
	});

	test('clique em "Criar Mock" chama onCreateMockNext', () => {
		const handlers = noopHandlers();
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...handlers}
			/>,
		);
		fireEvent.click(screen.getByTestId('pending-action-dock-create-mock-next'));
		expect(handlers.onCreateMockNext).toHaveBeenCalledTimes(1);
		expect(handlers.onApproveNext).not.toHaveBeenCalled();
		expect(handlers.onIgnoreAll).not.toHaveBeenCalled();
		expect(handlers.onViewPending).not.toHaveBeenCalled();
		expect(handlers.onEditNext).not.toHaveBeenCalled();
	});

	test('clique em "Editar…" chama onEditNext', () => {
		const handlers = noopHandlers();
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...handlers}
			/>,
		);
		fireEvent.click(screen.getByTestId('pending-action-dock-edit-next'));
		expect(handlers.onEditNext).toHaveBeenCalledTimes(1);
		expect(handlers.onApproveNext).not.toHaveBeenCalled();
		expect(handlers.onIgnoreAll).not.toHaveBeenCalled();
		expect(handlers.onViewPending).not.toHaveBeenCalled();
	});

	test('labels das ações são fixos (sem variação "próximo") independente de seleção', () => {
		const { rerender } = render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		// Nenhum dos três botões de decisão deve carregar a palavra
		// "próximo"/"próxima" — a palavra "Próximo" do hotkey J é navegação na
		// fila e fica fora do escopo desta verificação.
		const approve = screen.getByTestId('pending-action-dock-approve-next');
		const edit = screen.getByTestId('pending-action-dock-edit-next');
		const createMock = screen.getByTestId('pending-action-dock-create-mock-next');
		expect(approve).toHaveTextContent('Aprovar');
		expect(approve.textContent).not.toMatch(/próxim/i);
		expect(edit).toHaveTextContent('Editar…');
		expect(edit.textContent).not.toMatch(/próxim/i);
		expect(createMock).toHaveTextContent('Criar Mock');
		expect(createMock.textContent).not.toMatch(/próxim/i);

		rerender(
			<PendingActionDock
				pendingCount={3}
				currentIndex={1}
				hasSelectedPending
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		const approveAfter = screen.getByTestId('pending-action-dock-approve-next');
		const editAfter = screen.getByTestId('pending-action-dock-edit-next');
		const createMockAfter = screen.getByTestId('pending-action-dock-create-mock-next');
		expect(approveAfter).toHaveTextContent('Aprovar');
		expect(approveAfter.textContent).not.toMatch(/próxim/i);
		expect(editAfter).toHaveTextContent('Editar…');
		expect(editAfter.textContent).not.toMatch(/próxim/i);
		expect(createMockAfter).toHaveTextContent('Criar Mock');
		expect(createMockAfter.textContent).not.toMatch(/próxim/i);
	});

	test('exibe os atalhos compactos A/I/J/K abaixo das ações', () => {
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl={null}
				{...noopHandlers()}
			/>,
		);
		const dock = screen.getByTestId('pending-action-dock');
		const keys = Array.from(dock.querySelectorAll('.kbd')).map((el) => el.textContent);
		expect(keys).toEqual(['A', 'I', 'J', 'K']);
	});

	test('clique em "Aprovar" chama onApproveNext', () => {
		const handlers = noopHandlers();
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...handlers}
			/>,
		);
		fireEvent.click(screen.getByTestId('pending-action-dock-approve-next'));
		expect(handlers.onApproveNext).toHaveBeenCalledTimes(1);
		expect(handlers.onIgnoreAll).not.toHaveBeenCalled();
		expect(handlers.onViewPending).not.toHaveBeenCalled();
	});

	test('clique em "Ignorar todos" chama onIgnoreAll', () => {
		const handlers = noopHandlers();
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...handlers}
			/>,
		);
		fireEvent.click(screen.getByTestId('pending-action-dock-ignore-all'));
		expect(handlers.onIgnoreAll).toHaveBeenCalledTimes(1);
		expect(handlers.onApproveNext).not.toHaveBeenCalled();
		expect(handlers.onViewPending).not.toHaveBeenCalled();
	});

	test('clique em "Ver pausadas" chama onViewPending', () => {
		const handlers = noopHandlers();
		render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...handlers}
			/>,
		);
		fireEvent.click(screen.getByTestId('pending-action-dock-view-pending'));
		expect(handlers.onViewPending).toHaveBeenCalledTimes(1);
		expect(handlers.onApproveNext).not.toHaveBeenCalled();
		expect(handlers.onIgnoreAll).not.toHaveBeenCalled();
	});

	test('mostra posição "i / N" apenas quando há pausada selecionada', () => {
		const { rerender } = render(
			<PendingActionDock
				pendingCount={3}
				currentIndex={1}
				hasSelectedPending
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-action-dock-position')).toHaveTextContent('2 / 3');

		rerender(
			<PendingActionDock
				pendingCount={3}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		expect(screen.queryByTestId('pending-action-dock-position')).toBeNull();
	});
});
