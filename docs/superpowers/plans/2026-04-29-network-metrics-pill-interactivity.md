# Pill Interactivity no NetworkMetricsBar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada pill do `NetworkMetricsBar` ganha hover popover com detalhes específicos por métrica e click que navega ao `/command-center` com filtros que reproduzem exatamente o que a pill descreve (incluindo a janela ativa Sessão/Página como filtro de tempo).

**Architecture:** Camada pura nova `networkPillsDetail.ts` (5 funções de agregação por papel). Camada de URL nova `filterUrlSerialization.ts` (encode/decode `Filter[]` ↔ `URLSearchParams`). Sistema de filtros existente ganha campos `duration` e `timestamp`. `NetworkMetricsBar` refatora `<Pill>` para aceitar `detail` (popover) e `onClick`. `CommandCenter` hidrata filtros via `useSearchParams` na montagem.

**Tech Stack:** TypeScript estrito · React 19 · React Router (`useNavigate`/`useSearchParams`) · shadcn `Tooltip` · Tailwind v4 · Vitest (jsdom) · biome.

**Convenções do projeto a respeitar (CLAUDE.md):**
- Todos os comandos `npm` rodam de `app/`. Use `cd app && <cmd>`.
- Indentação: **tabs (size 2)**.
- Strings de UI, comentários e logs em **pt-BR**.
- TS strict ligado.
- **No-fallback rule**: campo sem dado → omitido/`null`, nunca `0`/`-1` fictícios. UI mostra "—" para `null`.
- Arquivos de teste em `__tests__/` co-localizados.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `refactor:`.
- Husky `pre-commit` (biome) + `commit-msg` (commitlint).
- Path alias `@` → `app/src/`.

**Spec base:** [docs/superpowers/specs/2026-04-29-network-metrics-pill-interactivity-design.md](../specs/2026-04-29-network-metrics-pill-interactivity-design.md)

---

## File Structure

**Novos arquivos:**
- `app/src/lib/networkPillsDetail.ts` — funções puras `detailTotal/detailBytes/detailTtfb/detailSlow/detailFailed`.
- `app/src/lib/__tests__/networkPillsDetail.test.ts`
- `app/src/lib/filterUrlSerialization.ts` — `encodeFiltersToParams` / `decodeParamsToFilters`.
- `app/src/lib/__tests__/filterUrlSerialization.test.ts`

**Arquivos modificados:**
- `app/src/types/filters.ts` — adicionar `'duration'` e `'timestamp'` a `FilterField` + labels pt-BR.
- `app/src/lib/filterMatching.ts` — handler para `duration` e `timestamp` em `matchesFilter`.
- `app/src/lib/__tests__/filterMatching.test.ts` — testes para os novos campos.
- `app/src/hooks/useNetworkMetrics.ts` — retornar `sessionDetails` e `currentPageDetails`.
- `app/src/hooks/__tests__/useNetworkMetrics.test.tsx` — cobrir `details`.
- `app/src/components/layout/NetworkMetricsBar.tsx` — `<Pill>` aceita `detail`/`onClick`/`disabled`; 5 detail components; click handler.
- `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx` — click navega; pill binária com 0 disabled; popover renderiza.
- `app/src/components/layout/SiteHeader.tsx` — `sessionMarker` na prop (em vez de só `hasCurrentPage`).
- `app/src/components/__tests__/SiteHeader.test.tsx` — atualizar mockProps.
- `app/src/pages/Layout.tsx` — passar `sessionMarker` ao `SiteHeader`.
- `app/src/pages/CommandCenter.tsx` — hidratar filtros de `useSearchParams` na montagem.
- `app/src/pages/__tests__/CommandCenter.test.tsx` (criar se não existir) — hidratação de URL.

---

## Task 1: Estender `FilterField` com `duration` e `timestamp`

**Files:**
- Modify: `app/src/types/filters.ts`

- [ ] **Step 1: Adicionar `duration` e `timestamp` à união `FilterField`**

Em `app/src/types/filters.ts`, troque:

```ts
export type FilterField = 'free' | 'url' | 'method' | 'status' | 'type' | 'mime' | 'state';
```

por:

```ts
export type FilterField =
	| 'free'
	| 'url'
	| 'method'
	| 'status'
	| 'type'
	| 'mime'
	| 'state'
	| 'duration'
	| 'timestamp';
```

E atualize `FILTER_FIELD_LABELS` adicionando duas entradas:

```ts
export const FILTER_FIELD_LABELS: Record<FilterField, string> = {
	free: 'Texto livre',
	url: 'URL',
	method: 'Método',
	status: 'Status',
	type: 'Tipo',
	mime: 'MIME',
	state: 'Estado',
	duration: 'Duração (ms)',
	timestamp: 'Janela de tempo',
};
```

- [ ] **Step 2: Verificar compilação**

Run: `cd app && npx tsc --noEmit`
Expected: erro em `app/src/lib/filterMatching.ts:matchesFilter` (switch não-exaustivo). Esse erro será resolvido na Task 2 — confirmar que é o único erro novo.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/filters.ts
git commit -m "feat(filters): adiciona campos duration e timestamp ao FilterField"
```

---

## Task 2: `filterMatching` para `duration` e `timestamp` (TDD)

**Files:**
- Modify: `app/src/lib/filterMatching.ts`
- Modify: `app/src/lib/__tests__/filterMatching.test.ts`

- [ ] **Step 1: Escrever testes falhando**

Encontre `app/src/lib/__tests__/filterMatching.test.ts`. Adicione no final do arquivo (antes do `});` que fecha o último describe se houver, ou simplesmente no fim) o seguinte bloco:

```ts
describe('matchesFilter — duration', () => {
	function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
		return {
			url: 'https://example.com/',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'XHR',
			timestamp: 1000,
			...overrides,
		};
	}

	it('gte casa quando duration ≥ valor', () => {
		expect(
			matchesFilter(req({ duration: 1500 }), {
				id: 'f',
				field: 'duration',
				operator: 'gte',
				value: '1000',
			}),
		).toBe(true);
		expect(
			matchesFilter(req({ duration: 999 }), {
				id: 'f',
				field: 'duration',
				operator: 'gte',
				value: '1000',
			}),
		).toBe(false);
	});

	it('lte casa quando duration ≤ valor', () => {
		expect(
			matchesFilter(req({ duration: 500 }), {
				id: 'f',
				field: 'duration',
				operator: 'lte',
				value: '1000',
			}),
		).toBe(true);
	});

	it('is casa equality exato', () => {
		expect(
			matchesFilter(req({ duration: 1000 }), {
				id: 'f',
				field: 'duration',
				operator: 'is',
				value: '1000',
			}),
		).toBe(true);
		expect(
			matchesFilter(req({ duration: 1001 }), {
				id: 'f',
				field: 'duration',
				operator: 'is',
				value: '1000',
			}),
		).toBe(false);
	});

	it('request sem duration definida nunca casa em duration', () => {
		expect(
			matchesFilter(req(), {
				id: 'f',
				field: 'duration',
				operator: 'gte',
				value: '0',
			}),
		).toBe(false);
		expect(
			matchesFilter(req(), {
				id: 'f',
				field: 'duration',
				operator: 'lte',
				value: '99999',
			}),
		).toBe(false);
	});

	it('valor não-numérico não casa', () => {
		expect(
			matchesFilter(req({ duration: 1000 }), {
				id: 'f',
				field: 'duration',
				operator: 'gte',
				value: 'abc',
			}),
		).toBe(false);
	});
});

describe('matchesFilter — timestamp', () => {
	function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
		return {
			url: 'https://example.com/',
			status: 200,
			statusText: 'OK',
			headers: {},
			type: 'XHR',
			timestamp: 1714425600000,
			...overrides,
		};
	}

	it('gte casa quando timestamp ≥ valor', () => {
		expect(
			matchesFilter(req(), {
				id: 'f',
				field: 'timestamp',
				operator: 'gte',
				value: '1714425500000',
			}),
		).toBe(true);
		expect(
			matchesFilter(req(), {
				id: 'f',
				field: 'timestamp',
				operator: 'gte',
				value: '1714425700000',
			}),
		).toBe(false);
	});

	it('lte casa quando timestamp ≤ valor', () => {
		expect(
			matchesFilter(req(), {
				id: 'f',
				field: 'timestamp',
				operator: 'lte',
				value: '1714425700000',
			}),
		).toBe(true);
	});
});
```

Verifique que o `import` no topo do arquivo já tem `matchesFilter` e `InterceptedResponse` — se não, adicione:

```ts
import { matchesFilter } from '../filterMatching';
import type { InterceptedResponse } from '@/types/intercepted';
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/lib/__tests__/filterMatching.test.ts`
Expected: novos testes falham (matchesFilter retorna `undefined` para `duration`/`timestamp` cases — o switch não trata).

- [ ] **Step 3: Implementar handlers em `filterMatching.ts`**

Em `app/src/lib/filterMatching.ts`, dentro de `matchesFilter`, no switch sobre `filter.field`, **antes** do `}` final do switch, adicione duas novas branches:

```ts
		case 'duration': {
			if (typeof request.duration !== 'number') return false;
			const trimmed = filter.value.trim();
			if (trimmed === '') return true;
			const numericValue = Number(trimmed);
			if (Number.isNaN(numericValue)) return false;
			switch (filter.operator) {
				case 'is':
					return request.duration === numericValue;
				case 'gte':
					return request.duration >= numericValue;
				case 'lte':
					return request.duration <= numericValue;
				default:
					return false;
			}
		}
		case 'timestamp': {
			const trimmed = filter.value.trim();
			if (trimmed === '') return true;
			const numericValue = Number(trimmed);
			if (Number.isNaN(numericValue)) return false;
			switch (filter.operator) {
				case 'gte':
					return request.timestamp >= numericValue;
				case 'lte':
					return request.timestamp <= numericValue;
				default:
					return false;
			}
		}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/lib/__tests__/filterMatching.test.ts`
Expected: todos os testes passam.

Run também: `cd app && npx tsc --noEmit`
Expected: zero erros (switch agora exaustivo).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/filterMatching.ts app/src/lib/__tests__/filterMatching.test.ts
git commit -m "feat(filters): handler para duration e timestamp em matchesFilter"
```

---

## Task 3: `filterUrlSerialization` (TDD)

**Files:**
- Create: `app/src/lib/filterUrlSerialization.ts`
- Create: `app/src/lib/__tests__/filterUrlSerialization.test.ts`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/lib/__tests__/filterUrlSerialization.test.ts`:

```ts
import type { Filter } from '@/types/filters';
import {
	decodeParamsToFilters,
	encodeFiltersToParams,
} from '../filterUrlSerialization';

describe('encodeFiltersToParams', () => {
	it('codifica lista vazia para URLSearchParams vazio', () => {
		const params = encodeFiltersToParams([]);
		expect(params.toString()).toBe('');
	});

	it('codifica um filtro como entry f=field:op:value', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'duration', operator: 'gte', value: '1000' },
		];
		const params = encodeFiltersToParams(filters);
		expect(params.getAll('f')).toEqual(['duration:gte:1000']);
	});

	it('codifica múltiplos filtros como entries repetidas', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'timestamp', operator: 'gte', value: '1714425600000' },
			{ id: 'b', field: 'duration', operator: 'gte', value: '1000' },
		];
		const params = encodeFiltersToParams(filters);
		expect(params.getAll('f')).toEqual([
			'timestamp:gte:1714425600000',
			'duration:gte:1000',
		]);
	});

	it('URL-encoda valores com caracteres especiais', () => {
		const filters: Filter[] = [
			{ id: 'a', field: 'url', operator: 'contains', value: 'a:b/c' },
		];
		const params = encodeFiltersToParams(filters);
		expect(params.getAll('f')).toEqual(['url:contains:a%3Ab%2Fc']);
	});
});

describe('decodeParamsToFilters', () => {
	it('decodifica params vazio para lista vazia', () => {
		expect(decodeParamsToFilters(new URLSearchParams())).toEqual([]);
	});

	it('decodifica entry f=field:op:value para Filter', () => {
		const params = new URLSearchParams('f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]).toMatchObject({
			field: 'duration',
			operator: 'gte',
			value: '1000',
		});
		expect(typeof filters[0]?.id).toBe('string');
		expect(filters[0]?.id.length).toBeGreaterThan(0);
	});

	it('decodifica múltiplas entries preservando ordem', () => {
		const params = new URLSearchParams('f=timestamp:gte:1000&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters.map((f) => f.field)).toEqual(['timestamp', 'duration']);
	});

	it('URL-decoda valores', () => {
		const params = new URLSearchParams('f=url:contains:a%3Ab%2Fc');
		const filters = decodeParamsToFilters(params);
		expect(filters[0]?.value).toBe('a:b/c');
	});

	it('ignora entries malformadas (sem dois `:`)', () => {
		const params = new URLSearchParams('f=invalid&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]?.field).toBe('duration');
	});

	it('ignora entries com field desconhecido', () => {
		const params = new URLSearchParams('f=foo:gte:1000&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]?.field).toBe('duration');
	});

	it('ignora entries com operator desconhecido', () => {
		const params = new URLSearchParams('f=duration:bogus:1000&f=duration:gte:1000');
		const filters = decodeParamsToFilters(params);
		expect(filters).toHaveLength(1);
		expect(filters[0]?.operator).toBe('gte');
	});

	it('round-trip preserva field/operator/value', () => {
		const original: Filter[] = [
			{ id: 'a', field: 'timestamp', operator: 'gte', value: '1714425600000' },
			{ id: 'b', field: 'url', operator: 'contains', value: 'with space:' },
		];
		const decoded = decodeParamsToFilters(encodeFiltersToParams(original));
		expect(decoded).toHaveLength(2);
		expect(decoded[0]).toMatchObject({
			field: 'timestamp',
			operator: 'gte',
			value: '1714425600000',
		});
		expect(decoded[1]).toMatchObject({
			field: 'url',
			operator: 'contains',
			value: 'with space:',
		});
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/lib/__tests__/filterUrlSerialization.test.ts`
Expected: erro "Cannot find module '../filterUrlSerialization'".

- [ ] **Step 3: Implementar `app/src/lib/filterUrlSerialization.ts`**

```ts
// Codifica/decodifica Filter[] como entries `f=<field>:<op>:<value>` em URLSearchParams.
// Decoder é tolerante: entries malformadas (sem dois `:`, field/op desconhecidos)
// são silenciosamente descartadas. URL é entrada não-confiável; o conjunto efetivo
// é o que sobrevive ao parse.
//
// IDs são gerados via crypto.randomUUID() no decoder — IDs só importam para
// remoção no front, e cada decode é uma nova vida.

import type { Filter, FilterField, FilterOperator } from '@/types/filters';

const VALID_FIELDS: ReadonlySet<FilterField> = new Set([
	'free',
	'url',
	'method',
	'status',
	'type',
	'mime',
	'state',
	'duration',
	'timestamp',
]);

const VALID_OPERATORS: ReadonlySet<FilterOperator> = new Set([
	'is',
	'contains',
	'gte',
	'lte',
	'startsWith',
]);

export function encodeFiltersToParams(filters: Filter[]): URLSearchParams {
	const params = new URLSearchParams();
	for (const filter of filters) {
		const encodedValue = encodeURIComponent(filter.value);
		params.append('f', `${filter.field}:${filter.operator}:${encodedValue}`);
	}
	return params;
}

export function decodeParamsToFilters(params: URLSearchParams): Filter[] {
	const out: Filter[] = [];
	for (const raw of params.getAll('f')) {
		// Split em no máximo 3 partes: o value pode conter `:` literais (já encodados como %3A).
		const firstColon = raw.indexOf(':');
		if (firstColon < 0) continue;
		const secondColon = raw.indexOf(':', firstColon + 1);
		if (secondColon < 0) continue;

		const field = raw.slice(0, firstColon);
		const operator = raw.slice(firstColon + 1, secondColon);
		const encodedValue = raw.slice(secondColon + 1);

		if (!VALID_FIELDS.has(field as FilterField)) continue;
		if (!VALID_OPERATORS.has(operator as FilterOperator)) continue;

		let value: string;
		try {
			value = decodeURIComponent(encodedValue);
		} catch {
			continue; // valor mal-encodado, descarta
		}

		out.push({
			id: crypto.randomUUID(),
			field: field as FilterField,
			operator: operator as FilterOperator,
			value,
		});
	}
	return out;
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/lib/__tests__/filterUrlSerialization.test.ts`
Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/filterUrlSerialization.ts app/src/lib/__tests__/filterUrlSerialization.test.ts
git commit -m "feat(filters): serialização Filter[] ↔ URLSearchParams"
```

---

## Task 4: `networkPillsDetail` — 5 funções de agregação (TDD)

**Files:**
- Create: `app/src/lib/networkPillsDetail.ts`
- Create: `app/src/lib/__tests__/networkPillsDetail.test.ts`

- [ ] **Step 1: Escrever os testes falhando**

Crie `app/src/lib/__tests__/networkPillsDetail.test.ts`:

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import {
	detailBytes,
	detailFailed,
	detailSlow,
	detailTotal,
	detailTtfb,
} from '../networkPillsDetail';

function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1000,
		...overrides,
	};
}

describe('detailTotal', () => {
	it('vazio retorna estruturas zeradas', () => {
		expect(detailTotal([])).toEqual({
			byMethod: [],
			byStatusRange: { '2xx': 0, '3xx': 0, '4xx5xx': 0 },
		});
	});

	it('agrupa por método e ordena desc', () => {
		const r = [
			req({ method: 'GET' }),
			req({ method: 'GET' }),
			req({ method: 'GET' }),
			req({ method: 'POST' }),
			req({ method: 'POST' }),
			req({ method: 'OPTIONS' }),
		];
		expect(detailTotal(r).byMethod).toEqual([
			['GET', 3],
			['POST', 2],
			['OPTIONS', 1],
		]);
	});

	it('colapsa métodos além do top 3 em "outros"', () => {
		const r = [
			req({ method: 'GET' }),
			req({ method: 'GET' }),
			req({ method: 'POST' }),
			req({ method: 'OPTIONS' }),
			req({ method: 'PUT' }),
			req({ method: 'DELETE' }),
		];
		// top 3: GET=2, POST=1, OPTIONS=1; outros: PUT+DELETE=2
		const result = detailTotal(r).byMethod;
		expect(result).toHaveLength(4);
		expect(result[0]).toEqual(['GET', 2]);
		expect(result[3]).toEqual(['outros', 2]);
	});

	it('classifica status em 2xx/3xx/4xx5xx', () => {
		const r = [
			req({ status: 200 }),
			req({ status: 204 }),
			req({ status: 301 }),
			req({ status: 404 }),
			req({ status: 500 }),
		];
		expect(detailTotal(r).byStatusRange).toEqual({ '2xx': 2, '3xx': 1, '4xx5xx': 2 });
	});

	it('ignora método ausente (não conta)', () => {
		const r = [req({ method: undefined }), req({ method: 'GET' })];
		expect(detailTotal(r).byMethod).toEqual([['GET', 1]]);
	});
});

describe('detailBytes', () => {
	it('vazio retorna lista vazia', () => {
		expect(detailBytes([])).toEqual({ top: [] });
	});

	it('top 3 por transferSize desc, ignora requests sem transferSize', () => {
		const r = [
			req({ url: 'https://a/', networkTiming: { transferSize: 500 } }),
			req({ url: 'https://b/', networkTiming: { transferSize: 1500 } }),
			req({ url: 'https://c/', networkTiming: { transferSize: 800 } }),
			req({ url: 'https://d/', networkTiming: { transferSize: 100 } }),
			req({ url: 'https://e/' }), // sem transferSize → ignorada
		];
		expect(detailBytes(r).top).toEqual([
			{ url: 'https://b/', transferSize: 1500 },
			{ url: 'https://c/', transferSize: 800 },
			{ url: 'https://a/', transferSize: 500 },
		]);
	});
});

describe('detailTtfb', () => {
	it('retorna null quando ninguém tem ttfbMs', () => {
		expect(detailTtfb([req(), req()])).toBeNull();
	});

	it('calcula p50/p95/max em conjunto pequeno', () => {
		const r = [
			req({ networkTiming: { ttfbMs: 100 } }),
			req({ networkTiming: { ttfbMs: 200 } }),
			req({ networkTiming: { ttfbMs: 300 } }),
		];
		const result = detailTtfb(r);
		expect(result).toEqual({ p50: 200, p95: 300, max: 300 });
	});

	it('p95 escolhe percentile correto em conjunto grande', () => {
		// 100 valores: 1..100. p95 é o índice ceil(0.95 * 100) - 1 = 94 → valor 95.
		const r = Array.from({ length: 100 }, (_, i) =>
			req({ networkTiming: { ttfbMs: i + 1 } }),
		);
		const result = detailTtfb(r);
		expect(result?.p50).toBe(50);
		expect(result?.p95).toBe(95);
		expect(result?.max).toBe(100);
	});

	it('ignora requests sem ttfbMs', () => {
		const r = [
			req({ networkTiming: { ttfbMs: 100 } }),
			req(), // sem ttfbMs → ignorada
			req({ networkTiming: { ttfbMs: 300 } }),
		];
		const result = detailTtfb(r);
		expect(result).toEqual({ p50: 200, p95: 300, max: 300 });
	});
});

describe('detailSlow', () => {
	it('retorna lista vazia quando ninguém é > 1000ms', () => {
		const r = [req({ duration: 500 }), req({ duration: 999 })];
		expect(detailSlow(r)).toEqual({ top: [] });
	});

	it('top 3 mais lentas com duration > 1000', () => {
		const r = [
			req({ url: 'https://a/', duration: 1200 }),
			req({ url: 'https://b/', duration: 2400 }),
			req({ url: 'https://c/', duration: 800 }), // < 1000, fora
			req({ url: 'https://d/', duration: 1800 }),
			req({ url: 'https://e/', duration: 1100 }),
		];
		expect(detailSlow(r).top).toEqual([
			{ url: 'https://b/', durationMs: 2400 },
			{ url: 'https://d/', durationMs: 1800 },
			{ url: 'https://a/', durationMs: 1200 },
		]);
	});

	it('ignora request sem duration', () => {
		const r = [req(), req({ duration: 1500 })];
		expect(detailSlow(r).top).toEqual([{ url: 'https://example.com/', durationMs: 1500 }]);
	});
});

describe('detailFailed', () => {
	it('retorna lista vazia quando não há falhas', () => {
		expect(detailFailed([req({ status: 200 })])).toEqual({ list: [] });
	});

	it('inclui status >= 400 e captureError, ordenado por timestamp desc', () => {
		const r = [
			req({ url: 'https://a/', status: 200, timestamp: 100 }),
			req({ url: 'https://b/', status: 404, statusText: 'Not Found', timestamp: 200 }),
			req({
				url: 'https://c/',
				status: 500,
				statusText: 'Internal Server Error',
				timestamp: 300,
			}),
			req({ url: 'https://d/', status: 200, captureError: 'oops', timestamp: 400 }),
		];
		expect(detailFailed(r).list).toEqual([
			{ url: 'https://d/', method: undefined, status: 200, statusText: 'OK' },
			{ url: 'https://c/', method: undefined, status: 500, statusText: 'Internal Server Error' },
			{ url: 'https://b/', method: undefined, status: 404, statusText: 'Not Found' },
		]);
	});

	it('limita a 5 entradas', () => {
		const r = Array.from({ length: 10 }, (_, i) =>
			req({ url: `https://${i}/`, status: 500, timestamp: i * 100 }),
		);
		const result = detailFailed(r);
		expect(result.list).toHaveLength(5);
		// 5 mais recentes: timestamps 9*100, 8*100, ..., 5*100
		expect(result.list[0]?.url).toBe('https://9/');
		expect(result.list[4]?.url).toBe('https://5/');
	});

	it('inclui method quando definido', () => {
		const r = [req({ method: 'POST', status: 401 })];
		expect(detailFailed(r).list[0]?.method).toBe('POST');
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/lib/__tests__/networkPillsDetail.test.ts`
Expected: erro "Cannot find module '../networkPillsDetail'".

- [ ] **Step 3: Implementar `app/src/lib/networkPillsDetail.ts`**

```ts
// Funções puras de agregação por papel da pill no NetworkMetricsBar.
// Cada função recebe `requests` JÁ filtrado pela janela ativa (Sessão ou
// Página) — `useNetworkMetrics` é responsável pelo filtro temporal.
//
// Regra do projeto (no-fallback): quando a métrica não tem dado,
// devolvemos lista vazia ou `null`, nunca zeros fictícios.

import type { InterceptedResponse } from '@/types/intercepted';

// ============== TotalDetail ==============

export interface TotalDetail {
	// Top 3 métodos por contagem desc. Quando há > 3 métodos distintos, o 4º
	// elemento é uma tupla `['outros', n]` agregando os restantes. Lista nunca
	// passa de 4 elementos. Quando há ≤ 3 métodos, sem "outros".
	byMethod: Array<[string, number]>;
	byStatusRange: { '2xx': number; '3xx': number; '4xx5xx': number };
}

export function detailTotal(requests: InterceptedResponse[]): TotalDetail {
	const counts = new Map<string, number>();
	const byStatusRange = { '2xx': 0, '3xx': 0, '4xx5xx': 0 };

	for (const r of requests) {
		if (typeof r.method === 'string' && r.method.length > 0) {
			counts.set(r.method, (counts.get(r.method) ?? 0) + 1);
		}
		const s = r.status;
		if (typeof s === 'number') {
			if (s >= 200 && s < 300) byStatusRange['2xx'] += 1;
			else if (s >= 300 && s < 400) byStatusRange['3xx'] += 1;
			else if (s >= 400) byStatusRange['4xx5xx'] += 1;
		}
	}

	const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
	const byMethod: Array<[string, number]> = sorted.slice(0, 3);
	if (sorted.length > 3) {
		const othersTotal = sorted.slice(3).reduce((acc, [, n]) => acc + n, 0);
		byMethod.push(['outros', othersTotal]);
	}

	return { byMethod, byStatusRange };
}

// ============== BytesDetail ==============

export interface BytesDetailEntry {
	url: string;
	transferSize: number;
}

export interface BytesDetail {
	top: BytesDetailEntry[];
}

export function detailBytes(requests: InterceptedResponse[]): BytesDetail {
	const entries: BytesDetailEntry[] = [];
	for (const r of requests) {
		const ts = r.networkTiming?.transferSize;
		if (typeof ts === 'number') {
			entries.push({ url: r.url, transferSize: ts });
		}
	}
	entries.sort((a, b) => b.transferSize - a.transferSize);
	return { top: entries.slice(0, 3) };
}

// ============== TtfbDetail ==============

export interface TtfbDetail {
	p50: number;
	p95: number;
	max: number;
}

export function detailTtfb(requests: InterceptedResponse[]): TtfbDetail | null {
	const values: number[] = [];
	for (const r of requests) {
		const t = r.networkTiming?.ttfbMs;
		if (typeof t === 'number') values.push(t);
	}
	if (values.length === 0) return null;
	values.sort((a, b) => a - b);
	const p50 = percentile(values, 0.5);
	const p95 = percentile(values, 0.95);
	const max = values[values.length - 1] ?? 0;
	return { p50, p95, max };
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	// Convenção "nearest-rank": índice = ceil(p × N) - 1 (clamped).
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
	return sorted[idx] ?? 0;
}

// ============== SlowDetail ==============

export interface SlowDetailEntry {
	url: string;
	durationMs: number;
}

export interface SlowDetail {
	top: SlowDetailEntry[];
}

export function detailSlow(requests: InterceptedResponse[]): SlowDetail {
	const entries: SlowDetailEntry[] = [];
	for (const r of requests) {
		if (typeof r.duration === 'number' && r.duration > 1000) {
			entries.push({ url: r.url, durationMs: r.duration });
		}
	}
	entries.sort((a, b) => b.durationMs - a.durationMs);
	return { top: entries.slice(0, 3) };
}

// ============== FailedDetail ==============

export interface FailedDetailEntry {
	url: string;
	method?: string;
	status: number;
	statusText?: string;
}

export interface FailedDetail {
	list: FailedDetailEntry[];
}

export function detailFailed(requests: InterceptedResponse[]): FailedDetail {
	const entries: Array<FailedDetailEntry & { ts: number }> = [];
	for (const r of requests) {
		const isFailed = (typeof r.status === 'number' && r.status >= 400) || !!r.captureError;
		if (!isFailed) continue;
		entries.push({
			url: r.url,
			method: r.method,
			status: r.status,
			statusText: r.statusText,
			ts: r.timestamp,
		});
	}
	entries.sort((a, b) => b.ts - a.ts);
	const list = entries.slice(0, 5).map(({ url, method, status, statusText }) => ({
		url,
		method,
		status,
		statusText,
	}));
	return { list };
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/lib/__tests__/networkPillsDetail.test.ts`
Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/networkPillsDetail.ts app/src/lib/__tests__/networkPillsDetail.test.ts
git commit -m "feat(networkPillsDetail): 5 funções de agregação por papel da pill"
```

---

## Task 5: Estender `useNetworkMetrics` para retornar `details`

**Files:**
- Modify: `app/src/hooks/useNetworkMetrics.ts`
- Modify: `app/src/hooks/__tests__/useNetworkMetrics.test.tsx`

- [ ] **Step 1: Atualizar testes existentes + adicionar caso de details**

Em `app/src/hooks/__tests__/useNetworkMetrics.test.tsx`, substitua todo o conteúdo do arquivo por:

```tsx
import { renderHook } from '@testing-library/react';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';
import { useNetworkMetrics } from '../useNetworkMetrics';

function req(overrides: Partial<InterceptedResponse> = {}): InterceptedResponse {
	return {
		url: 'https://example.com/',
		status: 200,
		statusText: 'OK',
		headers: {},
		type: 'XHR',
		timestamp: 1000,
		...overrides,
	};
}

describe('useNetworkMetrics', () => {
	it('retorna agregados zerados quando marker está vazio', () => {
		const all: Record<string, InterceptedResponse> = {};
		const marker: SessionMarker = {
			sessionStartedAt: null,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session.totalRequests).toBe(0);
		expect(result.current.currentPage.totalRequests).toBe(0);
	});

	it('agrega só requests da janela "Sessão" quando sessionStartedAt está setado', () => {
		const all = {
			old: req({ timestamp: 100 }),
			a: req({ timestamp: 1000, networkTiming: { transferSize: 500 } }),
			b: req({ timestamp: 2000, networkTiming: { transferSize: 1500 } }),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.session).toMatchObject({ totalRequests: 2, totalBytes: 2000 });
		expect(result.current.currentPage.totalRequests).toBe(0);
	});

	it('agrega "Página atual" usando currentPageNavigatedAt', () => {
		const all = {
			a: req({ timestamp: 1000 }),
			b: req({ timestamp: 2500, status: 500 }),
			c: req({ timestamp: 3000 }),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://x.com',
			currentPageNavigatedAt: 2500,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));
		expect(result.current.currentPage).toMatchObject({ totalRequests: 2, failedCount: 1 });
		expect(result.current.session.totalRequests).toBe(3);
	});

	it('memoiza: mesma referência de input retorna mesmo objeto', () => {
		const all: Record<string, InterceptedResponse> = { a: req({ timestamp: 1500 }) };
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: null,
			currentPageNavigatedAt: null,
		};
		const { result, rerender } = renderHook(
			(props: { all: Record<string, InterceptedResponse>; marker: SessionMarker }) =>
				useNetworkMetrics(props.all, props.marker),
			{ initialProps: { all, marker } },
		);
		const first = result.current;
		rerender({ all, marker });
		expect(result.current).toBe(first);
	});

	it('retorna sessionDetails e currentPageDetails por janela', () => {
		const all = {
			s: req({
				timestamp: 1500,
				method: 'GET',
				networkTiming: { transferSize: 1000, ttfbMs: 100 },
			}),
			p: req({
				timestamp: 2500,
				method: 'POST',
				networkTiming: { transferSize: 2000, ttfbMs: 200 },
			}),
		};
		const marker: SessionMarker = {
			sessionStartedAt: 1000,
			currentPageUrl: 'https://x.com',
			currentPageNavigatedAt: 2000,
		};
		const { result } = renderHook(() => useNetworkMetrics(all, marker));

		// Sessão: 2 requests
		expect(result.current.sessionDetails.bytes.top).toHaveLength(2);
		expect(result.current.sessionDetails.ttfb).toEqual({ p50: 200, p95: 200, max: 200 });

		// Página: só a 'p' (timestamp 2500 >= 2000)
		expect(result.current.currentPageDetails.bytes.top).toHaveLength(1);
		expect(result.current.currentPageDetails.bytes.top[0]?.transferSize).toBe(2000);
	});
});
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/hooks/__tests__/useNetworkMetrics.test.tsx`
Expected: o teste novo "retorna sessionDetails e currentPageDetails por janela" falha (`sessionDetails` undefined).

- [ ] **Step 3: Estender `useNetworkMetrics`**

Substitua o conteúdo de `app/src/hooks/useNetworkMetrics.ts` por:

```ts
import { useMemo } from 'react';
import {
	type MetricsAggregate,
	aggregateRequests,
	filterByCurrentPage,
	filterBySession,
} from '@/lib/networkMetrics';
import {
	type BytesDetail,
	type FailedDetail,
	type SlowDetail,
	type TotalDetail,
	type TtfbDetail,
	detailBytes,
	detailFailed,
	detailSlow,
	detailTotal,
	detailTtfb,
} from '@/lib/networkPillsDetail';
import type { InterceptedResponse } from '@/types/intercepted';
import type { SessionMarker } from '@/types/sessionMarker';

// Hook puro: derivado de allRequests + sessionMarker. Memoizado para evitar
// agregar a cada render — só recompõe quando uma das duas referências muda.

export interface PillsDetail {
	total: TotalDetail;
	bytes: BytesDetail;
	ttfb: TtfbDetail | null;
	slow: SlowDetail;
	failed: FailedDetail;
}

export interface NetworkMetricsResult {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	sessionDetails: PillsDetail;
	currentPageDetails: PillsDetail;
}

function buildDetails(requests: InterceptedResponse[]): PillsDetail {
	return {
		total: detailTotal(requests),
		bytes: detailBytes(requests),
		ttfb: detailTtfb(requests),
		slow: detailSlow(requests),
		failed: detailFailed(requests),
	};
}

export function useNetworkMetrics(
	allRequests: Record<string, InterceptedResponse>,
	sessionMarker: SessionMarker,
): NetworkMetricsResult {
	return useMemo(() => {
		const sessionList = filterBySession(allRequests, sessionMarker.sessionStartedAt);
		const pageList = filterByCurrentPage(allRequests, sessionMarker.currentPageNavigatedAt);
		return {
			session: aggregateRequests(sessionList),
			currentPage: aggregateRequests(pageList),
			sessionDetails: buildDetails(sessionList),
			currentPageDetails: buildDetails(pageList),
		};
	}, [allRequests, sessionMarker]);
}
```

- [ ] **Step 4: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/hooks/__tests__/useNetworkMetrics.test.tsx`
Expected: 5 testes passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useNetworkMetrics.ts app/src/hooks/__tests__/useNetworkMetrics.test.tsx
git commit -m "feat(useNetworkMetrics): retorna details por janela co-memoizado"
```

---

## Task 6: Refatorar `<Pill>` para aceitar `detail`/`onClick`/`disabled`

**Files:**
- Modify: `app/src/components/layout/NetworkMetricsBar.tsx`
- Modify: `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx`

- [ ] **Step 1: Adicionar testes para o novo comportamento de Pill**

Em `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx`, antes do `});` que fecha o describe principal, adicione:

```tsx
	it('Pill clicável vira <button> e chama onClick', () => {
		const onClick = vi.fn();
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 2 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				onPillClick={onClick}
			/>,
		);
		const slowButton = document.querySelector('[data-pill="slow"]');
		expect(slowButton?.tagName).toBe('BUTTON');
		(slowButton as HTMLButtonElement)?.click();
		expect(onClick).toHaveBeenCalledWith('slow');
	});

	it('Pill binária com 0 fica aria-disabled e click é no-op', () => {
		const onClick = vi.fn();
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 0, failedCount: 0 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				onPillClick={onClick}
			/>,
		);
		const slowEl = document.querySelector('[data-pill="slow"]');
		expect(slowEl?.getAttribute('aria-disabled')).toBe('true');
	});

	it('Pill renderiza detail no tooltip quando fornecido', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				sessionDetails={{
					total: { byMethod: [['GET', 5]], byStatusRange: { '2xx': 5, '3xx': 0, '4xx5xx': 0 } },
					bytes: { top: [] },
					ttfb: null,
					slow: { top: [] },
					failed: { list: [] },
				}}
			/>,
		);
		// O detail deve estar montado no DOM (Tooltip renderiza o content sempre,
		// mesmo escondido visualmente — Radix tooltip mantém aria-describedby).
		// Verificar via texto único do TotalDetail.
		expect(screen.getByText('Por método')).toBeInTheDocument();
	});
```

Atualize também o `agg` ou os testes existentes — qualquer chamada existente que não passa `sessionMarker` precisa receber um marker mínimo. Veja Step 2.

- [ ] **Step 2: Atualizar todos os render() existentes para passar `sessionMarker`**

Substitua o conteúdo completo de `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx` por:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import type { SessionMarker } from '@/types/sessionMarker';
import { NetworkMetricsBar } from '../NetworkMetricsBar';

function agg(overrides: Partial<MetricsAggregate> = {}): MetricsAggregate {
	return {
		totalRequests: 0,
		totalBytes: null,
		avgTtfbMs: null,
		slowCount: 0,
		failedCount: 0,
		...overrides,
	};
}

const emptyMarker: SessionMarker = {
	sessionStartedAt: null,
	currentPageUrl: null,
	currentPageNavigatedAt: null,
};

describe('NetworkMetricsBar', () => {
	it('mostra placeholder quando totalRequests da aba ativa é 0', () => {
		render(
			<NetworkMetricsBar
				session={agg()}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={false}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getByText(/sem requests/i)).toBeInTheDocument();
	});

	it('renderiza as 5 pills da Sessão por padrão', () => {
		render(
			<NetworkMetricsBar
				session={agg({
					totalRequests: 47,
					totalBytes: 1024 * 1024 * 1.2,
					avgTtfbMs: 245,
					slowCount: 3,
					failedCount: 1,
				})}
				currentPage={agg()}
				hasCurrentPage={true}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		expect(screen.getByText('1.2 MB')).toBeInTheDocument();
		expect(screen.getByText('245 ms')).toBeInTheDocument();
		expect(screen.getAllByText('3').length).toBeGreaterThan(0);
		expect(screen.getAllByText('1').length).toBeGreaterThan(0);
	});

	it('alterna para janela "Página atual" ao clicar na tab', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 47 })}
				currentPage={agg({ totalRequests: 12 })}
				hasCurrentPage={true}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getByText('47')).toBeInTheDocument();
		// Radix Tabs reage a mouseDown (não click); jsdom não dispara o ciclo completo.
		fireEvent.mouseDown(screen.getByRole('tab', { name: /página/i }));
		expect(screen.getByText('12')).toBeInTheDocument();
	});

	it('desabilita tab "Página" quando hasCurrentPage é false', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		const pageTab = screen.getByRole('tab', { name: /página/i });
		expect(pageTab).toBeDisabled();
	});

	it('aplica classe de cor de aviso quando slowCount > 0', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 2 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		const slowPill = container.querySelector('[data-pill="slow"]');
		expect(slowPill?.className).toMatch(/text-amber/);
	});

	it('aplica classe destrutiva quando failedCount > 0', () => {
		const { container } = render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, failedCount: 1 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		const failPill = container.querySelector('[data-pill="failed"]');
		expect(failPill?.className).toMatch(/text-destructive/);
	});

	it('renderiza "—" para totalBytes/avgTtfbMs nulls', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, totalBytes: null, avgTtfbMs: null })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={emptyMarker}
			/>,
		);
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
	});

	it('Pill clicável vira <button> e chama onPillClick', () => {
		const onClick = vi.fn();
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 2 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				onPillClick={onClick}
			/>,
		);
		const slowButton = document.querySelector('[data-pill="slow"]');
		expect(slowButton?.tagName).toBe('BUTTON');
		(slowButton as HTMLButtonElement)?.click();
		expect(onClick).toHaveBeenCalledWith('slow');
	});

	it('Pill binária com 0 fica aria-disabled', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5, slowCount: 0, failedCount: 0 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				onPillClick={vi.fn()}
			/>,
		);
		const slowEl = document.querySelector('[data-pill="slow"]');
		expect(slowEl?.getAttribute('aria-disabled')).toBe('true');
	});

	it('renderiza TotalDetail no tooltip quando sessionDetails é fornecido', () => {
		render(
			<NetworkMetricsBar
				session={agg({ totalRequests: 5 })}
				currentPage={agg()}
				hasCurrentPage={false}
				isDebugging={true}
				sessionMarker={{
					sessionStartedAt: 1000,
					currentPageUrl: null,
					currentPageNavigatedAt: null,
				}}
				sessionDetails={{
					total: { byMethod: [['GET', 5]], byStatusRange: { '2xx': 5, '3xx': 0, '4xx5xx': 0 } },
					bytes: { top: [] },
					ttfb: null,
					slow: { top: [] },
					failed: { list: [] },
				}}
			/>,
		);
		expect(screen.getByText('Por método')).toBeInTheDocument();
	});
});
```

- [ ] **Step 3: Rodar testes para verificar que falham**

Run: `cd app && npx vitest run src/components/layout/__tests__/NetworkMetricsBar.test.tsx`
Expected: vários testes falham (props `sessionMarker`, `sessionDetails`, `onPillClick` não existem).

- [ ] **Step 4: Refatorar `NetworkMetricsBar.tsx`**

Substitua o conteúdo de `app/src/components/layout/NetworkMetricsBar.tsx` por:

```tsx
import { useState } from 'react';
import { LucideIcon, type LucideIconName } from '@/components/ui/lucide-icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import type {
	BytesDetail,
	FailedDetail,
	SlowDetail,
	TotalDetail,
	TtfbDetail,
} from '@/lib/networkPillsDetail';
import type { SessionMarker } from '@/types/sessionMarker';
import { formatBytes, formatCount, formatMs } from './networkMetricsFormat';

export type PillName = 'total' | 'bytes' | 'ttfb' | 'slow' | 'failed';

export interface PillsDetailProp {
	total: TotalDetail;
	bytes: BytesDetail;
	ttfb: TtfbDetail | null;
	slow: SlowDetail;
	failed: FailedDetail;
}

interface NetworkMetricsBarProps {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	hasCurrentPage: boolean;
	isDebugging: boolean;
	sessionMarker: SessionMarker;
	sessionDetails?: PillsDetailProp;
	currentPageDetails?: PillsDetailProp;
	onPillClick?: (pill: PillName) => void;
}

type Window = 'session' | 'page';

export function NetworkMetricsBar({
	session,
	currentPage,
	hasCurrentPage,
	isDebugging: _isDebugging,
	sessionMarker: _sessionMarker,
	sessionDetails,
	currentPageDetails,
	onPillClick,
}: NetworkMetricsBarProps) {
	const [window, setWindow] = useState<Window>('session');
	const active = window === 'session' ? session : currentPage;
	const activeDetails = window === 'session' ? sessionDetails : currentPageDetails;

	const handleClick = (pill: PillName) => {
		onPillClick?.(pill);
	};

	return (
		<div className="flex min-w-0 flex-shrink items-center gap-2 overflow-hidden">
			<Tabs value={window} onValueChange={(v) => setWindow(v as Window)}>
				<TabsList className="h-7">
					<TabsTrigger value="session" className="px-2 text-xs">
						Sessão
					</TabsTrigger>
					{hasCurrentPage ? (
						<TabsTrigger value="page" className="px-2 text-xs">
							Página
						</TabsTrigger>
					) : (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="inline-flex">
										<TabsTrigger value="page" className="px-2 text-xs" disabled>
											Página
										</TabsTrigger>
									</span>
								</TooltipTrigger>
								<TooltipContent side="bottom">Aguardando navegação na aba alvo</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</TabsList>
			</Tabs>

			{active.totalRequests === 0 ? (
				<span className="text-xs text-muted-foreground">Sem requests ainda</span>
			) : (
				<div className="flex items-center gap-1 overflow-x-auto">
					<Pill
						icon="activity"
						label="Total requests"
						name="total"
						detail={activeDetails ? <TotalDetailView data={activeDetails.total} /> : undefined}
						onClick={onPillClick ? () => handleClick('total') : undefined}
					>
						{formatCount(active.totalRequests)}
					</Pill>
					<Pill
						icon="download"
						label="Total baixado"
						name="bytes"
						detail={activeDetails ? <BytesDetailView data={activeDetails.bytes} /> : undefined}
						onClick={onPillClick ? () => handleClick('bytes') : undefined}
					>
						{formatBytes(active.totalBytes)}
					</Pill>
					<Pill
						icon="zap"
						label="TTFB médio"
						name="ttfb"
						detail={activeDetails ? <TtfbDetailView data={activeDetails.ttfb} /> : undefined}
						onClick={onPillClick ? () => handleClick('ttfb') : undefined}
					>
						{formatMs(active.avgTtfbMs)}
					</Pill>
					<Pill
						icon="hourglass"
						label="Requests lentas (> 1s)"
						name="slow"
						accent={active.slowCount > 0 ? 'warn' : undefined}
						detail={activeDetails ? <SlowDetailView data={activeDetails.slow} /> : undefined}
						onClick={onPillClick && active.slowCount > 0 ? () => handleClick('slow') : undefined}
						disabled={active.slowCount === 0}
					>
						{formatCount(active.slowCount)}
					</Pill>
					<Pill
						icon="alert-triangle"
						label="Falhas (4xx/5xx)"
						name="failed"
						accent={active.failedCount > 0 ? 'danger' : undefined}
						detail={activeDetails ? <FailedDetailView data={activeDetails.failed} /> : undefined}
						onClick={onPillClick && active.failedCount > 0 ? () => handleClick('failed') : undefined}
						disabled={active.failedCount === 0}
					>
						{formatCount(active.failedCount)}
					</Pill>
				</div>
			)}
		</div>
	);
}

interface PillProps {
	icon: LucideIconName;
	label: string;
	name: string;
	accent?: 'warn' | 'danger';
	detail?: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}

function Pill({ icon, label, name, accent, detail, onClick, disabled, children }: PillProps) {
	const accentClass =
		accent === 'warn'
			? 'text-amber-500'
			: accent === 'danger'
				? 'text-destructive'
				: 'text-foreground';

	const baseClass = `flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs ${accentClass}`;
	const interactiveClass = onClick && !disabled
		? 'cursor-pointer hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
		: '';
	const disabledClass = disabled ? 'cursor-default opacity-60' : '';

	const innerContent = (
		<>
			<LucideIcon name={icon} className="h-3.5 w-3.5" />
			<span>{children}</span>
		</>
	);

	const trigger =
		onClick && !disabled ? (
			<button
				type="button"
				data-pill={name}
				className={`${baseClass} ${interactiveClass}`}
				onClick={onClick}
			>
				{innerContent}
			</button>
		) : (
			<span
				data-pill={name}
				aria-disabled={disabled ? 'true' : undefined}
				className={`${baseClass} ${disabledClass}`}
			>
				{innerContent}
			</span>
		);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{trigger}</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-sm">
					{detail ?? label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// =====================================================================
// Detail views — micro-componentes locais para o conteúdo do tooltip de cada pill.
// =====================================================================

function TotalDetailView({ data }: { data: TotalDetail }) {
	return (
		<div className="space-y-2 text-xs">
			<div>
				<div className="text-[9px] uppercase text-muted-foreground mb-1">Por método</div>
				<div>
					{data.byMethod.length === 0
						? '—'
						: data.byMethod
								.map(([method, n]) => `${method} ${n}`)
								.join(' · ')}
				</div>
			</div>
			<div>
				<div className="text-[9px] uppercase text-muted-foreground mb-1">Por faixa de status</div>
				<div className="flex gap-3">
					<span className="text-emerald-500">2xx {data.byStatusRange['2xx']}</span>
					<span className="text-blue-400">3xx {data.byStatusRange['3xx']}</span>
					<span className="text-destructive">4xx/5xx {data.byStatusRange['4xx5xx']}</span>
				</div>
			</div>
		</div>
	);
}

function BytesDetailView({ data }: { data: BytesDetail }) {
	if (data.top.length === 0) {
		return <span className="text-xs">Nenhum transfer size capturado.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Top 3 por bytes</div>
			<div className="space-y-0.5">
				{data.top.map((entry) => (
					<div key={entry.url} className="flex items-center justify-between gap-3">
						<TruncatedUrl url={entry.url} />
						<span>{formatBytes(entry.transferSize)}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function TtfbDetailView({ data }: { data: TtfbDetail | null }) {
	if (data == null) {
		return <span className="text-xs">Nenhum TTFB capturado.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Distribuição de TTFB</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
				<span>p50</span>
				<span className="text-emerald-500 text-right">{formatMs(data.p50)}</span>
				<span>p95</span>
				<span className="text-amber-500 text-right">{formatMs(data.p95)}</span>
				<span>máx</span>
				<span className="text-destructive text-right">{formatMs(data.max)}</span>
			</div>
		</div>
	);
}

function SlowDetailView({ data }: { data: SlowDetail }) {
	if (data.top.length === 0) {
		return <span className="text-xs">Nenhuma request lenta.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Top 3 mais lentas</div>
			<div className="space-y-0.5">
				{data.top.map((entry) => (
					<div key={`${entry.url}-${entry.durationMs}`} className="flex items-center justify-between gap-3">
						<TruncatedUrl url={entry.url} />
						<span className="text-amber-500">{formatMs(entry.durationMs)}</span>
					</div>
				))}
			</div>
			<div className="mt-2 pt-2 border-t border-border text-[10px] text-blue-400">
				→ Click pra ver no Command Center
			</div>
		</div>
	);
}

function FailedDetailView({ data }: { data: FailedDetail }) {
	if (data.list.length === 0) {
		return <span className="text-xs">Nenhuma falha.</span>;
	}
	return (
		<div className="text-xs">
			<div className="text-[9px] uppercase text-muted-foreground mb-1">Falhas registradas</div>
			<div className="space-y-0.5">
				{data.list.map((entry) => (
					<div key={`${entry.url}-${entry.status}`} className="flex items-center justify-between gap-3">
						<TruncatedUrl url={`${entry.method ?? ''} ${entry.url}`.trim()} />
						<span className="text-destructive">
							{entry.status} {entry.statusText ?? ''}
						</span>
					</div>
				))}
			</div>
			<div className="mt-2 pt-2 border-t border-border text-[10px] text-blue-400">
				→ Click pra ver no Command Center
			</div>
		</div>
	);
}

// Trunca URL preservando o final (mais informativo). Usa direction: rtl + bdi
// para que o ellipsis fique no INÍCIO do texto.
function TruncatedUrl({ url }: { url: string }) {
	return (
		<span
			className="max-w-[240px] truncate"
			style={{ direction: 'rtl', textAlign: 'left' }}
			title={url}
		>
			<bdi>{url}</bdi>
		</span>
	);
}
```

- [ ] **Step 5: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/components/layout/__tests__/NetworkMetricsBar.test.tsx`
Expected: 10 testes passam.

Run também: `cd app && npx tsc --noEmit`
Expected: zero erros (a prop `sessionMarker` é nova mas tem default no callsite via Layout — será atualizado na Task 7).

⚠️ Se `tsc` reclamar do `SiteHeader` por mudança de assinatura (ex.: `Layout.tsx` ainda passando props antigas), isso é resolvido na Task 7. Aceite o erro temporário e siga.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/layout/NetworkMetricsBar.tsx app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx
git commit -m "feat(networkMetricsBar): pill smart com detail/onClick/disabled e detail views"
```

---

## Task 7: Propagar `sessionMarker` + `details` + click handler até o Layout

**Files:**
- Modify: `app/src/components/layout/SiteHeader.tsx`
- Modify: `app/src/components/__tests__/SiteHeader.test.tsx`
- Modify: `app/src/pages/Layout.tsx`

- [ ] **Step 1: Atualizar `SiteHeader.tsx` para receber e propagar as novas props**

Substitua o conteúdo de `app/src/components/layout/SiteHeader.tsx` por:

```tsx
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsAggregate } from '@/lib/networkMetrics';
import type { PillName, PillsDetailProp } from './NetworkMetricsBar';
import { NetworkMetricsBar } from './NetworkMetricsBar';
import type { SessionMarker } from '@/types/sessionMarker';

interface SiteHeaderProps {
	targetTab: {
		id: number | null;
		title: string;
		url: string;
	};
	isDebugging: boolean;
	onSelectTabClick: () => void;
	onStartDebugging: () => void;
	onStopDebugging: () => void;
	metrics: { session: MetricsAggregate; currentPage: MetricsAggregate };
	sessionMarker: SessionMarker;
	sessionDetails?: PillsDetailProp;
	currentPageDetails?: PillsDetailProp;
	onPillClick?: (pill: PillName) => void;
}

export function SiteHeader({
	targetTab,
	isDebugging,
	onSelectTabClick,
	onStartDebugging,
	onStopDebugging,
	metrics,
	sessionMarker,
	sessionDetails,
	currentPageDetails,
	onPillClick,
}: SiteHeaderProps) {
	const hasCurrentPage = sessionMarker.currentPageNavigatedAt != null;
	return (
		<header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear pr-2">
			<div className="flex w-full items-center justify-between px-4 lg:px-6">
				<div className="flex min-w-0 items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					<Separator
						orientation="vertical"
						className="mx-2 hidden data-[orientation=vertical]:h-6 md:block"
					/>
					<NetworkMetricsBar
						session={metrics.session}
						currentPage={metrics.currentPage}
						hasCurrentPage={hasCurrentPage}
						isDebugging={isDebugging}
						sessionMarker={sessionMarker}
						sessionDetails={sessionDetails}
						currentPageDetails={currentPageDetails}
						onPillClick={onPillClick}
					/>
				</div>

				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									className="flex items-center gap-2 max-w-[200px]"
									onClick={onSelectTabClick}
								>
									<LucideIcon name="tab" className="h-4 w-4 flex-shrink-0" />
									<span className="truncate">
										{targetTab.id ? targetTab.title : 'Selecionar Aba'}
									</span>
								</Button>
							</TooltipTrigger>
							{targetTab.id && (
								<TooltipContent side="bottom" className="max-w-[300px] break-words">
									<div>
										<div className="font-medium">{targetTab.title}</div>
										<div className="text-xs text-muted-foreground">{targetTab.url}</div>
									</div>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>

					{!isDebugging ? (
						<Button
							variant="default"
							className="flex items-center gap-2"
							onClick={onStartDebugging}
						>
							<LucideIcon name="play" className="h-4 w-4" />
							<span className="hidden sm:inline">Iniciar Interceptação</span>
						</Button>
					) : (
						<Button
							variant="destructive"
							className="flex items-center gap-2"
							onClick={onStopDebugging}
						>
							<LucideIcon name="stop" className="h-4 w-4" />
							<span className="hidden sm:inline">Parar Interceptação</span>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
```

Note que removemos `hasCurrentPage` da prop e derivamos de `sessionMarker.currentPageNavigatedAt`.

- [ ] **Step 2: Atualizar `app/src/components/__tests__/SiteHeader.test.tsx`**

Substitua todos os `mockProps` e renders pra incluir `sessionMarker` em vez de `hasCurrentPage`. Localize as ocorrências de `hasCurrentPage={...}` ou `hasCurrentPage:` e troque por `sessionMarker={emptyMarker}`. Adicione no topo do `describe`:

```ts
import type { SessionMarker } from '@/types/sessionMarker';

const emptyMarker: SessionMarker = {
	sessionStartedAt: null,
	currentPageUrl: null,
	currentPageNavigatedAt: null,
};
```

Em `mockProps`, substitua a linha `hasCurrentPage: false,` por `sessionMarker: emptyMarker,`.

Em todos os JSX `<SiteHeader ... hasCurrentPage={false} ... />` que existem, substitua `hasCurrentPage={false}` por `sessionMarker={emptyMarker}`.

(Há 1 mockProps + 1 JSX inline com props inline. Se houver mais, atualizar todos.)

- [ ] **Step 3: Atualizar `app/src/pages/Layout.tsx`**

Substitua o conteúdo de `app/src/pages/Layout.tsx` por:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SelectTabDialog } from '../components/select-tab/SelectTabDialog';
import { AppSidebar } from '../components/layout/AppSidebar';
import { SiteHeader } from '../components/layout/SiteHeader';
import type { PillName } from '../components/layout/NetworkMetricsBar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useDebugging } from '../hooks/useDebugging';
import { useResponses } from '../hooks/useResponses';
import { useAllRequests } from '../hooks/useAllRequests';
import { useSessionMarker } from '../hooks/useSessionMarker';
import { useNetworkMetrics } from '../hooks/useNetworkMetrics';
import { encodeFiltersToParams } from '@/lib/filterUrlSerialization';
import type { Filter } from '@/types/filters';

const Layout: React.FC = () => {
	const navigate = useNavigate();
	const { isDebugging, targetTab, startDebugging, stopDebugging } = useDebugging();
	const { pendingResponses } = useResponses();
	const { allRequests } = useAllRequests();
	const sessionMarker = useSessionMarker();
	const metrics = useNetworkMetrics(allRequests, sessionMarker);
	const [selectTabDialogOpen, setSelectTabDialogOpen] = useState(false);

	useEffect(() => {
		const messageListener = (message: any) => {
			if (message.action === 'openSelectTabDialog') {
				setSelectTabDialogOpen(true);
			}
		};
		chrome.runtime.onMessage.addListener(messageListener);
		return () => {
			chrome.runtime.onMessage.removeListener(messageListener);
		};
	}, []);

	const handleSelectTab = (tabId: number, tabTitle: string, tabUrl: string) => {
		chrome.runtime.sendMessage({
			action: 'setTargetTab',
			tabId,
			tabTitle,
			tabUrl,
		});
	};

	// Click handler unificado para as pills do NetworkMetricsBar.
	// Constrói filtros que reproduzem o que a pill descreve, herdando a janela
	// ativa (Sessão ou Página) como filtro de tempo. Navega para /command-center
	// com os filtros serializados na URL — o /command-center hidrata na montagem.
	const handlePillClick = useCallback(
		(pill: PillName) => {
			// Janela ativa é estado interno do NetworkMetricsBar; não temos acesso direto.
			// Aproximação: usar `currentPageNavigatedAt` quando disponível, senão `sessionStartedAt`.
			// Esta heurística casa com o estado padrão da Tabs: quando há página, ela é o foco
			// (a pill exibida coincide). Caso o usuário esteja com a tab "Sessão" ativa,
			// o filtro pode mostrar mais requests do que a pill — aceitável v1; caminho
			// "exato" exige levantar `window` para o pai (refactor maior, fora de escopo).
			const since = sessionMarker.currentPageNavigatedAt ?? sessionMarker.sessionStartedAt;
			const filters: Filter[] = [];
			if (since != null) {
				filters.push({
					id: crypto.randomUUID(),
					field: 'timestamp',
					operator: 'gte',
					value: String(since),
				});
			}
			if (pill === 'slow') {
				filters.push({
					id: crypto.randomUUID(),
					field: 'duration',
					operator: 'gte',
					value: '1000',
				});
			} else if (pill === 'failed') {
				filters.push({
					id: crypto.randomUUID(),
					field: 'status',
					operator: 'gte',
					value: '400',
				});
			}
			const params = encodeFiltersToParams(filters);
			const query = params.toString();
			navigate(query ? `/command-center?${query}` : '/command-center');
		},
		[navigate, sessionMarker.currentPageNavigatedAt, sessionMarker.sessionStartedAt],
	);

	return (
		<SidebarProvider>
			<AppSidebar variant="inset" pendingResponsesCount={Object.keys(pendingResponses).length} />
			<SidebarInset>
				<SelectTabDialog
					open={selectTabDialogOpen}
					onOpenChange={setSelectTabDialogOpen}
					onSelectTab={handleSelectTab}
				/>
				<SiteHeader
					targetTab={targetTab}
					isDebugging={isDebugging}
					onSelectTabClick={() => setSelectTabDialogOpen(true)}
					onStartDebugging={() => startDebugging()}
					onStopDebugging={() => stopDebugging()}
					metrics={metrics}
					sessionMarker={sessionMarker}
					sessionDetails={metrics.sessionDetails}
					currentPageDetails={metrics.currentPageDetails}
					onPillClick={handlePillClick}
				/>

				<div className="main-content-container flex-1 min-h-0 overflow-hidden">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default Layout;
```

⚠️ **Limitação documentada**: o click handler usa `currentPageNavigatedAt ?? sessionStartedAt` como timestamp porque o estado `window` ('session' | 'page') é interno do `NetworkMetricsBar`. Quando o usuário está na tab "Sessão" mas existe `currentPageNavigatedAt`, o click vai filtrar pela página em vez da sessão — *menos* requests do que a pill mostra. Aceitável v1; resolver elevando o estado `window` para o `Layout` é refactor maior e fica fora de escopo deste plano.

- [ ] **Step 4: Verificar compilação e testes**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

Run: `cd app && npx vitest run src/components/__tests__/SiteHeader.test.tsx src/components/layout/__tests__/NetworkMetricsBar.test.tsx`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/SiteHeader.tsx app/src/components/__tests__/SiteHeader.test.tsx app/src/pages/Layout.tsx
git commit -m "feat(layout): propaga sessionMarker/details e click handler ao SiteHeader"
```

---

## Task 8: Hidratação de filtros via URL no `CommandCenter` (TDD)

**Files:**
- Create: `app/src/pages/__tests__/CommandCenter.test.tsx` (se ainda não existir)
- Modify: `app/src/pages/CommandCenter.tsx`

- [ ] **Step 1: Verificar se `app/src/pages/__tests__/CommandCenter.test.tsx` existe**

Run: `ls app/src/pages/__tests__/`
Se sim, leia o arquivo antes de modificar. Se não, crie do zero.

- [ ] **Step 2: Escrever teste falhando**

Crie (ou substitua, se já existir) `app/src/pages/__tests__/CommandCenter.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CommandCenter from '../CommandCenter';

// Mock dos hooks que o CommandCenter usa — só nos importa setFilters aqui.
const setFiltersMock = vi.fn();

vi.mock('@/hooks/useAllRequests', () => ({
	useAllRequests: () => ({
		filteredRequests: {},
		filters: [],
		setFilters: setFiltersMock,
		pauseAutoRefresh: vi.fn(),
		enableAutoRefresh: vi.fn(),
		autoRefreshEnabled: true,
		clearAllRequests: vi.fn(),
	}),
}));

vi.mock('@/hooks/useResponses', () => ({
	useResponses: () => ({
		approveResponse: vi.fn(),
		ignoreResponse: vi.fn(),
		pendingResponses: {},
	}),
}));

vi.mock('@/hooks/useRules', () => ({
	useRules: () => ({ rules: [] }),
}));

vi.mock('@/hooks/useRequestSelection', () => ({
	useRequestSelection: () => ({
		selectedId: null,
		selected: null,
		select: vi.fn(),
		clear: vi.fn(),
	}),
}));

// Mocks superficiais dos componentes filhos para isolar o teste de hidratação.
vi.mock('@/components/command-center/RequestTimeline', () => ({
	RequestTimeline: () => <div data-testid="request-timeline" />,
}));
vi.mock('@/components/command-center/RequestInspector', () => ({
	RequestInspector: () => null,
}));
vi.mock('@/components/command-center/QuickMockPanel', () => ({
	QuickMockPanel: () => null,
}));
vi.mock('@/components/command-center/PendingAlertBanner', () => ({
	PendingAlertBanner: () => null,
}));
vi.mock('@/components/command-center/PendingActionDock', () => ({
	PendingActionDock: () => null,
}));
vi.mock('@/components/command-center/usePendingHotkeys', () => ({
	usePendingHotkeys: () => undefined,
}));

describe('CommandCenter — hidratação de URL', () => {
	beforeEach(() => {
		setFiltersMock.mockClear();
	});

	it('hidrata setFilters quando URL contém ?f=...', async () => {
		render(
			<MemoryRouter initialEntries={['/command-center?f=duration:gte:1000']}>
				<Routes>
					<Route path="/command-center" element={<CommandCenter />} />
				</Routes>
			</MemoryRouter>,
		);

		await waitFor(() => {
			expect(setFiltersMock).toHaveBeenCalledTimes(1);
		});
		const filtersArg = setFiltersMock.mock.calls[0]?.[0];
		expect(filtersArg).toHaveLength(1);
		expect(filtersArg[0]).toMatchObject({
			field: 'duration',
			operator: 'gte',
			value: '1000',
		});
	});

	it('não chama setFilters quando URL não tem ?f=', async () => {
		render(
			<MemoryRouter initialEntries={['/command-center']}>
				<Routes>
					<Route path="/command-center" element={<CommandCenter />} />
				</Routes>
			</MemoryRouter>,
		);

		// Damos um tick pra effect rodar
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(setFiltersMock).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 3: Rodar teste para verificar que falha**

Run: `cd app && npx vitest run src/pages/__tests__/CommandCenter.test.tsx`
Expected: o primeiro teste falha (`setFilters` não é chamado — o componente ainda não hidrata).

- [ ] **Step 4: Adicionar hidratação no `CommandCenter.tsx`**

Em `app/src/pages/CommandCenter.tsx`, no topo do arquivo onde estão os imports, adicione:

```ts
import { useSearchParams } from 'react-router-dom';
import { decodeParamsToFilters } from '@/lib/filterUrlSerialization';
```

Note que `useNavigate` já está importado de `react-router-dom`; junte: `import { useNavigate, useSearchParams } from 'react-router-dom';`.

Dentro do `CommandCenter` component, **logo após o `const { ... } = useAllRequests();`**, adicione:

```ts
	const [searchParams] = useSearchParams();

	// Hidrata filtros a partir da URL (?f=field:op:value). Útil quando o usuário
	// chega ao Command Center via click em uma pill do NetworkMetricsBar — a URL
	// é fonte de verdade naquele momento e substitui filtros locais.
	// biome-ignore lint/correctness/useExhaustiveDependencies: setFilters é estável (do useAllRequests)
	useEffect(() => {
		const decoded = decodeParamsToFilters(searchParams);
		if (decoded.length > 0) setFilters(decoded);
	}, [searchParams]);
```

(O `useEffect` já está importado no topo do arquivo.)

- [ ] **Step 5: Rodar testes para verificar que passam**

Run: `cd app && npx vitest run src/pages/__tests__/CommandCenter.test.tsx`
Expected: 2 testes passam.

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/CommandCenter.tsx app/src/pages/__tests__/CommandCenter.test.tsx
git commit -m "feat(commandCenter): hidrata filtros a partir da URL na montagem"
```

---

## Task 9: Smoke check final (lint + tsc + tests + build)

**Files:** nenhum a modificar — só validação.

- [ ] **Step 1: Rodar lint**

Run: `cd app && npm run lint`
Expected: zero warnings.

Se Biome reclamar, rodar `cd app && npm run lint:fix` e revisar diff antes de commitar correções.

- [ ] **Step 2: Rodar tsc**

Run: `cd app && npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Rodar todos os testes**

Run: `cd app && npm test`
Expected: todas as suites passam (incluindo as novas: `networkPillsDetail`, `filterUrlSerialization`, `useNetworkMetrics` (estendido), `NetworkMetricsBar` (estendido), `filterMatching` (estendido), `CommandCenter`).

- [ ] **Step 4: Build de produção**

Run: `cd app && npm run build`
Expected: bundle gerado em `app/dist/`, zero erros.

- [ ] **Step 5: Validar manualmente carregando a extensão**

1. Abrir `chrome://extensions` → Developer mode → Reload (ou Load unpacked → `app/dist/` se não estiver carregado).
2. Clicar no ícone da extensão → selecionar aba alvo → Iniciar Interceptação.
3. Carregar a target tab para gerar requests.
4. **Hover** em cada pill — deve aparecer o popover correspondente:
   - Total: "Por método" + "Por faixa de status"
   - Bytes: "Top 3 por bytes"
   - TTFB: "Distribuição de TTFB" com p50/p95/máx
   - Lentas: "Top 3 mais lentas" (se houver) ou "Nenhuma request lenta"
   - Falhas: "Falhas registradas" (se houver) ou "Nenhuma falha"
5. **Click** em "Total" — abre `/command-center` filtrado por timestamp da janela.
6. **Click** em "Lentas" (com valor > 0) — abre `/command-center` mostrando exatamente as lentas.
7. **Click** em "Falhas" (com valor > 0) — abre `/command-center` mostrando exatamente as falhas.
8. **Click** em "Lentas" com valor 0 — não acontece nada (cursor default, sem navegação).
9. Trocar para tab "Página", gerar request, repetir clicks. Verifica que o filtro `timestamp` herda o `currentPageNavigatedAt`.

- [ ] **Step 6: Commit final (se houve fix de lint)**

Se Step 1 precisou de fix:
```bash
git add -p
git commit -m "chore: ajustes de lint pós-integração"
```

Se nada mudou neste step, pular o commit.

---

## Self-Review

**Cobertura do spec:**

| Seção do spec | Task implementadora |
|---------------|---------------------|
| Pure aggregation por pill (`networkPillsDetail`) | Task 4 |
| Filter URL serialization | Task 3 |
| Filter system extensions (`duration`, `timestamp`) | Tasks 1, 2 |
| `useNetworkMetrics` retorna `details` | Task 5 |
| Pill smart (detail/onClick/disabled) | Task 6 |
| Click handler com janela inherit | Task 7 |
| `/command-center` hidratação por URL | Task 8 |
| Detail components por pill | Task 6 (TotalDetailView, BytesDetailView, etc.) |
| Truncate URL preservando final | Task 6 (TruncatedUrl helper) |
| Lint/build/test gate | Task 9 |

Sem buracos.

**Sem placeholders detectados:** todo step com código tem o código completo, todo comando tem o expected, nenhum "TBD/TODO/implementar depois".

**Consistência de tipos:**
- `PillsDetailProp` definida na Task 6 (export do `NetworkMetricsBar`); importada na Task 7 pelo `SiteHeader`. **Nota**: o spec falava em `PillsDetail` e o hook na Task 5 também exporta `PillsDetail` — para evitar conflito de nomes ao importar de dois locais, o componente expõe `PillsDetailProp` (alias estrutural; ambos têm a mesma forma).
- `PillName` definida e exportada na Task 6 do `NetworkMetricsBar`; usada na Task 7 (Layout).
- Funções `detailX`, tipos `TotalDetail`/`BytesDetail`/etc. definidos na Task 4; importados nas Tasks 5 (hook) e 6 (component).
- `Filter`, `FilterField`, `FilterOperator` consistentes entre Tasks 1, 2, 3, 7, 8.

OK pra executar.
