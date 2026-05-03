import { afterEach, describe, expect, test } from 'vitest';
import { detectLibraries } from '../libraries';

describe('detectLibraries', () => {
	const w = window as unknown as Record<string, unknown>;

	afterEach(() => {
		w.jQuery = undefined;
		w.$ = undefined;
	});

	test('detecta jQuery via window.jQuery com versão', () => {
		w.jQuery = Object.assign(() => undefined, { fn: { jquery: '3.7.0' } });
		expect(detectLibraries()).toEqual([{ name: 'jquery', version: '3.7.0', confidence: 'high' }]);
	});

	test('detecta jQuery via window.$ com .fn.jquery', () => {
		w.$ = Object.assign(() => undefined, { fn: { jquery: '2.2.4' } });
		expect(detectLibraries()).toEqual([{ name: 'jquery', version: '2.2.4', confidence: 'high' }]);
	});

	test('prefere window.jQuery sobre window.$ quando ambos definidos', () => {
		w.jQuery = Object.assign(() => undefined, { fn: { jquery: '3.7.0' } });
		w.$ = Object.assign(() => undefined, { fn: { jquery: '2.2.4' } });
		const result = detectLibraries();
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: 'jquery', version: '3.7.0' });
	});

	test('retorna [] sem jQuery', () => {
		expect(detectLibraries()).toEqual([]);
	});

	test('descarta $ que não tem .fn.jquery (Prototype, Zepto, etc.)', () => {
		w.$ = Object.assign(() => undefined, { fn: { custom: 'something' } });
		expect(detectLibraries()).toEqual([]);
	});

	test('descarta $ não-função', () => {
		w.$ = { fn: { jquery: '3.0.0' } };
		expect(detectLibraries()).toEqual([]);
	});
});
