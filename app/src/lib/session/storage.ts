import type { Session } from './types';

const DB_NAME = 'debugger-extension-db';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);
		req.onupgradeneeded = () => {
			const db = req.result;

			// Cria store de sessions se não existir
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('startedAt', 'startedAt');
				store.createIndex('tabId', 'tabId');
				// Sem índice composto em endedAt: null não entra em índices na maioria
				// das implementações de IndexedDB. findActiveByTab filtra em JS.
			}

			// Mantém o store 'requests' existente intacto.
			if (!db.objectStoreNames.contains('requests')) {
				const reqs = db.createObjectStore('requests', { keyPath: 'id' });
				reqs.createIndex('url', 'data.url');
				reqs.createIndex('timestamp', 'data.timestamp');
				reqs.createIndex('method', 'data.method');
				reqs.createIndex('status', 'data.status');
			}
		};
	});
}

async function withStore<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
	const db = await openDB();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode);
		const store = tx.objectStore(STORE_NAME);
		Promise.resolve(fn(store)).then(resolve, reject);
		tx.onerror = () => reject(tx.error);
	});
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export const sessionStorage = {
	async put(session: Session): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.put(session)));
	},

	async get(id: string): Promise<Session | null> {
		const got = await withStore('readonly', (store) => reqToPromise(store.get(id)));
		return (got as Session | undefined) ?? null;
	},

	async list(): Promise<Session[]> {
		const all = await withStore('readonly', (store) => reqToPromise(store.getAll()));
		return (all as Session[]).slice().sort((a, b) => b.startedAt - a.startedAt);
	},

	async findActiveByTab(tabId: number): Promise<Session | null> {
		const all = await withStore('readonly', (store) => reqToPromise(store.getAll()));
		return (all as Session[]).find((s) => s.tabId === tabId && s.endedAt === null) ?? null;
	},

	async delete(id: string): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.delete(id)));
	},

	async count(): Promise<number> {
		return withStore('readonly', (store) => reqToPromise(store.count()));
	},

	async clear(): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.clear()));
	},
};
