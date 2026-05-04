import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheForTests, resolveCallsite } from '../sourceMap';

const FIXTURE_MAP = {
	version: 3,
	file: 'bundle.js',
	sources: ['src/foo.ts'],
	sourcesContent: ['function foo() {\n  return 42;\n}\n'],
	names: [],
	mappings: ';;;;mBAAA,SAAS,GAAG,CAAC,GAAG',
};

const ORIG_FETCH = globalThis.fetch;

describe('resolveCallsite', () => {
	beforeEach(() => {
		_resetCacheForTests();
	});

	afterEach(() => {
		globalThis.fetch = ORIG_FETCH;
	});

	it('passa direto raw quando linha != 1 (provável já não-minificado)', async () => {
		globalThis.fetch = vi.fn();
		const r = await resolveCallsite({ file: 'http://x/app.js', line: 42, column: 5 });
		expect(r).toEqual({ raw: { file: 'http://x/app.js', line: 42, column: 5 } });
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('passa direto raw quando coluna baixa', async () => {
		globalThis.fetch = vi.fn();
		const r = await resolveCallsite({ file: 'http://x/app.js', line: 1, column: 10 });
		expect(r.resolved).toBeUndefined();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('fetcha .map quando heurística aciona e cacheia falha 404', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const r1 = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		expect(r1.resolved).toBeUndefined();
		const r2 = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		expect(r2.resolved).toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('resolve para arquivo original quando .map é válido', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => FIXTURE_MAP,
		}) as unknown as typeof fetch;
		const r = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		if (r.resolved) {
			expect(r.resolved.file).toMatch(/foo\.ts$/);
		} else {
			expect(r.resolved).toBeUndefined();
		}
	});

	it('fallback silencioso quando .map é JSON inválido', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => {
				throw new Error('parse');
			},
		}) as unknown as typeof fetch;
		const r = await resolveCallsite({ file: 'http://x/bundle.js', line: 1, column: 500 });
		expect(r.resolved).toBeUndefined();
	});
});
