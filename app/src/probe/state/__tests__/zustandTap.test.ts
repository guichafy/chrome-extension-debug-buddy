import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROBE_NAMESPACE } from '../../protocol';
import {
	_resetZustandTapForTests,
	_wrapStoreForTests,
	installZustandTap,
	zustandStoreRegistry,
} from '../zustandTap';

function makeFakeZustandStore() {
	type State = { count: number };
	const listeners: Array<(s: State, p: State) => void> = [];
	let state: State = { count: 0 };
	return {
		setState(next: State) {
			const prev = state;
			state = next;
			listeners.forEach((l) => l(state, prev));
		},
		store: {
			getState: (): State => state,
			subscribe(fn: (s: State, p: State) => void) {
				listeners.push(fn as (s: unknown, p: unknown) => void);
				return () => {
					const i = listeners.indexOf(fn as (s: unknown, p: unknown) => void);
					if (i >= 0) listeners.splice(i, 1);
				};
			},
		},
	};
}

describe('installZustandTap', () => {
	beforeEach(() => {
		_resetZustandTapForTests();
		(globalThis as unknown as { zustand?: unknown }).zustand = undefined;
	});
	afterEach(() => {
		_resetZustandTapForTests();
		(globalThis as unknown as { zustand?: unknown }).zustand = undefined;
	});

	it('emite probe:state-change quando store muda', () => {
		const fake = makeFakeZustandStore();
		const id = _wrapStoreForTests(fake.store);
		expect(id).toBe('zustand:1');

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
					stateMsgs[0] as {
						payload: { storeId: string; storeKind: string; prev: unknown; next: unknown };
					}
				).payload;
				expect(payload.storeId).toBe('zustand:1');
				expect(payload.storeKind).toBe('zustand');
				expect(payload.prev).toEqual({ count: 0 });
				expect(payload.next).toEqual({ count: 1 });
				resolve();
			}, 10);
		});
	});

	it('não dobra wrap em chamada repetida', () => {
		const fake = makeFakeZustandStore();
		_wrapStoreForTests(fake.store);
		_wrapStoreForTests(fake.store);
		expect(zustandStoreRegistry.count).toBe(1);
	});

	it('proxy em globalThis.zustand.create captura store retornada', () => {
		const fake = makeFakeZustandStore();
		const fakeCreate = (_initializer: unknown) => fake.store;
		(globalThis as unknown as { zustand: { create: typeof fakeCreate } }).zustand = {
			create: fakeCreate,
		};
		installZustandTap();

		const wrappedCreate = (
			globalThis as unknown as { zustand: { create: (init: unknown) => unknown } }
		).zustand.create;
		const result = wrappedCreate(() => ({ count: 0 }));
		expect(result).toBe(fake.store);
		expect(zustandStoreRegistry.count).toBe(1);
		expect(zustandStoreRegistry.ids).toEqual(['zustand:1']);
	});
});
