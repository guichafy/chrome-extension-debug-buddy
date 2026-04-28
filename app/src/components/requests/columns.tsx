'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InterceptedResponse } from '../../hooks/useResponses';
import {
	compareDurations,
	formatDuration,
	formatDurationWithMock,
	getDurationColorClass,
} from './duration';

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
			const requestA = rowA.original.request;
			const requestB = rowB.original.request;

			// Definir prioridade para ordenação
			const getPriority = (request: InterceptedResponse) => {
				if (request.captureError) return 0; // Falha de captura
				if (request.isWaiting) return 1; // Aguardando
				if (request.isWaiting === false) return 2; // Interceptado
				if (request.isMocked) return 3; // Mockado
				return 4; // Proxy
			};

			return getPriority(requestA) - getPriority(requestB);
		},
		cell: ({ row }) => {
			const request = row.original.request;
			const isIntercepted = !!request.isWaiting;
			const wasIntercepted = request.isWaiting === false;
			const isMocked = request.isMocked === true;
			const hasCaptureError = !!request.captureError;

			let variant: 'destructive' | 'default' | 'outline' | 'secondary' = 'outline';
			let label = 'Proxy';
			let iconName: LucideIconName = 'check-circle';

			if (hasCaptureError) {
				variant = 'destructive';
				label = 'Falha';
				iconName = 'alert-triangle';
			} else if (isIntercepted) {
				variant = 'destructive';
				label = 'Aguardando';
				iconName = 'hourglass';
			} else if (wasIntercepted) {
				variant = 'default';
				label = 'Modificado';
				iconName = 'edit';
			} else if (isMocked) {
				variant = 'secondary';
				label = 'Mockado';
				iconName = 'copy';
			}

			return (
				<Badge
					variant={variant}
					className="text-xs whitespace-nowrap inline-flex items-center gap-1"
				>
					<LucideIcon name={iconName} className="h-3 w-3" />
					{label}
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
			const isIntercepted = !!request.isWaiting;
			const wasIntercepted = request.isWaiting === false;
			const isMocked = request.isMocked === true;
			const hasCaptureError = !!request.captureError;

			// Adicionar uma classe de borda à esquerda para indicar o status
			let borderClass = '';
			if (hasCaptureError) {
				borderClass = 'border-l-2 border-l-red-500 pl-2';
			} else if (isIntercepted) {
				borderClass = 'border-l-2 border-l-red-500 pl-2';
			} else if (wasIntercepted) {
				borderClass = 'border-l-2 border-l-blue-500 pl-2';
			} else if (isMocked) {
				borderClass = 'border-l-2 border-l-purple-500 pl-2';
			}

			return <span className={`truncate block max-w-[300px] ${borderClass}`}>{request.url}</span>;
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
