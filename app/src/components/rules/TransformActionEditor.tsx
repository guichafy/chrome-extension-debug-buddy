import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TransformAction, TransformOperation, TransformOperationType } from '@/types/rules';
import { applyOperations, parseJsonPath, parseOperationValue } from '@/domain/jsonPatcher';

interface TransformActionEditorProps {
	action: TransformAction;
	onChange: (action: TransformAction) => void;
}

const DEFAULT_SAMPLE_RESPONSE = `{
  "id": 42,
  "name": "Alice",
  "tags": ["admin", "beta"]
}`;

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

const OPERATION_TYPE_LABEL: Record<TransformOperationType, string> = {
	add: 'Adicionar',
	remove: 'Remover',
	replace: 'Substituir',
};

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
}) => {
	const operations = useMemo<TransformOperation[]>(() => action.operations ?? [], [action]);
	const [sampleInput, setSampleInput] = useState<string>(DEFAULT_SAMPLE_RESPONSE);

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
		if (trimmed.length === 0)
			return { ok: false, error: 'Cole uma resposta JSON de exemplo no painel de preview.' };
		try {
			return { ok: true, value: JSON.parse(sampleInput) };
		} catch (e) {
			return { ok: false, error: `JSON de exemplo inválido: ${(e as Error).message}` };
		}
	}, [sampleInput]);

	const previewResult = useMemo(() => {
		if (!sampleParse.ok) {
			return { ok: false as const, error: sampleParse.error, failedAtIndex: -1 };
		}
		if (operations.length === 0) {
			return { ok: true as const, output: sampleParse.value };
		}
		// Se já há erros de path/valor, não tenta executar — sinaliza isso.
		const firstInvalid = operationValidations.findIndex((v) => v.pathError || v.valueError);
		if (firstInvalid >= 0) {
			const v = operationValidations[firstInvalid];
			return {
				ok: false as const,
				error: v.pathError || v.valueError || 'Operação inválida',
				failedAtIndex: firstInvalid,
			};
		}
		return applyOperations(sampleParse.value, operations);
	}, [sampleParse, operations, operationValidations]);

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
						<Label className="text-xs uppercase text-muted-foreground">Tipo</Label>
						<Select
							value={op.type}
							onValueChange={(v: TransformOperationType) => updateOperation(index, { type: v })}
						>
							<SelectTrigger className="mt-1" data-testid={`transform-op-type-${index}`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="add">Adicionar</SelectItem>
								<SelectItem value="remove">Remover</SelectItem>
								<SelectItem value="replace">Substituir</SelectItem>
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
								aria-label={`Mover operação ${index + 1} para cima`}
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
								aria-label={`Mover operação ${index + 1} para baixo`}
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
								aria-label={`Remover operação ${index + 1}`}
								data-testid={`transform-op-remove-${index}`}
							>
								<LucideIcon name="trash" className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				</div>

				{op.type !== 'remove' && (
					<div>
						<Label className="text-xs uppercase text-muted-foreground">Valor (JSON)</Label>
						<Textarea
							className="mt-1 min-h-[60px] font-mono text-sm"
							value={op.value ?? ''}
							onChange={(e) => updateOperation(index, { value: e.target.value })}
							placeholder='"texto entre aspas" ou {"chave": "valor"}'
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
						<p className="mt-1 text-xs text-muted-foreground">
							Strings precisam estar entre aspas. Use JSON literal para objetos e arrays.
						</p>
					</div>
				)}

				{failedHere && previewResult.ok === false && (
					<div
						className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
						data-testid={`transform-op-runtime-error-${index}`}
					>
						<div className="flex items-center gap-1 font-medium">
							<LucideIcon name="alert-triangle" className="h-3.5 w-3.5" />
							Falhou ao aplicar
						</div>
						<p className="mt-0.5">{previewResult.error}</p>
					</div>
				)}
			</div>
		);
	};

	const renderPreviewOutput = (): React.ReactNode => {
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
					Falha no preview
					{previewResult.failedAtIndex >= 0 && (
						<span className="text-[10px] font-normal opacity-80">
							(operação {previewResult.failedAtIndex + 1})
						</span>
					)}
				</div>
				<p className="mt-1">{previewResult.error}</p>
			</output>
		);
	};

	return (
		<div className="space-y-4">
			<div>
				<h4 className="text-sm font-medium">Transform declarativo</h4>
				<p className="mt-1 text-xs text-muted-foreground">
					Configure operações JSONPath para alterar a resposta do servidor. As operações são
					aplicadas em ordem; se uma falhar, as seguintes não serão executadas.
				</p>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,_22rem)]">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label className="text-sm font-medium">Operações ({operations.length})</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addOperation}
							data-testid="transform-op-add"
						>
							<LucideIcon name="plus" className="mr-1 h-3.5 w-3.5" />
							Adicionar operação
						</Button>
					</div>
					{operations.length === 0 ? (
						<div
							className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center text-xs text-muted-foreground"
							data-testid="transform-op-empty"
						>
							Nenhuma operação configurada. Adicione uma operação para começar a transformar a
							resposta.
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
							Resposta de exemplo
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
							Saída transformada
						</Label>
						<div className="mt-1">{renderPreviewOutput()}</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export const __TEST_HELPERS = {
	createOperation,
	OPERATION_TYPE_LABEL,
};
