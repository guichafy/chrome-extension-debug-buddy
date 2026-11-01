// Conceitos de regra compartilhados por Rules Lab, editor de regras e
// Command Center: stages, tipos de ação e os resumos exibidos em listas.
const rules = {
	stages: {
		request: 'Request',
		response: 'Response',
	},
	actionTypes: {
		mock: 'Mock',
		requestDelay: 'Latência',
		transform: 'Transform',
		breakpoint: 'Breakpoint',
		requestModify: 'Modify req',
		responseModify: 'Modify res',
		block: 'Block',
	},
	summary: {
		mock: 'Mock {{status}}{{phrase}}',
		delay: 'Atrasar {{ms}}ms',
		transformAdvanced: 'Transform · script avançado',
		transformEmptyScript: 'Transform · script vazio',
		transformOperations_one: 'Transform · {{count}} operação',
		transformOperations_many: 'Transform · {{count}} operações',
		transformOperations_other: 'Transform · {{count}} operações',
		transformStatus: 'Transform (status {{status}})',
		transformResponse: 'Transform resposta',
		breakpoint: 'Breakpoint',
		breakpointWithDescription: 'Breakpoint — {{description}}',
		requestModify: 'Modificar request',
		responseModify: 'Modificar response',
		block: 'Bloquear ({{reason}})',
	},
	matcherSummary: {
		anyUrl: '(qualquer URL)',
		header: 'header {{name}}',
		anyHeader: '(qualquer)',
		noConditions: 'Sem condições',
	},
	actionDescriptions: {
		mock: 'Substitui a resposta sem chamar o servidor (ou após o servidor responder).',
		requestDelay: 'Atrasa a chain N ms antes de continuar.',
		transform: 'Chama o servidor e altera a resposta via JSONPath ou script.',
		breakpoint: 'Pausa para edição manual antes de prosseguir.',
		requestModify: 'Edita URL, método, headers e body antes do envio.',
		responseModify: 'Edita status, headers e body antes de devolver ao browser.',
		block: 'Falha a requisição com um errorReason específico.',
	},
	presets: {
		httpError500: {
			name: 'Erro 500 (Internal Server Error)',
			description: 'Retorna 500 Internal Server Error com payload JSON.',
		},
		httpError404: {
			name: 'Erro 404 (Not Found)',
			description: 'Retorna 404 Not Found com payload JSON.',
		},
		httpError401: {
			name: 'Erro 401 (Unauthorized)',
			description: 'Retorna 401 Unauthorized com payload JSON.',
		},
		httpError403: {
			name: 'Erro 403 (Forbidden)',
			description: 'Retorna 403 Forbidden com payload JSON.',
		},
		latencyFixed: {
			name: 'Latência fixa (1s)',
			description: 'Atrasa a resposta em 1s e devolve 200 OK.',
		},
		latencyRange: {
			name: 'Latência variável (0.5s–2s)',
			description: 'Atrasa a resposta entre 0.5s e 2s e devolve 200 OK.',
		},
		emptyResponse: {
			name: 'Resposta vazia (200)',
			description: 'Devolve 200 OK com body vazio.',
		},
		brokenJson: {
			name: 'JSON quebrado (200 com payload inválido)',
			description: 'Devolve 200 OK com JSON inválido sintaticamente.',
		},
	},
	templates: {
		delay3s: {
			name: 'Atrasar resposta em 3s',
			description:
				'Chama o servidor normalmente e segura a resposta por 3000ms antes de devolvê-la ao cliente.',
		},
		transformCorsHeader: {
			name: 'Adicionar header CORS Access-Control-Allow-Origin: *',
			description:
				'Chama o servidor e injeta o cabeçalho CORS na resposta para permitir requisições cross-origin durante o debug.',
		},
		transformRemoveId: {
			name: 'Remover campo id da resposta JSON',
			description:
				'Chama o servidor e remove o campo $.id do body JSON da resposta, útil para testar como o cliente reage à ausência do identificador.',
		},
		breakpointManual: {
			name: 'Pausar para inspeção/edição manual',
			description:
				'Pausa a requisição assim que casar e abre o dialog para você inspecionar e editar a resposta antes de prosseguir.',
			actionDescription: 'Pausa para inspeção e edição manual da resposta antes de prosseguir.',
		},
	},
	templateGroups: {
		mock: 'Mock — não chama o servidor',
		delay: 'Delay — segura a resposta',
		transform: 'Transform — chama o servidor e modifica a resposta',
		breakpoint: 'Breakpoint — pausa para inspeção',
	},
	quickMock: {
		ruleName: '{{prefix}} para {{pattern}}',
		methodMissing: 'Não é possível criar regra sem o método HTTP original.',
		unsupportedType: "Quick Mock não suporta o tipo de ação '{{type}}'.",
		headerValueMissing: 'Header "{{name}}" foi marcado mas não tem valor capturado.',
	},
	importValidation: {
		ruleNotObject: 'regra não é objeto',
		ruleMissingId: 'regra sem id válido',
		ruleMissingName: 'regra sem name',
		ruleMissingEnabled: 'regra sem enabled',
		ruleInvalidStage: "regra sem stage válido ('request' | 'response')",
		ruleMissingMatchers: 'regra sem matchers (deve ser array)',
		invalidMatcher: 'matcher inválido na regra',
		ruleMissingActions: 'regra sem actions (deve ser array não vazio)',
		invalidAction: 'action inválida na regra',
		missingCreatedAt: 'createdAt ausente',
		missingUpdatedAt: 'updatedAt ausente',
		actionInvalidForStage: "action '{{type}}' não é válida em stage '{{stage}}'",
		tooManyTerminals: 'chain com {{total}} actions terminais (máx 1)',
		terminalNotLast: 'action terminal precisa ser a última da chain',
		responseChainUnsupported:
			'chain com 2+ actions em stage=response ainda não é suportada (Response stage roda no engine single-action; aguardando migração para executeChain)',
		fileNotObject: 'arquivo não é objeto JSON',
		unsupportedSchema: 'schemaVersion {{version}} não suportado (esperado {{expected}})',
		rulesNotArray: 'rules deve ser um array',
	},
};

export default rules;
