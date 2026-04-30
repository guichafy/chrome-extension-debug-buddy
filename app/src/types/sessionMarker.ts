// Marca dois pontos de tempo durante a interceptação:
//  - sessionStartedAt: quando o usuário clicou em "Iniciar Interceptação"
//  - currentPageNavigatedAt: quando a target tab fez a última navegação
//    de main frame (Page.frameNavigated com parentId == null)
// As pills do header filtram `allRequests` pelos timestamps:
// "Sessão" usa sessionStartedAt; "Página" usa currentPageNavigatedAt.
//
// Persistido em chrome.storage.local.sessionMarker para sobreviver a
// reload do service worker (MV3 reciclamento).

export interface SessionMarker {
	sessionStartedAt: number | null;
	currentPageUrl: string | null;
	currentPageNavigatedAt: number | null;
}

export const EMPTY_SESSION_MARKER: SessionMarker = {
	sessionStartedAt: null,
	currentPageUrl: null,
	currentPageNavigatedAt: null,
};
