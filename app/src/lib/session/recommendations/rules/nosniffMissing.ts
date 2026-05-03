import type { Rule, RuleDescriptor } from '../types';

const rule: Rule = (ev) => {
	if (ev.status !== 200) return null;
	const v = (ev.responseHeaders['x-content-type-options'] ?? '').toLowerCase().trim();
	if (v === 'nosniff') return null;

	let host: string;
	try {
		host = new URL(ev.url).host;
	} catch {
		return null;
	}

	return {
		ruleId: 'nosniff-missing',
		severity: 'warn',
		requestId: ev.requestId,
		url: ev.url,
		host,
		summary: `response sem X-Content-Type-Options: ${host}`,
		evidence: { 'x-content-type-options': v || 'absent' },
		suggestion: 'Adicione `X-Content-Type-Options: nosniff` para impedir MIME sniffing.',
	};
};

export const nosniffMissingRule: RuleDescriptor = { id: 'nosniff-missing', rule };
