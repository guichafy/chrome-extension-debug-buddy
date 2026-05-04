# Live Insights — Tech Catalog & Engine (Sub-projeto 1)

**Data:** 2026-05-03
**Status:** spec aprovada (aguardando revisão final do usuário)
**Escopo:** Sub-projeto 1 de 4 da evolução do Live Insights (Wappalyzer-style detection).

---

## Contexto

A detecção atual em `app/src/probe/detectors/` é estreita: framework (`react`/`angular`/`vanilla`), libraries (só `jquery`), httpClients (`fetch`/`xhr`/`axios`/`angular-http`), dataFetching (`apollo`/`tanstack-query`). Cobre uma fração do que o usuário quer ver. O `webappanalyzer` ([enthec/webappanalyzer](https://github.com/enthec/webappanalyzer), continuação open-source do Wappalyzer) mantém ~3000 fingerprints de CMSs, frameworks, analytics, hosting, e-commerce, etc., com schema rico (`js`, `dom`, `meta`, `headers`, `cookies`, `scriptSrc`, `scripts`, `html`, `text`, `css`, `url`, `xhr`, `dns`, `cert`, `robots`, `probe`).

Esta evolução substitui os 4 detectors estreitos por um engine compatível com o schema Wappalyzer, alimentado por subset curado de ~200 techs. O `RecommendationEngine` atual (network rules tipo `compression-missing`, `cache-missing`) **não depende** dos detectors e fica intacto.

## Decomposição (4 sub-projetos)

A evolução total foi quebrada em 4 sub-projetos sequenciais, cada um com seu próprio `spec → plan → implementação`:

1. **Catálogo + Engine de matching (este spec).** Lib pura, sem mexer em probe/background/UI.
2. **Probe MAIN reescrito.** Detector único Wappalyzer-shaped substitui os 4 atuais.
3. **Pipeline no background + merge incremental.** Scorer roda em cada `Fetch.requestPaused`, merge probe+background por host, broadcast estendido, migração de IndexedDB.
4. **UI redesign.** `LiveInsightsPanel` substitui as 4 seções por agrupamento por categoria Wappalyzer; picker por host preservado.

## Decisões fundacionais (já alinhadas com o usuário)

| Decisão | Escolha |
|---|---|
| Escopo do catálogo | Subset curado ~200 techs, bundled (~150KB) |
| Integração na UI (sub-projeto 4) | Substituir 4 seções atuais por categorias Wappalyzer |
| Localização do engine (sub-projeto 2/3) | Split: probe (DOM/JS/meta) + background (headers/cookies/xhr) |
| Grafo de implicações | `implies` + `requires` + `excludes` — todos os três |
| Captura de versão | Sim, via regex groups (`\;version:\1`) |
| Estratégia de re-detecção (sub-projeto 3) | Incremental (cada Fetch + DOM mutation) |

## Goals

- Lib pura, isolada em `app/src/lib/insights/`, sem efeitos colaterais em runtime do probe/background/UI nesta fase.
- Compatível 1:1 com o schema upstream do `webappanalyzer` para facilitar re-sync periódico.
- Scorer stateful, incremental, instanciável (uma instância por scan no probe ou por host no background, na fase 3).
- Suporte a `implies`/`requires`/`excludes` com ordem determinística e proteção contra ciclos.
- Captura de versão via regex groups + template `\1`/`\2`.
- Build script reproduzível: dado o repo upstream + whitelist, gera o catálogo do zero.
- 100% testável com fixtures isoladas. TDD-first.

## Non-goals (explícito desta fase)

- Probe não muda. Os 4 detectors atuais permanecem.
- Background não muda. Scorer existe mas ninguém o instancia ainda.
- UI não muda.
- Sem broadcast `liveDetection` novo.
- Sem migração de IndexedDB.
- Sem dependência de rede (catálogo é totalmente bundled).

## Arquitetura

```
app/src/lib/insights/
├── types.ts                  # Tech, TechHit, Confidence, SignalKind, MatchEvidence
├── catalog/
│   ├── _.json … z.json       # subset curado, schema 100% Wappalyzer
│   ├── categories.json       # subset das categorias usadas pelo subset
│   ├── groups.json           # idem
│   └── index.ts              # carrega + valida + compila regex
├── pattern.ts                # parsePattern (`pat\;confidence:50\;version:\1` → CompiledPattern)
├── matcher.ts                # matchTechAgainstSignal — pura
├── scorer.ts                 # Scorer class — stateful, incremental
├── implications.ts           # applyImplications — grafo
└── __tests__/
    ├── pattern.test.ts
    ├── matcher.test.ts
    ├── scorer.test.ts
    ├── implications.test.ts
    └── fixtures/

app/scripts/
├── tech-whitelist.json       # ~200 nomes do subset, checked into git
└── build-tech-catalog.ts     # importa do webappanalyzer-main, valida, copia

app/package.json             # +"catalog:rebuild": "tsx scripts/build-tech-catalog.ts"
```

## Tipos

```ts
// app/src/lib/insights/types.ts

export type Confidence = number; // 0-100. Display (sub-projeto 4): high>=75, mid 50-74, low<50.

export type SignalKind =
	| 'js'
	| 'dom'
	| 'meta'
	| 'header'
	| 'cookie'
	| 'scriptSrc'
	| 'script'
	| 'html'
	| 'text'
	| 'css'
	| 'url'
	| 'xhr'
	| 'implied'; // sentinel — evidence sintética para hits derivados via `implies`

export interface Signal {
	kind: SignalKind;
	name?: string; // preenchido em header/cookie/meta/js/dom-prop
	value: string;
}

export interface MatchEvidence {
	signal: SignalKind;
	pattern: string;
	matchedName?: string;
}

export interface TechHit {
	name: string;
	cats: number[];
	confidence: Confidence;
	version?: string;
	icon?: string;
	website?: string;
	description?: string;
	evidence: MatchEvidence[]; // cap em 8
	implied?: boolean;
}

export interface CompiledTech {
	name: string;
	cats: number[];
	icon?: string;
	website: string;
	description?: string;
	patterns: {
		js?: Record<string, CompiledPattern>;
		dom?: CompiledDomRule[];
		meta?: Record<string, CompiledPattern>;
		headers?: Record<string, CompiledPattern>;
		cookies?: Record<string, CompiledPattern>;
		scriptSrc?: CompiledPattern[];
		scripts?: CompiledPattern[];
		html?: CompiledPattern[];
		text?: CompiledPattern[];
		css?: CompiledPattern[];
		url?: CompiledPattern[];
		xhr?: CompiledPattern[];
	};
	implies: ImpliedRef[];
	requires: string[];
	requiresCategory: number[];
	excludes: string[];
}

export interface CompiledPattern {
	regex: RegExp;
	confidence: Confidence;
	versionTemplate?: string;
	raw: string;
}

export interface CompiledDomRule {
	selector: string;
	exists?: boolean;
	attributes?: Record<string, CompiledPattern>;
	properties?: Record<string, CompiledPattern>;
	text?: CompiledPattern;
}

export interface ImpliedRef {
	name: string;
	confidence: Confidence;
}

export interface MatchResult {
	confidence: Confidence;
	version?: string;
	evidence: MatchEvidence;
}
```

Notas:

- `confidence` numérica 0-100 acompanha o schema upstream. Display em faixas só na UI (sub-projeto 4).
- `evidence[]` capa em 8 entradas para não inflar payload futuro de broadcast (`liveDetection` cruza `chrome.runtime.sendMessage`).
- Catálogo não persiste em IndexedDB — é bundled, carregado uma vez no boot.

## Pattern parser (`pattern.ts`)

Patterns vêm em strings com modificadores opcionais separados por `\;`:

```
"jquery-([0-9.]+)\\.min\\.js\\;confidence:50\\;version:\\1"
```

```ts
export function parsePattern(raw: string): CompiledPattern {
	const parts = raw.split('\\;');
	const regexSource = parts[0];
	let confidence = 100;
	let versionTemplate: string | undefined;
	for (let i = 1; i < parts.length; i++) {
		const p = parts[i];
		if (p.startsWith('confidence:')) {
			const n = Number(p.slice('confidence:'.length));
			if (Number.isFinite(n)) confidence = clamp(n, 0, 100);
		} else if (p.startsWith('version:')) {
			versionTemplate = p.slice('version:'.length);
		}
	}
	return {
		regex: new RegExp(regexSource, 'i'),
		confidence,
		versionTemplate,
		raw,
	};
}

export function expandVersion(
	template: string | undefined,
	groups: RegExpMatchArray | null,
): string | undefined {
	if (!template || !groups) return undefined;
	const expanded = template.replace(/\\(\d)/g, (_, d) => groups[Number(d)] ?? '');
	return expanded.trim() || undefined;
}
```

Falhas:

- Build-time: regex inválida = erro fatal (exit 1). Nunca shippa catálogo com bug.
- Runtime (defensive): regex inválida = warn + skip. Tech sem nenhuma pattern válida é dropada do catálogo carregado.
- `expandVersion` com template malformado: retorna `undefined`. Match já contou (confidence > 0) e fica registrado sem version. Não inventa string.

## Matcher (`matcher.ts`)

Pura, sem estado. Funções pequenas por SignalKind:

```ts
function matchString(
	value: string,
	patterns: CompiledPattern[],
): { pattern: CompiledPattern; groups: RegExpMatchArray } | null {
	for (const p of patterns) {
		const m = value.match(p.regex);
		if (m) return { pattern: p, groups: m };
	}
	return null;
}

function matchKeyValue(
	signalName: string,
	signalValue: string,
	patternsByKey: Record<string, CompiledPattern>,
): { pattern: CompiledPattern; groups: RegExpMatchArray; key: string } | null {
	for (const [key, p] of Object.entries(patternsByKey)) {
		if (!new RegExp(`^${key}$`, 'i').test(signalName)) continue;
		const m = signalValue.match(p.regex);
		if (m) return { pattern: p, groups: m, key };
	}
	return null;
}

export function matchTechAgainstSignal(
	tech: CompiledTech,
	signal: Signal,
): MatchResult | null { /* dispatch por signal.kind */ }
```

`dom` é caso especial — o detector do probe (Sub-projeto 2) tem acesso direto ao DOM e converte cada `CompiledDomRule` em zero ou mais `MatchResult` sem passar pelo matcher genérico. Esta fase mantém apenas o type/compilação para `CompiledDomRule`.

`js` é tratado como key-value (key=path dotted, value=string serializada do valor lido em `window`).

## Scorer (`scorer.ts`)

Stateful, incremental:

```ts
export class Scorer {
	private hits = new Map<string, TechHit>();
	private compiledByName: Map<string, CompiledTech>;

	constructor(private readonly catalog: CompiledTech[]) {
		this.compiledByName = new Map(catalog.map((t) => [t.name, t]));
	}

	pushSignals(batch: Signal[]): void {
		for (const signal of batch) {
			for (const tech of this.catalog) {
				const m = matchTechAgainstSignal(tech, signal);
				if (!m) continue;
				this.upsertHit(tech, m);
			}
		}
		applyImplications(this.hits, this.compiledByName);
	}

	snapshot(): TechHit[] {
		return [...this.hits.values()];
	}

	reset(): void {
		this.hits.clear();
	}

	private upsertHit(tech: CompiledTech, m: MatchResult): void {
		const existing = this.hits.get(tech.name);
		if (!existing) {
			this.hits.set(tech.name, {
				name: tech.name,
				cats: tech.cats,
				confidence: m.confidence,
				version: m.version,
				icon: tech.icon,
				website: tech.website,
				description: tech.description,
				evidence: [m.evidence],
			});
			return;
		}
		existing.confidence = Math.min(100, existing.confidence + m.confidence);
		if (!existing.version && m.version) existing.version = m.version;
		if (existing.evidence.length < 8) existing.evidence.push(m.evidence);
	}
}
```

Decisões:

- **Confidence acumula somando** (paridade com Wappalyzer original): múltiplos sinais reforçam. Cap em 100.
- **Versão first-wins**. Não tentamos resolver "qual versão é mais confiável" entre patterns concorrentes — fica a primeira capturada. Trade-off aceito.
- Loop O(catalog × batch) é fine para subset 200 e batches pequenos (probe scan ~50 signals; background ~5-20 por response).

## Implications graph (`implications.ts`)

Aplicado depois de cada batch, **ordem fixa: excludes → requires → implies**:

```ts
export function applyImplications(
	hits: Map<string, TechHit>,
	catalog: Map<string, CompiledTech>,
): void {
	// 1. EXCLUDES
	for (const hit of hits.values()) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		for (const ex of tech.excludes) hits.delete(ex);
	}

	// 2. REQUIRES
	const namesNow = new Set(hits.keys());
	const catsNow = new Set<number>();
	for (const h of hits.values()) for (const c of h.cats) catsNow.add(c);
	for (const hit of [...hits.values()]) {
		const tech = catalog.get(hit.name);
		if (!tech) continue;
		const reqOk = tech.requires.every((r) => namesNow.has(r));
		const reqCatOk = tech.requiresCategory.every((c) => catsNow.has(c));
		if (!reqOk || !reqCatOk) hits.delete(hit.name);
	}

	// 3. IMPLIES — loop com depth guard
	let changed = true;
	let guard = 8;
	while (changed && guard-- > 0) {
		changed = false;
		for (const hit of [...hits.values()]) {
			const tech = catalog.get(hit.name);
			if (!tech) continue;
			for (const imp of tech.implies) {
				if (hits.has(imp.name)) continue;
				const implied = catalog.get(imp.name);
				if (!implied) continue;
				hits.set(imp.name, {
					name: implied.name,
					cats: implied.cats,
					confidence: imp.confidence,
					icon: implied.icon,
					website: implied.website,
					description: implied.description,
					evidence: [{ signal: 'implied', pattern: `implied by ${hit.name}` }],
					implied: true,
				});
				changed = true;
			}
		}
	}
}
```

Justificativas da ordem:

- **excludes primeiro**: tech detectada elimina rivais antes de qualquer derivação. Evita gerar implies a partir de tech que será removida.
- **requires segundo**: limpa órfãs (tech detectada cujo dependency não foi encontrado).
- **implies por último**: adiciona derivadas. Loop guarded (max 8 níveis) suporta cadeias (WordPress → PHP → Apache).

Idempotente: pushar mesmo batch duas vezes não duplica evidence (cap em 8) nem reaplica implies (já está no map).

## Build pipeline do catálogo

`app/scripts/tech-whitelist.json`:

```json
["React", "Vue.js", "Angular", "Next.js", "WordPress", "Shopify", "Google Analytics", ...]
```

Subset alvo (~200 techs) coberto via 22 categorias prioritárias:

| Categoria | Exemplos | ~count |
|---|---|---|
| JS frameworks | React, Vue, Angular, Svelte, Solid, Preact, Ember, Nuxt, Next.js, Remix, Astro, Qwik | 12 |
| JS libraries | jQuery, Lodash, Moment, Day.js, Date-fns, Axios, Apollo, TanStack Query, Redux, Zustand, MobX, Immer | 12 |
| CMS | WordPress, Drupal, Joomla, Shopify, Wix, Ghost | 6 |
| Analytics | GA, Plausible, Fathom, Mixpanel, Segment, Heap, Hotjar, FullStory, Amplitude, Matomo | 10 |
| Tag managers | GTM, Adobe Launch, Tealium, Segment, mParticle | 5 |
| Web servers | Nginx, Apache, Caddy, IIS, Express, Vercel | 6 |
| CDN | Cloudflare, Fastly, CloudFront, Akamai, Netlify, Vercel, KeyCDN, BunnyCDN | 8 |
| Hosting / PaaS | Vercel, Netlify, Heroku, GH Pages, Railway, Render, Fly.io, CF Pages | 8 |
| Ecommerce | Shopify, WooCommerce, Magento, BigCommerce, SFCC, PrestaShop | 6 |
| Privacy | OneTrust, Cookiebot, TrustArc, Iubenda, Didomi | 5 |
| A/B testing | Optimizely, VWO, AB Tasty, Adobe Target, Google Optimize | 5 |
| Payment | Stripe, Braintree, PayPal, Mercado Pago, PagSeguro | 5 |
| Programming languages | PHP, Ruby, Python, Java | 4 |
| Server-side frameworks | Rails, Django, Laravel, Express, FastAPI, Spring, Phoenix, Next.js (server) | 8 |
| UI frameworks | Bootstrap, Tailwind, Material UI, Ant Design, Chakra, Radix, shadcn, Bulma | 8 |
| Build tools | Webpack, Vite, Parcel, Rollup, esbuild | 5 |
| Auth | Auth0, Clerk, Firebase Auth, Supabase, Cognito | 5 |
| Customer support | Intercom, Zendesk, Drift, HubSpot, Crisp | 5 |
| Error monitoring | Sentry, Bugsnag, Rollbar, LogRocket, Datadog RUM | 5 |
| Marketing automation | HubSpot, Marketo, Pardot, ActiveCampaign, RD Station | 5 |
| Captcha | reCAPTCHA, hCaptcha, Cloudflare Turnstile, FriendlyCaptcha | 4 |
| Static site generators | Hugo, Jekyll, Eleventy, Gatsby | 4 |
| Misc | Stripe, Algolia, Elastic, Mapbox, Google Maps | 5 |

Total estimado ~155 — leaves headroom até 200 para adições durante o import.

`app/scripts/build-tech-catalog.ts` (executado via `npm run catalog:rebuild`):

1. Lê whitelist + ENV `WAPPALYZER_SRC` (default: `/Users/guichafy/Workspaces/webappanalyzer-main/src`).
2. Para cada nome, encontra a entrada no JSON correspondente upstream e copia para `app/src/lib/insights/catalog/<letra>.json` (preservando schema 1:1 — facilita re-sync).
3. Resolve fechamento: nomes em `implies`/`requires`/`excludes` que não estão na whitelist viram avisos no stderr. Política: não derruba o build (curador decide adicionar à whitelist).
4. Filtra `categories.json` e `groups.json` upstream para apenas as categorias usadas pelo subset.
5. Valida cada entrada contra `schema.json` upstream (zod gerado a partir do schema; falha = erro fatal).
6. Imprime tamanho final do catálogo (count + KB) para review.

`catalog/index.ts` carrega no boot:

```ts
const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });
export const COMPILED_CATALOG: CompiledTech[] = compileAll(Object.values(modules).flat());
export const CATEGORIES = ...;
```

`compileAll` chama `parsePattern` em cada string. Ver "Error handling" abaixo.

## Error handling — princípio "no fallbacks"

Alinha com `feedback_no_fallbacks` do projeto: implementações nunca silenciam falhas com defaults plausíveis.

- Build script: regex inválida = erro fatal, exit 1.
- Runtime defensive: regex inválida = warn + skip pattern. Se tech ficar sem **nenhuma** pattern válida, dropa a tech do catálogo carregado e loga. Não fabrica match.
- `expandVersion` com template malformado: retorna `undefined` (sem versão) — não inventa string.
- `applyImplications` com loop > 8 níveis: warn no console e para. Não quebra o Scorer.
- Catálogo vazio (todos imports falharam): Scorer ainda funciona, retorna `[]` em snapshot. `index.ts` loga erro claro.

## Testes

TDD-first, todos colocalizados em `__tests__/`:

| Arquivo | Cobertura |
|---|---|
| `pattern.test.ts` | parse de `pat\;confidence:50\;version:\1`; valores limites (confidence 0/100/-5/120 → clamp); template version sem grupos; flags case-insensitive; `expandVersion` com `\1`/`\2`/template malformado |
| `matcher.test.ts` | match string positivo/negativo; key-value com regex de chave; multi-pattern (primeira que casa) |
| `scorer.test.ts` | confidence acumula com cap 100; versão first-wins; evidence cap em 8; reset; idempotência (mesmo signal aplicado 2× não duplica) |
| `implications.test.ts` | excludes (Drupal removido por WordPress); requires não satisfeito (tech órfã removida); requiresCategory satisfeito; implies em cadeia (WordPress → PHP → Apache); ciclo previne loop; depth guard |
| `catalog/index.test.ts` | catálogo carrega sem erro; nomes únicos; toda tech tem ao menos uma pattern; toda tech tem website (schema obriga) |
| `fixtures/*.test.ts` | snapshots reais: signals coletados de WordPress.org, Shopify dev store, Next.js docs, etc. → assert que TechHit esperada aparece com confidence ≥ X. Fixtures são JSON checked-in. |

Total estimado: 40-60 testes nesta sub-fase. Critério de pronto: todos verdes + `npm run lint` limpo + `npm run build` ok + `npm run catalog:rebuild` reproduzível.

## Convenções aderentes ao projeto

- Indent: tabs, size 2 (`.editorconfig`, biome).
- Comentários, strings de erro, console logs em pt-BR.
- TS strict (alinhado a `app/tsconfig.json`).
- Sem fallback silencioso (alinha com `feedback_no_fallbacks`).
- Vitest com `globals: true`, jsdom env.
- Issues tracked via `bd`.

## Critérios de aceitação

- [ ] `app/src/lib/insights/` criado com types, pattern, matcher, scorer, implications, catalog/index.
- [ ] `app/scripts/build-tech-catalog.ts` executa e gera catálogo a partir do upstream + whitelist.
- [ ] `app/scripts/tech-whitelist.json` checked into git com nomes do subset.
- [ ] `npm run catalog:rebuild` reproduzível e idempotente.
- [ ] Catálogo gerado tem ≥150 e ≤220 techs.
- [ ] Pacote `app/src/lib/insights/catalog/` adiciona ≤200KB ao bundle.
- [ ] Todos os testes passam, lint limpo, build verde.
- [ ] Probe e background não foram modificados nesta fase.
- [ ] UI não foi modificada nesta fase.
- [ ] Nenhum import desta lib foi adicionado em probe/background/UI nesta fase (lib é dormante até Sub-projeto 2).

## Próximos passos

Após aprovação deste spec:

1. Invocar `writing-plans` para criar plano de implementação detalhado em `docs/superpowers/plans/`.
2. Implementar via TDD seguindo o plano.
3. Spec dos sub-projetos 2, 3 e 4 começam só depois de Sub-projeto 1 estar mergeado.
