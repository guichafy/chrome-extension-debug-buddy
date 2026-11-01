// Configurações > Privacidade (redação das sessões gravadas e retenção).
const privacy = {
	loading: 'Carregando configuração de privacidade…',
	loadError: 'Erro ao carregar: {{error}}',
	saved: 'Configuração salva.',
	error: 'Erro: {{error}}',
	unknownError: 'desconhecido',
	purged_zero: 'Removidas {{count}} sessões antigas.',
	purged_one: 'Removidas {{count}} sessões antigas.',
	purged_many: 'Removidas {{count}} sessões antigas.',
	purged_other: 'Removidas {{count}} sessões antigas.',
	title: 'Privacidade & Redação',
	description:
		'Controla o que é mascarado/removido das sessões antes de salvar. Mudanças aplicam-se a gravações futuras.',
	enabled: {
		label: 'Redação habilitada',
		hint: 'Quando desligada, headers/bodies/console/state são gravados sem filtro. Use só em localhost.',
	},
	headers: {
		title: 'Network — Headers',
		keys: 'Chaves de header (uma por linha, case-insensitive)',
		regex: 'Header regex (uma por linha)',
	},
	bodies: {
		title: 'Network — Bodies',
		regex: 'Body regex (uma por linha — JWT, PAN, etc.)',
	},
	console: {
		title: 'Console',
		mask: 'Mascarar console',
		regex: 'Console regex (uma por linha)',
	},
	rrweb: {
		title: 'rrweb (DOM/inputs)',
		maskAllInputs: 'Mascarar todos os inputs (não só password)',
		maskTextSelector: 'Seletor CSS para mascarar texto',
	},
	urlGate: {
		title: 'URL gate (não gravar)',
		blacklist: 'Domínios bloqueados (glob — ex: <code>*.banco.com.br</code>)',
	},
	stackPaths: {
		title: 'Paths em stack traces',
		truncate:
			'Truncar caminhos de usuário (<code>/Users/foo/…</code> → <code>/Users/&lt;user&gt;/…</code>)',
	},
	retention: {
		title: 'Retenção',
		autoPurge: 'Purge automática habilitada',
		days: 'Reter sessões por (dias)',
		purgeNow: 'Purgar agora',
	},
	saving: 'Salvando…',
};

export default privacy;
