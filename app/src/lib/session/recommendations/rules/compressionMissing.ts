import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const COMPRESSED = new Set(['gzip', 'br', 'deflate', 'zstd']);
const TEXT_PATTERNS = [
	/^text\//,
	/^application\/json/,
	/^application\/javascript/,
	/^application\/xml/,
	/\+json$/,
	/\+xml$/,
];

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const headers = ev.responseHeaders;
	const contentType = (headers['content-type'] ?? '').toLowerCase();
	if (!TEXT_PATTERNS.some((p) => p.test(contentType))) return null;

	const length = Number(headers['content-length']);
	if (!Number.isFinite(length) || length <= 1024) return null;

	const encoding = (headers['content-encoding'] ?? '').toLowerCase().trim();
	if (encoding && COMPRESSED.has(encoding.split(',')[0].trim())) return null;

	const u = safeParseUrl(ev.url);
	if (!u) return null;

	return {
		ruleId: 'compression-missing',
		severity: 'warn',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `compressão ausente em ${u.pathname} (${length} bytes)`,
		evidence: {
			'content-type': contentType,
			'content-length': String(length),
			'content-encoding': encoding || 'absent',
		},
		suggestion: 'Habilite gzip/brotli no servidor para responses textuais > 1 KB.',
	};
};

export const compressionMissingRule: RuleDescriptor = {
	id: 'compression-missing',
	rule,
};
