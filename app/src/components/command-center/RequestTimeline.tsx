import { useMemo } from 'react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Filter } from '@/types/filters';
import { DataTable } from '@/components/requests/data-table';
import { columns } from '@/components/requests/columns';
import { FilterBar } from './FilterBar';

interface RequestTimelineProps {
	requests: Record<string, InterceptedResponse>;
	selectedId: string | null;
	onSelect: (id: string) => void;
	filters: Filter[];
	onFiltersChange: (filters: Filter[]) => void;
	/**
	 * Se omitido, o botão "Limpar histórico" não aparece — útil em contextos
	 * read-only (ex.: Replay viewer) onde clear não faz sentido.
	 */
	onClearHistory?: () => void;
}

export function RequestTimeline({
	requests,
	selectedId,
	onSelect,
	filters,
	onFiltersChange,
	onClearHistory,
}: RequestTimelineProps) {
	const { rows, pendingRowIds } = useMemo(() => {
		const rowList: { id: string; request: (typeof requests)[string] }[] = [];
		const pending = new Set<string>();
		for (const [id, request] of Object.entries(requests)) {
			rowList.push({ id, request });
			if (request.isWaiting === true) pending.add(id);
		}
		return { rows: rowList, pendingRowIds: pending };
	}, [requests]);

	return (
		<DataTable
			columns={columns}
			data={rows}
			selectedRowId={selectedId ?? undefined}
			onSelect={onSelect}
			onClearHistory={onClearHistory}
			pendingRowIds={pendingRowIds}
			filterSlot={
				<FilterBar filters={filters} onFiltersChange={onFiltersChange} requests={requests} />
			}
		/>
	);
}
