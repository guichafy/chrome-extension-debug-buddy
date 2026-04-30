import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import RuleEditor from '../RuleEditor';

const baseRule: Rule = {
	id: 'r1',
	name: 'API mockada',
	enabled: true,
	matchers: [
		{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false },
		{ type: 'method', enabled: true, method: 'GET' },
	],
	action: { type: 'mock', enabled: true, status: 200, headers: {} },
	createdAt: 0,
	updatedAt: 0,
};

const advanceToReview = () => {
	fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
	fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
	fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
};

describe('RuleEditor wizard', () => {
	test('renderiza header com 4 passos: Tipo, Matcher, Acao, Revisar', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		const stepBar = screen.getByTestId('rule-wizard-steps');
		expect(within(stepBar).getByTestId('rule-wizard-step-type')).toBeInTheDocument();
		expect(within(stepBar).getByTestId('rule-wizard-step-matcher')).toBeInTheDocument();
		expect(within(stepBar).getByTestId('rule-wizard-step-action')).toBeInTheDocument();
		expect(within(stepBar).getByTestId('rule-wizard-step-review')).toBeInTheDocument();
	});

	test('botao Anterior desabilitado no primeiro passo, Proximo habilitado', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
		expect(screen.getByRole('button', { name: /Próximo/ })).not.toBeDisabled();
		expect(screen.queryByRole('button', { name: /Salvar$/ })).not.toBeInTheDocument();
	});

	test('Proximo avanca pelo wizard ate Revisar onde Salvar substitui Proximo', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		expect(screen.getByTestId('rule-wizard-step-matcher')).toHaveAttribute('aria-current', 'step');

		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');

		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		expect(screen.getByTestId('rule-wizard-step-review')).toHaveAttribute('aria-current', 'step');

		expect(screen.queryByRole('button', { name: /Próximo/ })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Salvar/ })).toBeInTheDocument();
	});

	test('Anterior volta ao step anterior preservando estado digitado', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		const nameInput = screen.getByLabelText(/Nome da Regra/);
		fireEvent.change(nameInput, { target: { value: 'Novo nome' } });

		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));

		expect(screen.getByLabelText(/Nome da Regra/)).toHaveValue('Novo nome');
	});

	test('em modo edit todos os steps sao clicaveis diretamente', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));
		expect(screen.getByTestId('rule-wizard-step-review')).toHaveAttribute('aria-current', 'step');
		expect(screen.getByRole('button', { name: /Salvar/ })).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('rule-wizard-step-type'));
		expect(screen.getByTestId('rule-wizard-step-type')).toHaveAttribute('aria-current', 'step');
	});

	test('em modo create steps a frente nao sao clicaveis ate que sejam alcancados', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));

		const reviewBtn = screen.getByTestId('rule-wizard-step-review');
		expect(reviewBtn).toBeDisabled();

		fireEvent.click(reviewBtn);
		expect(screen.getByTestId('rule-wizard-step-type')).toHaveAttribute('aria-current', 'step');
	});

	test('cancelar em edit sem mudancas fecha sem confirmacao', () => {
		const onOpenChange = vi.fn();
		render(
			<RuleEditor open mode="edit" rule={baseRule} onOpenChange={onOpenChange} onSave={vi.fn()} />,
		);

		fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
		expect(screen.queryByText(/Descartar alterações/)).not.toBeInTheDocument();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	test('cancelar em edit com mudancas pede confirmacao', () => {
		const onOpenChange = vi.fn();
		render(
			<RuleEditor open mode="edit" rule={baseRule} onOpenChange={onOpenChange} onSave={vi.fn()} />,
		);

		fireEvent.change(screen.getByLabelText(/Nome da Regra/), { target: { value: 'Outro nome' } });
		fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));

		expect(screen.getByText(/Descartar alterações/)).toBeInTheDocument();
		expect(onOpenChange).not.toHaveBeenCalledWith(false);

		fireEvent.click(screen.getByRole('button', { name: /Continuar editando/ }));
		expect(screen.queryByText(/Descartar alterações/)).not.toBeInTheDocument();
	});

	test('confirmar Descartar fecha o dialog e chama onOpenChange(false)', () => {
		const onOpenChange = vi.fn();
		render(
			<RuleEditor open mode="edit" rule={baseRule} onOpenChange={onOpenChange} onSave={vi.fn()} />,
		);

		fireEvent.change(screen.getByLabelText(/Nome da Regra/), { target: { value: 'Outro nome' } });
		fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
		fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	test('Revisar mostra resumo da regra (nome, tipo, matcher, acao)', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		advanceToReview();

		expect(screen.getByText('API mockada')).toBeInTheDocument();
		expect(screen.getByText('Mock')).toBeInTheDocument();
		expect(screen.getByText(/GET .*\/api\/users/)).toBeInTheDocument();
		expect(screen.getByText(/Mock 200/)).toBeInTheDocument();
	});

	test('Save desabilitado e erros agregados quando URL pattern vazio', () => {
		const ruleSemPattern: Rule = {
			...baseRule,
			matchers: [{ type: 'url', enabled: true, pattern: '', isRegex: false }],
		};
		const onSave = vi.fn();
		render(
			<RuleEditor open mode="edit" rule={ruleSemPattern} onOpenChange={vi.fn()} onSave={onSave} />,
		);

		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));
		const saveBtn = screen.getByTestId('rule-wizard-save');
		expect(saveBtn).toBeDisabled();

		const errors = screen.getByTestId('rule-wizard-errors');
		expect(errors).toHaveTextContent('Preencha o padrão da URL antes de salvar');

		fireEvent.click(saveBtn);
		expect(onSave).not.toHaveBeenCalled();
	});

	test('clicar em erro listado navega para o step correspondente', () => {
		const ruleSemPattern: Rule = {
			...baseRule,
			matchers: [{ type: 'url', enabled: true, pattern: '', isRegex: false }],
		};
		render(
			<RuleEditor open mode="edit" rule={ruleSemPattern} onOpenChange={vi.fn()} onSave={vi.fn()} />,
		);

		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));
		fireEvent.click(screen.getByTestId('rule-wizard-error-url-pattern-empty'));

		expect(screen.getByTestId('rule-wizard-step-matcher')).toHaveAttribute('aria-current', 'step');
	});

	test('em modo edit sem alteracoes mostra mensagem de "nenhuma alteracao" e Save habilitado', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));

		expect(screen.getByTestId('rule-wizard-diff-empty')).toBeInTheDocument();
		expect(screen.queryByTestId('rule-wizard-diff')).not.toBeInTheDocument();
		expect(screen.getByTestId('rule-wizard-save')).not.toBeDisabled();
		expect(screen.getByTestId('rule-wizard-ready')).toBeInTheDocument();
	});

	test('em modo edit com alteracoes destaca campos modificados no diff', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		fireEvent.change(screen.getByLabelText(/Nome da Regra/), {
			target: { value: 'Novo Nome' },
		});
		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));

		const diff = screen.getByTestId('rule-wizard-diff');
		expect(diff).toBeInTheDocument();

		const nameRow = within(diff).getByTestId('rule-wizard-diff-row-name');
		expect(nameRow).toHaveAttribute('data-changed', 'true');
		expect(nameRow).toHaveTextContent('API mockada');
		expect(nameRow).toHaveTextContent('Novo Nome');

		const matcherRow = within(diff).getByTestId('rule-wizard-diff-row-matcher');
		expect(matcherRow).toHaveAttribute('data-changed', 'false');
	});

	test('em modo create nao renderiza diff section', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));

		// Preenche URL e avanca ate review (URL precisa ter pattern para Save habilitar)
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.change(screen.getByTestId('unified-url-input'), {
			target: { value: '/api/test' },
		});
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));

		expect(screen.queryByTestId('rule-wizard-diff')).not.toBeInTheDocument();
		expect(screen.queryByTestId('rule-wizard-diff-empty')).not.toBeInTheDocument();
		expect(screen.getByTestId('rule-wizard-save')).not.toBeDisabled();
	});

	test('Save habilitado dispara onSave com payload completo', async () => {
		const onSave = vi.fn().mockResolvedValue(true);
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={onSave} />);

		fireEvent.change(screen.getByLabelText(/Nome da Regra/), {
			target: { value: 'API atualizada' },
		});
		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));
		fireEvent.click(screen.getByTestId('rule-wizard-save'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'API atualizada',
				enabled: true,
				matchers: baseRule.matchers,
				action: baseRule.action,
			}),
		);
	});
});
