import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { PendingInterception } from '@/lib/interceptionPipeline';
import { EditRequestSheet } from '../EditRequestSheet';

// Testes-foco da Phase 5: o botão "Aprovar sem modificações" envia o payload
// vazio, enquanto "Aprovar com modificações" envia o snapshot completo com as
// edições do form. "Cancelar" dispara `failRequest` via prop `onCancel`.

const baseEntry: PendingInterception = {
	stage: 'request',
	requestId: 'r-test',
	ruleId: 'rule-1',
	url: 'https://api.example.com/users/42',
	method: 'POST',
	request: {
		headers: { 'content-type': 'application/json' },
		postData: '{"id":42}',
	},
};

describe('EditRequestSheet — header + corpo iniciais', () => {
	test('renderiza URL/method/headers/body iniciais da entry', () => {
		render(
			<EditRequestSheet
				open
				onOpenChange={vi.fn()}
				entry={baseEntry}
				onApprove={vi.fn().mockResolvedValue(true)}
				onApproveWithEdit={vi.fn().mockResolvedValue({ success: true })}
				onCancel={vi.fn().mockResolvedValue(true)}
			/>,
		);

		expect(screen.getByTestId('edit-request-url-input')).toHaveValue(
			'https://api.example.com/users/42',
		);
		expect(screen.getByTestId('edit-request-method-trigger')).toHaveTextContent('POST');
		expect(screen.getByTestId('edit-request-body-input')).toHaveValue('{"id":42}');
		// Header inicial é renderizado como Input — não procuramos por texto livre.
		expect(screen.getAllByDisplayValue('content-type').length).toBeGreaterThanOrEqual(1);
	});

	test('header context mostra método e URL da entry', () => {
		render(
			<EditRequestSheet
				open
				onOpenChange={vi.fn()}
				entry={baseEntry}
				onApprove={vi.fn()}
				onApproveWithEdit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		expect(screen.getByTestId('edit-request-context-method')).toHaveTextContent('POST');
		expect(screen.getByTestId('edit-request-context-url')).toHaveTextContent(
			'https://api.example.com/users/42',
		);
	});
});

describe('EditRequestSheet — botões', () => {
	test('"Aprovar sem modificações" chama onApprove(requestId) e fecha o sheet', async () => {
		const onApprove = vi.fn().mockResolvedValue(true);
		const onOpenChange = vi.fn();
		render(
			<EditRequestSheet
				open
				onOpenChange={onOpenChange}
				entry={baseEntry}
				onApprove={onApprove}
				onApproveWithEdit={vi.fn().mockResolvedValue({ success: true })}
				onCancel={vi.fn().mockResolvedValue(true)}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-request-approve-no-mods'));

		await waitFor(() => expect(onApprove).toHaveBeenCalledWith('r-test'));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	test('"Aprovar com modificações" envia payload completo refletindo edições', async () => {
		const onApproveWithEdit = vi.fn().mockResolvedValue({ success: true });
		render(
			<EditRequestSheet
				open
				onOpenChange={vi.fn()}
				entry={baseEntry}
				onApprove={vi.fn().mockResolvedValue(true)}
				onApproveWithEdit={onApproveWithEdit}
				onCancel={vi.fn().mockResolvedValue(true)}
			/>,
		);

		fireEvent.change(screen.getByTestId('edit-request-url-input'), {
			target: { value: 'https://api.example.com/users/42?dev=1' },
		});
		fireEvent.change(screen.getByTestId('edit-request-body-input'), {
			target: { value: '{"id":42,"injected":true}' },
		});
		fireEvent.click(screen.getByTestId('edit-request-approve-with-mods'));

		await waitFor(() =>
			expect(onApproveWithEdit).toHaveBeenCalledWith('r-test', {
				url: 'https://api.example.com/users/42?dev=1',
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				postData: '{"id":42,"injected":true}',
			}),
		);
	});

	test('URL vazia bloqueia "Aprovar com modificações" com erro visível', () => {
		const onApproveWithEdit = vi.fn();
		render(
			<EditRequestSheet
				open
				onOpenChange={vi.fn()}
				entry={baseEntry}
				onApprove={vi.fn()}
				onApproveWithEdit={onApproveWithEdit}
				onCancel={vi.fn()}
			/>,
		);

		fireEvent.change(screen.getByTestId('edit-request-url-input'), { target: { value: '' } });
		const approveBtn = screen.getByTestId('edit-request-approve-with-mods');
		expect(approveBtn).toBeDisabled();
		expect(onApproveWithEdit).not.toHaveBeenCalled();
	});

	test('"Cancelar" chama onCancel(requestId) — flow de failRequest', async () => {
		const onCancel = vi.fn().mockResolvedValue(true);
		const onOpenChange = vi.fn();
		render(
			<EditRequestSheet
				open
				onOpenChange={onOpenChange}
				entry={baseEntry}
				onApprove={vi.fn().mockResolvedValue(true)}
				onApproveWithEdit={vi.fn().mockResolvedValue({ success: true })}
				onCancel={onCancel}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-request-cancel'));

		await waitFor(() => expect(onCancel).toHaveBeenCalledWith('r-test'));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	test('header com chave vazia gera erro inline e não dispara approveWithEdit', () => {
		const onApproveWithEdit = vi.fn();
		render(
			<EditRequestSheet
				open
				onOpenChange={vi.fn()}
				entry={baseEntry}
				onApprove={vi.fn()}
				onApproveWithEdit={onApproveWithEdit}
				onCancel={vi.fn()}
			/>,
		);

		// Adiciona uma linha de header vazia
		fireEvent.click(screen.getByTestId('edit-request-add-header'));
		const headerRows = screen.getAllByPlaceholderText('Header');
		const newHeaderInput = headerRows[headerRows.length - 1];
		const valueInputs = screen.getAllByPlaceholderText('valor');
		fireEvent.change(valueInputs[valueInputs.length - 1], { target: { value: 'qualquer' } });
		expect(newHeaderInput).toHaveValue('');

		fireEvent.click(screen.getByTestId('edit-request-approve-with-mods'));

		expect(onApproveWithEdit).not.toHaveBeenCalled();
		expect(screen.getByTestId('edit-request-error-toast')).toBeInTheDocument();
	});
});

describe('EditRequestSheet — onApproveWithEdit falha', () => {
	test('background success=false → mostra erro propagado no toast', async () => {
		const onApproveWithEdit = vi.fn().mockResolvedValue({ success: false, error: 'CDP detached' });
		render(
			<EditRequestSheet
				open
				onOpenChange={vi.fn()}
				entry={baseEntry}
				onApprove={vi.fn().mockResolvedValue(true)}
				onApproveWithEdit={onApproveWithEdit}
				onCancel={vi.fn().mockResolvedValue(true)}
			/>,
		);

		fireEvent.click(screen.getByTestId('edit-request-approve-with-mods'));

		await waitFor(() =>
			expect(screen.getByTestId('edit-request-error-toast')).toHaveTextContent('CDP detached'),
		);
	});
});
