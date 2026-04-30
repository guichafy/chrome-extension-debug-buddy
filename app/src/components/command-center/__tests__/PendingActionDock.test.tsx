import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PendingActionDock } from '../PendingActionDock';

const noopHandlers = () => ({
	onApproveNext: vi.fn(),
	onEditNext: vi.fn(),
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

	test('clique em "Editar próxima…" chama onEditNext', () => {
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

	test('label do botão Editar muda conforme há pausada selecionada', () => {
		const { rerender } = render(
			<PendingActionDock
				pendingCount={2}
				currentIndex={null}
				hasSelectedPending={false}
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-action-dock-edit-next')).toHaveTextContent(
			'Editar próxima…',
		);

		rerender(
			<PendingActionDock
				pendingCount={3}
				currentIndex={1}
				hasSelectedPending
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-action-dock-edit-next')).toHaveTextContent('Editar…');
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

	test('clique em "Aprovar próximo" chama onApproveNext', () => {
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

	test('label do botão primário é "Aprovar" quando há pausada selecionada', () => {
		render(
			<PendingActionDock
				pendingCount={3}
				currentIndex={1}
				hasSelectedPending
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		const approve = screen.getByTestId('pending-action-dock-approve-next');
		expect(approve).toHaveTextContent('Aprovar');
		expect(approve).not.toHaveTextContent('Aprovar próximo');
	});

	test('mostra posição "i / N" quando há pausada selecionada', () => {
		render(
			<PendingActionDock
				pendingCount={3}
				currentIndex={1}
				hasSelectedPending
				nextPendingUrl="https://api.example.com/a"
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByText('2 / 3')).toBeInTheDocument();
	});
});
