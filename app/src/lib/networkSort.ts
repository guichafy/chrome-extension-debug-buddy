// Comparator puro para ordenar `InterceptedResponse[]` por um Sort declarativo.
//
// Convenção de no-fallback: requests com o campo de sort indefinido vão SEMPRE
// para o final da lista, independente da direção (asc/desc). É o comportamento
// que o usuário espera: "ordenar por X" mostra os que têm X primeiro; quem não
// tem fica no rodapé. Não inventamos zero/string vazia para esses casos.

import type { Sort, SortField } from '@/types/filters';
import type { InterceptedResponse } from '@/types/intercepted';

function readField(req: InterceptedResponse, field: SortField): number | string | undefined {
	switch (field) {
		case 'timestamp':
			return req.timestamp;
		case 'duration':
			return req.duration;
		case 'transferSize':
			return req.networkTiming?.transferSize;
		case 'ttfbMs':
			return req.networkTiming?.ttfbMs;
		case 'status':
			return typeof req.status === 'number' ? req.status : undefined;
		case 'url':
			return req.url;
		case 'method':
			return req.method;
	}
}

export function compareRequests(
	sort: Sort,
): (a: InterceptedResponse, b: InterceptedResponse) => number {
	const dirMul = sort.dir === 'asc' ? 1 : -1;
	return (a, b) => {
		const va = readField(a, sort.field);
		const vb = readField(b, sort.field);
		// Indefinidos vão pro fim — independente de direção.
		if (va === undefined && vb === undefined) return 0;
		if (va === undefined) return 1;
		if (vb === undefined) return -1;
		if (typeof va === 'number' && typeof vb === 'number') {
			return (va - vb) * dirMul;
		}
		// Fallback string: nunca executado pra timestamp/duration/transferSize/ttfbMs/status,
		// mas cobre url/method.
		return String(va).localeCompare(String(vb)) * dirMul;
	};
}
