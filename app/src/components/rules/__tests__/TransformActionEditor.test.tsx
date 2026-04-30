import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransformActionEditor } from '../TransformActionEditor';
import type { TransformAction, TransformOperation } from '@/types/rules';

const baseAction = (operations: TransformOperation[] = []): TransformAction => ({
	type: 'transform',
	enabled: true,
	mode: 'declarative',
	operations,
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
