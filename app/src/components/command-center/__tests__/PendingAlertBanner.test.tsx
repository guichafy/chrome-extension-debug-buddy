import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PendingAlertBanner } from '../PendingAlertBanner';

const noopHandlers = () => ({
	onApproveNext: vi.fn(),
	onIgnoreAll: vi.fn(),
	onViewPending: vi.fn(),
});

describe('PendingAlertBanner', () => {
	test('não renderiza quando pendingCount é 0', () => {
		const handlers = noopHandlers();
		const { container } = render(<PendingAlertBanner pendingCount={0} {...handlers} />);
		expect(container.firstChild).toBeNull();
	});

	test('renderiza singular quando há 1 pausada', () => {
		const handlers = noopHandlers();
		render(<PendingAlertBanner pendingCount={1} {...handlers} />);
		expect(screen.getByText('1 requisição pausada aguardando sua decisão')).toBeInTheDocument();
	});

	test('renderiza contagem no botão "Ver pausadas"', () => {
		const handlers = noopHandlers();
		render(<PendingAlertBanner pendingCount={3} {...handlers} />);
		const button = screen.getByRole('button', { name: /Ver pausadas \(3\)/ });
		expect(button).toBeInTheDocument();
	});

	test('atualiza contagem entre parênteses quando pendingCount muda', () => {
		const handlers = noopHandlers();
		const { rerender } = render(<PendingAlertBanner pendingCount={2} {...handlers} />);
		expect(screen.getByRole('button', { name: /Ver pausadas \(2\)/ })).toBeInTheDocument();
		rerender(<PendingAlertBanner pendingCount={5} {...handlers} />);
		expect(screen.getByRole('button', { name: /Ver pausadas \(5\)/ })).toBeInTheDocument();
	});

	test('ordem dos botões: Ver pausadas → Ignorar todos → Aprovar próximo', () => {
		const handlers = noopHandlers();
		render(<PendingAlertBanner pendingCount={2} {...handlers} />);
		const buttons = screen.getAllByRole('button');
		expect(buttons.map((b) => b.textContent)).toEqual([
			expect.stringMatching(/Ver pausadas \(2\)/),
			expect.stringMatching(/Ignorar todos/),
			expect.stringMatching(/Aprovar próximo/),
		]);
	});

	test('click em "Ver pausadas" chama onViewPending', () => {
		const handlers = noopHandlers();
		render(<PendingAlertBanner pendingCount={2} {...handlers} />);
		fireEvent.click(screen.getByRole('button', { name: /Ver pausadas \(2\)/ }));
		expect(handlers.onViewPending).toHaveBeenCalledTimes(1);
		expect(handlers.onApproveNext).not.toHaveBeenCalled();
		expect(handlers.onIgnoreAll).not.toHaveBeenCalled();
	});

	test('click em "Ignorar todos" chama onIgnoreAll', () => {
		const handlers = noopHandlers();
		render(<PendingAlertBanner pendingCount={2} {...handlers} />);
		fireEvent.click(screen.getByRole('button', { name: /Ignorar todos/ }));
		expect(handlers.onIgnoreAll).toHaveBeenCalledTimes(1);
		expect(handlers.onViewPending).not.toHaveBeenCalled();
	});

	test('click em "Aprovar próximo" chama onApproveNext', () => {
		const handlers = noopHandlers();
		render(<PendingAlertBanner pendingCount={2} {...handlers} />);
		fireEvent.click(screen.getByRole('button', { name: /Aprovar próximo/ }));
		expect(handlers.onApproveNext).toHaveBeenCalledTimes(1);
		expect(handlers.onViewPending).not.toHaveBeenCalled();
	});
});
