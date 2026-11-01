import type { AppliedType, InterceptedResponse } from '@/types/intercepted';
import { i18n } from '@/i18n/instance';
import {
	APPLIED_TYPE_LABELS,
	type Filter,
	type FilterField,
	type FilterOperator,
	REQUEST_STATE_LABELS,
	type RequestState,
} from '@/types/filters';

// Sugestão exibida no Combobox da FilterBar. `display` é o texto visível, `hint`
// é a categoria/explicação e `apply` retorna o filtro pronto para anexar.
export interface FilterSuggestion {
	id: string;
	display: string;
	hint: string;
	apply: Omit<Filter, 'id'>;
}

type PrefixField = 'method' | 'status' | 'url' | 'type' | 'mime' | 'state' | 'tipo';

// Hint de cada prefixo: commandCenter:suggestions.prefixHints.<campo>.
const FIELD_PREFIXES: Array<{ prefix: string; field: PrefixField }> = [
	{ prefix: 'method:', field: 'method' },
	{ prefix: 'status:', field: 'status' },
	{ prefix: 'url:', field: 'url' },
	{ prefix: 'type:', field: 'type' },
	{ prefix: 'mime:', field: 'mime' },
	{ prefix: 'state:', field: 'state' },
	{ prefix: 'tipo:', field: 'tipo' },
];

// Rótulos vêm de REQUEST_STATE_LABELS / APPLIED_TYPE_LABELS (idioma ativo),
// e a busca casa tanto o valor cru quanto o rótulo traduzido.
const STATE_VALUES: RequestState[] = ['pending', 'failed', 'modified', 'ok'];

const TIPO_VALUES: AppliedType[] = ['proxy', 'mock', 'transform', 'breakpoint', 'latency'];

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
				.map((m) => buildSuggestion(m, 'is', i18n.t('commandCenter:suggestions.methodHint')));
		}
		case 'type':
			return facets.types
				.filter((t) => t.toLowerCase().includes(lowerValue))
				.map((t) => buildSuggestion(t, 'is', i18n.t('commandCenter:suggestions.typeHint')));
		case 'mime':
			return facets.mimes
				.filter((m) => m.toLowerCase().includes(lowerValue))
				.map((m) => buildSuggestion(m, 'is', i18n.t('commandCenter:suggestions.mimeHint')));
		case 'state':
			return STATE_VALUES.filter(
				(s) =>
					s.includes(lowerValue) || REQUEST_STATE_LABELS[s].toLowerCase().includes(lowerValue),
			).map((s) =>
				buildSuggestion(
					s,
					'is',
					i18n.t('commandCenter:suggestions.stateHint', { label: REQUEST_STATE_LABELS[s] }),
				),
			);
		case 'tipo':
			return TIPO_VALUES.filter(
				(t) => t.includes(lowerValue) || APPLIED_TYPE_LABELS[t].toLowerCase().includes(lowerValue),
			).map((t) =>
				buildSuggestion(
					t,
					'is',
					i18n.t('commandCenter:suggestions.tipoHint', { label: APPLIED_TYPE_LABELS[t] }),
				),
			);
		case 'status': {
			const groups = COMMON_STATUS_GROUPS.map((g) =>
				buildSuggestion(g, 'is', i18n.t('commandCenter:suggestions.statusGroupHint', { group: g })),
			);
			const exact = facets.statuses
				.filter((s) => s.includes(lowerValue))
				.map((s) => buildSuggestion(s, 'is', i18n.t('commandCenter:suggestions.statusHint')));
			const compound: FilterSuggestion[] = [];
			if (/^\d+$/.test(value)) {
				compound.push(
					buildSuggestion(
						value,
						'gte',
						i18n.t('commandCenter:suggestions.statusGteHint', { value }),
						`status:≥${value}`,
					),
				);
				compound.push(
					buildSuggestion(
						value,
						'lte',
						i18n.t('commandCenter:suggestions.statusLteHint', { value }),
						`status:≤${value}`,
					),
				);
			}
			return [...groups, ...exact, ...compound];
		}
		case 'url':
			if (value.length === 0) return [];
			return [
				buildSuggestion(
					value,
					'contains',
					i18n.t('commandCenter:suggestions.urlHint'),
					`url:${value}`,
				),
			];
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
		const fieldShortcuts: FilterSuggestion[] = FIELD_PREFIXES.map(({ prefix, field }) => ({
			id: `prefix:${field}`,
			display: prefix,
			hint: i18n.t(`commandCenter:suggestions.prefixHints.${field}`),
			apply: { field, operator: isExactOperatorField(field) ? 'is' : 'contains', value: '' },
		}));
		const pendingShortcut: FilterSuggestion = {
			id: 'shortcut:state:pending',
			display: i18n.t('commandCenter:suggestions.pendingOnly'),
			hint: 'state:pending',
			apply: { field: 'state', operator: 'is', value: 'pending' },
		};
		return [pendingShortcut, ...fieldShortcuts];
	}

	const lower = input.toLowerCase();
	const prefixMatches: FilterSuggestion[] = FIELD_PREFIXES.filter(({ prefix }) =>
		prefix.startsWith(lower),
	).map(({ prefix, field }) => ({
		id: `prefix:${field}:partial`,
		display: prefix,
		hint: i18n.t(`commandCenter:suggestions.prefixHints.${field}`),
		apply: { field, operator: isExactOperatorField(field) ? 'is' : 'contains', value: '' },
	}));

	const freeSuggestion: FilterSuggestion = {
		id: 'free:contains',
		display: i18n.t('commandCenter:suggestions.freeSearch', { input }),
		hint: i18n.t('commandCenter:suggestions.freeSearchHint'),
		apply: { field: 'free', operator: 'contains', value: input },
	};

	return [freeSuggestion, ...prefixMatches];
}
