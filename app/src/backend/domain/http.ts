export interface HeaderEntry {
	name: string;
	value: string;
}

const STATUS_PHRASES: Record<number, string> = {
	100: 'Continue',
	101: 'Switching Protocols',
	102: 'Processing',
	103: 'Early Hints',
	200: 'OK',
	201: 'Created',
	202: 'Accepted',
	203: 'Non-Authoritative Information',
	204: 'No Content',
	205: 'Reset Content',
	206: 'Partial Content',
	207: 'Multi-Status',
	208: 'Already Reported',
	226: 'IM Used',
	300: 'Multiple Choices',
	301: 'Moved Permanently',
	302: 'Found',
	303: 'See Other',
	304: 'Not Modified',
	305: 'Use Proxy',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',
	400: 'Bad Request',
	401: 'Unauthorized',
	402: 'Payment Required',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	406: 'Not Acceptable',
	407: 'Proxy Authentication Required',
	408: 'Request Timeout',
	409: 'Conflict',
	410: 'Gone',
	411: 'Length Required',
	412: 'Precondition Failed',
	413: 'Content Too Large',
	414: 'URI Too Long',
	415: 'Unsupported Media Type',
	416: 'Range Not Satisfiable',
	417: 'Expectation Failed',
	418: "I'm a Teapot",
	421: 'Misdirected Request',
	422: 'Unprocessable Content',
	423: 'Locked',
	424: 'Failed Dependency',
	425: 'Too Early',
	426: 'Upgrade Required',
	428: 'Precondition Required',
	429: 'Too Many Requests',
	431: 'Request Header Fields Too Large',
	451: 'Unavailable For Legal Reasons',
	500: 'Internal Server Error',
	501: 'Not Implemented',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
	505: 'HTTP Version Not Supported',
	506: 'Variant Also Negotiates',
	507: 'Insufficient Storage',
	508: 'Loop Detected',
	510: 'Not Extended',
	511: 'Network Authentication Required',
};

export function getHttpStatusPhrase(statusCode: number, explicitPhrase?: string): string {
	if (explicitPhrase?.trim()) return explicitPhrase.trim();
	const known = STATUS_PHRASES[statusCode];
	if (!known) {
		throw new Error(`Status phrase nao conhecido para ${statusCode}`);
	}
	return known;
}

export function getBodyUnavailableReason(method: string, statusCode: number): string | undefined {
	const normalizedMethod = method.toUpperCase();
	if (normalizedMethod === 'HEAD') {
		return 'Requisicoes HEAD nao possuem corpo de resposta.';
	}

	if (statusCode >= 100 && statusCode < 200) {
		return `Respostas informativas ${statusCode} nao possuem corpo disponivel.`;
	}

	if (statusCode === 204 || statusCode === 205 || statusCode === 304) {
		return `Resposta ${statusCode} nao possui corpo disponivel.`;
	}

	return undefined;
}

export function getCaptureBodyUnavailableReason(
	method: string,
	statusCode: number,
): string | undefined {
	const protocolReason = getBodyUnavailableReason(method, statusCode);
	if (protocolReason) return protocolReason;

	if (statusCode >= 300 && statusCode < 400) {
		return `Redirect ${statusCode} nao possui corpo capturavel via Fetch.getResponseBody.`;
	}

	return undefined;
}

export function validateMockBody(
	method: string,
	statusCode: number,
	body: string | undefined,
): { shouldSendBody: false } | { shouldSendBody: true; body: string } {
	if (body === undefined) return { shouldSendBody: false };

	const reason = getBodyUnavailableReason(method, statusCode);
	if (reason) {
		throw new Error(`Mock ${method.toUpperCase()} ${statusCode} nao pode definir body: ${reason}`);
	}

	return { shouldSendBody: true, body };
}

export function encodeBodyToBase64(body: string): string {
	const bytes = new TextEncoder().encode(body);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export function headersArrayToRecord(headers: HeaderEntry[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const header of headers) {
		if (!header.name) {
			throw new Error('Header sem nome recebido do CDP');
		}
		result[header.name] = header.value;
	}
	return result;
}

export function headersRecordToArray(headers: Record<string, string>): HeaderEntry[] {
	return Object.entries(headers).map(([name, value]) => {
		if (!name) {
			throw new Error('Header sem nome nao pode ser enviado ao CDP');
		}
		return { name, value };
	});
}

export function requestHeadersToRecord(
	headers: Record<string, string> | undefined,
): Record<string, string> {
	if (!headers) return {};
	return { ...headers };
}

export function getHeaderValue(headers: Record<string, string>, name: string): string | undefined {
	const normalizedName = name.toLowerCase();
	for (const [headerName, value] of Object.entries(headers)) {
		if (headerName.toLowerCase() === normalizedName) return value;
	}
	return undefined;
}

export function getMimeTypeFromHeaders(headers: HeaderEntry[] | Record<string, string>): string {
	const headerRecord = Array.isArray(headers) ? headersArrayToRecord(headers) : headers;
	const contentType = getHeaderValue(headerRecord, 'content-type');
	if (!contentType) {
		throw new Error('Header Content-Type ausente');
	}
	return contentType.split(';')[0].trim();
}

export function getOptionalMimeTypeFromHeaders(
	headers: HeaderEntry[] | Record<string, string>,
): string | undefined {
	const headerRecord = Array.isArray(headers) ? headersArrayToRecord(headers) : headers;
	const contentType = getHeaderValue(headerRecord, 'content-type');
	return contentType ? contentType.split(';')[0].trim() : undefined;
}
