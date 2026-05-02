import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { EventRow } from '@/components/replay/EventRow';
import { PhaseList } from '@/components/replay/PhaseList';
import { sessionStore } from '@/lib/session/storage';
import type { Session, SessionEvent } from '@/lib/session/types';

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

	useEffect(() => {
		if (!sessionId) return;
		void sessionStore.get(sessionId).then(setSession);
	}, [sessionId]);

	if (!session) {
		return <div className="p-4 text-muted-foreground text-sm">Carregando…</div>;
	}

	const filtered = session.events.filter((e) => enabled[e.type]);

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Replay — {session.metadata.initialUrl}</h1>
				<span className="text-muted-foreground text-xs">
					{session.events.length} eventos · {session.detectionPhases.length} fases
				</span>
			</div>

			<div className="flex items-center gap-3 rounded border p-2 text-xs">
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

			<div className="grid grid-cols-[1fr_280px] gap-3 overflow-hidden">
				<div className="overflow-auto rounded border">
					{filtered.length === 0 ? (
						<p className="p-3 text-muted-foreground text-sm">
							Nenhum evento para os filtros selecionados.
						</p>
					) : (
						filtered.map((ev, i) => <EventRow key={i} event={ev} startedAt={session.startedAt} />)
					)}
				</div>
				<aside className="overflow-auto">
					<PhaseList phases={session.detectionPhases} />
				</aside>
			</div>
		</div>
	);
}
