import { useOutletContext } from 'react-router-dom';
import type { Filter } from '@/types/filters';
import type { InterceptedResponse, ResponseModifications } from '@/types/intercepted';
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
	pauseAutoRefresh: () => void;
	enableAutoRefresh: () => void;
	autoRefreshEnabled: boolean;
	clearAllRequests: () => Promise<boolean>;

	// Pendentes (substitui as chamadas que CommandCenter fazia direto a useResponses)
	pendingResponses: Record<string, InterceptedResponse>;
	approveResponse: (id: string, modifications: ResponseModifications) => Promise<boolean>;
	approveResponseWithEdit: (
		id: string,
		payload: { status: number; headers: Record<string, string>; body: string },
	) => Promise<{ success: boolean; error?: string }>;
	ignoreResponse: (id: string) => Promise<boolean>;
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
