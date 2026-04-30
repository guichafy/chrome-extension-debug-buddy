import { useMemo } from 'react';
import type { SortingState } from '@tanstack/react-table';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Filter, Sort } from '@/types/filters';
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
	 * Sort vindo de URL (pill click). Quando definido, ordena os rows aqui e
	 * passa initialSorting=[] pra DataTable não re-ordenar — necessário porque
	 * `transferSize` e `ttfbMs` não têm colunas visíveis na tabela.
	 */
	sort?: Sort;
}

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
	const { rows, pendingRowIds } = useMemo(() => {
		const rowList: { id: string; request: (typeof requests)[string] }[] = [];
		const pending = new Set<string>();
		for (const [id, request] of Object.entries(requests)) {
			rowList.push({ id, request });
			if (request.isWaiting === true) pending.add(id);
		}
		if (sort) {
			const cmp = compareRequests(sort);
			rowList.sort((a, b) => cmp(a.request, b.request));
		}
		return { rows: rowList, pendingRowIds: pending };
	}, [requests, sort]);

	// Quando há sort da URL, congela o sort interno do tanstack pra preservar
	// a ordem que produzimos. Sem sort URL, deixa o default da DataTable rolar.
	const initialSorting: SortingState | undefined = sort ? [] : undefined;

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
