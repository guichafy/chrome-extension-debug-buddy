import { PROBE_NAMESPACE, type ProbeMessage } from '../protocol';

interface ZustandStoreApi {
	subscribe: (listener: (state: unknown, prev: unknown) => void) => () => void;
	getState: () => unknown;
	setState?: (...args: unknown[]) => unknown;
	destroy?: () => void;
}

interface ZustandModule {
	create?: (...args: unknown[]) => unknown;
}

let storeCounter = 0;
let installed = false;
const wrappedStores = new WeakSet<ZustandStoreApi>();

export const zustandStoreRegistry: { count: number; ids: string[] } = { count: 0, ids: [] };

function emitStateChange(storeId: string, prev: unknown, next: unknown): void {
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:state-change',
		payload: {
			storeId,
			storeKind: 'zustand',
			timestamp: Date.now(),
			prev,
			next,
		},
	};
	window.postMessage(msg, location.origin);
}

function isStoreApi(value: unknown): value is ZustandStoreApi {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { subscribe?: unknown }).subscribe === 'function' &&
		typeof (value as { getState?: unknown }).getState === 'function'
	);
}

function wrapStore(store: ZustandStoreApi): void {
	if (wrappedStores.has(store)) return;
	wrappedStores.add(store);
	storeCounter++;
	const storeId = `zustand:${storeCounter}`;
	zustandStoreRegistry.count++;
	zustandStoreRegistry.ids.push(storeId);

	store.subscribe((next, prev) => {
		if (next !== prev) {
			emitStateChange(storeId, prev, next);
		}
	});
}

function maybeWrapResult(result: unknown): void {
	// `create()` pode retornar a store API diretamente (vanilla) ou um hook (React)
	// que tem propriedades `getState`/`subscribe` anexadas. Cobre os dois.
	if (isStoreApi(result)) {
		try {
			wrapStore(result);
		} catch {
			// Falha no wrap não pode quebrar a app — silenciar.
		}
		return;
	}
	if (typeof result === 'function') {
		const hook = result as unknown as ZustandStoreApi;
		if (isStoreApi(hook)) {
			try {
				wrapStore(hook);
			} catch {
				// idem
			}
		}
	}
}

export function installZustandTap(): void {
	if (installed) return;
	installed = true;
	const g = globalThis as unknown as { zustand?: ZustandModule };
	if (!g.zustand || typeof g.zustand.create !== 'function') return;
	const original = g.zustand.create;

	const wrappedCreate = (...args: unknown[]): unknown => {
		const result = original(...args);
		// `create` pode ser curried: `create()(initializer)`. Se o retorno é função
		// e ainda não é uma store, retornamos um proxy que captura a próxima chamada.
		if (typeof result === 'function' && !isStoreApi(result as unknown as ZustandStoreApi)) {
			return (...next: unknown[]): unknown => {
				const final = (result as (...a: unknown[]) => unknown)(...next);
				maybeWrapResult(final);
				return final;
			};
		}
		maybeWrapResult(result);
		return result;
	};

	g.zustand.create = wrappedCreate;
}

export function _wrapStoreForTests(store: ZustandStoreApi): string {
	const before = zustandStoreRegistry.count;
	wrapStore(store);
	return zustandStoreRegistry.ids[before];
}

export function _resetZustandTapForTests(): void {
	storeCounter = 0;
	installed = false;
	zustandStoreRegistry.count = 0;
	zustandStoreRegistry.ids.length = 0;
}
