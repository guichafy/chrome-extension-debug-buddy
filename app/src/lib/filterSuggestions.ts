import type { AppliedType, InterceptedResponse } from '@/types/intercepted';
import type { Filter, FilterField, FilterOperator, RequestState } from '@/types/filters';

// Sugestão exibida no Combobox da FilterBar. `display` é o texto visível, `hint`
// é a categoria/explicação e `apply` retorna o filtro pronto para anexar.
export interface FilterSuggestion {
	id: string;
	display: string;
	hint: string;
	apply: Omit<Filter, 'id'>;
}

const FIELD_PREFIXES: Array<{ prefix: string; field: FilterField; hint: string }> = [
	{ prefix: 'method:', field: 'method', hint: 'Método HTTP' },
	{ prefix: 'status:', field: 'status', hint: 'Status code' },
	{ prefix: 'url:', field: 'url', hint: 'URL contém' },
	{ prefix: 'type:', field: 'type', hint: 'Resource type' },
	{ prefix: 'mime:', field: 'mime', hint: 'Content-Type' },
	{ prefix: 'state:', field: 'state', hint: 'Estado' },
	{ prefix: 'tipo:', field: 'tipo', hint: 'Tipo de regra aplicada' },
];

const STATE_VALUES: Array<{ value: RequestState; label: string }> = [
	{ value: 'pending', label: 'Aguardando' },
	{ value: 'failed', label: 'Falha' },
	{ value: 'modified', label: 'Modificado' },
	{ value: 'ok', label: 'OK' },
];

const TIPO_VALUES: Array<{ value: AppliedType; label: string }> = [
	{ value: 'proxy', label: 'Proxy' },
	{ value: 'mock', label: 'Mock' },
	{ value: 'transform', label: 'Transform' },
	{ value: 'breakpoint', label: 'Breakpoint' },
	{ value: 'latency', label: 'Latência' },
];

const COMMON_STATUS_GROUPS = ['2xx', '3xx', '4xx', '5xx'];
const FALLBACK_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

interface RequestFacets {
	methods: string[];
	types: string[];
	mimes: string[];
	statuses: string[];
}

// Single-pass extraction dos valores únicos por campo. Evita 4 iterações
// separadas em buildFieldValueSuggestions quando o usuário digita um prefixo.
function collectFacets(requests: InterceptedResponse[]): RequestFacets {
	const methods = new Set<string>();
	const types = new Set<string>();
	const mimes = new Set<string>();
	const statuses = new Set<string>();
	for (const r of requests) {
		if (r.method) methods.add(r.method);
		if (r.type) types.add(r.type);
		if (r.mimeType) mimes.add(r.mimeType);
		if (typeof r.status === 'number' && r.status > 0) statuses.add(String(r.status));
	}
	return {
		methods: Array.from(methods).sort(),
		types: Array.from(types).sort(),
		mimes: Array.from(mimes).sort(),
		statuses: Array.from(statuses).sort((a, b) => Number(a) - Number(b)),
	};
}

function buildFieldValueSuggestions(
	field: FilterField,
	rawValue: string,
	facets: RequestFacets,
): FilterSuggestion[] {
	const value = rawValue.trim();
	const lowerValue = value.toLowerCase();

	const buildSuggestion = (
		v: string,
		operator: FilterOperator,
		hint: string,
		display?: string,
	): FilterSuggestion => ({
		id: `${field}:${operator}:${v}`,
		display: display ?? `${field}:${v}`,
		hint,
		apply: { field, operator, value: v },
	});

	switch (field) {
		case 'method': {
			const candidates = facets.methods.length > 0 ? facets.methods : FALLBACK_METHODS;
			return candidates
				.filter((m) => m.toLowerCase().includes(lowerValue))
				.map((m) => buildSuggestion(m, 'is', 'Método HTTP'));
		}
		case 'type':
			return facets.types
				.filter((t) => t.toLowerCase().includes(lowerValue))
				.map((t) => buildSuggestion(t, 'is', 'Request type'));
		case 'mime':
			return facets.mimes
				.filter((m) => m.toLowerCase().includes(lowerValue))
				.map((m) => buildSuggestion(m, 'is', 'Content-Type'));
		case 'state':
			return STATE_VALUES.filter(
				(s) => s.value.includes(lowerValue) || s.label.toLowerCase().includes(lowerValue),
			).map((s) => buildSuggestion(s.value, 'is', `Estado: ${s.label}`));
		case 'tipo':
			return TIPO_VALUES.filter(
				(t) => t.value.includes(lowerValue) || t.label.toLowerCase().includes(lowerValue),
			).map((t) => buildSuggestion(t.value, 'is', `Tipo: ${t.label}`));
		case 'status': {
			const groups = COMMON_STATUS_GROUPS.map((g) => buildSuggestion(g, 'is', `Faixa ${g}`));
			const exact = facets.statuses
				.filter((s) => s.includes(lowerValue))
				.map((s) => buildSuggestion(s, 'is', 'Status code'));
			const compound: FilterSuggestion[] = [];
			if (/^\d+$/.test(value)) {
				compound.push(buildSuggestion(value, 'gte', `Status ≥ ${value}`, `status:≥${value}`));
				compound.push(buildSuggestion(value, 'lte', `Status ≤ ${value}`, `status:≤${value}`));
			}
			return [...groups, ...exact, ...compound];
		}
		case 'url':
			if (value.length === 0) return [];
			return [buildSuggestion(value, 'contains', 'URL contém', `url:${value}`)];
		case 'duration':
			return [];
		case 'timestamp':
			return [];
		case 'free':
			return [];
	}
}

// Gera as sugestões a partir do texto digitado. `requests` só é iterado quando
// o input casa um prefixo de campo (cases 1) — para input vazio ou texto livre
// nada é lido, evitando custo em sessões com 1000+ requisições.
export function buildSuggestions(
	rawInput: string,
	requests: InterceptedResponse[],
): FilterSuggestion[] {
	const input = rawInput.trim();

	for (const { prefix, field } of FIELD_PREFIXES) {
		if (input.toLowerCase().startsWith(prefix)) {
			const remainder = input.slice(prefix.length);
			const facets = collectFacets(requests);
			return buildFieldValueSuggestions(field, remainder, facets);
		}
	}

	const isExactOperatorField = (field: FilterField): boolean =>
		field === 'state' || field === 'tipo';

	if (input.length === 0) {
		const fieldShortcuts: FilterSuggestion[] = FIELD_PREFIXES.map(({ prefix, field, hint }) => ({
			id: `prefix:${field}`,
			display: prefix,
			hint,
			apply: { field, operator: isExactOperatorField(field) ? 'is' : 'contains', value: '' },
		}));
		const pendingShortcut: FilterSuggestion = {
			id: 'shortcut:state:pending',
			display: 'Apenas pendentes',
			hint: 'state:pending',
			apply: { field: 'state', operator: 'is', value: 'pending' },
		};
		return [pendingShortcut, ...fieldShortcuts];
	}

	const lower = input.toLowerCase();
	const prefixMatches: FilterSuggestion[] = FIELD_PREFIXES.filter(({ prefix }) =>
		prefix.startsWith(lower),
	).map(({ prefix, field, hint }) => ({
		id: `prefix:${field}:partial`,
		display: prefix,
		hint,
		apply: { field, operator: isExactOperatorField(field) ? 'is' : 'contains', value: '' },
	}));

	const freeSuggestion: FilterSuggestion = {
		id: 'free:contains',
		display: `Buscar livre por «${input}»`,
		hint: 'Procura em todos os campos',
		apply: { field: 'free', operator: 'contains', value: input },
	};

	return [freeSuggestion, ...prefixMatches];
}
