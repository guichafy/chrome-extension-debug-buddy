import type { HttpClientDetection } from '@/lib/session/types';

export function detectHttpClients(): HttpClientDetection[] {
	const out: HttpClientDetection[] = [
		{ name: 'fetch', confidence: 'high' },
		{ name: 'xhr', confidence: 'high' },
	];

	// Axios: heurística primária via global window.axios (apps que importam UMD).
	// Heurística secundária (parse de stack em fetch) requer hook em fetch que
	// chega na Phase 1b. Por enquanto, só global.
	if ((window as unknown as { axios?: unknown }).axios) {
		out.push({ name: 'axios', confidence: 'high' });
	}

	// Angular HttpClient: high quando window.ng (Angular DevTools API) existe;
	// medium se apenas <app-root> está presente (Angular sem devtools/prod build).
	const ng = (window as unknown as { ng?: { getComponent?: unknown } }).ng;
	const hasAppRoot = !!document.querySelector('app-root');
	if (ng?.getComponent || hasAppRoot) {
		out.push({
			name: 'angular-http',
			confidence: ng?.getComponent ? 'high' : 'medium',
		});
	}

	return out;
}
