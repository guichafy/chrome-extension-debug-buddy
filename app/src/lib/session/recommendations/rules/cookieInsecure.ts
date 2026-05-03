import type { Rule, RuleDescriptor } from '../types';

function parseFirstCookieFlags(setCookie: string): { name: string; flags: Set<string> } {
	// Split em ',' não é seguro porque Expires=Wed, 01... contém vírgula. Em CDP
	// `set-cookie` chega como string concatenada por '\n' quando há múltiplos.
	// Pegamos só o primeiro.
	const first = setCookie.split('\n')[0] ?? setCookie;
	const parts = first.split(';').map((p) => p.trim());
	const [nameAndValue, ...attrs] = parts;
	const name = nameAndValue.split('=')[0]?.trim() ?? '';
	const flags = new Set(attrs.map((a) => a.split('=')[0]!.toLowerCase()));
	return { name, flags };
}

const rule: Rule = (ev) => {
	const sc = ev.responseHeaders['set-cookie'];
	if (!sc) return null;

	const { name, flags } = parseFirstCookieFlags(sc);
	const isHttps = ev.url.startsWith('https:');
	const missing: string[] = [];
	if (isHttps && !flags.has('secure')) missing.push('Secure');
	if (!flags.has('httponly')) missing.push('HttpOnly');
	if (missing.length === 0) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'cookie-insecure',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `cookie ${name || '?'} sem ${missing.join('+')} em ${host}`,
		evidence: { cookie: name || '?', missing: missing.join(';') },
		suggestion: 'Adicione flags `Secure; HttpOnly` (e considere `SameSite=Lax`).',
	};
};

export const cookieInsecureRule: RuleDescriptor = { id: 'cookie-insecure', rule };
