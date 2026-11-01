import type { Translation } from '../../types';
import type source from '../pt-BR/rules';

const rules: Translation<typeof source> = {
	stages: {
		request: 'Request',
		response: 'Response',
	},
	actionTypes: {
		mock: 'Mock',
		requestDelay: 'Latency',
		transform: 'Transform',
		breakpoint: 'Breakpoint',
		requestModify: 'Modify req',
		responseModify: 'Modify res',
		block: 'Block',
	},
	summary: {
		mock: 'Mock {{status}}{{phrase}}',
		delay: 'Delay {{ms}}ms',
		transformAdvanced: 'Transform · advanced script',
		transformEmptyScript: 'Transform · empty script',
		transformOperations_one: 'Transform · {{count}} operation',
		transformOperations_other: 'Transform · {{count}} operations',
		transformStatus: 'Transform (status {{status}})',
		transformResponse: 'Transform response',
		breakpoint: 'Breakpoint',
		breakpointWithDescription: 'Breakpoint — {{description}}',
		requestModify: 'Modify request',
		responseModify: 'Modify response',
		block: 'Block ({{reason}})',
	},
	matcherSummary: {
		anyUrl: '(any URL)',
		header: 'header {{name}}',
		anyHeader: '(any)',
		noConditions: 'No conditions',
	},
	actionDescriptions: {
		mock: 'Replaces the response without calling the server (or after the server responds).',
		requestDelay: 'Delays the chain by N ms before continuing.',
		transform: 'Calls the server and changes the response via JSONPath or script.',
		breakpoint: 'Pauses for manual editing before continuing.',
		requestModify: 'Edits URL, method, headers and body before sending.',
		responseModify: 'Edits status, headers and body before returning to the browser.',
		block: 'Fails the request with a specific errorReason.',
	},
	presets: {
		httpError500: {
			name: 'Error 500 (Internal Server Error)',
			description: 'Returns 500 Internal Server Error with a JSON payload.',
		},
		httpError404: {
			name: 'Error 404 (Not Found)',
			description: 'Returns 404 Not Found with a JSON payload.',
		},
		httpError401: {
			name: 'Error 401 (Unauthorized)',
			description: 'Returns 401 Unauthorized with a JSON payload.',
		},
		httpError403: {
			name: 'Error 403 (Forbidden)',
			description: 'Returns 403 Forbidden with a JSON payload.',
		},
		latencyFixed: {
			name: 'Fixed latency (1s)',
			description: 'Delays the response by 1s and returns 200 OK.',
		},
		latencyRange: {
			name: 'Variable latency (0.5s–2s)',
			description: 'Delays the response between 0.5s and 2s and returns 200 OK.',
		},
		emptyResponse: {
			name: 'Empty response (200)',
			description: 'Returns 200 OK with an empty body.',
		},
		brokenJson: {
			name: 'Broken JSON (200 with invalid payload)',
			description: 'Returns 200 OK with syntactically invalid JSON.',
		},
	},
	templates: {
		delay3s: {
			name: 'Delay response by 3s',
			description:
				'Calls the server normally and holds the response for 3000ms before returning it to the client.',
		},
		transformCorsHeader: {
			name: 'Add CORS header Access-Control-Allow-Origin: *',
			description:
				'Calls the server and injects the CORS header into the response to allow cross-origin requests while debugging.',
		},
		transformRemoveId: {
			name: 'Remove the id field from the JSON response',
			description:
				'Calls the server and removes the $.id field from the JSON response body, useful to test how the client reacts when the identifier is missing.',
		},
		breakpointManual: {
			name: 'Pause for manual inspection/editing',
			description:
				'Pauses the request as soon as it matches and opens the dialog so you can inspect and edit the response before continuing.',
			actionDescription:
				'Pause for manual inspection and editing of the response before continuing.',
		},
	},
	templateGroups: {
		mock: 'Mock — does not call the server',
		delay: 'Delay — holds the response',
		transform: 'Transform — calls the server and modifies the response',
		breakpoint: 'Breakpoint — pauses for inspection',
	},
	quickMock: {
		ruleName: '{{prefix}} for {{pattern}}',
		methodMissing: 'Cannot create a rule without the original HTTP method.',
		unsupportedType: "Quick Mock does not support the '{{type}}' action type.",
		headerValueMissing: 'Header "{{name}}" was selected but has no captured value.',
	},
	importValidation: {
		ruleNotObject: 'rule is not an object',
		ruleMissingId: 'rule without a valid id',
		ruleMissingName: 'rule without name',
		ruleMissingEnabled: 'rule without enabled',
		ruleInvalidStage: "rule without a valid stage ('request' | 'response')",
		ruleMissingMatchers: 'rule without matchers (must be an array)',
		invalidMatcher: 'invalid matcher in rule',
		ruleMissingActions: 'rule without actions (must be a non-empty array)',
		invalidAction: 'invalid action in rule',
		missingCreatedAt: 'createdAt missing',
		missingUpdatedAt: 'updatedAt missing',
		actionInvalidForStage: "action '{{type}}' is not valid in stage '{{stage}}'",
		tooManyTerminals: 'chain with {{total}} terminal actions (max 1)',
		terminalNotLast: 'terminal action must be the last one in the chain',
		responseChainUnsupported:
			'chain with 2+ actions in stage=response is not supported yet (the Response stage runs on the single-action engine; pending migration to executeChain)',
		fileNotObject: 'file is not a JSON object',
		unsupportedSchema: 'schemaVersion {{version}} not supported (expected {{expected}})',
		rulesNotArray: 'rules must be an array',
	},
};

export default rules;
