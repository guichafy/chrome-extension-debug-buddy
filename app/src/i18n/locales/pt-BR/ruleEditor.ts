// Wizard de criação/edição de regra e os editores de matcher e de ação.
const ruleEditor = {
	defaultName: 'Nova Regra',
	steps: {
		type: {
			label: 'Tipo',
			description: 'Escolha o comportamento da regra.',
		},
		matcher: {
			label: 'Matcher',
			description: 'Defina quais requisições serão alvo.',
		},
		action: {
			label: 'Ação',
			description: 'Configure como a regra age sobre o request.',
		},
		review: {
			label: 'Revisar',
			description: 'Confirme antes de salvar.',
		},
		navAriaLabel: 'Passos do wizard',
	},
	typeDescriptions: {
		mock: 'Não chama o servidor — retorna a resposta mockada.',
		transform: 'Chama o servidor e aplica modificações na resposta.',
		requestDelay: 'Atrasa a resposta antes de devolver ao cliente.',
		breakpoint: 'Pausa antes de responder e permite editar a resposta em voo.',
	},
	validation: {
		nameEmpty: 'Informe um nome para a regra',
		urlMatcherMissing: 'A regra precisa de um matcher de URL habilitado',
		urlPatternEmpty: 'Preencha o padrão da URL antes de salvar',
		methodEmpty: 'Selecione ao menos um método HTTP ou desative o matcher de método',
	},
	typeStep: {
		nameLabel: 'Nome da Regra',
		namePlaceholder: 'Ex: API de Login',
		stageLegend: 'Estágio (stage)',
		stageHelp:
			'<strong>Request</strong> roda antes da requisição sair pra rede; <strong>Response</strong> roda depois que o servidor responde. Cada regra opera em um único stage — para agir nos dois, crie duas regras.',
		stageRequestOption: 'Request — antes do envio',
		stageResponseOption: 'Response — depois do retorno',
		stageLocked:
			'Em edição o stage não pode ser alterado — actions e matchers dependem dele. Para trocar, crie uma nova regra.',
		typeLegend: 'Tipo de regra',
		typeLocked: 'Em edição, o tipo não pode ser alterado — para mudar o tipo, crie uma nova regra.',
		typeHelp:
			'Escolha o comportamento inicial. O passo "Ação" permite encadear mais actions depois.',
		selected: 'Selecionado',
		enabled: 'Regra ativa',
	},
	matcherStep: {
		title: 'Condições de Match',
		description:
			'Defina o padrão de URL e os métodos HTTP que disparam esta regra. O painel à direita mostra em tempo real se a regra casaria uma URL de teste.',
	},
	actionStep: {
		chain: 'Chain de actions ({{total}}) — ',
		stage: 'Stage: {{stage}}',
		title: 'Ações da regra',
		description:
			'As actions executam em ordem. Uma action terminal (Mock, Block, Breakpoint) interrompe a chain — actions após ela ficam inalcançáveis.',
	},
	review: {
		unnamed: '(sem nome)',
		activeOnSave: 'Ativa ao salvar',
		pausedOnSave: 'Pausada ao salvar',
		type: 'Tipo',
		matcher: 'Matcher',
		action: 'Ação',
		fixErrors: 'Corrija os itens abaixo antes de salvar',
		errorStep: '(passo {{step}})',
		ready: 'Pronto para salvar',
		readyHint: 'Todos os campos obrigatórios estão preenchidos.',
	},
	diff: {
		noChanges: 'Nenhuma alteração realizada — salvar manterá a regra como está.',
		title: 'Alterações em relação à regra atual',
		name: 'Nome',
		state: 'Estado',
		matcher: 'Matcher',
		action: 'Ação',
		active: 'Ativa',
		paused: 'Pausada',
	},
	dialog: {
		back: 'Voltar',
		editTitle: 'Editar Regra',
		newTitle: 'Nova regra',
		configureTitle: 'Configurar regra',
		editDescription: 'Modifique os detalhes da regra.',
		welcomeDescription: 'Comece do zero ou escolha um template.',
		previous: 'Anterior',
		next: 'Próximo',
		add: 'Adicionar',
	},
	discard: {
		title: 'Descartar alterações?',
		description:
			'Você fez alterações que ainda não foram salvas. Sair agora descartará tudo o que foi modificado neste wizard.',
		keepEditing: 'Continuar editando',
		confirm: 'Descartar',
	},
	presetWelcome: {
		blankTitle: 'Começar do zero',
		blankDescription: 'Configure manualmente o matcher e a ação.',
		templatesTitle: 'Usar template',
		templatesHint: 'Pré-preenche o wizard. Você ainda pode editar antes de salvar.',
	},
	breakpoint: {
		descriptionLabel: 'Descrição (opcional)',
		descriptionPlaceholder: 'Ex: pausar para conferir token de autenticação antes de prosseguir',
		descriptionHelp:
			'Esta descrição aparecerá no inspector de respostas quando a regra disparar — útil para lembrar por que o breakpoint foi configurado.',
		infoTitle: 'Sobre o Breakpoint',
		infoText:
			'Quando esta regra casar, o request será pausado e o dialog de inspeção será aberto para edição manual da resposta antes de prosseguir.',
	},
	block: {
		reasonLabel: 'Motivo do bloqueio',
		reasons: {
			failed: 'Erro genérico — net::ERR_FAILED no devtools.',
			aborted: 'Requisição cancelada — net::ERR_ABORTED.',
			timedOut: 'Timeout simulado — net::ERR_TIMED_OUT.',
			accessDenied: 'Acesso negado por política — net::ERR_ACCESS_DENIED.',
			connectionFailed: 'Falha na conexão TCP — net::ERR_CONNECTION_FAILED.',
			connectionRefused: 'Servidor recusou — net::ERR_CONNECTION_REFUSED.',
			nameNotResolved: 'DNS falhou — net::ERR_NAME_NOT_RESOLVED.',
			blockedByClient: 'Bloqueado por extensão/cliente — net::ERR_BLOCKED_BY_CLIENT.',
			internetDisconnected: 'Sem conectividade — net::ERR_INTERNET_DISCONNECTED.',
		},
		infoTitle: 'Falha imediata, sem chamada à rede',
		infoText:
			'O request será encerrado com <code>Fetch.failRequest</code> e o motivo selecionado. Útil pra simular cenários offline, DNS quebrado, timeout ou bloqueios por política sem mexer no servidor.',
	},
	delay: {
		errors: {
			empty: 'Informe um valor em milissegundos.',
			notDigits: 'Informe um número inteiro não negativo (apenas dígitos).',
			negative: 'O delay precisa ser um número inteiro maior ou igual a zero.',
		},
		label: 'Delay em milissegundos',
		help: 'Mínimo 0ms. Valores maiores aumentam o tempo de espera percebido pelo cliente.',
		presets: 'Presets rápidos',
		infoTitle: 'Sobre o Delay',
		infoText:
			'O servidor remoto será chamado normalmente; a resposta será segurada por <strong>{{ms}}ms</strong> antes de devolver ao cliente.',
	},
	headerMatchers: {
		empty: 'Nenhum header capturado nesta request.',
		title: 'Header matchers (opcional)',
		selected_one: '{{count}} marcado de {{total}}',
		selected_many: '{{count}} marcados de {{total}}',
		selected_other: '{{count}} marcados de {{total}}',
		available_one: '{{count}} disponível',
		available_many: '{{count}} disponíveis',
		available_other: '{{count}} disponíveis',
		help: 'Marque headers para exigir o mesmo valor na request original. Headers sensíveis ficam mascarados.',
		columns: {
			include: 'Inc.',
			type: 'Tipo',
			name: 'Nome',
			value: 'Valor',
		},
	},
	chain: {
		terminal: 'Terminal',
		paused: 'Pausada',
		invalidForStage: 'Esta action não é válida no stage atual ({{stage}}).',
		unreachable: 'Inalcançável — action terminal anterior interrompe a chain.',
		moveUp: 'Mover action {{position}} para cima',
		moveDown: 'Mover action {{position}} para baixo',
		remove: 'Remover action {{position}}',
		terminatedBy:
			'A chain já é terminada por "{{action}}". Remova-a antes de adicionar novas actions.',
		responseChainCapped:
			'Chain com múltiplas actions em stage=response ainda não é suportada — o engine atual executa só a primeira. Remova esta action para trocar por outra.',
		empty: 'Nenhuma action configurada. Adicione a primeira para definir o comportamento da regra.',
		add: 'Adicionar action',
	},
	headerOps: {
		namePlaceholder: 'X-Custom-Header',
		valuePlaceholder: 'valor',
		nameAriaLabel: 'Nome do header ({{mode}})',
		valueAriaLabel: 'Valor do header ({{mode}})',
		add: 'Adicionar',
		removeHeader: 'Remover header {{name}}',
		removeTitle: 'Remover headers',
		removeHelp:
			'Headers removidos antes da aplicação de <strong>set</strong> e <strong>add</strong>.',
		removeNameAriaLabel: 'Nome do header a remover',
		undoRemove: 'Desfazer remoção de {{name}}',
		setTitle: 'Definir headers',
		setHelp: 'Substitui o valor existente (ou cria se não existir).',
		addTitle: 'Adicionar headers',
		addHelp: 'Adiciona somente se não existir (case-insensitive).',
		order:
			'Ordem de aplicação: <strong>remove</strong> → <strong>set</strong> → <strong>add</strong>.',
	},
	modifyTabs: {
		urlAndMethod: 'URL & Método',
		status: 'Status',
		headers: 'Headers',
		body: 'Body',
	},
	requestModify: {
		overrideUrl: 'Sobrescrever URL',
		urlPlaceholder: 'https://api.exemplo.com/users/42',
		urlHelp:
			'Substitui completamente a URL antes do envio (útil pra redirecionar pra outro host ou caminho).',
		overrideMethod: 'Sobrescrever método HTTP',
		replaceBody: 'Substituir body',
		bodyHelp:
			'O conteúdo substitui o <code>postData</code> da requisição original. Para edições pontuais (JSONPath), prefira <code>bodyOperations</code> (em breve no editor).',
		infoTitle: 'Modificador de request',
		infoText:
			'Roda no estágio <strong>Request</strong>, antes de a requisição sair pra rede. A chain continua após o modify — combine com outras actions (mock, block) na mesma regra.',
	},
	responseModify: {
		statusErrors: {
			empty: 'Informe um status code HTTP.',
			notDigits: 'O status precisa conter apenas dígitos.',
			outOfRange: 'O status deve estar entre 100 e 599.',
		},
		overrideStatus: 'Sobrescrever status code',
		statusLabel: 'Status (100–599)',
		statusTextLabel: 'Status text (opcional)',
		replaceBody: 'Substituir body',
		bodyHelp: 'Para edições JSONPath, considere a action <strong>Transform</strong>.',
		infoTitle: 'Modificador de response',
		infoText:
			'Roda no estágio <strong>Response</strong>, após o servidor responder e antes do retorno ao browser. A chain continua após o modify.',
	},
};

export default ruleEditor;
