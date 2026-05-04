import type { Rule, RuleDescriptor } from '../types';

const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|woff2|webp|avif|ico|gif)(?:$|\?)/i;

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;

	let pathname: string;
	let host: string;
	try {
		const u = new URL(ev.url);
		pathname = u.pathname + u.search;
		host = u.host;
	} catch {
		return null;
	}

	if (!STATIC_EXT.test(pathname)) return null;

	const cc = (ev.responseHeaders['cache-control'] ?? '').toLowerCase();
	if (cc && !cc.includes('no-store')) return null;

	return {
		ruleId: 'cache-missing',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `estático ${new URL(ev.url).pathname} sem cache de longa duração`,
		evidence: { 'cache-control': cc || 'absent' },
		suggestion:
			'Estáticos versionados podem usar `Cache-Control: public, max-age=31536000, immutable`.',
	};
};

export const cacheMissingRule: RuleDescriptor = { id: 'cache-missing', rule };
