import { useMemo, useState } from 'react';
import { reconstructStateAt } from '@/lib/session/state/replay';
import type { DetectionPhase, SessionEvent } from '@/lib/session/types';
import { JsonTree } from './JsonTree';

interface Props {
	phase: DetectionPhase | null;
	events: SessionEvent[];
	playheadTimestamp: number;
}

export function StateInspector({ phase, events, playheadTimestamp }: Props) {
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
