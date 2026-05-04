import { Badge } from '@/components/ui/badge';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BodyViewer } from '@/components/command-center/BodyViewer';
import { formatDuration } from '@/components/requests/duration';
import type { InterceptedResponse } from '@/types/intercepted';

interface Props {
	request: InterceptedResponse | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// Drawer read-only para inspecionar uma requisição capturada em sessão de
// replay. Diferente do RequestInspector do Command Center: não oferece criar
// regra, abrir Rules Lab, nem ações de breakpoint — replay é histórico.
//
// Sessões persistem bodies textuais ≤ 64KB via `applyBodyPolicy`. Bodies
// binários ou maiores ficam com `bodyUnavailableReason` explicando por que;
// drawer mostra a explicação ao invés de fingir vazio (no-fallbacks).
export function ReplayRequestDetailsSheet({ request, open, onOpenChange }: Props) {
	if (!request) return null;

	const responseHeaders = request.response?.headers ?? request.headers ?? {};
	const requestHeaders = request.request?.headers ?? {};
	const requestBody = request.request?.postData;
	const responseBody = request.response?.body ?? request.body;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
				<SheetHeader className="border-b px-4 py-3">
					<SheetTitle className="flex items-center gap-2 pr-8">
						<Badge variant="outline" className="font-mono text-xs">
							{request.method ?? '—'}
						</Badge>
						<Badge variant="outline" className="text-xs">
							{request.status}
						</Badge>
						<span className="text-muted-foreground text-xs">
							{formatDuration(request.duration)}
						</span>
					</SheetTitle>
					<SheetDescription className="sr-only">
						Detalhes da requisição capturada na sessão de replay.
					</SheetDescription>
					<p className="break-all font-mono text-muted-foreground text-xs" title={request.url}>
						{request.url}
					</p>
				</SheetHeader>

				<Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
					<TabsList className="mx-4 mt-3 grid grid-cols-3">
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="request">Request</TabsTrigger>
						<TabsTrigger value="response">Response</TabsTrigger>
					</TabsList>

					<ScrollArea className="flex-1 px-4 py-3">
						<TabsContent value="overview" className="space-y-2 text-sm">
							<KV label="URL" value={request.url} mono />
							<KV label="Method" value={request.method ?? '—'} />
							<KV label="Status" value={`${request.status} ${request.statusText ?? ''}`.trim()} />
							<KV label="Resource type" value={request.type ?? '—'} />
							<KV label="MIME type" value={request.mimeType ?? '—'} />
							<KV label="Duração" value={formatDuration(request.duration)} />
							{request.isMocked && <KV label="Mocked" value="sim" />}
							{request.isTransformed && <KV label="Transformed" value="sim" />}
							{typeof request.mockLatencyMs === 'number' && (
								<KV label="Mock latency" value={`${request.mockLatencyMs} ms`} />
							)}
							{request.captureError && (
								<div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs">
									<LucideIcon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
									<span className="break-words">Falha na captura: {request.captureError}</span>
								</div>
							)}
						</TabsContent>

						<TabsContent value="request" className="space-y-3">
							<section>
								<h3 className="mb-1 font-medium text-sm">Headers</h3>
								<HeaderTable
									headers={requestHeaders}
									emptyMessage="Sem request headers capturados nesta sessão."
								/>
							</section>
							<section>
								<h3 className="mb-1 font-medium text-sm">Body</h3>
								{requestBody !== undefined ? (
									<BodyViewer body={requestBody} label="Body" expandedHeight={false} />
								) : (
									<BodyUnavailableNote reason="Sem body de request capturado para esta sessão." />
								)}
							</section>
						</TabsContent>

						<TabsContent value="response" className="space-y-3">
							<section>
								<h3 className="mb-1 font-medium text-sm">Headers</h3>
								<HeaderTable
									headers={responseHeaders}
									emptyMessage="Sem response headers capturados nesta sessão."
								/>
							</section>
							<section>
								<h3 className="mb-1 font-medium text-sm">Body</h3>
								<BodyViewer
									body={responseBody}
									mimeType={request.mimeType}
									bodyUnavailableReason={request.bodyUnavailableReason}
									label="Body"
									expandedHeight
								/>
							</section>
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
			<span className="font-medium text-muted-foreground">{label}</span>
			<span className={mono ? 'break-all font-mono text-xs' : 'break-words'}>{value}</span>
		</div>
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
		return <div className="text-muted-foreground text-sm">{emptyMessage}</div>;
	}
	return (
		<div className="rounded-md border">
			{entries.map(([k, v]) => (
				<div
					key={k}
					className="grid gap-2 border-b px-3 py-2 last:border-b-0"
					style={{ gridTemplateColumns: 'minmax(140px, 220px) minmax(0, 1fr)' }}
				>
					<div className="break-all font-mono font-semibold text-muted-foreground text-xs">{k}</div>
					<div className="break-all font-mono text-xs">{v}</div>
				</div>
			))}
		</div>
	);
}

function BodyUnavailableNote({ reason }: { reason: string }) {
	return (
		<div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-muted-foreground text-sm">
			<LucideIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
			<span className="break-words">{reason}</span>
		</div>
	);
}
