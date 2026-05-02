import type { SessionEvent } from '@/lib/session/types';

function levelColor(type: SessionEvent['type']): string {
	switch (type) {
		case 'network':
			return 'text-blue-700';
		case 'console':
			return 'text-slate-700';
		case 'route':
			return 'text-purple-700';
		case 'error':
			return 'text-red-700';
		case 'detection':
			return 'text-emerald-700';
		case 'state':
			return 'text-amber-700';
	}
}

function eventLabel(ev: SessionEvent): string {
	switch (ev.type) {
		case 'network':
			return `[${ev.method}] ${ev.url} → ${ev.status}`;
		case 'console': {
			const text = ev.args.map((a) => a.description).join(' ');
			const count = ev.coalesceCount && ev.coalesceCount > 1 ? ` (×${ev.coalesceCount})` : '';
			return `[${ev.level.toUpperCase()}] ${text}${count}`;
		}
		case 'route':
			return `[ROUTE/${ev.triggerType}] ${ev.url}`;
		case 'error':
			return `[ERROR] ${ev.message}`;
		case 'detection':
			return `[PHASE START] ${ev.phaseId}`;
		case 'state':
			return `[STATE/${ev.storeKind}] ${ev.storeId} #${ev.sequenceNum}`;
	}
}

interface Props {
	event: SessionEvent;
	startedAt: number;
}

export function EventRow({ event, startedAt }: Props) {
	// CDP timestamps de Runtime.consoleAPICalled vêm em segundos com fração;
	// Date.now() em ms. Heurística: se < 1e12 assume segundos. Não é perfeito
	// mas suficiente pra timeline relativa nesta versão.
	const offsetMs =
		event.timestamp >= 1e12 ? event.timestamp - startedAt : event.timestamp * 1000 - startedAt;
	const sec = (offsetMs / 1000).toFixed(2);
	return (
		<div className="grid grid-cols-[auto_1fr] items-baseline gap-3 border-b px-3 py-1 font-mono text-xs">
			<span className="text-muted-foreground">+{sec}s</span>
			<span className={levelColor(event.type)}>{eventLabel(event)}</span>
		</div>
	);
}
