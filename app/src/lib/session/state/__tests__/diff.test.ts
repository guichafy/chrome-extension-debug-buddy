import { describe, expect, it } from 'vitest';
import {
	applyDiff,
	compressDiff,
	compressSnapshot,
	computeDiff,
	decompressDiff,
	decompressSnapshot,
} from '../diff';

describe('computeDiff / applyDiff', () => {
	it('round-trip: applyDiff(prev, computeDiff(prev,next)) === next', () => {
		const prev = { user: { name: 'Ana', age: 30 }, items: [1, 2, 3] };
		const next = { user: { name: 'Ana', age: 31 }, items: [1, 2, 3, 4], extra: true };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('CREATE em path aninhado novo', () => {
		const prev = { a: {} };
		const next = { a: { b: 1 } };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('REMOVE em chave de objeto', () => {
		const prev = { a: 1, b: 2 };
		const next = { a: 1 };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('REMOVE em índice de array', () => {
		const prev = { items: [1, 2, 3] };
		const next = { items: [1, 3] };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('não muta o input', () => {
		const prev = { a: 1 };
		const next = { a: 2 };
		const ops = computeDiff(prev, next);
		const out = applyDiff(prev, ops);
		expect(prev).toEqual({ a: 1 });
		expect(out).toEqual({ a: 2 });
	});

	it('rejeita primitives no root', () => {
		expect(() => computeDiff(1, 2)).toThrow();
	});
});

describe('compress/decompress', () => {
	it('round-trip diff comprimido', () => {
		const ops = computeDiff({ a: 1 }, { a: 2 });
		const compressed = compressDiff(ops);
		expect(decompressDiff(compressed)).toEqual(ops);
	});

	it('round-trip snapshot comprimido', () => {
		const snap = { user: { name: 'Bruno' }, list: [1, 2, 3] };
		const compressed = compressSnapshot(snap);
		expect(decompressSnapshot(compressed)).toEqual(snap);
	});

	it('decompressDiff lança em string inválida', () => {
		expect(() => decompressDiff('xxx-not-base64')).toThrow();
	});
});
