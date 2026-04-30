import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Rule } from '@/types/rules';
import { RuleTableRow } from './RuleTableRow';

const PAGE_SIZE = 10;

interface RulesListProps {
	rules: Rule[];
	totalCount: number;
	orderById: Map<string, number>;
	onEdit: (rule: Rule) => void;
	onRemove: (id: string) => void;
	onDuplicate: (rule: Rule) => void;
	onToggle: (id: string) => void;
}

export function RulesList({
	rules,
	totalCount,
	orderById,
	onEdit,
	onRemove,
	onDuplicate,
	onToggle,
}: RulesListProps) {
	const [page, setPage] = useState(0);

	const totalPages = Math.max(1, Math.ceil(rules.length / PAGE_SIZE));

	useEffect(() => {
		setPage((p) => Math.min(p, totalPages - 1));
	}, [totalPages]);

	const visible = useMemo(() => {
		if (rules.length <= PAGE_SIZE) return rules;
		const start = page * PAGE_SIZE;
		return rules.slice(start, start + PAGE_SIZE);
	}, [rules, page]);

	if (rules.length === 0) {
		return (
			<div className="px-6 py-10 text-center text-sm text-muted-foreground">
				Nenhuma regra corresponde aos filtros atuais.
			</div>
		);
	}

	const showingFrom = page * PAGE_SIZE + 1;
	const showingTo = Math.min(rules.length, page * PAGE_SIZE + visible.length);
	const showPagination = rules.length > PAGE_SIZE;

	return (
		<div className="flex flex-col">
			<Table data-testid="rules-table">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="h-9 w-12 text-center text-[11px] font-medium uppercase tracking-wide">
							Ordem
						</TableHead>
						<TableHead className="h-9 w-16 text-[11px] font-medium uppercase tracking-wide">
							Status
						</TableHead>
						<TableHead className="h-9 w-32 text-[11px] font-medium uppercase tracking-wide">
							Tipo
						</TableHead>
						<TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide">
							Matcher
						</TableHead>
						<TableHead className="h-9 text-[11px] font-medium uppercase tracking-wide">
							Ação
						</TableHead>
						<TableHead className="hidden h-9 w-32 text-[11px] font-medium uppercase tracking-wide md:table-cell">
							Atualizado
						</TableHead>
						<TableHead className="h-9 w-32 text-right text-[11px] font-medium uppercase tracking-wide">
							Ações
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{visible.map((rule) => (
						<RuleTableRow
							key={rule.id}
							rule={rule}
							order={orderById.get(rule.id) ?? 0}
							onEdit={onEdit}
							onRemove={onRemove}
							onDuplicate={onDuplicate}
							onToggle={onToggle}
						/>
					))}
				</TableBody>
			</Table>

			<div className="flex items-center justify-between border-t px-4 py-2.5 text-[11px] text-muted-foreground">
				<span>
					{showPagination
						? `Mostrando ${showingFrom}–${showingTo} de ${rules.length}`
						: `${rules.length} de ${totalCount}`}
				</span>

				{showPagination && (
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							disabled={page === 0}
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							aria-label="Página anterior"
						>
							<LucideIcon name="chevron-left" className="h-3.5 w-3.5" />
						</Button>
						<span className="px-1.5">
							{page + 1} / {totalPages}
						</span>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							disabled={page >= totalPages - 1}
							onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
							aria-label="Próxima página"
						>
							<LucideIcon name="chevron-right" className="h-3.5 w-3.5" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

export default RulesList;
