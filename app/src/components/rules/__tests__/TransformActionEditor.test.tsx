import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TransformActionEditor } from '../TransformActionEditor';
import type { TransformAction, TransformOperation } from '@/types/rules';
import type { AdvancedScriptResult } from '@/lib/advancedScriptRunner';

const baseAction = (operations: TransformOperation[] = []): TransformAction => ({
	type: 'transform',
	enabled: true,
	mode: 'declarative',
	operations,
});

const advancedAction = (overrides: Partial<TransformAction> = {}): TransformAction => ({
	type: 'transform',
	enabled: true,
	mode: 'advanced',
	advancedScript: 'return { ok: true };',
	...overrides,
});

const stubRunner = (impl?: (script: string, response: unknown) => AdvancedScriptResult) =>
	vi.fn<(script: string, response: unknown) => Promise<AdvancedScriptResult>>(
		async (script: string, response: unknown): Promise<AdvancedScriptResult> => {
			if (impl) return impl(script, response);
			return { ok: true, output: response } as AdvancedScriptResult;
		},
	);

beforeEach(() => {
	// Garante que cada teste reinicia em estado limpo de timers/fakes.
	vi.useRealTimers();
});

describe('TransformActionEditor — empty state', () => {
	it('renderiza placeholder quando não há operações', () => {
		render(<TransformActionEditor action={baseAction()} onChange={vi.fn()} />);
		expect(screen.getByTestId('transform-op-empty')).toBeInTheDocument();
	});

	it('clicar em "Adicionar operação" emite onChange com nova operação', () => {
		const onChange = vi.fn();
		render(<TransformActionEditor action={baseAction()} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('transform-op-add'));
		expect(onChange).toHaveBeenCalledTimes(1);
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.operations).toHaveLength(1);
		expect(next.mode).toBe('declarative');
		expect(next.operations?.[0].type).toBe('replace');
	});
});

describe('TransformActionEditor — edição de operações', () => {
	it('atualiza path da operação', () => {
		const onChange = vi.fn();
		const op: TransformOperation = { id: 'a', type: 'replace', path: '$.foo', value: '"x"' };
		render(<TransformActionEditor action={baseAction([op])} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('transform-op-path-0'), { target: { value: '$.bar' } });
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.operations?.[0].path).toBe('$.bar');
	});

	it('atualiza valor da operação', () => {
		const onChange = vi.fn();
		const op: TransformOperation = { id: 'a', type: 'replace', path: '$.foo', value: '"x"' };
		render(<TransformActionEditor action={baseAction([op])} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('transform-op-value-0'), {
			target: { value: '"new"' },
		});
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.operations?.[0].value).toBe('"new"');
	});

	it('exibe erro inline para JSONPath inválido', () => {
		const op: TransformOperation = { id: 'a', type: 'replace', path: 'foo', value: '"x"' };
		render(<TransformActionEditor action={baseAction([op])} onChange={vi.fn()} />);
		const err = screen.getByTestId('transform-op-path-error-0');
		expect(err).toBeInTheDocument();
		expect(err.textContent?.toLowerCase()).toContain('iniciar com');
	});

	it('exibe erro inline para valor JSON inválido', () => {
		const op: TransformOperation = { id: 'a', type: 'replace', path: '$.foo', value: 'hello' };
		render(<TransformActionEditor action={baseAction([op])} onChange={vi.fn()} />);
		expect(screen.getByTestId('transform-op-value-error-0')).toBeInTheDocument();
	});

	it('operação remove não exige campo de valor', () => {
		const op: TransformOperation = { id: 'a', type: 'remove', path: '$.foo' };
		render(<TransformActionEditor action={baseAction([op])} onChange={vi.fn()} />);
		expect(screen.queryByTestId('transform-op-value-0')).not.toBeInTheDocument();
	});

	it('botão remover apaga a operação', () => {
		const onChange = vi.fn();
		const op: TransformOperation = { id: 'a', type: 'replace', path: '$.foo', value: '"x"' };
		render(<TransformActionEditor action={baseAction([op])} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('transform-op-remove-0'));
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.operations).toHaveLength(0);
	});
});

describe('TransformActionEditor — reordenar', () => {
	const ops = (): TransformOperation[] => [
		{ id: 'a', type: 'replace', path: '$.a', value: '1' },
		{ id: 'b', type: 'replace', path: '$.b', value: '2' },
		{ id: 'c', type: 'replace', path: '$.c', value: '3' },
	];

	it('move operação para baixo', () => {
		const onChange = vi.fn();
		render(<TransformActionEditor action={baseAction(ops())} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('transform-op-down-0'));
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.operations?.map((o) => o.id)).toEqual(['b', 'a', 'c']);
	});

	it('move operação para cima', () => {
		const onChange = vi.fn();
		render(<TransformActionEditor action={baseAction(ops())} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('transform-op-up-2'));
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.operations?.map((o) => o.id)).toEqual(['a', 'c', 'b']);
	});

	it('botão "para cima" desabilitado na primeira', () => {
		render(<TransformActionEditor action={baseAction(ops())} onChange={vi.fn()} />);
		expect(screen.getByTestId('transform-op-up-0')).toBeDisabled();
	});

	it('botão "para baixo" desabilitado na última', () => {
		render(<TransformActionEditor action={baseAction(ops())} onChange={vi.fn()} />);
		expect(screen.getByTestId('transform-op-down-2')).toBeDisabled();
	});
});

describe('TransformActionEditor — preview ao vivo', () => {
	it('mostra saída transformada para JSON de exemplo válido', () => {
		const op: TransformOperation = {
			id: 'a',
			type: 'replace',
			path: '$.name',
			value: '"Bob"',
		};
		render(<TransformActionEditor action={baseAction([op])} onChange={vi.fn()} />);
		// O sample default contém { id, name: "Alice", tags }. Após replace, deve mostrar Bob.
		const out = screen.getByTestId('transform-preview-output');
		expect(out.textContent).toContain('"Bob"');
		expect(out.textContent).not.toContain('"Alice"');
	});

	it('saída acompanha alteração no sample input', () => {
		const op: TransformOperation = {
			id: 'a',
			type: 'replace',
			path: '$.x',
			value: '99',
		};
		render(<TransformActionEditor action={baseAction([op])} onChange={vi.fn()} />);
		fireEvent.change(screen.getByTestId('transform-preview-sample'), {
			target: { value: '{"x":1}' },
		});
		const out = screen.getByTestId('transform-preview-output');
		expect(out.textContent).toContain('"x": 99');
	});

	it('mostra erro quando JSON de exemplo é inválido', () => {
		render(<TransformActionEditor action={baseAction()} onChange={vi.fn()} />);
		fireEvent.change(screen.getByTestId('transform-preview-sample'), {
			target: { value: '{"a":' },
		});
		expect(screen.getByTestId('transform-preview-error')).toBeInTheDocument();
	});

	it('expoe erro de runtime na operação que falhou (sem fallback silencioso)', () => {
		const op: TransformOperation = {
			id: 'a',
			type: 'replace',
			path: '$.naoExiste',
			value: '1',
		};
		render(<TransformActionEditor action={baseAction([op])} onChange={vi.fn()} />);
		// Saída deve ser o painel de erro, não a saída JSON
		expect(screen.queryByTestId('transform-preview-output')).not.toBeInTheDocument();
		expect(screen.getByTestId('transform-preview-error')).toBeInTheDocument();
		expect(screen.getByTestId('transform-op-runtime-error-0')).toBeInTheDocument();
	});

	it('aplica múltiplas operações em ordem', () => {
		const opsList: TransformOperation[] = [
			{ id: 'a', type: 'add', path: '$.role', value: '"admin"' },
			{ id: 'b', type: 'remove', path: '$.id' },
			{ id: 'c', type: 'replace', path: '$.name', value: '"Charlie"' },
		];
		render(<TransformActionEditor action={baseAction(opsList)} onChange={vi.fn()} />);
		const out = screen.getByTestId('transform-preview-output');
		const parsed = JSON.parse(out.textContent ?? '{}');
		expect(parsed).toEqual({ name: 'Charlie', tags: ['admin', 'beta'], role: 'admin' });
	});
});

describe('TransformActionEditor — onChange grava mode declarativo', () => {
	it('preserva mode=declarative quando atualiza operações', () => {
		const onChange = vi.fn();
		const op: TransformOperation = { id: 'a', type: 'replace', path: '$.foo', value: '"x"' };
		render(<TransformActionEditor action={baseAction([op])} onChange={onChange} />);
		fireEvent.change(screen.getByTestId('transform-op-path-0'), { target: { value: '$.bar' } });
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.mode).toBe('declarative');
	});
});

describe('TransformActionEditor — toggle declarativo/avançado', () => {
	it('renderiza ambos os triggers de tabs', () => {
		render(<TransformActionEditor action={baseAction()} onChange={vi.fn()} />);
		expect(screen.getByTestId('transform-mode-declarative')).toBeInTheDocument();
		expect(screen.getByTestId('transform-mode-advanced')).toBeInTheDocument();
	});

	it('clicar em "Avançado (JS)" emite onChange com mode=advanced e popula script default', async () => {
		const onChange = vi.fn();
		render(<TransformActionEditor action={baseAction()} onChange={onChange} />);
		// Radix Tabs: usar mouseDown em vez de click para acionar o trigger.
		fireEvent.mouseDown(screen.getByTestId('transform-mode-advanced'));
		await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.mode).toBe('advanced');
		expect((next.advancedScript ?? '').length).toBeGreaterThan(0);
	});

	it('mantém advancedScript existente ao alternar para advanced', async () => {
		const onChange = vi.fn();
		const action: TransformAction = {
			type: 'transform',
			enabled: true,
			mode: 'declarative',
			advancedScript: 'return 42;',
			operations: [],
		};
		render(<TransformActionEditor action={action} onChange={onChange} />);
		fireEvent.mouseDown(screen.getByTestId('transform-mode-advanced'));
		await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.mode).toBe('advanced');
		expect(next.advancedScript).toBe('return 42;');
	});

	it('clicar em "Declarativo" volta para mode=declarative preservando operations', async () => {
		const onChange = vi.fn();
		const action = advancedAction({
			operations: [{ id: 'a', type: 'replace', path: '$.x', value: '1' }],
		});
		render(
			<TransformActionEditor action={action} onChange={onChange} scriptRunner={stubRunner()} />,
		);
		fireEvent.mouseDown(screen.getByTestId('transform-mode-declarative'));
		await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.mode).toBe('declarative');
		expect(next.operations).toHaveLength(1);
	});
});

describe('TransformActionEditor — modo avançado', () => {
	it('exibe aviso de segurança quando em modo avançado', () => {
		render(
			<TransformActionEditor
				action={advancedAction()}
				onChange={vi.fn()}
				scriptRunner={stubRunner()}
			/>,
		);
		const warning = screen.getByTestId('transform-advanced-security-warning');
		expect(warning).toBeInTheDocument();
		expect(warning.textContent).toMatch(/service worker da extensão/);
		expect(warning.textContent).toMatch(/só rode código que você confia/);
	});

	it('mostra a assinatura fixa da função', () => {
		render(
			<TransformActionEditor
				action={advancedAction()}
				onChange={vi.fn()}
				scriptRunner={stubRunner()}
			/>,
		);
		expect(screen.getByTestId('transform-advanced-signature-prefix').textContent).toContain(
			'(response)',
		);
		expect(screen.getByTestId('transform-advanced-signature-suffix')).toBeInTheDocument();
	});

	it('editar o script propaga via onChange com mode=advanced', () => {
		const onChange = vi.fn();
		render(
			<TransformActionEditor
				action={advancedAction()}
				onChange={onChange}
				scriptRunner={stubRunner()}
			/>,
		);
		fireEvent.change(screen.getByTestId('transform-advanced-script'), {
			target: { value: 'return { changed: true };' },
		});
		const next = onChange.mock.calls[0][0] as TransformAction;
		expect(next.mode).toBe('advanced');
		expect(next.advancedScript).toBe('return { changed: true };');
	});

	it('preview executa o script via runner e mostra a saída', async () => {
		const runner = stubRunner((_script, response) => {
			const r = response as Record<string, unknown>;
			return { ok: true, output: { ...r, transformed: true } };
		});
		render(
			<TransformActionEditor
				action={advancedAction({ advancedScript: 'return { ...response, transformed: true };' })}
				onChange={vi.fn()}
				scriptRunner={runner}
			/>,
		);
		const out = await screen.findByTestId('transform-advanced-preview-output');
		expect(out.textContent).toContain('"transformed": true');
		expect(runner).toHaveBeenCalled();
	});

	it('preview re-executa quando o sample input muda', async () => {
		const runner = stubRunner((_script, response) => ({ ok: true, output: response }));
		render(
			<TransformActionEditor
				action={advancedAction({ advancedScript: 'return response;' })}
				onChange={vi.fn()}
				scriptRunner={runner}
			/>,
		);
		await screen.findByTestId('transform-advanced-preview-output');
		const callsBefore = runner.mock.calls.length;
		fireEvent.change(screen.getByTestId('transform-advanced-sample'), {
			target: { value: '{"hello":"world"}' },
		});
		await waitFor(() => {
			expect(runner.mock.calls.length).toBeGreaterThan(callsBefore);
		});
		const out = await screen.findByTestId('transform-advanced-preview-output');
		expect(out.textContent).toContain('"hello": "world"');
	});

	it('expoe erro de execução do runner sem fallback silencioso', async () => {
		const runner = stubRunner(() => ({
			ok: false,
			error: 'TypeError: Cannot read properties of undefined',
		}));
		render(
			<TransformActionEditor
				action={advancedAction({ advancedScript: 'return response.foo.bar;' })}
				onChange={vi.fn()}
				scriptRunner={runner}
			/>,
		);
		const err = await screen.findByTestId('transform-advanced-preview-error');
		expect(err.textContent).toContain('TypeError');
	});

	it('mostra erro quando JSON de exemplo é inválido em modo avançado', async () => {
		const runner = stubRunner();
		render(
			<TransformActionEditor action={advancedAction()} onChange={vi.fn()} scriptRunner={runner} />,
		);
		fireEvent.change(screen.getByTestId('transform-advanced-sample'), {
			target: { value: '{invalid json' },
		});
		await screen.findByTestId('transform-advanced-preview-error');
		// Runner não deve ter sido chamado com sample inválido (após mudança).
		const callsAfterInvalid = runner.mock.calls.length;
		// Forçamos um pequeno settle.
		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});
		expect(runner.mock.calls.length).toBe(callsAfterInvalid);
	});

	it('mostra erro quando script está vazio sem chamar o runner', async () => {
		const runner = stubRunner();
		render(
			<TransformActionEditor
				action={advancedAction({ advancedScript: '' })}
				onChange={vi.fn()}
				scriptRunner={runner}
			/>,
		);
		const err = await screen.findByTestId('transform-advanced-preview-error');
		expect(err.textContent?.toLowerCase()).toContain('escreva o corpo da função');
		expect(runner).not.toHaveBeenCalled();
	});
});
