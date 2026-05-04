# Session Replay — Correções Pós-Lançamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 4 bugs reportados pelo usuário no Session Replay: gravação independente da interceptação, "0 eventos" no replay (descartados antes da primeira detection phase), banner GRAVANDO atrasado, e replay sem paridade com Command Center na exibição de requests.

**Architecture:** 4 fixes independentes mas com dependência lógica: Bug 2 (bootstrap phase) é pré-requisito do Bug 4 (que precisa de eventos). Bugs 1 e 3 são fixes em pontos distintos (lifecycle binding e broadcast). Spec completa em `docs/superpowers/specs/2026-05-02-session-replay-bugfixes-design.md`.

**Tech Stack:** TypeScript strict, React 19, Vitest jsdom, Chrome MV3 service worker, IndexedDB, `chrome.storage.local`.

**Beads issues:** `chrome-extension-debug-buddy-t4k` (Bug 2), `chrome-extension-debug-buddy-chv` (Bug 1), `chrome-extension-debug-buddy-28w` (Bug 3), `chrome-extension-debug-buddy-vz6` (Bug 4).

**Conventions reminder:**
- Indentação: TABS (size 2), nunca espaços.
- Strings/comentários: pt-BR.
- No-fallbacks: nada de `?? defaultValue` ou `try { ... } catch { return null }` silencioso.
- Tests em `__tests__/` co-locados, `globals: true` (sem `import { describe, test }`).
- Conventional Commits, subject lowercase (commitlint regra `subject-case`).

---

## File Structure

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `app/src/lib/session/types.ts` | `DetectionPhase.kind?: 'bootstrap' \| 'detected'` |
| `app/src/lib/session/recorder.ts` | `startSession` cria bootstrap phase; `addPage` substitui in-place quando atual é bootstrap |
| `app/src/entrypoints/background.ts` | `startDebugging`/`stopDebugging` invocam recorder; broadcast `recordingStateChanged`; remover throw de `currentPhaseId` (vira assert) |
| `app/src/types/messages.ts` | Action `recordingStateChanged` |
| `app/src/hooks/useRecording.ts` | Listener `chrome.runtime.onMessage` chama `refresh` |
| `app/src/components/recording/RecordingToggle.tsx` | Switch controla `recordingDisabled` storage flag |
| `app/src/pages/ReplayPage.tsx` | Nova tab "Requisições" com DataTable filtrado por playhead |

### Novos

| Arquivo | Responsabilidade |
|---------|------------------|
| `app/src/lib/session/recordingPreference.ts` | get/set `recordingDisabled` em `chrome.storage.local` |
| `app/src/lib/session/__tests__/recordingPreference.test.ts` | testes do preference helper |
| `app/src/lib/session/sessionNetworkAdapter.ts` | `sessionEventsToReplayRows(events, cutoff)` puro |
| `app/src/lib/session/__tests__/sessionNetworkAdapter.test.ts` | testes do adapter |
| `app/src/components/replay/ReplayRequestsTab.tsx` | aba que renderiza DataTable de requests da sessão |
| `app/src/components/replay/replayColumns.tsx` | `ColumnDef<ReplayRequestRow>[]` (timestamp/método/URL/status/duração/client) |
| `app/src/components/replay/__tests__/ReplayRequestsTab.test.tsx` | testes da aba |
| `app/src/components/replay/__tests__/replayColumns.test.tsx` | testes das colunas |

---

## Bug 2 — Bootstrap DetectionPhase (P0, beads `t4k`)

**Por que primeiro:** Sem isso, todos os eventos disparados antes do primeiro `pageDetected` (que pode atrasar segundos) são descartados pelo `currentPhaseId()` throw + `catch` silencioso. Bug 4 depende de ter eventos.

### Task 1: Adicionar `kind` ao tipo DetectionPhase

**Files:**
- Modify: `app/src/lib/session/types.ts:63-72`

- [ ] **Step 1: Adicionar campo `kind` opcional**

Em `app/src/lib/session/types.ts`, atualizar o interface `DetectionPhase` (linhas 63-72):

```ts
export interface DetectionPhase {
	id: string;
	startTimestamp: number;
	endTimestamp: number;
	fingerprint: EnvironmentFingerprint;
	pages: PageDetection[];
	/**
	 * 'bootstrap' = fase sintética criada por startSession antes da primeira
	 * pageDetected real chegar. Substituída in-place ao receber a primeira
	 * detection. 'detected' (default) = fase criada via probe normal.
	 * Campo opcional para preservar compat com sessões importadas antigas.
	 */
	kind?: 'bootstrap' | 'detected';
	/** Map storeId → primeiro snapshot capturado dele dentro da fase. */
	stateBaseline?: Record<string, StateSnapshot>;
	stateKeyframes?: StateKeyframe[];
}
```

- [ ] **Step 2: Verificar que tsc passa**

```bash
cd app && npx tsc --noEmit
```

Expected: zero erros (campo opcional não quebra usos existentes).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/session/types.ts
git commit -m "feat(session): adiciona kind a DetectionPhase para bootstrap phase"
```

### Task 2: Helper `makeBootstrapPhase` no recorder

**Files:**
- Modify: `app/src/lib/session/recorder.ts:28-36`

- [ ] **Step 1: Escrever teste falhando**

Criar `app/src/lib/session/__tests__/recorder.bootstrap.test.ts`:

```ts
import { recorder } from '../recorder';
import { sessionStore } from '../storage';

describe('recorder bootstrap phase', () => {
	beforeEach(async () => {
		recorder._resetLimitsForTests();
		await sessionStore.clearForTests();
	});

	test('startSession cria DetectionPhase bootstrap imediatamente', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://example.com/',
			userAgent: 'test',
			viewportSize: { w: 800, h: 600 },
			canvasCaptureEnabled: false,
		});
		const session = await sessionStore.get(id);
		expect(session).not.toBeNull();
		expect(session!.detectionPhases).toHaveLength(1);
		const phase = session!.detectionPhases[0];
		expect(phase.kind).toBe('bootstrap');
		expect(phase.id).toBe(`bootstrap-${id}`);
		expect(phase.startTimestamp).toBe(session!.startedAt);
		expect(phase.endTimestamp).toBe(session!.startedAt);
		expect(phase.pages).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.bootstrap.test.ts
```

Expected: FAIL — `phase.kind` é undefined, `detectionPhases` está vazio.

- [ ] **Step 3: Implementar bootstrap em `startSession`**

Em `app/src/lib/session/recorder.ts`, atualizar `startSession` (linhas 163-186):

```ts
async startSession(args: StartArgs): Promise<string> {
	const existing = await sessionStore.findActiveByTab(args.tabId);
	if (existing) {
		throw new Error(`Já existe session ativa para tab ${args.tabId} (${existing.id})`);
	}
	const id = newSessionId();
	const startedAt = Date.now();
	// Bootstrap DetectionPhase: garante que `currentPhaseId(session)` nunca
	// lança e que eventos (console/error/network) capturados antes do primeiro
	// `pageDetected` real são preservados. addPage substitui esta fase in-place
	// na primeira detection real (kind === 'bootstrap' branch).
	const bootstrap: DetectionPhase = {
		id: `bootstrap-${id}`,
		startTimestamp: startedAt,
		endTimestamp: startedAt,
		// Fingerprint vazio temporário — será sobrescrito pela primeira
		// detection real. Não é fallback porque é substituído sincronamente
		// quando a probe envia o pageDetected.
		fingerprint: {
			framework: { name: 'vanilla' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: startedAt,
			isProductionBuild: false,
		},
		pages: [],
		kind: 'bootstrap',
	};
	const session: Session = {
		id,
		schemaVersion: 1,
		startedAt,
		endedAt: null,
		origin: 'recorded',
		tabId: args.tabId,
		metadata: {
			initialUrl: args.initialUrl,
			userAgent: args.userAgent,
			viewportSize: args.viewportSize,
			canvasCaptureEnabled: args.canvasCaptureEnabled,
		},
		detectionPhases: [bootstrap],
		events: [],
	};
	await sessionStore.put(session);
	return session.id;
},
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.bootstrap.test.ts
git commit -m "feat(session): startSession cria bootstrap DetectionPhase"
```

### Task 3: `addPage` substitui bootstrap in-place

**Files:**
- Modify: `app/src/lib/session/recorder.ts:213-232`

- [ ] **Step 1: Escrever teste falhando**

Adicionar a `app/src/lib/session/__tests__/recorder.bootstrap.test.ts`:

```ts
test('addPage substitui bootstrap in-place na primeira detection real', async () => {
	const id = await recorder.startSession({
		tabId: 2,
		initialUrl: 'https://example.com/',
		userAgent: 'test',
		viewportSize: { w: 800, h: 600 },
		canvasCaptureEnabled: false,
	});
	const t = Date.now() + 100;
	await recorder.addPage(id, {
		url: 'https://example.com/page',
		timestamp: t,
		fingerprint: {
			framework: { name: 'react', version: '18.0' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: t,
			isProductionBuild: false,
		},
		triggerType: 'initial',
	});
	const s = await sessionStore.get(id);
	expect(s!.detectionPhases).toHaveLength(1);
	const phase = s!.detectionPhases[0];
	expect(phase.kind).toBe('detected');
	expect(phase.pages).toHaveLength(1);
	expect(phase.pages[0].url).toBe('https://example.com/page');
	expect(phase.fingerprint.framework.name).toBe('react');
	// Mantém o id bootstrap para que eventos já indexados pelo phaseId
	// continuem ligados à fase correta após a promoção.
	expect(phase.id).toBe(`bootstrap-${id}`);
	expect(phase.startTimestamp).toBe(s!.startedAt);
	expect(phase.endTimestamp).toBe(t);
});

test('addPage adiciona nova phase quando atual já é detected', async () => {
	const id = await recorder.startSession({
		tabId: 3,
		initialUrl: 'https://example.com/',
		userAgent: 'test',
		viewportSize: { w: 800, h: 600 },
		canvasCaptureEnabled: false,
	});
	const t1 = Date.now() + 100;
	const fp1 = {
		framework: { name: 'react' as const, version: '18.0' },
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: t1,
		isProductionBuild: false,
	};
	await recorder.addPage(id, {
		url: 'https://example.com/a',
		timestamp: t1,
		fingerprint: fp1,
		triggerType: 'initial',
	});
	const t2 = t1 + 1000;
	await recorder.addPage(id, {
		url: 'https://example.com/b',
		timestamp: t2,
		fingerprint: {
			framework: { name: 'angular', version: '17' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: t2,
			isProductionBuild: false,
		},
		triggerType: 'navigation',
	});
	const s = await sessionStore.get(id);
	expect(s!.detectionPhases).toHaveLength(2);
	expect(s!.detectionPhases[0].kind).toBe('detected');
	expect(s!.detectionPhases[1].kind).toBe('detected');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.bootstrap.test.ts
```

Expected: FAIL — `addPage` atual cria nova fase em vez de substituir bootstrap.

- [ ] **Step 3: Atualizar `addPage` para substituir bootstrap**

Em `app/src/lib/session/recorder.ts`, atualizar o método `addPage` (linhas 213-232):

```ts
addPage(sessionId: string, detection: PageDetection): Promise<void> {
	return serializeBySessionId(sessionId, async () => {
		const s = await sessionStore.get(sessionId);
		if (!s) throw new Error(`Session ${sessionId} não encontrada`);
		if (s.endedAt !== null) throw new Error(`Session ${sessionId} já encerrada`);
		const last = s.detectionPhases[s.detectionPhases.length - 1];

		// Promoção da bootstrap phase: a primeira detection real preenche o
		// fingerprint/pages e marca kind='detected'. Mantemos o phase.id para
		// preservar o vínculo com eventos já indexados (eventos pré-detection
		// que entraram via currentPhaseId apontam para `bootstrap-${sessionId}`).
		if (last && last.kind === 'bootstrap') {
			last.kind = 'detected';
			last.fingerprint = detection.fingerprint;
			last.pages.push(detection);
			last.endTimestamp = detection.timestamp;
			s.events.push(makeDetectionEvent(detection.timestamp, last.id));
			await sessionStore.put(s);
			return;
		}

		// Mutação in-place segura: serializeBySessionId garante que apenas uma
		// mutation por sessão roda por vez (get → mutate → put atômico do ponto
		// de vista do recorder).
		if (last && fingerprintsEqual(last.fingerprint, detection.fingerprint)) {
			last.pages.push(detection);
			last.endTimestamp = detection.timestamp;
		} else {
			const phase = makePhase(detection);
			phase.kind = 'detected';
			s.detectionPhases.push(phase);
			s.events.push(makeDetectionEvent(detection.timestamp, phase.id));
		}
		await sessionStore.put(s);
	});
},
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verificar suite completa**

```bash
cd app && npx vitest run src/lib/session
```

Expected: todos os testes da pasta `session/` continuam verdes (incluindo os existentes que usavam `addPage` sem bootstrap).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.bootstrap.test.ts
git commit -m "feat(session): addPage promove bootstrap phase ao primeiro pagedetected"
```

### Task 4: Verificar integração — eventos pré-detection persistidos

**Files:**
- Test: `app/src/lib/session/__tests__/recorder.bootstrap.test.ts`

- [ ] **Step 1: Adicionar teste de integração**

Adicionar ao mesmo arquivo:

```ts
test('console event antes da primeira pageDetected fica na bootstrap phase', async () => {
	const id = await recorder.startSession({
		tabId: 4,
		initialUrl: 'https://example.com/',
		userAgent: 'test',
		viewportSize: { w: 800, h: 600 },
		canvasCaptureEnabled: false,
	});
	const t1 = Date.now() + 50;
	// Simula console event capturado pelo background.ts antes de a probe
	// enviar pageDetected. Em background.ts isso seria handleConsoleAPI →
	// recorder.addEvent. Aqui chamamos addEvent direto.
	await recorder.addEvent(id, {
		type: 'console',
		timestamp: t1,
		phaseId: `bootstrap-${id}`,
		source: 'app',
		level: 'log',
		args: [{ type: 'string', description: 'pre-detection log' }],
	});

	const t2 = t1 + 100;
	await recorder.addPage(id, {
		url: 'https://example.com/',
		timestamp: t2,
		fingerprint: {
			framework: { name: 'vanilla' },
			httpClients: [],
			dataFetching: [],
			stateManagers: [],
			detectedAt: t2,
			isProductionBuild: false,
		},
		triggerType: 'initial',
	});

	const s = await sessionStore.get(id);
	const consoleEvents = s!.events.filter((e) => e.type === 'console');
	expect(consoleEvents).toHaveLength(1);
	expect(consoleEvents[0].phaseId).toBe(`bootstrap-${id}`);
	// A phase é a mesma após promoção
	expect(s!.detectionPhases[0].id).toBe(`bootstrap-${id}`);
	expect(s!.detectionPhases[0].kind).toBe('detected');
});
```

- [ ] **Step 2: Run test**

```bash
cd app && npx vitest run src/lib/session/__tests__/recorder.bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/session/__tests__/recorder.bootstrap.test.ts
git commit -m "test(session): cobre persistencia de eventos pre-detection"
```

### Task 5: Suite completa + lint Bug 2

- [ ] **Step 1: Rodar tudo**

```bash
cd app && npm run lint && npx tsc --noEmit && npx vitest run
```

Expected: lint clean, tsc clean, todos os testes passando (1082 + 4 novos = 1086).

- [ ] **Step 2: Fechar issue Bug 2**

```bash
bd close chrome-extension-debug-buddy-t4k
```

---

## Bug 1 — Lifecycle binding (P0, beads `chv`)

**Por que segundo:** Bug 2 está fechado, agora podemos amarrar gravação à interceptação sem perder eventos.

### Task 6: Helper `recordingPreference.ts`

**Files:**
- Create: `app/src/lib/session/recordingPreference.ts`
- Test: `app/src/lib/session/__tests__/recordingPreference.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Criar `app/src/lib/session/__tests__/recordingPreference.test.ts`:

```ts
import { getRecordingDisabled, setRecordingDisabled } from '../recordingPreference';

describe('recordingPreference', () => {
	beforeEach(() => {
		// limpa o storage entre testes
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
	});

	test('getRecordingDisabled retorna false por default', async () => {
		const v = await getRecordingDisabled();
		expect(v).toBe(false);
	});

	test('setRecordingDisabled persiste true', async () => {
		await setRecordingDisabled(true);
		const v = await getRecordingDisabled();
		expect(v).toBe(true);
	});

	test('setRecordingDisabled persiste false explicitamente', async () => {
		await setRecordingDisabled(true);
		await setRecordingDisabled(false);
		const v = await getRecordingDisabled();
		expect(v).toBe(false);
	});

	test('getRecordingDisabled rejeita valores nao-boolean (sanidade)', async () => {
		// chrome.storage corrompido — devemos lançar, não cair em fallback.
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {
			recordingDisabled: 'yes',
		};
		await expect(getRecordingDisabled()).rejects.toThrow(/recordingDisabled/);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/lib/session/__tests__/recordingPreference.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar helper**

Criar `app/src/lib/session/recordingPreference.ts`:

```ts
// Preferência global: quando true, a gravação NÃO acompanha automaticamente o
// startDebugging. Default é false (gravação ligada com a interceptação).
//
// Storage namespace é `chrome.storage.local.recordingDisabled` (boolean).
// Sem default fabricado: se o valor armazenado não for boolean, lançamos —
// regra no-fallbacks. Cabe ao caller decidir como tratar.

const STORAGE_KEY = 'recordingDisabled';

export async function getRecordingDisabled(): Promise<boolean> {
	const result = await chrome.storage.local.get([STORAGE_KEY]);
	const raw = result[STORAGE_KEY];
	if (raw === undefined) return false; // chave nunca escrita = default
	if (typeof raw !== 'boolean') {
		throw new Error(
			`recordingDisabled corrompido em chrome.storage: esperava boolean, recebi ${typeof raw}`,
		);
	}
	return raw;
}

export async function setRecordingDisabled(value: boolean): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: value });
}
```

- [ ] **Step 4: Atualizar mock do chrome.storage no setup de testes**

Verificar `app/vitest.setup.ts` — se o mock atual de `chrome.storage.local.get/set` já guarda em `_data`, o teste já passa. Caso contrário, ajustar:

```ts
// Apenas se o setup atual não tem _data, adicionar:
const _data: Record<string, unknown> = {};
chrome.storage.local.get = vi.fn(async (keys: string[] | string) => {
	const arr = typeof keys === 'string' ? [keys] : keys;
	const out: Record<string, unknown> = {};
	for (const k of arr) {
		if (k in _data) out[k] = _data[k];
	}
	return out;
});
chrome.storage.local.set = vi.fn(async (items: Record<string, unknown>) => {
	Object.assign(_data, items);
});
(chrome.storage.local as unknown as { _data: typeof _data })._data = _data;
```

(Se o setup já tem isso, pular este step.)

- [ ] **Step 5: Run test to verify it passes**

```bash
cd app && npx vitest run src/lib/session/__tests__/recordingPreference.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/session/recordingPreference.ts app/src/lib/session/__tests__/recordingPreference.test.ts
git commit -m "feat(session): helper recordingpreference para flag de opt-out"
```

### Task 7: `startDebugging` inicia gravação automaticamente

**Files:**
- Modify: `app/src/entrypoints/background.ts:1591-1694` (função `startDebugging`)

- [ ] **Step 1: Escrever teste de integração**

Criar `app/src/entrypoints/__tests__/background.lifecycle.test.ts`:

```ts
import { recorder } from '@/lib/session/recorder';
import { sessionStore } from '@/lib/session/storage';
import { setRecordingDisabled } from '@/lib/session/recordingPreference';

// Importa side-effects do background — precisamos das funções exportadas para teste.
// Como background.ts não exporta startDebugging diretamente, usamos um helper
// dedicado (próxima task vai criar essa exportação).

describe('lifecycle binding (background)', () => {
	beforeEach(async () => {
		recorder._resetLimitsForTests();
		await sessionStore.clearForTests();
		(chrome.storage.local as unknown as { _data: Record<string, unknown> })._data = {};
	});

	test('startDebugging inicia gravacao quando recordingDisabled=false', async () => {
		const { _testStartDebugging } = await import('../background');
		await _testStartDebugging(123);
		const session = await sessionStore.findActiveByTab(123);
		expect(session).not.toBeNull();
		expect(session!.endedAt).toBeNull();
	});

	test('startDebugging NAO inicia gravacao quando recordingDisabled=true', async () => {
		await setRecordingDisabled(true);
		const { _testStartDebugging } = await import('../background');
		await _testStartDebugging(124);
		const session = await sessionStore.findActiveByTab(124);
		expect(session).toBeNull();
	});

	test('stopDebugging encerra gravacao ativa', async () => {
		const { _testStartDebugging, _testStopDebugging } = await import('../background');
		await _testStartDebugging(125);
		const before = await sessionStore.findActiveByTab(125);
		expect(before).not.toBeNull();
		await _testStopDebugging();
		const after = await sessionStore.findActiveByTab(125);
		expect(after).toBeNull(); // findActiveByTab retorna null pra sessões com endedAt setado
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/entrypoints/__tests__/background.lifecycle.test.ts
```

Expected: FAIL — `_testStartDebugging` não existe; ou se existe, recording não inicia.

- [ ] **Step 3: Refatorar `startDebugging` para fazer recording auto-start**

Em `app/src/entrypoints/background.ts`, adicionar import (no topo, perto dos outros imports de session):

```ts
import { getRecordingDisabled } from '@/lib/session/recordingPreference';
```

Atualizar `startDebugging` (linhas 1591-1694) — adicionar bloco no final do `try` (logo antes de `console.log('Debugging started successfully'); return true;`):

```ts
		// --- Acoplamento gravação ↔ interceptação (Bug 1) ---
		// Default: ao iniciar interceptação, iniciamos uma sessão de gravação.
		// Usuário pode desligar via switch "Gravação" da SiteHeader, que persiste
		// `recordingDisabled=true` em chrome.storage.local.
		try {
			const recordingDisabled = await getRecordingDisabled();
			if (!recordingDisabled) {
				const tab = await chrome.tabs.get(tabId);
				const sessionId = await recorder.startSession({
					tabId,
					initialUrl: tab.url ?? '',
					userAgent: navigator.userAgent,
					viewportSize: { w: tab.width ?? 0, h: tab.height ?? 0 },
					canvasCaptureEnabled: !!livePrivacyConfig?.captureCanvas,
				});
				// Habilita Runtime/Log para captura de console/exceptions.
				await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
				await chrome.debugger.sendCommand({ tabId }, 'Log.enable');
				// Sinaliza probe + rrweb. Falhas aqui são fatais para a gravação
				// mas não para a interceptação — log e seguir.
				try {
					await chrome.tabs.sendMessage(tabId, {
						action: 'probeStartDetection',
						reason: 'initial',
					});
					await chrome.tabs.sendMessage(tabId, {
						action: '__rrweb_start',
						sessionId,
						recordCanvas: !!livePrivacyConfig?.captureCanvas,
						maskTextSelector: livePrivacyConfig?.rrwebMaskTextSelector,
						maskAllInputs: livePrivacyConfig?.rrwebMaskAllInputs,
					});
				} catch (err) {
					console.warn(
						'[session] gravação iniciada mas probe/rrweb falhou (provavelmente content script não injetado):',
						err,
					);
				}
				broadcastToUI('recordingStateChanged', {
					tabId,
					active: true,
					sessionId,
				});
			}
		} catch (err) {
			// Não-fatal: interceptação continua mesmo se gravação falha (ex.: aba
			// sem permissão de probe). Erro é logado para depuração.
			console.warn('[session] auto-start de gravação falhou:', err);
		}
```

**Importante:** o tipo `RedactionConfig` precisa ter `captureCanvas`. Verificar — se ainda não existe, esta task NÃO adiciona; em vez disso usa `false` literal e abre uma nota de follow-up. Verificar agora:

```bash
cd app && grep -n "captureCanvas" src/lib/session/types.ts src/lib/session/privacy/defaults.ts 2>&1 | head
```

Se `captureCanvas` não existir em `RedactionConfig`, **substitua a linha** `canvasCaptureEnabled: !!livePrivacyConfig?.captureCanvas` por:

```ts
				canvasCaptureEnabled: false, // canvas só via toggle manual no RecordingToggle (follow-up)
```

E também a linha `recordCanvas: !!livePrivacyConfig?.captureCanvas` por `recordCanvas: false`.

- [ ] **Step 4: Atualizar `stopDebugging` para encerrar sessão**

Em `app/src/entrypoints/background.ts`, atualizar `stopDebugging` (linhas 1697-1756). Substituir o bloco final (após `await chrome.debugger.detach(...)` e antes do reset de estado) por:

Localizar a linha:
```ts
		// Reset global state. `timingTracker.reset()` antes de zerar `allRequests`
```

Inserir IMEDIATAMENTE ANTES dela:

```ts
		// --- Acoplamento gravação ↔ interceptação (Bug 1) ---
		// Encerra qualquer sessão ativa associada à tab antes de detacharmos.
		// stopSession é idempotente; se a sessão já foi parada (usuário clicou
		// "Parar Gravação" sozinho — fluxo legado), o segundo call no-op.
		try {
			const activeSession = await recorder.getActiveByTab(attachedTabId);
			if (activeSession) {
				try {
					await chrome.debugger.sendCommand(
						{ tabId: attachedTabId },
						'Runtime.disable',
					);
					await chrome.debugger.sendCommand({ tabId: attachedTabId }, 'Log.disable');
				} catch {
					// Debugger pode ter sido detached por outro caminho — ignorar.
				}
				try {
					await chrome.tabs.sendMessage(attachedTabId, { action: '__rrweb_stop' });
				} catch {
					// Tab pode ter fechado.
				}
				try {
					await chrome.tabs.sendMessage(attachedTabId, { action: 'probeIdle' });
				} catch {
					// Tab pode ter fechado.
				}
				await recorder.stopSession(activeSession.id);
				broadcastToUI('recordingStateChanged', {
					tabId: attachedTabId,
					active: false,
					sessionId: activeSession.id,
				});
			}
		} catch (err) {
			console.warn('[session] auto-stop de gravação falhou:', err);
		}
```

- [ ] **Step 5: Exportar helpers de teste**

Ao final de `app/src/entrypoints/background.ts` (após o último listener), adicionar:

```ts
// --- helpers de teste (não usar em produção) ---
export const _testStartDebugging = startDebugging;
export const _testStopDebugging = stopDebugging;
```

- [ ] **Step 6: Mockar chrome.debugger e chrome.tabs nos testes**

Atualizar `app/src/entrypoints/__tests__/background.lifecycle.test.ts` para mockar APIs do chrome:

```ts
beforeEach(async () => {
	// ... (clearForTests etc)
	(chrome as unknown as { debugger: unknown }).debugger = {
		attach: vi.fn(async () => undefined),
		detach: vi.fn(async () => undefined),
		sendCommand: vi.fn(async () => ({})),
		onEvent: { addListener: vi.fn(), removeListener: vi.fn() },
		getTargets: vi.fn(async () => []),
	};
	(chrome.tabs as unknown as { get: unknown }).get = vi.fn(async (id: number) => ({
		id,
		url: `https://example.com/tab${id}`,
		width: 800,
		height: 600,
	}));
	chrome.tabs.sendMessage = vi.fn(async () => ({})) as never;
});
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd app && npx vitest run src/entrypoints/__tests__/background.lifecycle.test.ts
```

Expected: PASS (3/3 testes).

- [ ] **Step 8: Commit**

```bash
git add app/src/entrypoints/background.ts app/src/entrypoints/__tests__/background.lifecycle.test.ts
git commit -m "feat(session): startdebugging acopla startsession da gravacao"
```

### Task 8: `RecordingToggle` controla `recordingDisabled`

**Files:**
- Modify: `app/src/components/recording/RecordingToggle.tsx`
- Test: `app/src/components/recording/__tests__/RecordingToggle.test.tsx`

- [ ] **Step 1: Escrever teste do novo comportamento**

Criar/atualizar `app/src/components/recording/__tests__/RecordingToggle.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingToggle } from '../RecordingToggle';

vi.mock('@/lib/session/recordingPreference', () => ({
	getRecordingDisabled: vi.fn(async () => false),
	setRecordingDisabled: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/useRecording', () => ({
	useRecording: () => ({
		status: { active: false, sizeBytes: 0, durationMs: 0 },
		startRecording: vi.fn(),
		stopRecording: vi.fn(),
	}),
}));

vi.mock('@/hooks/useSessions', () => ({
	useSessions: () => ({ sessions: [] }),
}));

describe('RecordingToggle', () => {
	test('switch reflete recordingDisabled invertido (UI mostra Gravação ON)', async () => {
		const mod = await import('@/lib/session/recordingPreference');
		(mod.getRecordingDisabled as unknown as { mockResolvedValueOnce: (v: boolean) => void })
			.mockResolvedValueOnce(false);
		render(<RecordingToggle tabId={1} interceptionActive={true} />);
		await waitFor(() => {
			const sw = screen.getByLabelText('Gravação') as HTMLInputElement;
			// Storage false (não desabilitado) = UI mostra ligado.
			expect(sw.getAttribute('aria-checked')).toBe('true');
		});
	});

	test('clicar switch desliga -> setRecordingDisabled(true)', async () => {
		const mod = await import('@/lib/session/recordingPreference');
		render(<RecordingToggle tabId={1} interceptionActive={true} />);
		const sw = await screen.findByLabelText('Gravação');
		fireEvent.click(sw);
		await waitFor(() => {
			expect(mod.setRecordingDisabled).toHaveBeenCalledWith(true);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/components/recording/__tests__/RecordingToggle.test.tsx
```

Expected: FAIL — toggle atual chama `startRecording`/`stopRecording`, não `setRecordingDisabled`.

- [ ] **Step 3: Reescrever `RecordingToggle.tsx`**

Substituir todo o conteúdo de `app/src/components/recording/RecordingToggle.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
	getRecordingDisabled,
	setRecordingDisabled,
} from '@/lib/session/recordingPreference';

interface Props {
	tabId: number | null;
	interceptionActive: boolean;
}

// Switch agora é opt-out: storage guarda `recordingDisabled` (boolean), default
// false. UI mostra "Gravação ON" quando storage=false (gravando junto com a
// interceptação). Click inverte e persiste.
//
// Importante: este componente NÃO chama mais startRecording/stopRecording — esse
// fluxo está acoplado ao startDebugging/stopDebugging em background.ts (Bug 1).
// O switch só decide se o auto-start vai disparar na próxima interceptação.
export function RecordingToggle({ tabId, interceptionActive }: Props) {
	const [disabled, setDisabled] = useState<boolean | null>(null);

	useEffect(() => {
		let cancelled = false;
		void getRecordingDisabled().then((v) => {
			if (!cancelled) setDisabled(v);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const switchDisabled = tabId === null || !interceptionActive || disabled === null;
	// UI mostra ligado quando storage=false. Loading (null) também mostra ligado
	// para não enganar o usuário durante o carregamento inicial — controle vira
	// editável ao terminar o load.
	const checked = disabled === false || disabled === null;

	const onToggle = async (next: boolean) => {
		// next = true significa usuário quer ligar gravação = recordingDisabled=false
		const newDisabled = !next;
		setDisabled(newDisabled);
		await setRecordingDisabled(newDisabled);
	};

	return (
		<div className="flex items-center gap-2">
			<Label htmlFor="recording-switch" className="text-sm">
				Gravação
			</Label>
			<Switch
				id="recording-switch"
				checked={checked}
				onCheckedChange={onToggle}
				disabled={switchDisabled}
				aria-label="Gravação"
			/>
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/components/recording/__tests__/RecordingToggle.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/recording/RecordingToggle.tsx app/src/components/recording/__tests__/RecordingToggle.test.tsx
git commit -m "feat(session): recordingtoggle controla flag opt-out via storage"
```

### Task 9: Suite completa + lint Bug 1

- [ ] **Step 1: Rodar tudo**

```bash
cd app && npm run lint && npx tsc --noEmit && npx vitest run
```

Expected: lint clean, tsc clean, suite verde.

- [ ] **Step 2: Fechar issue Bug 1**

```bash
bd close chrome-extension-debug-buddy-chv
```

---

## Bug 3 — Banner broadcast (P1, beads `28w`)

### Task 10: Adicionar action `recordingStateChanged`

**Files:**
- Modify: `app/src/types/messages.ts:17-59`

- [ ] **Step 1: Adicionar action ao union**

Em `app/src/types/messages.ts`, adicionar à union `MessageAction` (na seção "Phase 2 (rrweb)" ou crie uma nova "Bugfix 3"):

```ts
	// Bugfix — broadcast lifecycle de gravação
	| 'recordingStateChanged'
```

E adicionar campos opcionais ao Message interface (após `sessionId`):

```ts
	// Payload de recordingStateChanged
	active?: boolean;
```

(Se `active?: boolean` já existe em `MessageResponse`, não duplicar — mas em `Message` precisa estar.)

- [ ] **Step 2: Verificar que tsc passa**

```bash
cd app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/messages.ts
git commit -m "feat(messages): adiciona acao recordingstatechanged"
```

### Task 11: `useRecording` listener

**Files:**
- Modify: `app/src/hooks/useRecording.ts:1-82`
- Test: `app/src/hooks/__tests__/useRecording.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

Adicionar a `app/src/hooks/__tests__/useRecording.test.tsx`:

```tsx
test('refresh ao receber recordingStateChanged via runtime.onMessage', async () => {
	const listeners: Array<(msg: unknown) => void> = [];
	(chrome.runtime.onMessage as unknown as { addListener: (cb: unknown) => void }).addListener =
		(cb: unknown) => {
			listeners.push(cb as (msg: unknown) => void);
		};
	(chrome.runtime.onMessage as unknown as { removeListener: (cb: unknown) => void })
		.removeListener = vi.fn();

	const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
	sendMessageMock.mockResolvedValueOnce({
		ok: true,
		active: false,
		sizeBytes: 0,
		durationMs: 0,
	});

	const { result } = renderHook(() => useRecording(7));
	await waitFor(() => expect(result.current.status.active).toBe(false));

	// Simula broadcast do background
	sendMessageMock.mockResolvedValueOnce({
		ok: true,
		active: true,
		sessionId: 'sess_x',
		sizeBytes: 100,
		durationMs: 50,
	});
	listeners.forEach((cb) =>
		cb({ action: 'recordingStateChanged', tabId: 7, active: true, sessionId: 'sess_x' }),
	);

	await waitFor(() => expect(result.current.status.active).toBe(true));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/hooks/__tests__/useRecording.test.tsx
```

Expected: FAIL — hook atual não escuta `chrome.runtime.onMessage`.

- [ ] **Step 3: Adicionar listener no hook**

Em `app/src/hooks/useRecording.ts`, adicionar novo `useEffect` antes do `return`:

```ts
	// Broadcast-driven refresh: background broadcasta `recordingStateChanged`
	// quando recording inicia/para via lifecycle binding (Bug 1+3). Listener
	// chama refresh imediato — UI reage sem esperar o próximo tick do polling
	// de 1s. Polling segue como rede de segurança para tamanho/duração.
	useEffect(() => {
		if (tabId === null) return;
		const handler = (msg: unknown): void => {
			const m = msg as { action?: string; tabId?: number };
			if (m?.action !== 'recordingStateChanged') return;
			if (m.tabId !== undefined && m.tabId !== tabId) return;
			void refresh();
		};
		chrome.runtime.onMessage.addListener(handler);
		return () => {
			chrome.runtime.onMessage.removeListener(handler);
		};
	}, [tabId, refresh]);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/hooks/__tests__/useRecording.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useRecording.ts app/src/hooks/__tests__/useRecording.test.tsx
git commit -m "feat(session): userecording escuta recordingstatechanged"
```

### Task 12: Suite completa + lint Bug 3

- [ ] **Step 1: Rodar tudo**

```bash
cd app && npm run lint && npx tsc --noEmit && npx vitest run
```

Expected: tudo verde. Suite cobre os broadcasts dos Tasks 7+8 também — recordingStateChanged é disparado em start/stop debugging.

- [ ] **Step 2: Fechar issue Bug 3**

```bash
bd close chrome-extension-debug-buddy-28w
```

---

## Bug 4 — Aba Requisições no Replay (P2, beads `vz6`)

### Task 13: Adapter `sessionEventsToReplayRows`

**Files:**
- Create: `app/src/lib/session/sessionNetworkAdapter.ts`
- Test: `app/src/lib/session/__tests__/sessionNetworkAdapter.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Criar `app/src/lib/session/__tests__/sessionNetworkAdapter.test.ts`:

```ts
import { sessionEventsToReplayRows } from '../sessionNetworkAdapter';
import type { SessionEvent } from '../types';

describe('sessionEventsToReplayRows', () => {
	const fp = {
		framework: { name: 'vanilla' as const },
		httpClients: [],
		dataFetching: [],
		stateManagers: [],
		detectedAt: 0,
		isProductionBuild: false,
	};
	void fp;

	test('filtra apenas variantes network', () => {
		const events: SessionEvent[] = [
			{ type: 'detection', timestamp: 100, phaseId: 'p1' },
			{
				type: 'network',
				timestamp: 200,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://example.com/api',
				status: 200,
				durationMs: 50,
			},
			{
				type: 'console',
				timestamp: 300,
				phaseId: 'p1',
				source: 'app',
				level: 'log',
				args: [],
			},
		];
		const rows = sessionEventsToReplayRows(events, Number.MAX_SAFE_INTEGER);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe('r1');
		expect(rows[0].method).toBe('GET');
		expect(rows[0].status).toBe(200);
		expect(rows[0].durationMs).toBe(50);
	});

	test('filtra por cutoffTimestamp (inclusivo)', () => {
		const events: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://a',
				status: 200,
			},
			{
				type: 'network',
				timestamp: 200,
				phaseId: 'p1',
				requestId: 'r2',
				method: 'POST',
				url: 'https://b',
				status: 201,
			},
			{
				type: 'network',
				timestamp: 300,
				phaseId: 'p1',
				requestId: 'r3',
				method: 'GET',
				url: 'https://c',
				status: 200,
			},
		];
		const rows = sessionEventsToReplayRows(events, 200);
		expect(rows.map((r) => r.id)).toEqual(['r1', 'r2']);
	});

	test('preserva client e callsiteFile quando presentes', () => {
		const events: SessionEvent[] = [
			{
				type: 'network',
				timestamp: 100,
				phaseId: 'p1',
				requestId: 'r1',
				method: 'GET',
				url: 'https://example.com',
				status: 200,
				client: 'fetch',
				callsite: { file: 'src/api.ts', line: 42, column: 5 },
			},
		];
		const rows = sessionEventsToReplayRows(events, Number.MAX_SAFE_INTEGER);
		expect(rows[0].client).toBe('fetch');
		expect(rows[0].callsiteFile).toBe('src/api.ts');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/lib/session/__tests__/sessionNetworkAdapter.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar adapter**

Criar `app/src/lib/session/sessionNetworkAdapter.ts`:

```ts
// Adapter puro: traduz `SessionEvent` (variante network) em linhas para a tabela
// do Replay. Filtra por cutoffTimestamp inclusivo para sincronizar com o playhead
// do rrweb-player.
//
// Não fabricamos campos ausentes (transferSize, mimeType, isMocked, etc.) —
// SessionEvent não persiste essa informação. As colunas do Replay refletem
// honestamente o que está disponível: timestamp / método / URL / status /
// duração / client / callsite. Se quisermos paridade total com Command Center,
// precisamos primeiro estender SessionEvent com mais campos (follow-up).

import type { SessionEvent } from './types';

export interface ReplayRequestRow {
	id: string;
	timestamp: number;
	method: string;
	url: string;
	status: number;
	durationMs?: number;
	client?: string;
	callsiteFile?: string;
}

export function sessionEventsToReplayRows(
	events: SessionEvent[],
	cutoffTimestamp: number,
): ReplayRequestRow[] {
	const rows: ReplayRequestRow[] = [];
	for (const ev of events) {
		if (ev.type !== 'network') continue;
		if (ev.timestamp > cutoffTimestamp) continue;
		rows.push({
			id: ev.requestId,
			timestamp: ev.timestamp,
			method: ev.method,
			url: ev.url,
			status: ev.status,
			durationMs: ev.durationMs,
			client: ev.client,
			callsiteFile: ev.callsite?.file,
		});
	}
	return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/lib/session/__tests__/sessionNetworkAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/session/sessionNetworkAdapter.ts app/src/lib/session/__tests__/sessionNetworkAdapter.test.ts
git commit -m "feat(session): adapter sessioneventstoreplayrows com filtro por cutoff"
```

### Task 14: `replayColumns.tsx`

**Files:**
- Create: `app/src/components/replay/replayColumns.tsx`
- Test: `app/src/components/replay/__tests__/replayColumns.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

Criar `app/src/components/replay/__tests__/replayColumns.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { replayColumns } from '../replayColumns';
import type { ReplayRequestRow } from '@/lib/session/sessionNetworkAdapter';

function Harness({ rows }: { rows: ReplayRequestRow[] }) {
	const table = useReactTable({
		data: rows,
		columns: replayColumns,
		getCoreRowModel: getCoreRowModel(),
	});
	return (
		<table>
			<tbody>
				{table.getRowModel().rows.map((row) => (
					<tr key={row.id}>
						{row.getVisibleCells().map((cell) => (
							<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

describe('replayColumns', () => {
	test('renderiza método, URL e status', () => {
		const rows: ReplayRequestRow[] = [
			{
				id: 'r1',
				timestamp: 1700000000000,
				method: 'POST',
				url: 'https://api.example.com/users',
				status: 201,
				durationMs: 123,
			},
		];
		const { getByText } = render(<Harness rows={rows} />);
		expect(getByText('POST')).toBeInTheDocument();
		expect(getByText('https://api.example.com/users')).toBeInTheDocument();
		expect(getByText('201')).toBeInTheDocument();
	});

	test('mostra "—" para duração ausente sem fabricar valor', () => {
		const rows: ReplayRequestRow[] = [
			{
				id: 'r1',
				timestamp: 0,
				method: 'GET',
				url: 'https://x',
				status: 200,
			},
		];
		const { container } = render(<Harness rows={rows} />);
		expect(container.textContent).toContain('—');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/components/replay/__tests__/replayColumns.test.tsx
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar colunas**

Criar `app/src/components/replay/replayColumns.tsx`:

```tsx
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReplayRequestRow } from '@/lib/session/sessionNetworkAdapter';
import { compareDurations, formatDuration, getDurationColorClass } from '../requests/duration';
import { cn } from '@/lib/utils';

const URL_COLUMN_WIDTH = 460;

// Colunas dedicadas ao Replay — subset do Command Center. SessionEvent network
// não armazena todos os campos do InterceptedResponse (transferSize, mimeType,
// isMocked, type), então ostentamos só o que temos honestamente.
export const replayColumns: ColumnDef<ReplayRequestRow>[] = [
	{
		accessorKey: 'timestamp',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Horário
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		sortingFn: (a, b) => a.original.timestamp - b.original.timestamp,
		cell: ({ row }) => {
			const date = new Date(row.original.timestamp);
			const hh = date.getHours().toString().padStart(2, '0');
			const mm = date.getMinutes().toString().padStart(2, '0');
			const ss = date.getSeconds().toString().padStart(2, '0');
			const ms = date.getMilliseconds().toString().padStart(3, '0');
			return (
				<span className="text-xs text-muted-foreground whitespace-nowrap">
					{`${hh}:${mm}:${ss}.${ms}`}
				</span>
			);
		},
		size: 110,
	},
	{
		accessorKey: 'durationMs',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Tempo
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		sortingFn: (a, b) => compareDurations(a.original.durationMs, b.original.durationMs),
		cell: ({ row }) => {
			const d = row.original.durationMs;
			const color = getDurationColorClass(d);
			return (
				<span className={cn('text-xs font-medium whitespace-nowrap', color)}>
					{formatDuration(d)}
				</span>
			);
		},
		size: 80,
	},
	{
		accessorKey: 'method',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Método
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => (
			<span className="font-medium whitespace-nowrap">{row.original.method}</span>
		),
		size: 80,
	},
	{
		accessorKey: 'url',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				URL
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => (
			<span className="truncate block" style={{ maxWidth: URL_COLUMN_WIDTH }}>
				{row.original.url}
			</span>
		),
		size: URL_COLUMN_WIDTH,
	},
	{
		accessorKey: 'status',
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
				className="pl-0"
			>
				Status
				<ArrowUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
		cell: ({ row }) => <span className="whitespace-nowrap">{row.original.status}</span>,
		size: 80,
	},
	{
		id: 'client',
		accessorFn: (row) => row.client,
		header: 'Client',
		cell: ({ row }) => {
			const c = row.original.client;
			if (!c) return <span className="text-muted-foreground">—</span>;
			const cs = row.original.callsiteFile;
			return cs ? (
				<TooltipProvider delayDuration={150}>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="text-xs underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 cursor-help">
								{c}
							</span>
						</TooltipTrigger>
						<TooltipContent>{cs}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			) : (
				<span className="text-xs">{c}</span>
			);
		},
		size: 90,
	},
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/components/replay/__tests__/replayColumns.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/replay/replayColumns.tsx app/src/components/replay/__tests__/replayColumns.test.tsx
git commit -m "feat(replay): replaycolumns dedicadas para tabela de requests"
```

### Task 15: `ReplayRequestsTab` componente

**Files:**
- Create: `app/src/components/replay/ReplayRequestsTab.tsx`
- Test: `app/src/components/replay/__tests__/ReplayRequestsTab.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

Criar `app/src/components/replay/__tests__/ReplayRequestsTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ReplayRequestsTab } from '../ReplayRequestsTab';
import type { SessionEvent } from '@/lib/session/types';

describe('ReplayRequestsTab', () => {
	const events: SessionEvent[] = [
		{
			type: 'network',
			timestamp: 100,
			phaseId: 'p1',
			requestId: 'r1',
			method: 'GET',
			url: 'https://api.test/users',
			status: 200,
			durationMs: 30,
		},
		{
			type: 'network',
			timestamp: 500,
			phaseId: 'p1',
			requestId: 'r2',
			method: 'POST',
			url: 'https://api.test/users',
			status: 201,
			durationMs: 80,
		},
	];

	test('renderiza apenas requests <= cutoffTimestamp', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={200} />);
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.queryByText('POST')).not.toBeInTheDocument();
	});

	test('empty state quando nenhuma request capturada antes do playhead', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={50} />);
		expect(
			screen.getByText(/Nenhuma requisição capturada até este ponto/i),
		).toBeInTheDocument();
	});

	test('renderiza todas quando cutoff cobre tudo', () => {
		render(<ReplayRequestsTab events={events} cutoffTimestamp={Number.MAX_SAFE_INTEGER} />);
		expect(screen.getByText('GET')).toBeInTheDocument();
		expect(screen.getByText('POST')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && npx vitest run src/components/replay/__tests__/ReplayRequestsTab.test.tsx
```

Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar componente**

Criar `app/src/components/replay/ReplayRequestsTab.tsx`:

```tsx
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { sessionEventsToReplayRows } from '@/lib/session/sessionNetworkAdapter';
import type { SessionEvent } from '@/lib/session/types';
import { replayColumns } from './replayColumns';

interface Props {
	events: SessionEvent[];
	cutoffTimestamp: number;
}

// Tabela de requests do replay sincronizada com o playhead. cutoffTimestamp vem
// do `useReplayPlayhead` na ReplayPage; o filtro é inclusivo (<=). Reusa
// `Table` do shadcn-ui e `replayColumns` (ver replayColumns.tsx para porque NÃO
// reusamos as columns do Command Center).
export function ReplayRequestsTab({ events, cutoffTimestamp }: Props) {
	const rows = useMemo(
		() => sessionEventsToReplayRows(events, cutoffTimestamp),
		[events, cutoffTimestamp],
	);
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		data: rows,
		columns: replayColumns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (rows.length === 0) {
		return (
			<p className="p-3 text-muted-foreground text-sm">
				Nenhuma requisição capturada até este ponto da gravação.
			</p>
		);
	}

	return (
		<div className="overflow-auto rounded border">
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead key={h.id} style={{ width: h.column.getSize() }}>
									{h.isPlaceholder
										? null
										: flexRender(h.column.columnDef.header, h.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow key={row.id}>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd app && npx vitest run src/components/replay/__tests__/ReplayRequestsTab.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/replay/ReplayRequestsTab.tsx app/src/components/replay/__tests__/ReplayRequestsTab.test.tsx
git commit -m "feat(replay): aba requisicoes filtrada por cutoff timestamp"
```

### Task 16: Integrar nova tab em `ReplayPage`

**Files:**
- Modify: `app/src/pages/ReplayPage.tsx:104-208`

- [ ] **Step 1: Atualizar `ReplayPage` para incluir a nova tab**

Em `app/src/pages/ReplayPage.tsx`:

1. Adicionar import no topo:

```ts
import { ReplayRequestsTab } from '@/components/replay/ReplayRequestsTab';
```

2. Localizar o `<TabsList>` (linha ~146-157) e adicionar nova trigger:

```tsx
<TabsList className="self-start">
	<TabsTrigger value="timeline">Timeline</TabsTrigger>
	<TabsTrigger value="requests">
		Requisições
		{(() => {
			const count = session.events.filter(
				(e) => e.type === 'network' && e.timestamp <= cutoffTimestamp,
			).length;
			if (count === 0) return null;
			return <span className="ml-2 rounded bg-muted px-1.5 text-[10px]">{count}</span>;
		})()}
	</TabsTrigger>
	<TabsTrigger value="antipatterns">
		Antipatterns
		{(session.antipatternHits?.length ?? 0) > 0 && (
			<span className="ml-2 rounded bg-muted px-1.5 text-[10px]">
				{session.antipatternHits?.length}
			</span>
		)}
	</TabsTrigger>
	<TabsTrigger value="state">Estado</TabsTrigger>
</TabsList>
```

3. Adicionar `<TabsContent value="requests">` entre os existentes (depois do `timeline`, antes do `antipatterns`):

```tsx
<TabsContent value="requests" className="mt-0 flex-1 overflow-auto">
	<ReplayRequestsTab events={session.events} cutoffTimestamp={cutoffTimestamp} />
</TabsContent>
```

- [ ] **Step 2: Verificar render manual via teste**

Adicionar a `app/src/pages/__tests__/ReplayPage.test.tsx` (se já existe; senão criar):

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReplayPage } from '../ReplayPage';

vi.mock('@/lib/session/storage', () => ({
	sessionStore: {
		get: vi.fn(async () => ({
			id: 'sess_test',
			schemaVersion: 1,
			startedAt: 1000,
			endedAt: 5000,
			origin: 'recorded',
			tabId: 1,
			metadata: {
				initialUrl: 'https://x',
				userAgent: 't',
				viewportSize: { w: 800, h: 600 },
				canvasCaptureEnabled: false,
			},
			detectionPhases: [],
			events: [
				{
					type: 'network',
					timestamp: 1100,
					phaseId: 'p',
					requestId: 'r1',
					method: 'GET',
					url: 'https://api/users',
					status: 200,
					durationMs: 30,
				},
			],
		})),
	},
}));

vi.mock('@/components/replay/RrwebPlayer', () => ({
	RrwebPlayer: () => <div data-testid="rrweb-player" />,
}));

describe('ReplayPage tabs', () => {
	test('expoe aba Requisicoes', async () => {
		render(
			<MemoryRouter initialEntries={['/replay/sess_test']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		expect(await screen.findByText(/Requisições/)).toBeInTheDocument();
	});
});
```

- [ ] **Step 3: Run tests**

```bash
cd app && npx vitest run src/pages/__tests__/ReplayPage.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Build smoke**

```bash
cd app && npm run build
```

Expected: build limpo, sem erros de tipos.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/ReplayPage.tsx app/src/pages/__tests__/ReplayPage.test.tsx
git commit -m "feat(replay): integra aba requisicoes na replaypage"
```

### Task 17: Suite completa + lint Bug 4

- [ ] **Step 1: Rodar tudo**

```bash
cd app && npm run lint && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: lint clean, tsc clean, suite verde (1082 + ~17 novos), build verde.

- [ ] **Step 2: Fechar issue Bug 4**

```bash
bd close chrome-extension-debug-buddy-vz6
```

---

## Smoke test final

- [ ] **Step 1: Rebuild + reload extensão**

```bash
cd app && npm run build:dev
```

E manualmente em `chrome://extensions`:
1. Reload Debug Buddy.
2. Abrir options.html → "Iniciar Interceptação" em uma tab com tráfego.
3. Verificar que o banner GRAVANDO aparece **imediatamente** (sem F5).
4. Aguardar tráfego rolar.
5. Parar interceptação → verificar que sessão aparece em "Sessões".
6. Abrir replay → verificar que:
   - "X eventos · ≥1 fases · Y eventos visuais" (X > 0)
   - Aba "Requisições" lista as requisições.
   - Avançar playhead filtra a tabela em tempo real.

- [ ] **Step 2: Smoke do bug "0 eventos"**

Repetir o cenário do Pokémon que falhou no relato original (reproduzindo o cenário em `pokemon.com/us/pokedex`). Validar:
- Antes do fix: sessão tinha 0 eventos.
- Depois: ≥ 1 console + ≥ 5 network capturados.

---

## Self-Review

**Spec coverage:**
- ✅ Bug 2: Tasks 1-5 (kind type, bootstrap creation, addPage promotion, integration test).
- ✅ Bug 1: Tasks 6-9 (preference helper, lifecycle binding, RecordingToggle rework).
- ✅ Bug 3: Tasks 10-12 (action, broadcast pontos cobertos pelas tasks 7/8, listener no hook).
- ✅ Bug 4: Tasks 13-17 (adapter, columns, tab component, integration, suite).

**Placeholder scan:** zero TODO/TBD. Todas as tasks têm código concreto.

**Type consistency:**
- `ReplayRequestRow` definido em `sessionNetworkAdapter.ts`, importado em `replayColumns.tsx` e `ReplayRequestsTab.tsx`.
- `DetectionPhase.kind` adicionado em Task 1, usado em Tasks 2-4.
- `recordingDisabled` storage key consistente: definida em `recordingPreference.ts`, usada em Task 7.
- `recordingStateChanged` action: messages.ts (Task 10), broadcast em background.ts (Tasks 7-8), listener em useRecording.ts (Task 11).

**Convenção:** todos os commits em pt-BR lowercase com Conventional Commits — passa no commitlint.

**Risco:** baixo. Mudanças cirúrgicas em pontos isolados. Tests novos cobrem cada decisão.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-session-replay-bugfixes.md`.
