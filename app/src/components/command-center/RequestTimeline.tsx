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
	onClearHistory: () => void;
	autoRefreshEnabled: boolean;
	pauseAutoRefresh: () => void;
	enableAutoRefresh: () => void;
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
			pauseAutoRefresh={pauseAutoRefresh}
			enableAutoRefresh={enableAutoRefresh}
			autoRefreshEnabled={autoRefreshEnabled}
			onClearHistory={onClearHistory}
			pendingRowIds={pendingRowIds}
			filterSlot={
				<FilterBar filters={filters} onFiltersChange={onFiltersChange} requests={requests} />
			}
		/>
	);
}
