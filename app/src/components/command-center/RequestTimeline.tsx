import { useMemo, useState } from 'react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Filter } from '@/types/filters';
import { DataTable } from '@/components/requests/data-table';
import { columns } from '@/components/requests/columns';
import { createRequestRowsCache } from '@/components/requests/flatRequestRowModels';
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
	const [buildRows] = useState(createRequestRowsCache);
	const { rows, pendingRowIds } = useMemo(() => buildRows(requests), [requests, buildRows]);

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
