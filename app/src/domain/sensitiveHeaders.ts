const SENSITIVE_HEADERS = new Set([
	'authorization',
	'proxy-authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'x-auth-token',
	'x-csrf-token',
	'x-xsrf-token',
]);

export function isSensitiveHeader(name: string): boolean {
	return SENSITIVE_HEADERS.has(name.toLowerCase());
}

export function maskHeaderValue(name: string, value: string): string {
	if (!isSensitiveHeader(name)) return value;
	return '•••••• (mascarado)';
}
