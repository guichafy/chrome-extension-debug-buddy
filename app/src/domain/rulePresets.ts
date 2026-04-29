import type { Matcher, MockAction, RuleDraft, RulePresetId, UrlMatcher } from '@/types/rules';

export interface PresetSpec {
	name: string;
	description: string;
	action: MockAction;
}

export const PRESETS: Record<RulePresetId, PresetSpec> = {
	http_error_500: {
		name: 'Erro 500 (Internal Server Error)',
		description: 'Retorna 500 Internal Server Error com payload JSON.',
		action: {
			type: 'mock',
			enabled: true,
			status: 500,
			statusPhrase: 'Internal Server Error',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"internal_server_error"}',
		},
	},
	http_error_404: {
		name: 'Erro 404 (Not Found)',
		description: 'Retorna 404 Not Found com payload JSON.',
		action: {
			type: 'mock',
			enabled: true,
			status: 404,
			statusPhrase: 'Not Found',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"not_found"}',
		},
	},
	http_error_401: {
		name: 'Erro 401 (Unauthorized)',
		description: 'Retorna 401 Unauthorized com payload JSON.',
		action: {
			type: 'mock',
			enabled: true,
			status: 401,
			statusPhrase: 'Unauthorized',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"unauthorized"}',
		},
	},
	http_error_403: {
		name: 'Erro 403 (Forbidden)',
		description: 'Retorna 403 Forbidden com payload JSON.',
		action: {
			type: 'mock',
			enabled: true,
			status: 403,
			statusPhrase: 'Forbidden',
			headers: { 'content-type': 'application/json' },
			body: '{"error":"forbidden"}',
		},
	},
	latency_fixed: {
		name: 'Latência fixa (1s)',
		description: 'Atrasa a resposta em 1s e devolve 200 OK.',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			latency: { mode: 'fixed', delayMs: 1000 },
		},
	},
	latency_range: {
		name: 'Latência variável (0.5s–2s)',
		description: 'Atrasa a resposta entre 0.5s e 2s e devolve 200 OK.',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			body: '{"ok":true}',
			latency: { mode: 'range', minMs: 500, maxMs: 2000 },
		},
	},
	empty_response: {
		name: 'Resposta vazia (200)',
		description: 'Devolve 200 OK com body vazio.',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: {},
			body: '',
		},
	},
	broken_json: {
		name: 'JSON quebrado (200 com payload inválido)',
		description: 'Devolve 200 OK com JSON inválido sintaticamente.',
		action: {
			type: 'mock',
			enabled: true,
			status: 200,
			statusPhrase: 'OK',
			headers: { 'content-type': 'application/json' },
			contentType: 'application/json',
			body: '{"unterminated":',
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
		matchers,
		action: { ...spec.action },
	};
}
