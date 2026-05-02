import type { DataFetchingDetection } from '@/lib/session/types';

export function detectDataFetching(): DataFetchingDetection[] {
	const out: DataFetchingDetection[] = [];

	const apollo = (window as unknown as { __APOLLO_CLIENT__?: { version?: string } })
		.__APOLLO_CLIENT__;
	if (apollo) {
		const entry: DataFetchingDetection = { name: 'apollo', treatment: 'detection-only' };
		if (apollo.version) entry.version = apollo.version;
		out.push(entry);
	}

	const tanstack = (window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown })
		.__TANSTACK_QUERY_CLIENT__;
	if (tanstack) {
		out.push({ name: 'tanstack-query', treatment: 'detection-only' });
	}

	// SWR, urql, Relay, RTK Query: signatures de comportamento (parsing de
	// stack em fetch, headers) ficam pra v1.x.

	return out;
}
