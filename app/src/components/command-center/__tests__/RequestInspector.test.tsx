import React from 'react';
import { render, screen } from '@testing-library/react';
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

const noopHandlers = {
	onApprove: vi.fn(),
	onIgnore: vi.fn(),
	onCreateMock: vi.fn(),
	onOpenInRulesLab: vi.fn(),
	onReplay: vi.fn(),
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
		expect(screen.getByText(/123/)).toBeInTheDocument();
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
		render(<RequestInspector request={req} requestId="r1" rules={[]} {...noopHandlers} />);
		expect(screen.getByText(/Body too large to capture/)).toBeInTheDocument();
	});

	test('mostra ações de pendente quando isWaiting=true', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: true })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.getByRole('button', { name: /Aprovar/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Ignorar/i })).toBeInTheDocument();
	});

	test('esconde ações de pendente quando isWaiting!=true', () => {
		render(
			<RequestInspector
				request={baseRequest({ isWaiting: false })}
				requestId="r1"
				rules={[]}
				{...noopHandlers}
			/>,
		);
		expect(screen.queryByRole('button', { name: /Aprovar/i })).toBeNull();
	});
});
