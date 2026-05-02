import { afterEach, describe, expect, it } from 'vitest';
import { detectStateManagers } from '../stateManagers';

afterEach(() => {
	(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ =
		undefined;
});

describe('detectStateManagers', () => {
	it('detecta Redux via __REDUX_DEVTOOLS_EXTENSION__', () => {
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__: unknown }).__REDUX_DEVTOOLS_EXTENSION__ =
			() => null;
		const got = detectStateManagers();
		expect(got).toContainEqual({
			name: 'redux',
			storesDetected: 0,
			treatment: 'tracked',
		});
	});

	it('retorna vazio quando nada é detectado', () => {
		expect(detectStateManagers()).toEqual([]);
	});
});

describe('detectStateManagers — Phase 5 Angular', () => {
	afterEach(() => {
		(window as unknown as { ng?: unknown }).ng = undefined;
		(window as unknown as { __STORE__?: unknown }).__STORE__ = undefined;
		(window as unknown as { __NGRX_DEVTOOLS__?: unknown }).__NGRX_DEVTOOLS__ = undefined;
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ =
			undefined;
	});

	it('reporta angular-signal com tracked quando ng.getComponent existe', () => {
		(window as unknown as { ng: unknown }).ng = { getComponent: () => null };
		const out = detectStateManagers();
		const sig = out.find((s) => s.name === 'angular-signal');
		expect(sig?.treatment).toBe('tracked');
	});

	it('reporta ngrx com tracked quando __STORE__ existe', () => {
		(window as unknown as { __STORE__: unknown }).__STORE__ = { dispatch: () => {} };
		const out = detectStateManagers();
		const ngrx = out.find((s) => s.name === 'ngrx');
		expect(ngrx?.treatment).toBe('tracked');
	});

	it('NÃO reporta angular-signal quando ng está ausente (no fallback)', () => {
		const out = detectStateManagers();
		expect(out.find((s) => s.name === 'angular-signal')).toBeUndefined();
	});
});
