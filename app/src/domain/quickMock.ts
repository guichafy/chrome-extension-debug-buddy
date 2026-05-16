import type { InterceptedResponse } from '@/types/intercepted';
import type {
	Action,
	ActionType,
	HeaderMatcher,
	Matcher,
	MockAction,
	RuleDraft,
	RuleStage,
} from '@/types/rules';

export interface QuickMockHeaderSelection {
	headerType: 'request' | 'response';
	name: string;
	value: string;
}

export interface BuildRuleDraftOptions {
	type: ActionType;
	headerMatchers: QuickMockHeaderSelection[];
	includeQueryString: boolean;
}

export type QuickMockErrorCode = 'method_missing' | 'capture_error' | 'header_value_missing';

export interface QuickMockError {
	code: QuickMockErrorCode;
	message: string;
}

export type BuildRuleDraftResult =
	| { ok: true; draft: RuleDraft }
	| { ok: false; error: QuickMockError };

// Subset de ActionType que o Quick Mock oferece como ponto de partida ao
// transformar uma request real em regra. Não inclui `requestModify`/
// `responseModify`/`block` — esses são criados manualmente via wizard.
export type QuickMockActionType = 'mock' | 'breakpoint' | 'transform' | 'requestDelay';

const NAME_PREFIX_BY_TYPE: Record<QuickMockActionType, string> = {
	mock: 'Mock',
	breakpoint: 'Breakpoint',
	transform: 'Transform',
	requestDelay: 'Latência',
};

// Stage natural de cada tipo no fluxo Quick Mock. Mock substitui a resposta
// (Response stage é o uso mais comum a partir de uma request capturada — o
// usuário viu o body real e quer reusar como mock). Transform precisa do
// body real (Response). Breakpoint pós-rede também faz sentido como default
// quando o usuário pega uma request existente. RequestDelay é o único pré-rede.
const STAGE_BY_TYPE: Record<QuickMockActionType, RuleStage> = {
	mock: 'response',
	breakpoint: 'response',
	transform: 'response',
	requestDelay: 'request',
};

function urlPattern(rawUrl: string, includeQueryString: boolean): string {
	const url = new URL(rawUrl);
	const base = url.host + url.pathname;
	return includeQueryString && url.search ? base + url.search : base;
}

function getResponseHeaders(req: InterceptedResponse): Record<string, string> {
	return req.response?.headers ?? req.headers;
}

function getResponseBody(req: InterceptedResponse): string | undefined {
	if (req.response && 'body' in req.response) return req.response.body;
	return req.body;
}

function buildMockAction(request: InterceptedResponse): MockAction {
	const responseHeaders = getResponseHeaders(request);
	const responseBody = getResponseBody(request);
	return {
		type: 'mock',
		enabled: true,
		status: request.status,
		headers: responseHeaders,
		...(request.statusText ? { statusPhrase: request.statusText } : {}),
		...(responseBody !== undefined ? { body: responseBody } : {}),
		...(request.mimeType !== undefined ? { contentType: request.mimeType } : {}),
	};
}

function buildActionForType(type: QuickMockActionType, request: InterceptedResponse): Action {
	switch (type) {
		case 'mock':
			return buildMockAction(request);
		case 'breakpoint':
			return { type: 'breakpoint', enabled: true, description: '' };
		case 'transform':
			return { type: 'transform', enabled: true, mode: 'declarative', operations: [] };
		case 'requestDelay':
			return { type: 'requestDelay', enabled: true, timeMs: 1000 };
		default: {
			const exhaustive: never = type;
			throw new Error(`Tipo de ação não suportado: ${String(exhaustive)}`);
		}
	}
}

function isQuickMockActionType(type: ActionType): type is QuickMockActionType {
	return (
		type === 'mock' || type === 'breakpoint' || type === 'transform' || type === 'requestDelay'
	);
}

export function buildRuleDraftFromRequest(
	request: InterceptedResponse,
	options: BuildRuleDraftOptions,
): BuildRuleDraftResult {
	if (request.captureError) {
		return {
			ok: false,
			error: { code: 'capture_error', message: request.captureError },
		};
	}
	if (!request.method) {
		return {
			ok: false,
			error: {
				code: 'method_missing',
				message: 'Não é possível criar regra sem o método HTTP original.',
			},
		};
	}
	if (!isQuickMockActionType(options.type)) {
		return {
			ok: false,
			error: {
				code: 'method_missing',
				message: `Quick Mock não suporta o tipo de ação '${options.type}'.`,
			},
		};
	}

	const pattern = urlPattern(request.url, options.includeQueryString);

	const matchers: Matcher[] = [
		{ type: 'url', enabled: true, pattern, isRegex: false },
		{ type: 'method', enabled: true, method: request.method },
	];

	for (const selection of options.headerMatchers) {
		if (!selection.value) {
			return {
				ok: false,
				error: {
					code: 'header_value_missing',
					message: `Header "${selection.name}" foi marcado mas não tem valor capturado.`,
				},
			};
		}
		const headerMatcher: HeaderMatcher = {
			type: 'header',
			enabled: true,
			headerType: selection.headerType,
			name: selection.name,
			value: selection.value,
		};
		matchers.push(headerMatcher);
	}

	const action = buildActionForType(options.type, request);
	const stage = STAGE_BY_TYPE[options.type];

	const draft: RuleDraft = {
		name: `${NAME_PREFIX_BY_TYPE[options.type]} para ${pattern}`,
		enabled: true,
		stage,
		matchers,
		actions: [action],
	};

	return { ok: true, draft };
}
