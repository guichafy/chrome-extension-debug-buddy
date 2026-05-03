import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { sessionEventsToReplayRows } from '@/lib/session/sessionNetworkAdapter';
import type { SessionEvent } from '@/lib/session/types';
import { replayColumns } from './replayColumns';

interface Props {
	events: SessionEvent[];
	cutoffTimestamp: number;
}

// Tabela de requests do replay sincronizada com o playhead. cutoffTimestamp vem
// do `useReplayPlayhead` na ReplayPage; o filtro é inclusivo (<=). Reusa
// `Table` do shadcn-ui e `replayColumns` (ver replayColumns.tsx para porque NÃO
// reusamos as columns do Command Center).
export function ReplayRequestsTab({ events, cutoffTimestamp }: Props) {
	const rows = useMemo(
		() => sessionEventsToReplayRows(events, cutoffTimestamp),
		[events, cutoffTimestamp],
	);
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		data: rows,
		columns: replayColumns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (rows.length === 0) {
		return (
			<p className="p-3 text-muted-foreground text-sm">
				Nenhuma requisição capturada até este ponto da gravação.
			</p>
		);
	}

	return (
		<div className="overflow-auto rounded border">
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead key={h.id} style={{ width: h.column.getSize() }}>
									{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow key={row.id}>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
