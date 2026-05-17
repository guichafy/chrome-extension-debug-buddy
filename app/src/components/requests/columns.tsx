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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InterceptedResponse } from '../../types/intercepted';
import { compareDurations, formatDurationWithMock, getDurationColorClass } from './duration';
import { getTransferSizeTooltip } from './transferSize';
import { formatBytes } from '@/components/layout/networkMetricsFormat';
import { getRequestState } from '@/lib/requestState';
import { getAppliedTypeBadgeMeta, getAppliedTypes } from '@/lib/appliedType';
import { cn } from '@/lib/utils';

// Tipo para representar uma requisição
export type RequestRow = {
	id: string;
	request: InterceptedResponse;
};

// Largura fixa da coluna URL (px). Single source of truth — usada tanto no
// `size` da column quanto no `maxWidth` inline do span filho, garantindo
// que o `truncate` use exatamente a largura da TD.
const URL_COLUMN_WIDTH = 500;

export const columns: ColumnDef<RequestRow>[] = [
	// Coluna "Tipo" (primeira da tabela): exibe os tipos de regra efetivamente
	// aplicados (Proxy/Mock/Transform/Breakpoint/Latência). Pode haver mais de
	// um por request (ex: Mock+Latência) — badges icon-only + tooltip preservam
	// a largura. O badge "editada" entra aqui também, no mesmo padrão visual,
	// já que a coluna Estado foi removida (redundante com Status Code).
	{
		id: 'tipo',
		accessorFn: (row) => getAppliedTypes(row.request)[0],
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
			const a = getAppliedTypes(rowA.original.request)[0];
			const b = getAppliedTypes(rowB.original.request)[0];
			return (a ?? 'proxy').localeCompare(b ?? 'proxy');
		},
		cell: ({ row }) => {
			const request = row.original.request;
			const types = getAppliedTypes(request);
			return (
				<TooltipProvider delayDuration={150}>
					<div className="flex flex-wrap items-center gap-1">
						{types.map((type) => {
							const meta = getAppliedTypeBadgeMeta(type);
							return (
								<Tooltip key={type}>
									<TooltipTrigger asChild>
										<Badge
											variant={meta.variant}
											aria-label={meta.label}
											data-testid={`applied-type-badge-${type}-${row.original.id}`}
											className={cn(
												'text-xs whitespace-nowrap inline-flex items-center justify-center px-1.5 py-0.5',
												meta.colorClass,
											)}
										>
											<LucideIcon name={meta.iconName} className="h-3 w-3" />
											<span className="sr-only">{meta.label}</span>
										</Badge>
									</TooltipTrigger>
									<TooltipContent>{meta.label}</TooltipContent>
								</Tooltip>
							);
						})}
						{request.editedAtRuntime === true && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="outline"
										aria-label="Editada em runtime"
										data-testid={`edited-runtime-badge-${row.original.id}`}
										className="text-xs whitespace-nowrap inline-flex items-center justify-center px-1.5 py-0.5 border-info/40 text-info"
									>
										<LucideIcon name="edit" className="h-3 w-3" />
										<span className="sr-only">Editada em runtime</span>
									</Badge>
								</TooltipTrigger>
								<TooltipContent>Editada em runtime</TooltipContent>
							</Tooltip>
						)}
					</div>
				</TooltipProvider>
			);
		},
		size: 60,
	},
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
			const request = row.original.request;
			const ts = request.networkTiming?.transferSize;
			const tooltip = getTransferSizeTooltip(request);
			const span = (
				<span className="font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">
					{ts === undefined ? '—' : formatBytes(ts)}
				</span>
			);
			if (tooltip === undefined) return span;
			return (
				<TooltipProvider delayDuration={150}>
					<Tooltip>
						<TooltipTrigger asChild>
							<span
								className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4"
								data-testid={`transfer-size-tooltip-${row.original.id}`}
							>
								{span}
							</span>
						</TooltipTrigger>
						<TooltipContent>{tooltip}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			);
		},
		size: 90,
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
			// Combina estado (failed/modified pintam border) e mock (border
			// primary). Pending tem o halo respirando da linha no data-table,
			// então não precisa de border aqui. Uso `isMocked` direto em vez
			// de derivar `getAppliedTypes(...).includes('mock')` — evita uma
			// chamada redundante por linha.
			const state = getRequestState(request);
			let borderClass = '';
			if (state === 'failed') {
				borderClass = 'border-l-2 border-l-destructive pl-2';
			} else if (state === 'modified') {
				borderClass = 'border-l-2 border-l-info pl-2';
			} else if (request.isMocked === true) {
				borderClass = 'border-l-2 border-l-primary pl-2';
			}
			return (
				<span className={cn('truncate block', borderClass)} style={{ maxWidth: URL_COLUMN_WIDTH }}>
					{request.url}
				</span>
			);
		},
		size: URL_COLUMN_WIDTH,
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
