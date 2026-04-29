import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import type { ActionType } from '@/types/rules';

export type RulesActionFilter = 'all' | ActionType;

export type RulesSortOption = 'updated_desc' | 'updated_asc' | 'name_asc' | 'status_active_first';

interface RulesToolbarProps {
	search: string;
	onSearchChange: (value: string) => void;
	actionFilter: RulesActionFilter;
	onActionFilterChange: (value: RulesActionFilter) => void;
	sort: RulesSortOption;
	onSortChange: (value: RulesSortOption) => void;
	counts: Record<RulesActionFilter, number>;
}

const FILTER_OPTIONS: { id: RulesActionFilter; label: string }[] = [
	{ id: 'all', label: 'Todas' },
	{ id: 'mock', label: 'Mock' },
	{ id: 'delay', label: 'Latência' },
	{ id: 'modify', label: 'Modificar' },
	{ id: 'breakpoint', label: 'Breakpoint' },
];

const SORT_LABELS: Record<RulesSortOption, string> = {
	updated_desc: 'Atualizado (mais recente)',
	updated_asc: 'Atualizado (mais antigo)',
	name_asc: 'Nome (A → Z)',
	status_active_first: 'Status (ativas primeiro)',
};

export function RulesToolbar({
	search,
	onSearchChange,
	actionFilter,
	onActionFilterChange,
	sort,
	onSortChange,
	counts,
}: RulesToolbarProps) {
	return (
		<div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
			<div className="relative min-w-[180px] flex-1">
				<LucideIcon
					name="search"
					className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder="Buscar regras..."
					className="h-8 pl-8 text-sm"
					aria-label="Buscar regras"
				/>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{FILTER_OPTIONS.map((opt) => {
					const isActive = actionFilter === opt.id;
					const count = counts[opt.id];
					return (
						<button
							key={opt.id}
							type="button"
							onClick={() => onActionFilterChange(opt.id)}
							className={cn(
								'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
								isActive
									? 'border-primary/40 bg-primary/15 text-primary'
									: 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
							)}
							aria-pressed={isActive}
							data-testid={`filter-chip-${opt.id}`}
						>
							{opt.label}
							<span
								className={cn(
									'rounded-full px-1 text-[10px]',
									isActive ? 'bg-primary/25 text-primary' : 'bg-muted text-muted-foreground',
								)}
							>
								{count}
							</span>
						</button>
					);
				})}
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-7 gap-1.5 text-xs"
						aria-label="Critério de ordenação"
					>
						<LucideIcon name="arrow-up-down" className="h-3 w-3" />
						{SORT_LABELS[sort]}
						<LucideIcon name="chevron-down" className="h-3 w-3" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{(Object.keys(SORT_LABELS) as RulesSortOption[]).map((option) => (
						<DropdownMenuItem key={option} onClick={() => onSortChange(option)} className="text-xs">
							{SORT_LABELS[option]}
							{option === sort && (
								<LucideIcon name="check" className="ml-auto h-3.5 w-3.5 opacity-60" />
							)}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export default RulesToolbar;
