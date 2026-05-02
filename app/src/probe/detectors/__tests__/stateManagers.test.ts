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
