export interface Tab {
	id: number;
	title: string;
	url: string;
	hostname: string;
	favIconUrl?: string;
	index: number;
}

export const INVALID_HOSTNAME = '(URL inválida)';
