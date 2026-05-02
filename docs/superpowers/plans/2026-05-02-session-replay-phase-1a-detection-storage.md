# Session Replay — Phase 1a: Smart Detection + Storage Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer a infraestrutura de Smart Detection per-URL + persistência de Session em IndexedDB, sem ainda capturar eventos (network, console, state, rrweb) — só identificação de framework/libs e agrupamento em DetectionPhases.

**Architecture:** Probe MAIN-world rodando via manifest content_scripts em `document_start` (noop até receber sinal do bridge), bridge isolated content script fazendo relay via `window.postMessage` ↔ `chrome.runtime.sendMessage`, background recebendo PageDetections e agrupando em DetectionPhases por igualdade estrutural de fingerprint. Sessão é criada/encerrada por handlers debug (`__debug_startSession`, `__debug_stopSession`) — UI vem na Phase 1c.

**Tech Stack:** TypeScript strict, Vite multi-entry build, IndexedDB (mesma DB `debugger-extension-db` do projeto, novo store `sessions`), Vitest com jsdom, Biome (tabs size 2, single quotes, pt-BR strings).

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` (seções 4, 5, 6, 10, 11).

---

## File Structure

**Create:**
- `app/src/lib/session/types.ts` — tipos centrais (`Session`, `DetectionPhase`, `EnvironmentFingerprint`, `PageDetection`, `SessionEvent` união)
- `app/src/lib/session/storage.ts` — wrapper IndexedDB pro store `sessions`
- `app/src/lib/session/fingerprint.ts` — `sameSet`, `fingerprintsEqual`, `groupConsecutiveDetections`
- `app/src/lib/session/recorder.ts` — esqueleto mínimo: `startSession`, `stopSession`, `addPhase`, `addPage`, `getActiveSession`
- `app/src/probe/detectors/framework.ts` — React, Angular, vanilla
- `app/src/probe/detectors/stateManagers.ts` — Redux (Phase 1a; outros retornam `null`)
- `app/src/probe/detectors/dataFetching.ts` — Apollo, TanStack Query (com flag `treatment: 'detection-only'`)
- `app/src/probe/detectors/httpClients.ts` — fetch nativo (sempre presente), XHR, Axios via heurística de stack
- `app/src/probe/main.ts` — orquestrador MAIN-world: chama detectors, emite fingerprint via `postMessage`
- `app/src/probe/bridge.ts` — content script ISOLATED: relay `postMessage` ↔ `chrome.runtime.sendMessage`
- `app/src/probe/protocol.ts` — types das mensagens trocadas entre probe ↔ bridge ↔ background

**Modify:**
- `app/src/types/messages.ts` — adicionar actions: `__debug_startSession`, `__debug_stopSession`, `pageDetected`, `getActiveSession`
- `app/src/lib/indexedDB.ts` — bumpar versão do DB de 1 pra 2, criando o store `sessions`
- `app/src/entrypoints/background.ts` — handlers das novas actions, listener `chrome.webNavigation.onCommitted`, integração com recorder
- `app/manifest.json` — registrar `probe-main.js` (world MAIN) e `probe-bridge.js` (world ISOLATED) como content scripts em `<all_urls>`, `document_start`
- `app/vite.config.mts` — adicionar entries `probeMain` e `probeBridge`

**Test (co-located em `__tests__/`):**
- `app/src/lib/session/__tests__/storage.test.ts`
- `app/src/lib/session/__tests__/fingerprint.test.ts`
- `app/src/lib/session/__tests__/recorder.test.ts`
- `app/src/probe/detectors/__tests__/framework.test.ts`
- `app/src/probe/detectors/__tests__/stateManagers.test.ts`
- `app/src/probe/detectors/__tests__/dataFetching.test.ts`
- `app/src/probe/detectors/__tests__/httpClients.test.ts`

---

## Task 1: Tipos centrais do Session

**Files:**
- Create: `app/src/lib/session/types.ts`

- [ ] **Step 1: Criar arquivo com types da spec (seções 6 e 10), sem campos opcionais que pertencem a fases posteriores**

Arquivo `app/src/lib/session/types.ts`:

```ts
export type FrameworkName = 'react' | 'angular' | 'vanilla';

export type LibTreatment = 'tracked' | 'detection-only';

export interface HttpClientDetection {
	name: string;
	confidence: 'high' | 'medium' | 'low';
}

export interface DataFetchingDetection {
	name: string;
	version?: string;
	treatment: LibTreatment;
}

export interface StateManagerDetection {
	name: string;
	storesDetected: number;
	treatment: LibTreatment;
}

export interface EnvironmentFingerprint {
	framework: { name: FrameworkName; version?: string };
	httpClients: HttpClientDetection[];
	dataFetching: DataFetchingDetection[];
	stateManagers: StateManagerDetection[];
	detectedAt: number;
	isProductionBuild: boolean;
}

export type PageDetectionTrigger =
	| 'initial'
	| 'navigation'
	| 'pushstate'
	| 'replacestate'
	| 'popstate';

export interface PageDetection {
	url: string;
	timestamp: number;
	fingerprint: EnvironmentFingerprint;
	triggerType: PageDetectionTrigger;
}

export interface DetectionPhase {
	id: string;
	startTimestamp: number;
	endTimestamp: number;
	fingerprint: EnvironmentFingerprint;
	pages: PageDetection[];
}

// Outras variantes (network, console, route, error, state) virão em Phase 1b.
export type SessionEvent =
	| { type: 'detection'; timestamp: number; phaseId: string };

export interface SessionMetadata {
	initialUrl: string;
	userAgent: string;
	viewportSize: { w: number; h: number };
	canvasCaptureEnabled: boolean;
}

export type SessionOrigin = 'recorded' | 'imported';

export interface Session {
	id: string;
	schemaVersion: 1;
	startedAt: number;
	// null = sessão ainda em gravação; number = timestamp de encerramento.
	endedAt: number | null;
	origin: SessionOrigin;
	tabId: number;
	metadata: SessionMetadata;
	detectionPhases: DetectionPhase[];
	events: SessionEvent[];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/session/types.ts
git commit -m "feat(session): tipos centrais de Session, DetectionPhase, fingerprint"
```

---

## Task 2: IndexedDB store `sessions`

**Files:**
- Modify: `app/src/lib/indexedDB.ts` (bump da versão de 1 pra 2)
- Create: `app/src/lib/session/storage.ts`
- Test: `app/src/lib/session/__tests__/storage.test.ts`

- [ ] **Step 1: Ler `app/src/lib/indexedDB.ts` pra entender o padrão atual**

Olhe especialmente como `IndexedDBServiceImpl` abre o DB, faz `onupgradeneeded` e expõe métodos pro store `requests`.

- [ ] **Step 2: Escrever teste de storage que falha**

Arquivo `app/src/lib/session/__tests__/storage.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { sessionStore } from '../storage';
import type { Session } from '../types';

const baseSession = (overrides: Partial<Session> = {}): Session => ({
	id: 'sess-1',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: null,
	origin: 'recorded',
	tabId: 42,
	metadata: {
		initialUrl: 'https://example.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
	...overrides,
});

describe('sessionStore', () => {
	beforeEach(async () => {
		await sessionStore.clear();
	});

	afterEach(async () => {
		await sessionStore.clear();
	});

	it('persiste e recupera uma session pelo id', async () => {
		const s = baseSession();
		await sessionStore.put(s);
		const got = await sessionStore.get('sess-1');
		expect(got).toEqual(s);
	});

	it('lista sessions ordenadas por startedAt desc', async () => {
		await sessionStore.put(baseSession({ id: 'a', startedAt: 1 }));
		await sessionStore.put(baseSession({ id: 'b', startedAt: 3 }));
		await sessionStore.put(baseSession({ id: 'c', startedAt: 2 }));
		const list = await sessionStore.list();
		expect(list.map((s) => s.id)).toEqual(['b', 'c', 'a']);
	});

	it('encontra session ativa por tabId (endedAt === null)', async () => {
		await sessionStore.put(baseSession({ id: 'closed', tabId: 7, endedAt: 5 }));
		await sessionStore.put(baseSession({ id: 'active', tabId: 7, endedAt: null }));
		const active = await sessionStore.findActiveByTab(7);
		expect(active?.id).toBe('active');
	});

	it('retorna null quando não há session ativa pra tab', async () => {
		const active = await sessionStore.findActiveByTab(99);
		expect(active).toBeNull();
	});

	it('delete remove a session', async () => {
		await sessionStore.put(baseSession({ id: 'gone' }));
		await sessionStore.delete('gone');
		expect(await sessionStore.get('gone')).toBeNull();
	});

	it('count retorna número total', async () => {
		await sessionStore.put(baseSession({ id: 'a' }));
		await sessionStore.put(baseSession({ id: 'b' }));
		expect(await sessionStore.count()).toBe(2);
	});
});
```

- [ ] **Step 3: Adicionar `fake-indexeddb` ao projeto se ainda não estiver**

```bash
cd app && npm install --save-dev fake-indexeddb
```

Verificar se `app/vitest.setup.ts` já importa algo equivalente. Se não, deixar `'fake-indexeddb/auto'` no setup global é mais limpo do que importar em cada arquivo de teste — adicionar:

```ts
// app/vitest.setup.ts
import 'fake-indexeddb/auto';
```

E remover o `import 'fake-indexeddb/auto'` do arquivo de teste.

- [ ] **Step 4: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/lib/session/__tests__/storage.test.ts
```

Esperado: FAIL — `Cannot find module '../storage'`.

- [ ] **Step 5: Implementar storage.ts**

Arquivo `app/src/lib/session/storage.ts`:

```ts
import type { Session } from './types';

const DB_NAME = 'debugger-extension-db';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('startedAt', 'startedAt');
				store.createIndex('tabId', 'tabId');
				// Sem índice composto em endedAt: null não entra em índices na maioria
				// das implementações de IndexedDB. findActiveByTab filtra em JS.
			}
			// Mantém o store 'requests' existente intacto.
			if (!db.objectStoreNames.contains('requests')) {
				const reqs = db.createObjectStore('requests', { keyPath: 'id' });
				reqs.createIndex('url', 'data.url');
				reqs.createIndex('timestamp', 'data.timestamp');
				reqs.createIndex('method', 'data.method');
				reqs.createIndex('status', 'data.status');
			}
		};
	});
}

async function withStore<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
	const db = await openDB();
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, mode);
		const store = tx.objectStore(STORE_NAME);
		Promise.resolve(fn(store)).then(resolve, reject);
		tx.onerror = () => reject(tx.error);
	});
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export const sessionStore = {
	async put(session: Session): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.put(session)));
	},

	async get(id: string): Promise<Session | null> {
		const got = await withStore('readonly', (store) => reqToPromise(store.get(id)));
		return (got as Session | undefined) ?? null;
	},

	async list(): Promise<Session[]> {
		const all = await withStore('readonly', (store) => reqToPromise(store.getAll()));
		return (all as Session[]).slice().sort((a, b) => b.startedAt - a.startedAt);
	},

	async findActiveByTab(tabId: number): Promise<Session | null> {
		const all = await withStore('readonly', (store) => reqToPromise(store.getAll()));
		return (all as Session[]).find((s) => s.tabId === tabId && s.endedAt === null) ?? null;
	},

	async delete(id: string): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.delete(id)));
	},

	async count(): Promise<number> {
		return withStore('readonly', (store) => reqToPromise(store.count()));
	},

	async clear(): Promise<void> {
		await withStore('readwrite', (store) => reqToPromise(store.clear()));
	},
};
```

> **Por quê dois `if (!db.objectStoreNames.contains(...))`:** o `onupgradeneeded` roda também na primeira instalação do DB v2; se um usuário pular do v0 direto pro v2 (instalação limpa), o store `requests` ainda precisa ser criado aqui, senão quebra a feature de interceptação atual. Replicamos a definição que está em `lib/indexedDB.ts`. Não esqueça de checar se `lib/indexedDB.ts` precisa ter a versão do DB também bumpada pra 2 (mesma constante) pra não disputarem `onupgradeneeded` em ordens diferentes.

- [ ] **Step 6: Atualizar `app/src/lib/indexedDB.ts` pra usar `DB_VERSION = 2`**

Localizar a constante de versão (provavelmente `const DB_VERSION = 1;` ou similar) e bumpar para 2. Garantir que o `onupgradeneeded` do arquivo existente também seja chamado quando o store `sessions` é criado, ou (preferencial) consolidar a abertura do DB em um único helper. Pra Phase 1a, basta bumpar a versão e replicar a criação do store `sessions` no upgrade existente — extrair helper depois.

Edit a aplicar (exemplo de padrão; ajustar pelos nomes reais do arquivo):

```ts
// Antes
const DB_VERSION = 1;

// Depois
const DB_VERSION = 2;

// Dentro do onupgradeneeded:
if (!db.objectStoreNames.contains('sessions')) {
	const store = db.createObjectStore('sessions', { keyPath: 'id' });
	store.createIndex('startedAt', 'startedAt');
	store.createIndex('tabId', 'tabId');
}
```

- [ ] **Step 7: Rodar testes pra ver passar**

```bash
cd app && npx vitest run src/lib/session/__tests__/storage.test.ts
```

Esperado: PASS — todos os 6 testes verdes.

Rodar suite inteira pra garantir que não quebrou storage atual:

```bash
cd app && npm test
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/session/ app/src/lib/indexedDB.ts app/vitest.setup.ts app/package.json app/package-lock.json
git commit -m "feat(session): storage IndexedDB para Sessions (DB v2)"
```

---

## Task 3: Comparação de fingerprints + agrupamento

**Files:**
- Create: `app/src/lib/session/fingerprint.ts`
- Test: `app/src/lib/session/__tests__/fingerprint.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Arquivo `app/src/lib/session/__tests__/fingerprint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	fingerprintsEqual,
	sameSet,
	groupConsecutiveDetections,
} from '../fingerprint';
import type { EnvironmentFingerprint, PageDetection } from '../types';

const fp = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
	framework: { name: 'react', version: '18.2.0' },
	httpClients: [{ name: 'fetch', confidence: 'high' }],
	dataFetching: [],
	stateManagers: [],
	detectedAt: 0,
	isProductionBuild: false,
	...overrides,
});

const page = (url: string, ts: number, fingerprint: EnvironmentFingerprint): PageDetection => ({
	url,
	timestamp: ts,
	fingerprint,
	triggerType: 'navigation',
});

describe('sameSet', () => {
	it('compara conjuntos por chave canônica, ignorando ordem', () => {
		expect(sameSet([1, 2, 3], [3, 2, 1], (n) => `${n}`)).toBe(true);
		expect(sameSet([1, 2], [1, 2, 3], (n) => `${n}`)).toBe(false);
		expect(sameSet([], [], (n) => `${n}`)).toBe(true);
	});
});

describe('fingerprintsEqual', () => {
	it('retorna true para fingerprints estruturalmente idênticos', () => {
		expect(fingerprintsEqual(fp(), fp())).toBe(true);
	});

	it('ignora detectedAt e isProductionBuild na comparação', () => {
		expect(
			fingerprintsEqual(
				fp({ detectedAt: 1, isProductionBuild: true }),
				fp({ detectedAt: 999, isProductionBuild: false }),
			),
		).toBe(true);
	});

	it('detecta versão de framework diferente', () => {
		expect(
			fingerprintsEqual(
				fp({ framework: { name: 'react', version: '18.2.0' } }),
				fp({ framework: { name: 'react', version: '17.0.0' } }),
			),
		).toBe(false);
	});

	it('detecta framework diferente', () => {
		expect(
			fingerprintsEqual(
				fp({ framework: { name: 'react' } }),
				fp({ framework: { name: 'angular' } }),
			),
		).toBe(false);
	});

	it('detecta lib nova adicionada', () => {
		expect(
			fingerprintsEqual(
				fp({ dataFetching: [] }),
				fp({ dataFetching: [{ name: 'apollo', treatment: 'detection-only' }] }),
			),
		).toBe(false);
	});

	it('detecta confidence diferente em http client', () => {
		expect(
			fingerprintsEqual(
				fp({ httpClients: [{ name: 'fetch', confidence: 'high' }] }),
				fp({ httpClients: [{ name: 'fetch', confidence: 'low' }] }),
			),
		).toBe(false);
	});
});

describe('groupConsecutiveDetections', () => {
	it('agrupa detections consecutivas com fingerprint idêntico em uma fase', () => {
		const f = fp();
		const phases = groupConsecutiveDetections([
			page('https://x.test/a', 1, f),
			page('https://x.test/b', 2, f),
			page('https://x.test/c', 3, f),
		]);
		expect(phases).toHaveLength(1);
		expect(phases[0].pages.map((p) => p.url)).toEqual([
			'https://x.test/a',
			'https://x.test/b',
			'https://x.test/c',
		]);
		expect(phases[0].startTimestamp).toBe(1);
		expect(phases[0].endTimestamp).toBe(3);
	});

	it('cria nova fase quando fingerprint muda', () => {
		const reactFp = fp();
		const angularFp = fp({ framework: { name: 'angular', version: '17' } });
		const phases = groupConsecutiveDetections([
			page('https://r.test/', 1, reactFp),
			page('https://r.test/x', 2, reactFp),
			page('https://a.test/', 3, angularFp),
		]);
		expect(phases).toHaveLength(2);
		expect(phases[0].pages).toHaveLength(2);
		expect(phases[1].pages).toHaveLength(1);
		expect(phases[1].fingerprint.framework.name).toBe('angular');
	});

	it('cada fase recebe id único', () => {
		const phases = groupConsecutiveDetections([
			page('https://a/', 1, fp()),
			page('https://b/', 2, fp({ framework: { name: 'angular' } })),
		]);
		expect(phases[0].id).not.toBe(phases[1].id);
	});

	it('lista vazia → array vazio', () => {
		expect(groupConsecutiveDetections([])).toEqual([]);
	});
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/lib/session/__tests__/fingerprint.test.ts
```

Esperado: FAIL — `Cannot find module '../fingerprint'`.

- [ ] **Step 3: Implementar fingerprint.ts**

Arquivo `app/src/lib/session/fingerprint.ts`:

```ts
import type {
	DetectionPhase,
	EnvironmentFingerprint,
	PageDetection,
} from './types';

export function sameSet<T>(a: T[], b: T[], key: (item: T) => string): boolean {
	if (a.length !== b.length) return false;
	const ak = a.map(key).sort();
	const bk = b.map(key).sort();
	for (let i = 0; i < ak.length; i++) {
		if (ak[i] !== bk[i]) return false;
	}
	return true;
}

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
	if (
		!sameSet(
			a.stateManagers,
			b.stateManagers,
			(s) => `${s.name}:${s.storesDetected}:${s.treatment}`,
		)
	) {
		return false;
	}
	return true;
}

function newPhaseId(): string {
	return `phase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function groupConsecutiveDetections(
	detections: PageDetection[],
): DetectionPhase[] {
	if (detections.length === 0) return [];
	const phases: DetectionPhase[] = [];
	let current: DetectionPhase = {
		id: newPhaseId(),
		startTimestamp: detections[0].timestamp,
		endTimestamp: detections[0].timestamp,
		fingerprint: detections[0].fingerprint,
		pages: [detections[0]],
	};
	for (let i = 1; i < detections.length; i++) {
		const d = detections[i];
		if (fingerprintsEqual(current.fingerprint, d.fingerprint)) {
			current.pages.push(d);
			current.endTimestamp = d.timestamp;
		} else {
			phases.push(current);
			current = {
				id: newPhaseId(),
				startTimestamp: d.timestamp,
				endTimestamp: d.timestamp,
				fingerprint: d.fingerprint,
				pages: [d],
			};
		}
	}
	phases.push(current);
	return phases;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

```bash
cd app && npx vitest run src/lib/session/__tests__/fingerprint.test.ts
```

Esperado: PASS — todos verdes.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/fingerprint.ts app/src/lib/session/__tests__/fingerprint.test.ts
git commit -m "feat(session): comparação de fingerprints e agrupamento em DetectionPhase"
```

---

## Task 4: Detector de framework (React, Angular, vanilla)

**Files:**
- Create: `app/src/probe/detectors/framework.ts`
- Test: `app/src/probe/detectors/__tests__/framework.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Arquivo `app/src/probe/detectors/__tests__/framework.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { detectFramework } from '../framework';

declare global {
	interface Window {
		__REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
		ng?: unknown;
	}
}

describe('detectFramework', () => {
	afterEach(() => {
		delete (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
			.__REACT_DEVTOOLS_GLOBAL_HOOK__;
		delete (window as unknown as { ng?: unknown }).ng;
		document.body.innerHTML = '';
	});

	it('detecta React via __REACT_DEVTOOLS_GLOBAL_HOOK__ com versão', () => {
		(window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			renderers: new Map([[1, { version: '18.2.0' }]]),
		};
		expect(detectFramework()).toEqual({ name: 'react', version: '18.2.0' });
	});

	it('detecta React via hook sem versão (renderers vazio)', () => {
		(window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			renderers: new Map(),
		};
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React 18 via fallback __reactContainer$', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactContainer$xyz = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React 17 via fallback __reactFiber$', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactFiber$abc = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React 16 via fallback __reactInternalInstance$', () => {
		const root = document.createElement('div');
		root.id = 'root';
		(root as unknown as Record<string, unknown>).__reactInternalInstance$xyz = {};
		document.body.appendChild(root);
		expect(detectFramework()).toEqual({ name: 'react' });
	});

	it('detecta React via renderers em formato Record', () => {
		(window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			renderers: { '1': { version: '17.0.2' } },
		};
		expect(detectFramework()).toEqual({ name: 'react', version: '17.0.2' });
	});

	it('ignora window.ng quando objeto não tem APIs do Angular (false positive guard)', () => {
		// AngularJS e libs que squatam window.ng não devem virar Angular detection
		(window as unknown as { ng: unknown }).ng = { version: 'AngularJS 1.x' };
		expect(detectFramework()).toEqual({ name: 'vanilla' });
	});

	it('detecta Angular via window.ng + ng-version', () => {
		(window as unknown as { ng: unknown }).ng = { getComponent: () => null };
		const meta = document.createElement('app-root');
		meta.setAttribute('ng-version', '17.3.0');
		document.body.appendChild(meta);
		expect(detectFramework()).toEqual({ name: 'angular', version: '17.3.0' });
	});

	it('detecta Angular só via ng-version (sem window.ng)', () => {
		const meta = document.createElement('app-root');
		meta.setAttribute('ng-version', '14.0.0');
		document.body.appendChild(meta);
		expect(detectFramework()).toEqual({ name: 'angular', version: '14.0.0' });
	});

	it('retorna vanilla quando nada é detectado', () => {
		expect(detectFramework()).toEqual({ name: 'vanilla' });
	});
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/framework.test.ts
```

Esperado: FAIL — module não encontrado.

- [ ] **Step 3: Implementar framework.ts**

Arquivo `app/src/probe/detectors/framework.ts`:

```ts
import type { FrameworkName } from '@/lib/session/types';

interface FrameworkResult {
	name: FrameworkName;
	version?: string;
}

interface ReactDevtoolsHook {
	renderers?: Map<number, { version?: string }> | Record<string, { version?: string }>;
}

function detectReact(): FrameworkResult | null {
	const hook = (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevtoolsHook })
		.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	if (hook?.renderers) {
		const renderers = hook.renderers;
		if (renderers instanceof Map) {
			for (const r of renderers.values()) {
				if (r.version) return { name: 'react', version: r.version };
			}
			if (renderers.size > 0) return { name: 'react' };
		} else {
			for (const r of Object.values(renderers)) {
				if (r.version) return { name: 'react', version: r.version };
			}
			if (Object.keys(renderers).length > 0) return { name: 'react' };
		}
	}
	if (hook) return { name: 'react' };

	// Fallback: fiber container em qualquer elemento root comum.
	// React 18: __reactContainer$. React 17: __reactFiber$. React 16: __reactInternalInstance$.
	const candidates = document.querySelectorAll('[data-reactroot], #root, #__next');
	for (const node of candidates) {
		const keys = Object.keys(node as unknown as Record<string, unknown>);
		if (
			keys.some(
				(k) =>
					k.startsWith('__reactContainer') ||
					k.startsWith('__reactFiber') ||
					k.startsWith('__reactInternalInstance'),
			)
		) {
			return { name: 'react' };
		}
	}
	return null;
}

interface AngularNgGlobal {
	getComponent?: unknown;
	getDirectives?: unknown;
	getDebugNode?: unknown;
}

function detectAngular(): FrameworkResult | null {
	const ngObj = (window as unknown as { ng?: AngularNgGlobal }).ng;
	// Guard contra false positive: AngularJS e libs que squatam `ng` não têm getComponent/etc.
	const hasNgApis =
		ngObj !== undefined &&
		ngObj !== null &&
		typeof ngObj === 'object' &&
		('getComponent' in ngObj || 'getDirectives' in ngObj || 'getDebugNode' in ngObj);
	const versioned = document.querySelector('[ng-version]');
	if (versioned) {
		const version = versioned.getAttribute('ng-version') ?? undefined;
		return { name: 'angular', version };
	}
	if (hasNgApis) return { name: 'angular' };
	return null;
}

export function detectFramework(): FrameworkResult {
	return detectReact() ?? detectAngular() ?? { name: 'vanilla' };
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/framework.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/probe/detectors/framework.ts app/src/probe/detectors/__tests__/framework.test.ts
git commit -m "feat(probe): detector de framework (React, Angular, vanilla)"
```

---

## Task 5: Detector de state managers (Redux na Phase 1a)

**Files:**
- Create: `app/src/probe/detectors/stateManagers.ts`
- Test: `app/src/probe/detectors/__tests__/stateManagers.test.ts`

> **Cobertura Phase 1a:** apenas Redux (via DevTools hook). Zustand, MobX, Jotai, NgRx, Angular signals exigem hooks em `create()` / store factories ou tap reativo, que vêm na Phase 4. Esses retornam vazio em Phase 1a — documentado no array de retorno.

- [ ] **Step 1: Escrever teste falhando**

Arquivo `app/src/probe/detectors/__tests__/stateManagers.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { detectStateManagers } from '../stateManagers';

afterEach(() => {
	delete (window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown })
		.__REDUX_DEVTOOLS_EXTENSION__;
});

describe('detectStateManagers', () => {
	it('detecta Redux via __REDUX_DEVTOOLS_EXTENSION__', () => {
		(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__: unknown })
			.__REDUX_DEVTOOLS_EXTENSION__ = () => null;
		const got = detectStateManagers();
		expect(got).toContainEqual({
			name: 'redux',
			storesDetected: 0,
			treatment: 'tracked',
		});
	});

	it('retorna vazio quando nada é detectado', () => {
		expect(detectStateManagers()).toEqual([]);
	});
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/stateManagers.test.ts
```

Esperado: FAIL — module não encontrado.

- [ ] **Step 3: Implementar stateManagers.ts**

Arquivo `app/src/probe/detectors/stateManagers.ts`:

```ts
import type { StateManagerDetection } from '@/lib/session/types';

export function detectStateManagers(): StateManagerDetection[] {
	const out: StateManagerDetection[] = [];

	// Redux: presença do hook do DevTools. Phase 1a não conta stores
	// (precisa wrappar createStore). storesDetected=0 sinaliza "presente, não contado".
	if ((window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown })
		.__REDUX_DEVTOOLS_EXTENSION__) {
		out.push({ name: 'redux', storesDetected: 0, treatment: 'tracked' });
	}

	// Zustand, MobX, Jotai, NgRx, Angular signals: detecção robusta exige
	// hooks em create() / store factories. Implementado em Phase 4.

	return out;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/stateManagers.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/probe/detectors/stateManagers.ts app/src/probe/detectors/__tests__/stateManagers.test.ts
git commit -m "feat(probe): detector de state managers (Redux na Phase 1a)"
```

---

## Task 6: Detector de data fetching (Apollo, TanStack como detection-only)

**Files:**
- Create: `app/src/probe/detectors/dataFetching.ts`
- Test: `app/src/probe/detectors/__tests__/dataFetching.test.ts`

> **Cobertura Phase 1a:** Apollo (via `__APOLLO_CLIENT__`) e TanStack Query (via `__TANSTACK_QUERY_CLIENT__`). Ambos com `treatment: 'detection-only'` conforme spec. SWR, urql, Relay, RTK Query exigem signatures de comportamento mais complexas e ficam pra v1.x.

- [ ] **Step 1: Escrever teste falhando**

Arquivo `app/src/probe/detectors/__tests__/dataFetching.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { detectDataFetching } from '../dataFetching';

afterEach(() => {
	delete (window as unknown as { __APOLLO_CLIENT__?: unknown }).__APOLLO_CLIENT__;
	delete (window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown })
		.__TANSTACK_QUERY_CLIENT__;
});

describe('detectDataFetching', () => {
	it('detecta Apollo via __APOLLO_CLIENT__ com version', () => {
		(window as unknown as { __APOLLO_CLIENT__: unknown }).__APOLLO_CLIENT__ = {
			version: '3.9.0',
		};
		expect(detectDataFetching()).toContainEqual({
			name: 'apollo',
			version: '3.9.0',
			treatment: 'detection-only',
		});
	});

	it('detecta Apollo sem version', () => {
		(window as unknown as { __APOLLO_CLIENT__: unknown }).__APOLLO_CLIENT__ = {};
		expect(detectDataFetching()).toContainEqual({
			name: 'apollo',
			treatment: 'detection-only',
		});
	});

	it('detecta TanStack Query via __TANSTACK_QUERY_CLIENT__', () => {
		(window as unknown as { __TANSTACK_QUERY_CLIENT__: unknown }).__TANSTACK_QUERY_CLIENT__ = {};
		expect(detectDataFetching()).toContainEqual({
			name: 'tanstack-query',
			treatment: 'detection-only',
		});
	});

	it('retorna vazio quando nada é detectado', () => {
		expect(detectDataFetching()).toEqual([]);
	});
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/dataFetching.test.ts
```

Esperado: FAIL.

- [ ] **Step 3: Implementar dataFetching.ts**

Arquivo `app/src/probe/detectors/dataFetching.ts`:

```ts
import type { DataFetchingDetection } from '@/lib/session/types';

export function detectDataFetching(): DataFetchingDetection[] {
	const out: DataFetchingDetection[] = [];

	const apollo = (window as unknown as { __APOLLO_CLIENT__?: { version?: string } })
		.__APOLLO_CLIENT__;
	if (apollo) {
		const entry: DataFetchingDetection = { name: 'apollo', treatment: 'detection-only' };
		if (apollo.version) entry.version = apollo.version;
		out.push(entry);
	}

	const tanstack = (window as unknown as { __TANSTACK_QUERY_CLIENT__?: unknown })
		.__TANSTACK_QUERY_CLIENT__;
	if (tanstack) {
		out.push({ name: 'tanstack-query', treatment: 'detection-only' });
	}

	// SWR, urql, Relay, RTK Query: signatures de comportamento (parsing de
	// stack em fetch, headers, etc.) ficam pra v1.x.

	return out;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/dataFetching.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/probe/detectors/dataFetching.ts app/src/probe/detectors/__tests__/dataFetching.test.ts
git commit -m "feat(probe): detector de data fetching (Apollo, TanStack como detection-only)"
```

---

## Task 7: Detector de http clients (fetch, XHR, Axios)

**Files:**
- Create: `app/src/probe/detectors/httpClients.ts`
- Test: `app/src/probe/detectors/__tests__/httpClients.test.ts`

> **Cobertura Phase 1a:** fetch nativo (sempre presente, confidence high), XMLHttpRequest (sempre presente, confidence high), Axios via heurística (procura por `Axios` em `window` ou nome `dispatchXhrRequest` em stack capturado). Angular HttpClient + ky ficam pra fases posteriores.

- [ ] **Step 1: Escrever teste falhando**

Arquivo `app/src/probe/detectors/__tests__/httpClients.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { detectHttpClients } from '../httpClients';

afterEach(() => {
	delete (window as unknown as { axios?: unknown }).axios;
});

describe('detectHttpClients', () => {
	it('sempre detecta fetch e XHR com confidence high', () => {
		const got = detectHttpClients();
		expect(got).toContainEqual({ name: 'fetch', confidence: 'high' });
		expect(got).toContainEqual({ name: 'xhr', confidence: 'high' });
	});

	it('detecta Axios via window.axios', () => {
		(window as unknown as { axios: unknown }).axios = { create: () => null };
		const got = detectHttpClients();
		expect(got).toContainEqual({ name: 'axios', confidence: 'high' });
	});

	it('sem Axios, não inclui axios', () => {
		const got = detectHttpClients();
		expect(got.find((c) => c.name === 'axios')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/httpClients.test.ts
```

Esperado: FAIL.

- [ ] **Step 3: Implementar httpClients.ts**

Arquivo `app/src/probe/detectors/httpClients.ts`:

```ts
import type { HttpClientDetection } from '@/lib/session/types';

export function detectHttpClients(): HttpClientDetection[] {
	const out: HttpClientDetection[] = [
		{ name: 'fetch', confidence: 'high' },
		{ name: 'xhr', confidence: 'high' },
	];

	// Axios: heurística primária via global window.axios (apps que importam UMD).
	// Heurística secundária (parse de stack em fetch) requer hook em fetch que
	// chega na Phase 1b. Por enquanto, só global.
	if ((window as unknown as { axios?: unknown }).axios) {
		out.push({ name: 'axios', confidence: 'high' });
	}

	return out;
}
```

- [ ] **Step 4: Rodar teste pra ver passar**

```bash
cd app && npx vitest run src/probe/detectors/__tests__/httpClients.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/probe/detectors/httpClients.ts app/src/probe/detectors/__tests__/httpClients.test.ts
git commit -m "feat(probe): detector de http clients (fetch, XHR, Axios via window)"
```

---

## Task 8: Probe orchestrator MAIN-world + protocol de mensagens

**Files:**
- Create: `app/src/probe/protocol.ts`
- Create: `app/src/probe/main.ts`

> **Por que sem teste unitário aqui:** `main.ts` roda com `window.postMessage` e depende de `document_start` no MAIN world. Testes unitários do orquestrador iriam só verificar que ele compõe os detectors (que já têm cobertura). Cobertura E2E aparece na Task 13.

- [ ] **Step 1: Criar protocolo de mensagens**

Arquivo `app/src/probe/protocol.ts`:

```ts
import type { EnvironmentFingerprint, PageDetectionTrigger } from '@/lib/session/types';

export const PROBE_NAMESPACE = 'debug-buddy-probe';

export type ProbeMessage =
	| { ns: typeof PROBE_NAMESPACE; type: 'probe:start-detection'; reason: PageDetectionTrigger }
	| { ns: typeof PROBE_NAMESPACE; type: 'probe:idle' }
	| {
			ns: typeof PROBE_NAMESPACE;
			type: 'probe:detection';
			payload: {
				url: string;
				timestamp: number;
				triggerType: PageDetectionTrigger;
				fingerprint: EnvironmentFingerprint;
			};
	  };

export function isProbeMessage(value: unknown): value is ProbeMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { ns?: unknown }).ns === PROBE_NAMESPACE
	);
}
```

- [ ] **Step 2: Implementar main.ts**

Arquivo `app/src/probe/main.ts`:

```ts
import { detectDataFetching } from './detectors/dataFetching';
import { detectFramework } from './detectors/framework';
import { detectHttpClients } from './detectors/httpClients';
import { detectStateManagers } from './detectors/stateManagers';
import { isProbeMessage, PROBE_NAMESPACE, type ProbeMessage } from './protocol';
import type { EnvironmentFingerprint, PageDetectionTrigger } from '@/lib/session/types';

let active = false;

function isProductionBuild(): boolean {
	// Heurística leve: ausência de hooks de devtools em React/Angular sugere prod build.
	// Refinar em Phase 4-5 com sinais adicionais (minificação detectada, source maps absent).
	const hasReactDevtools = !!(window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
		.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	const hasReduxDevtools = !!(window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: unknown })
		.__REDUX_DEVTOOLS_EXTENSION__;
	return !hasReactDevtools && !hasReduxDevtools;
}

function buildFingerprint(): EnvironmentFingerprint {
	return {
		framework: detectFramework(),
		httpClients: detectHttpClients(),
		dataFetching: detectDataFetching(),
		stateManagers: detectStateManagers(),
		detectedAt: Date.now(),
		isProductionBuild: isProductionBuild(),
	};
}

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
		},
	};
	window.postMessage(msg, location.origin);
}

function patchHistoryForSpaRouting(): void {
	const origPush = history.pushState;
	const origReplace = history.replaceState;
	history.pushState = function (...args) {
		const ret = origPush.apply(this, args);
		emitDetection('pushstate');
		return ret;
	};
	history.replaceState = function (...args) {
		const ret = origReplace.apply(this, args);
		emitDetection('replacestate');
		return ret;
	};
	window.addEventListener('popstate', () => emitDetection('popstate'));
}

window.addEventListener('message', (e: MessageEvent) => {
	if (e.source !== window) return;
	if (!isProbeMessage(e.data)) return;
	if (e.data.type === 'probe:start-detection') {
		const wasActive = active;
		active = true;
		if (!wasActive) patchHistoryForSpaRouting();
		emitDetection(e.data.reason);
	} else if (e.data.type === 'probe:idle') {
		active = false;
	}
});
```

- [ ] **Step 3: Verificar build do TypeScript**

```bash
cd app && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add app/src/probe/main.ts app/src/probe/protocol.ts
git commit -m "feat(probe): orquestrador MAIN-world + protocolo de mensagens"
```

---

## Task 9: Bridge isolated content script

**Files:**
- Create: `app/src/probe/bridge.ts`

> **Por que sem teste unitário:** bridge depende de `window.postMessage` ↔ `chrome.runtime.sendMessage`. Cobertura via E2E na Task 13.

- [ ] **Step 1: Implementar bridge.ts**

Arquivo `app/src/probe/bridge.ts`:

```ts
import { isProbeMessage, PROBE_NAMESPACE, type ProbeMessage } from './protocol';

// Recebe mensagens do MAIN (probe) e relaya pro background via chrome.runtime.
window.addEventListener('message', (e: MessageEvent) => {
	if (e.source !== window) return;
	if (!isProbeMessage(e.data)) return;
	if (e.data.type !== 'probe:detection') return;
	chrome.runtime.sendMessage({
		action: 'pageDetected',
		payload: e.data.payload,
	});
});

// Recebe mensagens do background e relaya pro MAIN (probe) via postMessage.
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
	if (message?.action === 'probeStartDetection') {
		const msg: ProbeMessage = {
			ns: PROBE_NAMESPACE,
			type: 'probe:start-detection',
			reason: message.reason,
		};
		window.postMessage(msg, location.origin);
	} else if (message?.action === 'probeIdle') {
		const msg: ProbeMessage = {
			ns: PROBE_NAMESPACE,
			type: 'probe:idle',
		};
		window.postMessage(msg, location.origin);
	}
	return false;
});
```

- [ ] **Step 2: Verificar build TypeScript**

```bash
cd app && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add app/src/probe/bridge.ts
git commit -m "feat(probe): bridge isolated content script (postMessage ↔ chrome.runtime)"
```

---

## Task 10: Vite + manifest — registrar probe + bridge como content scripts

**Files:**
- Modify: `app/vite.config.mts`
- Modify: `app/manifest.json`

- [ ] **Step 1: Ler `app/vite.config.mts` e `app/manifest.json` pra entender o padrão atual**

- [ ] **Step 2: Adicionar entries no Vite**

Em `app/vite.config.mts`, dentro de `build.rollupOptions.input`, adicionar:

```ts
input: {
	options: resolve(__dirname, 'options.html'),
	sidepanel: resolve(__dirname, 'sidepanel.html'),
	background: resolve(__dirname, 'src/entrypoints/background.ts'),
	main: resolve(__dirname, 'src/entrypoints/options/main.tsx'),
	'probe-main': resolve(__dirname, 'src/probe/main.ts'),
	'probe-bridge': resolve(__dirname, 'src/probe/bridge.ts'),
},
```

`output.entryFileNames: '[name].js'` já está configurado, então sai como `probe-main.js` e `probe-bridge.js` em `dist/`.

- [ ] **Step 3: Adicionar content_scripts ao manifest**

Em `app/manifest.json`, adicionar (ou estender se já existir) o campo `content_scripts`:

```json
{
	"content_scripts": [
		{
			"matches": ["<all_urls>"],
			"js": ["probe-main.js"],
			"run_at": "document_start",
			"world": "MAIN"
		},
		{
			"matches": ["<all_urls>"],
			"js": ["probe-bridge.js"],
			"run_at": "document_start",
			"world": "ISOLATED"
		}
	]
}
```

> **Atenção:** o probe é **noop até receber `probe:start-detection`** do bridge (que só é enviado quando o background sinaliza Recording ON). O custo de execução em tabs irrelevantes é apenas o registro do listener `message` — alguns bytes de runtime, sem alocação significativa.

- [ ] **Step 4: Build de produção**

```bash
cd app && npm run build
```

Esperado: build completa, `dist/probe-main.js` e `dist/probe-bridge.js` existem.

```bash
ls -lh app/dist/probe-*.js
```

- [ ] **Step 5: Smoke test manual da injeção**

1. `chrome://extensions` → Developer mode → "Load unpacked" → selecionar `app/dist/`.
2. Abrir uma página qualquer (ex: `https://react.dev`).
3. DevTools → Console (na tab da página, não no service worker) → executar:
   ```js
   window.postMessage({
   	ns: 'debug-buddy-probe',
   	type: 'probe:start-detection',
   	reason: 'initial',
   }, location.origin);
   ```
4. Verificar no DevTools do **service worker** (chrome://extensions → "Service worker" link da Debug Buddy) que apareceu mensagem `pageDetected` recebida pelo bridge.

> **Se não aparecer:** confirmar que `probe-main.js` foi injetado em document_start (DevTools → Sources → Content scripts) e que o bridge está rodando no isolated world. Comum esquecer o `world: "MAIN"` ou o `world: "ISOLATED"` no manifest.

- [ ] **Step 6: Commit**

```bash
git add app/vite.config.mts app/manifest.json
git commit -m "build(probe): registra probe-main e probe-bridge como content scripts"
```

---

## Task 11: Recorder (esqueleto mínimo)

**Files:**
- Create: `app/src/lib/session/recorder.ts`
- Test: `app/src/lib/session/__tests__/recorder.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Arquivo `app/src/lib/session/__tests__/recorder.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recorder } from '../recorder';
import { sessionStore } from '../storage';
import type { EnvironmentFingerprint, PageDetection } from '../types';

const fp = (overrides: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
	framework: { name: 'react', version: '18.2.0' },
	httpClients: [{ name: 'fetch', confidence: 'high' }],
	dataFetching: [],
	stateManagers: [],
	detectedAt: 0,
	isProductionBuild: false,
	...overrides,
});

const page = (url: string, ts: number, fingerprint: EnvironmentFingerprint): PageDetection => ({
	url,
	timestamp: ts,
	fingerprint,
	triggerType: 'navigation',
});

beforeEach(async () => {
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('recorder', () => {
	it('startSession cria uma session ativa pra tab', async () => {
		const id = await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://example/',
			userAgent: 'jsdom',
			viewportSize: { w: 1280, h: 720 },
			canvasCaptureEnabled: false,
		});
		const got = await sessionStore.get(id);
		expect(got?.tabId).toBe(7);
		expect(got?.endedAt).toBeNull();
		expect(got?.origin).toBe('recorded');
		expect(got?.detectionPhases).toEqual([]);
	});

	it('startSession recusa se já existe session ativa pra tab', async () => {
		await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await expect(
			recorder.startSession({
				tabId: 7,
				initialUrl: 'https://y/',
				userAgent: '',
				viewportSize: { w: 1, h: 1 },
				canvasCaptureEnabled: false,
			}),
		).rejects.toThrow(/já existe/i);
	});

	it('addPage agrupa em phase única quando fingerprint repete', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/a', 10, fp()));
		await recorder.addPage(id, page('https://x/b', 20, fp()));
		const got = await sessionStore.get(id);
		expect(got?.detectionPhases).toHaveLength(1);
		expect(got?.detectionPhases[0].pages).toHaveLength(2);
		expect(got?.detectionPhases[0].endTimestamp).toBe(20);
	});

	it('addPage abre nova phase quando fingerprint muda', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder.addPage(id, page('https://y/', 20, fp({ framework: { name: 'angular' } })));
		const got = await sessionStore.get(id);
		expect(got?.detectionPhases).toHaveLength(2);
		expect(got?.detectionPhases[1].fingerprint.framework.name).toBe('angular');
	});

	it('cada nova phase emite um SessionEvent type=detection com phaseId', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		await recorder.addPage(id, page('https://y/', 20, fp({ framework: { name: 'angular' } })));
		const got = await sessionStore.get(id);
		const detectionEvents = got?.events.filter((e) => e.type === 'detection') ?? [];
		expect(detectionEvents).toHaveLength(2);
		expect(detectionEvents[0].phaseId).toBe(got?.detectionPhases[0].id);
		expect(detectionEvents[1].phaseId).toBe(got?.detectionPhases[1].id);
	});

	it('stopSession marca endedAt e libera o slot da tab', async () => {
		const id = await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.stopSession(id);
		const got = await sessionStore.get(id);
		expect(got?.endedAt).toBeGreaterThan(0);
		// Permite criar nova sessão na mesma tab
		const id2 = await recorder.startSession({
			tabId: 7,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		expect(id2).not.toBe(id);
	});
});
```

- [ ] **Step 2: Rodar teste pra ver falhar**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.test.ts
```

Esperado: FAIL — module não encontrado.

- [ ] **Step 3: Implementar recorder.ts**

Arquivo `app/src/lib/session/recorder.ts`:

```ts
import { fingerprintsEqual } from './fingerprint';
import { sessionStore } from './storage';
import type {
	DetectionPhase,
	PageDetection,
	Session,
	SessionEvent,
	SessionMetadata,
} from './types';

interface StartArgs extends SessionMetadata {
	tabId: number;
}

function newSessionId(): string {
	return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function newPhaseId(): string {
	return `phase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makePhase(detection: PageDetection): DetectionPhase {
	return {
		id: newPhaseId(),
		startTimestamp: detection.timestamp,
		endTimestamp: detection.timestamp,
		fingerprint: detection.fingerprint,
		pages: [detection],
	};
}

function makeDetectionEvent(timestamp: number, phaseId: string): SessionEvent {
	return { type: 'detection', timestamp, phaseId };
}

export const recorder = {
	async startSession(args: StartArgs): Promise<string> {
		const existing = await sessionStore.findActiveByTab(args.tabId);
		if (existing) {
			throw new Error(`Já existe session ativa para tab ${args.tabId} (${existing.id})`);
		}
		const session: Session = {
			id: newSessionId(),
			schemaVersion: 1,
			startedAt: Date.now(),
			endedAt: null,
			origin: 'recorded',
			tabId: args.tabId,
			metadata: {
				initialUrl: args.initialUrl,
				userAgent: args.userAgent,
				viewportSize: args.viewportSize,
				canvasCaptureEnabled: args.canvasCaptureEnabled,
			},
			detectionPhases: [],
			events: [],
		};
		await sessionStore.put(session);
		return session.id;
	},

	async stopSession(id: string): Promise<void> {
		const s = await sessionStore.get(id);
		if (!s) throw new Error(`Session ${id} não encontrada`);
		if (s.endedAt !== null) return;
		s.endedAt = Date.now();
		await sessionStore.put(s);
	},

	async addPage(sessionId: string, detection: PageDetection): Promise<void> {
		const s = await sessionStore.get(sessionId);
		if (!s) throw new Error(`Session ${sessionId} não encontrada`);
		if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
		const last = s.detectionPhases[s.detectionPhases.length - 1];
		if (last && fingerprintsEqual(last.fingerprint, detection.fingerprint)) {
			last.pages.push(detection);
			last.endTimestamp = detection.timestamp;
		} else {
			const phase = makePhase(detection);
			s.detectionPhases.push(phase);
			s.events.push(makeDetectionEvent(detection.timestamp, phase.id));
		}
		await sessionStore.put(s);
	},

	async getActiveByTab(tabId: number): Promise<Session | null> {
		return sessionStore.findActiveByTab(tabId);
	},
};
```

- [ ] **Step 4: Rodar teste pra ver passar**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.test.ts
```

Esperado: PASS — todos verdes.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.test.ts
git commit -m "feat(session): recorder (start/stop/addPage com agrupamento em phases)"
```

---

## Task 12: Background — actions de debug + handler de pageDetected

**Files:**
- Modify: `app/src/types/messages.ts`
- Modify: `app/src/entrypoints/background.ts`

- [ ] **Step 1: Adicionar actions ao types/messages.ts**

Em `app/src/types/messages.ts`, adicionar à união de actions existente:

```ts
// Adicionar entre as actions existentes
| { action: '__debug_startSession'; tabId: number; canvasCaptureEnabled?: boolean }
| { action: '__debug_stopSession'; sessionId: string }
| {
		action: 'pageDetected';
		payload: {
			url: string;
			timestamp: number;
			triggerType: 'initial' | 'navigation' | 'pushstate' | 'replacestate' | 'popstate';
			fingerprint: import('@/lib/session/types').EnvironmentFingerprint;
		};
	}
| { action: 'getActiveSession'; tabId: number }
```

> **Por que `__debug_*`:** essas actions são portas de teste/manualidade enquanto a UI da Phase 1c não existe. Renomeadas/removidas quando o toggle visual for feito.

- [ ] **Step 2: Adicionar handlers ao background**

Em `app/src/entrypoints/background.ts`, importar:

```ts
import { recorder } from '@/lib/session/recorder';
import type { PageDetection } from '@/lib/session/types';
```

Dentro do `chrome.runtime.onMessage` listener (junto dos handlers existentes), adicionar os 4 handlers:

```ts
if (message.action === '__debug_startSession') {
	const tab = await chrome.tabs.get(message.tabId);
	const id = await recorder.startSession({
		tabId: message.tabId,
		initialUrl: tab.url ?? '',
		userAgent: navigator.userAgent,
		viewportSize: { w: tab.width ?? 0, h: tab.height ?? 0 },
		canvasCaptureEnabled: message.canvasCaptureEnabled ?? false,
	});
	// Sinaliza o probe daquela tab pra começar a emitir detections
	await chrome.tabs.sendMessage(message.tabId, {
		action: 'probeStartDetection',
		reason: 'initial',
	});
	sendResponse({ ok: true, sessionId: id });
	return true;
}

if (message.action === '__debug_stopSession') {
	await recorder.stopSession(message.sessionId);
	const session = await recorder.getActiveByTab(0); // best-effort
	if (session?.tabId) {
		await chrome.tabs.sendMessage(session.tabId, { action: 'probeIdle' });
	}
	sendResponse({ ok: true });
	return true;
}

if (message.action === 'pageDetected') {
	const tabId = sender?.tab?.id;
	if (tabId === undefined) {
		sendResponse({ ok: false, reason: 'no tab id in sender' });
		return true;
	}
	const session = await recorder.getActiveByTab(tabId);
	if (!session) {
		sendResponse({ ok: false, reason: 'no active session for tab' });
		return true;
	}
	const detection: PageDetection = {
		url: message.payload.url,
		timestamp: message.payload.timestamp,
		fingerprint: message.payload.fingerprint,
		triggerType: message.payload.triggerType,
	};
	await recorder.addPage(session.id, detection);
	sendResponse({ ok: true });
	return true;
}

if (message.action === 'getActiveSession') {
	const session = await recorder.getActiveByTab(message.tabId);
	sendResponse({ session });
	return true;
}
```

> **Atenção:** o handler do `chrome.runtime.onMessage` no projeto pode ser síncrono (callback que retorna `false`). Pra usar `await`, encapsule o trabalho async em um IIFE e retorne `true` no listener pra deixar o channel aberto. Consultar como os handlers existentes (`approveResponse`, etc.) fazem isso.

- [ ] **Step 3: Verificar build TypeScript**

```bash
cd app && npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/messages.ts app/src/entrypoints/background.ts
git commit -m "feat(session): handlers __debug_startSession/stopSession + pageDetected"
```

---

## Task 13: Background — re-detecção em navegação real (webNavigation)

**Files:**
- Modify: `app/src/entrypoints/background.ts`
- Modify: `app/manifest.json` (verificar permissão `webNavigation`)

- [ ] **Step 1: Verificar permissão `webNavigation` no manifest**

```bash
grep -n webNavigation app/manifest.json
```

Se não estiver presente, adicionar à lista de `permissions`:

```json
"permissions": ["debugger", "storage", "tabs", "webNavigation", "scripting"]
```

(Manter as existentes; só adicionar `"webNavigation"` se faltar.)

- [ ] **Step 2: Adicionar listener no background**

Em `app/src/entrypoints/background.ts`, fora do `onMessage`, registrar:

```ts
chrome.webNavigation.onCommitted.addListener(async (details) => {
	if (details.frameId !== 0) return; // só top frame
	const session = await recorder.getActiveByTab(details.tabId);
	if (!session) return;
	// Re-injeta o sinal pro probe (que já foi re-injetado pelo content_script
	// via document_start), pra disparar detection com triggerType='navigation'.
	try {
		await chrome.tabs.sendMessage(details.tabId, {
			action: 'probeStartDetection',
			reason: 'navigation',
		});
	} catch (err) {
		// Tab pode ter fechado entre o evento e o sendMessage. Não fazer nada.
	}
});
```

> **Por que `frameId !== 0`:** ignora iframes. Detecção é sobre o documento principal da tab.

> **Por que sem fallback silencioso pra erros do recorder:** seguindo a regra do projeto "no fallbacks". Se `recorder.addPage` falhar (ex: session já encerrada por race), deixe o erro propagar pra `chrome.runtime.onMessage` retornar `{ ok: false }` — UI de Phase 1c vai mostrar.

- [ ] **Step 3: Build pra validar**

```bash
cd app && npm run build
```

Esperado: build limpa.

- [ ] **Step 4: Smoke test E2E manual**

1. `chrome://extensions` → recarregar Debug Buddy.
2. Abrir tab em `https://react.dev`.
3. Anotar `tabId`: DevTools do service worker → console:
   ```js
   chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => console.log(t.id));
   ```
4. Iniciar session via debug action, no console do service worker:
   ```js
   chrome.runtime.sendMessage({ action: '__debug_startSession', tabId: <ID> })
   	.then(console.log);
   ```
5. Confirmar resposta `{ ok: true, sessionId: 'sess_...' }`.
6. Navegar a tab pra `https://angular.dev`. O `webNavigation.onCommitted` deve disparar nova detection.
7. Inspecionar IndexedDB (DevTools Application → IndexedDB → debugger-extension-db → sessions) e confirmar que a session tem 2 phases (uma React, uma Angular).
8. Fazer SPA route change clicando em link interno do react.dev (sem reload). Confirmar terceira phase só se fingerprint mudar; se não, página adicional na phase atual.
9. Encerrar:
   ```js
   chrome.runtime.sendMessage({ action: '__debug_stopSession', sessionId: '<id>' });
   ```

- [ ] **Step 5: Commit**

```bash
git add app/src/entrypoints/background.ts app/manifest.json
git commit -m "feat(session): re-detecção em navegação real via webNavigation.onCommitted"
```

---

## Self-Review (a fazer antes de executar)

**Spec coverage** (verificar cada item da seção 16 da spec, escopo Phase 1):

- [x] Smart Detection per-URL com unificação — Tasks 4–8, 11
- [x] Modos de operação (passivo + gravação) — handlers debug em Task 12; toggle UI fica pra Phase 1c
- [ ] Captura de network — Phase 1b
- [ ] Captura de console — Phase 1b
- [ ] Captura de route change — Phase 1b (route changes geram PageDetection nesta phase, mas RouteChangeEvent dedicado vem depois)
- [ ] Captura de error — Phase 1b
- [ ] UI básica com timeline — Phase 1c
- [ ] Export/import "leve" — Phase 1d
- [ ] Telemetria local — Phase 1b (junto com hard limits)

Phase 1a entrega o **chassi de Smart Detection + Storage**: tudo que captura eventos depende deste chassi pra existir.

**Placeholder scan:** zero TBDs. Alguns "implementado em Phase X" são intencionais (escopo declarado pra Phase 1a).

**Type consistency:** `EnvironmentFingerprint`, `PageDetection`, `DetectionPhase`, `Session` definidos em Task 1 e usados consistentemente em Tasks 3, 4–7, 11, 12.

**No fallbacks check:** seguimos a regra do projeto. `detectFramework` retorna `vanilla` quando nada é detectado — isso **não** é fallback (vanilla é um valor legítimo de framework, não um placeholder pra "deu erro"). Catch silencioso só em `chrome.tabs.sendMessage` da Task 13 (tab pode ter fechado entre eventos), comentado explicitamente.

---

## O que vem depois desta sub-fase

Phase 1b — **Orchestrator + Console + Network capture**:
- Hard limits 50 MB / 10 min com encerramento automático
- Telemetria local
- Captura de console via CDP `Runtime.consoleAPICalled` + `Log.entryAdded` + coalesce
- Encaminhamento dos eventos de network já capturados para a session ativa
- RouteChangeEvent + ErrorEvent dedicados em `SessionEvent`

Phase 1c — **UI**:
- Toggle Gravação no SiteHeader (com checkbox de canvas)
- Banner permanente quando Recording ON
- Counter de tamanho/tempo
- Páginas `/sessions` e `/replay/:sessionId` (timeline básica, sem rrweb player)
- Modal de retenção (10 sessões)

Phase 1d — **Export/Import**:
- `.dbsession` "leve" (sem rrwebEvents) com viewer.html standalone
- Modal de confirmação agressivo no Export
- Import via file picker
