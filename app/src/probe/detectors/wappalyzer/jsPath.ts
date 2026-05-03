export const JS_PATH_MAX_DEPTH = 6;

export function readDottedPath(root: unknown, path: string): unknown {
	const parts = path.split('.');
	if (parts.length > JS_PATH_MAX_DEPTH) return undefined;
	let cur: unknown = root;
	for (const p of parts) {
		if (cur === null || cur === undefined) return undefined;
		if (typeof cur !== 'object' && typeof cur !== 'function') return undefined;
		try {
			cur = (cur as Record<string, unknown>)[p];
		} catch {
			// proxies ou getters podem throw — não fabricamos valor
			return undefined;
		}
	}
	return cur;
}

export function serializeJsValue(v: unknown): string {
	if (v === null) return 'null';
	if (v === undefined) return '';
	const t = typeof v;
	if (t === 'string') return v as string;
	if (t === 'number' || t === 'boolean') return String(v);
	if (t === 'function') return '<function>';
	try {
		const s = JSON.stringify(v);
		return s ? s.slice(0, 200) : '<object>';
	} catch {
		// circular ou TypeError em getters
		return '<object>';
	}
}
