# Live Insights — UI Redesign por Categorias Wappalyzer (Sub-projeto 4)

**Data:** 2026-05-03
**Status:** spec aprovada (aguardando revisão final do usuário)
**Escopo:** Sub-projeto 4 de 4 — fim da evolução Wappalyzer. Cleanup dos detectors legados fica em PR separada (post-mortem).
**Depende de:** Sub-projetos 1, 2 e 3 (já mergeados).
**bd:** chrome-extension-debug-buddy-6ov

---

## Contexto

Sub-projeto 1 entregou catálogo + Scorer. Sub-projeto 2 fez probe MAIN-world emitir `payload.techs[]`. Sub-projeto 3 fez background processar Fetch responses e mergear com probe-emitted techs, broadcastando `techsUpdates` (debounced 200ms). UI ainda renderiza as 4 seções legadas (Framework/Libraries/HTTP Clients/Data Fetching) — este sub-projeto substitui pelo agrupamento por categoria Wappalyzer.

Picker por host (do trabalho recente do bje/ndn) mantido. Recommendations intactas.

## Goals

- Listener em `LiveInsightsPanel` consome `message.techsUpdates` (incremental per-host updates)
- `getLiveSnapshot` reader extrai `detection.techs?` na hidratação
- Substitui `HostFramework` por `HostTechs` que agrupa techs por categoria Wappalyzer
- Helper puro `groupTechsByCategory(techs, categories)` retorna grupos ordenados por priority asc
- Componente reusable `TechItem` (nome + versão + confidence pill + tooltip descrição + link website)
- Componente `TechCategorySection` collapsible (top-3 expanded por default, resto collapsed)
- Confidence pill: high (≥75) / med (50-74) / low (<50) com cores semânticas
- Empty state quando host não tem techs detectadas
- Picker continua mostrando label informativo: ao invés de framework legado, exibe a tech principal por priority (CMS top, JS framework segundo, etc.)

## Non-goals

- Cleanup dos detectors legados (`framework.ts` etc.) — PR separada
- Remover `EnvironmentFingerprint` legacy fields — segundo PR
- Mudanças em probe ou background
- Persistência (sessão replay) — UI lê o que background broadcasta + getLiveSnapshot

## Arquitetura

**Arquivos novos:**
- `app/src/lib/insights/groupByCategory.ts` — helper puro
- `app/src/components/replay/TechItem.tsx` — componente single tech
- `app/src/components/replay/TechCategorySection.tsx` — wrapper de categoria
- Tests colocalizados

**Arquivos modificados:**
- `app/src/components/replay/LiveInsightsPanel.tsx`:
  - `LiveDetectionEntry` ganha `techs?: TechHit[]`
  - `HydrateSnapshot` ganha `techs?: TechHit[]` per detection
  - Reducer trata novo action `techsUpdate` (per-host techs replace)
  - Listener consome `msg.techsUpdates`
  - Hidratação consome `d.techs`
  - `HostFramework` substituído por `HostTechs` que renderiza categorias
  - Picker label deriva de `entry.techs` (tech de maior priority)

**Spec do helper:**

```ts
// app/src/lib/insights/groupByCategory.ts
import { CATEGORIES } from './catalog';
import type { CategoryMeta, TechHit } from './types';

export interface CategoryGroup {
	categoryId: number;
	categoryName: string;
	priority: number; // 1=alta, 9=baixa
	techs: TechHit[];
}

export function groupTechsByCategory(techs: TechHit[]): CategoryGroup[] {
	// Cada tech pode pertencer a múltiplas categorias. Para evitar duplicação
	// visual, atribuímos cada tech à PRIMEIRA categoria do seu cats[] (a
	// principal por convenção do schema Wappalyzer).
	const byCat = new Map<number, TechHit[]>();
	for (const tech of techs) {
		const primaryCat = tech.cats[0];
		if (primaryCat === undefined) continue;
		const arr = byCat.get(primaryCat) ?? [];
		arr.push(tech);
		byCat.set(primaryCat, arr);
	}
	const groups: CategoryGroup[] = [];
	for (const [catId, list] of byCat) {
		const meta = CATEGORIES[String(catId)];
		if (!meta) continue;
		groups.push({
			categoryId: catId,
			categoryName: meta.name,
			priority: meta.priority,
			techs: list.sort(byConfidenceDesc),
		});
	}
	groups.sort((a, b) => a.priority - b.priority || a.categoryName.localeCompare(b.categoryName));
	return groups;
}

function byConfidenceDesc(a: TechHit, b: TechHit): number {
	return b.confidence - a.confidence;
}
```

**Spec do TechItem:**

```tsx
interface Props { tech: TechHit; }

export function TechItem({ tech }: Props) {
	const confidence = tech.confidence >= 75 ? 'high' : tech.confidence >= 50 ? 'med' : 'low';
	return (
		<div className="flex items-center gap-1.5 ...">
			<Badge variant="default">{tech.name}</Badge>
			{tech.version && <span className="text-[10px] text-muted-foreground">{tech.version}</span>}
			{confidence !== 'high' && (
				<Badge variant="outline" className={confidenceClass(confidence)}>
					{confidence}
				</Badge>
			)}
			{tech.website && (
				<a href={tech.website} target="_blank" rel="noreferrer" className="...">
					↗
				</a>
			)}
		</div>
	);
}
```

Tooltip com descrição é opcional para esta primeira iteração (descrições podem ser longas; UI fica limpa sem). Adicionado em follow-up se desejado.

**Spec do TechCategorySection:**

```tsx
interface Props { group: CategoryGroup; defaultOpen?: boolean; }

export function TechCategorySection({ group, defaultOpen = false }: Props) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="border-b">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between px-3 py-2 ..."
			>
				<span className="font-medium text-xs">{group.categoryName}</span>
				<span className="text-[10px] text-muted-foreground">{group.techs.length}</span>
			</button>
			{open && (
				<div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
					{group.techs.map((t) => <TechItem key={t.name} tech={t} />)}
				</div>
			)}
		</section>
	);
}
```

**Spec do HostTechs (substitui HostFramework):**

```tsx
function HostTechs({ detection }: { detection: LiveDetectionEntry | null }) {
	if (!detection || !detection.techs || detection.techs.length === 0) {
		return (
			<p className="border-b px-3 py-3 text-muted-foreground text-xs">
				Nenhuma tecnologia detectada para este host ainda. Aguarde o próximo Fetch ou navegação SPA.
			</p>
		);
	}
	const groups = useMemo(() => groupTechsByCategory(detection.techs!), [detection.techs]);
	return (
		<div className="border-b">
			<div className="px-3 py-2">
				<p className="break-all font-mono text-[11px] text-muted-foreground" title={detection.url}>
					{detection.url}
				</p>
			</div>
			{groups.map((g, idx) => (
				<TechCategorySection key={g.categoryId} group={g} defaultOpen={idx < 3} />
			))}
		</div>
	);
}
```

**Reducer extensão:**

```ts
type PanelAction =
	| { type: 'detection'; payload: { host: string; entry: LiveDetectionEntry } }
	| { type: 'recommendation'; payload: Recommendation }
	| { type: 'clear' }
	| { type: 'hydrate'; snapshot: HydrateSnapshot }
	| { type: 'techsUpdate'; payload: { host: string; techs: TechHit[] } }; // NOVO

// case 'techsUpdate':
//   atualiza entry.techs do host preservando url/timestamp/fingerprint
```

Listener no `useEffect`:

```ts
if (msg.action === 'liveDetection') {
	if (msg.payload) {
		// Path legado: continua funcionando (Sub-projeto 4 não removeu o broadcast antigo)
		dispatch({ type: 'detection', payload: { ... } });
	}
	if (msg.techsUpdates) {
		for (const u of msg.techsUpdates) {
			dispatch({ type: 'techsUpdate', payload: u });
		}
	}
}
```

**Picker label:**

`HostPicker` atual deriva label do `fingerprint.framework`. Atualizar para usar a tech principal de `entry.techs` se disponível, fallback para framework:

```ts
function pickerLabel(entry: LiveDetectionEntry): string | null {
	if (entry.techs && entry.techs.length > 0) {
		// Tech de maior priority (categoria); ordenamos via groupTechsByCategory
		const groups = groupTechsByCategory(entry.techs);
		const top = groups[0]?.techs[0];
		if (top) return top.version ? `${top.name} ${top.version}` : top.name;
	}
	// Fallback legacy
	const fw = entry.fingerprint.framework;
	if (fw && fw.name !== 'vanilla') {
		return fw.version ? `${fw.name} ${fw.version}` : fw.name;
	}
	return null;
}
```

## Tests

| Arquivo | Cobertura |
|---|---|
| `lib/insights/__tests__/groupByCategory.test.ts` | techs em múltiplas cats usam apenas a primeira; ordem por priority asc; cat ausente do CATEGORIES é dropped; sort interno por confidence desc |
| `components/replay/__tests__/TechItem.test.tsx` | renderiza name; renderiza versão quando presente; pill de confidence só pra med/low; link website quando presente |
| `components/replay/__tests__/TechCategorySection.test.tsx` | renderiza header com count; toggle abre/fecha; defaultOpen=true mostra techs no mount |
| `components/replay/__tests__/LiveInsightsPanel.test.tsx` (modificado) | testes existentes continuam passando; novos: techsUpdate dispatch atualiza render; hidratação com d.techs renderiza; empty state quando techs=[]; picker label deriva da tech principal |

## Critérios de aceitação

- [ ] `app/src/lib/insights/groupByCategory.ts` + tests
- [ ] `app/src/components/replay/TechItem.tsx` + tests
- [ ] `app/src/components/replay/TechCategorySection.tsx` + tests
- [ ] `LiveInsightsPanel`:
  - `LiveDetectionEntry.techs?: TechHit[]`
  - reducer `techsUpdate` action
  - listener consome `msg.techsUpdates`
  - hidratação consome `d.techs`
  - `HostTechs` substitui `HostFramework`
  - picker label considera techs antes de fingerprint
- [ ] Tests existentes do LiveInsightsPanel passam (eventual ajuste pra novo render)
- [ ] `npm test` verde, `npm run lint` clean, `npm run build` ok, `npx tsc --noEmit` clean
- [ ] Detectors legados intactos (cleanup em PR separada)

## Convenções

Tabs, single quotes, biome, pt-BR comments, no fallbacks silenciosos, vitest globals, bd-tracked.
