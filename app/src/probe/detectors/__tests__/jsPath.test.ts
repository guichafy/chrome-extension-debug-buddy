import { describe, expect, test } from 'vitest';
import { JS_PATH_MAX_DEPTH, readDottedPath, serializeJsValue } from '../wappalyzer/jsPath';

describe('readDottedPath', () => {
	test('reads top-level property', () => {
		expect(readDottedPath({ foo: 'bar' }, 'foo')).toBe('bar');
	});

	test('reads nested property', () => {
		expect(readDottedPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
	});

	test('returns undefined when intermediate is missing', () => {
		expect(readDottedPath({ a: {} }, 'a.b.c')).toBeUndefined();
	});

	test('returns undefined when intermediate is null', () => {
		expect(readDottedPath({ a: null }, 'a.b')).toBeUndefined();
	});

	test('returns undefined when intermediate is primitive', () => {
		expect(readDottedPath({ a: 'string' }, 'a.b')).toBeUndefined();
	});

	test('returns undefined when path exceeds max depth', () => {
		const path = Array.from({ length: JS_PATH_MAX_DEPTH + 1 }, (_, i) => `p${i}`).join('.');
		expect(readDottedPath({}, path)).toBeUndefined();
	});

	test('handles getter that throws — returns undefined', () => {
		const root = {};
		Object.defineProperty(root, 'thrower', {
			get() {
				throw new Error('nope');
			},
		});
		expect(readDottedPath(root, 'thrower.value')).toBeUndefined();
	});

	test('reads function as value (window globals can be functions)', () => {
		const fn = () => 42;
		expect(readDottedPath({ jQuery: fn }, 'jQuery')).toBe(fn);
	});

	test('reads property on a function', () => {
		const fn = () => 0;
		(fn as unknown as { fn: { jquery: string } }).fn = { jquery: '3.6.0' };
		expect(readDottedPath({ $: fn }, '$.fn.jquery')).toBe('3.6.0');
	});
});

describe('serializeJsValue', () => {
	test('serializes string as-is', () => {
		expect(serializeJsValue('hello')).toBe('hello');
	});

	test('serializes number/boolean/null/undefined', () => {
		expect(serializeJsValue(42)).toBe('42');
		expect(serializeJsValue(true)).toBe('true');
		expect(serializeJsValue(null)).toBe('null');
		expect(serializeJsValue(undefined)).toBe('');
	});

	test('functions become <function> sentinel', () => {
		expect(serializeJsValue(() => 0)).toBe('<function>');
	});

	test('objects are JSON-stringified and capped at 200 chars', () => {
		const big = { items: Array.from({ length: 200 }, (_, i) => i) };
		const out = serializeJsValue(big);
		expect(out.length).toBeLessThanOrEqual(200);
		expect(out.startsWith('{"items":[')).toBe(true);
	});

	test('circular references return <object> sentinel without throwing', () => {
		const a: Record<string, unknown> = {};
		a.self = a;
		expect(serializeJsValue(a)).toBe('<object>');
	});
});
