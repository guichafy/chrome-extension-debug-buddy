import type { InterceptedResponse } from '../types/intercepted';

export function normalizeInterceptedResponse(request: InterceptedResponse): InterceptedResponse {
	if (request.response) return request;

	return {
		...request,
		response: {
			headers: request.headers,
			...('body' in request ? { body: request.body } : {}),
		},
	};
}
