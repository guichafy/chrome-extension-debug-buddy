import { useTranslation } from 'react-i18next';
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

export type RulesSortOption =
	| 'priority_asc'
	| 'updated_desc'
	| 'updated_asc'
	| 'name_asc'
	| 'status_active_first';

// Métodos HTTP exibidos como chips de filtro multi-seleção. 'ANY' representa
// regras sem restrição de método (sem MethodMatcher habilitado ou com método
// 'ANY'). Os 6 valores cobrem o que o PRD US-004 lista explicitamente.
export const METHOD_FILTER_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'] as const;
export type MethodFilterOption = (typeof METHOD_FILTER_OPTIONS)[number];

interface RulesToolbarProps {
	search: string;
	onSearchChange: (value: string) => void;
	actionFilters: ActionType[];
	onActionFiltersChange: (value: ActionType[]) => void;
	methodFilters: string[];
	onMethodFiltersChange: (value: string[]) => void;
	stageFilterActive?: boolean;
	onClearStageFilter?: () => void;
	sort: RulesSortOption;
	onSortChange: (value: RulesSortOption) => void;
	actionCounts: Record<ActionType, number>;
	methodCounts: Record<string, number>;
	totalCount: number;
}

// Rótulos em `rules:actionTypes.<id>`.
const ACTION_FILTER_OPTIONS: ActionType[] = [
	'mock',
	'requestDelay',
	'transform',
	'breakpoint',
	'requestModify',
	'responseModify',
	'block',
];

// Chave de tradução (rulesLab:toolbar.sort.*) de cada critério, na ordem do menu.
const SORT_LABEL_KEYS = {
	priority_asc: 'toolbar.sort.priorityAsc',
	updated_desc: 'toolbar.sort.updatedDesc',
	updated_asc: 'toolbar.sort.updatedAsc',
	name_asc: 'toolbar.sort.nameAsc',
	status_active_first: 'toolbar.sort.statusActiveFirst',
} as const satisfies Record<RulesSortOption, string>;

function toggleArrayValue<T>(arr: readonly T[], value: T): T[] {
	const next = arr.filter((item) => item !== value);
	if (next.length === arr.length) next.push(value);
	return next;
}

interface FilterChipProps {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
	testId: string;
}

function FilterChip({ label, count, active, onClick, testId }: FilterChipProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
				active
					? 'border-primary/40 bg-primary/15 text-primary'
					: 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
			)}
			aria-pressed={active}
			data-testid={testId}
		>
			{label}
			<span
				className={cn(
					'rounded-full px-1 text-[10px]',
					active ? 'bg-primary/25 text-primary' : 'bg-muted text-muted-foreground',
				)}
			>
				{count}
			</span>
		</button>
	);
}

export function RulesToolbar({
	search,
	onSearchChange,
	actionFilters,
	onActionFiltersChange,
	methodFilters,
	onMethodFiltersChange,
	stageFilterActive = false,
	onClearStageFilter,
	sort,
	onSortChange,
	actionCounts,
	methodCounts,
	totalCount,
}: RulesToolbarProps) {
	const { t } = useTranslation(['rulesLab', 'rules']);
	const hasActiveFilters =
		actionFilters.length > 0 ||
		methodFilters.length > 0 ||
		search.trim().length > 0 ||
		stageFilterActive;

	const handleClear = () => {
		onSearchChange('');
		onActionFiltersChange([]);
		onMethodFiltersChange([]);
		onClearStageFilter?.();
	};

	return (
		<div className="flex flex-col gap-2 border-b px-4 py-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-[180px] flex-1">
					<LucideIcon
						name="search"
						className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={t('toolbar.searchPlaceholder')}
						className="h-8 pl-8 text-sm"
						aria-label={t('toolbar.searchAriaLabel')}
					/>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-7 gap-1.5 text-xs"
							aria-label={t('toolbar.sortAriaLabel')}
						>
							<LucideIcon name="arrow-up-down" className="h-3 w-3" />
							{t(SORT_LABEL_KEYS[sort])}
							<LucideIcon name="chevron-down" className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{(Object.keys(SORT_LABEL_KEYS) as RulesSortOption[]).map((option) => (
							<DropdownMenuItem
								key={option}
								onClick={() => onSortChange(option)}
								className="text-xs"
							>
								{t(SORT_LABEL_KEYS[option])}
								{option === sort && (
									<LucideIcon name="check" className="ml-auto h-3.5 w-3.5 opacity-60" />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 gap-1 text-xs text-muted-foreground"
						onClick={handleClear}
						data-testid="filter-clear"
					>
						<LucideIcon name="x" className="h-3 w-3" />
						{t('toolbar.clearFilters')}
					</Button>
				)}
			</div>

			<fieldset className="flex flex-wrap items-center gap-1.5" data-testid="filter-group-types">
				<legend className="sr-only">{t('toolbar.filterByType')}</legend>
				<span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">
					{t('toolbar.type')}
				</span>
				{ACTION_FILTER_OPTIONS.map((type) => (
					<FilterChip
						key={type}
						label={t(`rules:actionTypes.${type}`)}
						count={actionCounts[type] ?? 0}
						active={actionFilters.includes(type)}
						onClick={() => onActionFiltersChange(toggleArrayValue(actionFilters, type))}
						testId={`filter-chip-type-${type}`}
					/>
				))}
				<span className="ml-2 text-[10px] text-muted-foreground">
					{actionFilters.length === 0 ? t('toolbar.rulesCount', { count: totalCount }) : null}
				</span>
			</fieldset>

			<fieldset className="flex flex-wrap items-center gap-1.5" data-testid="filter-group-methods">
				<legend className="sr-only">{t('toolbar.filterByMethod')}</legend>
				<span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">
					{t('toolbar.method')}
				</span>
				{METHOD_FILTER_OPTIONS.map((method) => (
					<FilterChip
						key={method}
						label={method}
						count={methodCounts[method] ?? 0}
						active={methodFilters.includes(method)}
						onClick={() => onMethodFiltersChange(toggleArrayValue(methodFilters, method))}
						testId={`filter-chip-method-${method}`}
					/>
				))}
			</fieldset>
		</div>
	);
}

export default RulesToolbar;
