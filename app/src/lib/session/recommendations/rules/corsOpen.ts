import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const rule: Rule = (ev) => {
	const acao = (ev.responseHeaders['access-control-allow-origin'] ?? '').trim();
	if (acao !== '*') return null;
	const creds = (ev.responseHeaders['access-control-allow-credentials'] ?? '').toLowerCase().trim();
	if (creds === 'true') return null;

	const u = safeParseUrl(ev.url);
	if (!u) return null;

	return {
		ruleId: 'cors-open',
		severity: 'warn',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `Access-Control-Allow-Origin: * em ${u.host}`,
		evidence: { 'access-control-allow-origin': '*' },
		suggestion: 'Restrinja `Access-Control-Allow-Origin` ao(s) origin(s) confiável(eis).',
	};
};

export const corsOpenRule: RuleDescriptor = { id: 'cors-open', rule };
