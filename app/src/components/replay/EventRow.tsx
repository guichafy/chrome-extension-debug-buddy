import { Badge } from '@/components/ui/badge';
import type { SessionEvent } from '@/lib/session/types';
import { cn } from '@/lib/utils';

// Mapeamento tipo/level → classes do Badge. Cores escolhidas para legibilidade
// em dark mode (bg dark-tinted, foreground claro). Mantém paridade com a paleta
// usada em Command Center (status code coloring).
const TYPE_BADGE: Record<string, string> = {
	network: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
	console: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
	route: 'border-purple-500/40 bg-purple-500/10 text-purple-200',
	error: 'border-red-500/40 bg-red-500/10 text-red-200',
	detection: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
	state: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};

// Console levels têm sub-paleta (error vermelho, warn âmbar, info azul, log/debug cinza).
const CONSOLE_LEVEL_BADGE: Record<string, string> = {
	error: 'border-red-500/40 bg-red-500/10 text-red-200',
	warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
	info: 'border-blue-500/40 bg-blue-500/10 text-blue-200',
	log: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
	debug: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
	trace: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
};

// Status code → cor (paridade com Command Center): 2xx verde, 3xx azul, 4xx âmbar, 5xx vermelho.
function statusBadgeClass(status: number): string {
	if (status >= 500) return 'border-red-500/40 bg-red-500/10 text-red-200';
	if (status >= 400) return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
	if (status >= 300) return 'border-blue-500/40 bg-blue-500/10 text-blue-200';
	if (status >= 200) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
	// status 0 = breakpoint pendente / sem resposta — tratamos como neutro (no-fallback:
	// sem inventar valor, só visualmente neutralizar).
	return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
}

interface Props {
	event: SessionEvent;
	startedAt: number;
}

export function EventRow({ event, startedAt }: Props) {
	// CDP Runtime.consoleAPICalled timestamps em seg com fração; Date.now() em ms.
	const offsetMs =
		event.timestamp >= 1e12 ? event.timestamp - startedAt : event.timestamp * 1000 - startedAt;
	const sec = (offsetMs / 1000).toFixed(2);

	return (
		<div className="grid grid-cols-[auto_auto_1fr] items-start gap-3 border-b px-3 py-2 text-xs hover:bg-muted/40">
			{/* Timestamp — fonte mono, fixa */}
			<span className="pt-0.5 font-mono text-muted-foreground tabular-nums">+{sec}s</span>

			{/* Badge da categoria */}
			<EventBadge event={event} />

			{/* Conteúdo principal */}
			<div className="min-w-0 break-words">
				<EventContent event={event} />
			</div>
		</div>
	);
}

function EventBadge({ event }: { event: SessionEvent }) {
	switch (event.type) {
		case 'network':
			return (
				<div className="flex flex-shrink-0 items-center gap-1.5">
					<Badge
						variant="outline"
						className={cn('px-1.5 py-0 font-mono text-[10px]', TYPE_BADGE.network)}
					>
						{event.method}
					</Badge>
					<Badge
						variant="outline"
						className={cn('px-1.5 py-0 font-mono text-[10px]', statusBadgeClass(event.status))}
					>
						{event.status > 0 ? event.status : '—'}
					</Badge>
				</div>
			);
		case 'console':
			return (
				<Badge
					variant="outline"
					className={cn(
						'flex-shrink-0 px-1.5 py-0 font-mono text-[10px] uppercase',
						CONSOLE_LEVEL_BADGE[event.level] ?? CONSOLE_LEVEL_BADGE.log,
					)}
				>
					{event.level}
				</Badge>
			);
		case 'route':
			return (
				<Badge
					variant="outline"
					className={cn('flex-shrink-0 px-1.5 py-0 font-mono text-[10px]', TYPE_BADGE.route)}
				>
					→ {event.triggerType}
				</Badge>
			);
		case 'error':
			return (
				<Badge
					variant="outline"
					className={cn('flex-shrink-0 px-1.5 py-0 font-mono text-[10px]', TYPE_BADGE.error)}
				>
					ERROR
				</Badge>
			);
		case 'detection':
			return (
				<Badge
					variant="outline"
					className={cn('flex-shrink-0 px-1.5 py-0 font-mono text-[10px]', TYPE_BADGE.detection)}
				>
					phase
				</Badge>
			);
		case 'state':
			return (
				<Badge
					variant="outline"
					className={cn('flex-shrink-0 px-1.5 py-0 font-mono text-[10px]', TYPE_BADGE.state)}
				>
					{event.storeKind}
				</Badge>
			);
	}
}

function EventContent({ event }: { event: SessionEvent }) {
	switch (event.type) {
		case 'network':
			return (
				<div className="flex items-baseline gap-2">
					<span className="truncate font-mono text-foreground">{event.url}</span>
					{event.durationMs !== undefined && (
						<span className="flex-shrink-0 text-muted-foreground tabular-nums">
							{event.durationMs.toFixed(0)}ms
						</span>
					)}
				</div>
			);
		case 'console': {
			const text = event.args.map((a) => a.description).join(' ');
			return (
				<div className="flex items-baseline gap-2">
					<span className="text-foreground">{text}</span>
					{event.coalesceCount && event.coalesceCount > 1 && (
						<Badge
							variant="outline"
							className="flex-shrink-0 border-muted-foreground/30 bg-muted/30 px-1.5 py-0 font-mono text-[10px] text-muted-foreground"
						>
							×{event.coalesceCount}
						</Badge>
					)}
				</div>
			);
		}
		case 'route':
			return <span className="truncate font-mono text-foreground">{event.url}</span>;
		case 'error': {
			const firstFrame = event.stackTrace?.frames[0];
			return (
				<div className="space-y-1">
					<div className="text-foreground">{event.message}</div>
					{firstFrame && (
						<div className="truncate font-mono text-[10px] text-muted-foreground">
							at {firstFrame.functionName || '<anonymous>'} ({firstFrame.url}:
							{firstFrame.lineNumber}:{firstFrame.columnNumber})
						</div>
					)}
				</div>
			);
		}
		case 'detection':
			return <span className="text-muted-foreground">{event.phaseId}</span>;
		case 'state':
			return (
				<span className="text-muted-foreground">
					<span className="font-mono">{event.storeId}</span> · seq #{event.sequenceNum}
				</span>
			);
	}
}
