import type { Session } from './types';

const DB_NAME = 'debugger-extension-db';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';

let cachedDB: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
	if (cachedDB) return Promise.resolve(cachedDB);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => {
			cachedDB = req.result;
			// Limpa cache se outra versão abrir (ex: futura migração via outra aba)
			cachedDB.onversionchange = () => {
				cachedDB?.close();
				cachedDB = null;
			};
			resolve(cachedDB);
		};
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

/** Reseta conexão cacheada — uso exclusivo em testes, para isolar estado entre casos. */
export function _resetForTests(): void {
	cachedDB = null;
}

async function withStore<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
	const db = await openDB();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode);
		const store = tx.objectStore(STORE_NAME);
		let result!: T;
		Promise.resolve(fn(store)).then(
			(r) => {
				result = r;
			},
			reject,
		);
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('Transação abortada'));
	});
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export const sessionStore = {
	async put(session: Session): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.put(session)));
	},

	async get(id: string): Promise<Session | null> {
		const got = await withStore('readonly', (store) => reqToPromise(store.get(id)));
		// IDBRequest é tipado como `any` na lib; cast seguro porque o store só recebe Session via put().
		return (got as Session | undefined) ?? null;
	},

	async list(): Promise<Session[]> {
		const all = await withStore('readonly', (store) => reqToPromise(store.getAll()));
		// IDBRequest é tipado como `any` na lib; cast seguro porque o store só recebe Session via put().
		return (all as Session[]).slice().sort((a, b) => b.startedAt - a.startedAt);
	},

	async findActiveByTab(tabId: number): Promise<Session | null> {
		const all = await withStore('readonly', (store) => reqToPromise(store.getAll()));
		// IDBRequest é tipado como `any` na lib; cast seguro porque o store só recebe Session via put().
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
