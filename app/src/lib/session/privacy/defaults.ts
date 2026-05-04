import type { RedactionConfig } from '../types';

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
	enabled: true,
	headerKeys: [
		'authorization',
		'cookie',
		'set-cookie',
		'x-api-key',
		'x-auth-token',
		'proxy-authorization',
	],
	headerRegex: ['^x-.*-token$', '^x-.*-secret$'],
	bodyRegex: [
		// JWT eyJ... (3 segmentos base64url)
		'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
		// Card PAN (13–19 dígitos com possíveis separadores)
		'\\b(?:\\d[ -]?){13,19}\\b',
		// "password":"..." em JSON
		'"password"\\s*:\\s*"[^"]+"',
		// "secret":"..." em JSON
		'"(?:secret|token|api[_-]?key)"\\s*:\\s*"[^"]+"',
	],
	consoleEnabled: true,
	consoleRegex: [
		'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
		'\\b(?:\\d[ -]?){13,19}\\b',
		'(?:password|senha|token|secret|api[_-]?key)\\s*[:=]\\s*\\S+',
	],
	rrwebMaskAllInputs: false,
	rrwebMaskTextSelector:
		'[autocomplete^="cc-"], [name*="card" i], [name*="cvv" i], [name*="password" i], .dbb-mask, [data-dbb-mask]',
	urlBlacklist: [],
	truncateUserPaths: true,
	autoPurgeEnabled: false,
	autoPurgeRetentionDays: 30,
};

export const REDACTION_PLACEHOLDER = '[REDACTED]';
