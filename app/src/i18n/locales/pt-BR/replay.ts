// Replay de sessão (página, timeline, requisições, recomendações) e o painel
// Live Insights.
const replay = {
	page: {
		loading: 'Carregando…',
		title: 'Replay — {{url}}',
		stats: '{{events}} eventos · {{phases}} fases · {{visual}} eventos visuais',
		originBanner:
			'Sessão importada gravada em <strong>{{importedOrigin}}</strong>, mas a tab atual está em <strong>{{currentOrigin}}</strong>. Verifique se a origem é confiável.',
		noVisual: 'Sessão sem captura visual.',
		noVisualHint: 'Esta sessão foi gravada antes da Fase 2 ou com rrweb desabilitado.',
		tabs: {
			timeline: 'Timeline',
			requests: 'Requisições',
			recommendations: 'Recomendações',
		},
		filters: 'Filtros:',
		noEvents: 'Nenhum evento até o ponto atual ({{seconds}}s).',
	},
	phases: {
		title: 'Environment Phases ({{total}})',
		phase: 'Fase {{number}} — {{tech}}',
		noDetection: 'sem detecção',
	},
	recommendations: {
		severity: {
			error: 'ERRO',
			warn: 'AVISO',
			info: 'INFO',
		},
		none: 'Nenhuma recomendação.',
		noneWithFilters: 'Nenhuma recomendação com os filtros atuais.',
	},
	categories: {
		security: 'Segurança',
		performance: 'Performance',
	},
	requests: {
		legacySession: 'Sessão gravada antes da Fase 7 — sem dados ricos de requisição.',
		noneYet: 'Nenhuma requisição capturada até este ponto da gravação.',
	},
	details: {
		description: 'Detalhes da requisição capturada na sessão de replay.',
		url: 'URL',
		method: 'Method',
		status: 'Status',
		resourceType: 'Resource type',
		mimeType: 'MIME type',
		duration: 'Duração',
		mocked: 'Mocked',
		transformed: 'Transformed',
		mockLatency: 'Mock latency',
		yes: 'sim',
		noRequestHeaders: 'Sem request headers capturados nesta sessão.',
		noRequestBody: 'Sem body de request capturado para esta sessão.',
		noResponseHeaders: 'Sem response headers capturados nesta sessão.',
	},
	liveInsights: {
		hosts_one: '{{count}} host',
		hosts_many: '{{count}} hosts',
		hosts_other: '{{count}} hosts',
		recommendations_zero: '{{count}} recomendações',
		recommendations_one: '{{count}} recomendação',
		recommendations_many: '{{count}} recomendações',
		recommendations_other: '{{count}} recomendações',
		summary: '{{hosts}} · {{recommendations}}',
		clear: 'limpar',
		startAnalysisHint: 'Inicie a análise para coletar insights desta página.',
		hostRecommendations_one: '{{count}} recomendação neste host',
		hostRecommendations_many: '{{count}} recomendações neste host',
		hostRecommendations_other: '{{count}} recomendações neste host',
		mostRecentHost: 'host mais recente',
		noDetection: 'sem detecção',
		recsShort_one: '{{count}} rec',
		recsShort_many: '{{count}} recs',
		recsShort_other: '{{count}} recs',
		waitingFirstDetection: 'Aguardando primeira detecção do probe…',
		noRecommendationsYet:
			'Nenhuma recomendação até agora. Carregue recursos da página para acionar regras.',
		noProbeDetection:
			'Sem detecção do probe para este host. Recomendações abaixo são derivadas de respostas HTTP capturadas.',
		noTechsYet:
			'Nenhuma tecnologia detectada para este host ainda. Aguarde o próximo Fetch ou navegação SPA.',
		noHostRecommendations: 'Nenhuma recomendação para este host.',
	},
	techItem: {
		officialSite: 'Site oficial de {{name}}',
	},
};

export default replay;
