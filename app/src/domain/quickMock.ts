import type { InterceptedResponse } from '@/types/intercepted';
import type { HeaderMatcher, Matcher, MockAction, RuleDraft } from '@/types/rules';

export interface QuickMockHeaderSelection {
	headerType: 'request' | 'response';
	name: string;
	value: string;
}

export interface QuickMockOptions {
	headerMatchers: QuickMockHeaderSelection[];
	includeQueryString: boolean;
}

export type QuickMockErrorCode =
	| 'method_missing'
	| 'body_unavailable'
	| 'capture_error'
	| 'header_value_missing';

export interface QuickMockError {
	code: QuickMockErrorCode;
	message: string;
}

export type QuickMockResult = { ok: true; draft: RuleDraft } | { ok: false; error: QuickMockError };

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

export function buildQuickMockDraft(
	request: InterceptedResponse,
	options: QuickMockOptions,
): QuickMockResult {
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
				message: 'Não é possível criar mock sem o método HTTP original.',
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

	const responseHeaders = getResponseHeaders(request);
	const responseBody = getResponseBody(request);

	const action: MockAction = {
		type: 'mock',
		enabled: true,
		status: request.status,
		headers: responseHeaders,
		...(request.statusText ? { statusPhrase: request.statusText } : {}),
		...(responseBody !== undefined ? { body: responseBody } : {}),
		...(request.mimeType !== undefined ? { contentType: request.mimeType } : {}),
	};

	const draft: RuleDraft = {
		name: `Mock para ${pattern}`,
		enabled: true,
		matchers,
		action,
	};

	return { ok: true, draft };
}
