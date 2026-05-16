import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { InterceptedResponse } from '@/types/intercepted';
import { RequestInspector } from '../RequestInspector';

const baseRequest = (overrides: Partial<InterceptedResponse> = {}): InterceptedResponse => ({
	url: 'https://api.example.com/users/42?token=abc',
	method: 'GET',
	status: 200,
	statusText: 'OK',
	headers: { 'content-type': 'application/json' },
	type: 'XHR',
	timestamp: 1,
	mimeType: 'application/json',
	body: '{"id":42}',
	response: { headers: { 'content-type': 'application/json' }, body: '{"id":42}' },
	request: { headers: { authorization: 'Bearer secret' } },
	...overrides,
});

const selectTab = async (name: string) => {
	const tab = screen.getByRole('tab', { name });
	fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
	await waitFor(() => expect(tab).toHaveAttribute('data-state', 'active'));
};

const noopHandlers = {
	onCreateRule: vi.fn(),
	onOpenInRulesLab: vi.fn(),
	onClose: vi.fn(),
};

describe('RequestInspector', () => {
	test('mostra estado vazio quando nenhuma request está selecionada', () => {
		render(<RequestInspector request={null} requestId={null} rules={[]} {...noopHandlers} />);
		expect(screen.getByText(/Selecione uma requisição/)).toBeInTheDocument();
	});

	test('renderiza header com método, URL truncada, status e duração', () => {
		render(
			<RequestInspector
				request={baseRequest({ duration: 123 })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.getByText(/api.example.com/)).toBeInTheDocument();
		expect(screen.getByText('200')).toBeInTheDocument();
		expect(screen.getAllByText(/123/).length).toBeGreaterThan(0);
	});

	test('mostra captureError quando presente', () => {
		render(
			<RequestInspector
				request={baseRequest({ captureError: 'Net::ERR_FAILED' })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByText(/Net::ERR_FAILED/)).toBeInTheDocument();
	});

	test('mostra body indisponível quando bodyUnavailableReason presente', () => {
		const req = baseRequest({ bodyUnavailableReason: 'Body too large to capture' });
		(req as { body?: string }).body = undefined;
		(req as { response?: { headers: Record<string, string>; body?: string } }).response = {
			headers: { 'content-type': 'application/json' },
			body: undefined,
		};
		render(<RequestInspector request={req} requestId="r1" rules={[]} {...noopHandlers} />);
		// aviso global no topo do inspector
		expect(screen.getByText(/Body too large to capture/)).toBeInTheDocument();
	});

	test('mostra badge "Aguardando decisão" quando isWaiting=true (decisões ficam no Dock)', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByTestId('awaiting-decision-badge')).toBeInTheDocument();
		// As ações de aprovação/edição/ignorar não vivem mais no inspector — elas
		// foram movidas para o PendingActionDock para evitar duplicidade.
		expect(screen.queryByTestId('pending-actions-approve')).toBeNull();
		expect(screen.queryByTestId('pending-actions-more')).toBeNull();
	});

	test('mostra badge "Resolvida" quando isWaiting!=true', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: false })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByTestId('resolved-badge')).toBeInTheDocument();
		expect(screen.queryByTestId('awaiting-decision-badge')).toBeNull();
	});

	test('dropdown "Criar regra" sempre visível', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByTestId('request-inspector-create-rule')).toBeInTheDocument();
	});

	test('dropdown desabilitado quando captureError presente', () => {
		render(
			<RequestInspector
				request={baseRequest({ captureError: 'Net::ERR_FAILED' })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByTestId('request-inspector-create-rule')).toBeDisabled();
	});

	test.each([
		['mock', 'Mock'],
		['breakpoint', 'Breakpoint'],
		['transform', 'Transform'],
		['requestDelay', 'Latência'],
	] as const)('item "%s" do dropdown chama onCreateRule com type=%s', async (type, label) => {
		const onCreateRule = vi.fn();
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
				onCreateRule={onCreateRule}
			/>,
		);
		const trigger = screen.getByTestId('request-inspector-create-rule');
		// Radix DropdownMenu abre via pointerdown (não click puro) — emulamos para
		// que o portal com os DropdownMenuItem renderize.
		fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
		const item = await screen.findByTestId(`request-inspector-create-rule-${type}`);
		expect(item).toHaveTextContent(label);
		fireEvent.click(item);
		expect(onCreateRule).toHaveBeenCalledTimes(1);
		expect(onCreateRule).toHaveBeenCalledWith(
			expect.objectContaining({ isWaiting: true }),
			'r1',
			type,
		);
	});

	test('badge de status e dropdown "Criar regra" ficam na mesma linha (status row)', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		const statusRow = screen.getByTestId('request-inspector-status-row');
		expect(statusRow).toContainElement(screen.getByTestId('awaiting-decision-badge'));
		expect(statusRow).toContainElement(screen.getByTestId('request-inspector-create-rule'));
	});

	test('aba Request mostra headers e body unidos', async () => {
		render(
			<RequestInspector
				request={baseRequest({
					request: { headers: { 'x-trace': 'abc' }, postData: 'POST_BODY' },
				})}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		await selectTab('Request');
		expect(screen.getByText('x-trace')).toBeInTheDocument();
		expect(screen.getByText('POST_BODY')).toBeInTheDocument();
	});

	test('aba Response mostra headers e body unidos', async () => {
		render(
			<RequestInspector request={baseRequest()} requestId="r1" rules={[]} {...noopHandlers} />,
		);
		await selectTab('Response');
		expect(screen.getByText('content-type')).toBeInTheDocument();
		// JSON é pretty-printed pelo BodyViewer — checa partes do conteúdo no <pre>
		const pre = document.querySelector('pre');
		expect(pre?.textContent).toContain('"id"');
		expect(pre?.textContent).toContain('42');
	});

	test('aba Response mostra comparação quando há regra mock ativa', async () => {
		const rule = {
			id: 'r-mock',
			name: 'Mock teste',
			enabled: true,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			actions: [
				{
					type: 'mock',
					enabled: true,
					status: 503,
					statusPhrase: 'Service Unavailable',
					headers: {},
					body: '{"err":"x"}',
				},
			],
			createdAt: 1,
			updatedAt: 1,
		} as any;
		render(
			<RequestInspector request={baseRequest()} requestId="r1" rules={[rule]} {...noopHandlers} />,
		);
		await selectTab('Response');
		expect(screen.getByText(/Mock ativo aplicado/)).toBeInTheDocument();
		expect(screen.getByText(/503 Service Unavailable/)).toBeInTheDocument();
	});

	test('não renderiza aba Replay nem botão Replay', () => {
		render(
			<RequestInspector request={baseRequest()} requestId="r1" rules={[]} {...noopHandlers} />,
		);
		expect(screen.queryByRole('tab', { name: /Replay/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /^Replay$/i })).toBeNull();
	});

	test('aba Body não existe mais', () => {
		render(
			<RequestInspector request={baseRequest()} requestId="r1" rules={[]} {...noopHandlers} />,
		);
		expect(screen.queryByRole('tab', { name: /^Body$/i })).toBeNull();
	});

	test('mostra descrição do breakpoint quando isWaiting=true e regra breakpoint casa', () => {
		const breakpointRule = {
			id: 'r-bp',
			name: 'Pausar autenticação',
			enabled: true,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			actions: [
				{
					type: 'breakpoint',
					enabled: true,
					description: 'Verificar token de autenticação antes de continuar',
				},
			],
			createdAt: 1,
			updatedAt: 1,
		} as any;
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[breakpointRule]}
				{...noopHandlers}
			/>,
		);

		const banner = screen.getByTestId('breakpoint-description-banner');
		expect(banner).toBeInTheDocument();
		expect(banner).toHaveTextContent('Breakpoint pausou esta requisição');
		expect(banner).toHaveTextContent('Verificar token de autenticação antes de continuar');
	});

	test('não mostra banner de breakpoint quando regra breakpoint casa mas não tem descrição', () => {
		const breakpointRule = {
			id: 'r-bp',
			name: 'Sem descrição',
			enabled: true,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			actions: [{ type: 'breakpoint', enabled: true }],
			createdAt: 1,
			updatedAt: 1,
		} as any;
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[breakpointRule]}
				{...noopHandlers}
			/>,
		);
		expect(screen.queryByTestId('breakpoint-description-banner')).toBeNull();
	});

	test('não mostra banner de breakpoint quando isWaiting=false mesmo com regra casando', () => {
		const breakpointRule = {
			id: 'r-bp',
			name: 'Com descrição',
			enabled: true,
			stage: 'response',
			matchers: [
				{ type: 'url', enabled: true, pattern: 'api.example.com/users', isRegex: false },
				{ type: 'method', enabled: true, method: 'GET' },
			],
			actions: [{ type: 'breakpoint', enabled: true, description: 'desc' }],
			createdAt: 1,
			updatedAt: 1,
		} as any;
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: false })}
				requestId="r1"
				rules={[breakpointRule]}
				{...noopHandlers}
			/>,
		);
		expect(screen.queryByTestId('breakpoint-description-banner')).toBeNull();
	});
});
