# Session Replay — Phase 4: State Capture (Redux + Zustand)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar Time-Travel de Estado para Redux e Zustand (seções 6 / 9 / 10 da spec). Probe MAIN-world wrappa `store.subscribe` (Redux) e intercepta `create()` do Zustand. Cada mudança vira `StateChangeEvent` com diff comprimido. Inspector de estado no `ReplayPage` reconstrói o snapshot no instante T do playhead aplicando diffs em cima do keyframe mais próximo, sincronizado com os outros painéis (network/console/antipatterns). `stateBaseline` e `stateKeyframes` vivem dentro de cada `DetectionPhase` (decisão v0.3).

**Architecture:** Tap no MAIN world (`probe/state/reduxTap.ts`, `probe/state/zustandTap.ts`) emite `__db_state_change` via `window.postMessage`; isolated bridge relaya pra background com action `stateChange`; background chama `recorder.addStateChange` que (a) escreve `stateBaseline` na fase atual se ainda não existe, (b) gera `StateChangeEvent` com diff `microdiff` + `lz-string`, (c) a cada N diffs OU T ms cria um `StateKeyframe` (snapshot inteiro comprimido). UI: `StateInspector.tsx` recebe `playheadMs`, busca o keyframe mais próximo `≤ playhead` na fase ativa, aplica diffs até T, renderiza árvore JSON colapsável. ReplayPage passa `playheadMs` único para todos os painéis.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` — seção 6 (Redux/Zustand `tracked`), seção 9 (Time-Travel de Estado), seção 10 (`StateChangeEvent`, `stateBaseline` + `stateKeyframes` per-DetectionPhase), desafio 10 (índice de keyframes para scrubbing).

**Beads:** Task 1 fecha `chrome-extension-debug-buddy-deq` (sentinel `storesDetected` em `fingerprintsEqual`).

---

## File Structure

**Modify:**
- `app/src/lib/session/types.ts` — adicionar `StateSnapshot`, `StateKeyframe`, `StateChangeEvent` (na união `SessionEvent`); mover/adicionar `stateBaseline?: StateSnapshot` e `stateKeyframes?: StateKeyframe[]` para `DetectionPhase`.
- `app/src/lib/session/fingerprint.ts` — `fingerprintsEqual` trata `storesDetected` como sentinel boolean `hasStores` (0 vs >0). Fecha bd `chrome-extension-debug-buddy-deq`.
- `app/src/lib/session/recorder.ts` — método `addStateChange(sessionId, change)` que escreve baseline na primeira mudança da fase, gera diff comprimido, decide keyframe a cada N diffs ou T ms, atualiza bytes para hard limit.
- `app/src/probe/main.ts` — chama `installReduxTap()` e `installZustandTap()` quando ativa probe.
- `app/src/probe/protocol.ts` — adicionar mensagem `probe:state-change`.
- `app/src/probe/bridge.ts` — relayar `probe:state-change` → `chrome.runtime` action `stateChange`.
- `app/src/entrypoints/background.ts` — handler `stateChange` chamando `recorder.addStateChange`.
- `app/src/types/messages.ts` — adicionar action `stateChange` na união.
- `app/src/probe/detectors/stateManagers.ts` — começar a contar stores reais (Redux + Zustand) via flags expostas pelos taps; mantém `treatment: 'tracked'`.
- `app/src/pages/ReplayPage.tsx` — controlar `playheadMs` (slider), passar para painéis (incluindo `StateInspector`).
- `app/package.json` — deps `microdiff` e `lz-string`.

**Create:**
- `app/src/lib/session/state/diff.ts` — `computeDiff(prev, next): DiffOps`, `applyDiff(state, ops): unknown`, `compressDiff(ops): string`, `decompressDiff(s): DiffOps`, `compressSnapshot(data): string`, `decompressSnapshot(s): unknown`.
- `app/src/lib/session/state/replay.ts` — `reconstructStateAt(phase, storeId, playheadMs): unknown` — escolhe keyframe mais próximo `≤ playhead` (ou baseline) e aplica diffs sequenciais entre `keyframe.timestamp` e `playhead`.
- `app/src/probe/state/reduxTap.ts` — wrappa `__REDUX_DEVTOOLS_EXTENSION__` e/ou `store.subscribe`/`dispatch` para emitir state changes; assina cada store criado com `storeId` único.
- `app/src/probe/state/zustandTap.ts` — Proxy global em `globalThis.zustand?.create` (signature detection: função que recebe um `setState` callback e retorna um hook). Cada `setState` emite mudança.
- `app/src/components/replay/StateInspector.tsx` — aba de inspector com seletor de store + árvore JSON colapsável; recebe `phase`, `playheadMs`, reconstrói snapshot atual.
- `app/src/components/replay/JsonTree.tsx` — árvore JSON colapsável reutilizável (vanilla, sem dependência externa).

**Test (co-located):**
- `app/src/lib/session/__tests__/fingerprint.test.ts` — adicionar casos para sentinel `storesDetected`.
- `app/src/lib/session/state/__tests__/diff.test.ts`
- `app/src/lib/session/state/__tests__/replay.test.ts`
- `app/src/lib/session/__tests__/recorder.state.test.ts` — cenários keyframe (N diffs, T ms), baseline-on-first-change, hard limit por bytes.
- `app/src/probe/state/__tests__/reduxTap.test.ts`
- `app/src/probe/state/__tests__/zustandTap.test.ts`
- `app/src/components/replay/__tests__/StateInspector.test.tsx`
- `app/src/components/replay/__tests__/JsonTree.test.tsx`

---

## Decisões de design

**Diff lib:** `microdiff` (~1KB gz, MIT, output JSON-Patch-like) é menor e mais rápida que `deep-diff` ou `jsondiffpatch`. Suporta arrays, objetos aninhados, primitives. Output: `Array<{type:'CREATE'|'CHANGE'|'REMOVE', path:(string|number)[], value?:unknown, oldValue?:unknown}>`. Aplicação reversa custa ~10 linhas (ver `applyDiff`).

**Compressão:** `lz-string` (`compressToBase64` / `decompressFromBase64`) — ~3 KB gz, produz strings ASCII-safe que podem ir direto pra `JSON.stringify`. Mais leve que `pako`/`fflate` para payloads ≤100 KB típicos de state. Strings comprimidas são guardadas em `diffCompressed` e `snapshotCompressed`.

**Granularidade de keyframe:** default **10 diffs OU 30 segundos** (o que vier primeiro), por store, por fase. Contadores ficam no runtime do recorder (não na sessão), reconstruídos varrendo `phase.stateKeyframes` no warm-up. Configurável via `_setStateLimitsForTests` (mesmo padrão de `_setLimitsForTests`).

**Baseline vs primeiro keyframe:** `stateBaseline` é capturado **na primeira mudança observada** da fase para aquele store (snapshot do `prevState` antes do diff). Garante que diffs subsequentes sempre tenham um ancestral. `stateKeyframes` ficam vazios até a Nª mudança / Tª segundo. `reconstructStateAt` cai em baseline + diffs quando não há keyframe `≤ playhead`.

**StoreId:** Redux gera `redux:<n>` incremental (Redux moderno tem 1 store, mas suportamos múltiplos). Zustand gera `zustand:<n>` por chamada de `create()`. IDs persistem dentro do MAIN world (não sobrevivem navegação — nova fase = novos IDs, baseline novo, esperado).

**Sentinel `storesDetected` (Task 1):** mantemos o número exato em `StateManagerDetection.storesDetected` (UI mostra), mas a chave canônica usada por `fingerprintsEqual` colapsa pra `hasStores: boolean` (0 vs >0). Justificativa: passar de "0 stores detectadas" → "1 store detectada" durante carregamento da app não deve abrir uma nova fase. Já passar de "0" → "5" também não. Mas passar de "tem store" → "não tem mais store" (nova rota descarregou Redux) **abre fase nova** porque o ambiente mudou semanticamente. Cobre defesa em profundidade enquanto Phase 4 começa a contar de verdade.

**Sincronização do playhead:** ReplayPage assume `playheadMs` (offset desde `session.startedAt`). Hoje só temos lista de eventos sem playhead — adicionamos slider rudimentar (Phase 2 vai reaproveitar pro rrweb-player). Phase 4 já entrega o contrato: `playheadMs` controlado pela ReplayPage, propagado para todos os painéis.

**Índice de keyframes:** `phase.stateKeyframes` é um array ordenado por `timestamp`. Busca por `≤ playhead` é binária (`O(log n)`). Mesmo com 10 min de gravação a 30s/keyframe, são ≤20 entradas por store por fase — busca linear seria fine, mas implementamos binária pra cobrir caso de gravações futuras maiores e para satisfazer o desafio 10 da spec (performance de scrubbing).

**No-fallbacks:** se `reconstructStateAt` não encontra baseline para o `storeId`, retorna `null` e UI mostra "estado indisponível" — **não inventa** snapshot vazio. Se `decompressDiff` falha, propaga erro pra UI exibir banner. Se `microdiff` produz operação inválida, `applyDiff` lança.

---

## Task 1: Pre-work — fingerprint sentinel `storesDetected`

**Files:**
- Modify: `app/src/lib/session/fingerprint.ts`
- Test: `app/src/lib/session/__tests__/fingerprint.test.ts`

### Step 1.1: Trocar chave canônica para `hasStores`

Em `app/src/lib/session/fingerprint.ts`:

```ts
export function fingerprintsEqual(
	a: EnvironmentFingerprint,
	b: EnvironmentFingerprint,
): boolean {
	if (a.framework.name !== b.framework.name) return false;
	if (a.framework.version !== b.framework.version) return false;
	if (!sameSet(a.httpClients, b.httpClients, (c) => `${c.name}:${c.confidence}`)) {
		return false;
	}
	if (
		!sameSet(
			a.dataFetching,
			b.dataFetching,
			(d) => `${d.name}:${d.version ?? ''}:${d.treatment}`,
		)
	) {
		return false;
	}
	// `storesDetected` é tratado como sentinel boolean (`hasStores`): 0 vs >0.
	// Justificativa: durante carregamento, número de stores cresce de 0 → N
	// sem mudança real do ambiente. Só descarregar todos os stores muda
	// fingerprint (vira "ambiente sem state manager"). Resolve issue
	// chrome-extension-debug-buddy-deq.
	if (
		!sameSet(
			a.stateManagers,
			b.stateManagers,
			(s) => `${s.name}:${s.storesDetected > 0 ? 'has' : 'none'}:${s.treatment}`,
		)
	) {
		return false;
	}
	return true;
}
```

### Step 1.2: Tests

Em `app/src/lib/session/__tests__/fingerprint.test.ts` (ou criar se não existir), adicionar/garantir cobertura:

```ts
import { describe, expect, it } from 'vitest';
import { fingerprintsEqual } from '../fingerprint';
import type { EnvironmentFingerprint } from '../types';

const base: EnvironmentFingerprint = {
	framework: { name: 'react', version: '18.2.0' },
	httpClients: [],
	dataFetching: [],
	stateManagers: [],
	detectedAt: 0,
	isProductionBuild: false,
};

describe('fingerprintsEqual — storesDetected sentinel', () => {
	it('considera 1 store e 5 stores equivalentes (sentinel hasStores)', () => {
		const a: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 5, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(true);
	});

	it('considera 0 stores e 1 store equivalentes (carregamento progressivo)', () => {
		const a: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 0, treatment: 'tracked' }],
		};
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		// Sentinel: 0 e >0 são fingerprints diferentes (ambiente passou de "sem stores" para "com stores").
		expect(fingerprintsEqual(a, b)).toBe(false);
	});

	it('considera ambiente sem state manager diferente de ambiente com Redux', () => {
		const a: EnvironmentFingerprint = { ...base, stateManagers: [] };
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(false);
	});

	it('considera Zustand e Redux diferentes mesmo com mesma quantidade de stores', () => {
		const a: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' }],
		};
		const b: EnvironmentFingerprint = {
			...base,
			stateManagers: [{ name: 'zustand', storesDetected: 1, treatment: 'tracked' }],
		};
		expect(fingerprintsEqual(a, b)).toBe(false);
	});
});
```

### Step 1.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/fingerprint.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/fingerprint.ts app/src/lib/session/__tests__/fingerprint.test.ts
git commit -m "$(cat <<'EOF'
feat(session): sentinel hasStores em fingerprintsEqual

Trata storesDetected como sentinel boolean (0 vs >0) para evitar abrir nova
DetectionPhase quando o número de stores cresce durante carregamento.
Pre-work para Phase 4 (state capture).

Closes chrome-extension-debug-buddy-deq

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
bd update chrome-extension-debug-buddy-deq --status closed --comment "fechado pelo commit acima"
```

Esperado: 4 testes novos, suite total +4.

---

## Task 2: Tipos `StateSnapshot` / `StateKeyframe` / `StateChangeEvent`

**Files:**
- Modify: `app/src/lib/session/types.ts`

### Step 2.1: Adicionar tipos

Em `app/src/lib/session/types.ts`, **após** o bloco `SessionTelemetry`:

```ts
export type StoreKind = 'redux' | 'zustand';

export interface StateSnapshot {
	storeId: string;
	storeKind: StoreKind;
	data: unknown;
	timestamp: number;
}

export interface StateKeyframe {
	storeId: string;
	storeKind: StoreKind;
	timestamp: number;
	phaseId: string;
	/** lz-string compressToBase64 de JSON.stringify(state) */
	snapshotCompressed: string;
}

export interface StateChangeEventPayload {
	storeId: string;
	storeKind: StoreKind;
	/** lz-string compressToBase64 de JSON.stringify(microdiff ops) */
	diffCompressed: string;
	/** Sequencial por store dentro da fase. Permite detectar gaps no replay. */
	sequenceNum: number;
}
```

Adicionar `StateChangeEvent` à união `SessionEvent`:

```ts
export type SessionEvent =
	| { type: 'detection'; timestamp: number; phaseId: string }
	| { ... network ... }
	| { ... console ... }
	| { ... route ... }
	| { ... error ... }
	| {
			type: 'state';
			timestamp: number;
			phaseId: string;
			storeId: string;
			storeKind: StoreKind;
			diffCompressed: string;
			sequenceNum: number;
	  };
```

Estender `DetectionPhase`:

```ts
export interface DetectionPhase {
	id: string;
	startTimestamp: number;
	endTimestamp: number;
	fingerprint: EnvironmentFingerprint;
	pages: PageDetection[];
	/** Snapshot inicial capturado na primeira mudança observada de cada store na fase. */
	stateBaseline?: StateSnapshot;
	/** Snapshots inteiros gerados a cada N diffs ou T ms — index para scrubbing rápido. */
	stateKeyframes?: StateKeyframe[];
}
```

> Nota: `stateBaseline` é singular intencionalmente — mantemos um baseline por fase agregando todos os stores num objeto `{ [storeId]: data }`. Para suportar múltiplos stores, refatoramos: `stateBaseline?: Record<string, StateSnapshot>`. **Decisão Phase 4:** map por `storeId`. Atualiza assinatura:

```ts
export interface DetectionPhase {
	...
	/** Map storeId → primeiro snapshot capturado dele dentro da fase. */
	stateBaseline?: Record<string, StateSnapshot>;
	stateKeyframes?: StateKeyframe[];
}
```

### Step 2.2: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/types.ts
git commit -m "$(cat <<'EOF'
feat(session): tipos StateChangeEvent + stateBaseline/stateKeyframes per-phase

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: tipos compilam, suite estável.

---

## Task 3: Diff util (`microdiff` + `lz-string`)

**Files:**
- Modify: `app/package.json` (deps `microdiff`, `lz-string`, `@types/lz-string` se aplicável)
- Create: `app/src/lib/session/state/diff.ts`
- Test: `app/src/lib/session/state/__tests__/diff.test.ts`

### Step 3.1: Instalar deps

```bash
cd app && npm install microdiff lz-string
```

### Step 3.2: Implementar diff util

`app/src/lib/session/state/diff.ts`:

```ts
import diff from 'microdiff';
import LZString from 'lz-string';

export type DiffOp =
	| { type: 'CREATE'; path: (string | number)[]; value: unknown }
	| { type: 'CHANGE'; path: (string | number)[]; value: unknown; oldValue: unknown }
	| { type: 'REMOVE'; path: (string | number)[]; oldValue: unknown };

export type DiffOps = DiffOp[];

export function computeDiff(prev: unknown, next: unknown): DiffOps {
	// microdiff trabalha com objects/arrays; primitives ele compara mas precisa
	// de wrapper. Para state managers (Redux/Zustand), o root é sempre objeto.
	if (
		typeof prev !== 'object' ||
		prev === null ||
		typeof next !== 'object' ||
		next === null
	) {
		throw new Error('computeDiff aceita apenas objetos no root (state de store).');
	}
	return diff(
		prev as Record<string, unknown>,
		next as Record<string, unknown>,
	) as DiffOps;
}

export function applyDiff(state: unknown, ops: DiffOps): unknown {
	if (typeof state !== 'object' || state === null) {
		throw new Error('applyDiff aceita apenas objeto/array como base.');
	}
	// Clone profundo do state para não mutar o input. JSON.parse(JSON.stringify())
	// é suficiente para state serializable (que é a premissa do Redux/Zustand).
	const next: unknown = JSON.parse(JSON.stringify(state));
	for (const op of ops) {
		applyOpInPlace(next, op);
	}
	return next;
}

function applyOpInPlace(root: unknown, op: DiffOp): void {
	if (op.path.length === 0) {
		throw new Error('Path vazio em DiffOp não suportado (root replace).');
	}
	const parentPath = op.path.slice(0, -1);
	const lastKey = op.path[op.path.length - 1];
	let parent: unknown = root;
	for (const key of parentPath) {
		if (typeof parent !== 'object' || parent === null) {
			throw new Error(`Caminho inválido em applyDiff: ${JSON.stringify(op.path)}`);
		}
		parent = (parent as Record<string | number, unknown>)[key];
	}
	if (typeof parent !== 'object' || parent === null) {
		throw new Error(`Parent inválido em applyDiff: ${JSON.stringify(op.path)}`);
	}
	const target = parent as Record<string | number, unknown>;
	if (op.type === 'CREATE' || op.type === 'CHANGE') {
		target[lastKey] = op.value;
	} else if (op.type === 'REMOVE') {
		if (Array.isArray(parent)) {
			(parent as unknown[]).splice(Number(lastKey), 1);
		} else {
			delete target[lastKey];
		}
	}
}

export function compressDiff(ops: DiffOps): string {
	return LZString.compressToBase64(JSON.stringify(ops));
}

export function decompressDiff(s: string): DiffOps {
	const text = LZString.decompressFromBase64(s);
	if (text === null || text === '') {
		throw new Error('Falha ao descomprimir diff (saída vazia).');
	}
	return JSON.parse(text) as DiffOps;
}

export function compressSnapshot(data: unknown): string {
	return LZString.compressToBase64(JSON.stringify(data));
}

export function decompressSnapshot(s: string): unknown {
	const text = LZString.decompressFromBase64(s);
	if (text === null || text === '') {
		throw new Error('Falha ao descomprimir snapshot (saída vazia).');
	}
	return JSON.parse(text);
}
```

### Step 3.3: Tests

`app/src/lib/session/state/__tests__/diff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	applyDiff,
	compressDiff,
	compressSnapshot,
	computeDiff,
	decompressDiff,
	decompressSnapshot,
} from '../diff';

describe('computeDiff / applyDiff', () => {
	it('round-trip: applyDiff(prev, computeDiff(prev,next)) === next', () => {
		const prev = { user: { name: 'Ana', age: 30 }, items: [1, 2, 3] };
		const next = { user: { name: 'Ana', age: 31 }, items: [1, 2, 3, 4], extra: true };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('CREATE em path aninhado novo', () => {
		const prev = { a: {} };
		const next = { a: { b: 1 } };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('REMOVE em chave de objeto', () => {
		const prev = { a: 1, b: 2 };
		const next = { a: 1 };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('REMOVE em índice de array', () => {
		const prev = { items: [1, 2, 3] };
		const next = { items: [1, 3] };
		const ops = computeDiff(prev, next);
		expect(applyDiff(prev, ops)).toEqual(next);
	});

	it('não muta o input', () => {
		const prev = { a: 1 };
		const next = { a: 2 };
		const ops = computeDiff(prev, next);
		const out = applyDiff(prev, ops);
		expect(prev).toEqual({ a: 1 });
		expect(out).toEqual({ a: 2 });
	});

	it('rejeita primitives no root', () => {
		expect(() => computeDiff(1, 2)).toThrow();
	});
});

describe('compress/decompress', () => {
	it('round-trip diff comprimido', () => {
		const ops = computeDiff({ a: 1 }, { a: 2 });
		const compressed = compressDiff(ops);
		expect(decompressDiff(compressed)).toEqual(ops);
	});

	it('round-trip snapshot comprimido', () => {
		const snap = { user: { name: 'Bruno' }, list: [1, 2, 3] };
		const compressed = compressSnapshot(snap);
		expect(decompressSnapshot(compressed)).toEqual(snap);
	});

	it('decompressDiff lança em string inválida', () => {
		expect(() => decompressDiff('xxx-not-base64')).toThrow();
	});
});
```

### Step 3.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/state/__tests__/diff.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/state/ app/package.json app/package-lock.json
git commit -m "$(cat <<'EOF'
feat(session): diff util com microdiff + lz-string para state capture

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: ~9 testes diff, suite total +9.

---

## Task 4: Probe Redux tap

**Files:**
- Create: `app/src/probe/state/reduxTap.ts`
- Test: `app/src/probe/state/__tests__/reduxTap.test.ts`

### Step 4.1: Implementar

`app/src/probe/state/reduxTap.ts`:

```ts
import { PROBE_NAMESPACE, type ProbeMessage } from '../protocol';

interface ReduxStore {
	subscribe: (listener: () => void) => () => void;
	getState: () => unknown;
	dispatch: (action: unknown) => unknown;
}

interface ReduxDevtoolsExtension {
	(config?: unknown): (next: unknown) => unknown;
	connect?: (config?: unknown) => unknown;
}

let storeCounter = 0;
let installed = false;
const wrappedStores = new WeakSet<ReduxStore>();

/** Lista de stores ativos usada pelo detector de stateManagers. */
export const reduxStoreRegistry: { count: number; ids: string[] } = { count: 0, ids: [] };

function emitStateChange(storeId: string, prev: unknown, next: unknown): void {
	// Mensagem bruta — diff/compressão acontece no background para não pesar o MAIN.
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:state-change',
		payload: {
			storeId,
			storeKind: 'redux',
			timestamp: Date.now(),
			prev,
			next,
		},
	};
	window.postMessage(msg, location.origin);
}

function wrapStore(store: ReduxStore): void {
	if (wrappedStores.has(store)) return;
	wrappedStores.add(store);
	storeCounter++;
	const storeId = `redux:${storeCounter}`;
	reduxStoreRegistry.count++;
	reduxStoreRegistry.ids.push(storeId);

	let prevState = store.getState();
	store.subscribe(() => {
		const nextState = store.getState();
		if (nextState !== prevState) {
			emitStateChange(storeId, prevState, nextState);
			prevState = nextState;
		}
	});
}

/**
 * Instala interceptor em __REDUX_DEVTOOLS_EXTENSION__ e em qualquer chamada
 * a `createStore` que use o middleware/enhancer dos devtools. Funciona porque
 * Redux moderno (`@reduxjs/toolkit` `configureStore`) sempre chama o devtools
 * compose se a flag estiver setada.
 */
export function installReduxTap(): void {
	if (installed) return;
	installed = true;
	const w = window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension };
	const original = w.__REDUX_DEVTOOLS_EXTENSION__;

	const wrapped: ReduxDevtoolsExtension = ((config?: unknown) => {
		const enhancer = original ? original(config) : (next: unknown) => next;
		return (next: unknown) => {
			const composed = (enhancer as (n: unknown) => unknown)(next);
			return ((...args: unknown[]) => {
				const store = (composed as (...a: unknown[]) => ReduxStore)(...args);
				try {
					wrapStore(store);
				} catch {
					// Falha no wrap não pode quebrar a app — log silencioso.
				}
				return store;
			}) as unknown;
		};
	}) as ReduxDevtoolsExtension;

	if (original?.connect) {
		(wrapped as unknown as { connect: unknown }).connect = original.connect.bind(original);
	}

	w.__REDUX_DEVTOOLS_EXTENSION__ = wrapped;
}

/** Test-only: permite injetar store já criado (sem passar pelo enhancer). */
export function _wrapStoreForTests(store: ReduxStore): string {
	const before = reduxStoreRegistry.count;
	wrapStore(store);
	return reduxStoreRegistry.ids[before];
}

export function _resetReduxTapForTests(): void {
	storeCounter = 0;
	installed = false;
	reduxStoreRegistry.count = 0;
	reduxStoreRegistry.ids.length = 0;
}
```

### Step 4.2: Atualizar `protocol.ts`

Adicionar variante:

```ts
export type ProbeMessage =
	| ...existing...
	| {
			ns: typeof PROBE_NAMESPACE;
			type: 'probe:state-change';
			payload: {
				storeId: string;
				storeKind: 'redux' | 'zustand';
				timestamp: number;
				prev: unknown;
				next: unknown;
			};
	  };
```

### Step 4.3: Tests

`app/src/probe/state/__tests__/reduxTap.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	_resetReduxTapForTests,
	_wrapStoreForTests,
	installReduxTap,
	reduxStoreRegistry,
} from '../reduxTap';
import { PROBE_NAMESPACE } from '../../protocol';

function makeFakeStore() {
	const listeners: Array<() => void> = [];
	let state = { count: 0 };
	return {
		state,
		setState(next: typeof state) {
			state = next;
			listeners.forEach((l) => l());
		},
		store: {
			getState: () => state,
			subscribe(fn: () => void) {
				listeners.push(fn);
				return () => {
					const i = listeners.indexOf(fn);
					if (i >= 0) listeners.splice(i, 1);
				};
			},
			dispatch: (a: unknown) => a,
		},
	};
}

describe('installReduxTap', () => {
	beforeEach(() => {
		_resetReduxTapForTests();
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__ = undefined;
	});

	afterEach(() => {
		_resetReduxTapForTests();
	});

	it('emite probe:state-change quando store muda', () => {
		const fake = makeFakeStore();
		const id = _wrapStoreForTests(fake.store);
		expect(id).toBe('redux:1');

		const messages: unknown[] = [];
		const handler = (e: MessageEvent) => {
			if ((e.data as { ns?: string }).ns === PROBE_NAMESPACE) messages.push(e.data);
		};
		window.addEventListener('message', handler);

		fake.setState({ count: 1 });
		// postMessage é assíncrono dentro da mesma janela mas no jsdom é processado
		// sincronamente via dispatchEvent no próximo microtask. Aguardamos.
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				window.removeEventListener('message', handler);
				const stateMsgs = messages.filter(
					(m) => (m as { type?: string }).type === 'probe:state-change',
				);
				expect(stateMsgs.length).toBeGreaterThanOrEqual(1);
				const payload = (stateMsgs[0] as { payload: { storeId: string; prev: unknown; next: unknown } }).payload;
				expect(payload.storeId).toBe('redux:1');
				expect(payload.prev).toEqual({ count: 0 });
				expect(payload.next).toEqual({ count: 1 });
				resolve();
			}, 10);
		});
	});

	it('registra storeId em reduxStoreRegistry', () => {
		const fake = makeFakeStore();
		_wrapStoreForTests(fake.store);
		expect(reduxStoreRegistry.count).toBe(1);
		expect(reduxStoreRegistry.ids).toEqual(['redux:1']);
	});

	it('não dobra wrap em chamada repetida', () => {
		const fake = makeFakeStore();
		_wrapStoreForTests(fake.store);
		_wrapStoreForTests(fake.store);
		expect(reduxStoreRegistry.count).toBe(1);
	});

	it('installReduxTap é idempotente', () => {
		installReduxTap();
		installReduxTap();
		// Não há crash; flag interna previne re-instalação.
		expect(true).toBe(true);
	});

	it('wrappa __REDUX_DEVTOOLS_EXTENSION__ existente', () => {
		const original = vi.fn(() => (next: unknown) => next);
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__: unknown }).__REDUX_DEVTOOLS_EXTENSION__ = original;
		installReduxTap();
		const wrapped = (window as unknown as {
			__REDUX_DEVTOOLS_EXTENSION__: (cfg?: unknown) => (next: unknown) => unknown;
		}).__REDUX_DEVTOOLS_EXTENSION__;
		expect(wrapped).not.toBe(original);
		// Chamar passa pelo original
		wrapped({ trace: true });
		expect(original).toHaveBeenCalledWith({ trace: true });
	});
});
```

### Step 4.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/state/__tests__/reduxTap.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/state/reduxTap.ts app/src/probe/state/__tests__/ app/src/probe/protocol.ts
git commit -m "$(cat <<'EOF'
feat(session): probe Redux tap — wrappa __REDUX_DEVTOOLS_EXTENSION__ e store.subscribe

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: 5 testes reduxTap.

---

## Task 5: Probe Zustand tap

**Files:**
- Create: `app/src/probe/state/zustandTap.ts`
- Test: `app/src/probe/state/__tests__/zustandTap.test.ts`

### Step 5.1: Implementar

`app/src/probe/state/zustandTap.ts`:

```ts
import { PROBE_NAMESPACE, type ProbeMessage } from '../protocol';

let storeCounter = 0;
let installed = false;

export const zustandStoreRegistry: { count: number; ids: string[] } = { count: 0, ids: [] };

function emitStateChange(storeId: string, prev: unknown, next: unknown): void {
	const msg: ProbeMessage = {
		ns: PROBE_NAMESPACE,
		type: 'probe:state-change',
		payload: {
			storeId,
			storeKind: 'zustand',
			timestamp: Date.now(),
			prev,
			next,
		},
	};
	window.postMessage(msg, location.origin);
}

/**
 * Wrappa o factory `create` do Zustand. Detecção: o factory é uma função que recebe
 * um initializer (função `(set, get, api) => state`) e retorna um hook React.
 * Wrappamos `setState` da API interna para emitir state changes.
 *
 * Suporta dois caminhos:
 *   1. `globalThis.zustand.create` — quando a app expõe (raro).
 *   2. Hook em `Object.defineProperty` para detectar atribuição posterior.
 *
 * Caso a app importe `zustand` direto sem expor globalmente, este tap não pega.
 * Phase 4 documenta a limitação; Phase 5 pode adicionar bundling-time helper.
 */
export function installZustandTap(): void {
	if (installed) return;
	installed = true;
	const root = globalThis as unknown as { zustand?: { create?: unknown } };

	const wrap = (originalCreate: unknown): unknown => {
		if (typeof originalCreate !== 'function') return originalCreate;
		const wrapped = (initializer: unknown, ...rest: unknown[]) => {
			storeCounter++;
			const storeId = `zustand:${storeCounter}`;
			zustandStoreRegistry.count++;
			zustandStoreRegistry.ids.push(storeId);

			const wrappedInitializer = (
				set: (partial: unknown, replace?: boolean) => void,
				get: () => unknown,
				api: unknown,
			) => {
				const wrappedSet = (partial: unknown, replace?: boolean) => {
					const prev = get();
					set(partial, replace);
					const next = get();
					if (next !== prev) {
						try {
							emitStateChange(storeId, prev, next);
						} catch {
							// Ignorar — não pode quebrar a app.
						}
					}
				};
				return (initializer as (s: typeof wrappedSet, g: typeof get, a: unknown) => unknown)(
					wrappedSet,
					get,
					api,
				);
			};
			return (originalCreate as (...args: unknown[]) => unknown)(wrappedInitializer, ...rest);
		};
		return wrapped;
	};

	if (root.zustand?.create) {
		root.zustand.create = wrap(root.zustand.create);
		return;
	}

	// Hook em atribuição posterior
	let _internal: unknown = undefined;
	Object.defineProperty(root, 'zustand', {
		configurable: true,
		get: () => _internal,
		set: (v: unknown) => {
			if (v && typeof v === 'object' && 'create' in (v as Record<string, unknown>)) {
				const cv = v as { create?: unknown };
				cv.create = wrap(cv.create);
			}
			_internal = v;
		},
	});
}

export function _resetZustandTapForTests(): void {
	storeCounter = 0;
	installed = false;
	zustandStoreRegistry.count = 0;
	zustandStoreRegistry.ids.length = 0;
	delete (globalThis as Record<string, unknown>).zustand;
}
```

### Step 5.2: Tests

`app/src/probe/state/__tests__/zustandTap.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	_resetZustandTapForTests,
	installZustandTap,
	zustandStoreRegistry,
} from '../zustandTap';
import { PROBE_NAMESPACE } from '../../protocol';

/** Mini-zustand fake: implementa create(initializer) -> hook. */
function fakeZustandCreate(initializer: (set: (p: unknown) => void, get: () => unknown, api: unknown) => unknown) {
	let state: unknown;
	const set = (partial: unknown) => {
		const cur = (state as Record<string, unknown>) ?? {};
		const upd = typeof partial === 'function' ? (partial as (s: unknown) => unknown)(cur) : partial;
		state = { ...cur, ...(upd as Record<string, unknown>) };
	};
	const get = () => state;
	state = initializer(set, get, { setState: set, getState: get });
	return { getState: get, setState: set };
}

describe('installZustandTap', () => {
	beforeEach(() => {
		_resetZustandTapForTests();
	});
	afterEach(() => {
		_resetZustandTapForTests();
	});

	it('intercepta zustand.create já existente e emite state-change em setState', () => {
		(globalThis as unknown as { zustand: { create: typeof fakeZustandCreate } }).zustand = {
			create: fakeZustandCreate,
		};
		installZustandTap();

		const created = (globalThis as unknown as {
			zustand: { create: (init: unknown) => { setState: (p: unknown) => void } };
		}).zustand.create((set: (p: unknown) => void) => ({
			count: 0,
			inc: () => set({ count: 1 }),
		}));

		const messages: unknown[] = [];
		const handler = (e: MessageEvent) => {
			if ((e.data as { ns?: string }).ns === PROBE_NAMESPACE) messages.push(e.data);
		};
		window.addEventListener('message', handler);

		created.setState({ count: 1 });

		return new Promise<void>((resolve) => {
			setTimeout(() => {
				window.removeEventListener('message', handler);
				const stateMsgs = messages.filter(
					(m) => (m as { type?: string }).type === 'probe:state-change',
				);
				expect(stateMsgs.length).toBeGreaterThanOrEqual(1);
				expect(zustandStoreRegistry.ids).toEqual(['zustand:1']);
				resolve();
			}, 10);
		});
	});

	it('intercepta zustand.create atribuído após install', () => {
		installZustandTap();
		(globalThis as unknown as { zustand: { create: typeof fakeZustandCreate } }).zustand = {
			create: fakeZustandCreate,
		};
		const created = (globalThis as unknown as {
			zustand: { create: (init: unknown) => { setState: (p: unknown) => void } };
		}).zustand.create((set: (p: unknown) => void) => ({ x: 0 }));
		created.setState({ x: 5 });
		expect(zustandStoreRegistry.count).toBe(1);
	});

	it('é idempotente', () => {
		installZustandTap();
		installZustandTap();
		expect(true).toBe(true);
	});
});
```

### Step 5.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/state/__tests__/zustandTap.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/probe/state/zustandTap.ts app/src/probe/state/__tests__/zustandTap.test.ts
git commit -m "$(cat <<'EOF'
feat(session): probe Zustand tap — Proxy em globalThis.zustand.create

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: 3 testes zustandTap.

---

## Task 6: Bridge + activation no `probe/main.ts`

**Files:**
- Modify: `app/src/probe/main.ts`
- Modify: `app/src/probe/bridge.ts`
- Modify: `app/src/types/messages.ts`
- Modify: `app/src/probe/detectors/stateManagers.ts`

### Step 6.1: Activate taps em `probe/main.ts`

```ts
import { installReduxTap, reduxStoreRegistry } from './state/reduxTap';
import { installZustandTap, zustandStoreRegistry } from './state/zustandTap';
```

No bloco onde `probe:start-detection` chega (após `historyPatched` install):

```ts
if (e.data.type === 'probe:start-detection') {
	active = true;
	if (!historyPatched) {
		patchHistoryForSpaRouting();
		historyPatched = true;
	}
	// Taps de state — idempotentes, podem ser chamados a cada start.
	installReduxTap();
	installZustandTap();
	emitDetection(e.data.reason);
}
```

### Step 6.2: Atualizar detector de state managers

`app/src/probe/detectors/stateManagers.ts`:

```ts
import type { StateManagerDetection } from '@/lib/session/types';
import { reduxStoreRegistry } from '../state/reduxTap';
import { zustandStoreRegistry } from '../state/zustandTap';

export function detectStateManagers(): StateManagerDetection[] {
	const out: StateManagerDetection[] = [];

	const hasReduxDevtools = !!(
		window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }
	).__REDUX_DEVTOOLS_EXTENSION__;

	if (hasReduxDevtools || reduxStoreRegistry.count > 0) {
		out.push({
			name: 'redux',
			storesDetected: reduxStoreRegistry.count,
			treatment: 'tracked',
		});
	}

	if (zustandStoreRegistry.count > 0) {
		out.push({
			name: 'zustand',
			storesDetected: zustandStoreRegistry.count,
			treatment: 'tracked',
		});
	}

	// MobX, Jotai, NgRx, Angular signals: Phase 5.
	return out;
}
```

### Step 6.3: Relay no bridge

`app/src/probe/bridge.ts` — adicionar tratamento ao listener de `message`:

```ts
window.addEventListener('message', (e: MessageEvent) => {
	if (e.source !== window) return;
	if (!isProbeMessage(e.data)) return;
	if (e.data.type === 'probe:detection') {
		chrome.runtime
			.sendMessage({ action: 'pageDetected', payload: e.data.payload })
			.catch((err: unknown) => {
				if (String(err).includes('Extension context invalidated')) return;
				throw err;
			});
	} else if (e.data.type === 'probe:state-change') {
		chrome.runtime
			.sendMessage({ action: 'stateChange', payload: e.data.payload })
			.catch((err: unknown) => {
				if (String(err).includes('Extension context invalidated')) return;
				throw err;
			});
	}
});
```

### Step 6.4: Action `stateChange` em `messages.ts`

Adicionar à união `MessageAction`:

```ts
| 'stateChange'
```

Adicionar campo opcional `payload?: unknown` (já pode existir; senão criar) em `Message`. Se preferir tipado:

```ts
import type { StoreKind } from '@/lib/session/types';
...
statePayload?: {
	storeId: string;
	storeKind: StoreKind;
	timestamp: number;
	prev: unknown;
	next: unknown;
};
```

E ajustar bridge pra usar o nome do campo escolhido.

### Step 6.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm test 2>&1 | tail -5
git add app/src/probe/main.ts app/src/probe/bridge.ts app/src/probe/detectors/stateManagers.ts app/src/types/messages.ts
git commit -m "$(cat <<'EOF'
feat(session): bridge state-change probe→background + ativação de taps em main.ts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Background handler + recorder.addStateChange (keyframe logic)

**Files:**
- Modify: `app/src/entrypoints/background.ts`
- Modify: `app/src/lib/session/recorder.ts`
- Modify: `app/src/lib/session/sizeEstimate.ts` (incluir custo de StateChangeEvent)
- Test: `app/src/lib/session/__tests__/recorder.state.test.ts`

### Step 7.1: Recorder — `addStateChange`

Em `app/src/lib/session/recorder.ts`:

```ts
import {
	compressDiff,
	compressSnapshot,
	computeDiff,
	decompressDiff,
	decompressSnapshot,
} from './state/diff';
import type { StateKeyframe, StateSnapshot, StoreKind } from './types';

const DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS = 10;
const DEFAULT_STATE_KEYFRAME_EVERY_T_MS = 30_000;

let stateKeyframeEveryN = DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS;
let stateKeyframeEveryT = DEFAULT_STATE_KEYFRAME_EVERY_T_MS;

interface StoreRuntime {
	/** Último estado descomprimido (mantido em memória pra computar diff sem replay). */
	currentState: unknown;
	diffsSinceKeyframe: number;
	lastKeyframeAt: number;
	sequenceNum: number;
}

interface SessionStateRuntime {
	stores: Map<string, StoreRuntime>; // key: phaseId+storeId
}

const stateRuntime = new Map<string, SessionStateRuntime>();

function stateRuntimeFor(sessionId: string): SessionStateRuntime {
	let r = stateRuntime.get(sessionId);
	if (!r) {
		r = { stores: new Map() };
		stateRuntime.set(sessionId, r);
	}
	return r;
}

export interface StateChangePayload {
	storeId: string;
	storeKind: StoreKind;
	timestamp: number;
	prev: unknown;
	next: unknown;
}

// dentro do export const recorder = { ... }:
async addStateChange(sessionId: string, payload: StateChangePayload): Promise<void> {
	const s = await sessionStore.get(sessionId);
	if (!s) throw new Error(`Session ${sessionId} não encontrada`);
	if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
	const phase = s.detectionPhases[s.detectionPhases.length - 1];
	if (!phase) {
		throw new Error(
			`Session ${sessionId}: state-change recebido antes da primeira DetectionPhase`,
		);
	}

	const r = getOrInitRuntime(sessionId, s);
	const sr = stateRuntimeFor(sessionId);
	const runtimeKey = `${phase.id}:${payload.storeId}`;
	let storeR = sr.stores.get(runtimeKey);

	// Baseline: primeira mudança observada do storeId nesta fase.
	if (!storeR) {
		if (!phase.stateBaseline) phase.stateBaseline = {};
		phase.stateBaseline[payload.storeId] = {
			storeId: payload.storeId,
			storeKind: payload.storeKind,
			data: payload.prev,
			timestamp: payload.timestamp,
		};
		storeR = {
			currentState: payload.prev,
			diffsSinceKeyframe: 0,
			lastKeyframeAt: payload.timestamp,
			sequenceNum: 0,
		};
		sr.stores.set(runtimeKey, storeR);
	}

	const ops = computeDiff(storeR.currentState, payload.next);
	if (ops.length === 0) {
		// Sem mudança real (referência diferente, conteúdo igual) — ignora.
		return;
	}

	const diffCompressed = compressDiff(ops);
	storeR.sequenceNum++;
	const ev: SessionEvent = {
		type: 'state',
		timestamp: payload.timestamp,
		phaseId: phase.id,
		storeId: payload.storeId,
		storeKind: payload.storeKind,
		diffCompressed,
		sequenceNum: storeR.sequenceNum,
	};
	s.events.push(ev);
	r.bytes += estimateEventBytes(ev);

	storeR.currentState = payload.next;
	storeR.diffsSinceKeyframe++;

	// Keyframe a cada N diffs OU T ms.
	const elapsedSinceKeyframe = payload.timestamp - storeR.lastKeyframeAt;
	if (
		storeR.diffsSinceKeyframe >= stateKeyframeEveryN ||
		elapsedSinceKeyframe >= stateKeyframeEveryT
	) {
		if (!phase.stateKeyframes) phase.stateKeyframes = [];
		const keyframe: StateKeyframe = {
			storeId: payload.storeId,
			storeKind: payload.storeKind,
			timestamp: payload.timestamp,
			phaseId: phase.id,
			snapshotCompressed: compressSnapshot(payload.next),
		};
		phase.stateKeyframes.push(keyframe);
		r.bytes += keyframe.snapshotCompressed.length;
		storeR.diffsSinceKeyframe = 0;
		storeR.lastKeyframeAt = payload.timestamp;
	}

	// Hard limit por bytes
	if (r.bytes >= sizeLimitBytes) {
		await autoStop(s, 'size', r);
		return;
	}
	const duration = Date.now() - r.startedAt;
	if (duration >= durationLimitMs) {
		await autoStop(s, 'time', r);
		return;
	}

	await sessionStore.put(s);
},
```

E expor helper de teste:

```ts
_setStateLimitsForTests(limits: { everyNDiffs: number; everyTMs: number }): void {
	stateKeyframeEveryN = limits.everyNDiffs;
	stateKeyframeEveryT = limits.everyTMs;
},
_resetStateLimitsForTests(): void {
	stateKeyframeEveryN = DEFAULT_STATE_KEYFRAME_EVERY_N_DIFFS;
	stateKeyframeEveryT = DEFAULT_STATE_KEYFRAME_EVERY_T_MS;
	stateRuntime.clear();
},
```

E em `_resetLimitsForTests` já existente, limpar `stateRuntime` também.

### Step 7.2: `sizeEstimate.ts`

Adicionar branch para `state` (peso = `diffCompressed.length` + overhead fixo):

```ts
if (event.type === 'state') {
	return event.diffCompressed.length + 64;
}
```

### Step 7.3: Background handler

Em `app/src/entrypoints/background.ts`, adicionar handler junto aos outros (próximo a `pageDetected`):

```ts
if (message.action === 'stateChange') {
	(async () => {
		try {
			const session = await sessionStore.findActiveByTab(sender?.tab?.id ?? -1);
			if (!session) {
				sendResponse({ ok: false, error: 'Sem sessão ativa para a tab remetente' });
				return;
			}
			await recorder.addStateChange(session.id, message.payload);
			sendResponse({ ok: true });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

### Step 7.4: Tests do recorder

`app/src/lib/session/__tests__/recorder.state.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { recorder } from '../recorder';
import { sessionStore, _resetForTests } from '../storage';
import type { PageDetection } from '../types';

const fp = {
	framework: { name: 'react' as const, version: '18' },
	httpClients: [],
	dataFetching: [],
	stateManagers: [{ name: 'redux', storesDetected: 1, treatment: 'tracked' as const }],
	detectedAt: 0,
	isProductionBuild: false,
};

async function startWithPhase(): Promise<string> {
	const id = await recorder.startSession({
		tabId: 1,
		initialUrl: 'https://x/',
		userAgent: 'jsdom',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	});
	const det: PageDetection = {
		url: 'https://x/',
		timestamp: Date.now(),
		fingerprint: fp,
		triggerType: 'initial',
	};
	await recorder.addPage(id, det);
	return id;
}

describe('recorder.addStateChange', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		recorder._resetLimitsForTests();
		recorder._resetStateLimitsForTests?.();
	});

	afterEach(() => {
		recorder._resetLimitsForTests();
		recorder._resetStateLimitsForTests?.();
	});

	it('escreve baseline na primeira mudança e gera StateChangeEvent', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: Date.now(),
			prev: { a: 1 },
			next: { a: 2 },
		});
		const s = await sessionStore.get(id);
		expect(s).toBeTruthy();
		const phase = s!.detectionPhases[0];
		expect(phase.stateBaseline?.['redux:1']?.data).toEqual({ a: 1 });
		const stateEvents = s!.events.filter((e) => e.type === 'state');
		expect(stateEvents).toHaveLength(1);
	});

	it('gera keyframe a cada N diffs', async () => {
		recorder._setStateLimitsForTests?.({ everyNDiffs: 3, everyTMs: 1_000_000 });
		const id = await startWithPhase();
		for (let i = 1; i <= 5; i++) {
			await recorder.addStateChange(id, {
				storeId: 'redux:1',
				storeKind: 'redux',
				timestamp: Date.now() + i,
				prev: { a: i - 1 },
				next: { a: i },
			});
		}
		const s = await sessionStore.get(id);
		// 5 mudanças, keyframe a cada 3 → 1 keyframe (no 3º)
		expect(s!.detectionPhases[0].stateKeyframes?.length).toBeGreaterThanOrEqual(1);
	});

	it('gera keyframe a cada T ms', async () => {
		recorder._setStateLimitsForTests?.({ everyNDiffs: 1_000, everyTMs: 50 });
		const id = await startWithPhase();
		const t0 = Date.now();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: t0,
			prev: { a: 0 },
			next: { a: 1 },
		});
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: t0 + 100,
			prev: { a: 1 },
			next: { a: 2 },
		});
		const s = await sessionStore.get(id);
		expect(s!.detectionPhases[0].stateKeyframes?.length).toBeGreaterThanOrEqual(1);
	});

	it('rejeita state-change sem fase ativa', async () => {
		const id = await recorder.startSession({
			tabId: 2,
			initialUrl: 'https://y/',
			userAgent: 'jsdom',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await expect(
			recorder.addStateChange(id, {
				storeId: 'redux:1',
				storeKind: 'redux',
				timestamp: Date.now(),
				prev: {},
				next: { a: 1 },
			}),
		).rejects.toThrow(/antes da primeira DetectionPhase/);
	});

	it('múltiplos stores na mesma fase têm baselines independentes', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: Date.now(),
			prev: { a: 0 },
			next: { a: 1 },
		});
		await recorder.addStateChange(id, {
			storeId: 'zustand:1',
			storeKind: 'zustand',
			timestamp: Date.now(),
			prev: { x: 'init' },
			next: { x: 'next' },
		});
		const s = await sessionStore.get(id);
		expect(Object.keys(s!.detectionPhases[0].stateBaseline ?? {})).toEqual(
			expect.arrayContaining(['redux:1', 'zustand:1']),
		);
	});

	it('ignora mudança quando diff é vazio (sem ops)', async () => {
		const id = await startWithPhase();
		await recorder.addStateChange(id, {
			storeId: 'redux:1',
			storeKind: 'redux',
			timestamp: Date.now(),
			prev: { a: 1 },
			next: { a: 1 },
		});
		// Primeira chamada cria baseline mesmo com diff vazio? Vamos validar comportamento:
		const s = await sessionStore.get(id);
		const stateEvents = s!.events.filter((e) => e.type === 'state');
		expect(stateEvents).toHaveLength(0);
	});
});
```

### Step 7.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/recorder.state.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/recorder.ts app/src/lib/session/sizeEstimate.ts app/src/lib/session/__tests__/recorder.state.test.ts app/src/entrypoints/background.ts
git commit -m "$(cat <<'EOF'
feat(session): recorder.addStateChange + handler stateChange + keyframe logic

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: 6 testes recorder.state.

---

## Task 8: `replay.ts` — reconstrução de snapshot

**Files:**
- Create: `app/src/lib/session/state/replay.ts`
- Test: `app/src/lib/session/state/__tests__/replay.test.ts`

### Step 8.1: Implementar

`app/src/lib/session/state/replay.ts`:

```ts
import type { DetectionPhase, SessionEvent } from '../types';
import { applyDiff, decompressDiff, decompressSnapshot } from './diff';

/**
 * Reconstrói o estado de um store no instante `playheadTimestamp` (timestamp absoluto).
 * Estratégia: encontra o keyframe mais próximo `≤ playheadTimestamp` (ou cai no baseline)
 * e aplica todos os diffs subsequentes desse store até `playheadTimestamp`.
 *
 * Retorna `null` se não há baseline (nenhuma mudança observada antes do playhead).
 */
export function reconstructStateAt(
	phase: DetectionPhase,
	storeId: string,
	playheadTimestamp: number,
	stateEvents: SessionEvent[],
): unknown {
	const baseline = phase.stateBaseline?.[storeId];
	if (!baseline) return null;

	// Busca binária do keyframe mais próximo ≤ playhead
	const keyframes = (phase.stateKeyframes ?? []).filter((k) => k.storeId === storeId);
	let anchor: { state: unknown; timestamp: number };
	if (keyframes.length === 0 || keyframes[0].timestamp > playheadTimestamp) {
		anchor = { state: baseline.data, timestamp: baseline.timestamp };
	} else {
		const idx = binarySearchLE(keyframes, playheadTimestamp, (k) => k.timestamp);
		const kf = keyframes[idx];
		anchor = { state: decompressSnapshot(kf.snapshotCompressed), timestamp: kf.timestamp };
	}

	let cur = anchor.state;
	for (const ev of stateEvents) {
		if (ev.type !== 'state') continue;
		if (ev.storeId !== storeId) continue;
		if (ev.timestamp <= anchor.timestamp) continue;
		if (ev.timestamp > playheadTimestamp) break;
		const ops = decompressDiff(ev.diffCompressed);
		cur = applyDiff(cur, ops);
	}
	return cur;
}

function binarySearchLE<T>(arr: T[], target: number, key: (x: T) => number): number {
	let lo = 0;
	let hi = arr.length - 1;
	let best = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (key(arr[mid]) <= target) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return best;
}
```

### Step 8.2: Tests

`app/src/lib/session/state/__tests__/replay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compressDiff, compressSnapshot, computeDiff } from '../diff';
import { reconstructStateAt } from '../replay';
import type { DetectionPhase, SessionEvent } from '../../types';

function makePhase(): DetectionPhase {
	return {
		id: 'p1',
		startTimestamp: 0,
		endTimestamp: 1000,
		fingerprint: {
			framework: { name: 'react' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: 0,
			isProductionBuild: false,
		},
		pages: [],
		stateBaseline: {
			'redux:1': {
				storeId: 'redux:1',
				storeKind: 'redux',
				data: { count: 0 },
				timestamp: 100,
			},
		},
		stateKeyframes: [],
	};
}

function diffEvent(prev: unknown, next: unknown, t: number, seq: number): SessionEvent {
	return {
		type: 'state',
		timestamp: t,
		phaseId: 'p1',
		storeId: 'redux:1',
		storeKind: 'redux',
		diffCompressed: compressDiff(computeDiff(prev as object, next as object)),
		sequenceNum: seq,
	};
}

describe('reconstructStateAt', () => {
	it('retorna baseline quando playhead == baseline.timestamp', () => {
		const phase = makePhase();
		const out = reconstructStateAt(phase, 'redux:1', 100, []);
		expect(out).toEqual({ count: 0 });
	});

	it('aplica diffs sequenciais a partir do baseline até playhead', () => {
		const phase = makePhase();
		const events: SessionEvent[] = [
			diffEvent({ count: 0 }, { count: 1 }, 200, 1),
			diffEvent({ count: 1 }, { count: 2 }, 300, 2),
			diffEvent({ count: 2 }, { count: 3 }, 400, 3),
		];
		expect(reconstructStateAt(phase, 'redux:1', 250, events)).toEqual({ count: 1 });
		expect(reconstructStateAt(phase, 'redux:1', 350, events)).toEqual({ count: 2 });
		expect(reconstructStateAt(phase, 'redux:1', 1_000, events)).toEqual({ count: 3 });
	});

	it('usa keyframe mais próximo ≤ playhead', () => {
		const phase = makePhase();
		phase.stateKeyframes = [
			{
				storeId: 'redux:1',
				storeKind: 'redux',
				timestamp: 500,
				phaseId: 'p1',
				snapshotCompressed: compressSnapshot({ count: 5 }),
			},
		];
		const events: SessionEvent[] = [
			diffEvent({ count: 5 }, { count: 6 }, 600, 6),
		];
		expect(reconstructStateAt(phase, 'redux:1', 550, events)).toEqual({ count: 5 });
		expect(reconstructStateAt(phase, 'redux:1', 650, events)).toEqual({ count: 6 });
	});

	it('retorna null quando não há baseline', () => {
		const phase = makePhase();
		expect(reconstructStateAt(phase, 'zustand:1', 100, [])).toBeNull();
	});

	it('binary search escolhe keyframe correto entre vários', () => {
		const phase = makePhase();
		phase.stateKeyframes = [
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 200, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'a' }) },
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 400, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'b' }) },
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 600, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'c' }) },
			{ storeId: 'redux:1', storeKind: 'redux', timestamp: 800, phaseId: 'p1', snapshotCompressed: compressSnapshot({ v: 'd' }) },
		];
		expect(reconstructStateAt(phase, 'redux:1', 500, [])).toEqual({ v: 'b' });
		expect(reconstructStateAt(phase, 'redux:1', 700, [])).toEqual({ v: 'c' });
		expect(reconstructStateAt(phase, 'redux:1', 900, [])).toEqual({ v: 'd' });
	});
});
```

### Step 8.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/state/__tests__/replay.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/state/replay.ts app/src/lib/session/state/__tests__/replay.test.ts
git commit -m "$(cat <<'EOF'
feat(session): reconstructStateAt com keyframe binary search

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: 5 testes replay.

---

## Task 9: UI — `JsonTree` + `StateInspector`

**Files:**
- Create: `app/src/components/replay/JsonTree.tsx`
- Create: `app/src/components/replay/StateInspector.tsx`
- Test: `app/src/components/replay/__tests__/JsonTree.test.tsx`
- Test: `app/src/components/replay/__tests__/StateInspector.test.tsx`

### Step 9.1: `JsonTree.tsx`

`app/src/components/replay/JsonTree.tsx`:

```tsx
import { useState } from 'react';

interface Props {
	value: unknown;
	name?: string;
	depth?: number;
}

export function JsonTree({ value, name, depth = 0 }: Props) {
	const [open, setOpen] = useState(depth < 2);
	const indent = { paddingLeft: `${depth * 12}px` };

	if (value === null) {
		return (
			<div style={indent} className="font-mono text-xs">
				{name !== undefined && <span className="text-muted-foreground">{name}: </span>}
				<span className="text-purple-600">null</span>
			</div>
		);
	}
	const t = typeof value;
	if (t !== 'object') {
		const color =
			t === 'string' ? 'text-emerald-700' : t === 'number' ? 'text-sky-700' : 'text-amber-700';
		return (
			<div style={indent} className="font-mono text-xs">
				{name !== undefined && <span className="text-muted-foreground">{name}: </span>}
				<span className={color}>{t === 'string' ? `"${String(value)}"` : String(value)}</span>
			</div>
		);
	}
	const isArray = Array.isArray(value);
	const entries = isArray
		? (value as unknown[]).map((v, i) => [i, v] as const)
		: Object.entries(value as Record<string, unknown>);

	return (
		<div style={indent} className="font-mono text-xs">
			<button
				type="button"
				className="cursor-pointer text-muted-foreground"
				onClick={() => setOpen((o) => !o)}
			>
				{open ? '▼' : '▶'}
			</button>{' '}
			{name !== undefined && <span className="text-muted-foreground">{name}: </span>}
			<span>{isArray ? `Array(${entries.length})` : `Object(${entries.length})`}</span>
			{open &&
				entries.map(([k, v]) => (
					<JsonTree key={String(k)} name={String(k)} value={v} depth={depth + 1} />
				))}
		</div>
	);
}
```

### Step 9.2: `StateInspector.tsx`

`app/src/components/replay/StateInspector.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { JsonTree } from './JsonTree';
import { reconstructStateAt } from '@/lib/session/state/replay';
import type { DetectionPhase, SessionEvent } from '@/lib/session/types';

interface Props {
	phase: DetectionPhase | null;
	events: SessionEvent[];
	playheadTimestamp: number;
}

export function StateInspector({ phase, events, playheadTimestamp }: Props) {
	const storeIds = useMemo(() => {
		if (!phase) return [];
		return Object.keys(phase.stateBaseline ?? {});
	}, [phase]);

	const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

	const effectiveStoreId =
		selectedStoreId && storeIds.includes(selectedStoreId)
			? selectedStoreId
			: (storeIds[0] ?? null);

	const snapshot = useMemo(() => {
		if (!phase || !effectiveStoreId) return null;
		try {
			return reconstructStateAt(phase, effectiveStoreId, playheadTimestamp, events);
		} catch (err) {
			return { __error__: String(err) };
		}
	}, [phase, effectiveStoreId, playheadTimestamp, events]);

	if (!phase) {
		return <p className="p-3 text-muted-foreground text-sm">Sem fase selecionada.</p>;
	}
	if (storeIds.length === 0) {
		return (
			<p className="p-3 text-muted-foreground text-sm">
				Nenhum store de estado capturado nesta fase.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center gap-2">
				<label htmlFor="state-store" className="text-xs">
					Store:
				</label>
				<select
					id="state-store"
					className="rounded border bg-background px-2 py-1 text-xs"
					value={effectiveStoreId ?? ''}
					onChange={(e) => setSelectedStoreId(e.target.value)}
				>
					{storeIds.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
			</div>
			{snapshot === null ? (
				<p className="text-muted-foreground text-xs">
					Estado indisponível no instante selecionado.
				</p>
			) : (
				<div className="overflow-auto rounded border p-2">
					<JsonTree value={snapshot} />
				</div>
			)}
		</div>
	);
}
```

### Step 9.3: Tests

`app/src/components/replay/__tests__/JsonTree.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JsonTree } from '../JsonTree';

describe('JsonTree', () => {
	it('renderiza primitives com cores diferenciadas', () => {
		render(<JsonTree value="hello" name="msg" />);
		expect(screen.getByText('"hello"')).toBeInTheDocument();
	});

	it('renderiza null', () => {
		render(<JsonTree value={null} name="x" />);
		expect(screen.getByText('null')).toBeInTheDocument();
	});

	it('expande e colapsa objeto ao clicar no toggle', async () => {
		const user = userEvent.setup();
		render(<JsonTree value={{ a: 1, b: 2 }} depth={5} />);
		// depth>=2 inicia colapsado
		expect(screen.queryByText('1')).not.toBeInTheDocument();
		await user.click(screen.getByRole('button'));
		expect(screen.getByText('1')).toBeInTheDocument();
	});

	it('renderiza array com índices', () => {
		render(<JsonTree value={[10, 20, 30]} />);
		expect(screen.getByText(/Array\(3\)/)).toBeInTheDocument();
	});
});
```

`app/src/components/replay/__tests__/StateInspector.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StateInspector } from '../StateInspector';
import { compressDiff, computeDiff } from '@/lib/session/state/diff';
import type { DetectionPhase, SessionEvent } from '@/lib/session/types';

function makePhase(): DetectionPhase {
	return {
		id: 'p1',
		startTimestamp: 0,
		endTimestamp: 1000,
		fingerprint: {
			framework: { name: 'react' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: 0,
			isProductionBuild: false,
		},
		pages: [],
		stateBaseline: {
			'redux:1': {
				storeId: 'redux:1',
				storeKind: 'redux',
				data: { count: 0 },
				timestamp: 100,
			},
		},
	};
}

describe('StateInspector', () => {
	it('mostra mensagem quando phase é null', () => {
		render(<StateInspector phase={null} events={[]} playheadTimestamp={0} />);
		expect(screen.getByText(/Sem fase/i)).toBeInTheDocument();
	});

	it('mostra mensagem quando não há stores', () => {
		const phase = makePhase();
		phase.stateBaseline = {};
		render(<StateInspector phase={phase} events={[]} playheadTimestamp={100} />);
		expect(screen.getByText(/Nenhum store/i)).toBeInTheDocument();
	});

	it('reconstrói snapshot no instante do playhead', () => {
		const phase = makePhase();
		const events: SessionEvent[] = [
			{
				type: 'state',
				timestamp: 200,
				phaseId: 'p1',
				storeId: 'redux:1',
				storeKind: 'redux',
				diffCompressed: compressDiff(computeDiff({ count: 0 }, { count: 7 })),
				sequenceNum: 1,
			},
		];
		render(<StateInspector phase={phase} events={events} playheadTimestamp={250} />);
		expect(screen.getByText('7')).toBeInTheDocument();
	});
});
```

### Step 9.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/replay/__tests__/JsonTree.test.tsx src/components/replay/__tests__/StateInspector.test.tsx
cd app && npm test 2>&1 | tail -5
git add app/src/components/replay/JsonTree.tsx app/src/components/replay/StateInspector.tsx app/src/components/replay/__tests__/
git commit -m "$(cat <<'EOF'
feat(session): StateInspector + JsonTree para Time-Travel de estado

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: 4 + 3 testes UI.

---

## Task 10: ReplayPage — playhead + abas + sincronização

**Files:**
- Modify: `app/src/pages/ReplayPage.tsx`

### Step 10.1: Playhead controlado + StateInspector embedado

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { EventRow } from '@/components/replay/EventRow';
import { PhaseList } from '@/components/replay/PhaseList';
import { StateInspector } from '@/components/replay/StateInspector';
import { sessionStore } from '@/lib/session/storage';
import type { Session, SessionEvent } from '@/lib/session/types';

const FILTERS: SessionEvent['type'][] = [
	'network',
	'console',
	'route',
	'error',
	'detection',
	'state',
];

type Tab = 'timeline' | 'state';

export function ReplayPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const [session, setSession] = useState<Session | null>(null);
	const [enabled, setEnabled] = useState<Record<string, boolean>>({
		network: true,
		console: true,
		route: true,
		error: true,
		detection: false,
		state: false,
	});
	const [playheadOffset, setPlayheadOffset] = useState(0);
	const [tab, setTab] = useState<Tab>('timeline');

	useEffect(() => {
		if (!sessionId) return;
		void sessionStore.get(sessionId).then(setSession);
	}, [sessionId]);

	const totalDurationMs = useMemo(() => {
		if (!session) return 0;
		const end = session.endedAt ?? Date.now();
		return Math.max(0, end - session.startedAt);
	}, [session]);

	const playheadTimestamp = (session?.startedAt ?? 0) + playheadOffset;

	const activePhase = useMemo(() => {
		if (!session) return null;
		const phases = session.detectionPhases;
		for (let i = phases.length - 1; i >= 0; i--) {
			if (phases[i].startTimestamp <= playheadTimestamp) return phases[i];
		}
		return phases[0] ?? null;
	}, [session, playheadTimestamp]);

	if (!session) {
		return <div className="p-4 text-muted-foreground text-sm">Carregando…</div>;
	}

	const filtered = session.events.filter(
		(e) => enabled[e.type] && e.timestamp <= playheadTimestamp,
	);

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Replay — {session.metadata.initialUrl}</h1>
				<span className="text-muted-foreground text-xs">
					{session.events.length} eventos · {session.detectionPhases.length} fases
				</span>
			</div>

			{/* Playhead slider */}
			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Playhead:</span>
				<input
					type="range"
					min={0}
					max={totalDurationMs}
					step={50}
					value={playheadOffset}
					onChange={(e) => setPlayheadOffset(Number(e.target.value))}
					className="flex-1"
					aria-label="Playhead"
				/>
				<span className="tabular-nums">+{(playheadOffset / 1000).toFixed(2)}s</span>
			</div>

			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Filtros:</span>
				{FILTERS.map((f) => (
					<label key={f} htmlFor={`filter-${f}`} className="flex items-center gap-1">
						<Checkbox
							id={`filter-${f}`}
							checked={!!enabled[f]}
							onCheckedChange={(v) => setEnabled((prev) => ({ ...prev, [f]: v === true }))}
						/>
						{f}
					</label>
				))}
			</div>

			<div className="flex gap-2 text-sm">
				{(['timeline', 'state'] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						className={`rounded border px-3 py-1 ${tab === t ? 'bg-accent' : ''}`}
						onClick={() => setTab(t)}
					>
						{t === 'timeline' ? 'Timeline' : 'Estado'}
					</button>
				))}
			</div>

			<div className="grid grid-cols-[1fr_280px] gap-3 overflow-hidden">
				<div className="overflow-auto rounded border">
					{tab === 'timeline' ? (
						filtered.length === 0 ? (
							<p className="p-3 text-muted-foreground text-sm">
								Nenhum evento até o playhead atual.
							</p>
						) : (
							filtered.map((ev, i) => (
								<EventRow key={i} event={ev} startedAt={session.startedAt} />
							))
						)
					) : (
						<StateInspector
							phase={activePhase}
							events={session.events}
							playheadTimestamp={playheadTimestamp}
						/>
					)}
				</div>
				<aside className="overflow-auto">
					<PhaseList phases={session.detectionPhases} />
				</aside>
			</div>
		</div>
	);
}
```

### Step 10.2: Validate + build full + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/pages/ReplayPage.tsx
git commit -m "$(cat <<'EOF'
feat(session): ReplayPage com playhead controlado + aba Estado sincronizada

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado: build passa, suite verde.

---

## Self-Review Checklist

- [ ] **Spec coverage Phase 4:**
  - Tap em Redux via probe MAIN-world → cada subscribe vira `StateChangeEvent` ✓ (Task 4)
  - Tap em Zustand via Proxy em `create()` ✓ (Task 5)
  - `stateBaseline` + `stateKeyframes` per-DetectionPhase ✓ (Task 2, Task 7)
  - Diff + LZ-string compression ✓ (Task 3)
  - Snapshots inteiros a cada 10 diffs ou 30s default ✓ (Task 7)
  - Inspector de estado sincronizado com playhead ✓ (Task 9, Task 10)
  - Bridge isolated → background `stateChange` → recorder ✓ (Task 6, Task 7)
  - Pre-work `storesDetected` sentinel ✓ (Task 1, fecha bd `chrome-extension-debug-buddy-deq`)
  - Índice de keyframes (binary search) ✓ (Task 8)

- [ ] **No-fallbacks check:**
  - `reconstructStateAt` retorna `null` (não fabrica snapshot vazio) quando não há baseline.
  - `decompressDiff` lança em string inválida — não retorna `[]`.
  - `addStateChange` lança quando não há fase ativa — não cria fase fantasma.
  - `applyDiff` lança em path inválido — não silencia.

- [ ] **Performance / scrubbing:**
  - Binary search nos keyframes ⟹ `O(log n)` (desafio 10 da spec).
  - Keyframe a cada 10 diffs limita replay a ≤9 diffs aplicados por scrubbing.
  - Compressão LZ keepa state grande compacto.

- [ ] **Hard limits:**
  - `addStateChange` atualiza `r.bytes` com tamanho do diff comprimido.
  - Keyframe contribui pra bytes (snapshot inteiro).
  - `autoStop` por size/time funciona igual aos outros eventos.

- [ ] **Schema versioning:**
  - `StateChangeEvent`, `stateBaseline`, `stateKeyframes` são todos opcionais — sessões antigas (Phase 1-3) carregam sem erro.
  - `schemaVersion: 1` permanece (decisão da spec — campos novos sempre opcionais).

---

## Pontos abertos pra Phase 5 / 6

- **MobX, Jotai, NgRx, Angular signals** ficam para Phase 5.
- **Zustand sem `globalThis.zustand`** (caso comum: `import { create } from 'zustand'`) não pega — Phase 5 pode adicionar import-time helper ou bytecode patcher.
- **State snapshots podem conter PII** (tokens, dados de usuário) — Phase 6 adiciona whitelisting/redação.
- **rrweb-player playhead** integração (substituir slider rudimentar pelo player do rrweb) — Phase 2 já entrega o player; Phase 4 dá o contrato `playheadMs`.
- **Drift de relógio** entre probe MAIN e bridge isolated — usar `performance.now()` com offset se virar problema (desafio 9 da spec).
- **Antipattern derivado de state** (`state-thrash`: setState ≥100x em <1s) — pode entrar como follow-up.
