import { createRow, type Row, type RowModel, type Table } from '@tanstack/react-table';
import type { InterceptedResponse } from '@/types/intercepted';
import type { RequestRow } from './columns';

/**
 * Modelo exclusivo da tabela plana de requests, com IDs estáveis e dados imutáveis.
 * Usa createRow público para manter os recursos/células do TanStack. Cada linha
 * captura seu índice nos accessors: mudança de posição também exige recriação.
 * Cache contém somente o dataset atual; excluir/limpar libera linhas antigas.
 */
export function getStableFlatCoreRowModel<T extends { id: string }>() {
	return (table: Table<T>): (() => RowModel<T>) => {
		let previousData: T[] | undefined;
		let previousColumns: ReturnType<Table<T>['getAllLeafColumns']> | undefined;
		let cachedRows = new Map<string, Row<T>>();
		let model: RowModel<T> = { rows: [], flatRows: [], rowsById: {} };
		return () => {
			if (table.options.getSubRows) {
				throw new Error('Modelo de requests aceita somente linhas planas.');
			}
			const data = table.options.data;
			const columns = table.getAllLeafColumns();
			if (data === previousData && columns === previousColumns) return model;
			const reuseColumns = columns === previousColumns;
			const nextCache = new Map<string, Row<T>>();
			const rows: Row<T>[] = [];
			const rowsById: Record<string, Row<T>> = Object.create(null);
			for (let index = 0; index < data.length; index++) {
				const original = data[index];
				const previous = reuseColumns ? cachedRows.get(original.id) : undefined;
				const row =
					previous && previous.original === original && previous.index === index
						? previous
						: createRow(table, original.id, original, index, 0);
				rows.push(row);
				rowsById[row.id] = row;
				nextCache.set(row.id, row);
			}
			cachedRows = nextCache;
			previousData = data;
			previousColumns = columns;
			model = { rows, flatRows: rows, rowsById };
			return model;
		};
	};
}

export function createRequestRowsCache() {
	let previous = new Map<string, RequestRow>();
	return (requests: Record<string, InterceptedResponse>) => {
		const rows: RequestRow[] = [];
		const next = new Map<string, RequestRow>();
		const pendingRowIds = new Set<string>();
		for (const id of Object.keys(requests)) {
			const request = requests[id];
			const cached = previous.get(id);
			const row = cached?.request === request ? cached : { id, request };
			rows.push(row);
			next.set(id, row);
			if (request.isWaiting === true) pendingRowIds.add(id);
		}
		previous = next;
		return { rows, pendingRowIds };
	};
}
