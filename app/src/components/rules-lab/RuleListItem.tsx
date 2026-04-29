import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import type { Rule } from '@/types/rules';
import { getActionSummary, getActionVisuals, getMatcherSummary } from './ruleVisuals';

interface RuleListItemProps {
	rule: Rule;
	onEdit: (rule: Rule) => void;
	onRemove: (id: string) => void;
	onDuplicate: (rule: Rule) => void;
	onToggle: (id: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
	day: '2-digit',
	month: '2-digit',
	year: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
});

export function RuleListItem({ rule, onEdit, onRemove, onDuplicate, onToggle }: RuleListItemProps) {
	const visuals = getActionVisuals(rule.action);
	const enabledMatchers = rule.matchers.filter((m) => m.enabled).length;
	const matchSummary = getMatcherSummary(rule.matchers);
	const thenSummary = getActionSummary(rule.action);
	const updatedAt = dateFormatter.format(new Date(rule.updatedAt));

	return (
		<div
			className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border-b border-border/30 px-3 py-3 transition-colors last:border-b-0 hover:bg-accent/40"
			data-testid={`rule-item-${rule.id}`}
		>
			<div
				className={cn(
					'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
					visuals.bgClass,
					visuals.textClass,
				)}
				aria-label={visuals.label}
			>
				<LucideIcon name={visuals.iconName} className="h-4 w-4" />
			</div>

			<div className="min-w-0">
				<div className="mb-1 flex items-center gap-2">
					<span className="truncate text-sm font-medium">{rule.name}</span>
					<Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
						{enabledMatchers} {enabledMatchers === 1 ? 'condição' : 'condições'}
					</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
						{matchSummary}
					</code>
					<LucideIcon name="arrow-right" className="h-3 w-3 shrink-0" />
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
						{thenSummary}
					</code>
				</div>
			</div>

			<div className="flex items-center gap-2 sm:gap-3">
				<span className="hidden text-[11px] text-muted-foreground sm:inline">{updatedAt}</span>

				<div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={() => onEdit(rule)}
						aria-label="Editar regra"
					>
						<LucideIcon name="edit" className="h-3.5 w-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={() => onDuplicate(rule)}
						aria-label="Duplicar regra"
					>
						<LucideIcon name="copy" className="h-3.5 w-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-destructive hover:text-destructive"
						onClick={() => onRemove(rule.id)}
						aria-label="Excluir regra"
					>
						<LucideIcon name="trash" className="h-3.5 w-3.5" />
					</Button>
				</div>

				<button
					type="button"
					role="switch"
					aria-checked={rule.enabled}
					aria-label={rule.enabled ? 'Pausar regra' : 'Ativar regra'}
					onClick={() => onToggle(rule.id)}
					className={cn(
						'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						rule.enabled ? 'bg-success' : 'bg-muted-foreground/30',
					)}
				>
					<span
						className={cn(
							'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-all',
							rule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
						)}
					/>
				</button>
			</div>
		</div>
	);
}

export default RuleListItem;
