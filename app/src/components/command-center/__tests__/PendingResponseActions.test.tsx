import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { PendingResponseActions } from '../PendingResponseActions';

// Mockamos o DropdownMenu do Radix porque o jsdom não tem o suporte completo a
// pointer events que ele exige; renderizamos o conteúdo inline para que os
// items fiquem no DOM e possam ser clicados normalmente nos testes.
vi.mock('@/components/ui/dropdown-menu', () => ({
	DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
	DropdownMenuTrigger: ({ children }: any) => (
		<div data-testid="dropdown-menu-trigger">{children}</div>
	),
	DropdownMenuContent: ({ children }: any) => (
		<div data-testid="dropdown-menu-content">{children}</div>
	),
	DropdownMenuItem: ({ children, onSelect, className, ...rest }: any) => (
		<button
			type="button"
			className={className}
			onClick={() => onSelect?.({ preventDefault: () => {} })}
			{...rest}
		>
			{children}
		</button>
	),
	DropdownMenuSeparator: () => <hr data-testid="dropdown-menu-separator" />,
}));

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users/42',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1,
	body: '{"id":42}',
	response: {
		headers: { 'content-type': 'application/json' },
		body: '{"id":42}',
	},
	isWaiting: true,
	...overrides,
});

const noopHandlers = () => ({
	onApprove: vi.fn(),
	onIgnore: vi.fn(),
	onCreateMock: vi.fn(),
	onApproveWithEdit: vi.fn(async () => ({ success: true })),
});

describe('PendingResponseActions', () => {
	test('renderiza split button com Aprovar primário e botão de mais ações', () => {
		render(
			<PendingResponseActions
				request={baseRequest()}
				requestId="r1"
				isWaiting
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-actions-approve')).toBeInTheDocument();
		expect(screen.getByTestId('pending-actions-more')).toBeInTheDocument();
	});

	test('renderiza indicador "Resolvida" e nenhum botão quando isWaiting=false', () => {
		render(
			<PendingResponseActions
				request={baseRequest({ isWaiting: false })}
				requestId="r1"
				isWaiting={false}
				{...noopHandlers()}
			/>,
		);
		expect(screen.getByTestId('pending-actions-resolved')).toBeInTheDocument();
		expect(screen.queryByTestId('pending-actions-approve')).toBeNull();
		expect(screen.queryByTestId('pending-actions-more')).toBeNull();
	});

	test('click no botão primário dispara onApprove(requestId)', () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions request={baseRequest()} requestId="r1" isWaiting {...handlers} />,
		);
		fireEvent.click(screen.getByTestId('pending-actions-approve'));
		expect(handlers.onApprove).toHaveBeenCalledWith('r1');
	});

	test('item "Criar Mock" no dropdown dispara onCreateMock(request, requestId)', () => {
		const handlers = noopHandlers();
		const request = baseRequest();
		render(<PendingResponseActions request={request} requestId="r1" isWaiting {...handlers} />);
		fireEvent.click(screen.getByTestId('pending-actions-create-mock'));
		expect(handlers.onCreateMock).toHaveBeenCalledWith(request, 'r1');
	});

	test('item "Ignorar" no dropdown dispara onIgnore(requestId)', () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions request={baseRequest()} requestId="r1" isWaiting {...handlers} />,
		);
		fireEvent.click(screen.getByTestId('pending-actions-ignore'));
		expect(handlers.onIgnore).toHaveBeenCalledWith('r1');
	});

	test('item "Aprovar e editar" abre o EditResponseDialog', async () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions request={baseRequest()} requestId="r1" isWaiting {...handlers} />,
		);
		fireEvent.click(screen.getByTestId('pending-actions-edit'));
		await waitFor(() => {
			expect(screen.getByTestId('edit-response-dialog')).toBeInTheDocument();
		});
	});

	test('hotkey Enter dispara onApprove quando hotkeysEnabled e isWaiting', async () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions
				request={baseRequest()}
				requestId="r1"
				isWaiting
				hotkeysEnabled
				{...handlers}
			/>,
		);
		fireEvent.keyDown(window, { key: 'Enter' });
		await waitFor(() => expect(handlers.onApprove).toHaveBeenCalledWith('r1'));
	});

	test('hotkey M dispara onCreateMock quando hotkeysEnabled', () => {
		const handlers = noopHandlers();
		const request = baseRequest();
		render(
			<PendingResponseActions
				request={request}
				requestId="r1"
				isWaiting
				hotkeysEnabled
				{...handlers}
			/>,
		);
		fireEvent.keyDown(window, { key: 'm' });
		expect(handlers.onCreateMock).toHaveBeenCalledWith(request, 'r1');
	});

	test('hotkey E abre o EditResponseDialog quando hotkeysEnabled', async () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions
				request={baseRequest()}
				requestId="r1"
				isWaiting
				hotkeysEnabled
				{...handlers}
			/>,
		);
		fireEvent.keyDown(window, { key: 'e' });
		await waitFor(() => {
			expect(screen.getByTestId('edit-response-dialog')).toBeInTheDocument();
		});
	});

	test('hotkeys são ignoradas quando o foco está em INPUT', () => {
		const handlers = noopHandlers();
		render(
			<>
				<input data-testid="external-input" />
				<PendingResponseActions
					request={baseRequest()}
					requestId="r1"
					isWaiting
					hotkeysEnabled
					{...handlers}
				/>
			</>,
		);
		const input = screen.getByTestId('external-input');
		fireEvent.keyDown(input, { key: 'Enter' });
		fireEvent.keyDown(input, { key: 'm' });
		fireEvent.keyDown(input, { key: 'e' });
		expect(handlers.onApprove).not.toHaveBeenCalled();
		expect(handlers.onCreateMock).not.toHaveBeenCalled();
	});

	test('botão primário é desabilitado quando disabled=true', () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions
				request={baseRequest()}
				requestId="r1"
				isWaiting
				disabled
				{...handlers}
			/>,
		);
		const approve = screen.getByTestId('pending-actions-approve') as HTMLButtonElement;
		expect(approve.disabled).toBe(true);
	});

	test('hotkeys NÃO disparam quando disabled=true', () => {
		const handlers = noopHandlers();
		render(
			<PendingResponseActions
				request={baseRequest()}
				requestId="r1"
				isWaiting
				hotkeysEnabled
				disabled
				{...handlers}
			/>,
		);
		fireEvent.keyDown(window, { key: 'Enter' });
		fireEvent.keyDown(window, { key: 'm' });
		fireEvent.keyDown(window, { key: 'e' });
		expect(handlers.onApprove).not.toHaveBeenCalled();
		expect(handlers.onCreateMock).not.toHaveBeenCalled();
	});
});
