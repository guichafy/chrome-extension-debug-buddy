import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { InterceptedResponse } from '@/types/intercepted';

interface EditResponseSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	request: InterceptedResponse;
	requestId: string;
	/**
	 * Envia a edição para o background. Retorna `{ success: true }` em caso de
	 * sucesso, ou `{ success: false, error }` quando o `Fetch.fulfillRequest`
	 * falhar — a regra "no fallbacks" exige que o erro seja propagado, não
	 * silenciado com `continueRequest`.
	 */
	onSubmit: (
		requestId: string,
		payload: { status: number; headers: Record<string, string>; body: string },
	) => Promise<{ success: boolean; error?: string }>;
}

interface HeaderRow {
	id: string;
	name: string;
	value: string;
}

const RESERVED_HEADER_NAMES = ['content-length', 'transfer-encoding'];

let rowIdCounter = 0;
const nextRowId = () => `h-${++rowIdCounter}`;

function headersToRows(headers: Record<string, string>): HeaderRow[] {
	return Object.entries(headers).map(([name, value]) => ({ id: nextRowId(), name, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const row of rows) {
		const trimmedName = row.name.trim();
		if (!trimmedName) continue;
		// Headers podem se repetir (ex.: Set-Cookie); keys do Record são únicos
		// — mantemos a última ocorrência (sobrescreve), o que casa com o que o CDP
		// também faz quando recebe headers duplicados em `Fetch.fulfillRequest`.
		result[trimmedName] = row.value;
	}
	return result;
}

function pickInitialBody(request: InterceptedResponse): string {
	const body = request.response?.body ?? request.body;
	if (typeof body !== 'string') {
		// Sem body capturado: começa vazio. O usuário verá um aviso explícito
		// quando bodyUnavailableReason estiver presente (não silenciamos).
		return '';
	}
	return body;
}

function pickInitialHeaders(request: InterceptedResponse): Record<string, string> {
	return request.response?.headers ?? request.headers ?? {};
}

export function EditResponseSheet({
	open,
	onOpenChange,
	request,
	requestId,
	onSubmit,
}: EditResponseSheetProps) {
	const [statusInput, setStatusInput] = useState<string>(String(request.status));
	const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(pickInitialHeaders(request)));
	const [body, setBody] = useState<string>(() => pickInitialBody(request));
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [warningMessage, setWarningMessage] = useState<string | null>(null);
	const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});

	// Mantém o snapshot mais recente de `request` acessível dentro do effect de
	// reset sem entrar nas deps — o reset não deve disparar quando o objeto muda
	// de identidade durante a edição (polling de pendingResponses, body chegando
	// tarde via responseBodyReady, etc.).
	const requestRef = useRef(request);
	useEffect(() => {
		requestRef.current = request;
	}, [request]);

	// Reset state apenas quando o sheet abre (false → true) ou troca de target
	// (requestId muda enquanto aberto). Edições em andamento não devem ser
	// sobrescritas por re-renders do parent que apenas trocam a referência do
	// objeto request com o mesmo conteúdo (ou conteúdo enriquecido).
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps intencionalmente restritas a [open, requestId] — ver comentário acima.
	useEffect(() => {
		if (!open) return;
		const current = requestRef.current;
		setStatusInput(String(current.status));
		setRows(headersToRows(pickInitialHeaders(current)));
		setBody(pickInitialBody(current));
		setErrorMessage(null);
		setWarningMessage(null);
		setHeaderErrors({});
		setSubmitting(false);
	}, [open, requestId]);

	const statusNumber = Number(statusInput);
	const statusValid = Number.isInteger(statusNumber) && statusNumber >= 100 && statusNumber <= 599;

	const updateRow = (id: string, patch: Partial<Omit<HeaderRow, 'id'>>) => {
		setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
		// Limpa o erro inline da linha enquanto o usuário corrige.
		setHeaderErrors((prev) => {
			if (!prev[id]) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
	};

	const removeRow = (id: string) => {
		setRows((prev) => prev.filter((r) => r.id !== id));
		setHeaderErrors((prev) => {
			if (!prev[id]) return prev;
			const next = { ...prev };
			delete next[id];
			return next;
		});
	};

	const addRow = () => {
		setRows((prev) => [...prev, { id: nextRowId(), name: '', value: '' }]);
	};

	const handleSubmit = async () => {
		if (!statusValid) {
			setErrorMessage('Status code precisa ser um inteiro entre 100 e 599.');
			return;
		}

		// Validação: header com valor preenchido mas chave vazia é erro inline.
		// Linhas inteiramente vazias (chave + valor) são tratadas como descartáveis.
		const newHeaderErrors: Record<string, string> = {};
		for (const row of rows) {
			const trimmedName = row.name.trim();
			if (!trimmedName && row.value.trim() !== '') {
				newHeaderErrors[row.id] = 'Header sem nome. Preencha a chave ou remova a linha.';
			}
		}
		if (Object.keys(newHeaderErrors).length > 0) {
			setHeaderErrors(newHeaderErrors);
			setErrorMessage('Há headers com chave vazia. Corrija antes de aplicar.');
			return;
		}
		setHeaderErrors({});

		const headers = rowsToHeaders(rows);

		// Aviso (não bloqueia): se o usuário tocou em Content-Length / Transfer-Encoding,
		// mostramos toast informativo. Esses headers são controlados pelo Chrome e podem
		// ser sobrescritos pela engine ao reenviar.
		const touchedReserved = Object.keys(headers).filter((k) =>
			RESERVED_HEADER_NAMES.includes(k.toLowerCase()),
		);
		if (touchedReserved.length > 0) {
			setWarningMessage(
				`Headers controlados pelo Chrome detectados (${touchedReserved.join(', ')}). O navegador pode sobrescrever esses valores.`,
			);
		} else {
			setWarningMessage(null);
		}

		setErrorMessage(null);
		setSubmitting(true);
		try {
			const result = await onSubmit(requestId, {
				status: statusNumber,
				headers,
				body,
			});
			if (result.success) {
				onOpenChange(false);
				return;
			}
			setErrorMessage(result.error || 'Falha ao aplicar edição.');
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const method = request.method ?? 'GET';

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
				data-testid="edit-response-sheet"
			>
				<SheetHeader className="space-y-2 border-b p-6">
					<SheetTitle>Editar response (one-shot)</SheetTitle>
					<SheetDescription>
						Ajuste status, headers e body desta requisição. A edição é aplicada uma única vez — para
						persistir como regra reutilizável use &quot;Criar Mock&quot;.
					</SheetDescription>
					<div
						className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
						data-testid="edit-response-context"
					>
						<span
							className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary"
							data-testid="edit-response-context-method"
						>
							{method}
						</span>
						<span
							className="break-all font-mono text-muted-foreground"
							data-testid="edit-response-context-url"
							title={request.url}
						>
							{request.url}
						</span>
					</div>
				</SheetHeader>

				<ScrollArea className="min-h-0 flex-1">
					<div className="space-y-4 p-6">
						<div className="space-y-1">
							<Label htmlFor="edit-response-status">Status code</Label>
							<Input
								id="edit-response-status"
								type="number"
								min={100}
								max={599}
								value={statusInput}
								onChange={(e) => setStatusInput(e.target.value)}
								className="max-w-32 font-mono"
								data-testid="edit-response-status-input"
							/>
							{!statusValid && (
								<p className="text-xs text-destructive">
									Status code precisa ser um inteiro entre 100 e 599.
								</p>
							)}
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Response headers</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addRow}
									className="gap-1"
									data-testid="edit-response-add-header"
								>
									<LucideIcon name="plus" className="h-3.5 w-3.5" />
									Adicionar header
								</Button>
							</div>
							{rows.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									Sem headers. Use &quot;Adicionar header&quot; para incluir.
								</p>
							) : (
								<div className="space-y-2" data-testid="edit-response-headers">
									{rows.map((row) => {
										const rowError = headerErrors[row.id];
										return (
											<div key={row.id} className="space-y-1">
												<div
													className="grid items-center gap-2"
													style={{
														gridTemplateColumns: 'minmax(140px, 220px) minmax(0, 1fr) auto',
													}}
												>
													<Input
														placeholder="Header"
														value={row.name}
														onChange={(e) => updateRow(row.id, { name: e.target.value })}
														className="font-mono text-xs"
														data-testid={`edit-response-header-name-${row.id}`}
														aria-invalid={rowError ? 'true' : undefined}
													/>
													<Input
														placeholder="valor"
														value={row.value}
														onChange={(e) => updateRow(row.id, { value: e.target.value })}
														className="font-mono text-xs"
														data-testid={`edit-response-header-value-${row.id}`}
													/>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => removeRow(row.id)}
														aria-label={`Remover header ${row.name || 'sem nome'}`}
														className="h-8 w-8"
													>
														<LucideIcon name="x" className="h-4 w-4" />
													</Button>
												</div>
												{rowError && (
													<p
														className="text-xs text-destructive"
														data-testid={`edit-response-header-error-${row.id}`}
													>
														{rowError}
													</p>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>

						<div className="space-y-1">
							<Label htmlFor="edit-response-body">Response body</Label>
							{request.bodyUnavailableReason && (
								<output
									className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
									data-testid="edit-response-body-unavailable-warning"
								>
									<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
									<span className="break-words">
										Body original indisponível ({request.bodyUnavailableReason}). O textarea começa
										vazio — submeter agora vai responder com body vazio.
									</span>
								</output>
							)}
							<Textarea
								id="edit-response-body"
								value={body}
								onChange={(e) => setBody(e.target.value)}
								rows={10}
								className="font-mono text-xs"
								data-testid="edit-response-body-input"
							/>
						</div>

						{warningMessage && (
							<output
								className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
								data-testid="edit-response-warning-toast"
							>
								<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
								<span className="break-words">{warningMessage}</span>
							</output>
						)}

						{errorMessage && (
							<div
								className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
								data-testid="edit-response-error-toast"
								role="alert"
							>
								<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
								<span className="break-words">{errorMessage}</span>
							</div>
						)}
					</div>
				</ScrollArea>

				<SheetFooter className="border-t p-6">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={submitting}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={handleSubmit}
						disabled={submitting || !statusValid}
						className="gap-2"
						data-testid="edit-response-submit"
					>
						<LucideIcon name="check" className="h-4 w-4" />
						{submitting ? 'Aplicando…' : 'Aplicar e continuar'}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
