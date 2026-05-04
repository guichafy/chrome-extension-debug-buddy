# Live Insights — Background Pipeline + Merge (Sub-projeto 3)

**Data:** 2026-05-03
**Status:** spec aprovada (aguardando revisão final do usuário)
**Escopo:** Sub-projeto 3 de 4.
**Depende de:** Sub-projetos 1 e 2 (lib + probe detector — já mergeados).
**bd:** chrome-extension-debug-buddy-d0x

---

## Contexto

Sub-projeto 1 entregou `app/src/lib/insights/` (catálogo + Scorer + applyImplications). Sub-projeto 2 fez probe MAIN-world emitir `payload.techs: TechHit[]` em cada `probe:detection`. Background hoje **ignora** esse campo — apenas o `payload.fingerprint` legado alimenta `detectionsByHost`.

Este sub-projeto ativa o background como segundo produtor de signals: cada `Fetch.requestPaused` (Response stage) tem headers/cookies/url/scriptSrc/xhr extraídos e empurrados para um per-host `Scorer`. As techs descobertas pelo background mergeiam com as techs que o probe emite, resultando num `detectionsByHost[host].techs` que reflete tudo o que se sabe sobre cada host visitado durante a sessão de interceptação.

UI continua intocada — Sub-projeto 4 consome o novo campo. Recommendations engine continua intacto.

## Goals

- `app/src/lib/insights/bgSignals.ts` — função pura `extractBackgroundSignals(intercepted: InterceptedResponse): Signal[]` cobrindo header/cookie/url/scriptSrc/xhr conforme `resourceType`
- `LiveDetectionEntry` ganha `techs: TechHit[]`
- `Map<number, Map<string, Scorer>>` (tabId → host → Scorer) paralelo a `liveSnapshotByTab`
- `handleRequestPaused` chama `extractBackgroundSignals` + `pushSignals` + `scheduleBroadcast` na host da request
- `pageDetected` handler mergeia `payload.techs` do probe na entrada do host top-frame antes do `updateLiveDetection`
- Após cada merge, `applyImplications` reaplica e `entry.techs` é atualizado
- Broadcast `liveDetection` debounced (200ms) carrega updates per host com techs
- `getLiveSnapshot` response inclui `techs?: TechHit[]` em cada detection
- Persistência de `PageDetection.techs` em sessões grava — ride-along automático (Sub-projeto 2 já preparou tipos)
- `clearLiveSnapshot(tabId)` limpa scorers junto

## Non-goals

- Mudanças na UI (`LiveInsightsPanel`) — Sub-projeto 4
- Remover detectors legados — cleanup pós Sub-projeto 4
- Mudar Recommendations engine
- Re-trabalho de migração de IndexedDB

## Arquitetura

### `app/src/lib/insights/bgSignals.ts` (novo)

```ts
import type { InterceptedResponse } from '@/types/intercepted';
import type { Signal } from './types';

export function extractBackgroundSignals(
	intercepted: InterceptedResponse,
): Signal[] {
	const out: Signal[] = [];

	// 1. URL — diferencia top-frame document, scriptSrc, xhr/fetch.
	// Outros resourceTypes (image/stylesheet/font/media) não geram signal —
	// catalog patterns desses kinds não casam URLs assim por design.
	const rt = (intercepted.type ?? '').toLowerCase();
	if (rt === 'script') {
		out.push({ kind: 'scriptSrc', value: intercepted.url });
	} else if (rt === 'xhr' || rt === 'fetch') {
		out.push({ kind: 'xhr', value: intercepted.url });
	} else if (rt === 'document') {
		out.push({ kind: 'url', value: intercepted.url });
	}

	// 2. Response headers — keys lowercased
	const headers = intercepted.response?.headers ?? intercepted.headers;
	if (headers) {
		for (const [k, v] of Object.entries(headers)) {
			out.push({ kind: 'header', name: k.toLowerCase(), value: v });
		}
	}

	// 3. Set-Cookie parsing — Chrome devtools entrega como string única
	// "name1=val1; Path=/, name2=val2" ou múltiplas linhas. Splitamos com
	// heurística conservadora.
	const setCookieRaw = headers?.['set-cookie'] ?? headers?.['Set-Cookie'];
	if (setCookieRaw) {
		for (const cookie of parseSetCookieHeader(setCookieRaw)) {
			out.push({ kind: 'cookie', name: cookie.name, value: cookie.value });
		}
	}

	return out;
}

interface ParsedCookie {
	name: string;
	value: string;
}

export function parseSetCookieHeader(raw: string): ParsedCookie[] {
	// CDP entrega Set-Cookie de várias formas: única string com '\n', ou
	// concatenado com ", " (rarely). Cuidamos do caso comum: split por '\n'
	// se houver, senão tratamos como cookie único.
	const lines = raw.includes('\n') ? raw.split('\n') : [raw];
	const out: ParsedCookie[] = [];
	for (const line of lines) {
		const first = line.split(';')[0]?.trim();
		if (!first) continue;
		const eq = first.indexOf('=');
		if (eq === -1) continue;
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		if (name) out.push({ name, value });
	}
	return out;
}
```

### `app/src/entrypoints/background.ts` (modificado)

**1. `LiveDetectionEntry` extendido:**

```ts
import type { TechHit } from '@/lib/insights/types';

interface LiveDetectionEntry {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	techs: TechHit[]; // NOVO — accumulado de probe + bg signals, com implications aplicadas
}
```

**2. Per-(tab,host) Scorer state:**

```ts
import { COMPILED_CATALOG } from '@/lib/insights/catalog';
import { applyImplications } from '@/lib/insights/implications';
import { Scorer } from '@/lib/insights/scorer';
import type { CompiledTech } from '@/lib/insights/types';

const scorersByTabHost = new Map<number, Map<string, Scorer>>();
const COMPILED_BY_NAME = new Map<string, CompiledTech>(
	COMPILED_CATALOG.map((t) => [t.name, t]),
);

function getOrCreateScorer(tabId: number, host: string): Scorer {
	let perHost = scorersByTabHost.get(tabId);
	if (!perHost) {
		perHost = new Map();
		scorersByTabHost.set(tabId, perHost);
	}
	let s = perHost.get(host);
	if (!s) {
		s = new Scorer(COMPILED_CATALOG);
		perHost.set(host, s);
	}
	return s;
}

function clearScorers(tabId: number): void {
	scorersByTabHost.delete(tabId);
}
```

**3. Hook em `handleRequestPaused`** (depois do `getResponseBody` + `persistRequest`, antes do `Fetch.continueRequest`):

```ts
const reqHost = extractHost(request.url);
if (reqHost && reqHost !== 'unknown' && targetTabId !== null) {
	const sigs = extractBackgroundSignals(intercepted);
	const scorer = getOrCreateScorer(targetTabId, reqHost);
	scorer.pushSignals(sigs);
	mergeAndUpdateHostTechs(targetTabId, reqHost, scorer.snapshot());
}
```

**4. Hook em `pageDetected` handler** (antes/em paralelo ao `updateLiveDetection`):

```ts
// dentro do case 'pageDetected':
const tabId = sender.tab?.id ?? interceptorTabId;
if (tabId && message.payload) {
	const host = extractHost(message.payload.url);
	if (message.payload.techs) {
		// Merge probe-emitted techs no Scorer do host como external matches.
		// Como Scorer.upsertHit é privado, mergemos via uma função helper que
		// constrói o map combinado e reaplica implications:
		mergeProbeTechs(tabId, host, message.payload.techs);
	}
	// ... fluxo existente: updateLiveDetection com fingerprint legado
}
```

**5. `mergeAndUpdateHostTechs(tabId, host, scorerHits)`** — merge final + reaplica implications + atualiza entry:

```ts
function mergeAndUpdateHostTechs(
	tabId: number,
	host: string,
	scorerHits: TechHit[],
): void {
	const snap = getOrInitLiveSnapshot(tabId);
	let entry = snap.detectionsByHost.get(host);
	if (!entry) {
		// Nenhum pageDetected ainda para este host — cria entrada placeholder.
		// Quando o probe emitir, fingerprint preenche.
		entry = {
			url: `https://${host}/`, // best-effort; será sobrescrito por updateLiveDetection
			timestamp: Date.now(),
			fingerprint: makeEmptyFingerprint(),
			techs: [],
		};
		snap.detectionsByHost.set(host, entry);
	}
	// Merge: scorer snapshot + techs já presentes (do probe path)
	const map = new Map<string, TechHit>(entry.techs.map((t) => [t.name, t]));
	for (const sh of scorerHits) {
		const ex = map.get(sh.name);
		if (!ex) {
			map.set(sh.name, sh);
			continue;
		}
		ex.confidence = Math.min(100, ex.confidence + sh.confidence);
		if (!ex.version && sh.version) ex.version = sh.version;
		for (const ev of sh.evidence) {
			if (ex.evidence.length >= 8) break;
			ex.evidence.push(ev);
		}
	}
	applyImplications(map, COMPILED_BY_NAME);
	entry.techs = [...map.values()];
	scheduleBroadcast(tabId, host);
}

function mergeProbeTechs(tabId: number, host: string, probeTechs: TechHit[]): void {
	// Mesma lógica de merge que mergeAndUpdateHostTechs mas sem rodar Scorer —
	// apenas mergeia probeTechs com o que está em entry.techs.
	const snap = getOrInitLiveSnapshot(tabId);
	let entry = snap.detectionsByHost.get(host);
	if (!entry) {
		entry = {
			url: `https://${host}/`,
			timestamp: Date.now(),
			fingerprint: makeEmptyFingerprint(),
			techs: [],
		};
		snap.detectionsByHost.set(host, entry);
	}
	const map = new Map<string, TechHit>(entry.techs.map((t) => [t.name, t]));
	for (const pt of probeTechs) {
		const ex = map.get(pt.name);
		if (!ex) {
			map.set(pt.name, pt);
			continue;
		}
		ex.confidence = Math.min(100, ex.confidence + pt.confidence);
		if (!ex.version && pt.version) ex.version = pt.version;
		for (const ev of pt.evidence) {
			if (ex.evidence.length >= 8) break;
			ex.evidence.push(ev);
		}
	}
	applyImplications(map, COMPILED_BY_NAME);
	entry.techs = [...map.values()];
	scheduleBroadcast(tabId, host);
}
```

**6. Broadcast debouncing:**

```ts
const dirtyHostsByTab = new Map<number, Set<string>>();
const broadcastTimers = new Map<number, ReturnType<typeof setTimeout>>();

function scheduleBroadcast(tabId: number, host: string): void {
	let dirty = dirtyHostsByTab.get(tabId);
	if (!dirty) {
		dirty = new Set();
		dirtyHostsByTab.set(tabId, dirty);
	}
	dirty.add(host);
	if (broadcastTimers.has(tabId)) return;
	const timer = setTimeout(() => {
		broadcastTimers.delete(tabId);
		flushBroadcast(tabId);
	}, 200);
	broadcastTimers.set(tabId, timer);
}

function flushBroadcast(tabId: number): void {
	const dirty = dirtyHostsByTab.get(tabId);
	if (!dirty || dirty.size === 0) return;
	const snap = liveSnapshotByTab.get(tabId);
	if (!snap) {
		dirty.clear();
		return;
	}
	const updates: Array<{ host: string; entry: LiveDetectionEntry }> = [];
	for (const host of dirty) {
		const entry = snap.detectionsByHost.get(host);
		if (entry) updates.push({ host, entry });
	}
	dirty.clear();
	if (updates.length === 0) return;
	broadcastToUI('liveDetection', { tabId, updates });
}
```

**7. `serializeLiveSnapshot` extendido** para incluir techs:

```ts
function serializeLiveSnapshot(snap: LiveSnapshot): {
	detections: Array<{
		host: string;
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[];
	}>;
	recommendations: Recommendation[];
} {
	const detections: Array<{
		host: string;
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[];
	}> = [];
	for (const [host, entry] of snap.detectionsByHost) {
		detections.unshift({
			host,
			url: entry.url,
			timestamp: entry.timestamp,
			fingerprint: entry.fingerprint,
			techs: entry.techs.length > 0 ? entry.techs : undefined,
		});
	}
	return { detections, recommendations: snap.recommendations };
}
```

**8. `clearLiveSnapshot(tabId)` limpa também os scorers e timers:**

```ts
function clearLiveSnapshot(tabId: number): void {
	liveSnapshotByTab.delete(tabId);
	clearScorers(tabId);
	const t = broadcastTimers.get(tabId);
	if (t) {
		clearTimeout(t);
		broadcastTimers.delete(tabId);
	}
	dirtyHostsByTab.delete(tabId);
}
```

**9. Tipos no broadcast (`liveDetection`):**

A action `liveDetection` agora carrega `updates: Array<{host, entry}>` em vez de `payload`. Atualizar `Message` em `app/src/types/messages.ts`:

```ts
// Em Message — campo opcional novo para o broadcast extendido:
updates?: Array<{
	host: string;
	entry: {
		url: string;
		timestamp: number;
		fingerprint: EnvironmentFingerprint;
		techs?: TechHit[];
	};
}>;
```

UI (Sub-projeto 4) consome `updates` diretamente. Listener atual de `liveDetection` que esperava `payload` continua funcionando porque ainda emitiremos a forma antiga em paralelo durante a transição? Não — o broadcast `liveDetection` mudou; UI atual ignora `updates` graciosamente (campo desconhecido). Existing `updateLiveDetection(tabId, entry)` call site continua emitindo o broadcast legado com `payload` — ou seja, o broadcast clássico permanece ativo, e o novo broadcast com `updates` é uma chamada separada. **Decisão:** mantemos o broadcast legado no formato antigo (UI atual o consome para o `LiveDetectionEntry`); adicionamos um novo campo `techsUpdates` opcional no mesmo `liveDetection` para Sub-projeto 4 ler.

```ts
// Refinamento: mantém compat com UI atual.
// liveDetection broadcast atual:
//   { action: 'liveDetection', tabId, payload: { url, timestamp, fingerprint } }
// Estendido:
//   { ..., techsUpdates?: Array<{ host, techs }> }

function flushBroadcast(tabId: number): void {
	const dirty = dirtyHostsByTab.get(tabId);
	if (!dirty || dirty.size === 0) return;
	const snap = liveSnapshotByTab.get(tabId);
	if (!snap) { dirty.clear(); return; }
	const techsUpdates: Array<{ host: string; techs: TechHit[] }> = [];
	for (const host of dirty) {
		const entry = snap.detectionsByHost.get(host);
		if (entry && entry.techs.length > 0) {
			techsUpdates.push({ host, techs: entry.techs });
		}
	}
	dirty.clear();
	if (techsUpdates.length === 0) return;
	broadcastToUI('liveDetection', { tabId, techsUpdates });
}
```

UI atual ignora `techsUpdates`. Sub-projeto 4 consome.

## Tests

| Arquivo | Cobertura |
|---|---|
| `lib/insights/__tests__/bgSignals.test.ts` | resourceType=document/script/xhr/fetch/image (sem signal); headers lowercased; `parseSetCookieHeader` single+multi-line+empty |
| `entrypoints/__tests__/background.bg-techs.test.ts` | Mocka chrome.debugger flow: `Fetch.requestPaused` com headers Cloudflare → `entry.techs` contém Cloudflare. Múltiplos events na mesma host accumulam. |
| `entrypoints/__tests__/background.merge-probe.test.ts` | `pageDetected` com `payload.techs=[Next.js]` + `Fetch.requestPaused` com headers cloudflare → `entry.techs` contém ambos + React (implies) |
| `entrypoints/__tests__/background.broadcast-debounce.test.ts` | 5 events em 50ms → 1 broadcast disparado; 5 events com 250ms entre eles → 5 broadcasts |
| `entrypoints/__tests__/background.clear-scorers.test.ts` | `clearLiveSnapshot(tabId)` limpa scorers + timers + dirtyHosts |

## Critérios de aceitação

- [ ] `app/src/lib/insights/bgSignals.ts` criado + testado
- [ ] `LiveDetectionEntry` extendido com `techs: TechHit[]`
- [ ] `scorersByTabHost` Map paralelo
- [ ] `handleRequestPaused` empurra signals server-side
- [ ] `pageDetected` mergeia `payload.techs` quando presente
- [ ] `mergeAndUpdateHostTechs` + `mergeProbeTechs` reaplicam implications
- [ ] `liveDetection` broadcast carrega `techsUpdates` (compat com UI atual via campo opcional)
- [ ] Debounce 200ms aplicado e testado
- [ ] `serializeLiveSnapshot` inclui techs
- [ ] `clearLiveSnapshot(tabId)` cobre scorers + timers + dirty
- [ ] Detectors legados, `EnvironmentFingerprint` legado, Recommendations engine intactos
- [ ] `npm test` verde, `npm run lint` clean, `npm run build` ok, `npx tsc --noEmit` clean

## Pendências para Sub-projeto 4

- UI consome `techsUpdates` em `liveDetection` listener
- UI lê `detection.techs` em `getLiveSnapshot` response
- UI substitui as 4 seções (Framework/Libraries/HTTP Clients/Data Fetching) por agrupamento por categoria Wappalyzer
- Cleanup PR: remove detectors legados, simplifica `EnvironmentFingerprint`, remove campo `fingerprint` do payload do probe

## Convenções

Tabs, single quotes, biome, pt-BR comments, no fallbacks silenciosos, vitest globals, bd-tracked.
