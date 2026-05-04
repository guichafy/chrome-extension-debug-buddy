import type { Rule, RuleDescriptor } from '../types';
import { safeParseUrl } from '../urlHelpers';

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const ct = (ev.responseHeaders['content-type'] ?? '').toLowerCase();
	if (ct !== 'image/png' && ct !== 'image/jpeg') return null;
	const length = Number(ev.responseHeaders['content-length']);
	if (!Number.isFinite(length) || length <= 524_288) return null;

	const accept = ev.requestHeaders.accept ?? ev.requestHeaders.Accept ?? '';

	const u = safeParseUrl(ev.url);
	if (!u) return null;

	return {
		ruleId: 'image-not-optimized',
		severity: 'info',
		requestId: ev.requestId,
		url: ev.url,
		host: u.host,
		summary: `imagem de ${(length / 1024).toFixed(0)} KB em formato não otimizado (${ct})`,
		evidence: {
			'content-type': ct,
			'content-length': String(length),
			accept: accept || 'absent',
		},
		suggestion: 'Sirva WebP/AVIF para clientes modernos — economia típica de 30-50%. Verifique `Accept` do cliente real antes de migrar.',
	};
};

export const imageNotOptimizedRule: RuleDescriptor = { id: 'image-not-optimized', rule };
