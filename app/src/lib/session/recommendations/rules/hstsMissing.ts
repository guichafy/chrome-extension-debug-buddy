import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const rule: Rule = (ev) => {
	if (!ev.url.startsWith('https:')) return null;
	if (ev.responseHeaders['strict-transport-security']) return null;

	const u = safeParseUrl(ev.url);
	if (!u) return null;

	return {
		ruleId: 'hsts-missing',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `HTTPS sem HSTS: ${u.host}`,
		evidence: { 'strict-transport-security': 'absent' },
		suggestion: 'Adicione `Strict-Transport-Security: max-age=31536000; includeSubDomains` para forçar HTTPS.',
	};
};

export const hstsMissingRule: RuleDescriptor = { id: 'hsts-missing', rule };
