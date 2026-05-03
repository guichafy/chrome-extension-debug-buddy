import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AntipatternsTab } from '@/components/replay/AntipatternsTab';
import { EventRow } from '@/components/replay/EventRow';
import { PhaseList } from '@/components/replay/PhaseList';
import { ReplayRequestsTab } from '@/components/replay/ReplayRequestsTab';
import { RrwebPlayer } from '@/components/replay/RrwebPlayer';
import { StateInspector } from '@/components/replay/StateInspector';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReplayPlayhead } from '@/hooks/useReplayPlayhead';
import { sessionStore } from '@/lib/session/storage';
import type { RrwebEvent, Session, SessionEvent } from '@/lib/session/types';

const FILTERS: SessionEvent['type'][] = [
	'network',
	'console',
	'route',
	'error',
	'detection',
	'state',
];

function originOfUrl(rawUrl: string): string {
	try {
		return new URL(rawUrl).origin;
	} catch {
		return rawUrl;
	}
}

export function ReplayPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const [session, setSession] = useState<Session | null>(null);
	const [currentOrigin, setCurrentOrigin] = useState<string>('');
	const [enabled, setEnabled] = useState<Record<string, boolean>>({
		network: true,
		console: true,
		route: true,
		error: true,
		detection: false,
		state: false,
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

	useEffect(() => {
		// Lê origem da tab ativa pra comparar com a sessão importada (banner de aviso).
		// Sem fallback: se não houver chrome.tabs (testes/iframe), o banner simplesmente não aparece.
		if (!chrome?.tabs?.query) return;
		let cancelled = false;
		const result = chrome.tabs.query({ active: true, currentWindow: true });
		// Em testes, o mock pode retornar undefined — nesse caso o efeito vira no-op.
		if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
		void (result as Promise<chrome.tabs.Tab[]>).then((tabs) => {
			if (cancelled) return;
			const url = tabs[0]?.url;
			if (url) setCurrentOrigin(originOfUrl(url));
		});
		return () => {
			cancelled = true;
		};
	}, []);

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
	const activePhase = (() => {
		const phases = session.detectionPhases;
		for (let i = phases.length - 1; i >= 0; i--) {
			if (phases[i].startTimestamp <= cutoffTimestamp) return phases[i];
		}
		return phases[0] ?? null;
	})();

	const importedOrigin = originOfUrl(session.metadata.initialUrl);
	const showOriginBanner =
		session.origin === 'imported' &&
		!!currentOrigin &&
		!!importedOrigin &&
		importedOrigin !== currentOrigin;

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Replay — {session.metadata.initialUrl}</h1>
				<span className="text-muted-foreground text-xs">
					{session.events.length} eventos · {session.detectionPhases.length} fases ·{' '}
					{session.rrwebEvents?.length ?? 0} eventos visuais
				</span>
			</div>

			{showOriginBanner && (
				<div
					role="alert"
					className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-900 text-xs dark:text-amber-200"
				>
					Sessão importada gravada em <strong>{importedOrigin}</strong>, mas a tab atual está em{' '}
					<strong>{currentOrigin}</strong>. Verifique se a origem é confiável.
				</div>
			)}

			<div className="flex flex-1 flex-col gap-3 overflow-hidden">
				{/* Player wrapper: aspect-ratio fixo (16:9 padrão) com max-height
				    capped a 55vh. Sem flex-basis percentual — o wrapper tem dimensões
				    exatas calculadas pelo CSS, e o RrwebPlayer (via ResizeObserver)
				    mede o host e cria o player com as MESMAS dimensões. Isso elimina
				    o gap visual ("black space") que aparecia quando o player calculado
				    via aspect ratio era menor que os 58% reservados. */}
				<div
					className="mx-auto flex w-full flex-shrink-0 items-center justify-center overflow-hidden rounded border bg-black"
					style={{ aspectRatio: '16 / 9', maxHeight: '55vh' }}
				>
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

				{/* Embaixo: tabs full-width preenchendo o espaço restante. */}
				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
					<Tabs defaultValue="timeline" className="flex h-full flex-col gap-3 overflow-hidden">
						<TabsList className="self-start">
							<TabsTrigger value="timeline">Timeline</TabsTrigger>
							<TabsTrigger value="requests">
								Requisições
								{(() => {
									const count = session.events.filter(
										(e) => e.type === 'network' && e.timestamp <= cutoffTimestamp,
									).length;
									if (count === 0) return null;
									return <span className="ml-2 rounded bg-muted px-1.5 text-[10px]">{count}</span>;
								})()}
							</TabsTrigger>
							<TabsTrigger value="antipatterns">
								Antipatterns
								{(session.antipatternHits?.length ?? 0) > 0 && (
									<span className="ml-2 rounded bg-muted px-1.5 text-[10px]">
										{session.antipatternHits?.length}
									</span>
								)}
							</TabsTrigger>
							<TabsTrigger value="state">Estado</TabsTrigger>
						</TabsList>

						<TabsContent
							value="timeline"
							className="mt-0 flex flex-1 flex-col gap-3 overflow-hidden"
						>
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
						</TabsContent>

						<TabsContent value="requests" className="mt-0 flex-1 overflow-hidden">
							<ReplayRequestsTab events={session.events} cutoffTimestamp={cutoffTimestamp} />
						</TabsContent>

						<TabsContent value="antipatterns" className="mt-0 flex-1 overflow-hidden">
							<AntipatternsTab hits={session.antipatternHits ?? []} startedAt={session.startedAt} />
						</TabsContent>

						<TabsContent value="state" className="mt-0 flex-1 overflow-auto">
							<StateInspector
								phase={activePhase}
								events={session.events}
								playheadTimestamp={cutoffTimestamp}
							/>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}
