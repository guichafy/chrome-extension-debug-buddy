import { InterceptedResponse } from '@/ui/hooks/useResponses';

// Nome do banco de dados e versão
const DB_NAME = 'debugger-extension-db';
const DB_VERSION = 1;

// Nome das stores (tabelas)
const REQUESTS_STORE = 'requests';

// Interface para o serviço de IndexedDB
interface IndexedDBService {
	init(): Promise<boolean>;
	saveRequest(requestId: string, request: InterceptedResponse): Promise<boolean>;
	getRequest(requestId: string): Promise<InterceptedResponse | null>;
	getAllRequests(): Promise<Record<string, InterceptedResponse>>;
	deleteRequest(requestId: string): Promise<boolean>;
	clearAllRequests(): Promise<boolean>;
}

// Implementação do serviço
class IndexedDBServiceImpl implements IndexedDBService {
	private db: IDBDatabase | null = null;

	// Inicializa o banco de dados
	async init(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = (event) => {
				console.error('Erro ao abrir o banco de dados:', event);
				reject(new Error('Falha ao abrir o banco de dados'));
			};

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result;
				console.log('Banco de dados inicializado com sucesso');
				resolve(true);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Criar store para requisições se não existir
				if (!db.objectStoreNames.contains(REQUESTS_STORE)) {
					const store = db.createObjectStore(REQUESTS_STORE, { keyPath: 'id' });

					// Criar índices para pesquisa eficiente
					store.createIndex('url', 'data.url', { unique: false });
					store.createIndex('timestamp', 'data.timestamp', { unique: false });
					store.createIndex('method', 'data.method', { unique: false });
					store.createIndex('status', 'data.status', { unique: false });

					console.log('Store de requisições criada');
				}
			};
		});
	}

	// Salva uma requisição no banco de dados
	async saveRequest(requestId: string, request: InterceptedResponse): Promise<boolean> {
		if (!this.db) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Banco de dados não inicializado'));
				return;
			}

			try {
				const transaction = this.db.transaction([REQUESTS_STORE], 'readwrite');
				const store = transaction.objectStore(REQUESTS_STORE);

				const record = {
					id: requestId,
					data: request,
				};

				const storeRequest = store.put(record);

				storeRequest.onsuccess = () => {
					resolve(true);
				};

				storeRequest.onerror = (event) => {
					console.error('Erro ao salvar requisição:', event);
					reject(new Error('Falha ao salvar requisição'));
				};
			} catch (error) {
				console.error('Erro ao criar transação:', error);
				reject(error);
			}
		});
	}

	// Obtém uma requisição específica
	async getRequest(requestId: string): Promise<InterceptedResponse | null> {
		if (!this.db) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Banco de dados não inicializado'));
				return;
			}

			try {
				const transaction = this.db.transaction([REQUESTS_STORE], 'readonly');
				const store = transaction.objectStore(REQUESTS_STORE);
				const storeRequest = store.get(requestId);

				storeRequest.onsuccess = () => {
					const record = storeRequest.result;
					if (record && record.data) {
						// Garantir que o objeto retornado é do tipo InterceptedResponse
						const data = record.data as InterceptedResponse;
						resolve(data);
					} else {
						resolve(null);
					}
				};

				storeRequest.onerror = (event) => {
					console.error('Erro ao obter requisição:', event);
					reject(new Error('Falha ao obter requisição'));
				};
			} catch (error) {
				console.error('Erro ao criar transação:', error);
				reject(error);
			}
		});
	}

	// Obtém todas as requisições
	async getAllRequests(): Promise<Record<string, InterceptedResponse>> {
		if (!this.db) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Banco de dados não inicializado'));
				return;
			}

			try {
				const transaction = this.db.transaction([REQUESTS_STORE], 'readonly');
				const store = transaction.objectStore(REQUESTS_STORE);
				const storeRequest = store.getAll();

				storeRequest.onsuccess = () => {
					const records = storeRequest.result;
					const result: Record<string, InterceptedResponse> = {};

					records.forEach((record: { id: string; data: any }) => {
						if (record && record.data && typeof record.data === 'object' && 'url' in record.data) {
							result[record.id] = record.data as InterceptedResponse;
						}
					});

					resolve(result);
				};

				storeRequest.onerror = (event) => {
					console.error('Erro ao obter todas as requisições:', event);
					reject(new Error('Falha ao obter todas as requisições'));
				};
			} catch (error) {
				console.error('Erro ao criar transação:', error);
				reject(error);
			}
		});
	}

	// Exclui uma requisição específica
	async deleteRequest(requestId: string): Promise<boolean> {
		if (!this.db) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Banco de dados não inicializado'));
				return;
			}

			try {
				const transaction = this.db.transaction([REQUESTS_STORE], 'readwrite');
				const store = transaction.objectStore(REQUESTS_STORE);
				const storeRequest = store.delete(requestId);

				storeRequest.onsuccess = () => {
					resolve(true);
				};

				storeRequest.onerror = (event) => {
					console.error('Erro ao excluir requisição:', event);
					reject(new Error('Falha ao excluir requisição'));
				};
			} catch (error) {
				console.error('Erro ao criar transação:', error);
				reject(error);
			}
		});
	}

	// Limpa todas as requisições
	async clearAllRequests(): Promise<boolean> {
		if (!this.db) {
			await this.init();
		}

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Banco de dados não inicializado'));
				return;
			}

			try {
				const transaction = this.db.transaction([REQUESTS_STORE], 'readwrite');
				const store = transaction.objectStore(REQUESTS_STORE);
				const storeRequest = store.clear();

				storeRequest.onsuccess = () => {
					resolve(true);
				};

				storeRequest.onerror = (event) => {
					console.error('Erro ao limpar requisições:', event);
					reject(new Error('Falha ao limpar requisições'));
				};
			} catch (error) {
				console.error('Erro ao criar transação:', error);
				reject(error);
			}
		});
	}
}

// Exporta uma instância única do serviço
export const indexedDBService = new IndexedDBServiceImpl();
