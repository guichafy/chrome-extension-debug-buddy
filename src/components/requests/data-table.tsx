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
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Icon } from "@/components/ui/icon"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onSelect: (requestId: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  pauseAutoRefresh?: () => void
  autoRefreshEnabled?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onSelect,
  searchValue,
  onSearchChange,
  pauseAutoRefresh,
  autoRefreshEnabled
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true } // Ordenar por timestamp decrescente por padrão
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  
  // Estado para controlar se a página foi alterada manualmente pelo usuário
  const [userChangedPage, setUserChangedPage] = React.useState(false);
  // Referência para armazenar a última página selecionada pelo usuário
  const lastSelectedPageRef = React.useRef(0);
  // Referência para armazenar o último número total de páginas
  const lastPageCountRef = React.useRef(0);

  // Função para filtrar dados considerando múltiplos campos
  const filterData = React.useCallback((rows: TData[]) => {
    if (!searchValue) return rows;
    
    const searchLower = searchValue.toLowerCase();
    
    // @ts-ignore - Necessário para acessar a estrutura específica dos dados
    return rows.filter((row: any) => {
      const request = row.request;
      if (!request) return false;
      
      // Verificar cada campo relevante
      return (
        (request.url && request.url.toLowerCase().includes(searchLower)) ||
        (request.method && request.method.toLowerCase().includes(searchLower)) ||
        (request.status && String(request.status).includes(searchLower)) ||
        (request.statusText && request.statusText.toLowerCase().includes(searchLower)) ||
        (request.type && request.type.toLowerCase().includes(searchLower)) ||
        (request.mimeType && request.mimeType.toLowerCase().includes(searchLower))
      );
    });
  }, [searchValue]);
  
  // Aplicar filtro personalizado
  React.useEffect(() => {
    // Adicionar um filtro global que usa nossa função personalizada
    setColumnFilters([{ id: 'global', value: searchValue }]);
  }, [searchValue, filterData]);
  
  // Função para atualizar a página com controle de estado
  const updatePageIndex = (newPageIndex: number) => {
    setUserChangedPage(true);
    lastSelectedPageRef.current = newPageIndex;
    setPagination(prev => ({
      ...prev,
      pageIndex: newPageIndex
    }));
  };
  
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
  })
  
  // Efeito para manter o usuário na página desejada quando os dados mudam
  React.useEffect(() => {
    const totalPages = table.getPageCount();
    
    // Armazenar o número total de páginas para comparação
    const pageCountChanged = lastPageCountRef.current !== totalPages;
    lastPageCountRef.current = totalPages;
    
    // Se o usuário mudou de página manualmente, mantém na página selecionada
    if (userChangedPage) {
      // Se a página atual é maior que o total de páginas disponíveis
      if (lastSelectedPageRef.current >= totalPages && totalPages > 0) {
        // Ajusta para a última página disponível
        setPagination(prev => ({
          ...prev,
          pageIndex: totalPages - 1
        }));
      } else if (lastSelectedPageRef.current >= 0) {
        // Mantém o usuário na página que ele selecionou anteriormente
        setPagination(prev => ({
          ...prev,
          pageIndex: lastSelectedPageRef.current
        }));
      }
    }
  }, [data, table.getPageCount(), userChangedPage]);
  
  // Efeito para atualizar a referência quando a paginação muda
  React.useEffect(() => {
    // Armazena o índice da página atual
    lastSelectedPageRef.current = pagination.pageIndex;
    // Reseta a flag após aplicar a mudança
    if (userChangedPage) {
      setUserChangedPage(false);
    }
  }, [pagination.pageIndex, userChangedPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Pesquisar em qualquer campo..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="max-w-sm"
          />
        </div>
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
                     column.id === "status" ? "Status" :
                     column.id === "statusCode" ? "Status Code" :
                     column.id === "type" ? "Tipo" :
                     column.id === "mimeType" ? "MIME Type" :
                     column.id === "timestamp" ? "Horário" :
                     column.id === "actions" ? "Ações" : column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => {
                    // @ts-ignore - Acessar o ID da requisição
                    const requestId = row.original.id;
                    onSelect(requestId);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} requisição(ões) encontrada(s).
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Linhas por página</p>
            <select
              className="h-8 w-16 rounded-md border border-input bg-background px-2"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                if (pauseAutoRefresh) pauseAutoRefresh();
                // Ao mudar o tamanho da página, mantém o usuário na mesma página
                const newSize = Number(e.target.value);
                const currentPage = table.getState().pagination.pageIndex;
                
                // Atualiza o tamanho da página
                setPagination(prev => ({
                  ...prev,
                  pageSize: newSize,
                  pageIndex: currentPage
                }));
                
                // Marca que o usuário quer permanecer na página atual
                setUserChangedPage(true);
                lastSelectedPageRef.current = currentPage;
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
              className="h-8 w-12 text-center"
              type="number"
              min={1}
              max={table.getPageCount()}
              value={table.getState().pagination.pageIndex + 1}
              onChange={(e) => {
                if (pauseAutoRefresh) pauseAutoRefresh();
                const page = e.target.value ? Number(e.target.value) - 1 : 0;
                if (page >= 0 && page < table.getPageCount()) {
                  updatePageIndex(page);
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
                if (pauseAutoRefresh) pauseAutoRefresh();
                updatePageIndex(0);
              }}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Ir para primeira página</span>
              <Icon name="first_page" className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pauseAutoRefresh) pauseAutoRefresh();
                updatePageIndex(table.getState().pagination.pageIndex - 1);
              }}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Ir para página anterior</span>
              <Icon name="navigate_before" className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pauseAutoRefresh) pauseAutoRefresh();
                updatePageIndex(table.getState().pagination.pageIndex + 1);
              }}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Ir para próxima página</span>
              <Icon name="navigate_next" className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pauseAutoRefresh) pauseAutoRefresh();
                updatePageIndex(table.getPageCount() - 1);
              }}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Ir para última página</span>
              <Icon name="last_page" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
