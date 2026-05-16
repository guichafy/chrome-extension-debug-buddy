import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DelayActionEditor } from '../DelayActionEditor';
import type { RequestDelayAction } from '@/types/rules';

const baseAction = (timeMs: number): RequestDelayAction => ({
	type: 'requestDelay',
	enabled: true,
	timeMs,
});

describe('DelayActionEditor — entrada numérica', () => {
	it('renderiza valor inicial em ms no input', () => {
		render(<DelayActionEditor action={baseAction(1500)} onChange={vi.fn()} />);
		expect(screen.getByTestId('delay-action-time-input')).toHaveValue(1500);
	});

	it('emite onChange com novo valor numérico válido', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(0)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), { target: { value: '750' } });
		expect(onChange).toHaveBeenCalledWith({ type: 'requestDelay', enabled: true, timeMs: 750 });
	});

	it('aceita 0 como valor válido', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), { target: { value: '0' } });
		expect(onChange).toHaveBeenCalledWith({ type: 'requestDelay', enabled: true, timeMs: 0 });
	});
});

describe('DelayActionEditor — validação rejeita valores inválidos', () => {
	it('mostra erro e não chama onChange quando o valor é negativo', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), { target: { value: '-500' } });
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('delay-action-error')).toBeInTheDocument();
	});

	it('mostra erro quando o valor não é numérico', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), {
			target: { value: 'abc' },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('delay-action-error')).toBeInTheDocument();
	});

	it('mostra erro quando o input fica vazio', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), { target: { value: '' } });
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('delay-action-error')).toBeInTheDocument();
	});

	it('mostra erro quando o valor tem decimais (não inteiro)', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), {
			target: { value: '1.5' },
		});
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('delay-action-error')).toBeInTheDocument();
	});
});

describe('DelayActionEditor — presets clicáveis', () => {
	it('renderiza presets exigidos: 500ms, 1s, 3s, 5s, 10s', () => {
		render(<DelayActionEditor action={baseAction(0)} onChange={vi.fn()} />);
		expect(screen.getByTestId('delay-action-preset-500')).toHaveTextContent('500ms');
		expect(screen.getByTestId('delay-action-preset-1000')).toHaveTextContent('1s');
		expect(screen.getByTestId('delay-action-preset-3000')).toHaveTextContent('3s');
		expect(screen.getByTestId('delay-action-preset-5000')).toHaveTextContent('5s');
		expect(screen.getByTestId('delay-action-preset-10000')).toHaveTextContent('10s');
	});

	it('clicar em preset 3s emite onChange com timeMs=3000', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('delay-action-preset-3000'));
		expect(onChange).toHaveBeenCalledWith({ type: 'requestDelay', enabled: true, timeMs: 3000 });
	});

	it('preset selecionado é destacado via aria-pressed/data-selected', () => {
		render(<DelayActionEditor action={baseAction(5000)} onChange={vi.fn()} />);
		const selectedPreset = screen.getByTestId('delay-action-preset-5000');
		expect(selectedPreset).toHaveAttribute('aria-pressed', 'true');
		expect(selectedPreset).toHaveAttribute('data-selected', 'true');
		const otherPreset = screen.getByTestId('delay-action-preset-1000');
		expect(otherPreset).toHaveAttribute('aria-pressed', 'false');
	});

	it('clicar em preset depois de erro de input limpa o erro', () => {
		const onChange = vi.fn();
		render(<DelayActionEditor action={baseAction(1000)} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), {
			target: { value: '-1' },
		});
		expect(screen.getByTestId('delay-action-error')).toBeInTheDocument();
		fireEvent.click(screen.getByTestId('delay-action-preset-500'));
		expect(screen.queryByTestId('delay-action-error')).toBeNull();
		expect(onChange).toHaveBeenLastCalledWith({ type: 'requestDelay', enabled: true, timeMs: 500 });
	});
});

describe('DelayActionEditor — texto explicativo', () => {
	it('exibe o texto explicativo exigido pelo PRD com o valor formatado', () => {
		render(<DelayActionEditor action={baseAction(2500)} onChange={vi.fn()} />);
		const info = screen.getByTestId('delay-action-info');
		expect(info).toHaveTextContent(
			/O servidor remoto será chamado normalmente; a resposta será segurada por\s+2500ms\s+antes de devolver ao cliente\./,
		);
	});

	it('atualiza o texto explicativo quando o valor é alterado via input', () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<DelayActionEditor action={baseAction(1000)} onChange={onChange} />,
		);
		fireEvent.change(screen.getByTestId('delay-action-time-input'), { target: { value: '7500' } });
		// O texto explicativo é atualizado em tempo real (lê o input local).
		expect(screen.getByTestId('delay-action-info')).toHaveTextContent(/7500ms/);

		// E após o pai propagar a mudança, o input continua refletindo o novo timeMs.
		rerender(<DelayActionEditor action={baseAction(7500)} onChange={onChange} />);
		expect(screen.getByTestId('delay-action-time-input')).toHaveValue(7500);
	});
});
