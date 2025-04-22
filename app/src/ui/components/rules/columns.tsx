"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Edit, MoreHorizontal } from "lucide-react"
import { Button } from "@/ui/components/shadcn/button"
import { Icon } from "@/ui/components/shadcn/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/shadcn/dropdown-menu"
import { UrlPattern } from "../../hooks/useUrlPatterns"

// Tipo para representar uma regra (que pode ser uma string ou um objeto UrlPattern)
export type Rule = string | UrlPattern;

export const columns: ColumnDef<Rule>[] = [
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
      const rule = row.original;
      return typeof rule === 'string' ? rule : rule.url;
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
          Método HTTP
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const rule = row.original;
      return typeof rule === 'string' ? 'ANY' : (rule.method || 'ANY');
    },
  },
  {
    accessorKey: "header",
    header: "Header",
    cell: ({ row }) => {
      const rule = row.original;
      if (typeof rule === 'string' || !rule.headerName || !rule.headerValue) {
        return "-";
      }
      return `${rule.headerName}: ${rule.headerValue}`;
    },
  },
  {
    accessorKey: "headerType",
    header: "Tipo de Header",
    cell: ({ row }) => {
      const rule = row.original;
      if (typeof rule === 'string' || !rule.headerType) {
        return "-";
      }
      return rule.headerType === 'request' ? 'Request' : 'Response';
    },
  },
  {
    accessorKey: "isRegex",
    header: "Tipo de URL",
    cell: ({ row }) => {
      const rule = row.original;
      if (typeof rule === 'string' || rule.isRegex === undefined) {
        return "Texto simples";
      }
      return rule.isRegex ? 'Expressão Regular' : 'Texto simples';
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row, table }) => {
      const rule = row.original;
      const { onToggle } = table.options.meta as { onToggle?: (index: number) => Promise<boolean> };

      if (!onToggle) return null;

      const isEnabled = typeof rule === 'string' ? true : (rule.enabled !== false);

      return (
        <Button
          variant={isEnabled ? "default" : "outline"}
          size="sm"
          className={`px-2 py-1 h-8 ${isEnabled ? 'bg-green-500 hover:bg-green-600' : 'text-gray-500'}`}
          onClick={() => onToggle(row.index)}
        >
          {isEnabled ? 'Ativo' : 'Inativo'}
        </Button>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const rule = row.original;
      // Acessar as funções através do meta do table
      const {
        onRemove,
        onEdit
      } = table.options.meta as {
        onRemove: (index: number) => void,
        onEdit?: (index: number, rule: UrlPattern) => Promise<boolean>
      };

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
            {onEdit && (
              <DropdownMenuItem
                onClick={() => {
                  const index = row.index;
                  // Converter string para objeto UrlPattern se necessário
                  const ruleObj = typeof rule === 'string'
                    ? { url: rule, method: 'ANY', enabled: true }
                    : rule;
                  onEdit(index, ruleObj);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar regra
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // Obter o índice da linha
                const index = row.index;
                onRemove(index);
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Icon name="delete" className="mr-2 h-4 w-4" />
              Remover regra
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
