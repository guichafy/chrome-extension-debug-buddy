import { describe, expect, it } from 'vitest';
import type { TransformAction } from '@/types/rules';
import { applyTransformToBody } from '../transformExecutor';

const declarativeAction = (overrides: Partial<TransformAction> = {}): TransformAction => ({
	type: 'transform',
	enabled: true,
	mode: 'declarative',
	operations: [],
	...overrides,
});

describe('applyTransformToBody — declarativo', () => {
	it('aplica replace em path simples', () => {
		const action = declarativeAction({
			operations: [{ id: 'op1', type: 'replace', path: '$.name', value: '"Bob"' }],
		});
		const body = JSON.stringify({ name: 'Alice', age: 30 });
		const r = applyTransformToBody(action, body);
		expect(r.ok).toBe(true);
		if (r.ok) expect(JSON.parse(r.body)).toEqual({ name: 'Bob', age: 30 });
	});

	it('aplica replace em índice de array (caso do usuário com $[0].ThumbnailImage)', () => {
		const action = declarativeAction({
			operations: [
				{
					id: 'op1',
					type: 'replace',
					path: "$[0]['ThumbnailImage']",
					value: '"https://www.pokemon.com/static-assets/100.png"',
				},
			],
		});
		const body = JSON.stringify([
			{ ThumbnailImage: 'old.png', Name: 'Pikachu' },
			{ ThumbnailImage: 'other.png', Name: 'Bulbasaur' },
		]);
		const r = applyTransformToBody(action, body);
		expect(r.ok).toBe(true);
		if (r.ok) {
			const parsed = JSON.parse(r.body);
			expect(parsed[0].ThumbnailImage).toBe('https://www.pokemon.com/static-assets/100.png');
			expect(parsed[1].ThumbnailImage).toBe('other.png');
		}
	});

	it('aplica add em propriedade nova', () => {
		const action = declarativeAction({
			operations: [{ id: 'op1', type: 'add', path: '$.extra', value: '42' }],
		});
		const r = applyTransformToBody(action, JSON.stringify({ a: 1 }));
		expect(r.ok).toBe(true);
		if (r.ok) expect(JSON.parse(r.body)).toEqual({ a: 1, extra: 42 });
	});

	it('aplica remove', () => {
		const action = declarativeAction({
			operations: [{ id: 'op1', type: 'remove', path: '$.b' }],
		});
		const r = applyTransformToBody(action, JSON.stringify({ a: 1, b: 2 }));
		expect(r.ok).toBe(true);
		if (r.ok) expect(JSON.parse(r.body)).toEqual({ a: 1 });
	});

	it('passa-direto quando a lista de operations está vazia', () => {
		const action = declarativeAction({ operations: [] });
		const body = JSON.stringify({ a: 1 });
		const r = applyTransformToBody(action, body);
		expect(r.ok).toBe(true);
		if (r.ok) expect(JSON.parse(r.body)).toEqual({ a: 1 });
	});

	it('falha sem fallback quando o body não é JSON válido', () => {
		const action = declarativeAction({
			operations: [{ id: 'op1', type: 'replace', path: '$.x', value: '1' }],
		});
		const r = applyTransformToBody(action, '<html>not json</html>');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('json');
	});

	it('falha sem fallback quando uma operação JSONPath é inválida', () => {
		const action = declarativeAction({
			operations: [{ id: 'op1', type: 'replace', path: '$.naoexiste', value: '"x"' }],
		});
		const r = applyTransformToBody(action, JSON.stringify({ a: 1 }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('naoexiste');
	});

	it('falha sem fallback quando body está vazio (transform precisa de JSON)', () => {
		const action = declarativeAction({
			operations: [{ id: 'op1', type: 'replace', path: '$.x', value: '1' }],
		});
		const r = applyTransformToBody(action, '');
		expect(r.ok).toBe(false);
	});
});

describe('applyTransformToBody — modo advanced (não tratado aqui)', () => {
	it('retorna erro indicando que advanced precisa de runner externo', () => {
		const action: TransformAction = {
			type: 'transform',
			enabled: true,
			mode: 'advanced',
			advancedScript: 'return response;',
		};
		const r = applyTransformToBody(action, JSON.stringify({ a: 1 }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.toLowerCase()).toContain('advanced');
	});
});
