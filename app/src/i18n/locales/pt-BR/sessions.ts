// Gravação de sessão (toggle no header), lista de sessões salvas e
// import/export de .dbsession.
const sessions = {
	page: {
		title: 'Sessões salvas',
		retention: '{{saved}} / {{limit}} (limite de retenção)',
		empty: 'Nenhuma sessão salva. Inicie uma gravação para criar a primeira.',
	},
	row: {
		inProgress: 'em andamento',
		recorded: 'Gravada',
		imported: 'Importada',
		export: 'Exportar',
		delete: 'Excluir',
	},
	recording: {
		label: 'Gravação',
		statusAriaLabel:
			'Sessão: {{size}} de {{sizeLimit}} MB, {{minutes}} de {{durationLimit}} minutos',
		nearLimit: 'próximo do limite',
		size: 'Tamanho',
		duration: 'Duração',
		stopHint: 'Clique no switch para parar a gravação.',
		errors: {
			noTargetTab: 'Sem tab alvo',
			noActiveSession: 'Sem sessão ativa',
		},
	},
	import: {
		button: 'Importar .dbsession',
		failed: 'Falha ao importar: {{error}}',
		unknownError: 'erro desconhecido',
		invalidFile: 'Arquivo inválido: {{error}}',
	},
	originWarning: {
		title: 'Sessão de origem diferente',
		description:
			'Esta sessão foi gravada em <strong>{{importedOrigin}}</strong>, mas a tab atual está em<strong> {{currentOrigin}}</strong>. O replay funciona normalmente, mas verifique se a origem é confiável antes de prosseguir — sessões de origem desconhecida podem conter conteúdo inesperado.',
		continue: 'Continuar',
	},
	exportDialog: {
		title: 'Exportar sessão — leia antes',
		description:
			'Este arquivo contém TUDO que foi gravado: requisições e respostas da rede (incluindo<strong> Authorization headers e cookies</strong> quando não mascarados), todas as mensagens de console (incluindo qualquer <strong>senha, token ou número de cartão</strong> que tenha sido logado em <code>console.log</code>), e o estado da aplicação. Revise antes de anexar em qualquer lugar público (Jira, Slack, e-mail).',
		maskingHeading: 'Mascaramento que será aplicado neste export:',
		loadError: 'Erro ao carregar configuração: {{error}}',
		loadErrorFallback: 'falha ao ler privacyConfig',
		loading: 'Carregando…',
		maskingDisabled:
			'<strong>Atenção:</strong> mascaramento está <strong>desabilitado</strong> em Configurações > Privacidade. Nada será redigido neste arquivo.',
		headers: 'Headers redigidos: <strong>{{keys}} chaves + {{regex}} regex</strong>',
		body: 'Body — regex aplicadas: <strong>{{total}}</strong>',
		console: 'Console: <strong>{{state}}</strong>',
		consoleRedacting: 'redigindo ({{total}} regex)',
		consoleDisabled: 'desabilitado para esta sessão',
		rrweb: 'rrweb: <strong>{{state}}</strong>',
		rrwebAllInputs: 'todos os inputs mascarados',
		rrwebSensitiveOnly: 'só password/cc/cvv',
		truncatePaths: 'Truncar paths em stacks: <strong>{{state}}</strong>',
		yes: 'sim',
		no: 'não',
		editHint: 'Edite essas regras em <strong>Configurações > Privacidade</strong>.',
		confirm: 'Entendi, exportar',
	},
};

export default sessions;
