import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RuleSaveToast } from '../RuleSaveToast';

describe('RuleSaveToast', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('nao renderiza quando open=false', () => {
		render(<RuleSaveToast open={false} message="Salvo" onUndo={vi.fn()} onDismiss={vi.fn()} />);
		expect(screen.queryByTestId('rule-save-toast')).not.toBeInTheDocument();
	});

	test('renderiza com mensagem e botoes Desfazer/Fechar', () => {
		render(<RuleSaveToast open message="Regra adicionada" onUndo={vi.fn()} onDismiss={vi.fn()} />);
		expect(screen.getByTestId('rule-save-toast')).toHaveTextContent('Regra adicionada');
		expect(screen.getByTestId('rule-save-toast-undo')).toBeInTheDocument();
		expect(screen.getByTestId('rule-save-toast-close')).toBeInTheDocument();
	});

	test('clicar Desfazer dispara onUndo', () => {
		const onUndo = vi.fn();
		render(<RuleSaveToast open message="x" onUndo={onUndo} onDismiss={vi.fn()} />);
		fireEvent.click(screen.getByTestId('rule-save-toast-undo'));
		expect(onUndo).toHaveBeenCalledTimes(1);
	});

	test('clicar Fechar dispara onDismiss', () => {
		const onDismiss = vi.fn();
		render(<RuleSaveToast open message="x" onUndo={vi.fn()} onDismiss={onDismiss} />);
		fireEvent.click(screen.getByTestId('rule-save-toast-close'));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	test('auto-dispensa apos durationMs', () => {
		const onDismiss = vi.fn();
		render(
			<RuleSaveToast open message="x" onUndo={vi.fn()} onDismiss={onDismiss} durationMs={5000} />,
		);
		expect(onDismiss).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(5100);
		});
		expect(onDismiss).toHaveBeenCalled();
	});
});
