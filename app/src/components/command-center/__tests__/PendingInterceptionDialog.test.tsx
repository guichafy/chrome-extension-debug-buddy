import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { PendingInterception } from '@/lib/interceptionPipeline';
import { PendingInterceptionDialog } from '../PendingInterceptionDialog';

// O hub roteia pra `EditRequestSheet` (stage='request') ou `EditResponseSheet`
// (stage='response') sem fabricar dados que não existem na entry. Estes testes
// asseguram que o dispatch funciona pelos data-testid únicos de cada sheet.

const requestEntry: PendingInterception = {
	stage: 'request',
	requestId: 'r-req',
	ruleId: 'rule-x',
	url: 'https://api.example.com/req-target',
	method: 'POST',
	request: {
		headers: { 'content-type': 'application/json' },
		postData: '{"foo":1}',
	},
};

const responseEntry: PendingInterception = {
	stage: 'response',
	requestId: 'r-res',
	ruleId: 'rule-y',
	url: 'https://api.example.com/res-target',
	method: 'GET',
	request: { headers: {} },
	response: {
		status: 200,
		statusPhrase: 'OK',
		headers: { 'content-type': 'application/json' },
		body: '{"ok":true}',
	},
};

describe('PendingInterceptionDialog — dispatch por stage', () => {
	test('stage=request renderiza EditRequestSheet', () => {
		render(
			<PendingInterceptionDialog
				open
				onOpenChange={vi.fn()}
				entry={requestEntry}
				onApprove={vi.fn().mockResolvedValue(true)}
				onApproveWithEdit={vi.fn().mockResolvedValue({ success: true })}
				onCancel={vi.fn().mockResolvedValue(true)}
			/>,
		);
		expect(screen.getByTestId('edit-request-sheet')).toBeInTheDocument();
		expect(screen.queryByTestId('edit-response-sheet')).toBeNull();
		expect(screen.getByTestId('edit-request-context-url')).toHaveTextContent(
			'https://api.example.com/req-target',
		);
	});

	test('stage=response renderiza EditResponseSheet', () => {
		render(
			<PendingInterceptionDialog
				open
				onOpenChange={vi.fn()}
				entry={responseEntry}
				onApprove={vi.fn().mockResolvedValue(true)}
				onApproveWithEdit={vi.fn().mockResolvedValue({ success: true })}
				onCancel={vi.fn().mockResolvedValue(true)}
			/>,
		);
		expect(screen.getByTestId('edit-response-sheet')).toBeInTheDocument();
		expect(screen.queryByTestId('edit-request-sheet')).toBeNull();
		expect(screen.getByTestId('edit-response-context-url')).toHaveTextContent(
			'https://api.example.com/res-target',
		);
	});

	test('stage=response sem snapshot de response lança erro explícito (no-fallback)', () => {
		const malformedEntry: PendingInterception = {
			...responseEntry,
			response: undefined,
		};
		// Lançar é o comportamento esperado — UI captura no boundary, evitando
		// que a fila silenciosa renderize um sheet inválido.
		expect(() =>
			render(
				<PendingInterceptionDialog
					open
					onOpenChange={vi.fn()}
					entry={malformedEntry}
					onApprove={vi.fn()}
					onApproveWithEdit={vi.fn()}
					onCancel={vi.fn()}
				/>,
			),
		).toThrowError(/sem snapshot de response/);
	});
});
