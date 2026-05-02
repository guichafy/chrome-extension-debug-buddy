import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBE_NAMESPACE } from '../../protocol';
import {
	_resetReduxTapForTests,
	_wrapStoreForTests,
	installReduxTap,
	reduxStoreRegistry,
} from '../reduxTap';

function makeFakeStore() {
	const listeners: Array<() => void> = [];
	let state = { count: 0 };
	return {
		state,
		setState(next: typeof state) {
			state = next;
			listeners.forEach((l) => l());
		},
		store: {
			getState: () => state,
			subscribe(fn: () => void) {
				listeners.push(fn);
				return () => {
					const i = listeners.indexOf(fn);
					if (i >= 0) listeners.splice(i, 1);
				};
			},
			dispatch: (a: unknown) => a,
		},
	};
}

describe('installReduxTap', () => {
	beforeEach(() => {
		_resetReduxTapForTests();
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ =
			undefined;
	});
	afterEach(() => {
		_resetReduxTapForTests();
	});

	it('emite probe:state-change quando store muda', () => {
		const fake = makeFakeStore();
		const id = _wrapStoreForTests(fake.store);
		expect(id).toBe('redux:1');

		const messages: unknown[] = [];
		const handler = (e: MessageEvent) => {
			if ((e.data as { ns?: string }).ns === PROBE_NAMESPACE) messages.push(e.data);
		};
		window.addEventListener('message', handler);

		fake.setState({ count: 1 });
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				window.removeEventListener('message', handler);
				const stateMsgs = messages.filter(
					(m) => (m as { type?: string }).type === 'probe:state-change',
				);
				expect(stateMsgs.length).toBeGreaterThanOrEqual(1);
				const payload = (
					stateMsgs[0] as { payload: { storeId: string; prev: unknown; next: unknown } }
				).payload;
				expect(payload.storeId).toBe('redux:1');
				expect(payload.prev).toEqual({ count: 0 });
				expect(payload.next).toEqual({ count: 1 });
				resolve();
			}, 10);
		});
	});

	it('registra storeId em reduxStoreRegistry', () => {
		const fake = makeFakeStore();
		_wrapStoreForTests(fake.store);
		expect(reduxStoreRegistry.count).toBe(1);
		expect(reduxStoreRegistry.ids).toEqual(['redux:1']);
	});

	it('não dobra wrap em chamada repetida', () => {
		const fake = makeFakeStore();
		_wrapStoreForTests(fake.store);
		_wrapStoreForTests(fake.store);
		expect(reduxStoreRegistry.count).toBe(1);
	});

	it('installReduxTap é idempotente', () => {
		installReduxTap();
		installReduxTap();
		expect(true).toBe(true);
	});

	it('wrappa __REDUX_DEVTOOLS_EXTENSION__ existente', () => {
		const original = vi.fn(() => (next: unknown) => next);
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__: unknown }).__REDUX_DEVTOOLS_EXTENSION__ =
			original;
		installReduxTap();
		const wrapped = (
			window as unknown as {
				__REDUX_DEVTOOLS_EXTENSION__: (cfg?: unknown) => (next: unknown) => unknown;
			}
		).__REDUX_DEVTOOLS_EXTENSION__;
		expect(wrapped).not.toBe(original);
		wrapped({ trace: true });
		expect(original).toHaveBeenCalledWith({ trace: true });
	});
});
