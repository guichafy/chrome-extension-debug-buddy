export interface Tab {
	id: number;
	title: string;
	url: string;
	hostname: string;
	favIconUrl?: string;
	index: number;
}

// Sentinela de hostname para URLs que não parseiam (agrupa no filtro de
// domínio). Nunca exibida crua: a UI mostra `selectTab:list.invalidUrl`.
export const INVALID_HOSTNAME = '(URL inválida)';
