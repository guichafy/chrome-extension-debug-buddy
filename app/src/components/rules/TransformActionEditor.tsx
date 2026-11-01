import { Trans, useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
	TransformAction,
	TransformMode,
	TransformOperation,
	TransformOperationType,
} from '@/types/rules';
import { applyOperations, parseJsonPath, parseOperationValue } from '@/domain/jsonPatcher';
import {
	type AdvancedScriptResult,
	runAdvancedScript,
	type RunAdvancedScriptOptions,
} from '@/lib/advancedScriptRunner';

interface TransformActionEditorProps {
	action: TransformAction;
	onChange: (action: TransformAction) => void;
	/**
	 * Body capturado da response que está originando esta regra (quando o
	 * usuário cria a partir do Request Inspector). Quando válido como JSON, é
	 * usado como sample inicial do painel de preview; senão cai no exemplo
	 * fixo abaixo.
	 */
	initialSampleResponse?: string;
	/** Hook de teste — sobrescreve o runner padrão para evitar iframe em jsdom. */
	scriptRunner?: (
		script: string,
		response: unknown,
		options?: RunAdvancedScriptOptions,
	) => Promise<AdvancedScriptResult>;
}

const DEFAULT_SAMPLE_RESPONSE = `{
  "id": 42,
  "name": "Alice",
  "tags": ["admin", "beta"]
}`;

function pickInitialSample(provided: string | undefined): string {
	if (provided === undefined) return DEFAULT_SAMPLE_RESPONSE;
	const trimmed = provided.trim();
	if (trimmed.length === 0) return DEFAULT_SAMPLE_RESPONSE;
	try {
		const parsed = JSON.parse(provided);
		return JSON.stringify(parsed, null, 2);
	} catch {
		return provided;
	}
}

// Script inicial do modo avançado: ruleEditor:transform.defaultScript (os
// comentários do script seguem o idioma da UI).

const newId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `op-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const createOperation = (overrides: Partial<TransformOperation> = {}): TransformOperation => ({
	id: newId(),
	type: 'replace',
	path: '$',
	value: '',
	...overrides,
});

// Rótulos dos tipos de operação: ruleEditor:transform.operationTypes.<tipo>.
const OPERATION_TYPES: readonly TransformOperationType[] = ['add', 'remove', 'replace'];

interface OperationValidation {
	pathError?: string;
	valueError?: string;
}

function validateOperation(op: TransformOperation): OperationValidation {
	const result: OperationValidation = {};
	const parsed = parseJsonPath(op.path);
	if (!parsed.ok) result.pathError = parsed.error;
	if (op.type !== 'remove') {
		const v = parseOperationValue(op.value);
		if (!v.ok) result.valueError = v.error;
	}
	return result;
}

export const TransformActionEditor: React.FC<TransformActionEditorProps> = ({
	action,
	onChange,
	initialSampleResponse,
	scriptRunner,
}) => {
	const { t } = useTranslation('ruleEditor');
	const operations = useMemo<TransformOperation[]>(() => action.operations ?? [], [action]);
	const mode: TransformMode = action.mode ?? 'declarative';
	const advancedScript = action.advancedScript ?? '';
	const [sampleInput, setSampleInput] = useState<string>(() =>
		pickInitialSample(initialSampleResponse),
	);

	const handleModeChange = (next: string) => {
		const target = next as TransformMode;
		if (target === mode) return;
		const patch: Partial<TransformAction> = { mode: target };
		// Quando entra em advanced pela primeira vez, popula com um script
		// inicial de exemplo para guiar o usuário (apenas se vazio).
		if (target === 'advanced' && advancedScript.length === 0) {
			patch.advancedScript = t('transform.defaultScript');
		}
		onChange({ ...action, ...patch });
	};

	const commitOperations = (next: TransformOperation[]): void => {
		onChange({
			...action,
			mode: 'declarative',
			operations: next,
		});
	};

	const addOperation = (): void => {
		commitOperations([...operations, createOperation({ type: 'replace', path: '$.', value: '' })]);
	};

	const updateOperation = (index: number, patch: Partial<TransformOperation>): void => {
		const next = operations.map((op, i) => (i === index ? { ...op, ...patch } : op));
		commitOperations(next);
	};

	const removeOperation = (index: number): void => {
		const next = operations.filter((_, i) => i !== index);
		commitOperations(next);
	};

	const moveOperation = (index: number, delta: number): void => {
		const target = index + delta;
		if (target < 0 || target >= operations.length) return;
		const next = [...operations];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		commitOperations(next);
	};

	const operationValidations = useMemo(() => operations.map(validateOperation), [operations]);

	const sampleParse = useMemo<{ ok: true; value: unknown } | { ok: false; error: string }>(() => {
		const trimmed = sampleInput.trim();
		if (trimmed.length === 0) return { ok: false, error: t('transform.errors.sampleMissing') };
		try {
			return { ok: true, value: JSON.parse(sampleInput) };
		} catch (e) {
			return {
				ok: false,
				error: t('transform.errors.sampleInvalid', { message: (e as Error).message }),
			};
		}
	}, [sampleInput, t]);

	const previewResult = useMemo(() => {
		if (!sampleParse.ok) {
			return { ok: false as const, error: sampleParse.error, failedAtIndex: -1 };
		}
		if (operations.length === 0) {
			return { ok: true as const, output: sampleParse.value };
		}
		const firstInvalid = operationValidations.findIndex((v) => v.pathError || v.valueError);
		if (firstInvalid >= 0) {
			const v = operationValidations[firstInvalid];
			return {
				ok: false as const,
				error: v.pathError || v.valueError || t('transform.errors.invalidOperation'),
				failedAtIndex: firstInvalid,
			};
		}
		return applyOperations(sampleParse.value, operations);
	}, [sampleParse, operations, operationValidations, t]);

	// --- Preview do modo avançado (assíncrono) -------------------------
	const [advancedResult, setAdvancedResult] = useState<AdvancedScriptResult | null>(null);
	const [advancedRunning, setAdvancedRunning] = useState<boolean>(false);
	const advancedRequestId = useRef(0);
	const runner = scriptRunner ?? runAdvancedScript;

	useEffect(() => {
		if (mode !== 'advanced') return;
		if (!sampleParse.ok) {
			setAdvancedResult({ ok: false, error: sampleParse.error });
			setAdvancedRunning(false);
			return;
		}
		if (advancedScript.trim().length === 0) {
			setAdvancedResult({
				ok: false,
				error: t('transform.errors.scriptEmpty'),
			});
			setAdvancedRunning(false);
			return;
		}
		const requestId = ++advancedRequestId.current;
		setAdvancedRunning(true);
		runner(advancedScript, sampleParse.value).then((r) => {
			if (requestId !== advancedRequestId.current) return;
			setAdvancedResult(r);
			setAdvancedRunning(false);
		});
	}, [mode, advancedScript, sampleParse, runner, t]);

	const renderOperationRow = (op: TransformOperation, index: number) => {
		const validation = operationValidations[index];
		const failedHere =
			previewResult.ok === false &&
			'failedAtIndex' in previewResult &&
			previewResult.failedAtIndex === index;
		return (
			<div
				key={op.id}
				className={cn(
					'space-y-2 rounded-md border p-3',
					failedHere && 'border-destructive/60 ring-1 ring-destructive/40',
				)}
				data-testid={`transform-op-row-${index}`}
				data-failed={failedHere ? 'true' : 'false'}
			>
				<div className="flex items-start gap-2">
					<div className="w-32 shrink-0">
						<Label className="text-xs uppercase text-muted-foreground">{t('transform.type')}</Label>
						<Select
							value={op.type}
							onValueChange={(v: TransformOperationType) => updateOperation(index, { type: v })}
						>
							<SelectTrigger className="mt-1" data-testid={`transform-op-type-${index}`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{OPERATION_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{t(`transform.operationTypes.${type}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex-1">
						<Label className="text-xs uppercase text-muted-foreground">JSONPath</Label>
						<Input
							className="mt-1 font-mono text-sm"
							value={op.path}
							onChange={(e) => updateOperation(index, { path: e.target.value })}
							placeholder="$.user.name"
							aria-invalid={validation.pathError ? true : undefined}
							data-testid={`transform-op-path-${index}`}
						/>
						{validation.pathError && (
							<p
								className="mt-1 text-xs text-destructive"
								data-testid={`transform-op-path-error-${index}`}
							>
								{validation.pathError}
							</p>
						)}
					</div>
					<div className="flex shrink-0 flex-col items-end gap-1 pt-5">
						<div className="flex gap-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={() => moveOperation(index, -1)}
								disabled={index === 0}
								aria-label={t('transform.moveUp', { position: index + 1 })}
								data-testid={`transform-op-up-${index}`}
							>
								<LucideIcon name="chevron-down" className="h-3.5 w-3.5 rotate-180" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={() => moveOperation(index, 1)}
								disabled={index === operations.length - 1}
								aria-label={t('transform.moveDown', { position: index + 1 })}
								data-testid={`transform-op-down-${index}`}
							>
								<LucideIcon name="chevron-down" className="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0 text-destructive"
								onClick={() => removeOperation(index)}
								aria-label={t('transform.remove', { position: index + 1 })}
								data-testid={`transform-op-remove-${index}`}
							>
								<LucideIcon name="trash" className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				</div>

				{op.type !== 'remove' && (
					<div>
						<Label className="text-xs uppercase text-muted-foreground">
							{t('transform.valueLabel')}
						</Label>
						<Textarea
							className="mt-1 min-h-[60px] font-mono text-sm"
							value={op.value ?? ''}
							onChange={(e) => updateOperation(index, { value: e.target.value })}
							placeholder={t('transform.valuePlaceholder')}
							aria-invalid={validation.valueError ? true : undefined}
							data-testid={`transform-op-value-${index}`}
						/>
						{validation.valueError && (
							<p
								className="mt-1 text-xs text-destructive"
								data-testid={`transform-op-value-error-${index}`}
							>
								{validation.valueError}
							</p>
						)}
						<p className="mt-1 text-xs text-muted-foreground">{t('transform.valueHelp')}</p>
					</div>
				)}

				{failedHere && previewResult.ok === false && (
					<div
						className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
						data-testid={`transform-op-runtime-error-${index}`}
					>
						<div className="flex items-center gap-1 font-medium">
							<LucideIcon name="alert-triangle" className="h-3.5 w-3.5" />
							{t('transform.failedToApply')}
						</div>
						<p className="mt-0.5">{previewResult.error}</p>
					</div>
				)}
			</div>
		);
	};

	const renderDeclarativePreviewOutput = (): React.ReactNode => {
		if (previewResult.ok) {
			return (
				<pre
					className="max-h-72 overflow-auto rounded border bg-muted/40 p-2 text-xs"
					data-testid="transform-preview-output"
				>
					{JSON.stringify(previewResult.output, null, 2)}
				</pre>
			);
		}
		return (
			<output
				className="block rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
				data-testid="transform-preview-error"
				aria-live="polite"
			>
				<div className="flex items-center gap-1 font-medium">
					<LucideIcon name="alert-triangle" className="h-3.5 w-3.5" />
					{t('transform.previewFailed')}
					{previewResult.failedAtIndex >= 0 && (
						<span className="text-[10px] font-normal opacity-80">
							{t('transform.failedOperation', { position: previewResult.failedAtIndex + 1 })}
						</span>
					)}
				</div>
				<p className="mt-1">{previewResult.error}</p>
			</output>
		);
	};

	const renderDeclarativeMode = () => (
		<div className="space-y-4">
			<div>
				<h4 className="text-sm font-medium">{t('transform.declarativeTitle')}</h4>
				<p className="mt-1 text-xs text-muted-foreground">{t('transform.declarativeHelp')}</p>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,_22rem)]">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label className="text-sm font-medium">
							{t('transform.operations', { total: operations.length })}
						</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addOperation}
							data-testid="transform-op-add"
						>
							<LucideIcon name="plus" className="mr-1 h-3.5 w-3.5" />
							{t('transform.addOperation')}
						</Button>
					</div>
					{operations.length === 0 ? (
						<div
							className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center text-xs text-muted-foreground"
							data-testid="transform-op-empty"
						>
							{t('transform.noOperations')}
						</div>
					) : (
						<div className="space-y-2">
							{operations.map((op, idx) => renderOperationRow(op, idx))}
						</div>
					)}
				</div>

				<div className="space-y-3">
					<div>
						<Label className="text-xs font-medium uppercase text-muted-foreground">
							{t('transform.sampleResponse')}
						</Label>
						<Textarea
							className="mt-1 h-40 font-mono text-xs"
							value={sampleInput}
							onChange={(e) => setSampleInput(e.target.value)}
							placeholder='{"foo": "bar"}'
							aria-invalid={!sampleParse.ok}
							data-testid="transform-preview-sample"
						/>
						{!sampleParse.ok && (
							<p className="mt-1 text-xs text-destructive">{sampleParse.error}</p>
						)}
					</div>
					<div>
						<Label className="text-xs font-medium uppercase text-muted-foreground">
							{t('transform.transformedOutput')}
						</Label>
						<div className="mt-1">{renderDeclarativePreviewOutput()}</div>
					</div>
				</div>
			</div>
		</div>
	);

	const renderAdvancedPreviewOutput = (): React.ReactNode => {
		if (advancedRunning && advancedResult === null) {
			return (
				<div
					className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground"
					data-testid="transform-advanced-preview-pending"
				>
					{t('transform.runningScript')}
				</div>
			);
		}
		if (!advancedResult) {
			return (
				<div
					className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground"
					data-testid="transform-advanced-preview-idle"
				>
					{t('transform.waitingScript')}
				</div>
			);
		}
		if (advancedResult.ok) {
			return (
				<pre
					className="max-h-72 overflow-auto rounded border bg-muted/40 p-2 text-xs"
					data-testid="transform-advanced-preview-output"
				>
					{JSON.stringify(advancedResult.output, null, 2)}
				</pre>
			);
		}
		return (
			<output
				className="block rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
				data-testid="transform-advanced-preview-error"
				aria-live="polite"
			>
				<div className="flex items-center gap-1 font-medium">
					<LucideIcon name="alert-triangle" className="h-3.5 w-3.5" />
					{t('transform.previewFailed')}
				</div>
				<p className="mt-1">{advancedResult.error}</p>
			</output>
		);
	};

	const renderAdvancedMode = () => (
		<div className="space-y-4">
			<div>
				<h4 className="text-sm font-medium">{t('transform.advancedTitle')}</h4>
				<p className="mt-1 text-xs text-muted-foreground">{t('transform.advancedHelp')}</p>
			</div>

			<output
				className="block rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
				data-testid="transform-advanced-security-warning"
				aria-live="polite"
			>
				<div className="flex items-center gap-2 font-medium">
					<LucideIcon name="alert-triangle" className="h-4 w-4" />
					{t('transform.securityTitle')}
				</div>
				<p className="mt-1">{t('transform.securityText')}</p>
			</output>

			<div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,_22rem)]">
				<div className="space-y-2">
					<Label className="text-xs font-medium uppercase text-muted-foreground">
						{t('transform.functionLabel')}
					</Label>
					<div className="rounded-md border bg-muted/30 p-2">
						<div
							className="select-none px-2 pt-1 font-mono text-xs text-muted-foreground"
							data-testid="transform-advanced-signature-prefix"
						>
							const transform = (response) ={'>'} {'{'}
						</div>
						<Textarea
							className="mt-1 min-h-[200px] resize-y border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
							value={advancedScript}
							onChange={(e) =>
								onChange({ ...action, mode: 'advanced', advancedScript: e.target.value })
							}
							placeholder="return { ...response };"
							spellCheck={false}
							aria-label={t('transform.functionAriaLabel')}
							data-testid="transform-advanced-script"
						/>
						<div
							className="select-none px-2 pb-1 font-mono text-xs text-muted-foreground"
							data-testid="transform-advanced-signature-suffix"
						>
							{'};'}
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						<Trans
							t={t}
							i18nKey="transform.signatureHelp"
							components={{ code: <code className="font-mono" /> }}
						/>
					</p>
				</div>

				<div className="space-y-3">
					<div>
						<Label className="text-xs font-medium uppercase text-muted-foreground">
							{t('transform.sampleResponse')}
						</Label>
						<Textarea
							className="mt-1 h-40 font-mono text-xs"
							value={sampleInput}
							onChange={(e) => setSampleInput(e.target.value)}
							placeholder='{"foo": "bar"}'
							aria-invalid={!sampleParse.ok}
							data-testid="transform-advanced-sample"
						/>
						{!sampleParse.ok && (
							<p className="mt-1 text-xs text-destructive">{sampleParse.error}</p>
						)}
					</div>
					<div>
						<Label className="text-xs font-medium uppercase text-muted-foreground">
							{t('transform.transformedOutput')}
						</Label>
						<div className="mt-1">{renderAdvancedPreviewOutput()}</div>
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<Tabs
			value={mode}
			onValueChange={handleModeChange}
			className="space-y-4"
			data-testid="transform-mode-tabs"
		>
			<TabsList>
				<TabsTrigger value="declarative" data-testid="transform-mode-declarative">
					{t('transform.modeDeclarative')}
				</TabsTrigger>
				<TabsTrigger value="advanced" data-testid="transform-mode-advanced">
					{t('transform.modeAdvanced')}
				</TabsTrigger>
			</TabsList>
			<TabsContent value="declarative">{renderDeclarativeMode()}</TabsContent>
			<TabsContent value="advanced">{renderAdvancedMode()}</TabsContent>
		</Tabs>
	);
};

export const __TEST_HELPERS = {
	createOperation,
};
