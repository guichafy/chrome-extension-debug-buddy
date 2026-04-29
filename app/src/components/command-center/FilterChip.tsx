import { LucideIcon } from '@/components/ui/lucide-icon';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Filter, RequestState } from '@/types/filters';
import { FILTER_FIELD_LABELS, FILTER_OPERATOR_LABELS, REQUEST_STATE_LABELS } from '@/types/filters';

interface FilterChipProps {
	filter: Filter;
	onRemove: (id: string) => void;
}

function isRequestState(value: string): value is RequestState {
	return value in REQUEST_STATE_LABELS;
}

function chipBadgeVariant(filter: Filter): 'warning' | 'destructive' | 'secondary' | 'outline' {
	if (filter.field === 'state' && filter.value === 'pending') return 'warning';
	if (filter.field === 'state' && filter.value === 'failed') return 'destructive';
	if (filter.field === 'free') return 'secondary';
	return 'outline';
}

function formatFilterValue(filter: Filter): string {
	if (filter.field === 'state' && isRequestState(filter.value)) {
		return REQUEST_STATE_LABELS[filter.value];
	}
	return filter.value;
}

export function FilterChip({ filter, onRemove }: FilterChipProps) {
	const fieldLabel = FILTER_FIELD_LABELS[filter.field];
	const operatorLabel = FILTER_OPERATOR_LABELS[filter.operator];
	const valueLabel = formatFilterValue(filter);
	const tooltip = `${fieldLabel} ${operatorLabel} ${valueLabel}`;

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant={chipBadgeVariant(filter)}
						className={cn(
							'group h-7 gap-1 rounded-md px-2 font-medium leading-none',
							filter.field !== 'free' && 'border border-primary/40 bg-primary/10 text-foreground',
							filter.field === 'state' && filter.value === 'pending' && 'border-warning/50',
						)}
					>
						<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
							{filter.field === 'free' ? 'busca' : filter.field}
						</span>
						{filter.field !== 'free' && (
							<span className="text-muted-foreground/70">{operatorLabel}</span>
						)}
						<span className="font-mono text-[11px]">{valueLabel}</span>
						<button
							type="button"
							onClick={() => onRemove(filter.id)}
							className="ml-1 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
							aria-label={`Remover filtro ${tooltip}`}
						>
							<LucideIcon name="x" className="h-3 w-3" />
						</button>
					</Badge>
				</TooltipTrigger>
				<TooltipContent side="bottom">{tooltip}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
