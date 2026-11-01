// Shell da aplicação: sidebar, header, métricas de rede e seletor de idioma.
const layout = {
	nav: {
		section: 'Principal',
		commandCenter: 'Command Center',
		rulesLab: 'Rules Lab',
		sessions: 'Sessões',
		privacy: 'Privacidade',
	},
	sidebar: {
		logoAlt: 'Logo',
		developedBy: 'Desenvolvido por',
		copyright: '© 2025 - Todos os direitos reservados',
	},
	language: {
		label: 'Idioma',
		saveError: 'Não foi possível salvar o idioma: {{message}}',
	},
	header: {
		selectTab: 'Selecionar Aba',
		tabUnavailableSelectAnother: 'Aba indisponível — selecionar outra',
		tabUnavailableAriaLabel: 'Aba indisponível: {{title}}. Clique para selecionar outra.',
		previouslySelectedTab: 'aba selecionada anteriormente',
		tabNoLongerAvailable: 'Aba não está mais disponível',
		lastTab: 'Última aba: {{title}}',
		clickToSelectNewTab: 'Clique para selecionar uma nova aba.',
		startAnalysis: 'Iniciar Análise',
		stopAnalysis: 'Parar Análise',
		liveInsights: 'Live Insights',
		liveInsightsDescription: 'Detecções de stack e recomendações em tempo real para a aba alvo.',
	},
	metrics: {
		noRequestsYet: 'Sem requests ainda',
		requests_one: '{{count}} requests',
		requests_many: '{{count}} requests',
		requests_other: '{{count}} requests',
		requestsTooltip: 'Total de requisições capturadas pela sessão atual de análise.',
		transferred: '{{value}} transferred',
		transferredTooltip:
			'Bytes recebidos no fio (transferSize do CDP). Inclui headers e payload comprimido quando aplicável.',
		resources: '{{value}} resources',
		resourcesTooltip:
			'Soma dos response bodies decodificados que a extensão capturou. Bodies binários ou acima do cap não contam (viram bodyUnavailableReason).',
	},
	dock: {
		ignoreAllResult: '{{succeeded}} ignorada(s) com sucesso, {{failed}} falha(s):\n{{detail}}',
	},
};

export default layout;
