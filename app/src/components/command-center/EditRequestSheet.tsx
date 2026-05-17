// Phase 5 — edição manual de uma request pausada em breakpoint do Request
// stage. Espelha o EditResponseSheet mas opera sobre URL/method/headers/
// postData (campos do request) e libera via Fetch.continueRequest com payload.
//
// Botões:
// - "Aprovar sem modificações"     → continueRequest sem args (pass-through).
// - "Aprovar com modificações"     → continueRequest com payload (URL/method/
//                                    headers/postData modificados).
// - "Cancelar"                     → Fetch.failRequest com errorReason='Aborted'.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { PendingInterception } from '@/lib/interceptionPipeline';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

interface EditRequestSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entry: PendingInterception;
	/** Aprovar pass-through (sem nenhuma modificação). */
	onApprove: (requestId: string) => Promise<boolean>;
	/**
	 * Aprovar enviando o payload modificado. A UI propaga `success: false` +
	 * `error` quando o CDP falha — regra "no fallbacks" exige toast visível.
	 */
	onApproveWithEdit: (
		requestId: string,
		payload: { url: string; method: string; headers: Record<string, string>; postData: string },
	) => Promise<{ success: boolean; error?: string }>;
	/** Cancelar a request (Fetch.failRequest). */
	onCancel: (requestId: string) => Promise<boolean>;
}

interface HeaderRow {
	id: string;
	name: string;
	value: string;
}

let rowIdCounter = 0;
const nextRowId = () => `req-h-${++rowIdCounter}`;

function headersToRows(headers: Record<string, string>): HeaderRow[] {
	return Object.entries(headers).map(([name, value]) => ({ id: nextRowId(), name, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const row of rows) {
		const trimmedName = row.name.trim();
		if (!trimmedName) continue;
		result[trimmedName] = row.value;
	}
	return result;
}

function inferInitialMethod(entry: PendingInterception): string {
	const upper = entry.method?.toUpperCase();
	if (upper && (HTTP_METHODS as readonly string[]).includes(upper)) return upper;
	return 'GET';
}

export function EditRequestSheet({
	open,
	onOpenChange,
	entry,
	onApprove,
	onApproveWithEdit,
	onCancel,
}: EditRequestSheetProps) {
	const [url, setUrl] = useState<string>(entry.url);
	const [method, setMethod] = useState<string>(inferInitialMethod(entry));
	const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(entry.request.headers));
	const [postData, setPostData] = useState<string>(entry.request.postData ?? '');
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});

	const entryRef = useRef(entry);
	useEffect(() => {
		entryRef.current = entry;
	}, [entry]);

	// Reset somente quando o sheet abre ou troca de target (requestId muda
	// enquanto aberto). Re-renders do pai com o mesmo conteúdo não devem
	// sobrescrever edição em andamento.
	// biome-ignore lint/correctness/useExhaustiveDependencies: deps intencionalmente restritas — ver comentário.
	useEffect(() => {
		if (!open) return;
		const current = entryRef.current;
		setUrl(current.url);
		setMethod(inferInitialMethod(current));
		setRows(headersToRows(current.request.headers));
		setPostData(current.request.postData ?? '');
		setErrorMessage(null);
		setHeaderErrors({});
		setSubmitting(false);
	}, [open, entry.requestId]);

	const updateRow = (id: string, patch: Partial<Omit<HeaderRow, 'id'>>) => {
		setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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

	const urlValid = url.trim().length > 0;

	const handleApproveNoMods = async () => {
		setSubmitting(true);
		setErrorMessage(null);
		try {
			const ok = await onApprove(entry.requestId);
			if (ok) {
				onOpenChange(false);
				return;
			}
			setErrorMessage('Falha ao aprovar — ver console do background pra detalhes.');
		} finally {
			setSubmitting(false);
		}
	};

	const handleApproveWithMods = async () => {
		if (!urlValid) {
			setErrorMessage('URL não pode ficar vazia.');
			return;
		}
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
		setErrorMessage(null);
		setSubmitting(true);
		try {
			const headers = rowsToHeaders(rows);
			const result = await onApproveWithEdit(entry.requestId, {
				url,
				method,
				headers,
				postData,
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

	const handleCancel = async () => {
		setSubmitting(true);
		setErrorMessage(null);
		try {
			const ok = await onCancel(entry.requestId);
			if (ok) {
				onOpenChange(false);
				return;
			}
			setErrorMessage('Falha ao cancelar — ver console do background pra detalhes.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
				data-testid="edit-request-sheet"
			>
				<SheetHeader className="space-y-2 border-b p-6">
					<SheetTitle>Editar request (breakpoint)</SheetTitle>
					<SheetDescription>
						Ajuste URL, método, headers e body antes de liberar para a rede. A edição é aplicada uma
						única vez — use as regras para mudanças persistentes.
					</SheetDescription>
					<div
						className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
						data-testid="edit-request-context"
					>
						<span
							className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary"
							data-testid="edit-request-context-method"
						>
							{entry.method}
						</span>
						<span
							className="break-all font-mono text-muted-foreground"
							data-testid="edit-request-context-url"
							title={entry.url}
						>
							{entry.url}
						</span>
					</div>
				</SheetHeader>

				<ScrollArea className="min-h-0 flex-1">
					<div className="space-y-4 p-6">
						<div className="space-y-1">
							<Label htmlFor="edit-request-url">URL</Label>
							<Input
								id="edit-request-url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								className="font-mono"
								data-testid="edit-request-url-input"
								aria-invalid={!urlValid ? 'true' : undefined}
							/>
							{!urlValid && <p className="text-xs text-destructive">URL não pode ficar vazia.</p>}
						</div>

						<div className="space-y-1">
							<Label htmlFor="edit-request-method">Método</Label>
							<Select value={method} onValueChange={setMethod}>
								<SelectTrigger
									id="edit-request-method"
									className="max-w-40"
									data-testid="edit-request-method-trigger"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{HTTP_METHODS.map((m) => (
										<SelectItem key={m} value={m}>
											{m}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Request headers</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addRow}
									className="gap-1"
									data-testid="edit-request-add-header"
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
								<div className="space-y-2" data-testid="edit-request-headers">
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
														data-testid={`edit-request-header-name-${row.id}`}
														aria-invalid={rowError ? 'true' : undefined}
													/>
													<Input
														placeholder="valor"
														value={row.value}
														onChange={(e) => updateRow(row.id, { value: e.target.value })}
														className="font-mono text-xs"
														data-testid={`edit-request-header-value-${row.id}`}
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
														data-testid={`edit-request-header-error-${row.id}`}
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
							<Label htmlFor="edit-request-body">Request body (postData)</Label>
							<Textarea
								id="edit-request-body"
								value={postData}
								onChange={(e) => setPostData(e.target.value)}
								rows={10}
								className="font-mono text-xs"
								data-testid="edit-request-body-input"
								placeholder="Vazio para GET/HEAD ou body raw. Para JSON, cole o objeto serializado."
							/>
						</div>

						{errorMessage && (
							<div
								className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
								data-testid="edit-request-error-toast"
								role="alert"
							>
								<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
								<span className="break-words">{errorMessage}</span>
							</div>
						)}
					</div>
				</ScrollArea>

				<SheetFooter className="flex !flex-row items-center !justify-between gap-2 border-t p-6">
					<Button
						type="button"
						variant="destructive"
						onClick={handleCancel}
						disabled={submitting}
						className="gap-2"
						data-testid="edit-request-cancel"
					>
						<LucideIcon name="x-circle" className="h-4 w-4" />
						Cancelar (failRequest)
					</Button>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={handleApproveNoMods}
							disabled={submitting}
							className="gap-2"
							data-testid="edit-request-approve-no-mods"
						>
							<LucideIcon name="play" className="h-4 w-4" />
							Aprovar sem modificações
						</Button>
						<Button
							type="button"
							onClick={handleApproveWithMods}
							disabled={submitting || !urlValid}
							className="gap-2"
							data-testid="edit-request-approve-with-mods"
						>
							<LucideIcon name="check" className="h-4 w-4" />
							{submitting ? 'Aplicando…' : 'Aprovar com modificações'}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

export default EditRequestSheet;
