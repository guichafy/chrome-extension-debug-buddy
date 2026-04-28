import { describe, expect, test, vi } from 'vitest';
import { resolveMockLatencyMs } from '../mockLatency';

describe('latencia de mock', () => {
	test('sem latencia configurada retorna zero', () => {
		expect(resolveMockLatencyMs(undefined)).toBe(0);
	});

	test('latencia fixa exige valor inteiro nao negativo', () => {
		expect(resolveMockLatencyMs({ mode: 'fixed', delayMs: 1250 })).toBe(1250);
		expect(() => resolveMockLatencyMs({ mode: 'fixed', delayMs: -1 })).toThrow(
			'delayMs deve ser um inteiro maior ou igual a zero',
		);
	});

	test('latencia range sorteia inteiro inclusivo entre minimo e maximo', () => {
		const random = vi.fn().mockReturnValue(0.5);
		expect(resolveMockLatencyMs({ mode: 'range', minMs: 1000, maxMs: 5000 }, random)).toBe(3000);
		expect(random).toHaveBeenCalledTimes(1);
	});

	test('latencia range valida limites', () => {
		expect(() => resolveMockLatencyMs({ mode: 'range', minMs: 10, maxMs: 9 })).toThrow(
			'minMs deve ser menor ou igual a maxMs',
		);
		expect(() => resolveMockLatencyMs({ mode: 'range', minMs: 1.5, maxMs: 2 })).toThrow(
			'minMs e maxMs devem ser inteiros',
		);
	});
});
