'use client';

import * as React from 'react';
import {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState,
	flexRender,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { getStableFlatCoreRowModel } from './flatRequestRowModels';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	onSelect: (requestId: string) => void;
	onClearHistory?: () => void;
	selectedRowId?: string;
	/** Slot opcional para a barra de filtros — renderizado acima da tabela. */
	filterSlot?: React.ReactNode;
	/** Linhas que devem receber a classe pending-row-halo. */
	pendingRowIds?: Set<string>;
}

export function DataTable<TData extends { id: string }, TValue>({
	columns,
	data,
	onSelect,
	onClearHistory,
	selectedRowId,
	filterSlot,
	pendingRowIds,
}: DataTableProps<TData, TValue>) {
	// Estados para a tabela
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: 'timestamp', desc: true }, // Ordenar por timestamp decrescente por padrão
	]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
		requestType: false, // Ocultar a coluna 'requestType' por padrão
		mimeType: false, // Ocultar a coluna 'mimeType' por padrão
	});
	const [rowSelection, setRowSelection] = React.useState({});

	// Estado persistente para paginação
	const [pagination, setPagination] = React.useState({
		pageIndex: 0,
		pageSize: 10,
	});

	// Reset para página 0 só quando o dataset encolhe — mantém o intent original
	// ("filtro restritivo / clear history → vai pra página 0") mas evita yankar
	// o usuário ao receber requests live (always-live-tail).
	const previousLengthRef = React.useRef(data.length);
	React.useEffect(() => {
		const shrunk = previousLengthRef.current > data.length;
		previousLengthRef.current = data.length;
		if (shrunk) {
			setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
		}
	}, [data.length]);

	// Inicializa a tabela
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getStableFlatCoreRowModel(),
		getRowId: (row) => row.id,
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onPaginationChange: setPagination,
		columnResizeMode: 'onChange',
		autoResetPageIndex: false,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
		},
		meta: {
			onSelect,
		},
	});

	// Trava o pageIndex no último válido quando o dataset encolhe (ex.: limpar
	// histórico, filtro novo) — evita ficar "preso" numa página vazia.
	React.useEffect(() => {
		if (data.length > 0 && pagination.pageIndex > 0) {
			const maxPageIndex = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1);
			if (pagination.pageIndex > maxPageIndex) {
				setPagination((prev) => ({
					...prev,
					pageIndex: maxPageIndex,
				}));
			}
		}
	}, [data.length, pagination.pageIndex, pagination.pageSize]);

	return (
		<div className="space-y-4 flex flex-col min-h-0">
			<div className="flex flex-col sm:flex-row items-start justify-between gap-4 flex-shrink-0">
				<div className="flex w-full sm:flex-1 items-center gap-2">{filterSlot}</div>
				<div className="flex items-center gap-2">
					{onClearHistory && (
						<Button
							variant="outline"
							size="sm"
							onClick={onClearHistory}
							className="text-xs bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
						>
							<LucideIcon name="trash" className="h-4 w-4 mr-1" />
							Limpar Histórico
						</Button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="ml-auto">
								Colunas
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{table
								.getAllColumns()
								.filter((column) => column.getCanHide())
								.map((column) => {
									return (
										<DropdownMenuCheckboxItem
											key={column.id}
											className="capitalize"
											checked={column.getIsVisible()}
											onCheckedChange={(value) => column.toggleVisibility(!!value)}
										>
											{column.id === 'url'
												? 'URL'
												: column.id === 'method'
													? 'Método'
													: column.id === 'tipo'
														? 'Tipo'
														: column.id === 'statusCode'
															? 'Status Code'
															: column.id === 'requestType'
																? 'Request Type'
																: column.id === 'mimeType'
																	? 'MIME Type'
																	: column.id === 'timestamp'
																		? 'Horário'
																		: column.id === 'duration'
																			? 'Tempo'
																			: column.id === 'transferSize'
																				? 'Tamanho'
																				: column.id === 'actions'
																					? 'Ações'
																					: column.id}
										</DropdownMenuCheckboxItem>
									);
								})}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="rounded-md border overflow-auto data-table-container flex-1 min-h-0">
				<Table className="w-full table-fixed">
					<TableHeader className="sticky top-0 bg-background z-10">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										style={{
											width:
												header.column.getSize() !== 150
													? `${header.column.getSize()}px`
													: undefined,
										}}
									>
										{header.isPlaceholder
											? null
											: flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => {
								const rowRequestId: string = row.original.id;
								const isPendingRow = pendingRowIds?.has(rowRequestId) ?? false;
								return (
									<TableRow
										key={row.id}
										data-state={
											rowRequestId === selectedRowId
												? 'selected'
												: row.getIsSelected()
													? 'selected'
													: undefined
										}
										data-pending={isPendingRow ? 'true' : undefined}
										className="cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-accent data-[pending=true]:pending-row-halo"
										onClick={() => onSelect(rowRequestId)}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												style={{
													width:
														cell.column.getSize() !== 150
															? `${cell.column.getSize()}px`
															: undefined,
												}}
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										))}
									</TableRow>
								);
							})
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									Nenhuma requisição encontrada
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 flex-shrink-0">
				<div className="flex-1 text-sm text-muted-foreground">
					{table.getFilteredRowModel().rows.length} requisição(ões) encontrada(s).
				</div>
				<div className="flex flex-wrap items-center justify-end gap-4 sm:gap-6">
					<div className="flex items-center space-x-2">
						<p className="text-sm font-medium">Linhas por página</p>
						<select
							className="h-8 w-16 rounded-md border border-input bg-background px-2"
							value={table.getState().pagination.pageSize}
							onChange={(e) => {
								table.setPageSize(Number(e.target.value));
							}}
						>
							{[5, 10, 20, 30, 40, 50].map((pageSize) => (
								<option key={pageSize} value={pageSize}>
									{pageSize}
								</option>
							))}
						</select>
					</div>
					<div className="flex items-center space-x-2">
						<span className="text-sm font-medium">Página</span>
						<Input
							className="h-8 w-16 text-center"
							type="number"
							min={1}
							max={table.getPageCount()}
							value={table.getState().pagination.pageIndex + 1}
							onChange={(e) => {
								const page = e.target.value ? Number(e.target.value) - 1 : 0;
								if (page >= 0 && page < table.getPageCount()) {
									table.setPageIndex(page);
								}
							}}
						/>
						<span className="text-sm font-medium">de {table.getPageCount()}</span>
					</div>
					<div className="flex items-center space-x-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.setPageIndex(0)}
							disabled={!table.getCanPreviousPage()}
							className="h-8 w-8 p-0"
							aria-label="Ir para primeira página"
						>
							<LucideIcon name="chevrons-left" className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
							className="h-8 w-8 p-0"
							aria-label="Ir para página anterior"
						>
							<LucideIcon name="chevron-left" className="h-4 w-4" />
						</Button>

						{/* Números de página */}
						<div className="flex items-center space-x-1">
							{Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
								// Lógica para mostrar páginas ao redor da página atual
								let pageIndex: number;
								const currentPage = table.getState().pagination.pageIndex;
								const pageCount = table.getPageCount();

								if (pageCount <= 5) {
									// Se tiver 5 ou menos páginas, mostra todas
									pageIndex = i;
								} else if (currentPage <= 2) {
									// Se estiver nas primeiras páginas
									pageIndex = i;
								} else if (currentPage >= pageCount - 3) {
									// Se estiver nas últimas páginas
									pageIndex = pageCount - 5 + i;
								} else {
									// Se estiver no meio, mostra 2 antes e 2 depois
									pageIndex = currentPage - 2 + i;
								}

								const isCurrentPage = pageIndex === currentPage;

								return (
									<Button
										key={pageIndex}
										variant={isCurrentPage ? 'default' : 'outline'}
										size={isCurrentPage ? 'default' : 'sm'}
										onClick={() => table.setPageIndex(pageIndex)}
										className={`${isCurrentPage ? 'h-10 w-10 shadow-md' : 'h-8 w-8'} p-0 ${
											isCurrentPage
												? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary ring-offset-2 scale-110 z-10'
												: ''
										}`}
									>
										{pageIndex + 1}
									</Button>
								);
							})}
						</div>

						<Button
							variant="outline"
							size="sm"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
							className="h-8 w-8 p-0"
							aria-label="Ir para próxima página"
						>
							<LucideIcon name="chevron-right" className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.setPageIndex(table.getPageCount() - 1)}
							disabled={!table.getCanNextPage()}
							className="h-8 w-8 p-0"
							aria-label="Ir para última página"
						>
							<LucideIcon name="chevrons-right" className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
