import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EventRow } from '@/components/replay/EventRow';
import { PhaseList } from '@/components/replay/PhaseList';
import { RrwebPlayer } from '@/components/replay/RrwebPlayer';
import { Checkbox } from '@/components/ui/checkbox';
import { useReplayPlayhead } from '@/hooks/useReplayPlayhead';
import { sessionStore } from '@/lib/session/storage';
import type { RrwebEvent, Session, SessionEvent } from '@/lib/session/types';

const FILTERS: SessionEvent['type'][] = ['network', 'console', 'route', 'error', 'detection'];

export function ReplayPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const [session, setSession] = useState<Session | null>(null);
	const [enabled, setEnabled] = useState<Record<string, boolean>>({
		network: true,
		console: true,
		route: true,
		error: true,
		detection: false,
	});
	const playhead = useReplayPlayhead();

	useEffect(() => {
		if (!sessionId) return;
		// Limpa estado anterior pra mostrar "Carregando…" e não vazar dados de outra sessão
		// se o usuário trocar de URL durante o load.
		setSession(null);
		let cancelled = false;
		void sessionStore.get(sessionId).then((s) => {
			if (!cancelled) setSession(s);
		});
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	if (!session) {
		return <div className="p-4 text-muted-foreground text-sm">Carregando…</div>;
	}

	// Narrowing explícito para evitar que o branch do RrwebPlayer dependa de `?? []`
	// (no-fallbacks: o player só monta com array real e ≥ 2 eventos).
	const rrwebEvents: RrwebEvent[] | undefined = session.rrwebEvents;
	const hasRrweb = !!rrwebEvents && rrwebEvents.length >= 2;
	const cutoffTimestamp = session.startedAt + playhead.currentMs;
	const visibleEvents = session.events.filter(
		(e) => enabled[e.type] && e.timestamp <= cutoffTimestamp,
	);

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Replay — {session.metadata.initialUrl}</h1>
				<span className="text-muted-foreground text-xs">
					{session.events.length} eventos · {session.detectionPhases.length} fases ·{' '}
					{session.rrwebEvents?.length ?? 0} eventos visuais
				</span>
			</div>

			{/* Em sidepanel (~400px) empilha vertical; ≥ lg (1024px+) volta pra 2 colunas */}
			<div className="grid grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[65%_1fr]">
				{/* Coluna esquerda: rrweb-player ou fallback visual */}
				<div className="overflow-auto rounded border bg-black">
					{hasRrweb && rrwebEvents ? (
						<RrwebPlayer
							ref={playhead.playerRef}
							events={rrwebEvents}
							onTimeUpdate={playhead.onTimeUpdate}
						/>
					) : (
						<div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
							Sessão sem captura visual.
							<br />
							Esta sessão foi gravada antes da Fase 2 ou com rrweb desabilitado.
						</div>
					)}
				</div>

				{/* Coluna direita: filtros + timeline + fases */}
				<div className="flex flex-col gap-3 overflow-hidden">
					<div className="flex flex-wrap items-center gap-3 rounded border p-2 text-xs">
						<span className="font-medium">Filtros:</span>
						{FILTERS.map((f) => (
							<label key={f} htmlFor={`filter-${f}`} className="flex items-center gap-1">
								<Checkbox
									id={`filter-${f}`}
									checked={!!enabled[f]}
									onCheckedChange={(v) => setEnabled((prev) => ({ ...prev, [f]: v === true }))}
								/>
								{f}
							</label>
						))}
					</div>

					<div className="flex-1 overflow-auto rounded border">
						{visibleEvents.length === 0 ? (
							<p className="p-3 text-muted-foreground text-sm">
								Nenhum evento até o ponto atual ({(playhead.currentMs / 1000).toFixed(2)}s).
							</p>
						) : (
							visibleEvents.map((ev, i) => (
								<EventRow key={i} event={ev} startedAt={session.startedAt} />
							))
						)}
					</div>

					<aside className="max-h-48 overflow-auto">
						<PhaseList phases={session.detectionPhases} />
					</aside>
				</div>
			</div>
		</div>
	);
}
