import { createRow, type Row, type RowModel, type Table } from '@tanstack/react-table';
import type { InterceptedResponse } from '@/types/intercepted';
import type { RequestRow } from './columns';

/**
 * Modelo exclusivo da tabela plana de requests, com IDs estáveis e dados imutáveis.
 * Usa createRow público para manter os recursos/células do TanStack. Cada linha
 * captura seu índice nos accessors: mudança de posição também exige recriação.
 * Chaves fracas conservam linhas temporariamente filtradas enquanto o histórico
 * possui os objetos originais, sem impedir coleta após excluir/limpar histórico.
 * O modelo público contém somente o dataset atual. Dataset vazio descarta o
 * cache inteiro, mesmo se o render anterior ainda retiver os objetos originais.
 */
export function getStableFlatCoreRowModel<T extends { id: string }>() {
	return (table: Table<T>): (() => RowModel<T>) => {
		let previousData: T[] | undefined;
		let previousColumns: ReturnType<Table<T>['getAllLeafColumns']> | undefined;
		let cachedRows = new WeakMap<T, Row<T>>();
		let model: RowModel<T> = { rows: [], flatRows: [], rowsById: {} };
		return () => {
			if (table.options.getSubRows) {
				throw new Error('Modelo de requests aceita somente linhas planas.');
			}
			const data = table.options.data;
			const columns = table.getAllLeafColumns();
			if (data === previousData && columns === previousColumns) return model;
			if (columns !== previousColumns || data.length === 0) {
				cachedRows = new WeakMap<T, Row<T>>();
			}
			const rows: Row<T>[] = [];
			const rowsById: Record<string, Row<T>> = Object.create(null);
			for (let index = 0; index < data.length; index++) {
				const original = data[index];
				const previous = cachedRows.get(original);
				const row =
					previous && previous.index === index
						? previous
						: createRow(table, original.id, original, index, 0);
				rows.push(row);
				rowsById[row.id] = row;
				cachedRows.set(original, row);
			}
			previousData = data;
			previousColumns = columns;
			model = { rows, flatRows: rows, rowsById };
			return model;
		};
	};
}

export function createRequestRowsCache() {
	// Uma mesma resposta pode aparecer sob IDs distintos; identidade do wrapper
	// depende dos dois. A chave fraca não mantém bodies removidos em memória.
	let cache = new WeakMap<InterceptedResponse, Map<string, RequestRow>>();
	return (requests: Record<string, InterceptedResponse>) => {
		const rows: RequestRow[] = [];
		const pendingRowIds = new Set<string>();
		const ids = Object.keys(requests);
		if (ids.length === 0) cache = new WeakMap<InterceptedResponse, Map<string, RequestRow>>();
		for (const id of ids) {
			const request = requests[id];
			let byId = cache.get(request);
			if (!byId) {
				byId = new Map<string, RequestRow>();
				cache.set(request, byId);
			}
			let row = byId.get(id);
			if (!row) {
				row = { id, request };
				byId.set(id, row);
			}
			rows.push(row);
			if (request.isWaiting === true) pendingRowIds.add(id);
		}
		return { rows, pendingRowIds };
	};
}
