import * as React from 'react';
import { useMemo, useState } from 'react';
import { reconstructStateAt } from '@/lib/session/state/replay';
import type { DetectionPhase, SessionEvent, StoreKind } from '@/lib/session/types';
import { JsonTree } from './JsonTree';

interface LiveSnapshotEntry {
	storeKind: StoreKind;
	current: unknown;
	recentChanges: number;
	lastChangeAt: number;
}

export interface LiveStateSnapshot {
	byStoreId: Record<string, LiveSnapshotEntry>;
}

interface Props {
	// Modo gravado (replay):
	phase?: DetectionPhase | null;
	events?: SessionEvent[];
	playheadTimestamp?: number;
	// Modo passivo (live):
	liveSnapshot?: LiveStateSnapshot;
}

const STORE_KIND_LABEL: Record<StoreKind, string> = {
	redux: 'Redux',
	zustand: 'Zustand',
	'angular-signal': 'Angular Signal',
	ngrx: 'NgRx',
};

export function StateInspector({ phase, events, playheadTimestamp, liveSnapshot }: Props) {
	if (process.env.NODE_ENV !== 'production' && liveSnapshot && phase) {
		console.warn('[StateInspector] liveSnapshot e phase fornecidos juntos — usando liveSnapshot.');
	}

	if (liveSnapshot) {
		return <LiveView snapshot={liveSnapshot} />;
	}

	return (
		<RecordedView
			phase={phase ?? null}
			events={events ?? []}
			playheadTimestamp={playheadTimestamp ?? 0}
		/>
	);
}

function RecordedView({
	phase,
	events,
	playheadTimestamp,
}: {
	phase: DetectionPhase | null;
	events: SessionEvent[];
	playheadTimestamp: number;
}) {
	const storeIds = useMemo(() => {
		if (!phase) return [];
		return Object.keys(phase.stateBaseline ?? {});
	}, [phase]);

	const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

	const effectiveStoreId =
		selectedStoreId && storeIds.includes(selectedStoreId) ? selectedStoreId : (storeIds[0] ?? null);

	const snapshot = useMemo(() => {
		if (!phase || !effectiveStoreId) return null;
		try {
			return reconstructStateAt(phase, effectiveStoreId, playheadTimestamp, events);
		} catch (err) {
			return { __error__: String(err) };
		}
	}, [phase, effectiveStoreId, playheadTimestamp, events]);

	if (!phase) {
		return <p className="p-3 text-muted-foreground text-sm">Sem fase selecionada.</p>;
	}
	if (storeIds.length === 0) {
		return (
			<p className="p-3 text-muted-foreground text-sm">
				Nenhum store de estado capturado nesta fase.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center gap-2">
				<label htmlFor="state-store" className="text-xs">
					Store:
				</label>
				<select
					id="state-store"
					className="rounded border bg-background px-2 py-1 text-xs"
					value={effectiveStoreId ?? ''}
					onChange={(e) => setSelectedStoreId(e.target.value)}
				>
					{storeIds.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
				{effectiveStoreId && phase.stateBaseline?.[effectiveStoreId] && (
					<span className="rounded bg-muted px-2 py-0.5 font-medium text-[10px]">
						{STORE_KIND_LABEL[phase.stateBaseline[effectiveStoreId].storeKind]}
					</span>
				)}
			</div>
			{snapshot === null ? (
				<p className="text-muted-foreground text-xs">
					Estado indisponível no instante selecionado.
				</p>
			) : (
				<div className="overflow-auto rounded border p-2">
					<JsonTree value={snapshot} />
				</div>
			)}
		</div>
	);
}

function LiveView({ snapshot }: { snapshot: LiveStateSnapshot }) {
	const ids = Object.keys(snapshot.byStoreId);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const effectiveId = selectedId && ids.includes(selectedId) ? selectedId : (ids[0] ?? null);
	const entry = effectiveId ? snapshot.byStoreId[effectiveId] : null;

	if (ids.length === 0) {
		return (
			<p className="p-3 text-muted-foreground text-sm">
				Nenhum store de estado detectado nesta página.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center gap-2">
				<label htmlFor="state-store-live" className="text-xs">
					Store:
				</label>
				<select
					id="state-store-live"
					className="rounded border bg-background px-2 py-1 text-xs"
					value={effectiveId ?? ''}
					onChange={(e) => setSelectedId(e.target.value)}
				>
					{ids.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
				{entry && (
					<>
						<span className="rounded bg-muted px-2 py-0.5 font-medium text-[10px]">
							{STORE_KIND_LABEL[entry.storeKind]}
						</span>
						<span className="text-muted-foreground text-xs" aria-label="mutações">
							● {entry.recentChanges} mut.
						</span>
					</>
				)}
			</div>
			{entry && (
				<div className="overflow-auto rounded border p-2">
					<JsonTree value={entry.current} />
				</div>
			)}
		</div>
	);
}
