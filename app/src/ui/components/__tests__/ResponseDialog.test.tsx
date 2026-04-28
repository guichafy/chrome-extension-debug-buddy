import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResponseDialog from '../ResponseDialog';
import { InterceptedResponse } from '../../hooks/useResponses';

// Mock para os componentes do shadcn-ui
vi.mock('../shadcn/dialog', () => ({
	Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
	DialogContent: ({ children, className }: any) => (
		<div data-testid="dialog-content" className={className}>
			{children}
		</div>
	),
	DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
	DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
	DialogFooter: ({ children, className }: any) => (
		<div data-testid="dialog-footer" className={className}>
			{children}
		</div>
	),
	DialogClose: ({ children, asChild }: any) => <div data-testid="dialog-close">{children}</div>,
	DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
}));

vi.mock('../shadcn/card', () => ({
	Card: ({ children, className }: any) => (
		<div data-testid="card" className={className}>
			{children}
		</div>
	),
	CardContent: ({ children, className }: any) => (
		<div data-testid="card-content" className={className}>
			{children}
		</div>
	),
}));

vi.mock('../shadcn/badge', () => ({
	Badge: ({ children, variant, className }: any) => (
		<span data-testid="badge" data-variant={variant} className={className}>
			{children}
		</span>
	),
}));

vi.mock('../shadcn/button', () => ({
	Button: ({ children, onClick, variant, size, className, disabled }: any) => (
		<button
			data-testid="button"
			data-variant={variant}
			data-size={size}
			className={className}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</button>
	),
}));

vi.mock('../shadcn/input', () => ({
	Input: ({ id, value, onChange, disabled, className, type }: any) => (
		<input
			data-testid="input"
			id={id}
			value={value}
			onChange={onChange}
			disabled={disabled}
			className={className}
			type={type}
		/>
	),
}));

vi.mock('../shadcn/icon', () => ({
	Icon: ({ name, className }: any) => (
		<span data-testid="icon" data-name={name} className={className}>
			{name}
		</span>
	),
}));

vi.mock('../shadcn/tabs', () => ({
	Tabs: ({ children, defaultValue, className }: any) => (
		<div data-testid="tabs" data-default-value={defaultValue} className={className}>
			{children}
		</div>
	),
	TabsList: ({ children, className }: any) => (
		<div data-testid="tabs-list" className={className}>
			{children}
		</div>
	),
	TabsTrigger: ({ children, value }: any) => (
		<button data-testid="tabs-trigger" data-value={value}>
			{children}
		</button>
	),
	TabsContent: ({ children, value, className }: any) => (
		<div data-testid="tabs-content" data-value={value} className={className}>
			{children}
		</div>
	),
}));

vi.mock('../shadcn/scroll-area', () => ({
	ScrollArea: ({ children, className }: any) => (
		<div data-testid="scroll-area" className={className}>
			{children}
		</div>
	),
}));

describe('ResponseDialog Component', () => {
	const mockResponse: InterceptedResponse = {
		url: 'https://api.example.com/data',
		method: 'GET',
		status: 200,
		statusText: 'OK',
		headers: { 'Content-Type': 'application/json' },
		mimeType: 'application/json',
		type: 'xhr',
		timestamp: Date.now(),
		body: '{"data": "test"}',
	};

	const mockRequestId = 'req1';
	const mockOnApprove = vi.fn().mockResolvedValue(true);
	const mockOnIgnore = vi.fn().mockResolvedValue(true);
	const mockOnMock = vi.fn();
	const mockOnEdit = vi.fn();
	const mockOnCancel = vi.fn();
	const mockOnOpenChange = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('renderiza o diálogo quando open é true', () => {
		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={mockResponse}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		// Verificar se o diálogo foi renderizado
		expect(screen.getByTestId('dialog')).toBeInTheDocument();

		// O título contém informações da requisição, não um texto fixo
		expect(screen.getByTestId('dialog-title')).toBeInTheDocument();

		// Verificar se as informações básicas estão presentes
		// A URL aparece múltiplas vezes, então vamos usar getAllByText
		const urlTexts = screen.getAllByText('https://api.example.com/data');
		expect(urlTexts.length).toBeGreaterThan(0);

		// O método GET também aparece múltiplas vezes
		const getTexts = screen.getAllByText('GET');
		expect(getTexts.length).toBeGreaterThan(0);

		expect(screen.getByText('xhr')).toBeInTheDocument();

		// Usar getAllByText para application/json pois pode aparecer múltiplas vezes
		const jsonTexts = screen.getAllByText('application/json');
		expect(jsonTexts.length).toBeGreaterThan(0);

		// Verificar se as abas estão presentes
		expect(screen.getByTestId('tabs')).toBeInTheDocument();
		expect(screen.getAllByTestId('tabs-trigger').length).toBe(2); // Agora são apenas 2 abas: Request e Response

		// Verificar se os botões de ação estão presentes
		const buttons = screen.getAllByTestId('button');
		expect(buttons.length).toBeGreaterThan(0);
	});

	test('exibe o corpo da requisição quando presente', () => {
		const responseWithBody: InterceptedResponse = {
			...mockResponse,
			request: { postData: 'foo=bar' },
		};

		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={responseWithBody}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		const textarea = screen.getByDisplayValue('foo=bar');
		expect(textarea).toBeInTheDocument();
	});

	test('não renderiza nada quando open é false', () => {
		render(
			<ResponseDialog
				open={false}
				onOpenChange={mockOnOpenChange}
				response={mockResponse}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		// Verificar se o diálogo não foi renderizado
		expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
	});

	test('chama onApprove quando o botão Aprovar é clicado', () => {
		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={mockResponse}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		// Encontrar o botão de aprovar e clicar nele
		const approveButton = screen
			.getAllByTestId('button')
			.find((button) => button.textContent!.includes('Aprovar'));
		fireEvent.click(approveButton!);

		// Verificar se onApprove foi chamado com os parâmetros corretos
		expect(mockOnApprove).toHaveBeenCalledWith(mockRequestId, {});
	});

	test('chama onIgnore quando o botão Ignorar é clicado', () => {
		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={mockResponse}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		// Encontrar o botão de ignorar e clicar nele
		const ignoreButton = screen
			.getAllByTestId('button')
			.find((button) => button.textContent!.includes('Ignorar'));
		fireEvent.click(ignoreButton!);

		// Verificar se onIgnore foi chamado com o ID correto
		expect(mockOnIgnore).toHaveBeenCalledWith(mockRequestId);
	});

	test('chama onMock quando o botão Criar Mock é clicado', () => {
		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={mockResponse}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		// Encontrar o botão de criar mock e clicar nele
		const mockButton = screen
			.getAllByTestId('button')
			.find((button) => button.textContent!.includes('Criar Mock'));
		fireEvent.click(mockButton!);

		// Verificar se onMock foi chamado com a resposta correta
		expect(mockOnMock).toHaveBeenCalledWith(mockResponse);
	});

	test('não renderiza nada quando response ou requestId são null', () => {
		const { container } = render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={null}
				requestId={null}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		// Verificar se o componente não renderizou nada
		expect(container.firstChild).toBeNull();
	});

	test('desabilita Criar Mock e ignora cliques quando a resposta tem captureError', () => {
		const responseWithCaptureError: InterceptedResponse = {
			...mockResponse,
			body: undefined,
			captureError: 'CDP não retornou corpo da resposta',
		};

		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={responseWithCaptureError}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		const mockButton = screen
			.getAllByTestId('button')
			.find((button) => button.textContent!.includes('Criar Mock'));
		expect(mockButton).toBeTruthy();
		expect(mockButton).toBeDisabled();

		fireEvent.click(mockButton!);
		expect(mockOnMock).not.toHaveBeenCalled();
	});

	test('desabilita Criar Mock quando o body é indisponível (ex.: redirect 301)', () => {
		const redirectResponse: InterceptedResponse = {
			...mockResponse,
			status: 301,
			statusText: 'Moved Permanently',
			body: undefined,
			bodyUnavailableReason: 'Redirect 301 não possui corpo disponível para captura.',
		};

		render(
			<ResponseDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				response={redirectResponse}
				requestId={mockRequestId}
				onApprove={mockOnApprove}
				onIgnore={mockOnIgnore}
				onMock={mockOnMock}
				onEdit={mockOnEdit}
				onCancel={mockOnCancel}
				isEditing={false}
			/>,
		);

		const mockButton = screen
			.getAllByTestId('button')
			.find((button) => button.textContent!.includes('Criar Mock'));
		expect(mockButton).toBeDisabled();

		fireEvent.click(mockButton!);
		expect(mockOnMock).not.toHaveBeenCalled();
	});
});
