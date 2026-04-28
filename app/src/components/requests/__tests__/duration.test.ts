import { formatDuration, getDurationColorClass, compareDurations } from '../duration';

describe('formatDuration', () => {
	it('retorna "—" quando duration é undefined', () => {
		expect(formatDuration(undefined)).toBe('—');
	});

	it('formata valores menores que 1 segundo em milissegundos', () => {
		expect(formatDuration(0)).toBe('0ms');
		expect(formatDuration(150)).toBe('150ms');
		expect(formatDuration(999)).toBe('999ms');
	});

	it('formata valores >= 1 segundo como "Xs Yms"', () => {
		expect(formatDuration(1000)).toBe('1s 0ms');
		expect(formatDuration(1500)).toBe('1s 500ms');
		expect(formatDuration(2750)).toBe('2s 750ms');
	});
});

describe('getDurationColorClass', () => {
	it('retorna classe muted quando duration é undefined', () => {
		expect(getDurationColorClass(undefined)).toBe('text-muted-foreground');
	});

	it('retorna verde para tempos rápidos (<= 500ms)', () => {
		expect(getDurationColorClass(0)).toBe('text-green-600');
		expect(getDurationColorClass(500)).toBe('text-green-600');
	});

	it('retorna amarelo para tempos médios (> 500ms e <= 1000ms)', () => {
		expect(getDurationColorClass(501)).toBe('text-yellow-600');
		expect(getDurationColorClass(1000)).toBe('text-yellow-600');
	});

	it('retorna âmbar para tempos lentos (> 1000ms)', () => {
		expect(getDurationColorClass(1001)).toBe('text-amber-600');
		expect(getDurationColorClass(5000)).toBe('text-amber-600');
	});
});

describe('compareDurations', () => {
	it('ordena valores numéricos em ordem crescente', () => {
		expect(compareDurations(100, 200)).toBeLessThan(0);
		expect(compareDurations(200, 100)).toBeGreaterThan(0);
		expect(compareDurations(150, 150)).toBe(0);
	});

	it('coloca valores undefined depois dos numéricos', () => {
		expect(compareDurations(100, undefined)).toBeLessThan(0);
		expect(compareDurations(undefined, 100)).toBeGreaterThan(0);
	});

	it('considera dois undefined como iguais', () => {
		expect(compareDurations(undefined, undefined)).toBe(0);
	});

	it('não usa hash de id (regressão do bug #14)', () => {
		// O mesmo par de durations sempre devolve a mesma ordenação,
		// independente do que possa estar em outro lugar do row.
		const ordered = [800, 200, 100, 1500].sort(compareDurations);
		expect(ordered).toEqual([100, 200, 800, 1500]);
	});
});
