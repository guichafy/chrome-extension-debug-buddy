'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InterceptedResponse } from '../../hooks/useResponses';
import { compareDurations, formatDurationWithMock, getDurationColorClass } from './duration';
import { formatBytes } from '@/components/layout/networkMetricsFormat';
import { getRequestState, getStateBadgeMeta, getStatePriority } from '@/lib/requestState';
import { cn } from '@/lib/utils';

// Tipo para representar uma requisição
export type RequestRow = {
	id: string;
	request: InterceptedResponse;
};

export const columns: ColumnDef<RequestRow>[] = [
	{
		accessorKey: 'timestamp',
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					Horário
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			const timestampA = rowA.original.request.timestamp;
			const timestampB = rowB.original.request.timestamp;
			return timestampA - timestampB;
		},
		cell: ({ row }) => {
			const request = row.original.request;
			const date = new Date(request.timestamp);
			// Formatação personalizada para incluir milissegundos
			const hours = date.getHours().toString().padStart(2, '0');
			const minutes = date.getMinutes().toString().padStart(2, '0');
			const seconds = date.getSeconds().toString().padStart(2, '0');
			const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

			return (
				<span className="text-xs text-muted-foreground whitespace-nowrap">
					{`${hours}:${minutes}:${seconds}.${milliseconds}`}
				</span>
			);
		},
		size: 120,
	},
	{
		accessorKey: 'duration',
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					Tempo
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			return compareDurations(rowA.original.request.duration, rowB.original.request.duration);
		},
		cell: ({ row }) => {
			const duration = row.original.request.duration;
			const mockLatencyMs = row.original.request.mockLatencyMs;
			const colorClass = getDurationColorClass(duration);
			return (
				<span className={`text-xs font-medium ${colorClass} whitespace-nowrap`}>
					{formatDurationWithMock(duration, mockLatencyMs)}
				</span>
			);
		},
		size: 80,
	},
	{
		// Coluna 'transferSize' — bytes baixados via rede (CDP encodedDataLength).
		// Quando o request veio do cache OU é mock OU não passou por Network domain,
		// transferSize é undefined — mostramos "—" (regra de no-fallback).
		// O sort é numérico explícito; undefined vai pro fim.
		id: 'transferSize',
		accessorFn: (row) => row.request.networkTiming?.transferSize,
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					Tamanho
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			const a = rowA.original.request.networkTiming?.transferSize;
			const b = rowB.original.request.networkTiming?.transferSize;
			if (a === undefined && b === undefined) return 0;
			if (a === undefined) return 1; // undefined sempre no fim, indep. de direção
			if (b === undefined) return -1;
			return a - b;
		},
		cell: ({ row }) => {
			const ts = row.original.request.networkTiming?.transferSize;
			return (
				<span className="font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">
					{ts === undefined ? '—' : formatBytes(ts)}
				</span>
			);
		},
		size: 90,
	},
	{
		accessorKey: 'status',
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					Tipo
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			return (
				getStatePriority(getRequestState(rowA.original.request)) -
				getStatePriority(getRequestState(rowB.original.request))
			);
		},
		cell: ({ row }) => {
			const meta = getStateBadgeMeta(getRequestState(row.original.request));
			return (
				<Badge
					variant={meta.variant}
					className={cn(
						'text-xs whitespace-nowrap inline-flex items-center gap-1',
						meta.pulse && 'animate-pulse',
					)}
				>
					<LucideIcon name={meta.iconName} className="h-3 w-3" />
					{meta.label}
				</Badge>
			);
		},
		size: 100,
	},
	{
		accessorKey: 'method',
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					Método
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			const methodA = rowA.original.request.method ?? '';
			const methodB = rowB.original.request.method ?? '';
			return methodA.localeCompare(methodB);
		},
		cell: ({ row }) => {
			const request = row.original.request;
			return (
				<span className="font-medium whitespace-nowrap">{request.method ?? 'Método ausente'}</span>
			);
		},
		size: 80,
	},
	{
		accessorKey: 'url',
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					URL
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			const urlA = rowA.original.request.url.toLowerCase();
			const urlB = rowB.original.request.url.toLowerCase();
			return urlA.localeCompare(urlB);
		},
		cell: ({ row }) => {
			const request = row.original.request;
			// Para state=pending o halo respirando da linha (pending-row-halo no
			// data-table) já cobre o destaque — pending/proxy ficam sem borda aqui.
			const borderClassByState = {
				failed: 'border-l-2 border-l-destructive pl-2',
				modified: 'border-l-2 border-l-info pl-2',
				mocked: 'border-l-2 border-l-primary pl-2',
				pending: '',
				proxy: '',
			} as const;
			const borderClass = borderClassByState[getRequestState(request)];
			return <span className={cn('truncate block max-w-[300px]', borderClass)}>{request.url}</span>;
		},
		size: 300,
	},
	{
		accessorKey: 'statusCode',
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
					className="pl-0"
				>
					Status Code
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		sortingFn: (rowA, rowB) => {
			const statusA = rowA.original.request.status;
			const statusB = rowB.original.request.status;
			if (typeof statusA !== 'number' && typeof statusB !== 'number') return 0;
			if (typeof statusA !== 'number') return 1;
			if (typeof statusB !== 'number') return -1;
			return statusA - statusB;
		},
		cell: ({ row }) => {
			const request = row.original.request;
			return (
				<span className="whitespace-nowrap">
					{typeof request.status === 'number' ? request.status : 'Status ausente'}{' '}
					{request.statusText}
				</span>
			);
		},
		size: 120,
	},
	{
		accessorKey: 'requestType',
		header: 'Request Type',
		cell: ({ row }) => {
			const request = row.original.request;
			return <span className="whitespace-nowrap">{request.type}</span>;
		},
		size: 80,
	},
	{
		accessorKey: 'mimeType',
		header: 'MIME Type',
		cell: ({ row }) => {
			const request = row.original.request;
			return (
				<span className="text-xs text-muted-foreground whitespace-nowrap">
					{request.mimeType ?? 'Sem Content-Type'}
				</span>
			);
		},
		size: 100,
	},
	{
		id: 'actions',
		cell: ({ row, table }) => {
			const requestId = row.original.id;
			// Acessar as funções através do meta do table
			const { onSelect } = table.options.meta as { onSelect: (requestId: string) => void };

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Abrir menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Ações</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => onSelect(requestId)}>Ver detalhes</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		size: 50,
	},
];
