import { useMemo, useState } from 'react';
import { RequestTimeline } from '@/components/command-center/RequestTimeline';
import { sessionEventsToRequestsRecord } from '@/lib/session/sessionNetworkAdapter';
import type { SessionEvent } from '@/lib/session/types';
import type { Filter } from '@/types/filters';
import { ReplayRequestDetailsSheet } from './ReplayRequestDetailsSheet';

interface Props {
	events: SessionEvent[];
	cutoffTimestamp: number;
}

// Reusa o RequestTimeline do Command Center (DataTable + FilterBar + columns)
// no Replay, com state local de selecao e filtros — o Replay viewer não
// compartilha estado com o Command Center. cutoffTimestamp vem do playhead;
// a tabela re-mapea (via useMemo) sempre que o playhead avança.
//
// Sessões antigas (pré-Fase 7) sem `request` snapshot exibem empty state.
//
// Click numa linha abre `ReplayRequestDetailsSheet` (drawer read-only com
// método/URL/status, headers, e aviso de body indisponível). Replay não tem
// criar regra ou abrir Rules Lab — é histórico.
export function ReplayRequestsTab({ events, cutoffTimestamp }: Props) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [filters, setFilters] = useState<Filter[]>([]);

	const requests = useMemo(
		() => sessionEventsToRequestsRecord(events, cutoffTimestamp),
		[events, cutoffTimestamp],
	);

	const selectedRequest = selectedId ? (requests[selectedId] ?? null) : null;
	// Sheet aberto sempre que há request selecionado e ele ainda existe na fatia
	// atual (o playhead pode recuar e remover o request da janela).
	const sheetOpen = selectedRequest !== null;

	if (Object.keys(requests).length === 0) {
		// Distingue dois cenários: sessão sem network events (cutoff baixo) vs.
		// sessão antiga sem snapshot. Para o usuário, ambos colapsam em "nada
		// pra mostrar agora" — checagem de cenário fica em telemetria.
		const hasNetworkEventsBeforeCutoff = events.some(
			(e) => e.type === 'network' && e.timestamp <= cutoffTimestamp,
		);
		return (
			<p className="p-3 text-muted-foreground text-sm">
				{hasNetworkEventsBeforeCutoff
					? 'Sessão gravada antes da Fase 7 — sem dados ricos de requisição.'
					: 'Nenhuma requisição capturada até este ponto da gravação.'}
			</p>
		);
	}

	return (
		<>
			<RequestTimeline
				requests={requests}
				selectedId={selectedId}
				onSelect={setSelectedId}
				filters={filters}
				onFiltersChange={setFilters}
			/>
			<ReplayRequestDetailsSheet
				request={selectedRequest}
				open={sheetOpen}
				onOpenChange={(open) => {
					if (!open) setSelectedId(null);
				}}
			/>
		</>
	);
}
