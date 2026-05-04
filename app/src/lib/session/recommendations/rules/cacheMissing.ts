import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|woff2|webp|avif|ico|gif)(?:$|\?)/i;

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;

	const u = safeParseUrl(ev.url);
	if (!u) return null;

	const pathname = u.pathname + u.search;
	if (!STATIC_EXT.test(pathname)) return null;

	const cc = (ev.responseHeaders['cache-control'] ?? '').toLowerCase();
	if (cc && !cc.includes('no-store')) return null;

	return {
		ruleId: 'cache-missing',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `estático ${u.pathname} sem cache de longa duração`,
		evidence: { 'cache-control': cc || 'absent' },
		suggestion:
			'Estáticos versionados podem usar `Cache-Control: public, max-age=31536000, immutable`.',
	};
};

export const cacheMissingRule: RuleDescriptor = { id: 'cache-missing', rule };
