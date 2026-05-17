import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import RuleEditor from '../RuleEditor';

const baseRule: Rule = {
	id: 'r1',
	name: 'API mockada',
	enabled: true,
	stage: 'response',
	matchers: [
		{ type: 'url', enabled: true, pattern: '/api/users', isRegex: false },
		{ type: 'method', enabled: true, method: 'GET' },
	],
	actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
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
				actions: baseRule.actions,
			}),
		);
	});
});

describe('RuleEditor wizard — step Tipo (cards)', () => {
	test('renderiza 4 cards (mock, transform, requestDelay, breakpoint) com descrições corretas', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		const group = screen.getByTestId('rule-wizard-type-cards');
		expect(within(group).getByTestId('rule-wizard-type-card-mock')).toHaveTextContent(
			'Não chama o servidor — retorna a resposta mockada.',
		);
		expect(within(group).getByTestId('rule-wizard-type-card-transform')).toHaveTextContent(
			'Chama o servidor e aplica modificações na resposta.',
		);
		expect(within(group).getByTestId('rule-wizard-type-card-requestDelay')).toHaveTextContent(
			'Atrasa a resposta antes de devolver ao cliente.',
		);
		expect(within(group).getByTestId('rule-wizard-type-card-breakpoint')).toHaveTextContent(
			'Pausa antes de responder e permite editar a resposta em voo.',
		);
	});

	test('o card do tipo atual aparece visualmente destacado (data-selected/aria-pressed)', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		const mockCard = screen.getByTestId('rule-wizard-type-card-mock');
		expect(mockCard).toHaveAttribute('data-selected', 'true');
		expect(mockCard).toHaveAttribute('aria-pressed', 'true');
		expect(
			within(mockCard).getByTestId('rule-wizard-type-card-mock-selected-badge'),
		).toBeInTheDocument();

		const delayCard = screen.getByTestId('rule-wizard-type-card-requestDelay');
		expect(delayCard).toHaveAttribute('data-selected', 'false');
		expect(delayCard).toHaveAttribute('aria-pressed', 'false');
	});

	test('em modo create clicar em outro card troca o tipo da ação', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));

		expect(screen.getByTestId('rule-wizard-type-card-mock')).toHaveAttribute(
			'data-selected',
			'true',
		);

		fireEvent.click(screen.getByTestId('rule-wizard-type-card-requestDelay'));
		expect(screen.getByTestId('rule-wizard-type-card-requestDelay')).toHaveAttribute(
			'data-selected',
			'true',
		);
		expect(screen.getByTestId('rule-wizard-type-card-mock')).toHaveAttribute(
			'data-selected',
			'false',
		);

		fireEvent.click(screen.getByTestId('rule-wizard-type-card-breakpoint'));
		expect(screen.getByTestId('rule-wizard-type-card-breakpoint')).toHaveAttribute(
			'data-selected',
			'true',
		);
	});

	test('em modo edit os cards não selecionados ficam desabilitados (tipo bloqueado)', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		const transformCard = screen.getByTestId('rule-wizard-type-card-transform');
		expect(transformCard).toBeDisabled();
		expect(transformCard).toHaveAttribute('aria-disabled', 'true');

		const breakpointCard = screen.getByTestId('rule-wizard-type-card-breakpoint');
		expect(breakpointCard).toBeDisabled();

		const mockCard = screen.getByTestId('rule-wizard-type-card-mock');
		expect(mockCard).not.toBeDisabled();

		// Tentativa de clicar em card desabilitado não muda a seleção
		fireEvent.click(transformCard);
		expect(mockCard).toHaveAttribute('data-selected', 'true');
		expect(transformCard).toHaveAttribute('data-selected', 'false');
	});

	test('em modo edit a explicação reforça que o tipo é imutável', () => {
		render(<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />);

		const group = screen.getByTestId('rule-wizard-type-cards');
		expect(group).toHaveTextContent(
			'Em edição, o tipo não pode ser alterado — para mudar o tipo, crie uma nova regra.',
		);
	});

	test('em modo create trocar para requestDelay produz action.timeMs default no payload salvo', async () => {
		const onSave = vi.fn().mockResolvedValue(true);
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={onSave} />);
		fireEvent.click(screen.getByTestId('preset-blank'));

		fireEvent.click(screen.getByTestId('rule-wizard-type-card-requestDelay'));

		// Avança para Matcher e preenche URL
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.change(screen.getByTestId('unified-url-input'), {
			target: { value: '/api/slow' },
		});
		// Avança até Revisar
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));

		fireEvent.click(screen.getByTestId('rule-wizard-save'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const payload = onSave.mock.calls[0][0];
		expect(payload.actions).toEqual([{ type: 'requestDelay', enabled: true, timeMs: 1000 }]);
	});

	describe('RuleEditor — skipTypeStep', () => {
		test('com skipTypeStep oculta passo Tipo da barra e começa em Matcher', () => {
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Mock teste',
						enabled: true,
						stage: 'response',
						matchers: [
							{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
							{ type: 'method', enabled: true, method: 'GET' },
						],
						actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
					}}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			const stepBar = screen.getByTestId('rule-wizard-steps');
			expect(within(stepBar).queryByTestId('rule-wizard-step-type')).toBeNull();
			expect(within(stepBar).getByTestId('rule-wizard-step-matcher')).toBeInTheDocument();
			expect(within(stepBar).getByTestId('rule-wizard-step-action')).toBeInTheDocument();
			expect(within(stepBar).getByTestId('rule-wizard-step-review')).toBeInTheDocument();
			expect(screen.getByTestId('rule-wizard-step-matcher')).toHaveAttribute(
				'aria-current',
				'step',
			);
		});

		test('com skipTypeStep wizard avança Matcher → Ação → Revisar', () => {
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Mock teste',
						enabled: true,
						stage: 'response',
						matchers: [
							{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
							{ type: 'method', enabled: true, method: 'GET' },
						],
						actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
					}}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			expect(screen.getByTestId('rule-wizard-step-review')).toHaveAttribute('aria-current', 'step');
		});

		test('initialDraft pré-preenche name/matchers/action e pula welcome', () => {
			const onSave = vi.fn().mockResolvedValue(true);
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Custom name',
						enabled: true,
						stage: 'response',
						matchers: [
							{ type: 'url', enabled: true, pattern: 'api.example.com/x', isRegex: false },
							{ type: 'method', enabled: true, method: 'POST' },
						],
						actions: [{ type: 'breakpoint', enabled: true, description: '' }],
					}}
					onOpenChange={vi.fn()}
					onSave={onSave}
				/>,
			);
			expect(screen.queryByTestId('preset-blank')).toBeNull();
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			expect(screen.getByText(/Custom name/)).toBeInTheDocument();
		});

		test('headerMatcherSource renderiza HeaderMatcherSelector no passo Matcher', () => {
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Test',
						enabled: true,
						stage: 'response',
						matchers: [
							{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
							{ type: 'method', enabled: true, method: 'GET' },
						],
						actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
					}}
					headerMatcherSource={{
						requestHeaders: { 'x-custom': 'foo' },
						responseHeaders: { 'content-type': 'application/json' },
					}}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			expect(screen.getByText('x-custom')).toBeInTheDocument();
			expect(screen.getByText('content-type')).toBeInTheDocument();
		});

		test('campo Nome aparece editável no passo Matcher quando skipTypeStep=true', () => {
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Mock para api.example.com',
						enabled: true,
						stage: 'response',
						matchers: [
							{ type: 'url', enabled: true, pattern: 'api.example.com', isRegex: false },
							{ type: 'method', enabled: true, method: 'GET' },
						],
						actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
					}}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			const nameInput = screen.getByLabelText(/Nome da Regra/);
			expect(nameInput).toHaveValue('Mock para api.example.com');
			fireEvent.change(nameInput, { target: { value: 'Nome editado' } });
			expect(nameInput).toHaveValue('Nome editado');
		});

		test('campo Nome NÃO aparece no passo Matcher quando skipTypeStep=false (default)', () => {
			const baseRule: Rule = {
				id: 'r1',
				name: 'Existing',
				enabled: true,
				stage: 'response',
				matchers: [
					{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method' as const, enabled: true, method: 'GET' },
				],
				actions: [{ type: 'mock' as const, enabled: true, status: 200, headers: {} }],
				createdAt: 0,
				updatedAt: 0,
			};
			render(
				<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
			);
			fireEvent.click(screen.getByTestId('rule-wizard-step-matcher'));
			// O label "Nome da Regra" é exclusivo do passo Tipo no fluxo padrão.
			const headings = screen.queryAllByText(/Nome da Regra/);
			// No passo Matcher, ele NÃO deve estar visível (welcome+type bar tem o input só no type step)
			// Aqui apenas verifica que estamos efetivamente no passo Matcher e o input do passo Tipo
			// não está renderizado simultaneamente.
			const matcherStep = screen.getByTestId('rule-wizard-step-matcher');
			expect(matcherStep).toHaveAttribute('aria-current', 'step');
			expect(headings.length).toBe(0);
		});

		test('headerMatcherSource ausente não renderiza HeaderMatcherSelector', () => {
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Test',
						enabled: true,
						stage: 'response',
						matchers: [
							{ type: 'url', enabled: true, pattern: '/api', isRegex: false },
							{ type: 'method', enabled: true, method: 'GET' },
						],
						actions: [{ type: 'mock', enabled: true, status: 200, headers: {} }],
					}}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			expect(screen.queryByText(/Header matchers \(opcional\)/)).toBeNull();
		});

		test('mudança de identidade do initialDraft enquanto o modal está aberto NÃO reseta o step do wizard', () => {
			const baseDraft = {
				name: 'Mock teste',
				enabled: true,
				stage: 'response' as const,
				matchers: [
					{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method' as const, enabled: true, method: 'GET' },
				],
				actions: [{ type: 'mock' as const, enabled: true, status: 200, headers: {} }],
			};
			const { rerender } = render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={baseDraft}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			// Avança para Ação
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');

			// Re-renderiza com initialDraft de identidade nova mas conteúdo equivalente
			// (simulando o requestUpdated do background que altera o objeto request).
			rerender(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{ ...baseDraft, matchers: [...baseDraft.matchers] }}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);

			// O step deve continuar em 'action', não voltar para 'matcher'.
			expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');
		});

		test('mudança de identidade do rule (mode=edit) NÃO reseta o step do wizard', () => {
			const baseRule: Rule = {
				id: 'r1',
				name: 'Existing',
				enabled: true,
				stage: 'response',
				matchers: [
					{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method' as const, enabled: true, method: 'GET' },
				],
				actions: [{ type: 'mock' as const, enabled: true, status: 200, headers: {} }],
				createdAt: 0,
				updatedAt: 0,
			};
			const { rerender } = render(
				<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
			);
			// Em mode=edit, todos os steps são clicáveis. Vai para Ação.
			fireEvent.click(screen.getByTestId('rule-wizard-step-action'));
			expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');

			// Re-renderiza com rule de identidade nova.
			rerender(
				<RuleEditor
					open
					mode="edit"
					rule={{ ...baseRule, matchers: [...baseRule.matchers] }}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);

			expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');
		});

		test('reabrir o modal (open false→true) reinicializa o wizard mesmo com mesmo initialDraft', () => {
			const draft = {
				name: 'Mock teste',
				enabled: true,
				stage: 'response' as const,
				matchers: [
					{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false },
					{ type: 'method' as const, enabled: true, method: 'GET' },
				],
				actions: [{ type: 'mock' as const, enabled: true, status: 200, headers: {} }],
			};
			const { rerender } = render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={draft}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			// Avança e fecha.
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			expect(screen.getByTestId('rule-wizard-step-action')).toHaveAttribute('aria-current', 'step');
			rerender(
				<RuleEditor
					open={false}
					mode="create"
					skipTypeStep
					initialDraft={draft}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			rerender(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={draft}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			// Voltou ao primeiro step (matcher) na nova sessão.
			expect(screen.getByTestId('rule-wizard-step-matcher')).toHaveAttribute(
				'aria-current',
				'step',
			);
		});

		test.each([
			['mock' as const, 'Mock'],
			['breakpoint' as const, 'Breakpoint'],
			['transform' as const, 'Transform'],
			['requestDelay' as const, 'Latência'],
		])('passo Ação renderiza chain row para o tipo selecionado %s', (type, label) => {
			const action =
				type === 'mock'
					? { type: 'mock' as const, enabled: true, status: 200, headers: {} }
					: type === 'breakpoint'
						? { type: 'breakpoint' as const, enabled: true, description: '' }
						: type === 'transform'
							? {
									type: 'transform' as const,
									enabled: true,
									mode: 'declarative' as const,
									operations: [],
								}
							: { type: 'requestDelay' as const, enabled: true, timeMs: 1000 };
			const stage: 'request' | 'response' = type === 'requestDelay' ? 'request' : 'response';
			render(
				<RuleEditor
					open
					mode="create"
					skipTypeStep
					initialDraft={{
						name: 'Test',
						enabled: true,
						stage,
						matchers: [
							{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false },
							{ type: 'method' as const, enabled: true, method: 'GET' },
						],
						actions: [action],
					}}
					onOpenChange={vi.fn()}
					onSave={vi.fn()}
				/>,
			);
			// Avança Matcher → Ação
			fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
			const chain = screen.getByTestId('action-chain-editor');
			expect(chain).toHaveAttribute('data-stage', stage);
			const row = within(chain).getByTestId('action-chain-row-0');
			expect(row).toHaveAttribute('data-action-type', type);
			expect(within(row).getByText(new RegExp(`1\\. ${label}`))).toBeInTheDocument();
		});

		test('chain editor aparece também no fluxo padrão (mode=edit, sem skipTypeStep)', () => {
			const baseRule: Rule = {
				id: 'r1',
				name: 'Existing',
				enabled: true,
				stage: 'response',
				matchers: [{ type: 'url' as const, enabled: true, pattern: '/api', isRegex: false }],
				actions: [{ type: 'breakpoint' as const, enabled: true, description: '' }],
				createdAt: 0,
				updatedAt: 0,
			};
			render(
				<RuleEditor open mode="edit" rule={baseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
			);
			fireEvent.click(screen.getByTestId('rule-wizard-step-action'));
			const chain = screen.getByTestId('action-chain-editor');
			expect(chain).toBeInTheDocument();
			const row = within(chain).getByTestId('action-chain-row-0');
			expect(row).toHaveAttribute('data-action-type', 'breakpoint');
			expect(within(row).getByText(/1\. Breakpoint/)).toBeInTheDocument();
		});
	});
});
