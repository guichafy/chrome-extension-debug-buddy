# Spec: Live Insights v2 — Visual & Organização

**Produto:** Debug Buddy
**Status:** Draft v1.0 — entrevista 2026-05-03
**Branch:** `feature/session-replay`
**Refina:** `docs/superpowers/specs/2026-05-03-session-replay-insights-recommendations-design.md` (não substitui — só ajusta UI/categorização)

---

## 0. Motivação

Após Phase A–M entregue e validada manualmente em sites reais (formio.github.io/angular-demo), três problemas concretos aparecem na UI atual do `LiveInsightsPanel`:

1. **Cores de severity indistinguíveis.** O token `--warning` do projeto está em hue 19 (rosa-avermelhado), praticamente igual ao `--destructive` (hue 22). Logo "ERRO" e "AVISO" parecem ambos vermelhos. `info` em azul funciona, mas o usuário não consegue separar erros de avisos rapidamente.

2. **Lista de recomendações poluída.** 27 hits no exemplo real, todos numa lista plana. Sem agrupamento, fica difícil saber "tô com problemas de segurança ou de performance?".

3. **Framework & Libraries confuso.**
   - `fetch` e `xhr` aparecem como badges (todo browser tem — ruído visual).
   - `angular-http` aparece **duas vezes**: uma em `httpClients` (com `(medium)`) e outra em `dataFetching` (sem confidence). Bug.
   - Versões só aparecem para `framework` e `libraries`, não para `dataFetching` (que pode ter version, ex.: Apollo).
   - Hierarquia visual fraca: `react` é o único com cor `default` (primary), o resto fica em `secondary`/`outline` cinza similar — não comunica que framework é o destaque principal.

## 1. Decisões consolidadas

| # | Decisão | Implicação |
|---|---|---|
| 1 | Recomendações agrupadas por **categoria** (Segurança / Performance) | Categoria deriva de map estático; não migra schema. |
| 2 | Layout: **seções colapsáveis** (default expandidas), uma por categoria | `<details>` HTML nativo. Categorias vazias são omitidas. |
| 3 | Severidades usam **paleta Tailwind dedicada** (red/amber/sky) | Não mexe em `--warning` global. Resolve "tudo vermelho". |
| 4 | Framework & Libraries reorganizado em **sub-headings por categoria** | URL no topo; sub-headings uppercase; categorias vazias omitidas. |
| 5 | Esconder `fetch` e `xhr` da seção "HTTP Clients" | Universais — ruído. Lista só clients interessantes (axios, angular-http, ky, etc). |
| 6 | Resolver duplicata `angular-http`: manter só em **HTTP Clients** | Remover de `detectDataFetching`. Angular-http é cliente, não data fetching framework. |
| 7 | Hierarquia visual: framework em `default`, libs em `secondary`, detection-only em `outline` | Olho do usuário vai primeiro ao framework. |

## 2. Map de categorias

Novo arquivo `app/src/lib/session/recommendations/categories.ts`:

```typescript
import type { RecommendationRuleId } from '../types';

export type RecommendationCategory = 'security' | 'performance';

export const RULE_CATEGORIES: Record<RecommendationRuleId, RecommendationCategory> = {
	'csp-missing': 'security',
	'hsts-missing': 'security',
	'cookie-insecure': 'security',
	'mixed-content': 'security',
	'cors-open': 'security',
	'nosniff-missing': 'security',
	'compression-missing': 'performance',
	'cache-missing': 'performance',
	'large-payload': 'performance',
	'image-not-optimized': 'performance',
};

export const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
	security: 'Segurança',
	performance: 'Performance',
};

export const CATEGORY_ORDER: RecommendationCategory[] = ['security', 'performance'];
```

Decisão de design: **map estático em vez de campo no `Recommendation`**. Razões:
- Sessões antigas exportadas continuam abrindo sem migrator.
- Categoria é metadado da regra, não da instância — não precisa estar em runtime payload.
- Mudança no agrupamento futuro (ex.: separar Security em Network vs Cookies) é local, sem migrar IDB.

## 3. UI Recomendações

### 3.1 Estrutura

```
RECOMENDAÇÕES (27)
═══════════════════════════════════════
▾ Segurança (18)
  ┌─[red ▎]──────────────────────────┐
  │ ERRO  csp-missing  example.form.io│
  │       HTML sem CSP: ...           │
  ├─[red ▎]──────────────────────────┤
  │ ERRO  hsts-missing                │
  │       HTTPS sem HSTS: ...         │
  ├─[amber ▎]────────────────────────┤
  │ AVISO cors-open  example.form.io  │
  │       ACAO=* em ...               │
  └───────────────────────────────────┘

▾ Performance (9)
  ┌─[amber ▎]────────────────────────┐
  │ AVISO compression-missing         │
  │       /access (273KB) sem gzip    │
  ├─[sky ▎]──────────────────────────┤
  │ INFO  cache-missing               │
  │       /static/x.js sem cache      │
  └───────────────────────────────────┘
```

### 3.2 Comportamento

- Seção colapsável via `<details open>` (default expandida). User pode fechar.
- Counter `(N)` no `<summary>` por categoria.
- Categoria com 0 hits **não é renderizada** (DOM enxuto).
- Header global da seção "Recomendações (N)" continua mostrando count total.
- Order de items dentro da categoria: **newest first** (preserva o comportamento do reducer atual).

### 3.3 Component shape

```tsx
function RecommendationsSection({ items }: { items: Recommendation[] }) {
	if (items.length === 0) return <EmptyState />;

	const grouped: Record<RecommendationCategory, Recommendation[]> = { security: [], performance: [] };
	for (const r of items) {
		const cat = RULE_CATEGORIES[r.ruleId];
		if (cat) grouped[cat].push(r);
	}

	return (
		<div>
			{CATEGORY_ORDER.map((cat) =>
				grouped[cat].length === 0 ? null : (
					<details key={cat} open className="border-b">
						<summary className="cursor-pointer px-3 py-2 font-medium text-muted-foreground text-xs uppercase hover:bg-muted/40">
							{CATEGORY_LABEL[cat]} ({grouped[cat].length})
						</summary>
						<div>
							{grouped[cat].map((r) => <RecommendationRow key={r.id} item={r} />)}
						</div>
					</details>
				),
			)}
		</div>
	);
}
```

## 4. Paleta de severidades

### 4.1 Tailwind classes diretas (sem tocar `globals.css`)

```typescript
// app/src/components/replay/RecommendationRow.tsx
const SEVERITY_CLASSES: Record<RecommendationSeverity, string> = {
	error:
		'border-l-red-500 bg-red-50 dark:bg-red-950/30',
	warn:
		'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
	info:
		'border-l-sky-500 bg-sky-50 dark:bg-sky-950/30',
};

const SEVERITY_LABEL_CLASSES: Record<RecommendationSeverity, string> = {
	error: 'text-red-700 dark:text-red-400',
	warn: 'text-amber-700 dark:text-amber-400',
	info: 'text-sky-700 dark:text-sky-400',
};

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
	error: 'ERRO',
	warn: 'AVISO',
	info: 'INFO',
};
```

### 4.2 Por que paleta dedicada (não tokens semânticos)?

- O projeto define `--warning` em hue 19 (vermelho-rosado) por motivos do tema geral. Mudar em escopo global afetaria outros consumers (RecordingToggle warning state, etc).
- Tailwind v4 inclui toda paleta `red/amber/sky/etc` por default sem configuração adicional.
- Cores explícitas neste componente comunicam intenção de design "esses são os 3 estados de severity, fixos" — não dependem do tema.
- Suporte a dark mode: `dark:bg-{cor}-950/30` provê contraste suave em fundo escuro.

### 4.3 Trade-off

Se no futuro o projeto adicionar tokens `--severity-error/warn/info` específicos, esta lógica migra para usar esses tokens. Por ora, paleta direta é simpler e correta.

## 5. UI Framework & Libraries

### 5.1 Estrutura

```
FRAMEWORK & LIBRARIES
═══════════════════════════════════════
URL
  https://formio.github.io/angular-demo/#/

Framework
  [angular]                                   ← variant=default
  (inclui versão quando disponível: "angular 17.3.0")

Libraries
  [jquery 3.7.1]                              ← variant=secondary

HTTP Clients
  [angular-http (medium)]  [axios]            ← variant=secondary
  (confidence só aparece quando ≠ 'high')

State
  [redux ×2]                                  ← variant=secondary
```

### 5.2 Sub-headings

`<h4 className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground mb-1">`

Cada sub-section é renderizada apenas se houver entries:

```tsx
function FrameworkSection({ detection }: { detection: LiveDetection | null }) {
	if (!detection) {
		return <p className="px-3 py-2 text-muted-foreground text-xs">Aguardando primeira detecção do probe…</p>;
	}
	const fp = detection.fingerprint;
	const interestingHttp = fp.httpClients.filter((c) => c.name !== 'fetch' && c.name !== 'xhr');

	return (
		<div className="space-y-3 px-3 py-2">
			<SubSection label="URL">
				<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
					{detection.url}
				</p>
			</SubSection>

			<SubSection label="Framework">
				<Badge variant="default" className="text-xs">
					{fp.framework.name}
					{fp.framework.version ? ` ${fp.framework.version}` : ''}
				</Badge>
			</SubSection>

			{fp.libraries.length > 0 && (
				<SubSection label="Libraries">
					{fp.libraries.map((l) => (
						<Badge key={`lib-${l.name}`} variant="secondary" className="text-xs">
							{l.name}
							{l.version ? ` ${l.version}` : ''}
							{l.confidence !== 'high' ? ` (${l.confidence})` : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{interestingHttp.length > 0 && (
				<SubSection label="HTTP Clients">
					{interestingHttp.map((c) => (
						<Badge key={`http-${c.name}`} variant="secondary" className="text-xs">
							{c.name}
							{c.confidence !== 'high' ? ` (${c.confidence})` : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{fp.dataFetching.length > 0 && (
				<SubSection label="Data Fetching">
					{fp.dataFetching.map((d) => (
						<Badge
							key={`data-${d.name}`}
							variant={d.treatment === 'tracked' ? 'secondary' : 'outline'}
							className="text-xs"
							title={
								d.treatment === 'detection-only'
									? 'Detectada nesta versão; sem agrupamento de operations / cache inspector dedicado.'
									: undefined
							}
						>
							{d.name}
							{d.version ? ` ${d.version}` : ''}
							{d.treatment === 'detection-only' ? ' · detect-only' : ''}
						</Badge>
					))}
				</SubSection>
			)}

			{fp.stateManagers.length > 0 && (
				<SubSection label="State">
					{fp.stateManagers.map((s) => (
						<Badge key={`state-${s.name}`} variant="secondary" className="text-xs">
							{s.name}
							{s.storesDetected > 0 ? ` ×${s.storesDetected}` : ''}
						</Badge>
					))}
				</SubSection>
			)}
		</div>
	);
}

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<h4 className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</h4>
			<div className="flex flex-wrap items-center gap-1.5">{children}</div>
		</div>
	);
}
```

### 5.3 Filtros aplicados

| Filtro | Efeito | Razão |
|---|---|---|
| `fp.httpClients.filter(c => c.name !== 'fetch' && c.name !== 'xhr')` | Esconde fetch/xhr da seção HTTP Clients | São universais — todo browser tem; não trazem valor |
| Categorias com `length === 0` omitidas | Sub-headings só aparecem se houver dados | Reduz clutter; respeita densidade do drawer |

## 6. Bug fix: `angular-http` duplicado em `detectDataFetching`

### 6.1 Estado atual

```typescript
// app/src/probe/detectors/dataFetching.ts (linha 25-29)
const ng = (window as unknown as { ng?: { getComponent?: unknown } }).ng;
const hasAppRoot = !!document.querySelector('app-root');
if (ng?.getComponent || hasAppRoot) {
	out.push({ name: 'angular-http', treatment: 'tracked' });
}
```

### 6.2 Fix

Remover esse bloco de `dataFetching.ts`. `angular-http` continua sendo emitido por `detectHttpClients` em `httpClients.ts` (que já trata Angular contexto).

Conceito: `angular-http` é um **cliente HTTP** (faz request HTTP via XMLHttpRequest no Angular). Não é um framework de data fetching dedicado (que abstrai cache, queries, mutations — Apollo, TanStack Query, SWR, etc).

### 6.3 Atualizar testes

`app/src/probe/detectors/__tests__/dataFetching.test.ts` — remover qualquer assertion que espera `angular-http` na saída de `detectDataFetching`. Adicionar (se útil) test negativo: "não emite angular-http mesmo com app-root presente".

## 7. Arquivos afetados

```
app/src/lib/session/recommendations/categories.ts          (NEW ~25 linhas)
app/src/components/replay/LiveInsightsPanel.tsx             (refactor das 2 sections; ~80 linhas mudadas)
app/src/components/replay/RecommendationRow.tsx             (paleta dedicada; ~15 linhas mudadas)
app/src/probe/detectors/dataFetching.ts                     (remover bloco angular-http; ~5 linhas)
app/src/probe/detectors/__tests__/dataFetching.test.ts      (atualizar fixture; 1-2 testes)
```

Total estimado: **~120 linhas mudadas + 1 arquivo novo + 1 teste**.

## 8. Não-objetivos (YAGNI explícito)

- **Não** adicionar `category: RecommendationCategory` ao tipo `Recommendation`. Map externo basta.
- **Não** introduzir filtros por severity dentro do drawer. Escopo é agrupamento, não filtro.
- **Não** ordenar por severity dentro de categoria. Manter ordem newest-first do reducer.
- **Não** adicionar tabs por host/regra. Decisão foi seções colapsáveis (B), não accordion-em-accordion (C).
- **Não** persistir estado collapsed/expanded entre mounts. Default expandida resetando a cada open do Sheet é aceitável (estado transitório de inspeção).
- **Não** mudar `--color-warning` global em `globals.css`. Outros componentes podem depender da cor atual.

## 9. Testes

### 9.1 Unit

- `dataFetching.test.ts`: remover assertion de `angular-http`; adicionar negative test (com `app-root`, NÃO emite angular-http).
- `LiveInsightsPanel.test.tsx`: garantir que (a) categorias vazias são omitidas; (b) header total `(N)` reflete soma; (c) clique no `<summary>` colapsa; (d) `fetch`/`xhr` não aparecem.

### 9.2 Manual

Revalidar em formio.github.io/angular-demo:
- Segurança aparece com counter > 0 (csp/hsts/nosniff devem disparar).
- Performance aparece com counter > 0 (compression em /access).
- ERRO em vermelho, AVISO em âmbar, INFO em azul-celeste — visualmente distinguíveis.
- `angular-http` aparece **uma vez só** em "HTTP Clients".
- `fetch`/`xhr` ausentes da seção HTTP Clients.

## 10. Rollback / risco

Mudança puramente de UI/categorização — sem alteração no contrato de mensagens, sem migração de schema, sem mudança no engine de regras. Revert é trivial (`git revert`) e não afeta sessões salvas.

Único risco real: **se o map `RULE_CATEGORIES` ficar desatualizado** (regra nova adicionada sem entrada no map). Mitigação: TypeScript `Record<RecommendationRuleId, RecommendationCategory>` força exhaustividade — adicionar regra nova sem entrada no map vira erro de compilação.
