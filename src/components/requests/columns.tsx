"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InterceptedResponse } from "../../hooks/useResponses"

// Tipo para representar uma requisição
export type RequestRow = {
  id: string;
  request: InterceptedResponse;
};

export const columns: ColumnDef<RequestRow>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const request = row.original.request;
      const isIntercepted = !!request.isWaiting;
      const wasIntercepted = request.isWaiting === false;

      return (
        <Badge 
          variant={isIntercepted ? "destructive" : wasIntercepted ? "default" : "outline"} 
          className="text-xs"
        >
          {isIntercepted ? "Aguardando" : wasIntercepted ? "Interceptado" : "Observado"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "method",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Método
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="font-medium">{request.method || 'GET'}</span>;
    },
  },
  {
    accessorKey: "url",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          URL
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="truncate block max-w-[400px]">{request.url}</span>;
    },
  },
  {
    accessorKey: "statusCode",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Status Code
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const request = row.original.request;
      return <span>{request.status} {request.statusText}</span>;
    },
  },
  {
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => {
      const request = row.original.request;
      return <span>{request.type}</span>;
    },
  },
  {
    accessorKey: "mimeType",
    header: "MIME Type",
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="text-xs text-muted-foreground">{request.mimeType}</span>;
    },
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Horário
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const request = row.original.request;
      const date = new Date(request.timestamp);
      return <span className="text-xs text-muted-foreground">
        {date.toLocaleTimeString()}
      </span>;
    },
  },
  {
    id: "actions",
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
            <DropdownMenuItem onClick={() => onSelect(requestId)}>
              Ver detalhes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
