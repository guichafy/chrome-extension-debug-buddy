import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { availableActionTypesForStage, createDefaultActionFor } from '@/domain/actionDefaults';
import { getActionVisuals } from '@/components/rules-lab/ruleVisuals';
import type { Action, ActionType, RuleStage } from '@/types/rules';
import { isActionValidForStage, isTerminalAction } from '@/types/rules';
import { ActionEditor } from './ActionEditor';

interface ActionChainEditorProps {
	actions: Action[];
	stage: RuleStage;
	onChange: (actions: Action[]) => void;
	samplePayload?: string;
}

// Encontra o primeiro índice de uma action terminal habilitada. Actions após
// esse índice não rodam — sinalizamos visualmente e bloqueamos novas adições.
function findTerminalIndex(actions: Action[]): number {
	for (let i = 0; i < actions.length; i++) {
		if (actions[i].enabled && isTerminalAction(actions[i])) return i;
	}
	return -1;
}

export const ActionChainEditor: React.FC<ActionChainEditorProps> = ({
	actions,
	stage,
	onChange,
	samplePayload,
}) => {
	const { t } = useTranslation(['ruleEditor', 'rules']);
	const [pickerOpen, setPickerOpen] = useState(false);
	const terminalIndex = findTerminalIndex(actions);
	const hasTerminal = terminalIndex >= 0;
	const validTypes = availableActionTypesForStage(stage);
	// Response stage ainda roda no engine legado single-action — chains response
	// não executam todas as actions. Travamos no 1ª action habilitada enquanto
	// a migração para `executeChain` no Response stage não rola (epic dual-stage,
	// follow-up pós-Phase 9). Contamos só as habilitadas pra manter consistência
	// com findTerminalIndex acima — uma action pausada não trava nada.
	const enabledCount = actions.filter((a) => a.enabled).length;
	const responseChainCapped = stage === 'response' && enabledCount >= 1;

	const commit = (next: Action[]) => onChange(next);

	const addAction = (type: ActionType) => {
		const newAction = createDefaultActionFor(type);
		commit([...actions, newAction]);
		setPickerOpen(false);
	};

	const updateAction = (index: number, updated: Action) => {
		commit(actions.map((a, i) => (i === index ? updated : a)));
	};

	const removeAction = (index: number) => {
		commit(actions.filter((_, i) => i !== index));
	};

	const moveAction = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= actions.length) return;
		const next = [...actions];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		commit(next);
	};

	const toggleEnabled = (index: number) => {
		const target = actions[index];
		updateAction(index, { ...target, enabled: !target.enabled });
	};

	const renderRow = (action: Action, index: number) => {
		const visuals = getActionVisuals(action);
		const validHere = isActionValidForStage(action.type, stage);
		const terminalRow = isTerminalAction(action);
		const unreachable = hasTerminal && index > terminalIndex;
		return (
			<div
				key={`${action.type}-${index}`}
				className={cn(
					'rounded-lg border bg-card',
					!validHere && 'border-destructive/50',
					unreachable && 'opacity-60',
				)}
				data-testid={`action-chain-row-${index}`}
				data-action-type={action.type}
				data-terminal={terminalRow ? 'true' : 'false'}
				data-unreachable={unreachable ? 'true' : 'false'}
			>
				<header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
								visuals.bgClass,
								visuals.textClass,
							)}
						>
							<LucideIcon name={visuals.iconName} className="h-4 w-4" />
						</span>
						<div>
							<div className="flex items-center gap-2 text-sm font-medium">
								<span>
									{index + 1}. {visuals.label}
								</span>
								{terminalRow && (
									<span
										className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] uppercase text-rose-300"
										data-testid={`action-chain-terminal-badge-${index}`}
									>
										{t('chain.terminal')}
									</span>
								)}
								{!action.enabled && (
									<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
										{t('chain.paused')}
									</span>
								)}
							</div>
							{!validHere && (
								<p
									className="mt-0.5 text-xs text-destructive"
									data-testid={`action-chain-invalid-${index}`}
								>
									{t('chain.invalidForStage', { stage })}
								</p>
							)}
							{unreachable && (
								<p
									className="mt-0.5 text-xs text-amber-300"
									data-testid={`action-chain-unreachable-${index}`}
								>
									{t('chain.unreachable')}
								</p>
							)}
						</div>
					</div>
					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => toggleEnabled(index)}
							className="h-7 px-2 text-xs"
							data-testid={`action-chain-toggle-${index}`}
							aria-pressed={action.enabled}
						>
							{action.enabled ? 'Pausar' : 'Ativar'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => moveAction(index, -1)}
							disabled={index === 0}
							aria-label={t('chain.moveUp', { position: index + 1 })}
							className="h-7 w-7 p-0"
							data-testid={`action-chain-up-${index}`}
						>
							<LucideIcon name="chevron-down" className="h-3.5 w-3.5 rotate-180" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => moveAction(index, 1)}
							disabled={index === actions.length - 1}
							aria-label={t('chain.moveDown', { position: index + 1 })}
							className="h-7 w-7 p-0"
							data-testid={`action-chain-down-${index}`}
						>
							<LucideIcon name="chevron-down" className="h-3.5 w-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => removeAction(index)}
							aria-label={t('chain.remove', { position: index + 1 })}
							className="h-7 w-7 p-0 text-destructive"
							data-testid={`action-chain-remove-${index}`}
						>
							<LucideIcon name="trash" className="h-3.5 w-3.5" />
						</Button>
					</div>
				</header>
				<div className="p-3">
					<ActionEditor
						action={action}
						onChange={(updated) => updateAction(index, updated)}
						stage={stage}
						samplePayload={samplePayload}
					/>
				</div>
			</div>
		);
	};

	let addDisabledReason: string | null = null;
	if (hasTerminal) {
		addDisabledReason = t('chain.terminatedBy', {
			action: getActionVisuals(actions[terminalIndex]).label,
		});
	} else if (responseChainCapped) {
		addDisabledReason = t('chain.responseChainCapped');
	}

	return (
		<div className="space-y-3" data-testid="action-chain-editor" data-stage={stage}>
			{actions.length === 0 ? (
				<div
					className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center text-sm text-muted-foreground"
					data-testid="action-chain-empty"
				>
					{t('chain.empty')}
				</div>
			) : (
				actions.map((a, i) => renderRow(a, i))
			)}

			<div className="flex flex-col items-start gap-2">
				<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={hasTerminal || responseChainCapped}
							data-testid="action-chain-add-trigger"
						>
							<LucideIcon name="plus" className="mr-1 h-4 w-4" />
							{t('chain.add')}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-80 p-2">
						<div className="space-y-1" data-testid="action-chain-picker" data-stage={stage}>
							{validTypes.map((type) => {
								const visuals = getActionVisuals(createDefaultActionFor(type));
								return (
									<button
										key={type}
										type="button"
										onClick={() => addAction(type)}
										className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-muted/60"
										data-testid={`action-chain-picker-option-${type}`}
									>
										<span
											className={cn(
												'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
												visuals.bgClass,
												visuals.textClass,
											)}
										>
											<LucideIcon name={visuals.iconName} className="h-4 w-4" />
										</span>
										<div>
											<div className="text-sm font-medium">{visuals.label}</div>
											<div className="text-xs text-muted-foreground">
												{t(`rules:actionDescriptions.${type}`)}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</PopoverContent>
				</Popover>
				{addDisabledReason && (
					<p
						className="text-xs text-muted-foreground"
						data-testid="action-chain-add-disabled-reason"
					>
						{addDisabledReason}
					</p>
				)}
			</div>
		</div>
	);
};

export default ActionChainEditor;
