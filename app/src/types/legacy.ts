// Tipos legados mantidos APENAS para suporte à migração one-shot
// implementada em services/legacyMigration.ts. NÃO re-exportar deste arquivo
// para o resto do código — uma vez que a migração rode em produção e
// nenhum usuário tenha mais dados legados, este arquivo pode ser removido.

export interface UrlPattern {
	url: string;
	method: string;
	headerType?: string;
	headerName?: string;
	headerValue?: string;
	enabled?: boolean;
	isRegex?: boolean;
}

export interface MockConfig {
	urlPattern: string;
	method: string;
	status: number;
	headers: Record<string, string>;
	body: string;
	createdAt: number;
	enabled: boolean;
}
