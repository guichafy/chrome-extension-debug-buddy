import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (!ev.url.startsWith('https:')) return null;
	if (ev.responseHeaders['strict-transport-security']) return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'hsts-missing',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `HTTPS sem HSTS: ${host}`,
		evidence: { 'strict-transport-security': 'absent' },
		suggestion: 'Adicione `Strict-Transport-Security: max-age=31536000; includeSubDomains` para forçar HTTPS.',
	};
};

export const hstsMissingRule: RuleDescriptor = { id: 'hsts-missing', rule };
