# Pill Interactivity no NetworkMetricsBar — Design

**Data:** 2026-04-29
**Autor:** brainstorming session com Guilherme Chafy
**Status:** aprovado, pronto pra escrita do plano de implementação
**Spec base anterior:** [2026-04-29-network-metrics-header-design.md](./2026-04-29-network-metrics-header-design.md) (v1 — pills passivas)

## Objetivo

Tornar as 5 pills do `NetworkMetricsBar` interativas com dois níveis de revelação por papel:

- **Hover** → popover com detalhes específicos por métrica (top contribuidores, percentis, lista de problemas).
- **Click** → navega para `/command-center` com filtros que reproduzem exatamente o que a pill descreve, incluindo a janela ativa (Sessão ou Página) como filtro de tempo.

Princípio guia: **WYSIWYG no header**. Se a pill diz "5 falhas", o click leva o usuário a ver exatamente essas 5 falhas — nem mais (sem janela), nem menos (filtro errado).

## Decisões coletadas no brainstorming

1. **Comportamento por pill:** híbrido — Total/Bytes/TTFB sempre clicáveis (mesmo sem filtro extra, herdam só janela); Lentas/Falhas só clicáveis quando o valor é > 0.
2. **Conteúdo dos popovers:** híbrido por papel — Total: breakdown método+status; Bytes: top-3 URLs; TTFB: p50/p95/máx; Lentas: top-3 mais lentas; Falhas: lista (até 5).
3. **Janela ativa herda no click:** o filtro de tempo (`timestamp ≥ <sessionStartedAt | currentPageNavigatedAt>`) é sempre incluído.

## Arquitetura

Três camadas, cada uma com uma responsabilidade.

### 1. Agregação por pill (pure functions)

**Novo arquivo:** `app/src/lib/networkPillsDetail.ts`.

```ts
import type { InterceptedResponse } from '@/types/intercepted';

export interface TotalDetail {
	// Top 3 métodos por contagem, ordem desc. Quando há > 3 métodos distintos,
	// o 4º elemento da lista é uma tupla `['outros', n]` agregando os restantes.
	// Lista nunca passa de 4 elementos. Quando há ≤ 3 métodos, sem "outros".
	byMethod: Array<[string, number]>;
	byStatusRange: { '2xx': number; '3xx': number; '4xx5xx': number };
}
export function detailTotal(requests: InterceptedResponse[]): TotalDetail;

export interface BytesDetailEntry { url: string; transferSize: number; }
export interface BytesDetail { top: BytesDetailEntry[]; }   // top 3 desc
export function detailBytes(requests: InterceptedResponse[]): BytesDetail;

export interface TtfbDetail { p50: number; p95: number; max: number; }
export function detailTtfb(requests: InterceptedResponse[]): TtfbDetail | null;
// null quando nenhuma request tem ttfbMs definido (no-fallback).

export interface SlowDetailEntry { url: string; durationMs: number; }
export interface SlowDetail { top: SlowDetailEntry[]; }   // top 3 mais lentas, só com duration > 1000
export function detailSlow(requests: InterceptedResponse[]): SlowDetail;

export interface FailedDetailEntry { url: string; method?: string; status: number; statusText?: string; }
export interface FailedDetail { list: FailedDetailEntry[]; }
// Até 5 falhas (status ≥ 400 OR captureError); ordenadas por timestamp desc.
export function detailFailed(requests: InterceptedResponse[]): FailedDetail;
```

**Regra de no-fallback:** `detailTtfb` retorna `null` quando ninguém tem `ttfbMs`. `detailBytes` retorna lista vazia (não fictícia) quando ninguém tem `transferSize`. UI mostra estado vazio explicitamente em cada caso.

### 2. Serialização de filtros via URL

**Novo arquivo:** `app/src/lib/filterUrlSerialization.ts`.

```ts
import type { Filter } from '@/types/filters';

export function encodeFiltersToParams(filters: Filter[]): URLSearchParams;
export function decodeParamsToFilters(params: URLSearchParams): Filter[];
```

**Formato:** cada filtro é uma entry `f=<field>:<op>:<value>`, repetível via `URLSearchParams.append`. Value passa por `encodeURIComponent`. Field/op são enums conhecidos e vão crus.

Exemplo de URL gerada:

```
/command-center?f=timestamp:gte:1714425600000&f=duration:gte:1000
```

**Decoder:** parser tolerante a entries malformadas — entries com formato inválido (sem dois `:`, field/op desconhecidos) são ignoradas silenciosamente, **não** lançam exceção. URL é entrada não-confiável; o que sobrevive ao parse é o conjunto efetivo de filtros.

**IDs de filtro:** o decoder gera `crypto.randomUUID()` para cada Filter resultante. IDs só importam para remoção no front; cada decode é uma nova vida.

### 3. Filter system extensions

**`app/src/types/filters.ts`** ganha dois `FilterField`:

```ts
export type FilterField =
	| 'free' | 'url' | 'method' | 'status' | 'type' | 'mime' | 'state'
	| 'duration' | 'timestamp';
```

Labels em pt-BR:
- `duration` → "Duração (ms)"
- `timestamp` → "Janela de tempo"

**`app/src/lib/filterMatching.ts`** estende com:

- `duration` aceita `gte`, `lte`, `is`. Compara `request.duration` (number) com `Number(value)`. Quando `request.duration` é `undefined` (mocks, request sem timing): **não casa** o `gte`/`lte`/`is`. Coerente com no-fallback — request sem duration não pode ser declarada lenta nem rápida.
- `timestamp` aceita `gte`, `lte`. Compara `request.timestamp` com `Number(value)`. `timestamp` é sempre presente; teste defensivo apenas.

Operadores não suportados (ex.: `contains` em `duration`) caem no caminho default existente (não casa). Sem mudança no combinador AND/OR.

### 4. UI: Pill smart no `NetworkMetricsBar`

**Pill component refatorado** (mesmo arquivo `NetworkMetricsBar.tsx`):

```tsx
interface PillProps {
	icon: LucideIconName;
	label: string;
	name: string;
	accent?: 'warn' | 'danger';
	detail?: ReactNode;        // conteúdo rico do tooltip
	onClick?: () => void;
	disabled?: boolean;
	children: ReactNode;       // valor formatado
}
```

**Comportamento:**

- **Hover:** se `detail` está definido, `Tooltip` (shadcn) renderiza `detail` em vez do `label`. `TooltipContent` ganha `max-w-sm` para acomodar conteúdo.
- **Click:** se `onClick` está definido e `!disabled`, o conteúdo da pill é envolvido em `<button type="button">`. Recebe `cursor-pointer hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1`.
- **Disabled:** quando `disabled === true`, ignora `onClick`, aplica `aria-disabled="true"`, `cursor-default opacity-60`. Usado nas pills binárias (Lentas, Falhas) quando o contador é 0.

**Detail components** (5 micro-componentes locais em `NetworkMetricsBar.tsx`):

```tsx
function TotalDetail({ data }: { data: TotalDetail });
function BytesDetail({ data }: { data: BytesDetail });
function TtfbDetail({ data }: { data: TtfbDetail | null });
function SlowDetail({ data }: { data: SlowDetail });
function FailedDetail({ data }: { data: FailedDetail });
```

Cada um renderiza um bloco compacto: cabeçalho de seção em `text-[9px] uppercase text-muted-foreground` + linhas em `text-xs`. Cores nos números:
- `text-emerald-500` para 2xx, p50
- `text-blue-400` para 3xx
- `text-amber-500` para p95, lentas
- `text-destructive` para 4xx/5xx, máx, falhas

URLs em listas truncam **a partir do início** (mostrando o final do caminho — `…/api/users/me` é mais útil que `https://api.example.com/v…`). Implementação: `direction: rtl; text-align: left;` no container + envoltório com `<bdi>` para preservar a leitura. `max-w-[240px] truncate`.

### 5. Click handler

`NetworkMetricsBar` recebe agora `sessionMarker` completo (não só `hasCurrentPage`). O click handler é local:

```tsx
const navigate = useNavigate();

function handlePillClick(pill: 'total' | 'bytes' | 'ttfb' | 'slow' | 'failed') {
	const since = window === 'session'
		? sessionMarker.sessionStartedAt
		: sessionMarker.currentPageNavigatedAt;
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
		filters.push({ id: crypto.randomUUID(), field: 'duration', operator: 'gte', value: '1000' });
	}
	if (pill === 'failed') {
		filters.push({ id: crypto.randomUUID(), field: 'status', operator: 'gte', value: '400' });
	}
	const params = encodeFiltersToParams(filters);
	navigate(`/command-center?${params.toString()}`);
}
```

`window` ('session' | 'page') já é estado local do componente.

### 6. Hidratação no Command Center

`app/src/pages/CommandCenter.tsx` adiciona um `useEffect` que escuta `useSearchParams`:

```tsx
const [searchParams] = useSearchParams();
const { setFilters } = /* ... do useAllRequests */;

useEffect(() => {
	const decoded = decodeParamsToFilters(searchParams);
	if (decoded.length > 0) setFilters(decoded);
	// Quando a URL não tem ?f=..., não toca em filters — o usuário pode estar com filtros locais.
}, [searchParams]);
```

**Comportamento de re-entrada:** clicar pill estando já em `/command-center`. React Router atualiza `searchParams`, useEffect re-roda, `setFilters` substitui. Sempre que a URL chega com `?f=...`, ela é fonte de verdade naquele momento.

### 7. Hook estendido

`useNetworkMetrics(allRequests, sessionMarker)` retorna agora também `details`:

```ts
export interface NetworkMetricsResult {
	session: MetricsAggregate;
	currentPage: MetricsAggregate;
	sessionDetails: PillsDetail;
	currentPageDetails: PillsDetail;
}

export interface PillsDetail {
	total: TotalDetail;
	bytes: BytesDetail;
	ttfb: TtfbDetail | null;
	slow: SlowDetail;
	failed: FailedDetail;
}
```

Tudo memoizado em uma única chamada `useMemo([allRequests, sessionMarker])`. Os `aggregateRequests` + `detailX` rodam sequencialmente sobre as mesmas listas filtradas — uma passada por janela.

## Lifecycle

| Ação | Efeito |
|------|--------|
| Hover pill | Tooltip abre com `detail` (memoizado) |
| Click pill clicável | Constrói filtros + navega para `/command-center?f=...` |
| Click pill binária com 0 | No-op (button disabled, sem listener) |
| `/command-center` recebe URL com `?f=...` | useEffect hidrata filters via setFilters |
| Usuário muda janela (Sessão ↔ Página) | Click subsequente usa o timestamp da janela ativa |
| `clearAllRequests` | Pills caem ao placeholder; URLs navegadas continuam funcionais (a hidratação cria filtros independentes do estado de allRequests) |

## Testes

**Novos arquivos:**

- `app/src/lib/__tests__/networkPillsDetail.test.ts`
  - `detailTotal` com mix de métodos e status; "outros" quando há mais de 3 métodos.
  - `detailBytes` ignora requests sem `transferSize`; top 3 ordenado.
  - `detailTtfb` retorna `null` quando ninguém tem ttfbMs; calcula p50/p95/máx corretos.
  - `detailSlow` só inclui requests com `duration > 1000`; top 3 desc.
  - `detailFailed` ordena por timestamp desc; limite de 5 entradas.

- `app/src/lib/__tests__/filterUrlSerialization.test.ts`
  - Round-trip: `decode(encode(filters))` produz filtros equivalentes (ignorando IDs gerados).
  - Decode de string malformada (sem `:`, field desconhecido, op desconhecido) ignora silenciosamente.
  - Encode preserva caracteres especiais via URL-encoding.

**Estendidos:**

- `app/src/lib/__tests__/filterMatching.test.ts`
  - `duration` gte / lte / is — incluindo request sem duration definida não casa.
  - `timestamp` gte / lte.

- `app/src/components/layout/__tests__/NetworkMetricsBar.test.tsx`
  - Click em pill clicável dispara `useNavigate` com URL serializada correta (mock do `useNavigate` via `react-router`).
  - Pill binária com 0 não é clicável (`aria-disabled`, click é no-op).
  - Hover dispara render do detail correspondente (verificar via texto único do detail, ex.: "Por método" ou "p50").

- `app/src/pages/__tests__/CommandCenter.test.tsx`
  - Montagem com `?f=duration:gte:1000` chama `setFilters` com filter correspondente.
  - Mudança de searchParams subsequente re-hidrata.

## Fora de escopo (registrado, não implementar)

- Sort por coluna no Command Center via URL — só filtros viajam pela URL.
- Filter operator `between` — só `gte`/`lte` independentes.
- Click em URL dentro do popover para drill-down direto (abrir RequestDialog) — outro PR.
- Captura de console (INFO/WARN/ERROR/DEBUG) — Brainstorm B, separado.
- Animação/transição de entrada do tooltip — usa o que o shadcn Tooltip já oferece.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| URL muito longa em sessão grande | Filtros são poucos (1–2 typically); URL fica em centenas de caracteres no pior caso. Aceitável. |
| Hidratação na montagem conflita com filtros locais existentes | useEffect só age quando `decoded.length > 0`. Sem URL params → não toca em filtros. |
| `crypto.randomUUID` indisponível em algum contexto | Service worker MV3 + jsdom (vitest) ambos suportam. Sem fallback necessário. |
| Tooltip muito grande quebra layout do header | `max-w-sm` no `TooltipContent` + `truncate` em URLs. URLs longas truncam à esquerda. |
| Performance: 5 funções de agregação por janela × 2 janelas = 10 passadas | `aggregateRequests` + `detailX` operam sobre a mesma lista filtrada. O(n) por janela. 10k requests = ~5ms total. Sem worry. |
