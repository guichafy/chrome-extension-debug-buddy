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
};

export default rules;
