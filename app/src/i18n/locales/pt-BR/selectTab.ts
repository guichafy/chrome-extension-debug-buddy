// Diálogo de seleção da aba alvo.
const selectTab = {
	title: 'Selecionar aba para interceptar',
	description: 'Escolha a aba que deseja monitorar as requisições de rede.',
	tabCount_zero: '{{count}} abas',
	tabCount_one: '{{count}} aba',
	tabCount_many: '{{count}} abas',
	tabCount_other: '{{count}} abas',
	visibleTabs: '{{visible}} de {{total}} abas visíveis',
	keyboard: {
		navigate: 'Navegar',
		select: 'Selecionar',
		close: 'Fechar',
	},
	list: {
		ariaLabel: 'Abas disponíveis',
		current: 'Atual',
		invalidUrl: '(URL inválida)',
	},
	search: {
		ariaLabel: 'Buscar abas por título ou URL',
		placeholder: 'Buscar por título ou URL...',
	},
	domains: {
		all: 'Todos',
		allAriaLabel: 'Todos — Mostrar todos os domínios',
	},
	empty: {
		loading: 'Carregando abas',
		noTabs: 'Nenhuma aba disponível para análise',
		noResults: 'Nenhuma aba corresponde a <query>{{query}}</query>',
		clearSearch: 'Limpar busca',
		loadError: 'Erro ao carregar abas',
		unknownError: 'Erro desconhecido',
		retry: 'Tentar novamente',
	},
	errors: {
		tabsQueryUnknown: 'Erro desconhecido em chrome.tabs.query',
	},
};

export default selectTab;
