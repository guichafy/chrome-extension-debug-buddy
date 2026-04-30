import { useMemo } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Filter, Sort, SortField } from '@/types/filters';
import { compareRequests } from '@/lib/networkSort';
import { DataTable } from '@/components/requests/data-table';
import { columns } from '@/components/requests/columns';
import { FilterBar } from './FilterBar';

interface RequestTimelineProps {
	requests: Record<string, InterceptedResponse>;
	selectedId: string | null;
	onSelect: (id: string) => void;
	filters: Filter[];
	onFiltersChange: (filters: Filter[]) => void;
	onClearHistory: () => void;
	autoRefreshEnabled: boolean;
	pauseAutoRefresh: () => void;
	enableAutoRefresh: () => void;
	/**
	 * Sort vindo de URL (pill click). Quando o `field` corresponde a uma coluna
	 * existente da tabela, passamos como `initialSorting` pro tanstack-table
	 * (mostra o indicador no header). Quando o `field` não tem coluna (ex.: ttfbMs),
	 * pré-ordenamos a lista aqui e passamos `initialSorting=[]` pra tanstack
	 * preservar a ordem.
	 */
	sort?: Sort;
}

// Mapa SortField → column.id da DataTable. Inclui apenas fields que têm coluna
// visível ou ocultável; os que não estão aqui caem no caminho de pre-sort.
const FIELD_TO_COLUMN_ID: Partial<Record<SortField, string>> = {
	timestamp: 'timestamp',
	duration: 'duration',
	transferSize: 'transferSize',
	status: 'status',
	url: 'url',
	method: 'method',
};

export function RequestTimeline({
	requests,
	selectedId,
	onSelect,
	filters,
	onFiltersChange,
	onClearHistory,
	autoRefreshEnabled,
	pauseAutoRefresh,
	enableAutoRefresh,
	sort,
}: RequestTimelineProps) {
	const columnId = sort ? FIELD_TO_COLUMN_ID[sort.field] : undefined;
	const hasColumnForSort = columnId !== undefined;

	const { rows, pendingRowIds } = useMemo(() => {
		const rowList: { id: string; request: (typeof requests)[string] }[] = [];
		const pending = new Set<string>();
		for (const [id, request] of Object.entries(requests)) {
			rowList.push({ id, request });
			if (request.isWaiting === true) pending.add(id);
		}
		// Pre-sort apenas para fields sem coluna correspondente. Quando há coluna,
		// o tanstack-table cuida do sort via initialSorting (header indica visualmente).
		if (sort && !hasColumnForSort) {
			const cmp = compareRequests(sort);
			rowList.sort((a, b) => cmp(a.request, b.request));
		}
		return { rows: rowList, pendingRowIds: pending };
	}, [requests, sort, hasColumnForSort]);

	const initialSorting = useMemo<SortingState | undefined>(() => {
		if (!sort) return undefined;
		if (columnId) return [{ id: columnId, desc: sort.dir === 'desc' }];
		return []; // pre-sort já fez o trabalho; tanstack não re-ordena
	}, [sort, columnId]);

	return (
		<DataTable
			columns={columns}
			data={rows}
			selectedRowId={selectedId ?? undefined}
			onSelect={onSelect}
			pauseAutoRefresh={pauseAutoRefresh}
			enableAutoRefresh={enableAutoRefresh}
			autoRefreshEnabled={autoRefreshEnabled}
			onClearHistory={onClearHistory}
			pendingRowIds={pendingRowIds}
			initialSorting={initialSorting}
			filterSlot={
				<FilterBar filters={filters} onFiltersChange={onFiltersChange} requests={requests} />
			}
		/>
	);
}
