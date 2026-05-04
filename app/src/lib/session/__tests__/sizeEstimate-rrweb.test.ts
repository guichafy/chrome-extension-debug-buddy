import { describe, expect, it } from 'vitest';
import { estimateRrwebBytes } from '../sizeEstimate';
import type { RrwebEvent } from '../types';

const ev = (type: number, data: unknown, timestamp: number): RrwebEvent => ({
	type,
	data,
	timestamp,
});

describe('estimateRrwebBytes', () => {
	it('retorna 0 para array vazio', () => {
		expect(estimateRrwebBytes([])).toBe(0);
	});

	it('retorna número positivo para um evento', () => {
		const bytes = estimateRrwebBytes([ev(2, { source: 0, html: '<html></html>' }, 1)]);
		expect(bytes).toBeGreaterThan(0);
	});

	it('é monotônico — mais eventos => mais bytes', () => {
		const small = estimateRrwebBytes([ev(3, { source: 1, x: 0, y: 0 }, 1)]);
		const big = estimateRrwebBytes([
			ev(3, { source: 1, x: 0, y: 0 }, 1),
			ev(3, { source: 1, x: 100, y: 100 }, 2),
			ev(3, { source: 1, x: 200, y: 200 }, 3),
		]);
		expect(big).toBeGreaterThan(small);
	});
});
