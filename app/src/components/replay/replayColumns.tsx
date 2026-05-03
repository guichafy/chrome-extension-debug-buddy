import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReplayRequestRow } from '@/lib/session/sessionNetworkAdapter';
import { cn } from '@/lib/utils';
import { compareDurations, formatDuration, getDurationColorClass } from '../requests/duration';

const URL_COLUMN_WIDTH = 460;

// Colunas dedicadas ao Replay — subset do Command Center. SessionEvent network
// não armazena todos os campos do InterceptedResponse (transferSize, mimeType,
// isMocked, type), então ostentamos só o que temos honestamente.
export const replayColumns: ColumnDef<ReplayRequestRow>[] = [
	{
		accessorKey: 'timestamp',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Horário
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		sortingFn: (a, b) => a.original.timestamp - b.original.timestamp,
		cell: ({ row }) => {
			const date = new Date(row.original.timestamp);
			const hh = date.getHours().toString().padStart(2, '0');
			const mm = date.getMinutes().toString().padStart(2, '0');
			const ss = date.getSeconds().toString().padStart(2, '0');
			const ms = date.getMilliseconds().toString().padStart(3, '0');
			return (
				<span className="text-xs text-muted-foreground whitespace-nowrap">
					{`${hh}:${mm}:${ss}.${ms}`}
				</span>
			);
		},
		size: 110,
	},
	{
		accessorKey: 'durationMs',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Tempo
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		sortingFn: (a, b) => compareDurations(a.original.durationMs, b.original.durationMs),
		cell: ({ row }) => {
			const d = row.original.durationMs;
			const color = getDurationColorClass(d);
			return (
				<span className={cn('text-xs font-medium whitespace-nowrap', color)}>
					{formatDuration(d)}
				</span>
			);
		},
		size: 80,
	},
	{
		accessorKey: 'method',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Método
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.method}</span>,
		size: 80,
	},
	{
		accessorKey: 'url',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				URL
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => (
			<span className="truncate block" style={{ maxWidth: URL_COLUMN_WIDTH }}>
				{row.original.url}
			</span>
		),
		size: URL_COLUMN_WIDTH,
	},
	{
		accessorKey: 'status',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Status
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => <span className="whitespace-nowrap">{row.original.status}</span>,
		size: 80,
	},
	{
		id: 'client',
		accessorFn: (row) => row.client,
		header: 'Client',
		cell: ({ row }) => {
			const c = row.original.client;
			if (!c) return <span className="text-muted-foreground">—</span>;
			const cs = row.original.callsiteFile;
			return cs ? (
				<TooltipProvider delayDuration={150}>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="text-xs underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 cursor-help">
								{c}
							</span>
						</TooltipTrigger>
						<TooltipContent>{cs}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			) : (
				<span className="text-xs">{c}</span>
			);
		},
		size: 90,
	},
];
