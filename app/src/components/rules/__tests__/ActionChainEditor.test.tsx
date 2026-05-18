import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Action } from '@/types/rules';
import { ActionChainEditor } from '../ActionChainEditor';

const mockAction: Action = { type: 'mock', enabled: true, status: 200, headers: {} };
const delayAction: Action = { type: 'requestDelay', enabled: true, timeMs: 500 };
const blockAction: Action = { type: 'block', enabled: true, errorReason: 'Failed' };
const requestModifyAction: Action = { type: 'requestModify', enabled: true };
const responseModifyAction: Action = { type: 'responseModify', enabled: true };
const breakpointAction: Action = { type: 'breakpoint', enabled: true, description: '' };
const transformAction: Action = {
	type: 'transform',
	enabled: true,
	mode: 'declarative',
	operations: [],
};

describe('ActionChainEditor — picker stage-aware', () => {
	test('Request stage mostra apenas requestModify, requestDelay, mock, block, breakpoint', () => {
		const onChange = vi.fn();
		render(<ActionChainEditor actions={[]} stage="request" onChange={onChange} />);
		fireEvent.click(screen.getByTestId('action-chain-add-trigger'));
		const picker = screen.getByTestId('action-chain-picker');
		expect(picker).toHaveAttribute('data-stage', 'request');
		expect(
			within(picker).getByTestId('action-chain-picker-option-requestModify'),
		).toBeInTheDocument();
		expect(
			within(picker).getByTestId('action-chain-picker-option-requestDelay'),
		).toBeInTheDocument();
		expect(within(picker).getByTestId('action-chain-picker-option-mock')).toBeInTheDocument();
		expect(within(picker).getByTestId('action-chain-picker-option-block')).toBeInTheDocument();
		expect(within(picker).getByTestId('action-chain-picker-option-breakpoint')).toBeInTheDocument();
		// `transform` é exclusivo de Response stage — não pode aparecer no picker.
		expect(
			within(picker).queryByTestId('action-chain-picker-option-transform'),
		).not.toBeInTheDocument();
		// `responseModify` idem.
		expect(
			within(picker).queryByTestId('action-chain-picker-option-responseModify'),
		).not.toBeInTheDocument();
	});

	test('Response stage mostra apenas responseModify, transform, mock, breakpoint', () => {
		const onChange = vi.fn();
		render(<ActionChainEditor actions={[]} stage="response" onChange={onChange} />);
		fireEvent.click(screen.getByTestId('action-chain-add-trigger'));
		const picker = screen.getByTestId('action-chain-picker');
		expect(picker).toHaveAttribute('data-stage', 'response');
		expect(
			within(picker).getByTestId('action-chain-picker-option-responseModify'),
		).toBeInTheDocument();
		expect(within(picker).getByTestId('action-chain-picker-option-transform')).toBeInTheDocument();
		expect(within(picker).getByTestId('action-chain-picker-option-mock')).toBeInTheDocument();
		expect(within(picker).getByTestId('action-chain-picker-option-breakpoint')).toBeInTheDocument();
		// `requestDelay`/`requestModify`/`block` são request-only.
		expect(
			within(picker).queryByTestId('action-chain-picker-option-requestDelay'),
		).not.toBeInTheDocument();
		expect(
			within(picker).queryByTestId('action-chain-picker-option-requestModify'),
		).not.toBeInTheDocument();
		expect(
			within(picker).queryByTestId('action-chain-picker-option-block'),
		).not.toBeInTheDocument();
	});

	test('selecionar opção do picker chama onChange com a action seedada', () => {
		const onChange = vi.fn();
		render(<ActionChainEditor actions={[]} stage="request" onChange={onChange} />);
		fireEvent.click(screen.getByTestId('action-chain-add-trigger'));
		fireEvent.click(screen.getByTestId('action-chain-picker-option-block'));
		expect(onChange).toHaveBeenCalledWith([
			{ type: 'block', enabled: true, errorReason: 'Failed' },
		]);
	});
});

describe('ActionChainEditor — terminal blocks chain', () => {
	test('com action terminal habilitada o botão "Adicionar" fica desabilitado', () => {
		const onChange = vi.fn();
		render(<ActionChainEditor actions={[mockAction]} stage="response" onChange={onChange} />);
		const trigger = screen.getByTestId('action-chain-add-trigger');
		expect(trigger).toBeDisabled();
		expect(screen.getByTestId('action-chain-add-disabled-reason')).toHaveTextContent(
			/A chain já é terminada por "Mock"/,
		);
	});

	test('action terminal exibe badge "Terminal"', () => {
		render(<ActionChainEditor actions={[mockAction]} stage="response" onChange={vi.fn()} />);
		expect(screen.getByTestId('action-chain-terminal-badge-0')).toHaveTextContent('Terminal');
	});

	test('action depois de terminal recebe overlay "inalcançável"', () => {
		render(
			<ActionChainEditor
				actions={[blockAction, requestModifyAction]}
				stage="request"
				onChange={vi.fn()}
			/>,
		);
		const row1 = screen.getByTestId('action-chain-row-1');
		expect(row1).toHaveAttribute('data-unreachable', 'true');
		expect(screen.getByTestId('action-chain-unreachable-1')).toBeInTheDocument();
	});

	test('terminal desabilitada (enabled=false) não bloqueia adição', () => {
		const disabledMock: Action = { ...mockAction, enabled: false };
		render(<ActionChainEditor actions={[disabledMock]} stage="response" onChange={vi.fn()} />);
		const trigger = screen.getByTestId('action-chain-add-trigger');
		expect(trigger).not.toBeDisabled();
	});
});

describe('ActionChainEditor — reorder/remove/update', () => {
	test('botão "para cima" troca a ordem das actions', () => {
		const onChange = vi.fn();
		render(
			<ActionChainEditor
				actions={[delayAction, requestModifyAction]}
				stage="request"
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByTestId('action-chain-up-1'));
		expect(onChange).toHaveBeenCalledWith([requestModifyAction, delayAction]);
	});

	test('botão "para baixo" troca a ordem das actions', () => {
		const onChange = vi.fn();
		render(
			<ActionChainEditor
				actions={[delayAction, requestModifyAction]}
				stage="request"
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByTestId('action-chain-down-0'));
		expect(onChange).toHaveBeenCalledWith([requestModifyAction, delayAction]);
	});

	test('remove descarta a action no índice', () => {
		const onChange = vi.fn();
		render(
			<ActionChainEditor
				actions={[delayAction, mockAction]}
				stage="response"
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByTestId('action-chain-remove-1'));
		expect(onChange).toHaveBeenCalledWith([delayAction]);
	});

	test('toggle enabled inverte o flag da action selecionada', () => {
		const onChange = vi.fn();
		render(<ActionChainEditor actions={[mockAction]} stage="response" onChange={onChange} />);
		fireEvent.click(screen.getByTestId('action-chain-toggle-0'));
		expect(onChange).toHaveBeenCalledWith([{ ...mockAction, enabled: false }]);
	});

	test('mover a primeira action para cima é noop (botão desabilitado)', () => {
		render(
			<ActionChainEditor actions={[delayAction, mockAction]} stage="response" onChange={vi.fn()} />,
		);
		expect(screen.getByTestId('action-chain-up-0')).toBeDisabled();
	});
});

describe('ActionChainEditor — action inválida pro stage', () => {
	test('renderiza badge "inválida" quando action não é compatível com stage', () => {
		render(<ActionChainEditor actions={[transformAction]} stage="request" onChange={vi.fn()} />);
		const row = screen.getByTestId('action-chain-row-0');
		expect(row).toHaveAttribute('data-action-type', 'transform');
		expect(screen.getByTestId('action-chain-invalid-0')).toHaveTextContent(
			/não é válida no stage atual/,
		);
	});

	test('responseModify exibe erro de stage em request', () => {
		render(
			<ActionChainEditor actions={[responseModifyAction]} stage="request" onChange={vi.fn()} />,
		);
		expect(screen.getByTestId('action-chain-invalid-0')).toBeInTheDocument();
	});
});

describe('ActionChainEditor — empty state', () => {
	test('com chain vazia renderiza placeholder', () => {
		render(<ActionChainEditor actions={[]} stage="response" onChange={vi.fn()} />);
		expect(screen.getByTestId('action-chain-empty')).toBeInTheDocument();
	});

	test('com breakpoint terminal a chain bloqueia adição (breakpoint é terminal)', () => {
		render(<ActionChainEditor actions={[breakpointAction]} stage="response" onChange={vi.fn()} />);
		expect(screen.getByTestId('action-chain-add-trigger')).toBeDisabled();
		expect(screen.getByTestId('action-chain-terminal-badge-0')).toBeInTheDocument();
	});
});

describe('ActionChainEditor — response stage single-action cap', () => {
	test('com 1 modifier não-terminal em response, "Adicionar" fica desabilitado', () => {
		render(
			<ActionChainEditor actions={[responseModifyAction]} stage="response" onChange={vi.fn()} />,
		);
		expect(screen.getByTestId('action-chain-add-trigger')).toBeDisabled();
		expect(screen.getByTestId('action-chain-add-disabled-reason')).toHaveTextContent(
			/Chain com múltiplas actions em stage=response ainda não é suportada/,
		);
	});

	test('em request stage o cap não se aplica', () => {
		render(
			<ActionChainEditor actions={[requestModifyAction]} stage="request" onChange={vi.fn()} />,
		);
		expect(screen.getByTestId('action-chain-add-trigger')).not.toBeDisabled();
	});

	test('chain vazia em response permite adicionar a 1ª action', () => {
		render(<ActionChainEditor actions={[]} stage="response" onChange={vi.fn()} />);
		expect(screen.getByTestId('action-chain-add-trigger')).not.toBeDisabled();
	});
});
