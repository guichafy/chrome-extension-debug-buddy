import type { LibraryDetection } from '@/lib/session/types';

export function detectLibraries(): LibraryDetection[] {
	const out: LibraryDetection[] = [];
	const w = window as unknown as {
		jQuery?: unknown;
		$?: unknown;
	};

	const jq = w.jQuery;
	if (
		typeof jq === 'function' &&
		typeof (jq as unknown as { fn?: { jquery?: unknown } }).fn?.jquery === 'string'
	) {
		const version = (jq as unknown as { fn: { jquery: string } }).fn.jquery;
		out.push({ name: 'jquery', version, confidence: 'high' });
		return out;
	}

	const $ = w.$;
	if (
		typeof $ === 'function' &&
		typeof ($ as unknown as { fn?: { jquery?: unknown } }).fn?.jquery === 'string'
	) {
		const version = ($ as unknown as { fn: { jquery: string } }).fn.jquery;
		out.push({ name: 'jquery', version, confidence: 'high' });
	}

	return out;
}
