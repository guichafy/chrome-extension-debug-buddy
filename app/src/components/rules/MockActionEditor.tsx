import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { MockAction, MockLatency } from '@/types/rules';

interface MockActionEditorProps {
	action: MockAction;
	onChange: (action: MockAction) => void;
}

interface StatusPreset {
	code: number;
	label: string;
}

// Presets de status code exigidos pelo PRD US-013.
const STATUS_PRESETS: readonly StatusPreset[] = [
	{ code: 200, label: '200 OK' },
	{ code: 204, label: '204 No Content' },
	{ code: 400, label: '400 Bad Request' },
	{ code: 401, label: '401 Unauthorized' },
	{ code: 403, label: '403 Forbidden' },
	{ code: 404, label: '404 Not Found' },
	{ code: 500, label: '500 Server Error' },
];

const isValidStatusString = (value: string): boolean => {
	const trimmed = value.trim();
	if (trimmed.length === 0) return false;
	if (!/^\d+$/.test(trimmed)) return false;
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599;
};

const parseLatencyValue = (value: string): number | null => {
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	if (!/^\d+$/.test(trimmed)) return null;
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

type JsonValidation = { kind: 'empty' } | { kind: 'valid' } | { kind: 'invalid'; message: string };

const validateJson = (raw: string): JsonValidation => {
	if (raw.trim().length === 0) return { kind: 'empty' };
	try {
		JSON.parse(raw);
		return { kind: 'valid' };
	} catch (e) {
		return { kind: 'invalid', message: (e as Error).message };
	}
};

export const MockActionEditor: React.FC<MockActionEditorProps> = ({ action, onChange }) => {
	const [activeTab, setActiveTab] = useState<string>('response');
	const [headerName, setHeaderName] = useState('');
	const [headerValue, setHeaderValue] = useState('');
	const [statusInput, setStatusInput] = useState<string>(String(action.status));
	const [statusError, setStatusError] = useState<string | null>(null);
	const [formatError, setFormatError] = useState<string | null>(null);

	useEffect(() => {
		setStatusInput(String(action.status));
		setStatusError(null);
	}, [action.status]);

	const hasBody = action.body !== undefined;
	const latencyMode = action.latency?.mode ?? 'none';

	const bodyValidation = useMemo<JsonValidation>(() => {
		if (!hasBody) return { kind: 'empty' };
		return validateJson(action.body ?? '');
	}, [hasBody, action.body]);

	const commitStatus = (status: number): void => {
		onChange({ ...action, status });
	};

	const handleStatusInputChange = (raw: string): void => {
		setStatusInput(raw);
		setStatusError(null);
		const trimmed = raw.trim();
		if (trimmed.length === 0) {
			setStatusError('Informe um status code HTTP.');
			return;
		}
		if (!/^\d+$/.test(trimmed)) {
			setStatusError('O status precisa conter apenas dígitos.');
			return;
		}
		const parsed = Number.parseInt(trimmed, 10);
		if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
			setStatusError('O status deve estar entre 100 e 599.');
			return;
		}
		if (parsed !== action.status) {
			commitStatus(parsed);
		}
	};

	const applyStatusPreset = (code: number): void => {
		setStatusInput(String(code));
		setStatusError(null);
		commitStatus(code);
	};

	const updateContentType = (value: string) => {
		const trimmed = value.trim();
		onChange({
			...action,
			contentType: trimmed.length > 0 ? trimmed : undefined,
		});
	};

	const updateStatusPhrase = (value: string) => {
		const trimmed = value.trim();
		onChange({
			...action,
			statusPhrase: trimmed.length > 0 ? trimmed : undefined,
		});
	};

	const updateBodyEnabled = (checked: boolean) => {
		onChange({
			...action,
			body: checked ? (action.body ?? '') : undefined,
		});
		setFormatError(null);
	};

	const updateBody = (value: string): void => {
		setFormatError(null);
		onChange({ ...action, body: value });
	};

	const formatBodyAsJson = (): void => {
		const current = action.body ?? '';
		const validation = validateJson(current);
		if (validation.kind === 'empty') {
			setFormatError('O body está vazio — nada para formatar.');
			return;
		}
		if (validation.kind === 'invalid') {
			setFormatError(`JSON inválido: ${validation.message}`);
			return;
		}
		try {
			const parsed = JSON.parse(current);
			const formatted = JSON.stringify(parsed, null, 2);
			setFormatError(null);
			onChange({ ...action, body: formatted });
		} catch (e) {
			setFormatError(`Falhou ao formatar: ${(e as Error).message}`);
		}
	};

	const addHeader = () => {
		if (!headerName.trim() || !headerValue.trim()) return;
		const newHeaders = {
			...action.headers,
			[headerName.trim()]: headerValue.trim(),
		};
		onChange({ ...action, headers: newHeaders });
		setHeaderName('');
		setHeaderValue('');
	};

	const removeHeader = (name: string) => {
		const newHeaders = { ...action.headers };
		delete newHeaders[name];
		onChange({ ...action, headers: newHeaders });
	};

	const updateLatency = (latency?: MockLatency) => {
		onChange({ ...action, latency });
	};

	const renderBodyValidation = (): React.ReactNode => {
		if (!hasBody) return null;
		if (bodyValidation.kind === 'empty') {
			return (
				<p
					className="mt-1 text-xs text-muted-foreground"
					data-testid="mock-action-body-validation-empty"
				>
					Body vazio. Insira JSON ou outro conteúdo de texto.
				</p>
			);
		}
		if (bodyValidation.kind === 'valid') {
			return (
				<p
					className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400"
					data-testid="mock-action-body-validation-valid"
				>
					<LucideIcon name="check-circle" className="h-3.5 w-3.5" />
					JSON válido
				</p>
			);
		}
		return (
			<p
				className="mt-1 inline-flex items-start gap-1 text-xs text-destructive"
				data-testid="mock-action-body-validation-error"
			>
				<LucideIcon name="alert-triangle" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
				<span>JSON inválido: {bodyValidation.message}</span>
			</p>
		);
	};

	return (
		<div className="space-y-4" data-testid="mock-action-editor">
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="w-full mb-4">
					<TabsTrigger value="response" className="flex-1">
						Resposta
					</TabsTrigger>
					<TabsTrigger value="headers" className="flex-1">
						Headers
					</TabsTrigger>
					<TabsTrigger value="body" className="flex-1">
						Body
					</TabsTrigger>
					<TabsTrigger value="latency" className="flex-1">
						Latência
					</TabsTrigger>
				</TabsList>

				<TabsContent value="response" className="space-y-4">
					<div>
						<Label htmlFor="mock-action-status-input" className="font-medium">
							Status code
						</Label>
						<Input
							id="mock-action-status-input"
							data-testid="mock-action-status-input"
							type="number"
							inputMode="numeric"
							min={100}
							max={599}
							value={statusInput}
							onChange={(e) => handleStatusInputChange(e.target.value)}
							placeholder="200"
							className={cn(
								'w-full',
								statusError && 'border-destructive focus-visible:ring-destructive',
							)}
							aria-invalid={statusError ? 'true' : 'false'}
							aria-describedby={statusError ? 'mock-action-status-error' : undefined}
						/>
						{statusError ? (
							<p
								id="mock-action-status-error"
								data-testid="mock-action-status-error"
								className="mt-1 text-xs text-destructive"
							>
								{statusError}
							</p>
						) : (
							<p className="mt-1 text-xs text-muted-foreground">
								Use um valor entre 100 e 599 ou clique em um preset abaixo.
							</p>
						)}
					</div>

					<fieldset>
						<legend className="text-sm font-medium">Presets rápidos</legend>
						<div className="mt-2 flex flex-wrap gap-2" data-testid="mock-action-status-presets">
							{STATUS_PRESETS.map((preset) => {
								const isSelected =
									action.status === preset.code && isValidStatusString(statusInput);
								return (
									<Button
										key={preset.code}
										type="button"
										size="sm"
										variant={isSelected ? 'default' : 'outline'}
										onClick={() => applyStatusPreset(preset.code)}
										data-testid={`mock-action-status-preset-${preset.code}`}
										data-selected={isSelected ? 'true' : 'false'}
										aria-pressed={isSelected}
									>
										{preset.label}
									</Button>
								);
							})}
						</div>
					</fieldset>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<Label htmlFor="mock-action-status-phrase">Status text</Label>
							<Input
								id="mock-action-status-phrase"
								data-testid="mock-action-status-phrase"
								value={action.statusPhrase ?? ''}
								onChange={(e) => updateStatusPhrase(e.target.value)}
								placeholder="Created"
							/>
						</div>
						<div>
							<Label htmlFor="mock-action-content-type">Content-Type</Label>
							<Input
								id="mock-action-content-type"
								data-testid="mock-action-content-type"
								value={action.contentType ?? ''}
								onChange={(e) => updateContentType(e.target.value)}
								placeholder="application/json"
							/>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="headers" className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label htmlFor="mock-action-header-name">Nome do header</Label>
							<Input
								id="mock-action-header-name"
								data-testid="mock-action-header-name"
								value={headerName}
								onChange={(e) => setHeaderName(e.target.value)}
								placeholder="Content-Type"
							/>
						</div>
						<div>
							<Label htmlFor="mock-action-header-value">Valor do header</Label>
							<div className="flex space-x-2">
								<Input
									id="mock-action-header-value"
									data-testid="mock-action-header-value"
									value={headerValue}
									onChange={(e) => setHeaderValue(e.target.value)}
									placeholder="application/json"
								/>
								<Button
									type="button"
									onClick={addHeader}
									disabled={!headerName.trim() || !headerValue.trim()}
									data-testid="mock-action-header-add"
								>
									<LucideIcon name="plus" className="mr-1 h-3.5 w-3.5" />
									Adicionar
								</Button>
							</div>
						</div>
					</div>

					<div
						className="border rounded-md p-3 bg-background"
						data-testid="mock-action-headers-list"
					>
						<h4 className="text-sm font-medium mb-2">Headers configurados</h4>
						{Object.keys(action.headers).length > 0 ? (
							<div className="space-y-2">
								{Object.entries(action.headers).map(([name, value]) => (
									<div
										key={name}
										className="flex justify-between items-center p-2 bg-muted rounded-md"
										data-testid={`mock-action-header-row-${name}`}
									>
										<div className="break-all text-sm">
											<span className="font-medium">{name}:</span> {value}
										</div>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => removeHeader(name)}
											className="h-8 w-8 p-0 text-destructive"
											data-testid={`mock-action-header-remove-${name}`}
											aria-label={`Remover header ${name}`}
										>
											<LucideIcon name="x" className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">Nenhum header configurado</p>
						)}
					</div>
				</TabsContent>

				<TabsContent value="body" className="space-y-3">
					<div className="flex items-center space-x-2">
						<Checkbox
							id="mock-response-body-enabled"
							data-testid="mock-action-body-enabled"
							checked={hasBody}
							onCheckedChange={(checked) => updateBodyEnabled(checked === true)}
						/>
						<Label htmlFor="mock-response-body-enabled">Enviar body na resposta mockada</Label>
					</div>
					<div>
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="mock-action-body">Corpo da resposta (JSON)</Label>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={formatBodyAsJson}
								disabled={!hasBody || bodyValidation.kind !== 'valid'}
								data-testid="mock-action-body-format"
							>
								<LucideIcon name="sparkles" className="mr-1 h-3.5 w-3.5" />
								Formatar JSON
							</Button>
						</div>
						<Textarea
							id="mock-action-body"
							data-testid="mock-action-body-textarea"
							value={action.body ?? ''}
							onChange={(e) => updateBody(e.target.value)}
							placeholder='{"success": true, "message": "Resposta mockada"}'
							className={cn(
								'font-mono h-64',
								hasBody &&
									bodyValidation.kind === 'invalid' &&
									'border-destructive focus-visible:ring-destructive',
							)}
							disabled={!hasBody}
							aria-invalid={hasBody && bodyValidation.kind === 'invalid' ? 'true' : 'false'}
						/>
						{!hasBody && (
							<p className="mt-2 text-sm text-muted-foreground">
								O mock será enviado sem corpo de resposta.
							</p>
						)}
						{renderBodyValidation()}
						{formatError && (
							<p
								className="mt-1 inline-flex items-start gap-1 text-xs text-destructive"
								data-testid="mock-action-body-format-error"
							>
								<LucideIcon name="alert-triangle" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
								<span>{formatError}</span>
							</p>
						)}
					</div>
				</TabsContent>

				<TabsContent value="latency" className="space-y-4">
					<div>
						<Label>Latência artificial</Label>
						<Select
							value={latencyMode}
							onValueChange={(value: 'none' | 'fixed' | 'range') => {
								if (value === 'none') {
									updateLatency();
								} else if (value === 'fixed') {
									const delayMs = action.latency?.mode === 'fixed' ? action.latency.delayMs : 0;
									updateLatency({ mode: 'fixed', delayMs });
								} else {
									const previousDelay =
										action.latency?.mode === 'fixed' ? action.latency.delayMs : 0;
									const minMs =
										action.latency?.mode === 'range' ? action.latency.minMs : previousDelay;
									const maxMs =
										action.latency?.mode === 'range' ? action.latency.maxMs : previousDelay;
									updateLatency({ mode: 'range', minMs, maxMs });
								}
							}}
						>
							<SelectTrigger data-testid="mock-action-latency-mode">
								<SelectValue placeholder="Selecione a latência" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sem latência artificial</SelectItem>
								<SelectItem value="fixed">Fixa</SelectItem>
								<SelectItem value="range">Range dinâmico</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{action.latency?.mode === 'fixed' && (
						<div>
							<Label htmlFor="mock-action-latency-delay">Delay em ms</Label>
							<Input
								id="mock-action-latency-delay"
								data-testid="mock-action-latency-delay"
								type="number"
								min={0}
								value={action.latency.delayMs}
								onChange={(e) => {
									const delayMs = parseLatencyValue(e.target.value);
									if (delayMs !== null) {
										updateLatency({ mode: 'fixed', delayMs });
									}
								}}
							/>
						</div>
					)}

					{action.latency?.mode === 'range' && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label htmlFor="mock-action-latency-min">Delay mínimo em ms</Label>
								<Input
									id="mock-action-latency-min"
									data-testid="mock-action-latency-min"
									type="number"
									min={0}
									value={action.latency.minMs}
									onChange={(e) => {
										const minMs = parseLatencyValue(e.target.value);
										if (minMs !== null && action.latency?.mode === 'range') {
											updateLatency({ ...action.latency, minMs });
										}
									}}
								/>
							</div>
							<div>
								<Label htmlFor="mock-action-latency-max">Delay máximo em ms</Label>
								<Input
									id="mock-action-latency-max"
									data-testid="mock-action-latency-max"
									type="number"
									min={0}
									value={action.latency.maxMs}
									onChange={(e) => {
										const maxMs = parseLatencyValue(e.target.value);
										if (maxMs !== null && action.latency?.mode === 'range') {
											updateLatency({ ...action.latency, maxMs });
										}
									}}
								/>
							</div>
						</div>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default MockActionEditor;
