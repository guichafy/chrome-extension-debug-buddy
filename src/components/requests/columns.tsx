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

      return <span className="text-xs text-muted-foreground whitespace-nowrap">
        {`${hours}:${minutes}:${seconds}.${milliseconds}`}
      </span>;
    },
    size: 120,
  },
  {
    accessorKey: "duration",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Tempo
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    sortingFn: (rowA, rowB) => {
      const requestIdA = rowA.original.id;
      const requestIdB = rowB.original.id;

      // Gerar valores de tempo de resposta simulados com base nos IDs
      const hashA = requestIdA.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hashB = requestIdB.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

      const responseTimeA = 50 + (hashA % 1950);
      const responseTimeB = 50 + (hashB % 1950);

      return responseTimeA - responseTimeB;
    },
    cell: ({ row }) => {
      const request = row.original.request;
      const requestId = row.original.id;

      // Gerar um tempo de resposta simulado com base no ID da requisição
      // Isso garante que o mesmo ID sempre terá o mesmo tempo de resposta
      const hash = requestId.split('').reduce((acc, char) => {
        return acc + char.charCodeAt(0);
      }, 0);

      // Gerar um valor entre 50ms e 2000ms
      const responseTime = 50 + (hash % 1950);

      // Formatar o tempo de resposta
      let formattedTime = '';
      if (responseTime < 1000) {
        // Menos de 1 segundo
        formattedTime = `${responseTime}ms`;
      } else {
        // Mais de 1 segundo
        const seconds = Math.floor(responseTime / 1000);
        const ms = responseTime % 1000;
        formattedTime = `${seconds}s ${ms}ms`;
      }

      // Adicionar classe de cor com base no tempo de resposta
      let colorClass = 'text-green-600';
      if (responseTime > 1000) {
        colorClass = 'text-amber-600';
      } else if (responseTime > 500) {
        colorClass = 'text-yellow-600';
      }

      return <span className={`text-xs font-medium ${colorClass} whitespace-nowrap`}>{formattedTime}</span>;
    },
    size: 80,
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Tipo
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    sortingFn: (rowA, rowB) => {
      const requestA = rowA.original.request;
      const requestB = rowB.original.request;

      // Definir prioridade para ordenação
      const getPriority = (request: InterceptedResponse) => {
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

      let variant: "destructive" | "default" | "outline" | "secondary" = "outline";
      let label = "Proxy";

      if (isIntercepted) {
        variant = "destructive";
        label = "Aguardando";
      } else if (wasIntercepted) {
        variant = "default";
        label = "Interceptado";
      } else if (isMocked) {
        variant = "secondary";
        label = "Mockado";
      }

      return (
        <Badge
          variant={variant}
          className="text-xs whitespace-nowrap"
        >
          {label}
        </Badge>
      );
    },
    size: 100,
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
    sortingFn: (rowA, rowB) => {
      const methodA = rowA.original.request.method || 'GET';
      const methodB = rowB.original.request.method || 'GET';
      return methodA.localeCompare(methodB);
    },
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="font-medium whitespace-nowrap">{request.method || 'GET'}</span>;
    },
    size: 80,
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
    sortingFn: (rowA, rowB) => {
      const urlA = rowA.original.request.url.toLowerCase();
      const urlB = rowB.original.request.url.toLowerCase();
      return urlA.localeCompare(urlB);
    },
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="truncate block max-w-[300px]">{request.url}</span>;
    },
    size: 300,
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
    sortingFn: (rowA, rowB) => {
      const statusA = rowA.original.request.status || 0;
      const statusB = rowB.original.request.status || 0;
      return statusA - statusB;
    },
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="whitespace-nowrap">{request.status} {request.statusText}</span>;
    },
    size: 120,
  },
  {
    accessorKey: "requestType",
    header: "Request Type",
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="whitespace-nowrap">{request.type}</span>;
    },
    size: 80,
  },
  {
    accessorKey: "mimeType",
    header: "MIME Type",
    cell: ({ row }) => {
      const request = row.original.request;
      return <span className="text-xs text-muted-foreground whitespace-nowrap">{request.mimeType}</span>;
    },
    size: 100,
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
    size: 50,
  },
]
