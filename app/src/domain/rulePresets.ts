import type {
	Action,
	Matcher,
	MockAction,
	RequestDelayAction,
	RuleDraft,
	RulePresetId,
	RuleStage,
	UrlMatcher,
} from '@/types/rules';
import { i18n } from '@/i18n/instance';

// Spec de um preset. `stage` define o estágio da regra resultante; `actions`
// é o array já encadeado (ex.: mock atrasado vira [requestDelay, mock] no
// Request stage). Quando o preset é só mock no Response stage, `actions`
// fica com um único item.
// `name`/`description` são getters: resolvem no idioma ativo da UI a cada
// leitura (textos em rules:presets.<chave>).
export interface PresetSpec {
	readonly name: string;
	readonly description: string;
	stage: RuleStage;
	actions: Action[];
}

type PresetBody = Pick<PresetSpec, 'stage' | 'actions'>;

const mockResponse = (mock: MockAction): PresetBody => ({
	stage: 'response',
	actions: [mock],
});

const mockRequestWithDelay = (delayMs: number, mock: MockAction): PresetBody => ({
	stage: 'request',
	actions: [
		{
			type: 'requestDelay',
			enabled: true,
			timeMs: delayMs,
		} satisfies RequestDelayAction,
		mock,
	],
});

const mockRequestWithRangeDelay = (minMs: number, maxMs: number, mock: MockAction): PresetBody => {
	// Para faixa, resolvemos um valor aleatório dentro do range na criação do
	// preset. No futuro (Phase 2/3) a chain pode resolver dinamicamente; por
	// hora preservamos comportamento determinístico do preset materializado.
	const timeMs = minMs + Math.floor((maxMs - minMs) / 2);
	return mockRequestWithDelay(timeMs, mock);
};

export const PRESETS: Record<RulePresetId, PresetSpec> = {
	http_error_500: {
		...mockResponse({
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"internal_server_error"}',
		}),
		get name() {
			return i18n.t('rules:presets.httpError500.name');
		},
		get description() {
			return i18n.t('rules:presets.httpError500.description');
		},
	},
	http_error_404: {
		...mockResponse({
			type: 'mock',
			enabled: true,
			status: 404,
			statusPhrase: 'Not Found',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"not_found"}',
		}),
		get name() {
			return i18n.t('rules:presets.httpError404.name');
		},
		get description() {
			return i18n.t('rules:presets.httpError404.description');
		},
	},
	http_error_401: {
		...mockResponse({
			type: 'mock',
			enabled: true,
			status: 401,
			statusPhrase: 'Unauthorized',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"unauthorized"}',
		}),
		get name() {
			return i18n.t('rules:presets.httpError401.name');
		},
		get description() {
			return i18n.t('rules:presets.httpError401.description');
		},
	},
	http_error_403: {
		...mockResponse({
			type: 'mock',
			enabled: true,
			status: 403,
			statusPhrase: 'Forbidden',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"forbidden"}',
		}),
		get name() {
			return i18n.t('rules:presets.httpError403.name');
		},
		get description() {
			return i18n.t('rules:presets.httpError403.description');
		},
	},
	latency_fixed: {
		...mockRequestWithDelay(1000, {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
		}),
		get name() {
			return i18n.t('rules:presets.latencyFixed.name');
		},
		get description() {
			return i18n.t('rules:presets.latencyFixed.description');
		},
	},
	latency_range: {
		...mockRequestWithRangeDelay(500, 2000, {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
		}),
		get name() {
			return i18n.t('rules:presets.latencyRange.name');
		},
		get description() {
			return i18n.t('rules:presets.latencyRange.description');
		},
	},
	empty_response: {
		...mockResponse({
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: {},
			body: '',
		}),
		get name() {
			return i18n.t('rules:presets.emptyResponse.name');
		},
		get description() {
			return i18n.t('rules:presets.emptyResponse.description');
		},
	},
	broken_json: {
		...mockResponse({
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			contentType: 'application/json',
			body: '{"unterminated":',
		}),
		get name() {
			return i18n.t('rules:presets.brokenJson.name');
		},
		get description() {
			return i18n.t('rules:presets.brokenJson.description');
		},
	},
};

export function createPresetRule(presetId: RulePresetId, baseMatcher?: UrlMatcher): RuleDraft {
	const spec = PRESETS[presetId];
	const matchers: Matcher[] = [];
	if (baseMatcher) {
		matchers.push(baseMatcher);
	} else {
		matchers.push({ type: 'url', enabled: false, pattern: '', isRegex: false });
	}
	matchers.push({ type: 'method', enabled: true, method: 'ANY' });

	return {
		name: spec.name,
		enabled: true,
		stage: spec.stage,
		matchers,
		actions: spec.actions.map((a) => cloneAction(a)),
	};
}

function cloneAction(action: Action): Action {
	switch (action.type) {
		case 'mock':
			return { ...action, headers: { ...action.headers } };
		case 'requestDelay':
			return { ...action };
		case 'requestModify':
			return {
				...action,
				...(action.setHeaders ? { setHeaders: { ...action.setHeaders } } : {}),
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.bodyOperations
					? { bodyOperations: action.bodyOperations.map((op) => ({ ...op })) }
					: {}),
			};
		case 'responseModify':
			return {
				...action,
				...(action.setHeaders ? { setHeaders: { ...action.setHeaders } } : {}),
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.bodyOperations
					? { bodyOperations: action.bodyOperations.map((op) => ({ ...op })) }
					: {}),
			};
		case 'transform':
			return {
				...action,
				...(action.addHeaders ? { addHeaders: { ...action.addHeaders } } : {}),
				...(action.removeHeaders ? { removeHeaders: [...action.removeHeaders] } : {}),
				...(action.operations ? { operations: action.operations.map((op) => ({ ...op })) } : {}),
			};
		case 'block':
			return { ...action };
		case 'breakpoint':
			return { ...action };
		default: {
			const exhaustive: never = action;
			throw new Error(
				`Tipo de ação desconhecido em preset: ${(exhaustive as { type: string }).type}`,
			);
		}
	}
}
