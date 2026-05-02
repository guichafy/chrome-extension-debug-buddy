import { PROBE_NAMESPACE, type ProbeMessage } from '../protocol';

interface ReduxStore {
	subscribe: (listener: () => void) => () => void;
	getState: () => unknown;
	dispatch: (action: unknown) => unknown;
}

interface ReduxDevtoolsExtension {
	(config?: unknown): (next: unknown) => unknown;
	connect?: (config?: unknown) => unknown;
}

let storeCounter = 0;
let installed = false;
const wrappedStores = new WeakSet<ReduxStore>();

export const reduxStoreRegistry: { count: number; ids: string[] } = { count: 0, ids: [] };

function emitStateChange(storeId: string, prev: unknown, next: unknown): void {
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:state-change',
		payload: {
			storeId,
			storeKind: 'redux',
			timestamp: Date.now(),
			prev,
			next,
		},
	};
	window.postMessage(msg, location.origin);
}

function wrapStore(store: ReduxStore): void {
	if (wrappedStores.has(store)) return;
	wrappedStores.add(store);
	storeCounter++;
	const storeId = `redux:${storeCounter}`;
	reduxStoreRegistry.count++;
	reduxStoreRegistry.ids.push(storeId);

	let prevState = store.getState();
	store.subscribe(() => {
		const nextState = store.getState();
		if (nextState !== prevState) {
			emitStateChange(storeId, prevState, nextState);
			prevState = nextState;
		}
	});
}

export function installReduxTap(): void {
	if (installed) return;
	installed = true;
	const w = window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension };
	const original = w.__REDUX_DEVTOOLS_EXTENSION__;

	const wrapped: ReduxDevtoolsExtension = ((config?: unknown) => {
		const enhancer = original ? original(config) : (next: unknown) => next;
		return (next: unknown) => {
			const composed = (enhancer as (n: unknown) => unknown)(next);
			return ((...args: unknown[]) => {
				const store = (composed as (...a: unknown[]) => ReduxStore)(...args);
				try {
					wrapStore(store);
				} catch {
					// Falha no wrap não pode quebrar a app — log silencioso.
				}
				return store;
			}) as unknown;
		};
	}) as ReduxDevtoolsExtension;

	if (original?.connect) {
		(wrapped as unknown as { connect: unknown }).connect = original.connect.bind(original);
	}

	w.__REDUX_DEVTOOLS_EXTENSION__ = wrapped;
}

export function _wrapStoreForTests(store: ReduxStore): string {
	const before = reduxStoreRegistry.count;
	wrapStore(store);
	return reduxStoreRegistry.ids[before];
}

export function _resetReduxTapForTests(): void {
	storeCounter = 0;
	installed = false;
	reduxStoreRegistry.count = 0;
	reduxStoreRegistry.ids.length = 0;
}
