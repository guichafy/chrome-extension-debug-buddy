import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const rule: Rule = (ev, ctx) => {
	if (!ctx.topFrameUrl) return null;
	if (!ctx.topFrameUrl.startsWith('https:')) return null;
	if (!ev.url.startsWith('http:')) return null; // exclui https:, data:, blob:

	const u = safeParseUrl(ev.url);
	if (!u) return null;

	return {
		ruleId: 'mixed-content',
		severity: 'error',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `subresource HTTP em página HTTPS: ${ev.url}`,
		evidence: { page: ctx.topFrameUrl, subresource: ev.url },
		suggestion: 'Migre o subresource para HTTPS — navegadores bloqueiam mixed content em produção.',
	};
};

export const mixedContentRule: RuleDescriptor = { id: 'mixed-content', rule };
