import { describe, expect, it } from 'vitest';
import { truncatePath } from '../pathTruncator';

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

