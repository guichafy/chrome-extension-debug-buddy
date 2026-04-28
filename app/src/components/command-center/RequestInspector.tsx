import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from '@/components/ui/lucide-icon';
import type { InterceptedResponse, ResponseModifications } from '@/types/intercepted';
import { formatDuration } from '@/components/requests/duration';

interface RequestInspectorProps {
	request: InterceptedResponse | null;
	requestId: string | null;
	onApprove: (requestId: string, modifications: ResponseModifications) => Promise<boolean>;
	onIgnore: (requestId: string) => Promise<boolean>;
	onCreateMock: (request: InterceptedResponse, requestId: string) => void;
	onOpenInRulesLab: (ruleId: string) => void;
	onReplay: (request: InterceptedResponse) => void;
	onClose: () => void;
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
	onReplay,
	onClose,
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
				<Button size="sm" variant="outline" onClick={() => onReplay(request)} className="gap-2">
					<LucideIcon name="rotate-ccw" className="h-4 w-4" />
					Replay
				</Button>
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
				<TabsList className="mx-4 grid grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="request">Request</TabsTrigger>
					<TabsTrigger value="response">Response</TabsTrigger>
					<TabsTrigger value="body">Body</TabsTrigger>
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
					</TabsContent>

					<TabsContent value="request">
						<HeaderTable headers={requestHeaders} emptyMessage="Sem request headers capturados." />
						{request.request?.postData && (
							<pre className="mt-3 max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
								{request.request.postData}
							</pre>
						)}
					</TabsContent>

					<TabsContent value="response">
						<HeaderTable
							headers={responseHeaders}
							emptyMessage="Sem response headers capturados."
						/>
					</TabsContent>

					<TabsContent value="body">
						{responseBody === undefined ? (
							<div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
								{request.bodyUnavailableReason ?? 'Corpo da resposta indisponível.'}
							</div>
						) : (
							<pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-xs">
								{responseBody}
							</pre>
						)}
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
