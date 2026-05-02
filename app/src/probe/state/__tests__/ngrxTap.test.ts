import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installNgRxTap, ngrxDetected } from '../ngrxTap';

describe('ngrxTap', () => {
	type Listener = (s: unknown) => void;

	const buildFakeStore = () => {
		const listeners: Listener[] = [];
		let state = { count: 0 };
		const store = {
			dispatch: (action: { type: string }) => {
				if (action.type === '[Counter] Increment') state = { count: state.count + 1 };
				listeners.forEach((l) => l(state));
			},
			state$: {
				subscribe: (cb: Listener) => {
					listeners.push(cb);
					cb(state);
					return { unsubscribe: () => listeners.splice(listeners.indexOf(cb), 1) };
				},
			},
		};
		return store;
	};

	beforeEach(() => {
		(window as unknown as { __STORE__?: unknown }).__STORE__ = buildFakeStore();
	});

	afterEach(() => {
		(window as unknown as { __STORE__?: unknown }).__STORE__ = undefined;
	});

	it('ngrxDetected=true quando __STORE__ existe', () => {
		expect(ngrxDetected()).toBe(true);
	});

	it('ngrxDetected=false sem nenhum hook', () => {
		(window as unknown as { __STORE__?: unknown }).__STORE__ = undefined;
		expect(ngrxDetected()).toBe(false);
	});

	it('emite probe:state-change com storeKind ngrx ao dispatch', async () => {
		const tap = installNgRxTap();
		expect(tap).not.toBeNull();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const store = (window as unknown as { __STORE__: { dispatch: (a: unknown) => void } })
			.__STORE__;
		store.dispatch({ type: '[Counter] Increment' });
		await new Promise((r) => setTimeout(r, 5));

		const ev = messages.find((m) => (m as { type?: string }).type === 'probe:state-change') as
			| { payload: { storeKind: string; storeId: string; next: unknown } }
			| undefined;
		expect(ev?.payload.storeKind).toBe('ngrx');
		expect(ev?.payload.storeId).toContain('Increment');
		expect(ev?.payload.next).toEqual({ count: 1 });

		tap?.uninstall();
	});

	it('uninstall restaura dispatch original', () => {
		const store = (window as unknown as { __STORE__: { dispatch: (a: unknown) => void } })
			.__STORE__;
		const origRef = store.dispatch;
		const tap = installNgRxTap();
		expect(store.dispatch).not.toBe(origRef);
		tap?.uninstall();
		expect(store.dispatch).toBe(origRef);
	});
});
