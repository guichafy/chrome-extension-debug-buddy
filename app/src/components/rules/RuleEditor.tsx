import React, { useEffect, useMemo, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { cn } from '@/lib/utils';
import { createPresetRule } from '@/domain/rulePresets';
import { Action, Matcher, Rule, RulePresetId } from '@/types/rules';
import {
	getActionSummary,
	getActionVisuals,
	getMatcherSummary,
} from '@/components/rules-lab/ruleVisuals';
import { ActionEditor } from './ActionEditor';
import { PresetWelcome } from './PresetWelcome';
import { UnifiedMatcherEditor } from './UnifiedMatcherEditor';

interface RuleEditorProps {
	open: boolean;
	mode: 'create' | 'edit';
	rule?: Rule;
	onOpenChange: (open: boolean) => void;
	onSave: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
}

type EditorView = 'welcome' | 'editor';

type WizardStep = 'type' | 'matcher' | 'action' | 'review';

const STEPS: readonly WizardStep[] = ['type', 'matcher', 'action', 'review'] as const;

const STEP_META: Record<WizardStep, { label: string; description: string }> = {
	type: {
		label: 'Tipo',
		description: 'Escolha o comportamento da regra.',
	},
	matcher: {
		label: 'Matcher',
		description: 'Defina quais requisições serão alvo.',
	},
	action: {
		label: 'Ação',
		description: 'Configure como a regra age sobre o request.',
	},
	review: {
		label: 'Revisar',
		description: 'Confirme antes de salvar.',
	},
};

const ACTION_TYPE_DESCRIPTION: Record<Action['type'], string> = {
	mock: 'Não chama o servidor — retorna a resposta mockada configurada.',
	transform: 'Chama o servidor e aplica modificações na resposta antes de devolver ao cliente.',
	delay: 'Atrasa a resposta antes de devolver ao cliente, sem alterar o conteúdo.',
	breakpoint: 'Pausa o request e abre o dialog de inspeção para edição manual antes de continuar.',
};

const DEFAULT_MATCHERS: Matcher[] = [
	{ type: 'url', enabled: true, pattern: '', isRegex: false },
	{ type: 'method', enabled: true, method: 'ANY' },
];

const DEFAULT_ACTION: Action = {
	type: 'mock',
	enabled: true,
	status: 200,
	headers: {},
};

interface DraftSnapshot {
	name: string;
	enabled: boolean;
	matchers: Matcher[];
	action: Action;
}

const snapshot = (s: DraftSnapshot): string => JSON.stringify(s);

const RuleEditor: React.FC<RuleEditorProps> = ({ open, mode, rule, onOpenChange, onSave }) => {
	const [view, setView] = useState<EditorView>(mode === 'edit' ? 'editor' : 'welcome');
	const [cameFromWelcome, setCameFromWelcome] = useState(false);
	const [name, setName] = useState(rule?.name || 'Nova Regra');
	const [matchers, setMatchers] = useState<Matcher[]>(rule?.matchers ?? DEFAULT_MATCHERS);
	const [action, setAction] = useState<Action>(rule?.action ?? DEFAULT_ACTION);
	const [enabled, setEnabled] = useState(rule?.enabled !== false);
	const [step, setStep] = useState<WizardStep>('type');
	const [maxStepIndexReached, setMaxStepIndexReached] = useState(0);
	const [initialSnapshot, setInitialSnapshot] = useState<string>('');
	const [showCancelConfirm, setShowCancelConfirm] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const currentDraftKey = useMemo(
		() => snapshot({ name, enabled, matchers, action }),
		[name, enabled, matchers, action],
	);
	const hasUnsavedChanges = useMemo(() => {
		if (view !== 'editor') return false;
		if (initialSnapshot.length === 0) return false;
		return currentDraftKey !== initialSnapshot;
	}, [view, initialSnapshot, currentDraftKey]);

	const restoreBodyPointerEvents = () => {
		document.body.style.pointerEvents = '';
	};

	const closeDialog = () => {
		onOpenChange(false);
		restoreBodyPointerEvents();
		requestAnimationFrame(restoreBodyPointerEvents);
		setTimeout(restoreBodyPointerEvents, 50);
		setTimeout(restoreBodyPointerEvents, 200);
		setTimeout(restoreBodyPointerEvents, 500);
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			if (hasUnsavedChanges) {
				setShowCancelConfirm(true);
				return;
			}
			closeDialog();
			return;
		}
		onOpenChange(newOpen);
	};

	useEffect(() => {
		const reset = () => {
			document.body.style.pointerEvents = '';
		};
		if (!open) {
			reset();
			const t1 = setTimeout(reset, 50);
			const t2 = setTimeout(reset, 200);
			const t3 = setTimeout(reset, 500);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}
		return reset;
	}, [open]);

	useEffect(() => {
		if (!open) return;
		if (mode === 'edit' && rule) {
			setName(rule.name);
			setMatchers(rule.matchers);
			setAction(rule.action);
			setEnabled(rule.enabled);
			setView('editor');
			setCameFromWelcome(false);
			setStep('type');
			setMaxStepIndexReached(STEPS.length - 1);
			setInitialSnapshot(
				snapshot({
					name: rule.name,
					enabled: rule.enabled,
					matchers: rule.matchers,
					action: rule.action,
				}),
			);
			setShowCancelConfirm(false);
			return;
		}
		if (mode === 'create') {
			setName('Nova Regra');
			setMatchers(DEFAULT_MATCHERS);
			setAction(DEFAULT_ACTION);
			setEnabled(true);
			setView('welcome');
			setCameFromWelcome(false);
			setStep('type');
			setMaxStepIndexReached(0);
			setInitialSnapshot('');
			setShowCancelConfirm(false);
		}
	}, [open, mode, rule]);

	const beginEditingFromDraft = (draft: DraftSnapshot) => {
		setName(draft.name);
		setMatchers(draft.matchers);
		setAction(draft.action);
		setEnabled(draft.enabled);
		setStep('type');
		setMaxStepIndexReached(0);
		setCameFromWelcome(true);
		setInitialSnapshot(snapshot(draft));
		setView('editor');
	};

	const applyPresetDraft = (presetId: RulePresetId) => {
		const draft = createPresetRule(presetId);
		const matchersForEditing = draft.matchers.map((m) =>
			m.type === 'url' ? { ...m, enabled: true } : m,
		);
		beginEditingFromDraft({
			name: draft.name,
			enabled: draft.enabled,
			matchers: matchersForEditing,
			action: draft.action,
		});
	};

	const startBlank = () => {
		beginEditingFromDraft({
			name: 'Nova Regra',
			enabled: true,
			matchers: DEFAULT_MATCHERS,
			action: DEFAULT_ACTION,
		});
	};

	const goBackToWelcome = () => {
		setView('welcome');
		setStep('type');
		setMaxStepIndexReached(0);
		setInitialSnapshot('');
	};

	const validateForSave = (): { ok: true } | { ok: false; message: string; step: WizardStep } => {
		if (!name.trim()) {
			return { ok: false, message: 'Por favor, insira um nome para a regra', step: 'matcher' };
		}
		const enabledUrlMatcher = matchers.find((m) => m.type === 'url' && m.enabled);
		if (!enabledUrlMatcher) {
			return {
				ok: false,
				message: 'A regra precisa de um matcher de URL habilitado',
				step: 'matcher',
			};
		}
		if (enabledUrlMatcher.type === 'url' && enabledUrlMatcher.pattern.trim().length === 0) {
			return {
				ok: false,
				message: 'Preencha o padrão da URL antes de salvar',
				step: 'matcher',
			};
		}
		const enabledMethodMatcher = matchers.find((m) => m.type === 'method' && m.enabled);
		if (enabledMethodMatcher && enabledMethodMatcher.type === 'method') {
			const methods = Array.isArray(enabledMethodMatcher.method)
				? enabledMethodMatcher.method
				: enabledMethodMatcher.method
					? [enabledMethodMatcher.method]
					: [];
			if (methods.length === 0) {
				return {
					ok: false,
					message: 'Selecione ao menos um método HTTP ou desative o matcher de método',
					step: 'matcher',
				};
			}
		}
		return { ok: true };
	};

	const handleSave = async () => {
		const validation = validateForSave();
		if (!validation.ok) {
			alert(validation.message);
			setStep(validation.step);
			return;
		}

		setIsSaving(true);
		try {
			const success = await onSave({
				name: name.trim(),
				enabled,
				matchers,
				action,
			});
			if (success) {
				setInitialSnapshot(snapshot({ name, enabled, matchers, action }));
				closeDialog();
			}
		} finally {
			setIsSaving(false);
		}
	};

	const stepIndex = STEPS.indexOf(step);
	const isFirstStep = stepIndex === 0;
	const isLastStep = stepIndex === STEPS.length - 1;

	const goToStep = (target: WizardStep) => {
		const targetIndex = STEPS.indexOf(target);
		if (mode === 'edit' || targetIndex <= maxStepIndexReached) {
			setStep(target);
			setMaxStepIndexReached((prev) => Math.max(prev, targetIndex));
		}
	};

	const goNext = () => {
		if (isLastStep) return;
		const next = STEPS[stepIndex + 1];
		setStep(next);
		setMaxStepIndexReached((prev) => Math.max(prev, stepIndex + 1));
	};

	const goPrevious = () => {
		if (isFirstStep) return;
		const prev = STEPS[stepIndex - 1];
		setStep(prev);
	};

	const isWelcome = view === 'welcome';
	const showBackToWelcome =
		view === 'editor' && cameFromWelcome && mode === 'create' && step === 'type';

	const visuals = getActionVisuals(action);

	const renderTypeStep = () => (
		<div className="space-y-4">
			<div>
				<Label htmlFor="ruleName">Nome da Regra</Label>
				<Input
					id="ruleName"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Ex: API de Login"
					className="w-full"
				/>
			</div>
			<div className="rounded-lg border bg-card p-4">
				<div className="flex items-start gap-3">
					<div
						className={cn(
							'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
							visuals.bgClass,
							visuals.textClass,
						)}
					>
						<LucideIcon name={visuals.iconName} className="h-5 w-5" />
					</div>
					<div className="flex-1">
						<div className="text-sm font-medium">Tipo: {visuals.label}</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{ACTION_TYPE_DESCRIPTION[action.type]}
						</p>
					</div>
				</div>
				<p className="mt-3 text-xs text-muted-foreground">
					O tipo é definido pelo preset escolhido ou pelo editor de Ação. Em uma próxima entrega
					este passo permitirá escolher o tipo via cards visuais.
				</p>
			</div>
			<div className="flex items-center space-x-2">
				<Checkbox
					id="rule-enabled"
					checked={enabled}
					onCheckedChange={(checked) => setEnabled(checked === true)}
				/>
				<Label htmlFor="rule-enabled">Regra ativa</Label>
			</div>
		</div>
	);

	const renderMatcherStep = () => (
		<div className="space-y-3">
			<div>
				<h3 className="mb-1 text-lg font-medium">Condições de Match</h3>
				<p className="mb-4 text-sm text-muted-foreground">
					Defina o padrão de URL e os métodos HTTP que disparam esta regra. O painel à direita
					mostra em tempo real se a regra casaria uma URL de teste.
				</p>
			</div>
			<UnifiedMatcherEditor matchers={matchers} onChange={setMatchers} />
		</div>
	);

	const renderActionStep = () => (
		<div className="rounded-lg bg-muted p-4">
			<h3 className="mb-2 text-lg font-medium">Ação</h3>
			<p className="mb-4 text-sm text-muted-foreground">
				Defina a ação a ser executada quando a requisição corresponder às condições de match.
			</p>
			<ActionEditor action={action} onChange={setAction} />
		</div>
	);

	const renderReviewStep = () => {
		const matcherSummary = getMatcherSummary(matchers);
		const actionSummary = getActionSummary(action);
		return (
			<div className="space-y-3">
				<div className="rounded-lg border bg-card p-4">
					<div className="mb-3 flex items-center gap-3">
						<div
							className={cn(
								'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
								visuals.bgClass,
								visuals.textClass,
							)}
						>
							<LucideIcon name={visuals.iconName} className="h-4 w-4" />
						</div>
						<div className="flex-1">
							<div className="text-sm font-medium">{name || '(sem nome)'}</div>
							<div className="text-xs text-muted-foreground">
								{enabled ? 'Ativa ao salvar' : 'Pausada ao salvar'}
							</div>
						</div>
					</div>
					<dl className="grid gap-2 text-sm">
						<div className="grid grid-cols-[110px_1fr] gap-2">
							<dt className="text-muted-foreground">Tipo</dt>
							<dd>{visuals.label}</dd>
						</div>
						<div className="grid grid-cols-[110px_1fr] gap-2">
							<dt className="text-muted-foreground">Matcher</dt>
							<dd className="break-all">{matcherSummary}</dd>
						</div>
						<div className="grid grid-cols-[110px_1fr] gap-2">
							<dt className="text-muted-foreground">Ação</dt>
							<dd className="break-all">{actionSummary}</dd>
						</div>
					</dl>
				</div>
				<p className="text-xs text-muted-foreground">
					Confira o resumo acima antes de salvar. Um diff visual entre o estado original e o novo
					será adicionado em uma próxima entrega.
				</p>
			</div>
		);
	};

	const renderStepContent = () => {
		switch (step) {
			case 'type':
				return renderTypeStep();
			case 'matcher':
				return renderMatcherStep();
			case 'action':
				return renderActionStep();
			case 'review':
				return renderReviewStep();
		}
	};

	const stepIsClickable = (target: WizardStep): boolean => {
		if (mode === 'edit') return true;
		const targetIndex = STEPS.indexOf(target);
		return targetIndex <= maxStepIndexReached;
	};

	return (
		<>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent
					className="flex max-h-[85vh] w-[90vw] max-w-[60rem] flex-col overflow-hidden sm:max-w-[60rem]"
					onCloseAutoFocus={(e) => {
						e.preventDefault();
						restoreBodyPointerEvents();
					}}
				>
					<DialogHeader>
						{showBackToWelcome && (
							<button
								type="button"
								onClick={goBackToWelcome}
								className="mb-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
							>
								<LucideIcon name="arrow-left" className="h-3 w-3" />
								Voltar
							</button>
						)}
						<DialogTitle>
							{mode === 'edit' ? 'Editar Regra' : isWelcome ? 'Nova regra' : 'Configurar regra'}
						</DialogTitle>
						<DialogDescription>
							{mode === 'edit'
								? 'Modifique os detalhes da regra de interceptação.'
								: isWelcome
									? 'Comece de um preset ou em branco.'
									: STEP_META[step].description}
						</DialogDescription>
					</DialogHeader>

					{isWelcome ? (
						<PresetWelcome onSelectBlank={startBlank} onSelectPreset={applyPresetDraft} />
					) : (
						<>
							<nav
								aria-label="Passos do wizard"
								className="flex items-center justify-between gap-2 border-y py-3"
								data-testid="rule-wizard-steps"
							>
								{STEPS.map((s, idx) => {
									const isCurrent = s === step;
									const isReached = idx <= maxStepIndexReached || mode === 'edit';
									const clickable = stepIsClickable(s);
									return (
										<React.Fragment key={s}>
											<button
												type="button"
												onClick={() => clickable && goToStep(s)}
												disabled={!clickable}
												className={cn(
													'flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors',
													clickable
														? 'hover:bg-muted/60 cursor-pointer'
														: 'cursor-not-allowed opacity-60',
													isCurrent && 'bg-primary/10 text-primary',
												)}
												data-testid={`rule-wizard-step-${s}`}
												aria-current={isCurrent ? 'step' : undefined}
											>
												<span
													className={cn(
														'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
														isCurrent
															? 'border-primary bg-primary text-primary-foreground'
															: isReached
																? 'border-primary/60 text-primary'
																: 'border-muted-foreground/30 text-muted-foreground',
													)}
												>
													{idx + 1}
												</span>
												<span className="hidden truncate font-medium sm:inline">
													{STEP_META[s].label}
												</span>
											</button>
											{idx < STEPS.length - 1 && (
												<LucideIcon
													name="chevron-right"
													className="h-4 w-4 shrink-0 text-muted-foreground"
												/>
											)}
										</React.Fragment>
									);
								})}
							</nav>

							<ScrollArea className="flex-1 overflow-y-auto pr-2">
								<div className="py-2">{renderStepContent()}</div>
							</ScrollArea>

							<DialogFooter className="mt-2 flex !flex-row items-center !justify-between gap-2 border-t pt-3">
								<Button
									type="button"
									variant="ghost"
									onClick={() => {
										if (hasUnsavedChanges) {
											setShowCancelConfirm(true);
										} else {
											closeDialog();
										}
									}}
									disabled={isSaving}
								>
									Cancelar
								</Button>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={goPrevious}
										disabled={isFirstStep || isSaving}
									>
										<LucideIcon name="arrow-left" className="mr-1 h-4 w-4" />
										Anterior
									</Button>
									{isLastStep ? (
										<Button
											type="button"
											onClick={handleSave}
											disabled={isSaving}
											className="primary-button flex items-center gap-2"
										>
											{isSaving ? (
												<LucideIcon name="refresh" className="h-4 w-4 animate-spin" />
											) : (
												<LucideIcon
													name={mode === 'create' ? 'plus' : 'save'}
													className="h-4 w-4"
												/>
											)}
											{mode === 'create' ? 'Adicionar' : 'Salvar'}
										</Button>
									) : (
										<Button type="button" onClick={goNext} disabled={isSaving}>
											Próximo
											<LucideIcon name="arrow-right" className="ml-1 h-4 w-4" />
										</Button>
									)}
								</div>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={showCancelConfirm}
				onOpenChange={(o) => {
					if (!o) setShowCancelConfirm(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
						<AlertDialogDescription>
							Você fez alterações que ainda não foram salvas. Sair agora descartará tudo o que foi
							modificado neste wizard.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setShowCancelConfirm(false)}>
							Continuar editando
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setShowCancelConfirm(false);
								closeDialog();
							}}
						>
							Descartar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

export default RuleEditor;
