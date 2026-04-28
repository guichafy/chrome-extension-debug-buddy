import React, { useMemo } from 'react';
import type { InterceptedResponse } from '@/types/intercepted';
import { DataTable } from '@/components/requests/data-table';
import { columns } from '@/components/requests/columns';

interface RequestTimelineProps {
	requests: Record<string, InterceptedResponse>;
	selectedId: string | null;
	onSelect: (id: string) => void;
	searchValue: string;
	onSearchChange: (v: string) => void;
	onClearHistory: () => void;
	autoRefreshEnabled: boolean;
	pauseAutoRefresh: () => void;
	enableAutoRefresh: () => void;
}

export function RequestTimeline({
	requests,
	selectedId,
	onSelect,
	searchValue,
	onSearchChange,
	onClearHistory,
	autoRefreshEnabled,
	pauseAutoRefresh,
	enableAutoRefresh,
}: RequestTimelineProps) {
	const rows = useMemo(
		() =>
			Object.entries(requests).map(([id, request]) => ({
				id,
				request,
			})),
		[requests],
	);

	return (
		<DataTable
			columns={columns}
			data={rows}
			selectedRowId={selectedId ?? undefined}
			onSelect={onSelect}
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			pauseAutoRefresh={pauseAutoRefresh}
			enableAutoRefresh={enableAutoRefresh}
			autoRefreshEnabled={autoRefreshEnabled}
			onClearHistory={onClearHistory}
		/>
	);
}
