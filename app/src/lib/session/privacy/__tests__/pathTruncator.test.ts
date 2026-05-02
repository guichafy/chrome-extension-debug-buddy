import { describe, expect, it } from 'vitest';
import { truncatePath, truncateStackTrace } from '../pathTruncator';

describe('truncatePath', () => {
	it('trunca /Users/<name>/... (macOS)', () => {
		expect(truncatePath('/Users/alice/projects/foo/src/App.tsx')).toBe(
			'/Users/<u>/projects/foo/src/App.tsx',
		);
	});

	it('trunca /home/<name>/... (Linux)', () => {
		expect(truncatePath('/home/bob/code/foo')).toBe('/home/<u>/code/foo');
	});

	it('trunca C:\\Users\\<name>\\... (Windows backslash) e C:/Users/<name>/... (Windows forward)', () => {
		expect(truncatePath('C:\\Users\\carol\\Documents\\app.ts')).toBe(
			'C:\\Users\\<u>\\Documents\\app.ts',
		);
		expect(truncatePath('C:/Users/dave/Documents/app.ts')).toBe(
			'C:/Users/<u>/Documents/app.ts',
		);
	});

	it('passthrough quando não há match', () => {
		expect(truncatePath('/var/log/app.log')).toBe('/var/log/app.log');
		expect(truncatePath('https://example.com/foo/bar')).toBe('https://example.com/foo/bar');
		expect(truncatePath('')).toBe('');
	});
});

describe('truncateStackTrace', () => {
	it('aplica truncatePath linha a linha em stack multi-linha', () => {
		const stack = [
			'Error: boom',
			'    at fn1 (/Users/alice/proj/src/a.ts:10:5)',
			'    at fn2 (/home/bob/proj/src/b.ts:20:7)',
			'    at fn3 (C:\\Users\\carol\\proj\\src\\c.ts:30:9)',
		].join('\n');
		const expected = [
			'Error: boom',
			'    at fn1 (/Users/<u>/proj/src/a.ts:10:5)',
			'    at fn2 (/home/<u>/proj/src/b.ts:20:7)',
			'    at fn3 (C:\\Users\\<u>\\proj\\src\\c.ts:30:9)',
		].join('\n');
		expect(truncateStackTrace(stack)).toBe(expected);
	});
});
