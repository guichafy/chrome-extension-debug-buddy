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

// Spec de um preset. `stage` define o estágio da regra resultante; `actions`
// é o array já encadeado (ex.: mock atrasado vira [requestDelay, mock] no
// Request stage). Quando o preset é só mock no Response stage, `actions`
// fica com um único item.
export interface PresetSpec {
	name: string;
	description: string;
	stage: RuleStage;
	actions: Action[];
}

const mockResponse = (mock: MockAction): PresetSpec => ({
	name: 'placeholder',
	description: 'placeholder',
	stage: 'response',
	actions: [mock],
});

const mockRequestWithDelay = (delayMs: number, mock: MockAction): PresetSpec => ({
	name: 'placeholder',
	description: 'placeholder',
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

const mockRequestWithRangeDelay = (minMs: number, maxMs: number, mock: MockAction): PresetSpec => {
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
		name: 'Erro 500 (Internal Server Error)',
		description: 'Retorna 500 Internal Server Error com payload JSON.',
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
		name: 'Erro 404 (Not Found)',
		description: 'Retorna 404 Not Found com payload JSON.',
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
		name: 'Erro 401 (Unauthorized)',
		description: 'Retorna 401 Unauthorized com payload JSON.',
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
		name: 'Erro 403 (Forbidden)',
		description: 'Retorna 403 Forbidden com payload JSON.',
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
		name: 'Latência fixa (1s)',
		description: 'Atrasa a resposta em 1s e devolve 200 OK.',
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
		name: 'Latência variável (0.5s–2s)',
		description: 'Atrasa a resposta entre 0.5s e 2s e devolve 200 OK.',
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
		name: 'Resposta vazia (200)',
		description: 'Devolve 200 OK com body vazio.',
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
		name: 'JSON quebrado (200 com payload inválido)',
		description: 'Devolve 200 OK com JSON inválido sintaticamente.',
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
