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
};

export default rules;
