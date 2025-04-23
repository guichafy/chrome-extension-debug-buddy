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
import { Rule, Matcher } from "@/backend/types/rules"
import { Badge } from "@/ui/components/shadcn/badge"

// Função para obter uma descrição resumida dos matchers
const getMatcherSummary = (matchers: Matcher[]): string => {
  const urlMatcher = matchers.find(m => m.type === 'url' && m.enabled);
  const methodMatcher = matchers.find(m => m.type === 'method' && m.enabled);
  
  if (!urlMatcher) return 'Sem condições de URL';
  
  let summary = '';
  
  if (methodMatcher && methodMatcher.type === 'method') {
    summary += methodMatcher.method !== 'ANY' ? `${methodMatcher.method} ` : '';
  }
  
  if (urlMatcher.type === 'url') {
    summary += `${urlMatcher.pattern}`;
  }
  
  return summary;
};

// Função para obter uma descrição resumida da ação
const getActionSummary = (rule: Rule): string => {
  const { action } = rule;
  
  switch (action.type) {
    case 'mock':
      return `Responder com status ${action.status}`;
    case 'delay':
      return `Atrasar por ${action.timeMs}ms`;
    case 'modify':
      return 'Modificar resposta';
    default:
      return 'Ação desconhecida';
  }
};

export const columns: ColumnDef<Rule>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Nome
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const rule = row.original;
      return (
        <div className="font-medium">{rule.name}</div>
      );
    },
  },
  {
    accessorKey: "match",
    header: "Match",
    cell: ({ row }) => {
      const rule = row.original;
      return getMatcherSummary(rule.matchers);
    },
  },
  {
    accessorKey: "action",
    header: "Then",
    cell: ({ row }) => {
      const rule = row.original;
      return getActionSummary(rule);
    },
  },
  {
    accessorKey: "matchers",
    header: "Condições",
    cell: ({ row }) => {
      const rule = row.original;
      const matcherCount = rule.matchers.filter(m => m.enabled).length;
      
      return (
        <Badge variant="outline" className="bg-primary/10">
          {matcherCount}
        </Badge>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Atualizado
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const rule = row.original;
      const date = new Date(rule.updatedAt);
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row, table }) => {
      const rule = row.original;
      const { onToggle } = table.options.meta as { onToggle?: (id: string) => Promise<boolean> };

      if (!onToggle) return null;

      return (
        <Button
          variant={rule.enabled ? "default" : "outline"}
          size="sm"
          className={`px-2 py-1 h-8 ${rule.enabled ? 'bg-green-500 hover:bg-green-600' : 'text-gray-500'}`}
          onClick={() => onToggle(rule.id)}
        >
          {rule.enabled ? 'Ativo' : 'Inativo'}
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
        onRemove: (id: string) => void,
        onEdit?: (rule: Rule) => void
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
                onClick={() => onEdit(rule)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar regra
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(rule.id)}
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
