import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Rule } from '@/types/rules';
import RuleEditor from '../RuleEditor';

const responseRule: Rule = {
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

const requestRule: Rule = {
	id: 'r2',
	name: 'Block /api',
	enabled: true,
	stage: 'request',
	matchers: [{ type: 'url', enabled: true, pattern: '/api/secret', isRegex: false }],
	actions: [{ type: 'block', enabled: true, errorReason: 'Failed' }],
	createdAt: 0,
	updatedAt: 0,
};

describe('RuleEditor — dropdown de stage', () => {
	test('em mode=edit o dropdown reflete o stage da regra e fica bloqueado', () => {
		render(
			<RuleEditor open mode="edit" rule={responseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
		);
		const trigger = screen.getByTestId('rule-wizard-stage-trigger');
		expect(trigger).toHaveTextContent(/Response/);
		expect(trigger).toBeDisabled();
		expect(screen.getByTestId('rule-wizard-stage-locked')).toBeInTheDocument();
	});

	test('em mode=create dropdown começa em Response (default histórico)', () => {
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={vi.fn()} />);
		fireEvent.click(screen.getByTestId('preset-blank'));
		const trigger = screen.getByTestId('rule-wizard-stage-trigger');
		expect(trigger).toHaveTextContent(/Response/);
		expect(trigger).not.toBeDisabled();
	});

	test('clicar no card requestDelay força stage=request automaticamente', async () => {
		const onSave = vi.fn().mockResolvedValue(true);
		render(<RuleEditor open mode="create" onOpenChange={vi.fn()} onSave={onSave} />);
		fireEvent.click(screen.getByTestId('preset-blank'));
		fireEvent.click(screen.getByTestId('rule-wizard-type-card-requestDelay'));

		expect(screen.getByTestId('rule-wizard-stage-trigger')).toHaveTextContent(/Request/);

		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.change(screen.getByTestId('unified-url-input'), {
			target: { value: '/api/test' },
		});
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
		fireEvent.click(screen.getByTestId('rule-wizard-save'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				stage: 'request',
				actions: [{ type: 'requestDelay', enabled: true, timeMs: 1000 }],
			}),
		);
	});

	test('em mode=edit com stage=request, chain editor expõe data-stage=request', () => {
		render(
			<RuleEditor open mode="edit" rule={requestRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-action'));
		const chain = screen.getByTestId('action-chain-editor');
		expect(chain).toHaveAttribute('data-stage', 'request');
		expect(within(chain).getByTestId('action-chain-row-0')).toHaveAttribute(
			'data-action-type',
			'block',
		);
	});
});

describe('RuleEditor — Matcher stage-aware', () => {
	test('em stage=request adicionar header matcher defaulta para headerType=request', () => {
		render(
			<RuleEditor open mode="edit" rule={requestRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-matcher'));
		fireEvent.click(screen.getByRole('button', { name: /Adicionar header/ }));
		// Não há warning porque defaulta para request
		expect(screen.queryByTestId('header-matcher-stage-warning')).not.toBeInTheDocument();
		// O option Response do tipo de header fica disabled
		fireEvent.click(screen.getByTestId('header-matcher-type-trigger'));
		expect(screen.getByTestId('header-matcher-type-response-option')).toHaveAttribute(
			'aria-disabled',
			'true',
		);
	});

	test('em stage=response adicionar header matcher defaulta para headerType=response', () => {
		render(
			<RuleEditor open mode="edit" rule={responseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-matcher'));
		fireEvent.click(screen.getByRole('button', { name: /Adicionar header/ }));
		// Option Response permanece habilitado em response stage
		fireEvent.click(screen.getByTestId('header-matcher-type-trigger'));
		expect(screen.getByTestId('header-matcher-type-response-option')).not.toHaveAttribute(
			'aria-disabled',
			'true',
		);
	});

	test('header matcher response em regra stage=request mostra warning', () => {
		const ruleWithResponseHeader: Rule = {
			...requestRule,
			matchers: [
				...requestRule.matchers,
				{
					type: 'header',
					enabled: true,
					name: 'Set-Cookie',
					value: '',
					headerType: 'response',
				},
			],
		};
		render(
			<RuleEditor
				open
				mode="edit"
				rule={ruleWithResponseHeader}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-matcher'));
		expect(screen.getByTestId('header-matcher-stage-warning')).toBeInTheDocument();
		expect(screen.getByTestId('unified-matchers-stage-warning')).toBeInTheDocument();
	});

	test('label do body matcher muda conforme stage', () => {
		const ruleWithBodyMatcher: Rule = {
			...requestRule,
			matchers: [
				...requestRule.matchers,
				{ type: 'body', enabled: true, pattern: 'foo', isRegex: false },
			],
		};
		render(
			<RuleEditor
				open
				mode="edit"
				rule={ruleWithBodyMatcher}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-matcher'));
		expect(screen.getByTestId('body-matcher-label')).toHaveTextContent(/postData/);
	});

	test('label do body matcher em response usa "Corpo da resposta"', () => {
		const ruleWithBodyMatcher: Rule = {
			...responseRule,
			matchers: [
				...responseRule.matchers,
				{ type: 'body', enabled: true, pattern: 'foo', isRegex: false },
			],
		};
		render(
			<RuleEditor
				open
				mode="edit"
				rule={ruleWithBodyMatcher}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-matcher'));
		expect(screen.getByTestId('body-matcher-label')).toHaveTextContent('Corpo da resposta');
	});
});

describe('RuleEditor — chain integration', () => {
	test('save preserva chain multi-action', async () => {
		const onSave = vi.fn().mockResolvedValue(true);
		const chainRule: Rule = {
			...requestRule,
			actions: [
				{ type: 'requestDelay', enabled: true, timeMs: 500 },
				{ type: 'block', enabled: true, errorReason: 'TimedOut' },
			],
		};
		render(<RuleEditor open mode="edit" rule={chainRule} onOpenChange={vi.fn()} onSave={onSave} />);
		fireEvent.click(screen.getByTestId('rule-wizard-step-review'));
		fireEvent.click(screen.getByTestId('rule-wizard-save'));

		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				stage: 'request',
				actions: [
					{ type: 'requestDelay', enabled: true, timeMs: 500 },
					{ type: 'block', enabled: true, errorReason: 'TimedOut' },
				],
			}),
		);
	});

	test('chain editor renderiza badge Terminal pra mock', () => {
		render(
			<RuleEditor open mode="edit" rule={responseRule} onOpenChange={vi.fn()} onSave={vi.fn()} />,
		);
		fireEvent.click(screen.getByTestId('rule-wizard-step-action'));
		expect(screen.getByTestId('action-chain-terminal-badge-0')).toBeInTheDocument();
	});
});
