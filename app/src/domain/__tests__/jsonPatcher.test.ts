import { describe, expect, it } from 'vitest';
import {
	applyOperation,
	applyOperations,
	parseJsonPath,
	parseOperationValue,
} from '../jsonPatcher';
import type { TransformOperation } from '@/types/rules';

const op = (
	type: TransformOperation['type'],
	path: string,
	value?: string,
	id = 'op-1',
): TransformOperation => ({ id, type, path, value });

describe('parseJsonPath', () => {
	it('aceita root sozinho', () => {
		const r = parseJsonPath('$');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.segments).toEqual([]);
	});

	it('parse propriedade simples com ponto', () => {
		const r = parseJsonPath('$.user');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.segments).toEqual([{ kind: 'prop', name: 'user' }]);
	});

	it('parse propriedade aninhada', () => {
		const r = parseJsonPath('$.user.profile.name');
		expect(r.ok).toBe(true);
		if (r.ok)
			expect(r.segments).toEqual([
				{ kind: 'prop', name: 'user' },
				{ kind: 'prop', name: 'profile' },
				{ kind: 'prop', name: 'name' },
			]);
	});

	it('parse índice de array', () => {
		const r = parseJsonPath('$.users[0]');
		expect(r.ok).toBe(true);
		if (r.ok)
			expect(r.segments).toEqual([
				{ kind: 'prop', name: 'users' },
				{ kind: 'index', index: 0 },
			]);
	});

	it("parse propriedade com aspas simples ['nome']", () => {
		const r = parseJsonPath("$['user-id']");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.segments).toEqual([{ kind: 'prop', name: 'user-id' }]);
	});

	it('parse propriedade com aspas duplas ["nome"]', () => {
		const r = parseJsonPath('$["@meta"]');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.segments).toEqual([{ kind: 'prop', name: '@meta' }]);
	});

	it('rejeita caminho vazio', () => {
		const r = parseJsonPath('');
		expect(r.ok).toBe(false);
	});

	it('rejeita caminho sem $', () => {
		const r = parseJsonPath('user.name');
		expect(r.ok).toBe(false);
	});

	it('rejeita ponto sem identificador', () => {
		const r = parseJsonPath('$.');
		expect(r.ok).toBe(false);
	});

	it('rejeita colchete não fechado', () => {
		const r = parseJsonPath('$.users[0');
		expect(r.ok).toBe(false);
	});

	it('rejeita propriedade que começa com dígito', () => {
		const r = parseJsonPath('$.1user');
		expect(r.ok).toBe(false);
	});
});

describe('parseOperationValue', () => {
	it('JSON object', () => {
		const r = parseOperationValue('{"a":1}');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toEqual({ a: 1 });
	});

	it('JSON array', () => {
		const r = parseOperationValue('[1,2,3]');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toEqual([1, 2, 3]);
	});

	it('string entre aspas', () => {
		const r = parseOperationValue('"hello"');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toBe('hello');
	});

	it('número', () => {
		const r = parseOperationValue('42');
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toBe(42);
	});

	it('null/true/false', () => {
		expect(parseOperationValue('null')).toEqual({ ok: true, value: null });
		expect(parseOperationValue('true')).toEqual({ ok: true, value: true });
		expect(parseOperationValue('false')).toEqual({ ok: true, value: false });
	});

	it('rejeita JSON inválido', () => {
		const r = parseOperationValue('hello');
		expect(r.ok).toBe(false);
	});

	it('rejeita JSON parcial', () => {
		const r = parseOperationValue('{"a":');
		expect(r.ok).toBe(false);
	});

	it('aceita string vazia como string vazia', () => {
		expect(parseOperationValue('')).toEqual({ ok: true, value: '' });
	});
});

describe('applyOperation — add', () => {
	it('adiciona propriedade nova em objeto', () => {
		const r = applyOperation({ a: 1 }, op('add', '$.b', '2'));
		expect(r).toEqual({ ok: true, output: { a: 1, b: 2 } });
	});

	it('adiciona objeto aninhado', () => {
		const r = applyOperation({ a: 1 }, op('add', '$.meta', '{"v":1}'));
		expect(r).toEqual({ ok: true, output: { a: 1, meta: { v: 1 } } });
	});

	it('insere em array em índice válido', () => {
		const r = applyOperation({ list: [1, 3] }, op('add', '$.list[1]', '2'));
		expect(r).toEqual({ ok: true, output: { list: [1, 2, 3] } });
	});

	it('insere no fim do array (length permite)', () => {
		const r = applyOperation({ list: [1, 2] }, op('add', '$.list[2]', '3'));
		expect(r).toEqual({ ok: true, output: { list: [1, 2, 3] } });
	});

	it('falha se propriedade já existe', () => {
		const r = applyOperation({ a: 1 }, op('add', '$.a', '2'));
		expect(r.ok).toBe(false);
	});

	it('falha se parent é scalar', () => {
		const r = applyOperation({ a: 'x' }, op('add', '$.a.b', '1'));
		expect(r.ok).toBe(false);
	});

	it('falha em índice fora dos limites', () => {
		const r = applyOperation({ list: [1] }, op('add', '$.list[5]', '2'));
		expect(r.ok).toBe(false);
	});
});

describe('applyOperation — replace', () => {
	it('substitui propriedade existente', () => {
		const r = applyOperation({ a: 1 }, op('replace', '$.a', '99'));
		expect(r).toEqual({ ok: true, output: { a: 99 } });
	});

	it('substitui valor aninhado', () => {
		const r = applyOperation({ user: { name: 'Alice' } }, op('replace', '$.user.name', '"Bob"'));
		expect(r).toEqual({ ok: true, output: { user: { name: 'Bob' } } });
	});

	it('substitui item de array', () => {
		const r = applyOperation({ list: [1, 2, 3] }, op('replace', '$.list[1]', '99'));
		expect(r).toEqual({ ok: true, output: { list: [1, 99, 3] } });
	});

	it('substitui o root quando path é apenas $', () => {
		const r = applyOperation({ a: 1 }, op('replace', '$', '{"b":2}'));
		expect(r).toEqual({ ok: true, output: { b: 2 } });
	});

	it('falha se propriedade não existe', () => {
		const r = applyOperation({ a: 1 }, op('replace', '$.b', '2'));
		expect(r.ok).toBe(false);
	});

	it('falha se índice não existe', () => {
		const r = applyOperation({ list: [1] }, op('replace', '$.list[2]', '99'));
		expect(r.ok).toBe(false);
	});
});

describe('applyOperation — remove', () => {
	it('remove propriedade existente', () => {
		const r = applyOperation({ a: 1, b: 2 }, op('remove', '$.b'));
		expect(r).toEqual({ ok: true, output: { a: 1 } });
	});

	it('remove item de array (splice)', () => {
		const r = applyOperation({ list: [1, 2, 3] }, op('remove', '$.list[1]'));
		expect(r).toEqual({ ok: true, output: { list: [1, 3] } });
	});

	it('falha se propriedade não existe', () => {
		const r = applyOperation({ a: 1 }, op('remove', '$.b'));
		expect(r.ok).toBe(false);
	});

	it('falha em remover root', () => {
		const r = applyOperation({ a: 1 }, op('remove', '$'));
		expect(r.ok).toBe(false);
	});

	it('falha em índice inexistente', () => {
		const r = applyOperation({ list: [1] }, op('remove', '$.list[5]'));
		expect(r.ok).toBe(false);
	});
});

describe('applyOperation — caminho inválido', () => {
	it('retorna erro para caminho com sintaxe ruim', () => {
		const r = applyOperation({}, op('replace', 'foo', '1'));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('caminho');
	});
});

describe('applyOperation — input não mutado', () => {
	it('não modifica o input original', () => {
		const input = { a: { b: 1 } };
		applyOperation(input, op('replace', '$.a.b', '2'));
		expect(input).toEqual({ a: { b: 1 } });
	});
});

describe('applyOperations', () => {
	it('aplica em ordem', () => {
		const r = applyOperations({ a: 1 }, [
			op('replace', '$.a', '10', '1'),
			op('add', '$.b', '20', '2'),
		]);
		expect(r).toEqual({ ok: true, output: { a: 10, b: 20 } });
	});

	it('falha em ordem com índice da operação que falhou', () => {
		const r = applyOperations({ a: 1 }, [
			op('replace', '$.a', '10', '1'),
			op('replace', '$.x', '99', '2'),
			op('replace', '$.a', '20', '3'),
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.failedAtIndex).toBe(1);
	});

	it('lista vazia retorna input intacto', () => {
		const r = applyOperations({ a: 1 }, []);
		expect(r).toEqual({ ok: true, output: { a: 1 } });
	});
});
