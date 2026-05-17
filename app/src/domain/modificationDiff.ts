// Phase 7: diff entre snapshots de request/response. Usado pelo background pra
// popular `InterceptedResponse.requestModified`/`responseModified` e pela UI
// (ModificationsView) pra renderizar o lado-a-lado.

import type {
	RequestModificationSnapshot,
	ResponseModificationSnapshot,
} from '../types/intercepted';

export interface RequestStateSnapshot {
	url: string;
	method: string;
	headers: Record<string, string>;
	postData?: string;
}

export interface ResponseStateSnapshot {
	status: number;
	statusPhrase: string;
	headers: Record<string, string>;
	body?: string;
}

function headersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	for (const k of ka) {
		if (a[k] !== b[k]) return false;
	}
	return true;
}

// Compara request original × modificada. Retorna snapshot com APENAS os campos
// que diferem (e o `headers` é o estado pós-modify por inteiro quando diferente).
// undefined quando nada mudou.
export function diffRequestSnapshots(
	original: RequestStateSnapshot,
	modified: RequestStateSnapshot,
): RequestModificationSnapshot | undefined {
	const diff: RequestModificationSnapshot = {};
	let changed = false;

	if (original.url !== modified.url) {
		diff.url = modified.url;
		changed = true;
	}
	if (original.method !== modified.method) {
		diff.method = modified.method;
		changed = true;
	}
	if (!headersEqual(original.headers, modified.headers)) {
		diff.headers = { ...modified.headers };
		changed = true;
	}
	if (original.postData !== modified.postData) {
		// `''` distingue remoção explícita (original tinha body) de "nunca teve".
		// Os dois lados podem ser undefined → não cai aqui (igualdade).
		diff.postData = modified.postData ?? '';
		changed = true;
	}

	return changed ? diff : undefined;
}

export function diffResponseSnapshots(
	original: ResponseStateSnapshot,
	modified: ResponseStateSnapshot,
): ResponseModificationSnapshot | undefined {
	const diff: ResponseModificationSnapshot = {};
	let changed = false;

	if (original.status !== modified.status) {
		diff.status = modified.status;
		changed = true;
	}
	if (original.statusPhrase !== modified.statusPhrase) {
		diff.statusPhrase = modified.statusPhrase;
		changed = true;
	}
	if (!headersEqual(original.headers, modified.headers)) {
		diff.headers = { ...modified.headers };
		changed = true;
	}
	if (original.body !== modified.body) {
		diff.body = modified.body ?? '';
		changed = true;
	}

	return changed ? diff : undefined;
}

// Diff por header — UI consome para renderizar add/change/remove/unchanged.
// Case-insensitive: chaves normalizadas em lowercase pra comparação, mas o
// nome de exibição vem da forma encontrada no estado MODIFICADO (ou no
// original, quando removido).
export type HeaderDiff =
	| { name: string; kind: 'added'; value: string }
	| { name: string; kind: 'removed'; previousValue: string }
	| { name: string; kind: 'changed'; value: string; previousValue: string }
	| { name: string; kind: 'unchanged'; value: string };

function indexHeadersLower(
	headers: Record<string, string>,
): Map<string, { name: string; value: string }> {
	const map = new Map<string, { name: string; value: string }>();
	for (const [name, value] of Object.entries(headers)) {
		map.set(name.toLowerCase(), { name, value });
	}
	return map;
}

export function diffHeaderRecord(
	before: Record<string, string>,
	after: Record<string, string>,
): HeaderDiff[] {
	const beforeMap = indexHeadersLower(before);
	const afterMap = indexHeadersLower(after);
	const allKeys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
	const result: HeaderDiff[] = [];

	for (const key of allKeys) {
		const b = beforeMap.get(key);
		const a = afterMap.get(key);
		if (b && a) {
			if (b.value === a.value) {
				result.push({ name: a.name, kind: 'unchanged', value: a.value });
			} else {
				result.push({
					name: a.name,
					kind: 'changed',
					value: a.value,
					previousValue: b.value,
				});
			}
		} else if (a) {
			result.push({ name: a.name, kind: 'added', value: a.value });
		} else if (b) {
			result.push({ name: b.name, kind: 'removed', previousValue: b.value });
		}
	}

	result.sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
	return result;
}
