"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/shadcn/table"

import { Button } from "@/ui/components/shadcn/button"
import { Input } from "@/ui/components/shadcn/input"
import { Icon } from "@/ui/components/shadcn/icon"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/components/shadcn/dropdown-menu"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onSelect: (requestId: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  pauseAutoRefresh?: () => void
  enableAutoRefresh?: () => void
  autoRefreshEnabled?: boolean
  onClearHistory?: () => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onSelect,
  searchValue,
  onSearchChange,
  pauseAutoRefresh,
  enableAutoRefresh,
  autoRefreshEnabled,
  onClearHistory
}: DataTableProps<TData, TValue>) {
  // Estados para a tabela
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true } // Ordenar por timestamp decrescente por padrão
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    requestType: false // Ocultar a coluna 'requestType' por padrão
  })
  const [rowSelection, setRowSelection] = React.useState({})

  // Estado persistente para paginação
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Ref para armazenar o estado da paginação atual
  const paginationRef = React.useRef(pagination)

  // Estado para o filtro global
  const [globalFilter, setGlobalFilter] = React.useState(searchValue)

  // Atualizar o filtro global quando o valor de pesquisa mudar
  React.useEffect(() => {
    setGlobalFilter(searchValue)
  }, [searchValue])

  // Definir visibilidade inicial das colunas
  React.useEffect(() => {
    // Em telas menores, ocultar algumas colunas menos importantes
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      setColumnVisibility({
        ...columnVisibility,
        mimeType: false,
      })
    }
  }, [])

  // Atualizar a ref quando a paginação mudar
  React.useEffect(() => {
    paginationRef.current = pagination
  }, [pagination])

  // Função para pausar o auto-refresh quando necessário
  const handlePauseAutoRefresh = React.useCallback(() => {
    if (pauseAutoRefresh) {
      pauseAutoRefresh()
    }
  }, [pauseAutoRefresh])

  // Inicializa a tabela
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    columnResizeMode: "onChange",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter,
    },
    meta: {
      onSelect,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      // Se não houver valor de filtro, retorna true
      if (!filterValue) return true

      const searchLower = String(filterValue).toLowerCase()

      // @ts-ignore - Acessar a estrutura específica dos dados
      const request = row.original?.request
      if (!request) return false

      // Verificar cada campo relevante
      return (
        (request.url && request.url.toLowerCase().includes(searchLower)) ||
        (request.method && request.method.toLowerCase().includes(searchLower)) ||
        (request.status && String(request.status).includes(searchLower)) ||
        (request.statusText && request.statusText.toLowerCase().includes(searchLower)) ||
        (request.type && request.type.toLowerCase().includes(searchLower)) ||
        (request.mimeType && request.mimeType.toLowerCase().includes(searchLower))
      )
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  // Simplificado para evitar problemas de roteamento
  React.useEffect(() => {
    if (data.length > 0 && autoRefreshEnabled && pagination.pageIndex > 0) {
      const maxPageIndex = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1)
      if (pagination.pageIndex > maxPageIndex) {
        setPagination(prev => ({
          ...prev,
          pageIndex: maxPageIndex
        }))
      }
    }
  }, [data.length, autoRefreshEnabled, pagination.pageIndex, pagination.pageSize])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex w-full sm:w-auto items-center gap-2">
          <Input
            placeholder="Pesquisar em qualquer campo..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full sm:max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {autoRefreshEnabled && pauseAutoRefresh ? (
            <Button
              variant="outline"
              size="sm"
              onClick={pauseAutoRefresh}
              className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Icon name="fiber_manual_record" className="h-4 w-4 mr-1 text-green-500 animate-pulse" />
              Live Tail
            </Button>
          ) : !autoRefreshEnabled && enableAutoRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={enableAutoRefresh}
              className="text-xs bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            >
              <Icon name="refresh" className="h-4 w-4 mr-1" />
              Ativar Auto-Refresh
            </Button>
          )}
          {onClearHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handlePauseAutoRefresh()
                onClearHistory()
              }}
              className="text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <Icon name="delete" className="h-4 w-4 mr-1" />
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
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id === "url" ? "URL" :
                     column.id === "method" ? "Método" :
                     column.id === "status" ? "Tipo" :
                     column.id === "statusCode" ? "Status Code" :
                     column.id === "requestType" ? "Request Type" :
                     column.id === "mimeType" ? "MIME Type" :
                     column.id === "timestamp" ? "Horário" :
                     column.id === "duration" ? "Tempo" :
                     column.id === "actions" ? "Ações" : column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto data-table-container">
        <Table className="w-full table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: header.column.getSize() !== 150 ? `${header.column.getSize()}px` : undefined,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    // @ts-ignore - Acessar o ID da requisição
                    const requestId = row.original.id
                    onSelect(requestId)
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
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
                handlePauseAutoRefresh()
                table.setPageSize(Number(e.target.value))
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
                handlePauseAutoRefresh()
                const page = e.target.value ? Number(e.target.value) - 1 : 0
                if (page >= 0 && page < table.getPageCount()) {
                  table.setPageIndex(page)
                }
              }}
            />
            <span className="text-sm font-medium">de {table.getPageCount()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handlePauseAutoRefresh()
                table.setPageIndex(0)
              }}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
              aria-label="Ir para primeira página"
            >
              <Icon name="first_page" className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handlePauseAutoRefresh()
                table.previousPage()
              }}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
              aria-label="Ir para página anterior"
            >
              <Icon name="navigate_before" className="h-4 w-4" />
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
                    variant={isCurrentPage ? "default" : "outline"}
                    size={isCurrentPage ? "default" : "sm"}
                    onClick={() => {
                      handlePauseAutoRefresh()
                      table.setPageIndex(pageIndex)
                    }}
                    className={`${isCurrentPage ? "h-10 w-10 shadow-md" : "h-8 w-8"} p-0 ${
                      isCurrentPage
                        ? "bg-primary text-primary-foreground font-bold ring-2 ring-primary ring-offset-2 scale-110 z-10"
                        : ""
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
              onClick={() => {
                handlePauseAutoRefresh()
                table.nextPage()
              }}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
              aria-label="Ir para próxima página"
            >
              <Icon name="navigate_next" className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handlePauseAutoRefresh()
                table.setPageIndex(table.getPageCount() - 1)
              }}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
              aria-label="Ir para última página"
            >
              <Icon name="last_page" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
