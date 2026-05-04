import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const PAGINATION_KEYS = ['page', 'limit', 'offset', 'cursor', 'after', 'before', 'pagesize'];

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const length = Number(ev.responseHeaders['content-length']);
	if (!Number.isFinite(length) || length <= 1_048_576) return null;

	const u = safeParseUrl(ev.url);
	if (!u) return null;
	const params = u.searchParams;
	for (const key of PAGINATION_KEYS) {
		if (params.has(key)) return null;
	}

	return {
		ruleId: 'large-payload',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `payload de ${(length / 1024 / 1024).toFixed(1)} MB sem paginação detectada`,
		evidence: { 'content-length': String(length) },
		suggestion: 'Considere paginação ou compressão semântica.',
	};
};

export const largePayloadRule: RuleDescriptor = { id: 'large-payload', rule };
