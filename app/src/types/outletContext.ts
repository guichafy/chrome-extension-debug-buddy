import { useOutletContext } from 'react-router-dom';
import type { Filter } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';
import type { PendingInterception } from '@/lib/interceptionPipeline';
import type { InterceptionEditPayload } from '@/hooks/usePendingInterceptions';
import type { Rule } from '@/types/rules';

// Estado e callbacks instanciados pelo Layout e disponibilizados para todas
// as rotas filhas via `<Outlet context={...} />`. Inclui só o que faz sentido
// ser compartilhado entre rotas — não tudo que cada hook devolve.
export interface AppOutletContext {
	// Selection (compartilhada com o PendingActionDock global)
	selectedId: string | null;
	selected: InterceptedResponse | null;
	select: (id: string) => void;
	clear: () => void;

	// Histórico (substitui as chamadas que CommandCenter fazia direto a useAllRequests)
	filteredRequests: Record<string, InterceptedResponse>;
	filters: Filter[];
	setFilters: (filters: Filter[]) => void;
	clearAllRequests: () => Promise<boolean>;

	// Phase 5: fila unificada de pendentes (Request + Response stages). Substitui
	// o par legado pendingResponses/approveResponse/approveResponseWithEdit/
	// ignoreResponse exposto até Phase 4.
	pendingInterceptions: Record<string, PendingInterception>;
	approveInterception: (id: string) => Promise<boolean>;
	approveInterceptionWithEdit: (
		id: string,
		payload: InterceptionEditPayload,
	) => Promise<{ success: boolean; error?: string }>;
	cancelInterception: (id: string) => Promise<boolean>;
	ignoreAllPending: () => Promise<{
		succeeded: number;
		failed: Array<{ requestId: string; error: string }>;
	}>;

	// Rules — só leitura, suficiente para o RequestInspector. RulesLab continua
	// instanciando seu próprio useRules para escrita (sem impacto de coerência:
	// chrome.storage.onChanged sincroniza ambas as instâncias).
	rules: Rule[];
}

export const useAppOutlet = (): AppOutletContext => useOutletContext<AppOutletContext>();
