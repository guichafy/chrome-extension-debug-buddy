import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { BlockAction } from '@/types/rules';
import { BlockActionEditor } from '../BlockActionEditor';

const baseAction = (overrides: Partial<BlockAction> = {}): BlockAction => ({
	type: 'block',
	enabled: true,
	errorReason: 'Failed',
	...overrides,
});

describe('BlockActionEditor', () => {
	test('renderiza o motivo atual no trigger do Select', () => {
		render(
			<BlockActionEditor action={baseAction({ errorReason: 'TimedOut' })} onChange={vi.fn()} />,
		);
		expect(screen.getByTestId('block-action-reason-trigger')).toHaveTextContent('TimedOut');
	});

	test('exibe descrição contextual abaixo do select pro motivo atual', () => {
		render(
			<BlockActionEditor
				action={baseAction({ errorReason: 'NameNotResolved' })}
				onChange={vi.fn()}
			/>,
		);
		expect(screen.getByTestId('block-action-reason-help')).toHaveTextContent(/DNS falhou/);
	});

	test('renderiza banner explicativo de falha sem chamada à rede', () => {
		render(<BlockActionEditor action={baseAction()} onChange={vi.fn()} />);
		expect(screen.getByTestId('block-action-info')).toHaveTextContent(
			/Falha imediata, sem chamada à rede/,
		);
	});

	test('selecionar outro motivo chama onChange com o novo errorReason', () => {
		const onChange = vi.fn();
		render(<BlockActionEditor action={baseAction()} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('block-action-reason-trigger'));
		// Cada SelectItem tem um data-testid com o valor
		fireEvent.click(screen.getByTestId('block-action-reason-option-TimedOut'));
		expect(onChange).toHaveBeenCalledWith({
			type: 'block',
			enabled: true,
			errorReason: 'TimedOut',
		});
	});

	test('inclui todas as 9 opções curadas em BlockErrorReason', () => {
		render(<BlockActionEditor action={baseAction()} onChange={vi.fn()} />);
		fireEvent.click(screen.getByTestId('block-action-reason-trigger'));
		const expected = [
			'Failed',
			'Aborted',
			'TimedOut',
			'AccessDenied',
			'ConnectionFailed',
			'ConnectionRefused',
			'NameNotResolved',
			'BlockedByClient',
			'InternetDisconnected',
		];
		for (const reason of expected) {
			expect(screen.getByTestId(`block-action-reason-option-${reason}`)).toBeInTheDocument();
		}
	});
});
