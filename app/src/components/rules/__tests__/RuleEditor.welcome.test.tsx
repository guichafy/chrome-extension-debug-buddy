import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import RuleEditor from '../RuleEditor';

const baseRule: Rule = {
	id: 'r1',
	name: 'Existing',
	enabled: true,
	matchers: [{ type: 'url', enabled: true, pattern: '/api', isRegex: false }],
	action: { type: 'mock', enabled: true, status: 200, headers: {} },
	createdAt: 0,
	updatedAt: 0,
};

describe('RuleEditor welcome flow', () => {
	test('mode=create abre na welcome screen', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		expect(screen.getByText('Comece do zero ou escolha um template.')).toBeInTheDocument();
		expect(screen.getByTestId('preset-blank')).toBeInTheDocument();
	});

	test('mode=edit pula welcome e abre direto no editor', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);
		expect(screen.queryByTestId('preset-blank')).not.toBeInTheDocument();
		expect(screen.getByText('Editar Regra')).toBeInTheDocument();
		expect(screen.getByLabelText(/Nome da Regra/)).toHaveValue('Existing');
	});

	test('clicar preset transita para editor com nome do preset preenchido', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-mock_500'));

		expect(screen.queryByTestId('preset-blank')).not.toBeInTheDocument();
		expect(screen.getByLabelText(/Nome da Regra/)).toHaveValue('Erro 500 (Internal Server Error)');
		expect(screen.getByRole('button', { name: /Voltar/ })).toBeInTheDocument();
	});

	test('preset selecionado bloqueia save com URL vazia (botao desabilitado + erro listado)', () => {
		const onSave = vi.fn().mockResolvedValue(true);
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={onSave} />);
		fireEvent.click(screen.getByTestId('preset-mock_500'));

		// Wizard linear: avanca ate o ultimo step para conseguir clicar em Adicionar
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));

		const saveBtn = screen.getByRole('button', { name: /Adicionar/ });
		expect(saveBtn).toBeDisabled();
		expect(screen.getByTestId('rule-wizard-errors')).toHaveTextContent(
			'Preencha o padrão da URL antes de salvar',
		);

		fireEvent.click(saveBtn);
		expect(onSave).not.toHaveBeenCalled();
	});

	test('clicar "Em branco" transita para editor com defaults', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));

		expect(screen.queryByTestId('preset-blank')).not.toBeInTheDocument();
		expect(screen.getByLabelText(/Nome da Regra/)).toHaveValue('Nova Regra');
	});

	test('clicar "Voltar" no editor retorna para welcome (apenas em create)', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-mock_500'));
		expect(screen.queryByTestId('preset-blank')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
		expect(screen.getByTestId('preset-blank')).toBeInTheDocument();
	});
});
