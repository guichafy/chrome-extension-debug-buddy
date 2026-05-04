import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const ct = (ev.responseHeaders['content-type'] ?? '').toLowerCase();
	if (!ct.includes('text/html')) return null;

	if (ev.responseHeaders['content-security-policy']) return null;
	if (ev.responseHeaders['content-security-policy-report-only']) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'csp-missing',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `HTML sem Content-Security-Policy: ${host}`,
		evidence: { 'content-type': ct, 'content-security-policy': 'absent' },
		suggestion: 'Adicione `Content-Security-Policy` para mitigar XSS.',
	};
};

export const cspMissingRule: RuleDescriptor = { id: 'csp-missing', rule };
