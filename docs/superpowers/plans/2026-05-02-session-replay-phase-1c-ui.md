# Session Replay — Phase 1c: UI (Toggle, Banner, Sessions Page, Replay Timeline)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar a feature de Session Replay usável sem comandos no console do service worker. Toggle Gravação na barra superior + canvas checkbox + banner ativo + counter de tamanho/tempo + página de sessões salvas + replay player com timeline (sem rrweb visual ainda — Phase 2).

**Architecture:** Hook `useRecording` consume actions `startRecording`/`stopRecording`/`getRecordingStatus` do background (renomeadas de `__debug_*`). Hook `useSessions` lê `sessionStore` (IndexedDB) diretamente. Toggle no `SiteHeader` (igual ao toggle Interceptação atual). Banner permanente quando recording on (similar ao banner debugger atual). Páginas novas em `routes.tsx`: `/sessions` (lista) e `/replay/:sessionId` (timeline básica, com filtros por tipo de evento).

**Tech Stack:** React 19 + react-router-dom (createHashRouter), shadcn-ui components vendorizados em `components/ui/`, Tailwind v4 (tokens em `styles/globals.css`), Vitest + jsdom + @testing-library/react.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` (seção 11 UI/UX).

---

## File Structure

**Modify:**
- `app/src/types/messages.ts` — substituir `__debug_*` por `startRecording`/`stopRecording`/`getRecordingStatus`/`deleteSession` (mantemos `__debug_*` como aliases em transição? **Decisão:** removemos. UI nova consome só nomes oficiais).
- `app/src/entrypoints/background.ts` — renomear handlers + adicionar `getRecordingStatus` (devolve `{ active, sessionId, sizeBytes, durationMs }`) + handler `deleteSession`.
- `app/src/lib/session/recorder.ts` — adicionar `getRuntimeStatus(sessionId): { sizeBytes, durationMs } | null` que lê do `runtime` Map (já existe — só expõe).
- `app/src/routes.tsx` — adicionar rotas `/sessions` e `/replay/:sessionId`.
- `app/src/components/layout/SiteHeader.tsx` — toggle Gravação ao lado do toggle Interceptação + banner permanente quando active.

**Create:**
- `app/src/hooks/useRecording.ts` — `{ status, startRecording(canvasCaptureEnabled), stopRecording() }` com polling de 1s pra atualizar `sizeBytes`/`durationMs`.
- `app/src/hooks/useSessions.ts` — `{ sessions, refresh, deleteSession(id) }` com leitura direta do `sessionStore` + listener `chrome.storage.onChanged` pra refresh.
- `app/src/components/recording/RecordingToggle.tsx` — botão toggle com modal de canvas checkbox + modal de retenção 10 sessões.
- `app/src/components/recording/RecordingBanner.tsx` — banner permanente com counter `MM:SS / 10:00` e `12.4 MB / 50 MB` + botão "Parar".
- `app/src/pages/SessionsPage.tsx` — lista de sessões (badge origem, tamanho, duração, URL inicial, timestamp, ações).
- `app/src/pages/ReplayPage.tsx` — timeline básica scrollável de events (network/console/route/error) com filtros + painel "Environment Phases".
- `app/src/components/recording/SessionRow.tsx` — linha da lista de sessões (extraído pra reuso futuro).
- `app/src/components/replay/EventRow.tsx` — linha de evento na timeline (renderiza variant correto).
- `app/src/components/replay/PhaseList.tsx` — lista vertical de DetectionPhases com fingerprint summary.

**Test (co-located em `__tests__/`):**
- `app/src/hooks/__tests__/useRecording.test.tsx`
- `app/src/hooks/__tests__/useSessions.test.tsx`
- `app/src/components/recording/__tests__/RecordingBanner.test.tsx`
- `app/src/pages/__tests__/SessionsPage.test.tsx`
- `app/src/pages/__tests__/ReplayPage.test.tsx`

---

## Decisões de design

**Polling de status vs push:** o counter precisa atualizar ~1×/segundo pra mostrar `MM:SS`. Push do background via `chrome.tabs.sendMessage(broadcastToUI)` cada segundo é wasteful. Decisão: polling do hook `useRecording` chama `getRecordingStatus` a cada 1s enquanto active. Para quando active vira false.

**`recorder.getRuntimeStatus`:** precisa expor o `runtime` Map (atualmente private). Adicionar método público que retorna `{ sizeBytes, durationMs } | null`. Não viola encapsulamento — é exatamente o que UI precisa.

**Modal de retenção 10 sessões:** ao clicar "Iniciar Gravação", `useRecording.startRecording` primeiro chama `getSessionCount` (novo handler ou via `useSessions`). Se ≥10, abre modal apresentando lista pra deletar. Após delete, retry start. Se user cancela, abort.

**Modal de canvas checkbox:** modal aparece DEPOIS do retention check. Single checkbox + 2 botões. Default OFF.

**Página `/sessions`:** rota separada. Listada como item no sidebar (já existe `NavMain`). Lista mostra: badge origem, tamanho, duração, URL inicial, timestamp ISO. Ação delete por linha.

**Página `/replay/:sessionId`:** carrega session via `sessionStore.get(id)`. Layout 2 colunas: esquerda (timeline scrollável de events com filtros por tipo), direita (PhaseList compacto). Sem rrweb player (Phase 2).

**Banner ativo:** aparece em TODAS as páginas (no Layout, depois do SiteHeader). Cor distinta (amber/red) similar ao banner do debugger. Counter atualizado pelo polling. Botão "Parar Gravação" inline.

**Sem testes E2E nesta phase:** cobertura via component tests com @testing-library/react. Smoke test manual pra integração.

---

## Task 1: Background actions oficiais + recorder.getRuntimeStatus

**Files:**
- Modify: `app/src/types/messages.ts`
- Modify: `app/src/entrypoints/background.ts`
- Modify: `app/src/lib/session/recorder.ts`
- Test: `app/src/lib/session/__tests__/recorder.test.ts`

### Step 1.1: Adicionar `getRuntimeStatus` ao recorder

Em `app/src/lib/session/recorder.ts`, adicionar método ao objeto `recorder`:

```ts
	getRuntimeStatus(sessionId: string): { sizeBytes: number; durationMs: number } | null {
		const r = runtime.get(sessionId);
		if (!r) return null;
		return {
			sizeBytes: r.bytes,
			durationMs: Date.now() - r.startedAt,
		};
	},
```

### Step 1.2: Adicionar teste

Adicionar ao final de `recorder.test.ts`:

```ts
	it('getRuntimeStatus retorna null quando sessão não está no runtime cache', () => {
		expect(recorder.getRuntimeStatus('inexistente')).toBeNull();
	});

	it('getRuntimeStatus retorna sizeBytes e durationMs após addEvent', async () => {
		const id = await recorder.startSession({
			tabId: 1,
			initialUrl: 'https://x/',
			userAgent: '',
			viewportSize: { w: 1, h: 1 },
			canvasCaptureEnabled: false,
		});
		await recorder.addPage(id, page('https://x/', 10, fp()));
		const phaseId = (await sessionStore.get(id))!.detectionPhases[0].id;
		await recorder.addEvent(id, {
			type: 'network',
			timestamp: 11,
			phaseId,
			requestId: 'r1',
			method: 'GET',
			url: 'https://api/x',
			status: 200,
		});
		const status = recorder.getRuntimeStatus(id);
		expect(status).not.toBeNull();
		expect(status!.sizeBytes).toBeGreaterThan(0);
		expect(status!.durationMs).toBeGreaterThanOrEqual(0);
	});
```

### Step 1.3: Renomear actions em messages.ts

Em `app/src/types/messages.ts`, substituir as 4 actions `__debug_*` + `getActiveSession`/`pageDetected` (mantém pageDetected) por:

```ts
| { action: 'startRecording'; tabId: number; canvasCaptureEnabled?: boolean }
| { action: 'stopRecording'; sessionId: string }
| { action: 'getRecordingStatus'; tabId: number }
| { action: 'deleteSession'; sessionId: string }
```

(Manter `getActiveSession` e `pageDetected` como antes.)

### Step 1.4: Renomear handlers em background.ts

- `__debug_startSession` → `startRecording`
- `__debug_stopSession` → `stopRecording`
- Adicionar handler `getRecordingStatus`:

```ts
if (message.action === 'getRecordingStatus') {
	(async () => {
		try {
			const session = await recorder.getActiveByTab(message.tabId);
			if (!session) {
				sendResponse({ ok: true, active: false });
				return;
			}
			const status = recorder.getRuntimeStatus(session.id);
			sendResponse({
				ok: true,
				active: true,
				sessionId: session.id,
				sizeBytes: status?.sizeBytes ?? 0,
				durationMs: status?.durationMs ?? 0,
			});
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

- Adicionar handler `deleteSession`:

```ts
if (message.action === 'deleteSession') {
	(async () => {
		try {
			await sessionStore.delete(message.sessionId);
			sendResponse({ ok: true });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

### Step 1.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/recorder.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/types/messages.ts app/src/entrypoints/background.ts app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.test.ts
git commit -m "feat(session): renomeia debug actions pra startRecording/stopRecording + getRecordingStatus + getRuntimeStatus"
```

Esperado: 14/14 testes recorder, 851/851 suite total (+2).

---

## Task 2: Hooks `useRecording` + `useSessions`

**Files:**
- Create: `app/src/hooks/useRecording.ts`
- Create: `app/src/hooks/useSessions.ts`
- Test: `app/src/hooks/__tests__/useRecording.test.tsx`
- Test: `app/src/hooks/__tests__/useSessions.test.tsx`

### Step 2.1: Implementar `useRecording`

`app/src/hooks/useRecording.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordingStatus {
	active: boolean;
	sessionId?: string;
	sizeBytes: number;
	durationMs: number;
}

const initialStatus: RecordingStatus = { active: false, sizeBytes: 0, durationMs: 0 };

export function useRecording(tabId: number | null): {
	status: RecordingStatus;
	startRecording: (canvasCaptureEnabled: boolean) => Promise<{ ok: boolean; error?: string }>;
	stopRecording: () => Promise<{ ok: boolean; error?: string }>;
	refresh: () => Promise<void>;
} {
	const [status, setStatus] = useState<RecordingStatus>(initialStatus);
	const pollRef = useRef<number | null>(null);

	const refresh = useCallback(async () => {
		if (tabId === null) return;
		const res = await chrome.runtime.sendMessage({ action: 'getRecordingStatus', tabId });
		if (res?.ok) {
			setStatus({
				active: !!res.active,
				sessionId: res.sessionId,
				sizeBytes: res.sizeBytes ?? 0,
				durationMs: res.durationMs ?? 0,
			});
		}
	}, [tabId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (!status.active) {
			if (pollRef.current !== null) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
			return;
		}
		pollRef.current = window.setInterval(() => {
			void refresh();
		}, 1000);
		return () => {
			if (pollRef.current !== null) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
		};
	}, [status.active, refresh]);

	const startRecording = useCallback(
		async (canvasCaptureEnabled: boolean) => {
			if (tabId === null) return { ok: false, error: 'Sem tab alvo' };
			const res = await chrome.runtime.sendMessage({
				action: 'startRecording',
				tabId,
				canvasCaptureEnabled,
			});
			if (res?.ok) await refresh();
			return res ?? { ok: false, error: 'Sem resposta' };
		},
		[tabId, refresh],
	);

	const stopRecording = useCallback(async () => {
		if (!status.sessionId) return { ok: false, error: 'Sem sessão ativa' };
		const res = await chrome.runtime.sendMessage({
			action: 'stopRecording',
			sessionId: status.sessionId,
		});
		if (res?.ok) await refresh();
		return res ?? { ok: false, error: 'Sem resposta' };
	}, [status.sessionId, refresh]);

	return { status, startRecording, stopRecording, refresh };
}
```

### Step 2.2: Implementar `useSessions`

`app/src/hooks/useSessions.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { sessionStore } from '@/lib/session/storage';
import type { Session } from '@/lib/session/types';

export function useSessions(): {
	sessions: Session[];
	refresh: () => Promise<void>;
	deleteSession: (id: string) => Promise<void>;
} {
	const [sessions, setSessions] = useState<Session[]>([]);

	const refresh = useCallback(async () => {
		const list = await sessionStore.list();
		setSessions(list);
	}, []);

	const deleteSession = useCallback(
		async (id: string) => {
			const res = await chrome.runtime.sendMessage({ action: 'deleteSession', sessionId: id });
			if (res?.ok) await refresh();
		},
		[refresh],
	);

	useEffect(() => {
		void refresh();
		// Re-read a cada 5s pra capturar novas sessions criadas em background
		const interval = window.setInterval(() => {
			void refresh();
		}, 5000);
		return () => clearInterval(interval);
	}, [refresh]);

	return { sessions, refresh, deleteSession };
}
```

### Step 2.3: Tests pros 2 hooks

`app/src/hooks/__tests__/useRecording.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecording } from '../useRecording';

declare global {
	interface Window {
		chrome: typeof chrome;
	}
}

const sendMessageMock = vi.fn();

beforeEach(() => {
	sendMessageMock.mockReset();
	window.chrome = {
		runtime: {
			sendMessage: sendMessageMock,
		},
	} as unknown as typeof chrome;
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useRecording', () => {
	it('refresh chama getRecordingStatus e atualiza status', async () => {
		sendMessageMock.mockResolvedValueOnce({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024,
			durationMs: 5000,
		});
		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => {
			expect(result.current.status.active).toBe(true);
		});
		expect(result.current.status.sessionId).toBe('sess_1');
		expect(result.current.status.sizeBytes).toBe(1024);
		expect(sendMessageMock).toHaveBeenCalledWith({ action: 'getRecordingStatus', tabId: 7 });
	});

	it('startRecording dispara action com canvas flag', async () => {
		sendMessageMock
			.mockResolvedValueOnce({ ok: true, active: false }) // initial refresh
			.mockResolvedValueOnce({ ok: true, sessionId: 'sess_2' }) // start
			.mockResolvedValueOnce({ ok: true, active: true, sessionId: 'sess_2', sizeBytes: 0, durationMs: 0 }); // refresh
		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => {
			expect(result.current.status.active).toBe(false);
		});
		await act(async () => {
			await result.current.startRecording(true);
		});
		expect(sendMessageMock).toHaveBeenCalledWith({
			action: 'startRecording',
			tabId: 7,
			canvasCaptureEnabled: true,
		});
	});

	it('stopRecording usa sessionId atual', async () => {
		sendMessageMock
			.mockResolvedValueOnce({
				ok: true,
				active: true,
				sessionId: 'sess_3',
				sizeBytes: 100,
				durationMs: 1000,
			})
			.mockResolvedValueOnce({ ok: true })
			.mockResolvedValueOnce({ ok: true, active: false });
		const { result } = renderHook(() => useRecording(7));
		await waitFor(() => {
			expect(result.current.status.sessionId).toBe('sess_3');
		});
		await act(async () => {
			await result.current.stopRecording();
		});
		expect(sendMessageMock).toHaveBeenCalledWith({
			action: 'stopRecording',
			sessionId: 'sess_3',
		});
	});

	it('tabId null pula refresh', async () => {
		const { result } = renderHook(() => useRecording(null));
		expect(result.current.status.active).toBe(false);
		expect(sendMessageMock).not.toHaveBeenCalled();
	});
});
```

`app/src/hooks/__tests__/useSessions.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/session/storage';
import { useSessions } from '../useSessions';
import type { Session } from '@/lib/session/types';

const sendMessageMock = vi.fn();

const baseSession = (id: string, startedAt: number): Session => ({
	id,
	schemaVersion: 1,
	startedAt,
	endedAt: null,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://x/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
});

beforeEach(async () => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('useSessions', () => {
	it('lê lista do sessionStore na inicialização', async () => {
		await sessionStore.put(baseSession('a', 1));
		await sessionStore.put(baseSession('b', 2));
		const { result } = renderHook(() => useSessions());
		await waitFor(() => {
			expect(result.current.sessions).toHaveLength(2);
		});
		expect(result.current.sessions.map((s) => s.id)).toEqual(['b', 'a']);
	});

	it('deleteSession chama action e atualiza lista', async () => {
		await sessionStore.put(baseSession('a', 1));
		sendMessageMock.mockResolvedValueOnce({ ok: true });
		const { result } = renderHook(() => useSessions());
		await waitFor(() => expect(result.current.sessions).toHaveLength(1));
		// O deleteSession do hook só chama o action; pra refletir o storage temos
		// que apagar manual também já que o action mockado não persiste.
		await sessionStore.delete('a');
		await act(async () => {
			await result.current.deleteSession('a');
		});
		expect(sendMessageMock).toHaveBeenCalledWith({ action: 'deleteSession', sessionId: 'a' });
		await waitFor(() => expect(result.current.sessions).toHaveLength(0));
	});
});
```

### Step 2.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/hooks/__tests__/
cd app && npm test 2>&1 | tail -5
git add app/src/hooks/useRecording.ts app/src/hooks/useSessions.ts app/src/hooks/__tests__/useRecording.test.tsx app/src/hooks/__tests__/useSessions.test.tsx
git commit -m "feat(session): hooks useRecording e useSessions"
```

Esperado: testes dos hooks passam, suite ainda verde.

---

## Task 3: SiteHeader — toggle Gravação + Canvas modal + Banner

**Files:**
- Modify: `app/src/components/layout/SiteHeader.tsx`
- Create: `app/src/components/recording/RecordingToggle.tsx`
- Create: `app/src/components/recording/RecordingBanner.tsx`
- Modify: `app/src/pages/Layout.tsx` (adicionar `<RecordingBanner />` abaixo do header)
- Test: `app/src/components/recording/__tests__/RecordingBanner.test.tsx`

### Step 3.1: Inspecionar `SiteHeader.tsx` e `Layout.tsx`

Ler ambos pra entender:
- Como o toggle Interceptação atual está implementado.
- Como o Layout monta SiteHeader.
- Como acessa shadcn-ui (Switch, Dialog, etc.).
- Onde fica a tab alvo (provavelmente um state global via storage ou context).

### Step 3.2: Criar `RecordingToggle.tsx`

Componente que recebe `tabId: number | null`. Mostra Switch de Gravação. Switch desabilitado se `tabId === null`. Ao ativar, abre dialog com checkbox "Capturar canvas (overhead alto)" e botão "Iniciar". Ao desativar, chama `stopRecording` direto.

Use shadcn `Switch`, `Dialog`, `Checkbox`, `Button`. Strings em pt-BR.

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRecording } from '@/hooks/useRecording';
import { useSessions } from '@/hooks/useSessions';

const RETENTION_LIMIT = 10;

interface Props {
	tabId: number | null;
	interceptionActive: boolean;
}

export function RecordingToggle({ tabId, interceptionActive }: Props) {
	const { status, startRecording, stopRecording } = useRecording(tabId);
	const { sessions } = useSessions();
	const [openCanvas, setOpenCanvas] = useState(false);
	const [openRetention, setOpenRetention] = useState(false);
	const [canvasOpt, setCanvasOpt] = useState(false);

	const disabled = tabId === null || !interceptionActive;

	const onToggle = async (checked: boolean) => {
		if (!checked) {
			await stopRecording();
			return;
		}
		// Check retention
		if (sessions.length >= RETENTION_LIMIT) {
			setOpenRetention(true);
			return;
		}
		setCanvasOpt(false);
		setOpenCanvas(true);
	};

	const onConfirmStart = async () => {
		setOpenCanvas(false);
		await startRecording(canvasOpt);
	};

	return (
		<div className="flex items-center gap-2">
			<Label htmlFor="recording-switch" className="text-sm">
				Gravação
			</Label>
			<Switch
				id="recording-switch"
				checked={status.active}
				onCheckedChange={onToggle}
				disabled={disabled}
				aria-label="Gravação"
			/>

			<Dialog open={openCanvas} onOpenChange={setOpenCanvas}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Iniciar gravação</DialogTitle>
						<DialogDescription>
							A sessão será gravada localmente até você parar ou atingir o limite (50 MB / 10 min).
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-start gap-3 py-2">
						<Checkbox
							id="canvas-opt"
							checked={canvasOpt}
							onCheckedChange={(v) => setCanvasOpt(v === true)}
						/>
						<div>
							<Label htmlFor="canvas-opt">Capturar canvas (overhead alto)</Label>
							<p className="text-muted-foreground text-xs">
								Necessário para apps com charts, jogos ou editores. Aumenta tamanho da sessão.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setOpenCanvas(false)}>
							Cancelar
						</Button>
						<Button onClick={onConfirmStart}>Iniciar gravação</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={openRetention} onOpenChange={setOpenRetention}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Limite de sessões atingido</DialogTitle>
						<DialogDescription>
							Você já tem {RETENTION_LIMIT} sessões salvas. Delete pelo menos uma na página
							"Sessões" antes de iniciar uma nova gravação.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={() => setOpenRetention(false)}>Entendi</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
```

### Step 3.3: Criar `RecordingBanner.tsx`

`app/src/components/recording/RecordingBanner.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { useRecording } from '@/hooks/useRecording';

const SIZE_LIMIT_MB = 50;
const DURATION_LIMIT_MIN = 10;

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
	const ss = String(totalSec % 60).padStart(2, '0');
	return `${mm}:${ss}`;
}

interface Props {
	tabId: number | null;
}

export function RecordingBanner({ tabId }: Props) {
	const { status, stopRecording } = useRecording(tabId);
	if (!status.active) return null;
	const sizeMB = status.sizeBytes / (1024 * 1024);
	const durationMin = status.durationMs / (60 * 1000);
	const nearLimit = sizeMB >= SIZE_LIMIT_MB * 0.8 || durationMin >= DURATION_LIMIT_MIN * 0.8;

	return (
		<div
			role="status"
			aria-label="Gravação ativa"
			className={`flex items-center justify-between border-b px-4 py-2 text-sm ${
				nearLimit ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
			}`}
		>
			<div className="flex items-center gap-3">
				<span className="size-2 rounded-full bg-current animate-pulse" aria-hidden="true" />
				<span className="font-medium">Gravando sessão</span>
				<span className="font-mono">
					{formatDuration(status.durationMs)} / {DURATION_LIMIT_MIN}:00
				</span>
				<span className="font-mono">
					{formatBytes(status.sizeBytes)} / {SIZE_LIMIT_MB} MB
				</span>
				{nearLimit && <span>(perto do limite — exporte ou pare)</span>}
			</div>
			<Button size="sm" variant="outline" onClick={() => void stopRecording()}>
				Parar gravação
			</Button>
		</div>
	);
}
```

### Step 3.4: Integrar no SiteHeader e Layout

Em `SiteHeader.tsx`, adicionar `<RecordingToggle tabId={...} interceptionActive={...} />` ao lado do toggle Interceptação atual. Use os mesmos hooks/state que já alimentam interceptação (descobrir lendo o arquivo).

Em `Layout.tsx`, adicionar `<RecordingBanner tabId={...} />` IMEDIATAMENTE ABAIXO do `<SiteHeader />`.

### Step 3.5: Test

`app/src/components/recording/__tests__/RecordingBanner.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingBanner } from '../RecordingBanner';

const sendMessageMock = vi.fn();

beforeEach(() => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
});

describe('RecordingBanner', () => {
	it('não renderiza quando active=false', async () => {
		sendMessageMock.mockResolvedValueOnce({ ok: true, active: false });
		const { container } = render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(container.firstChild).toBeNull());
	});

	it('renderiza counter quando active=true', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024 * 1024 * 5,
			durationMs: 30 * 1000,
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText(/Gravando sessão/i)).toBeInTheDocument());
		expect(screen.getByText('00:30 / 10:00')).toBeInTheDocument();
		expect(screen.getByText('5.0 MB / 50 MB')).toBeInTheDocument();
	});

	it('aplica estilo de alerta perto do limite (>80%)', async () => {
		sendMessageMock.mockResolvedValue({
			ok: true,
			active: true,
			sessionId: 'sess_1',
			sizeBytes: 1024 * 1024 * 45,
			durationMs: 60 * 1000,
		});
		render(<RecordingBanner tabId={7} />);
		await waitFor(() => expect(screen.getByText(/perto do limite/i)).toBeInTheDocument());
	});
});
```

### Step 3.6: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/recording/__tests__/
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/components/recording/ app/src/components/layout/SiteHeader.tsx app/src/pages/Layout.tsx
git commit -m "feat(session): toggle Gravação no SiteHeader + canvas modal + banner permanente"
```

Esperado: testes do banner passam, build limpa, suite verde.

---

## Task 4: Página `/sessions` + rota + nav item

**Files:**
- Modify: `app/src/routes.tsx`
- Modify: `app/src/components/layout/NavMain.tsx` (adicionar item)
- Create: `app/src/pages/SessionsPage.tsx`
- Create: `app/src/components/recording/SessionRow.tsx`
- Test: `app/src/pages/__tests__/SessionsPage.test.tsx`

### Step 4.1: Adicionar rota

Em `app/src/routes.tsx`, adicionar entre as rotas existentes:

```tsx
{ path: '/sessions', element: <SessionsPage /> }
```

(Importar `SessionsPage` no topo.)

### Step 4.2: Adicionar item ao NavMain

Em `app/src/components/layout/NavMain.tsx`, adicionar item:

```tsx
{ to: '/sessions', label: 'Sessões', icon: <SomeIcon /> }
```

(Usar ícone do lucide-react já existente no projeto, ex: `Video`, `Film`.)

### Step 4.3: Implementar `SessionRow.tsx`

```tsx
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Session } from '@/lib/session/types';

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | null): string {
	if (ms === null) return 'em andamento';
	const totalSec = Math.floor(ms / 1000);
	const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
	const ss = String(totalSec % 60).padStart(2, '0');
	return `${mm}:${ss}`;
}

interface Props {
	session: Session;
	onDelete: (id: string) => void;
}

export function SessionRow({ session, onDelete }: Props) {
	const sizeBytes = JSON.stringify(session).length; // estimativa quick
	const duration = session.endedAt !== null ? session.endedAt - session.startedAt : null;
	return (
		<div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b px-4 py-2 text-sm">
			<Badge variant={session.origin === 'recorded' ? 'default' : 'secondary'}>
				{session.origin === 'recorded' ? 'Gravada' : 'Importada'}
			</Badge>
			<Link to={`/replay/${session.id}`} className="truncate font-mono text-xs hover:underline">
				{session.metadata.initialUrl}
			</Link>
			<span className="font-mono text-xs">{formatDuration(duration)}</span>
			<span className="font-mono text-xs">{formatBytes(sizeBytes)}</span>
			<span className="text-muted-foreground text-xs">
				{new Date(session.startedAt).toLocaleString('pt-BR')}
			</span>
			<Button size="sm" variant="ghost" onClick={() => onDelete(session.id)}>
				Excluir
			</Button>
		</div>
	);
}
```

### Step 4.4: Implementar `SessionsPage.tsx`

```tsx
import { useSessions } from '@/hooks/useSessions';
import { SessionRow } from '@/components/recording/SessionRow';

export function SessionsPage() {
	const { sessions, deleteSession } = useSessions();
	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Sessões salvas</h1>
				<span className="text-muted-foreground text-sm">
					{sessions.length} / 10 (limite de retenção)
				</span>
			</div>
			{sessions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Nenhuma sessão salva. Inicie uma gravação para criar a primeira.
				</p>
			) : (
				<div className="flex flex-col">
					{sessions.map((s) => (
						<SessionRow key={s.id} session={s} onDelete={(id) => void deleteSession(id)} />
					))}
				</div>
			)}
		</div>
	);
}
```

### Step 4.5: Test

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/session/storage';
import { SessionsPage } from '../SessionsPage';
import type { Session } from '@/lib/session/types';

const sendMessageMock = vi.fn();

const sess = (id: string, startedAt: number, endedAt: number | null = null): Session => ({
	id,
	schemaVersion: 1,
	startedAt,
	endedAt,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: `https://example/${id}`,
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
});

beforeEach(async () => {
	sendMessageMock.mockReset();
	window.chrome = { runtime: { sendMessage: sendMessageMock } } as unknown as typeof chrome;
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('SessionsPage', () => {
	it('mostra empty state quando não há sessões', async () => {
		render(
			<MemoryRouter>
				<SessionsPage />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByText(/Nenhuma sessão salva/i)).toBeInTheDocument();
		});
	});

	it('lista sessões e mostra contagem', async () => {
		await sessionStore.put(sess('a', 1));
		await sessionStore.put(sess('b', 2));
		render(
			<MemoryRouter>
				<SessionsPage />
			</MemoryRouter>,
		);
		await waitFor(() => {
			expect(screen.getByText(/2 \/ 10/i)).toBeInTheDocument();
		});
		expect(screen.getByText('https://example/a')).toBeInTheDocument();
		expect(screen.getByText('https://example/b')).toBeInTheDocument();
	});
});
```

### Step 4.6: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/pages/__tests__/SessionsPage.test.tsx
cd app && npm test 2>&1 | tail -5
git add app/src/pages/SessionsPage.tsx app/src/components/recording/SessionRow.tsx app/src/routes.tsx app/src/components/layout/NavMain.tsx app/src/pages/__tests__/SessionsPage.test.tsx
git commit -m "feat(session): página /sessions com lista, badges e exclusão"
```

---

## Task 5: Página `/replay/:sessionId` + EventRow + PhaseList

**Files:**
- Modify: `app/src/routes.tsx`
- Create: `app/src/pages/ReplayPage.tsx`
- Create: `app/src/components/replay/EventRow.tsx`
- Create: `app/src/components/replay/PhaseList.tsx`
- Test: `app/src/pages/__tests__/ReplayPage.test.tsx`

### Step 5.1: `EventRow.tsx`

Renderiza variant correto do SessionEvent. Cada tipo tem cor/ícone próprio.

```tsx
import type { SessionEvent } from '@/lib/session/types';

function levelColor(type: SessionEvent['type']): string {
	switch (type) {
		case 'network': return 'text-blue-700';
		case 'console': return 'text-slate-700';
		case 'route': return 'text-purple-700';
		case 'error': return 'text-red-700';
		case 'detection': return 'text-emerald-700';
	}
}

function eventLabel(ev: SessionEvent): string {
	switch (ev.type) {
		case 'network': return `[${ev.method}] ${ev.url} → ${ev.status}`;
		case 'console': {
			const text = ev.args.map((a) => a.description).join(' ');
			const count = ev.coalesceCount && ev.coalesceCount > 1 ? ` (×${ev.coalesceCount})` : '';
			return `[${ev.level.toUpperCase()}] ${text}${count}`;
		}
		case 'route': return `[ROUTE/${ev.triggerType}] ${ev.url}`;
		case 'error': return `[ERROR] ${ev.message}`;
		case 'detection': return `[PHASE START] ${ev.phaseId}`;
	}
}

interface Props {
	event: SessionEvent;
	startedAt: number;
}

export function EventRow({ event, startedAt }: Props) {
	const offsetMs = event.timestamp >= 1e12 ? event.timestamp - startedAt : event.timestamp * 1000 - startedAt;
	const sec = (offsetMs / 1000).toFixed(2);
	return (
		<div className="grid grid-cols-[auto_1fr] items-baseline gap-3 border-b px-3 py-1 font-mono text-xs">
			<span className="text-muted-foreground">+{sec}s</span>
			<span className={levelColor(event.type)}>{eventLabel(event)}</span>
		</div>
	);
}
```

> **Atenção:** CDP timestamps de `Runtime.consoleAPICalled` vêm em segundos (`.timestamp` do CDP é seconds-since-epoch com fração). `Date.now()` é ms. Heurística aqui: se timestamp < 1e12, assumir segundos e converter. Não é perfeito mas suficiente pra timeline.

### Step 5.2: `PhaseList.tsx`

```tsx
import type { DetectionPhase } from '@/lib/session/types';

interface Props {
	phases: DetectionPhase[];
}

export function PhaseList({ phases }: Props) {
	return (
		<div className="flex flex-col gap-2">
			<h2 className="font-semibold text-sm">Environment Phases ({phases.length})</h2>
			{phases.map((p, i) => (
				<div key={p.id} className="rounded border p-2 text-xs">
					<div className="font-medium">
						Fase {i + 1} — {p.fingerprint.framework.name}
						{p.fingerprint.framework.version && ` v${p.fingerprint.framework.version}`}
					</div>
					<div className="text-muted-foreground">
						{p.pages.length} {p.pages.length === 1 ? 'URL' : 'URLs'}
					</div>
					{p.fingerprint.dataFetching.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{p.fingerprint.dataFetching.map((lib) => (
								<span
									key={lib.name}
									className="rounded bg-slate-100 px-1 text-[10px]"
									title={lib.treatment === 'detection-only' ? 'Detectada, sem tratamento dedicado' : 'Tratada'}
								>
									{lib.name} {lib.treatment === 'detection-only' && '(detection-only)'}
								</span>
							))}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
```

### Step 5.3: `ReplayPage.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { EventRow } from '@/components/replay/EventRow';
import { PhaseList } from '@/components/replay/PhaseList';
import { sessionStore } from '@/lib/session/storage';
import type { Session, SessionEvent } from '@/lib/session/types';

const FILTERS: SessionEvent['type'][] = ['network', 'console', 'route', 'error', 'detection'];

export function ReplayPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const [session, setSession] = useState<Session | null>(null);
	const [enabled, setEnabled] = useState<Record<string, boolean>>({
		network: true, console: true, route: true, error: true, detection: false,
	});

	useEffect(() => {
		if (!sessionId) return;
		void sessionStore.get(sessionId).then(setSession);
	}, [sessionId]);

	if (!session) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;

	const filtered = session.events.filter((e) => enabled[e.type]);

	return (
		<div className="flex h-full flex-col gap-3 p-4">
			<div className="flex items-baseline justify-between">
				<h1 className="font-semibold text-xl">Replay — {session.metadata.initialUrl}</h1>
				<span className="text-muted-foreground text-xs">
					{session.events.length} eventos · {session.detectionPhases.length} fases
				</span>
			</div>

			<div className="flex items-center gap-3 rounded border p-2 text-xs">
				<span className="font-medium">Filtros:</span>
				{FILTERS.map((f) => (
					<label key={f} className="flex items-center gap-1">
						<Checkbox
							checked={!!enabled[f]}
							onCheckedChange={(v) => setEnabled((prev) => ({ ...prev, [f]: v === true }))}
						/>
						{f}
					</label>
				))}
			</div>

			<div className="grid grid-cols-[1fr_280px] gap-3 overflow-hidden">
				<div className="overflow-auto rounded border">
					{filtered.length === 0 ? (
						<p className="p-3 text-muted-foreground text-sm">Nenhum evento para os filtros selecionados.</p>
					) : (
						filtered.map((ev, i) => (
							<EventRow key={i} event={ev} startedAt={session.startedAt} />
						))
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

### Step 5.4: Adicionar rota

Em `routes.tsx`:
```tsx
{ path: '/replay/:sessionId', element: <ReplayPage /> }
```

### Step 5.5: Test

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionStore } from '@/lib/session/storage';
import { ReplayPage } from '../ReplayPage';
import type { Session } from '@/lib/session/types';

const baseSession = (): Session => ({
	id: 'sess_x',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 5_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [
		{
			id: 'phase_1',
			startTimestamp: 1_000,
			endTimestamp: 1_500,
			fingerprint: {
				framework: { name: 'react', version: '18.2.0' },
				httpClients: [{ name: 'fetch', confidence: 'high' }],
				dataFetching: [],
				stateManagers: [],
				detectedAt: 1_000,
				isProductionBuild: false,
			},
			pages: [{ url: 'https://example/', timestamp: 1_000, fingerprint: {} as never, triggerType: 'initial' }],
		},
	],
	events: [
		{
			type: 'network',
			timestamp: 2_000,
			phaseId: 'phase_1',
			requestId: 'r1',
			method: 'GET',
			url: 'https://api/x',
			status: 200,
		},
		{
			type: 'console',
			timestamp: 2_500,
			phaseId: 'phase_1',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'hello' }],
		},
	],
});

beforeEach(async () => {
	await sessionStore.clear();
});

afterEach(async () => {
	await sessionStore.clear();
});

describe('ReplayPage', () => {
	it('renderiza eventos da sessão e contagem', async () => {
		await sessionStore.put(baseSession());
		render(
			<MemoryRouter initialEntries={['/replay/sess_x']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText(/Replay/i)).toBeInTheDocument());
		expect(screen.getByText(/2 eventos · 1 fases/i)).toBeInTheDocument();
		expect(screen.getByText(/\[GET\]/)).toBeInTheDocument();
		expect(screen.getByText(/\[LOG\] hello/)).toBeInTheDocument();
	});

	it('renderiza fase com framework', async () => {
		await sessionStore.put(baseSession());
		render(
			<MemoryRouter initialEntries={['/replay/sess_x']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText(/react/i)).toBeInTheDocument());
	});

	it('mostra "Carregando…" quando sessionId não encontrado', () => {
		render(
			<MemoryRouter initialEntries={['/replay/inexistente']}>
				<Routes>
					<Route path="/replay/:sessionId" element={<ReplayPage />} />
				</Routes>
			</MemoryRouter>,
		);
		expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
	});
});
```

### Step 5.6: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/pages/__tests__/ReplayPage.test.tsx
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/pages/ReplayPage.tsx app/src/components/replay/ app/src/routes.tsx app/src/pages/__tests__/ReplayPage.test.tsx
git commit -m "feat(session): página /replay/:sessionId com timeline de events e PhaseList"
```

---

## Self-Review Checklist

- [ ] **Spec coverage Phase 1c:**
  - Toggle Gravação no header ✓ (Task 3)
  - Canvas checkbox modal ✓ (Task 3)
  - Banner permanente com counter ✓ (Task 3)
  - Modal retenção 10 sessões ✓ (Task 3)
  - Página /sessions com lista + delete ✓ (Task 4)
  - Página /replay/:sessionId com timeline básica ✓ (Task 5)
  - Renomeação `__debug_*` → `startRecording`/`stopRecording` ✓ (Task 1)

- [ ] **No-fallbacks check:** sem fabricação de dados. Estados "vazio" são UX legítima.

- [ ] **Type consistency:** UI consome tipos canônicos de `@/lib/session/types` (não duplica).

---

## Pontos abertos pra Phase 1d / Phase 2

- Sessões importadas (origin: 'imported') aparecem na mesma lista mas Import action vem em Phase 1d.
- Replay sem rrweb visual (Phase 2 adiciona player).
- Sem antipattern panel (Phase 3).
- Counter de tamanho usa estimateEventBytes em vez de bytes reais persistidos — diferença ~5% aceitável.
