import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from '@/components/ui/lucide-icon';
import type { InterceptedResponse, ResponseModifications } from '@/types/intercepted';
import type { Rule } from '@/types/rules';
import { formatDuration } from '@/components/requests/duration';
import { buildReplayView } from '@/lib/replayHistory';

interface RequestInspectorProps {
	request: InterceptedResponse | null;
	requestId: string | null;
	onApprove: (requestId: string, modifications: ResponseModifications) => Promise<boolean>;
	onIgnore: (requestId: string) => Promise<boolean>;
	onCreateMock: (request: InterceptedResponse, requestId: string) => void;
	onOpenInRulesLab: (ruleId: string) => void;
	onClose: () => void;
	rules: Rule[];
}

function truncateMiddle(value: string, maxLength = 80): string {
	if (value.length <= maxLength) return value;
	const half = Math.floor((maxLength - 1) / 2);
	return `${value.slice(0, half)}…${value.slice(-half)}`;
}

export function RequestInspector({
	request,
	requestId,
	onApprove,
	onIgnore,
	onCreateMock,
	onOpenInRulesLab,
	onClose,
	rules,
}: RequestInspectorProps) {
	if (!request || !requestId) {
		return (
			<aside className="flex h-full items-center justify-center border-l p-6 text-sm text-muted-foreground">
				Selecione uma requisição na timeline para inspecionar.
			</aside>
		);
	}

	const responseHeaders = request.response?.headers ?? request.headers;
	const requestHeaders = request.request?.headers ?? {};
	const responseBody = request.response?.body ?? request.body;
	const isPending = request.isWaiting === true;

	const handleApprove = async () => {
		await onApprove(requestId, {});
	};
	const handleIgnore = async () => {
		await onIgnore(requestId);
	};

	return (
		<aside className="flex h-full min-h-0 flex-col border-l bg-background">
			<header
				className="grid items-center gap-2 border-b px-4 py-3"
				style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto' }}
			>
				<Badge variant="outline" className="font-mono text-xs">
					{request.method ?? 'Método ausente'}
				</Badge>
				<span className="truncate font-mono text-xs" title={request.url}>
					{truncateMiddle(request.url)}
				</span>
				<Badge variant="outline" className="text-xs">
					{request.status}
				</Badge>
				<span className="text-xs text-muted-foreground">{formatDuration(request.duration)}</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					aria-label="Fechar inspector"
					className="h-8 w-8"
				>
					<LucideIcon name="x" className="h-4 w-4" />
				</Button>
			</header>

			{request.captureError && (
				<div className="m-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
					<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
					<span className="break-words">Falha na captura: {request.captureError}</span>
				</div>
			)}

			{!request.captureError && request.bodyUnavailableReason && (
				<div className="m-4 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
					<LucideIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
					<span className="break-words">{request.bodyUnavailableReason}</span>
				</div>
			)}

			<div className="flex flex-wrap gap-2 px-4 pb-3">
				<Button
					size="sm"
					variant="default"
					onClick={() => onCreateMock(request, requestId)}
					disabled={Boolean(request.captureError)}
					className="gap-2"
				>
					<LucideIcon name="copy" className="h-4 w-4" />
					Criar Mock
				</Button>
				{request.generatedRuleId && (
					<Button
						size="sm"
						variant="outline"
						onClick={() => onOpenInRulesLab(request.generatedRuleId!)}
						className="gap-2"
					>
						<LucideIcon name="flask" className="h-4 w-4" />
						Abrir no Rules Lab
					</Button>
				)}
				{isPending && (
					<>
						<Button size="sm" variant="default" onClick={handleApprove} className="gap-2">
							<LucideIcon name="check" className="h-4 w-4" />
							Aprovar
						</Button>
						<Button size="sm" variant="outline" onClick={handleIgnore} className="gap-2">
							<LucideIcon name="x" className="h-4 w-4" />
							Ignorar
						</Button>
					</>
				)}
			</div>

			<Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
				<TabsList className="mx-4 grid grid-cols-3">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="request">Request</TabsTrigger>
					<TabsTrigger value="response">Response</TabsTrigger>
				</TabsList>

				<ScrollArea className="flex-1 px-4 py-3">
					<TabsContent value="overview" className="space-y-2 text-sm">
						<div>
							<span className="font-medium">Tipo: </span>
							{request.type}
						</div>
						<div>
							<span className="font-medium">MIME: </span>
							{request.mimeType ?? 'Sem Content-Type'}
						</div>
						<div>
							<span className="font-medium">Duração: </span>
							{formatDuration(request.duration)}
						</div>
						{typeof request.mockLatencyMs === 'number' && (
							<div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
								Mock aplicado com latência artificial de {request.mockLatencyMs}ms. O Chrome
								DevTools pode não refletir esse tempo na coluna "Time" quando a resposta é fornecida
								via Fetch.fulfillRequest.
							</div>
						)}
					</TabsContent>

					<TabsContent value="request" className="space-y-3">
						<div>
							<h3 className="mb-1 text-sm font-medium">Headers</h3>
							<HeaderTable
								headers={requestHeaders}
								emptyMessage="Sem request headers capturados."
							/>
						</div>
						<div>
							<h3 className="mb-1 text-sm font-medium">Body</h3>
							{request.request?.postData ? (
								<pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
									{request.request.postData}
								</pre>
							) : (
								<div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
									Sem request body.
								</div>
							)}
						</div>
					</TabsContent>

					<TabsContent value="response" className="space-y-3">
						<div>
							<h3 className="mb-1 text-sm font-medium">Headers</h3>
							<HeaderTable
								headers={responseHeaders}
								emptyMessage="Sem response headers capturados."
							/>
						</div>
						<div>
							<h3 className="mb-1 text-sm font-medium">Body</h3>
							{responseBody === undefined ? (
								<div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
									{request.bodyUnavailableReason ?? 'Corpo da resposta indisponível.'}
								</div>
							) : (
								<pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-xs">
									{responseBody}
								</pre>
							)}
						</div>

						{/* comparação inline com mock atual */}
						<MockComparison request={request} rules={rules} />
					</TabsContent>
				</ScrollArea>
			</Tabs>
		</aside>
	);
}

function HeaderTable({
	headers,
	emptyMessage,
}: {
	headers: Record<string, string>;
	emptyMessage: string;
}) {
	const entries = Object.entries(headers);
	if (entries.length === 0) {
		return <div className="text-sm text-muted-foreground">{emptyMessage}</div>;
	}
	return (
		<div className="rounded-md border">
			{entries.map(([k, v]) => (
				<div
					key={k}
					className="grid gap-2 border-b px-3 py-2 last:border-b-0"
					style={{ gridTemplateColumns: 'minmax(140px, 220px) minmax(0, 1fr)' }}
				>
					<div className="font-mono text-xs font-semibold text-muted-foreground break-all">{k}</div>
					<div className="font-mono text-xs break-all">{v}</div>
				</div>
			))}
		</div>
	);
}

function MockComparison({
	request,
	rules,
}: {
	request: InterceptedResponse;
	rules: Rule[];
}) {
	const view = buildReplayView(request, rules);
	if (!view.currentMock) return null;
	return (
		<div className="rounded-md border border-blue-300 bg-blue-50/40 p-3 text-xs space-y-2 dark:border-blue-700 dark:bg-blue-950/30">
			<div className="flex items-center gap-2">
				<LucideIcon name="flask" className="h-4 w-4" />
				<span className="font-medium">
					Mock ativo aplicado por &quot;{view.currentMock.ruleName}&quot;
				</span>
			</div>
			<div>
				<span className="font-medium">Status mock: </span>
				{view.currentMock.status} {view.currentMock.statusPhrase ?? ''}
			</div>
			{view.currentMock.body !== undefined && (
				<div>
					<span className="font-medium">Body mock:</span>
					<pre className="mt-1 max-h-60 overflow-auto rounded border bg-background p-2 font-mono text-xs">
						{view.currentMock.body}
					</pre>
				</div>
			)}
			<p className="text-muted-foreground">
				A resposta acima (capturada) é o que veio do servidor antes da regra. O bloco azul mostra o
				que sua regra mock retorna agora para esta URL.
			</p>
		</div>
	);
}
