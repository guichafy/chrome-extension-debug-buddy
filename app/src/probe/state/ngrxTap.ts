import { PROBE_NAMESPACE, type ProbeMessage } from '../protocol';

interface NgRxStoreLike {
	dispatch?: (action: unknown) => void;
	state$?: { subscribe?: (cb: (state: unknown) => void) => unknown };
	source?: { subscribe?: (cb: (s: unknown) => void) => unknown };
}

interface NgRxAction {
	type?: string;
	[k: string]: unknown;
}

function findStore(): NgRxStoreLike | null {
	const w = window as unknown as {
		__NGRX_DEVTOOLS__?: { connect?: () => unknown };
		__STORE__?: NgRxStoreLike;
	};
	if (w.__STORE__?.dispatch) return w.__STORE__;
	return null;
}

export function ngrxDetected(): boolean {
	const w = window as unknown as { __NGRX_DEVTOOLS__?: unknown; __STORE__?: unknown };
	return !!(w.__NGRX_DEVTOOLS__ || w.__STORE__);
}

export function installNgRxTap(): { uninstall: () => void } | null {
	const store = findStore();
	if (!store?.dispatch) return null;

	let lastState: unknown;
	const stream = store.state$ ?? store.source;
	const sub = stream?.subscribe?.((s: unknown) => {
		lastState = s;
	});

	const origDispatch = store.dispatch;
	store.dispatch = function (action: unknown) {
		const before = lastState;
		const ret = origDispatch.call(this, action);
		queueMicrotask(() => {
			const actionType = (action as NgRxAction)?.type;
			const storeId = actionType ? `ngrx:root#${actionType}` : 'ngrx:root';
			const msg: ProbeMessage = {
				ns: PROBE_NAMESPACE,
				type: 'probe:state-change',
				payload: {
					storeId,
					storeKind: 'ngrx',
					timestamp: Date.now(),
					prev: before,
					next: lastState,
				},
			};
			window.postMessage(msg, location.origin);
		});
		return ret;
	};

	return {
		uninstall: () => {
			store.dispatch = origDispatch;
			(sub as { unsubscribe?: () => void } | undefined)?.unsubscribe?.();
		},
	};
}
