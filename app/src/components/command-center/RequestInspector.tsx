import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LucideIcon } from '@/components/ui/lucide-icon';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { InterceptedResponse } from '@/types/intercepted';
import type { Action, ActionType, Rule } from '@/types/rules';
import { findMatchingRuleAction } from '@/domain/ruleMatching';
import { formatDuration } from '@/components/requests/duration';
import { buildReplayView } from '@/lib/replayHistory';
import { getActionVisuals } from '@/components/rules-lab/ruleVisuals';
import { cn } from '@/lib/utils';
import { BodyViewer } from './BodyViewer';

interface RequestInspectorProps {
	request: InterceptedResponse | null;
	requestId: string | null;
	onCreateRule: (request: InterceptedResponse, requestId: string, actionType: ActionType) => void;
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
	onCreateRule,
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

	// Quando o request foi pausado por uma regra breakpoint, localizamos a regra
	// que casou para exibir sua descrição logo no topo do inspector. Sem fallback
	// silencioso: se nenhuma regra casar (ex.: regra removida após a pausa) o
	// bloco simplesmente não é renderizado.
	const matchedBreakpoint = isPending
		? findMatchingRuleAction(rules, {
				url: request.url,
				method: request.method ?? '',
				headers: requestHeaders,
				body: request.request?.postData,
			})
		: undefined;
	const breakpointDescription =
		matchedBreakpoint?.type === 'breakpoint'
			? matchedBreakpoint.action.description?.trim() || undefined
			: undefined;

	return (
		<aside className="flex h-full min-h-0 min-w-0 w-full flex-col border-l bg-background">
			<header
				className="flex flex-col gap-2 border-b px-4 py-3"
				data-testid="request-inspector-header"
			>
				<div
					className="grid items-center gap-2"
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
				</div>
				<div
					className="flex flex-wrap items-center gap-2"
					data-testid="request-inspector-status-row"
				>
					{isPending ? (
						<Badge
							variant="warning"
							className="gap-1 text-xs"
							data-testid="awaiting-decision-badge"
						>
							<LucideIcon name="hourglass" className="h-3 w-3 animate-pulse" />
							Aguardando decisão
						</Badge>
					) : (
						<Badge variant="outline" className="gap-1 text-xs" data-testid="resolved-badge">
							<LucideIcon name="check-circle" className="h-3 w-3" />
							Resolvida
						</Badge>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="sm"
								variant="outline"
								disabled={Boolean(request.captureError)}
								className="gap-2"
								data-testid="request-inspector-create-rule"
							>
								<LucideIcon name="plus" className="h-4 w-4" />
								Criar regra
								<LucideIcon name="chevron-down" className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{(['mock', 'breakpoint', 'transform', 'delay'] as const).map((type) => {
								const action: Action =
									type === 'mock'
										? { type: 'mock', enabled: true, status: 200, headers: {} }
										: type === 'breakpoint'
											? { type: 'breakpoint', enabled: true }
											: type === 'transform'
												? { type: 'transform', enabled: true, mode: 'declarative', operations: [] }
												: { type: 'delay', enabled: true, timeMs: 1000 };
								const v = getActionVisuals(action);
								return (
									<DropdownMenuItem
										key={type}
										data-testid={`request-inspector-create-rule-${type}`}
										onSelect={() => onCreateRule(request, requestId, type)}
										className="gap-2"
									>
										<span
											className={cn(
												'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
												v.bgClass,
												v.textClass,
											)}
										>
											<LucideIcon name={v.iconName} className="h-3.5 w-3.5" />
										</span>
										<span>{v.label}</span>
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
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
				</div>
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

			{isPending && breakpointDescription && (
				<div
					className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-rose-300/60 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-100"
					data-testid="breakpoint-description-banner"
				>
					<LucideIcon name="octagon-alert" className="mt-0.5 h-4 w-4 shrink-0" />
					<div className="min-w-0">
						<div className="font-medium">Breakpoint pausou esta requisição</div>
						<p className="mt-0.5 break-words text-rose-900/80 dark:text-rose-100/80">
							{breakpointDescription}
						</p>
					</div>
				</div>
			)}

			<Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
				<TabsList className="mx-4 grid grid-cols-3">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="request">Request</TabsTrigger>
					<TabsTrigger value="response">Response</TabsTrigger>
				</TabsList>

				<ScrollArea className="flex-1 px-4 py-3">
					<TabsContent value="overview" className="space-y-2 text-sm">
						<div>
							<span className="font-medium">Resource type: </span>
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
								Mock aplicado com latência artificial de {request.mockLatencyMs}ms.
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
							<BodyViewer body={request.request?.postData} label="Body" expandedHeight={false} />
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
							<BodyViewer
								body={responseBody}
								mimeType={request.mimeType}
								bodyUnavailableReason={request.bodyUnavailableReason}
								label="Body"
								expandedHeight
							/>
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

function mockMimeType(headers: Record<string, string> | undefined): string | undefined {
	if (!headers) return undefined;
	const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
	if (!key) return undefined;
	return headers[key]?.split(';')[0]?.trim();
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
				<BodyViewer
					body={view.currentMock.body}
					mimeType={mockMimeType(view.currentMock.headers)}
					label="Body mock"
				/>
			)}
			<p className="text-muted-foreground">
				A resposta acima (capturada) é o que veio do servidor antes da regra. O bloco azul mostra o
				que sua regra mock retorna agora para esta URL.
			</p>
		</div>
	);
}
