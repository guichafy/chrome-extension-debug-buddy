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
import { createTemplateRule } from '@/domain/ruleTemplates';
import type { RuleTemplateId } from '@/domain/ruleTemplates';
import { Action, Matcher, Rule, RuleDraft } from '@/types/rules';
import {
	getActionSummary,
	getActionVisuals,
	getMatcherSummary,
} from '@/components/rules-lab/ruleVisuals';
import { ActionEditor } from './ActionEditor';
import { HeaderMatcherSelector, type HeaderMatcherSource } from './HeaderMatcherSelector';
import { PresetWelcome } from './PresetWelcome';
import { UnifiedMatcherEditor } from './UnifiedMatcherEditor';

interface RuleEditorProps {
	open: boolean;
	mode: 'create' | 'edit';
	rule?: Rule;
	onOpenChange: (open: boolean) => void;
	onSave: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
	skipTypeStep?: boolean;
	initialDraft?: RuleDraft;
	headerMatcherSource?: HeaderMatcherSource;
}

type EditorView = 'welcome' | 'editor';

type WizardStep = 'type' | 'matcher' | 'action' | 'review';

const FULL_STEPS: readonly WizardStep[] = ['type', 'matcher', 'action', 'review'] as const;
const STEPS_WITHOUT_TYPE: readonly WizardStep[] = ['matcher', 'action', 'review'] as const;

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
	mock: 'Não chama o servidor — retorna a resposta mockada.',
	transform: 'Chama o servidor e aplica modificações na resposta.',
	delay: 'Atrasa a resposta antes de devolver ao cliente.',
	breakpoint: 'Pausa antes de responder e permite editar a resposta em voo.',
};

const ACTION_TYPE_ORDER: ReadonlyArray<Action['type']> = [
	'breakpoint',
	'mock',
	'transform',
	'delay',
];

const createDefaultActionForType = (type: Action['type']): Action => {
	switch (type) {
		case 'mock':
			return { type: 'mock', enabled: true, status: 200, headers: {} };
		case 'delay':
			return { type: 'delay', enabled: true, timeMs: 1000 };
		case 'transform':
			return { type: 'transform', enabled: true, mode: 'declarative', operations: [] };
		case 'breakpoint':
			return { type: 'breakpoint', enabled: true, description: '' };
		default: {
			const exhaustive: never = type;
			throw new Error(`Tipo de ação não suportado: ${String(exhaustive)}`);
		}
	}
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

interface FieldError {
	id: string;
	message: string;
	step: WizardStep;
}

const RuleEditor: React.FC<RuleEditorProps> = ({
	open,
	mode,
	rule,
	onOpenChange,
	onSave,
	skipTypeStep = false,
	initialDraft,
	headerMatcherSource,
}) => {
	const STEPS = skipTypeStep ? STEPS_WITHOUT_TYPE : FULL_STEPS;
	const [view, setView] = useState<EditorView>(mode === 'edit' ? 'editor' : 'welcome');
	const [cameFromWelcome, setCameFromWelcome] = useState(false);
	const [name, setName] = useState(rule?.name || 'Nova Regra');
	const [matchers, setMatchers] = useState<Matcher[]>(rule?.matchers ?? DEFAULT_MATCHERS);
	const [action, setAction] = useState<Action>(rule?.action ?? DEFAULT_ACTION);
	const [enabled, setEnabled] = useState(rule?.enabled !== false);
	const [step, setStep] = useState<WizardStep>(skipTypeStep ? 'matcher' : 'type');
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
			setStep(skipTypeStep ? 'matcher' : 'type');
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
			if (initialDraft) {
				setName(initialDraft.name);
				setMatchers(initialDraft.matchers);
				setAction(initialDraft.action);
				setEnabled(initialDraft.enabled);
				setView('editor');
				setCameFromWelcome(false);
				setStep(skipTypeStep ? 'matcher' : 'type');
				setMaxStepIndexReached(0);
				setInitialSnapshot(snapshot(initialDraft));
				setShowCancelConfirm(false);
				return;
			}
			setName('Nova Regra');
			setMatchers(DEFAULT_MATCHERS);
			setAction(DEFAULT_ACTION);
			setEnabled(true);
			setView(skipTypeStep ? 'editor' : 'welcome');
			setCameFromWelcome(false);
			setStep(skipTypeStep ? 'matcher' : 'type');
			setMaxStepIndexReached(0);
			setInitialSnapshot('');
			setShowCancelConfirm(false);
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: STEPS é derivado de skipTypeStep
	}, [open, mode, rule, skipTypeStep, initialDraft]);

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

	const applyTemplateDraft = (templateId: RuleTemplateId) => {
		const draft = createTemplateRule(templateId);
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

	const validationErrors = useMemo<FieldError[]>(() => {
		const errors: FieldError[] = [];
		if (!name.trim()) {
			errors.push({
				id: 'name-empty',
				message: 'Informe um nome para a regra',
				step: skipTypeStep ? 'matcher' : 'type',
			});
		}
		const enabledUrlMatcher = matchers.find((m) => m.type === 'url' && m.enabled);
		if (!enabledUrlMatcher) {
			errors.push({
				id: 'url-matcher-missing',
				message: 'A regra precisa de um matcher de URL habilitado',
				step: 'matcher',
			});
		} else if (enabledUrlMatcher.type === 'url' && enabledUrlMatcher.pattern.trim().length === 0) {
			errors.push({
				id: 'url-pattern-empty',
				message: 'Preencha o padrão da URL antes de salvar',
				step: 'matcher',
			});
		}
		const enabledMethodMatcher = matchers.find((m) => m.type === 'method' && m.enabled);
		if (enabledMethodMatcher && enabledMethodMatcher.type === 'method') {
			const methods = Array.isArray(enabledMethodMatcher.method)
				? enabledMethodMatcher.method
				: enabledMethodMatcher.method
					? [enabledMethodMatcher.method]
					: [];
			if (methods.length === 0) {
				errors.push({
					id: 'method-empty',
					message: 'Selecione ao menos um método HTTP ou desative o matcher de método',
					step: 'matcher',
				});
			}
		}
		return errors;
	}, [name, matchers, skipTypeStep]);

	const hasErrors = validationErrors.length > 0;

	const handleSave = async () => {
		if (hasErrors) {
			setStep(validationErrors[0].step);
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

	const handleSelectType = (target: Action['type']) => {
		if (mode === 'edit') return;
		if (action.type === target) return;
		setAction(createDefaultActionForType(target));
	};

	const renderTypeStep = () => {
		const isLocked = mode === 'edit';
		return (
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

				<fieldset className="space-y-2" data-testid="rule-wizard-type-cards">
					<legend className="text-sm font-medium">Tipo de regra</legend>
					<p className="text-xs text-muted-foreground">
						{isLocked
							? 'Em edição, o tipo não pode ser alterado — para mudar o tipo, crie uma nova regra.'
							: 'Escolha o comportamento da regra. Você pode trocar livremente até salvar.'}
					</p>
					<div className="grid gap-3 sm:grid-cols-2">
						{ACTION_TYPE_ORDER.map((t) => {
							const v = getActionVisuals(createDefaultActionForType(t));
							const isSelected = action.type === t;
							const disabled = isLocked && !isSelected;
							return (
								<button
									key={t}
									type="button"
									aria-pressed={isSelected}
									aria-disabled={disabled}
									disabled={disabled}
									onClick={() => handleSelectType(t)}
									className={cn(
										'group flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
										isSelected
											? cn(
													'ring-2 ring-offset-2 ring-offset-background',
													v.borderClass,
													'border-2',
													'bg-card',
												)
											: 'border-muted-foreground/20 bg-card hover:bg-muted/40',
										disabled && 'cursor-not-allowed opacity-50 hover:bg-card',
										!disabled && !isSelected && 'cursor-pointer',
									)}
									data-testid={`rule-wizard-type-card-${t}`}
									data-selected={isSelected ? 'true' : 'false'}
								>
									<div
										className={cn(
											'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
											v.bgClass,
											v.textClass,
										)}
									>
										<LucideIcon name={v.iconName} className="h-5 w-5" />
									</div>
									<div className="flex-1">
										<div className="flex items-center gap-2 text-sm font-medium">
											{v.label}
											{isSelected && (
												<span
													className={cn(
														'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
														v.bgClass,
														v.textClass,
													)}
													data-testid={`rule-wizard-type-card-${t}-selected-badge`}
												>
													<LucideIcon name="check" className="h-3 w-3" />
													Selecionado
												</span>
											)}
										</div>
										<p className="mt-1 text-sm text-muted-foreground">
											{ACTION_TYPE_DESCRIPTION[t]}
										</p>
									</div>
								</button>
							);
						})}
					</div>
				</fieldset>

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
	};

	const renderNameField = () => (
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
	);

	const renderMatcherStep = () => (
		<div className="space-y-3">
			{skipTypeStep && renderNameField()}
			<div>
				<h3 className="mb-1 text-lg font-medium">Condições de Match</h3>
				<p className="mb-4 text-sm text-muted-foreground">
					Defina o padrão de URL e os métodos HTTP que disparam esta regra. O painel à direita
					mostra em tempo real se a regra casaria uma URL de teste.
				</p>
			</div>
			<UnifiedMatcherEditor matchers={matchers} onChange={setMatchers} />
			{headerMatcherSource && (
				<HeaderMatcherSelector
					headers={headerMatcherSource}
					matchers={matchers}
					onChange={setMatchers}
				/>
			)}
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

				{renderDiffSection()}

				{hasErrors ? (
					<div
						className="rounded-lg border border-destructive/40 bg-destructive/10 p-4"
						data-testid="rule-wizard-errors"
					>
						<div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
							<LucideIcon name="alert-triangle" className="h-4 w-4" />
							Corrija os itens abaixo antes de salvar
						</div>
						<ul className="space-y-1 text-sm">
							{validationErrors.map((err) => (
								<li key={err.id}>
									<button
										type="button"
										onClick={() => goToStep(err.step)}
										className="inline-flex items-start gap-2 text-left text-destructive hover:underline"
										data-testid={`rule-wizard-error-${err.id}`}
									>
										<LucideIcon name="x-circle" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
										<span>
											{err.message}
											<span className="ml-1 text-xs text-muted-foreground">
												(passo {STEP_META[err.step].label})
											</span>
										</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<div
						className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
						data-testid="rule-wizard-ready"
					>
						<div className="flex items-center gap-2 font-medium">
							<LucideIcon name="check-circle" className="h-4 w-4" />
							Pronto para salvar
						</div>
						<p className="mt-1 text-xs text-emerald-200/80">
							Todos os campos obrigatórios estão preenchidos.
						</p>
					</div>
				)}
			</div>
		);
	};

	const renderDiffSection = () => {
		if (mode !== 'edit' || !rule) return null;

		const beforeMatcherSummary = getMatcherSummary(rule.matchers);
		const afterMatcherSummary = getMatcherSummary(matchers);
		const beforeActionSummary = getActionSummary(rule.action);
		const afterActionSummary = getActionSummary(action);

		const matchersChanged = JSON.stringify(rule.matchers) !== JSON.stringify(matchers);
		const actionChanged = JSON.stringify(rule.action) !== JSON.stringify(action);
		const nameChanged = rule.name !== name;
		const enabledChanged = rule.enabled !== enabled;

		const anyChange = nameChanged || enabledChanged || matchersChanged || actionChanged;

		if (!anyChange) {
			return (
				<div
					className="rounded-lg border border-muted-foreground/20 bg-muted/40 p-3 text-xs text-muted-foreground"
					data-testid="rule-wizard-diff-empty"
				>
					Nenhuma alteração realizada — salvar manterá a regra como está.
				</div>
			);
		}

		const rows: Array<{
			id: string;
			label: string;
			before: string;
			after: string;
			changed: boolean;
		}> = [
			{
				id: 'name',
				label: 'Nome',
				before: rule.name,
				after: name,
				changed: nameChanged,
			},
			{
				id: 'enabled',
				label: 'Estado',
				before: rule.enabled ? 'Ativa' : 'Pausada',
				after: enabled ? 'Ativa' : 'Pausada',
				changed: enabledChanged,
			},
			{
				id: 'matcher',
				label: 'Matcher',
				before: beforeMatcherSummary,
				after: afterMatcherSummary,
				changed: matchersChanged,
			},
			{
				id: 'action',
				label: 'Ação',
				before: beforeActionSummary,
				after: afterActionSummary,
				changed: actionChanged,
			},
		];

		return (
			<div className="rounded-lg border bg-card p-4" data-testid="rule-wizard-diff">
				<div className="mb-2 flex items-center gap-2 text-sm font-medium">
					<LucideIcon name="rotate-ccw" className="h-4 w-4 text-muted-foreground" />
					Alterações em relação à regra atual
				</div>
				<dl className="space-y-2 text-sm">
					{rows.map((row) => (
						<div
							key={row.id}
							className={cn(
								'grid grid-cols-[110px_1fr] items-start gap-2 rounded px-2 py-1',
								row.changed && 'bg-amber-500/10 ring-1 ring-amber-500/30',
							)}
							data-testid={`rule-wizard-diff-row-${row.id}`}
							data-changed={row.changed ? 'true' : 'false'}
						>
							<dt
								className={cn(
									'text-xs font-medium uppercase tracking-wide',
									row.changed ? 'text-amber-300' : 'text-muted-foreground',
								)}
							>
								{row.label}
							</dt>
							<dd className="break-all">
								{row.changed ? (
									<span className="flex flex-wrap items-center gap-1.5">
										<span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-300 line-through">
											{row.before || '—'}
										</span>
										<LucideIcon
											name="arrow-right"
											className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
										/>
										<span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
											{row.after || '—'}
										</span>
									</span>
								) : (
									<span className="text-muted-foreground">{row.after || '—'}</span>
								)}
							</dd>
						</div>
					))}
				</dl>
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
									? 'Comece do zero ou escolha um template.'
									: STEP_META[step].description}
						</DialogDescription>
					</DialogHeader>

					{isWelcome ? (
						<PresetWelcome onSelectBlank={startBlank} onSelectPreset={applyTemplateDraft} />
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
											disabled={isSaving || hasErrors}
											className="primary-button flex items-center gap-2"
											data-testid="rule-wizard-save"
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
