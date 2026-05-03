# Live Insights — Probe Wappalyzer Detector (Sub-projeto 2)

**Data:** 2026-05-03
**Status:** spec aprovada (aguardando revisão final do usuário)
**Escopo:** Sub-projeto 2 de 4 da evolução do Live Insights.
**Depende de:** Sub-projeto 1 (`app/src/lib/insights/` — catálogo + engine, já mergeado).
**bd:** chrome-extension-debug-buddy-pkp

---

## Contexto

Sub-projeto 1 deixou a lib `app/src/lib/insights/` pronta com `Scorer`, `COMPILED_CATALOG` (116 techs), `applyImplications` e parsers, mas dormente — nenhum consumidor existe ainda. Este sub-projeto liga o probe MAIN-world ao engine: o probe passa a coletar signals do `window`/`document` e emitir um array `techs: TechHit[]` em cada `probe:detection`.

A detecção atual em `app/src/probe/detectors/{framework,libraries,httpClients,dataFetching}.ts` é estreita (só React/Angular/jQuery/axios/etc.) e produz um `EnvironmentFingerprint` com 4 campos especializados. O novo detector é amplo (qualquer tech do catálogo subset) e produz um array genérico de `TechHit`.

## Decisão de migração (alinhada com usuário)

**Aditivo em paralelo, com remoção da implementação legada como cleanup ao fim do Sub-projeto 4.**

Durante este Sub-projeto 2:
- Os 4 detectors legados continuam funcionando
- `buildFingerprint()` continua produzindo o `EnvironmentFingerprint` legado
- O novo detector roda lado a lado e produz `techs[]`
- Probe payload carrega ambos: `payload.fingerprint` (legado) e `payload.techs` (novo)
- Background ignora `payload.techs` (Sub-projeto 3 vai consumir)
- UI não muda (Sub-projeto 4)

A remoção dos detectors legados, do tipo `EnvironmentFingerprint` legado e do campo `fingerprint` no payload é um cleanup PR depois do Sub-projeto 4.

## Goals

- Novo detector único em `app/src/probe/detectors/wappalyzer.ts` que usa `COMPILED_CATALOG` + `Scorer` para detectar techs a partir do DOM/window
- Coleta MAIN-world signals: `js`, `dom`, `meta`, `cookies` (document.cookie), `html` (outerHTML cap), `scripts` (inline), `scriptSrc` (DOM), `css`, `text`, `url`
- DOM rules avaliadas em paralelo aos signals (workaround para o matcher pure não ter Document)
- Probe payload `probe:detection` carrega `techs?: TechHit[]` ao lado do `fingerprint` legado
- Tests com fixtures jsdom representando WordPress, Shopify e Next.js
- Zero regressão nos detectors legados ou no fluxo de session replay

## Non-goals

- Não remove os 4 detectors legados (cleanup pós-Sub-projeto 4)
- Background side (response headers, Set-Cookie, xhr de Fetch events, scriptSrc de Fetch) — Sub-projeto 3
- UI changes (`LiveInsightsPanel` continua mostrando Framework/Libraries/HTTP Clients/Data Fetching) — Sub-projeto 4
- Persistência das `techs[]` em sessões gravadas (trabalho do Sub-projeto 3, junto com background broadcast)
- Re-trabalho da heuristic `isProductionBuild`

## Arquitetura

```
app/src/probe/detectors/
├── wappalyzer.ts              # entrypoint — detectTechs(win, doc) → TechHit[]
├── wappalyzer/
│   ├── signals.ts             # collectMainWorldSignals(catalog, win, doc)
│   ├── domEval.ts             # evaluateDomRules(catalog, doc) — pure
│   └── jsPath.ts              # readDottedPath + serializeJsValue
└── __tests__/
    ├── wappalyzer.test.ts     # integração jsdom: WordPress/Shopify/Next.js
    ├── signals.test.ts
    ├── domEval.test.ts
    └── jsPath.test.ts

app/src/probe/main.ts           # MODIFY — chama detectTechs(); inclui no payload
app/src/probe/protocol.ts       # MODIFY — campo opcional techs no ProbeMessage
app/src/lib/session/types.ts    # MODIFY — PageDetection.techs?: TechHit[]
app/src/types/messages.ts       # MODIFY — Message.payload.techs opcional
```

`wappalyzer.ts` é o entrypoint chamado por `probe/main.ts`:

```ts
import { COMPILED_CATALOG } from '@/lib/insights/catalog';
import { applyImplications } from '@/lib/insights/implications';
import { Scorer } from '@/lib/insights/scorer';
import type { CompiledTech, MatchEvidence, TechHit } from '@/lib/insights/types';
import { collectMainWorldSignals } from './wappalyzer/signals';
import { evaluateDomRules } from './wappalyzer/domEval';

export function detectTechs(win: Window, doc: Document): TechHit[] {
	const scorer = new Scorer(COMPILED_CATALOG);
	scorer.pushSignals(collectMainWorldSignals(COMPILED_CATALOG, win, doc));
	const sigHits = scorer.snapshot();

	const domHits = evaluateDomRules(COMPILED_CATALOG, doc);

	// Merge por nome — sigHits primeiro, DOM agrega evidence/confidence
	const map = new Map<string, TechHit>(sigHits.map((h) => [h.name, h]));
	for (const dh of domHits) {
		const ex = map.get(dh.name);
		if (!ex) {
			map.set(dh.name, dh);
			continue;
		}
		ex.confidence = Math.min(100, ex.confidence + dh.confidence);
		if (!ex.version && dh.version) ex.version = dh.version;
		for (const ev of dh.evidence) {
			if (ex.evidence.length >= 8) break;
			ex.evidence.push(ev);
		}
	}

	// Re-aplica implications: DOM matches podem ter adicionado techs
	const byName = new Map<string, CompiledTech>(COMPILED_CATALOG.map((t) => [t.name, t]));
	applyImplications(map, byName);
	return [...map.values()];
}
```

Vantagens deste design:

- Zero mudança em `Scorer` (Sub-projeto 1 fica intocado)
- DOM rules tratadas em paralelo, mergeadas pelo orquestrador
- `applyImplications` exportada da lib é reusada em vez de duplicar lógica

## Caps

Constantes no módulo `signals.ts`:

| Cap | Valor | Razão |
|---|---|---|
| `HTML_CAP` | 100_000 | outerHTML típico ~50KB; postMessage tolera 100KB sem lag |
| `TEXT_CAP` | 50_000 | textContent menor que html |
| `CSS_CAP` | 50_000 | concatenado de stylesheets acessíveis |
| `INLINE_SCRIPT_CAP` | 20_000 | inline scripts grandes (analytics) cortados |
| `JS_PATH_MAX_DEPTH` | 6 | "wp.ajax.foo.bar.baz.qux" — paths reais ≤4; 6 dá folga |

## Signal collection (`signals.ts`)

```ts
export function collectMainWorldSignals(
	catalog: CompiledTech[],
	win: Window,
	doc: Document,
): Signal[] {
	const out: Signal[] = [];

	// js — só lê paths que estão no catálogo
	const jsKeys = new Set<string>();
	for (const t of catalog) {
		if (t.patterns.js) for (const k of Object.keys(t.patterns.js)) jsKeys.add(k);
	}
	for (const path of jsKeys) {
		const value = readDottedPath(win, path);
		if (value === undefined) continue;
		out.push({ kind: 'js', name: path, value: serializeJsValue(value) });
	}

	// meta — <meta name=X content=Y> e <meta property=X content=Y>
	const metas = doc.head?.querySelectorAll('meta') ?? [];
	for (const m of metas) {
		const name = m.getAttribute('name') ?? m.getAttribute('property');
		const content = m.getAttribute('content');
		if (name && content) out.push({ kind: 'meta', name, value: content });
	}

	// cookies — document.cookie (não-HttpOnly)
	for (const part of doc.cookie.split(';')) {
		const [k, ...rest] = part.trim().split('=');
		if (!k) continue;
		out.push({ kind: 'cookie', name: k, value: rest.join('=') });
	}

	// scriptSrc + scripts (inline) — DOM pass único
	for (const s of doc.querySelectorAll('script')) {
		const src = s.getAttribute('src');
		if (src) out.push({ kind: 'scriptSrc', value: src });
		else if (s.textContent) {
			out.push({ kind: 'script', value: s.textContent.slice(0, INLINE_SCRIPT_CAP) });
		}
	}

	// html — outerHTML capado
	const outer = doc.documentElement?.outerHTML;
	if (outer) out.push({ kind: 'html', value: outer.slice(0, HTML_CAP) });

	// text — body textContent capado
	const text = doc.body?.textContent;
	if (text) out.push({ kind: 'text', value: text.slice(0, TEXT_CAP) });

	// css — agrega cssText de stylesheets acessíveis
	let cssBuf = '';
	for (const ss of doc.styleSheets) {
		try {
			for (const rule of ss.cssRules) {
				cssBuf += rule.cssText;
				if (cssBuf.length >= CSS_CAP) break;
			}
		} catch {
			// cross-origin stylesheet — sem acesso, pula sem fabricar
		}
		if (cssBuf.length >= CSS_CAP) break;
	}
	if (cssBuf) out.push({ kind: 'css', value: cssBuf.slice(0, CSS_CAP) });

	// url — location.href
	out.push({ kind: 'url', value: win.location.href });

	return out;
}
```

## JS path traversal (`jsPath.ts`)

```ts
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
			return undefined; // proxies/getters podem throw
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
		return '<object>';
	}
}
```

## DOM evaluation (`domEval.ts`)

```ts
export function evaluateDomRules(catalog: CompiledTech[], doc: Document): TechHit[] {
	const out: TechHit[] = [];
	for (const tech of catalog) {
		if (!tech.patterns.dom) continue;
		const evidence: MatchEvidence[] = [];
		let totalConfidence = 0;
		let version: string | undefined;
		for (const rule of tech.patterns.dom) {
			if (evidence.length >= 8) break; // cap global por tech
			let els: NodeListOf<Element>;
			try {
				els = doc.querySelectorAll(rule.selector);
			} catch {
				continue; // selector inválido — pula sem fabricar
			}
			if (els.length === 0) continue;
			if (!rule.attributes && !rule.properties && !rule.text) {
				evidence.push({ signal: 'dom', pattern: rule.selector });
				totalConfidence += 100;
				continue;
			}
			for (const el of els) {
				if (evidence.length >= 8) break; // cap dentro do loop de elements
				const r = matchDomRuleAgainstElement(rule, el);
				if (!r) continue;
				evidence.push({ signal: 'dom', pattern: rule.selector, matchedName: r.matchedName });
				totalConfidence += r.confidence;
				if (!version && r.version) version = r.version;
			}
		}
		if (evidence.length === 0) continue;
		out.push({
			name: tech.name,
			cats: tech.cats,
			confidence: Math.min(100, totalConfidence),
			version,
			icon: tech.icon,
			website: tech.website,
			description: tech.description,
			evidence,
		});
	}
	return out;
}
```

`matchDomRuleAgainstElement` testa attributes (lê via `el.getAttribute`), properties (`el[propName]` com try/catch), text (`el.textContent`), reusando `expandVersion` da lib para captura de versão.

## Protocol changes

### `app/src/probe/protocol.ts`

```ts
import type { TechHit } from '@/lib/insights/types';

export interface ProbeMessage {
	ns: typeof PROBE_NAMESPACE;
	type: 'probe:detection' | 'probe:start-detection' | 'probe:idle';
	payload?: {
		url?: string;
		timestamp?: number;
		triggerType?: PageDetectionTrigger;
		fingerprint?: EnvironmentFingerprint; // legacy — mantido nesta fase
		techs?: TechHit[];                    // NOVO
	};
	reason?: PageDetectionTrigger;
}
```

### `app/src/lib/session/types.ts`

```ts
import type { TechHit } from '@/lib/insights/types';

export interface PageDetection {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint; // legacy
	techs?: TechHit[];                   // NOVO — opcional, ausente em sessões antigas
	triggerType: PageDetectionTrigger;
}
```

### `app/src/types/messages.ts`

```ts
payload?: {
	url: string;
	timestamp: number;
	triggerType: PageDetectionTrigger;
	fingerprint: EnvironmentFingerprint;
	techs?: TechHit[]; // NOVO
};
```

## Lifecycle no `probe/main.ts`

`emitDetection` ganha uma chamada a `detectTechs`:

```ts
import { detectTechs } from './detectors/wappalyzer';
// ...

function emitDetection(triggerType: PageDetectionTrigger): void {
	if (!active) return;
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:detection',
		payload: {
			url: location.href,
			timestamp: Date.now(),
			triggerType,
			fingerprint: buildFingerprint(),
			techs: detectTechs(window, document),
		},
	};
	window.postMessage(msg, location.origin);
}
```

`buildFingerprint()` continua chamando os 4 detectors legados — sem mudança. Probe roda detectores legados e o novo detector em sequência (paralelismo desnecessário; performance budget cabe).

## Error handling — princípio "no fallbacks"

Alinhado com `feedback_no_fallbacks` do projeto:

- `readDottedPath` getter throws → retorna `undefined` (sem inventar valor). Tech não ganha hit.
- `serializeJsValue` em circular/proxy throw → retorna `'<object>'` (sentinel intencional, não fingindo ser o valor real).
- `querySelectorAll` selector inválido throws → `continue` (sem inventar match).
- Cross-origin stylesheet `cssRules` throws → `continue` (catch silencioso porque é comportamento esperado do browser, não falha; documentado em comentário).
- Catálogo vazio (Sub-projeto 1 detectou erro) → `detectTechs` retorna `[]`. Probe payload tem `techs: []`. Não bloqueia a detecção legada.

## Tests

Vitest + jsdom (env default). Todos colocalizados em `__tests__/`.

| Arquivo | Cobertura |
|---|---|
| `jsPath.test.ts` | `readDottedPath` — caminho válido, undefined no meio, depth cap de 6, getter throw, função vs objeto, raiz null. `serializeJsValue` — string/num/bool/null/undefined/function/object/circular/proxy throw |
| `signals.test.ts` | jsdom doc com meta tags, cookies, scripts inline+src, body text, stylesheets. Assert que `collectMainWorldSignals` produz Signals esperados. Cap de HTML_CAP/TEXT_CAP/CSS_CAP testado com inputs grandes. Cross-origin stylesheet (mock que throws) é pulada sem erro. |
| `domEval.test.ts` | jsdom doc com elementos casando vários rules (exists-only, attributes regex, properties via `el.dataset`, text). Selector inválido (try/catch). Version captured via `expandVersion`. Evidence cap em 8. |
| `wappalyzer.test.ts` | Integração end-to-end: jsdom com WordPress markup → `detectTechs` retorna techs incluindo `WordPress` + `PHP` (implies). Shopify markup → `Shopify`. Next.js markup com `__NEXT_DATA__` global → `Next.js` + `React`. Reusa as 3 fixtures do Sub-projeto 1 mas reificadas em DOM real. |

Não testamos `main.ts emitDetection` diretamente — já há cobertura nos integration tests do session-replay. Apenas asseguramos via type-check que o payload extendido compila.

## Critérios de aceitação

- [ ] `app/src/probe/detectors/wappalyzer.ts` + `wappalyzer/{signals,domEval,jsPath}.ts` criados
- [ ] `__tests__/{wappalyzer,signals,domEval,jsPath}.test.ts` cobrem unitário + integração
- [ ] `probe/main.ts` chama `detectTechs(window, document)` e inclui no payload
- [ ] `probe/protocol.ts`, `lib/session/types.ts`, `types/messages.ts` extendidos com `techs?:` opcional
- [ ] Detectors legados (`framework.ts`/`libraries.ts`/`httpClients.ts`/`dataFetching.ts`) intactos
- [ ] `buildFingerprint()` continua produzindo o `EnvironmentFingerprint` legado completo
- [ ] `npm test` verde, `npm run lint` limpo, `npm run build` ok, `npx tsc --noEmit` clean
- [ ] Background processa `payload.fingerprint` legado sem erro (smoke test em integration existing)
- [ ] Bundle do `probe-main.js` cresce ≤30KB (catálogo + scorer inflados dentro)
- [ ] Live Insights drawer continua exibindo as 4 seções legadas (compat zero-impact UI)

## Pendências para sub-projetos seguintes

- **Sub-projeto 3:** background recebe `payload.techs`, persiste em sessão, broadcast para UI via `liveDetection` extendido.
- **Sub-projeto 4:** `LiveInsightsPanel` substitui as 4 seções por agrupamento por categoria Wappalyzer.
- **Cleanup PR (pós Sub-projeto 4):** remove `framework.ts`/`libraries.ts`/`httpClients.ts`/`dataFetching.ts`, simplifica `EnvironmentFingerprint` (remove framework/libraries/httpClients/dataFetching), remove campo `fingerprint` do payload do probe.

## Convenções aderentes ao projeto

- Indent: tabs, size 2 (biome).
- Comentários, strings de erro, console logs em pt-BR.
- TS strict.
- Sem fallback silencioso.
- Vitest com `globals: true`, jsdom env.
- Issues tracked via `bd`.
