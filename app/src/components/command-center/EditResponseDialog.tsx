import { useEffect, useMemo, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { InterceptedResponse } from '@/types/intercepted';

interface EditResponseDialogProps {
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

export function EditResponseDialog({
	open,
	onOpenChange,
	request,
	requestId,
	onSubmit,
}: EditResponseDialogProps) {
	const initialStatus = request.status;
	const initialHeaders = useMemo(() => pickInitialHeaders(request), [request]);
	const initialBody = useMemo(() => pickInitialBody(request), [request]);

	const [statusInput, setStatusInput] = useState<string>(String(initialStatus));
	const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(initialHeaders));
	const [body, setBody] = useState<string>(initialBody);
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [warningMessage, setWarningMessage] = useState<string | null>(null);

	// Reset state quando o dialog abre para outra request (request troca enquanto
	// dialog estava montado mas fechado).
	useEffect(() => {
		if (!open) return;
		setStatusInput(String(initialStatus));
		setRows(headersToRows(initialHeaders));
		setBody(initialBody);
		setErrorMessage(null);
		setWarningMessage(null);
		setSubmitting(false);
	}, [open, initialStatus, initialHeaders, initialBody]);

	const statusNumber = Number(statusInput);
	const statusValid = Number.isInteger(statusNumber) && statusNumber >= 100 && statusNumber <= 599;

	const updateRow = (id: string, patch: Partial<Omit<HeaderRow, 'id'>>) => {
		setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
	};

	const removeRow = (id: string) => {
		setRows((prev) => prev.filter((r) => r.id !== id));
	};

	const addRow = () => {
		setRows((prev) => [...prev, { id: nextRowId(), name: '', value: '' }]);
	};

	const handleSubmit = async () => {
		if (!statusValid) {
			setErrorMessage('Status code precisa ser um inteiro entre 100 e 599.');
			return;
		}

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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[90vh] max-w-3xl flex-col"
				data-testid="edit-response-dialog"
			>
				<DialogHeader>
					<DialogTitle>Editar response (one-shot)</DialogTitle>
					<DialogDescription>
						Ajuste status, headers e body desta requisição. A edição é aplicada uma única vez — para
						persistir como regra reutilizável use &quot;Criar Mock&quot;.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="min-h-0 flex-1 pr-2">
					<div className="space-y-4">
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
								<Label>Headers</Label>
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
									{rows.map((row) => (
										<div
											key={row.id}
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
									))}
								</div>
							)}
						</div>

						<div className="space-y-1">
							<Label htmlFor="edit-response-body">Body</Label>
							{request.bodyUnavailableReason && (
								<p className="text-xs text-muted-foreground">
									Aviso: {request.bodyUnavailableReason}
								</p>
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

				<DialogFooter className="mt-4">
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
						{submitting ? 'Aplicando…' : 'Aprovar com edição'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
