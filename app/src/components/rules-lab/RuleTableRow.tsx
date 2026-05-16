import type { DragEvent, KeyboardEvent } from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Rule } from '@/types/rules';
import { getActionSummary, getActionVisuals, getMatcherSummary } from './ruleVisuals';

interface RuleTableRowProps {
	rule: Rule;
	order: number;
	onEdit: (rule: Rule) => void;
	onRemove: (id: string) => void;
	onDuplicate: (rule: Rule) => void;
	onToggle: (id: string) => void;
	canReorder?: boolean;
	onReorderDragStart?: (id: string) => void;
	onReorderDrop?: (toId: string, position: 'before' | 'after') => void;
	onReorderEnd?: () => void;
	draggingId?: string | null;
	onMove?: (id: string, direction: 'up' | 'down') => void;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
	day: '2-digit',
	month: '2-digit',
	year: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
});

export function RuleTableRow({
	rule,
	order,
	onEdit,
	onRemove,
	onDuplicate,
	onToggle,
	canReorder = false,
	onReorderDragStart,
	onReorderDrop,
	onReorderEnd,
	draggingId,
	onMove,
}: RuleTableRowProps) {
	// Phase 1 (compat): exibe a primeira action como "head" do chain. Phase 4
	// substituirá por visualização da chain completa quando houver múltiplas
	// actions na mesma regra.
	const headAction = rule.actions[0];
	const visuals = getActionVisuals(headAction);
	const matchSummary = getMatcherSummary(rule.matchers);
	const thenSummary = getActionSummary(headAction);
	const updatedAt = dateFormatter.format(new Date(rule.updatedAt));

	const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
	const isDragging = canReorder && draggingId === rule.id;

	const handleDragStart = (event: DragEvent<HTMLTableRowElement>) => {
		if (!canReorder) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', rule.id);
		onReorderDragStart?.(rule.id);
	};

	const computeDropPosition = (event: DragEvent<HTMLTableRowElement>): 'before' | 'after' => {
		const rect = event.currentTarget.getBoundingClientRect();
		const offsetY = event.clientY - rect.top;
		return offsetY < rect.height / 2 ? 'before' : 'after';
	};

	const handleDragOver = (event: DragEvent<HTMLTableRowElement>) => {
		if (!canReorder) return;
		if (!draggingId || draggingId === rule.id) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		const position = computeDropPosition(event);
		setDropPosition((prev) => (prev === position ? prev : position));
	};

	const handleDragLeave = () => {
		if (!canReorder) return;
		setDropPosition(null);
	};

	const handleDrop = (event: DragEvent<HTMLTableRowElement>) => {
		if (!canReorder) return;
		if (!draggingId || draggingId === rule.id) {
			setDropPosition(null);
			return;
		}
		event.preventDefault();
		const position = dropPosition ?? computeDropPosition(event);
		setDropPosition(null);
		onReorderDrop?.(rule.id, position);
	};

	const handleDragEnd = () => {
		if (!canReorder) return;
		setDropPosition(null);
		onReorderEnd?.();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
		if (!canReorder || !onMove) return;
		const ctrlOrMeta = event.ctrlKey || event.metaKey;
		if (!ctrlOrMeta) return;
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			onMove(rule.id, 'up');
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			onMove(rule.id, 'down');
		}
	};

	return (
		<TableRow
			className={cn(
				'group transition-opacity',
				!rule.enabled && 'opacity-50',
				isDragging && 'opacity-30',
				dropPosition === 'before' && 'border-t-2 border-t-primary',
				dropPosition === 'after' && 'border-b-2 border-b-primary',
			)}
			data-testid={`rule-row-${rule.id}`}
			draggable={canReorder}
			onDragStart={canReorder ? handleDragStart : undefined}
			onDragOver={canReorder ? handleDragOver : undefined}
			onDragLeave={canReorder ? handleDragLeave : undefined}
			onDrop={canReorder ? handleDrop : undefined}
			onDragEnd={canReorder ? handleDragEnd : undefined}
			onKeyDown={canReorder ? handleKeyDown : undefined}
			tabIndex={canReorder ? 0 : -1}
		>
			<TableCell className="w-12 py-2 text-center font-mono text-xs text-muted-foreground">
				<div className="flex items-center justify-center gap-1">
					{canReorder && (
						<span
							className="cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
							aria-hidden="true"
							data-testid={`rule-drag-handle-${rule.id}`}
						>
							<LucideIcon name="grip-vertical" className="h-3.5 w-3.5" />
						</span>
					)}
					<span>{order}</span>
				</div>
			</TableCell>
			<TableCell className="w-16 py-2">
				<Switch
					checked={rule.enabled}
					onCheckedChange={() => onToggle(rule.id)}
					aria-label={rule.enabled ? 'Pausar regra' : 'Ativar regra'}
					data-testid={`rule-toggle-${rule.id}`}
				/>
			</TableCell>
			<TableCell className="w-32 py-2">
				<Badge
					variant="outline"
					className={cn(
						'gap-1.5 border px-2 py-0.5 text-[11px] font-medium',
						visuals.bgClass,
						visuals.textClass,
						visuals.borderClass,
					)}
					data-testid={`rule-type-badge-${rule.id}`}
				>
					<LucideIcon name={visuals.iconName} className="h-3 w-3" />
					{visuals.label}
				</Badge>
			</TableCell>
			<TableCell className="py-2">
				<div className="flex flex-col gap-0.5 min-w-0">
					<span className="truncate text-sm font-medium">{rule.name}</span>
					<code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
						{matchSummary}
					</code>
				</div>
			</TableCell>
			<TableCell className="py-2">
				<code className="inline-block max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
					{thenSummary}
				</code>
			</TableCell>
			<TableCell className="hidden w-32 py-2 text-[11px] text-muted-foreground md:table-cell">
				{updatedAt}
			</TableCell>
			<TableCell className="w-32 py-2 text-right">
				<div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
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
			</TableCell>
		</TableRow>
	);
}

export default RuleTableRow;
