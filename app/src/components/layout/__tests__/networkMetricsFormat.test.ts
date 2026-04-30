import { formatBytes, formatCount, formatMs } from '../networkMetricsFormat';

describe('formatBytes', () => {
	it('retorna "—" para null', () => {
		expect(formatBytes(null)).toBe('—');
	});

	it('formata bytes (< 1024) como número simples + " B"', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1023)).toBe('1023 B');
	});

	it('formata KB com 1 casa decimal', () => {
		expect(formatBytes(1024)).toBe('1.0 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1024 * 999)).toBe('999.0 KB');
	});

	it('formata MB com 1 casa decimal', () => {
		expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
		expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
	});

	it('formata GB com 1 casa decimal', () => {
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
		expect(formatBytes(1024 * 1024 * 1024 * 3)).toBe('3.0 GB');
	});
});

describe('formatMs', () => {
	it('retorna "—" para null', () => {
		expect(formatMs(null)).toBe('—');
	});

	it('formata < 1000 como "N ms"', () => {
		expect(formatMs(0)).toBe('0 ms');
		expect(formatMs(245)).toBe('245 ms');
		expect(formatMs(999)).toBe('999 ms');
	});

	it('formata >= 1000 como "N.N s"', () => {
		expect(formatMs(1000)).toBe('1.0 s');
		expect(formatMs(1500)).toBe('1.5 s');
		expect(formatMs(12345)).toBe('12.3 s');
	});
});

describe('formatCount', () => {
	it('formata números simples', () => {
		expect(formatCount(0)).toBe('0');
		expect(formatCount(47)).toBe('47');
		expect(formatCount(1234)).toBe('1234');
	});
});
