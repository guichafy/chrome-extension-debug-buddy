import React, { useMemo, useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Badge } from '@/components/ui/badge';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import {
	buildQuickMockDraft,
	type QuickMockHeaderSelection,
	type QuickMockOptions,
} from '@/domain/quickMock';
import { isSensitiveHeader, maskHeaderValue } from '@/domain/sensitiveHeaders';
import { useRules } from '@/hooks/useRules';

interface QuickMockPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	request: InterceptedResponse;
	requestId: string;
	onCreated?: (rule: Rule) => void;
}

interface HeaderRow {
	headerType: 'request' | 'response';
	name: string;
	value: string;
	sensitive: boolean;
	checked: boolean;
}

function buildInitialHeaderRows(request: InterceptedResponse): HeaderRow[] {
	const rows: HeaderRow[] = [];
	const reqHeaders = request.request?.headers ?? {};
	const resHeaders = request.response?.headers ?? request.headers;
	for (const [name, value] of Object.entries(reqHeaders)) {
		rows.push({
			headerType: 'request',
			name,
			value,
			sensitive: isSensitiveHeader(name),
			checked: false,
		});
	}
	for (const [name, value] of Object.entries(resHeaders)) {
		rows.push({
			headerType: 'response',
			name,
			value,
			sensitive: isSensitiveHeader(name),
			checked: false,
		});
	}
	return rows;
}

export function QuickMockPanel({
	open,
	onOpenChange,
	request,
	requestId: _requestId,
	onCreated,
}: QuickMockPanelProps) {
	const { addRule } = useRules();
	const [includeQueryString, setIncludeQueryString] = useState(false);
	const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() => buildInitialHeaderRows(request));
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const selections: QuickMockHeaderSelection[] = useMemo(
		() =>
			headerRows
				.filter((row) => row.checked)
				.map((row) => ({ headerType: row.headerType, name: row.name, value: row.value })),
		[headerRows],
	);

	const draftResult = useMemo(() => {
		const options: QuickMockOptions = {
			headerMatchers: selections,
			includeQueryString,
		};
		return buildQuickMockDraft(request, options);
	}, [request, selections, includeQueryString]);

	const handleSave = async () => {
		if (!draftResult.ok) {
			setErrorMessage(draftResult.error.message);
			return;
		}
		setSaving(true);
		setErrorMessage(null);
		try {
			const created = await addRule(
				draftResult.draft.name,
				draftResult.draft.matchers,
				draftResult.draft.action,
			);
			if (!created) {
				setErrorMessage('Falha ao gravar a regra em chrome.storage.local.');
				return;
			}
			onCreated?.(created);
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	};

	const toggleRow = (index: number) => {
		setHeaderRows((rows) =>
			rows.map((row, i) => (i === index ? { ...row, checked: !row.checked } : row)),
		);
	};

	const draftPattern = draftResult.ok && draftResult.draft.matchers.find((m) => m.type === 'url');
	const draftPatternText = draftPattern && 'pattern' in draftPattern ? draftPattern.pattern : '—';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Quick Mock</DialogTitle>
					<DialogDescription>
						Crie uma regra a partir da requisição capturada. Headers sensíveis ficam mascarados e
						desmarcados por padrão.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 text-sm">
					<div>
						<span className="font-medium">URL: </span>
						<code className="font-mono">{draftPatternText}</code>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="include-qs"
							checked={includeQueryString}
							onCheckedChange={(c) => setIncludeQueryString(c === true)}
						/>
						<label htmlFor="include-qs">Incluir query string no matcher</label>
					</div>
					<div>
						<span className="font-medium">Método: </span>
						<Badge variant="outline" className="font-mono text-xs">
							{request.method ?? 'Método ausente'}
						</Badge>
					</div>
				</div>

				<div className="mt-4 flex min-h-0 flex-1 flex-col">
					<h3 className="mb-2 text-sm font-medium">Header matchers (opcional)</h3>
					<ScrollArea className="max-h-72 rounded-md border">
						<table className="w-full text-sm">
							<thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
								<tr>
									<th className="px-3 py-2 text-left">Inc.</th>
									<th className="px-3 py-2 text-left">Tipo</th>
									<th className="px-3 py-2 text-left">Nome</th>
									<th className="px-3 py-2 text-left">Valor</th>
								</tr>
							</thead>
							<tbody>
								{headerRows.map((row, index) => (
									<tr key={`${row.headerType}-${row.name}`} className="border-t">
										<td className="px-3 py-2">
											<Checkbox
												checked={row.checked}
												onCheckedChange={() => toggleRow(index)}
												disabled={row.sensitive && row.value.length === 0}
											/>
										</td>
										<td className="px-3 py-2 text-xs uppercase">{row.headerType}</td>
										<td className="px-3 py-2 font-mono text-xs">{row.name}</td>
										<td className="px-3 py-2 font-mono text-xs break-all">
											{row.sensitive ? maskHeaderValue(row.name, row.value) : row.value}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</ScrollArea>
				</div>

				{!draftResult.ok && (
					<div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{draftResult.error.message}</span>
					</div>
				)}

				{errorMessage && (
					<div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						{errorMessage}
					</div>
				)}

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
						Cancelar
					</Button>
					<Button onClick={handleSave} disabled={!draftResult.ok || saving} className="gap-2">
						<LucideIcon name="save" className="h-4 w-4" />
						{saving ? 'Salvando…' : 'Salvar mock'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
