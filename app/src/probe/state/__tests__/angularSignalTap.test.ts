import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { angularSignalsTrackable, installAngularSignalTap } from '../angularSignalTap';

type SignalLike = (() => number) & {
	set: (v: number) => void;
	update: (m: (c: number) => number) => void;
};

describe('angularSignalTap', () => {
	beforeEach(() => {
		const fakeComponent = (() => {
			let val = 0;
			const sig = (() => val) as SignalLike;
			sig.set = (v: number) => {
				val = v;
			};
			sig.update = (m: (c: number) => number) => {
				val = m(val);
			};
			return { count: sig };
		})();
		(window as unknown as { ng?: unknown }).ng = {
			getComponent: () => fakeComponent,
		};
	});

	afterEach(() => {
		(window as unknown as { ng?: unknown }).ng = undefined;
	});

	it('retorna null sem ng global', () => {
		(window as unknown as { ng?: unknown }).ng = undefined;
		expect(installAngularSignalTap()).toBeNull();
	});

	it('angularSignalsTrackable=true quando ng.getComponent existe', () => {
		expect(angularSignalsTrackable()).toBe(true);
	});

	it('emite probe:state-change ao chamar .set() no signal', async () => {
		const tap = installAngularSignalTap();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const ng = (window as unknown as { ng: { getComponent: (el: unknown) => unknown } }).ng;
		const inst = ng.getComponent(document.body) as { count: SignalLike };
		inst.count.set(42);
		await new Promise((r) => setTimeout(r, 0));

		const change = messages.find((m) => (m as { type?: string }).type === 'probe:state-change') as
			| { payload: { storeKind: string; next: number } }
			| undefined;
		expect(change?.payload.storeKind).toBe('angular-signal');
		expect(change?.payload.next).toBe(42);
		tap?.uninstall();
	});

	it('emite probe:state-change ao chamar .update()', async () => {
		const tap = installAngularSignalTap();
		const messages: unknown[] = [];
		window.addEventListener('message', (e) => messages.push(e.data));

		const ng = (window as unknown as { ng: { getComponent: (el: unknown) => unknown } }).ng;
		const inst = ng.getComponent(document.body) as { count: SignalLike };
		inst.count.update((c) => c + 5);
		await new Promise((r) => setTimeout(r, 0));

		const changes = messages.filter((m) => (m as { type?: string }).type === 'probe:state-change');
		expect(changes.length).toBeGreaterThan(0);
		tap?.uninstall();
	});
});
