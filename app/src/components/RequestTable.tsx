import React, { useMemo } from 'react';
import { InterceptedResponse } from '../hooks/useResponses';
import { DataTable } from './requests/data-table';
import { columns } from './requests/columns';

interface RequestTableProps {
	requests: Record<string, InterceptedResponse>;
	onSelect: (requestId: string) => void;
	pauseAutoRefresh?: () => void;
	enableAutoRefresh?: () => void;
	autoRefreshEnabled?: boolean;
	onClearHistory?: () => void;
}

const RequestTable: React.FC<RequestTableProps> = ({
	requests,
	onSelect,
	pauseAutoRefresh,
	enableAutoRefresh,
	autoRefreshEnabled,
	onClearHistory,
}) => {
	const requestRows = useMemo(() => {
		return Object.entries(requests || {}).map(([id, request]) => ({
			id,
			request,
		}));
	}, [requests]);

	return (
		<DataTable
			columns={columns}
			data={requestRows}
			onSelect={onSelect}
			pauseAutoRefresh={pauseAutoRefresh}
			enableAutoRefresh={enableAutoRefresh}
			autoRefreshEnabled={autoRefreshEnabled}
			onClearHistory={onClearHistory}
		/>
	);
};

export default RequestTable;
