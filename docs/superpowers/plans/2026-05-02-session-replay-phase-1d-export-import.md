# Session Replay — Phase 1d: Export / Import (.dbsession + viewer standalone)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fechar Phase 1 com Export/Import de `.dbsession`. QA grava sessão na Phase 1c, exporta arquivo único, anexa em Jira. Outro dev importa via file picker e abre no replay player. Modal de confirmação agressivo no Export antecipa privacidade até Fase 6.

**Architecture:** Bibliotecas puras `lib/session/exporter.ts` (serializa Session → zip blob via JSZip) e `lib/session/importer.ts` (parse zip → grava em sessionStore com `origin: 'imported'`). Background handlers `exportSession {sessionId}` (devolve `ArrayBuffer`) e `importSession {data: ArrayBuffer}` (devolve `{sessionId}`). UI: botão Export no `SessionRow` com modal agressivo, botão Import no `/sessions` com `<input type="file">`. Viewer standalone embebido como string template (vanilla JS, sem React) que renderiza session.json offline.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` (seção 11 Export/Import + 13 modal de confirmação agressivo).

---

## File Structure

**Modify:**
- `app/src/types/messages.ts` — adicionar `exportSession` e `importSession`.
- `app/src/entrypoints/background.ts` — handlers que delegam pra `exporter.serializeSession` e `importer.parseDbsession`.
- `app/src/components/recording/SessionRow.tsx` — botão Export + modal de confirmação.
- `app/src/pages/SessionsPage.tsx` — botão "Importar `.dbsession`" + file picker.
- `app/package.json` — `jszip` como dep.

**Create:**
- `app/src/lib/session/exporter.ts` — `serializeSession(session): Promise<ArrayBuffer>` retorna zip com `session.json`, `manifest.json`, `viewer.html`.
- `app/src/lib/session/importer.ts` — `parseDbsession(buf: ArrayBuffer): Promise<Session>` que valida schema, gera novo id com prefix `imported_`, marca `origin: 'imported'`.
- `app/src/lib/session/viewerTemplate.ts` — string template do `viewer.html` standalone (vanilla JS, ~10KB).
- `app/src/components/recording/ExportConfirmDialog.tsx` — modal de confirmação agressivo reutilizável.
- `app/src/components/recording/ImportButton.tsx` — botão + file picker hidden.

**Test (co-located):**
- `app/src/lib/session/__tests__/exporter.test.ts`
- `app/src/lib/session/__tests__/importer.test.ts`
- `app/src/components/recording/__tests__/ExportConfirmDialog.test.tsx`

---

## Decisões de design

**JSZip vs alternativas:** JSZip é maduro, MIT, ~150KB browser bundle. Native `CompressionStream` daria menor footprint mas ainda não tem suporte universal e não cria zip multi-file facilmente. JSZip é a escolha pragmática.

**Body blobs:** Phase 1d **NÃO** inclui body blobs no zip. NetworkEvents têm `bodyRef` mas o blob fica em IndexedDB original — quando importado, `bodyRef` aponta pra blob inexistente. UI mostra "body não disponível" se tentar abrir. Phase 2 ou follow-up adiciona body persistido.

**Viewer standalone:** HTML autocontido com `<script>` que tem `const SESSION = {...}` injetado e renderiza vanilla. Sem dependências externas. ~10KB total. Reusa CSS inline minimal. Não tem rrweb ainda (Phase 2 atualiza).

**ID com prefix `imported_`:** evita colisão com sessions gravadas locais. Spec menciona `/replay/imported-<hash>` mas pra simplicidade Phase 1d usa `imported_<originalId>_<timestamp>`. Rota continua `/replay/:sessionId` (regex match).

**Validação no import:** check `schemaVersion === 1` + presença de campos required (`id`, `startedAt`, `events`, `detectionPhases`). Forward-compat: campos extras desconhecidos são preservados sem alteração (consistente com decisão "schemaVersion fixo, campos opcionais").

---

## Task 1: Exporter + viewer template

**Files:**
- Create: `app/src/lib/session/viewerTemplate.ts`
- Create: `app/src/lib/session/exporter.ts`
- Test: `app/src/lib/session/__tests__/exporter.test.ts`
- Modify: `app/package.json` (jszip)

### Step 1.1: Instalar jszip

```bash
cd app && npm install jszip
```

### Step 1.2: Criar `viewerTemplate.ts`

`app/src/lib/session/viewerTemplate.ts`:

```ts
// Template HTML standalone que renderiza uma session offline.
// SESSION_PLACEHOLDER é substituído por JSON.stringify(session) na hora do export.

export function buildViewerHtml(sessionJson: string): string {
	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Debug Buddy — Session Viewer</title>
<style>
	body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; color: #1f2937; }
	header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
	h1 { font-size: 18px; margin: 0; font-weight: 600; }
	.meta { color: #6b7280; font-size: 12px; }
	main { display: grid; grid-template-columns: 1fr 280px; gap: 12px; height: calc(100vh - 80px); }
	.timeline { overflow: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
	.row { display: grid; grid-template-columns: auto 1fr; gap: 12px; padding: 4px 12px; border-bottom: 1px solid #f3f4f6; font-family: ui-monospace, monospace; font-size: 11px; }
	.offset { color: #6b7280; }
	.t-network { color: #1d4ed8; }
	.t-console { color: #334155; }
	.t-route { color: #7c3aed; }
	.t-error { color: #b91c1c; }
	.t-detection { color: #047857; }
	aside { overflow: auto; }
	.phase { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; font-size: 11px; margin-bottom: 8px; }
	.banner { background: #fef3c7; color: #92400e; padding: 6px 12px; font-size: 12px; border-radius: 4px; margin-bottom: 12px; }
</style>
</head>
<body>
<div class="banner">Debug Buddy Session Viewer (offline standalone) — sem rrweb visual nesta versão.</div>
<header>
	<h1 id="title">Carregando…</h1>
	<span class="meta" id="meta"></span>
</header>
<main>
	<div class="timeline" id="timeline"></div>
	<aside id="phases"></aside>
</main>
<script>
const SESSION = ${sessionJson};

function escape(s) {
	return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function eventLabel(ev) {
	switch (ev.type) {
		case 'network': return '[' + ev.method + '] ' + ev.url + ' → ' + ev.status;
		case 'console': {
			const text = (ev.args || []).map(a => a.description).join(' ');
			const count = ev.coalesceCount > 1 ? ' (×' + ev.coalesceCount + ')' : '';
			return '[' + (ev.level || '').toUpperCase() + '] ' + text + count;
		}
		case 'route': return '[ROUTE/' + ev.triggerType + '] ' + ev.url;
		case 'error': return '[ERROR] ' + ev.message;
		case 'detection': return '[PHASE START] ' + ev.phaseId;
		default: return '[' + ev.type + ']';
	}
}

function offsetSec(ev, startedAt) {
	const ms = ev.timestamp >= 1e12 ? (ev.timestamp - startedAt) : (ev.timestamp * 1000 - startedAt);
	return (ms / 1000).toFixed(2);
}

document.getElementById('title').textContent = 'Replay — ' + (SESSION.metadata && SESSION.metadata.initialUrl || 'sem URL');
document.getElementById('meta').textContent = (SESSION.events || []).length + ' eventos · ' + (SESSION.detectionPhases || []).length + ' fases';

const timeline = document.getElementById('timeline');
(SESSION.events || []).forEach(ev => {
	const row = document.createElement('div');
	row.className = 'row';
	row.innerHTML = '<span class="offset">+' + offsetSec(ev, SESSION.startedAt) + 's</span><span class="t-' + ev.type + '">' + escape(eventLabel(ev)) + '</span>';
	timeline.appendChild(row);
});

const phases = document.getElementById('phases');
(SESSION.detectionPhases || []).forEach((p, i) => {
	const div = document.createElement('div');
	div.className = 'phase';
	const fw = (p.fingerprint && p.fingerprint.framework) || {};
	div.innerHTML = '<strong>Fase ' + (i + 1) + ' — ' + escape(fw.name || '') + (fw.version ? ' v' + escape(fw.version) : '') + '</strong><br>' + (p.pages || []).length + ' URL(s)';
	phases.appendChild(div);
});
</script>
</body>
</html>`;
}
```

### Step 1.3: Criar `exporter.ts`

`app/src/lib/session/exporter.ts`:

```ts
import JSZip from 'jszip';
import type { Session } from './types';
import { buildViewerHtml } from './viewerTemplate';

export interface DbSessionManifest {
	formatVersion: 1;
	createdAt: number;
	sessionId: string;
	sessionSchemaVersion: 1;
	exporterAgent: string;
}

export async function serializeSession(session: Session): Promise<ArrayBuffer> {
	const zip = new JSZip();
	const sessionJson = JSON.stringify(session, null, 2);
	const manifest: DbSessionManifest = {
		formatVersion: 1,
		createdAt: Date.now(),
		sessionId: session.id,
		sessionSchemaVersion: session.schemaVersion,
		exporterAgent: 'debug-buddy',
	};

	zip.file('manifest.json', JSON.stringify(manifest, null, 2));
	zip.file('session.json', sessionJson);
	zip.file('viewer.html', buildViewerHtml(sessionJson));

	return zip.generateAsync({ type: 'arraybuffer' });
}
```

### Step 1.4: Test

`app/src/lib/session/__tests__/exporter.test.ts`:

```ts
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { serializeSession } from '../exporter';
import type { Session } from '../types';

const baseSession = (): Session => ({
	id: 'sess_test',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example.test/',
		userAgent: 'jsdom',
		viewportSize: { w: 1280, h: 720 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [
		{
			type: 'console',
			timestamp: 1_500,
			phaseId: 'p1',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'hello' }],
		},
	],
});

describe('serializeSession', () => {
	it('gera zip com manifest.json, session.json e viewer.html', async () => {
		const buf = await serializeSession(baseSession());
		const zip = await JSZip.loadAsync(buf);
		expect(Object.keys(zip.files).sort()).toEqual([
			'manifest.json',
			'session.json',
			'viewer.html',
		]);
	});

	it('manifest.json tem formatVersion=1 e sessionId correto', async () => {
		const buf = await serializeSession(baseSession());
		const zip = await JSZip.loadAsync(buf);
		const manifestText = await zip.file('manifest.json')!.async('text');
		const manifest = JSON.parse(manifestText);
		expect(manifest.formatVersion).toBe(1);
		expect(manifest.sessionId).toBe('sess_test');
		expect(manifest.sessionSchemaVersion).toBe(1);
		expect(manifest.exporterAgent).toBe('debug-buddy');
	});

	it('session.json round-trips o objeto Session', async () => {
		const original = baseSession();
		const buf = await serializeSession(original);
		const zip = await JSZip.loadAsync(buf);
		const text = await zip.file('session.json')!.async('text');
		expect(JSON.parse(text)).toEqual(original);
	});

	it('viewer.html embute o JSON da session', async () => {
		const buf = await serializeSession(baseSession());
		const zip = await JSZip.loadAsync(buf);
		const html = await zip.file('viewer.html')!.async('text');
		expect(html).toContain('"sess_test"');
		expect(html).toContain('"hello"');
		expect(html).toContain('Debug Buddy');
	});
});
```

### Step 1.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/exporter.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/exporter.ts app/src/lib/session/viewerTemplate.ts app/src/lib/session/__tests__/exporter.test.ts app/package.json app/package-lock.json
git commit -m "feat(session): exporter de .dbsession com viewer.html standalone"
```

Esperado: 4 testes exporter, suite total 869.

---

## Task 2: Importer

**Files:**
- Create: `app/src/lib/session/importer.ts`
- Test: `app/src/lib/session/__tests__/importer.test.ts`

### Step 2.1: Implementar

`app/src/lib/session/importer.ts`:

```ts
import JSZip from 'jszip';
import type { Session } from './types';

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateRawSession(raw: unknown): asserts raw is Session {
	if (!isObject(raw)) throw new Error('session.json não é um objeto');
	if (raw.schemaVersion !== 1) {
		throw new Error(`schemaVersion inesperada: ${String(raw.schemaVersion)} (esperado: 1)`);
	}
	if (typeof raw.id !== 'string') throw new Error('session.id ausente ou inválido');
	if (typeof raw.startedAt !== 'number') throw new Error('session.startedAt ausente');
	if (!Array.isArray(raw.events)) throw new Error('session.events deve ser array');
	if (!Array.isArray(raw.detectionPhases)) throw new Error('session.detectionPhases deve ser array');
	if (!isObject(raw.metadata)) throw new Error('session.metadata ausente');
}

function newImportedId(originalId: string): string {
	return `imported_${originalId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function parseDbsession(buf: ArrayBuffer): Promise<Session> {
	const zip = await JSZip.loadAsync(buf);
	const sessionFile = zip.file('session.json');
	if (!sessionFile) throw new Error('arquivo session.json ausente no .dbsession');
	const text = await sessionFile.async('text');
	const raw = JSON.parse(text);
	validateRawSession(raw);
	// Reescreve id pra evitar colisão com sessions locais; marca origin=imported.
	const imported: Session = {
		...raw,
		id: newImportedId(raw.id),
		origin: 'imported',
	};
	return imported;
}
```

### Step 2.2: Test

`app/src/lib/session/__tests__/importer.test.ts`:

```ts
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { serializeSession } from '../exporter';
import { parseDbsession } from '../importer';
import type { Session } from '../types';

const baseSession = (overrides: Partial<Session> = {}): Session => ({
	id: 'sess_orig',
	schemaVersion: 1,
	startedAt: 1_000,
	endedAt: 2_000,
	origin: 'recorded',
	tabId: 1,
	metadata: {
		initialUrl: 'https://example/',
		userAgent: '',
		viewportSize: { w: 1, h: 1 },
		canvasCaptureEnabled: false,
	},
	detectionPhases: [],
	events: [],
	...overrides,
});

async function buildBufferWithRawSession(raw: unknown): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('session.json', JSON.stringify(raw));
	zip.file('manifest.json', '{}');
	return zip.generateAsync({ type: 'arraybuffer' });
}

describe('parseDbsession', () => {
	it('round-trips uma session, gera novo id e marca origin=imported', async () => {
		const buf = await serializeSession(baseSession());
		const imported = await parseDbsession(buf);
		expect(imported.id).toMatch(/^imported_sess_orig_/);
		expect(imported.origin).toBe('imported');
		expect(imported.startedAt).toBe(1_000);
		expect(imported.metadata.initialUrl).toBe('https://example/');
	});

	it('rejeita zip sem session.json', async () => {
		const zip = new JSZip();
		zip.file('outro.txt', 'nada');
		const buf = await zip.generateAsync({ type: 'arraybuffer' });
		await expect(parseDbsession(buf)).rejects.toThrow(/session\.json ausente/);
	});

	it('rejeita schemaVersion diferente de 1', async () => {
		const buf = await buildBufferWithRawSession({
			...baseSession(),
			schemaVersion: 99,
		});
		await expect(parseDbsession(buf)).rejects.toThrow(/schemaVersion inesperada/);
	});

	it('rejeita session.json com id ausente', async () => {
		const buf = await buildBufferWithRawSession({
			schemaVersion: 1,
			startedAt: 1,
			events: [],
			detectionPhases: [],
			metadata: {},
		});
		await expect(parseDbsession(buf)).rejects.toThrow(/id ausente/);
	});

	it('preserva campos opcionais desconhecidos (forward compat)', async () => {
		const buf = await buildBufferWithRawSession({
			...baseSession(),
			rrwebEvents: [{ foo: 'bar' }], // campo de Phase 2 que esta versão não conhece
		});
		const imported = await parseDbsession(buf);
		expect((imported as unknown as { rrwebEvents: unknown[] }).rrwebEvents).toEqual([
			{ foo: 'bar' },
		]);
	});
});
```

### Step 2.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/importer.test.ts
cd app && npm test 2>&1 | tail -5
git add app/src/lib/session/importer.ts app/src/lib/session/__tests__/importer.test.ts
git commit -m "feat(session): importer de .dbsession com validação de schema"
```

Esperado: 5 testes importer, suite total 874.

---

## Task 3: Background handlers + UI Export/Import

**Files:**
- Modify: `app/src/types/messages.ts`
- Modify: `app/src/entrypoints/background.ts`
- Modify: `app/src/components/recording/SessionRow.tsx`
- Modify: `app/src/pages/SessionsPage.tsx`
- Create: `app/src/components/recording/ExportConfirmDialog.tsx`
- Create: `app/src/components/recording/ImportButton.tsx`
- Test: `app/src/components/recording/__tests__/ExportConfirmDialog.test.tsx`

### Step 3.1: Adicionar actions

Em `app/src/types/messages.ts`, adicionar à união existente:

```ts
| { action: 'exportSession'; sessionId: string }
| { action: 'importSession'; data: ArrayBuffer; filename?: string }
```

E em `MessageResponse`, garantir que tem `data?: ArrayBuffer` e `sessionId?: string` (já tem sessionId).

### Step 3.2: Handlers no background

Em `app/src/entrypoints/background.ts`, adicionar imports:

```ts
import { serializeSession } from '@/lib/session/exporter';
import { parseDbsession } from '@/lib/session/importer';
```

Adicionar handlers:

```ts
if (message.action === 'exportSession') {
	(async () => {
		try {
			const session = await sessionStore.get(message.sessionId);
			if (!session) {
				sendResponse({ ok: false, error: 'Sessão não encontrada' });
				return;
			}
			const data = await serializeSession(session);
			sendResponse({ ok: true, data });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}

if (message.action === 'importSession') {
	(async () => {
		try {
			const session = await parseDbsession(message.data);
			await sessionStore.put(session);
			sendResponse({ ok: true, sessionId: session.id });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

### Step 3.3: Criar `ExportConfirmDialog.tsx`

`app/src/components/recording/ExportConfirmDialog.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function ExportConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Exportar sessão — leia antes</DialogTitle>
					<DialogDescription className="text-sm">
						Este arquivo contém TUDO que foi gravado: requisições e respostas da rede (incluindo
						<strong> Authorization headers e cookies</strong>), todas as mensagens de console
						(incluindo qualquer <strong>senha, token ou número de cartão</strong> que tenha sido
						logado em <code>console.log</code>), e o estado da aplicação. Revise antes de anexar
						em qualquer lugar público (Jira, Slack, e-mail). Mascaramento automático será
						adicionado em uma versão futura.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						variant="destructive"
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
					>
						Entendi, exportar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

### Step 3.4: Adicionar Export ao `SessionRow.tsx`

Adicionar import:
```tsx
import { useState } from 'react';
import { ExportConfirmDialog } from './ExportConfirmDialog';
```

Adicionar state e função de download dentro do componente:
```tsx
const [exportOpen, setExportOpen] = useState(false);

const onConfirmExport = async () => {
	const res = await chrome.runtime.sendMessage({
		action: 'exportSession',
		sessionId: session.id,
	});
	if (!res?.ok || !res.data) return;
	const blob = new Blob([res.data], { type: 'application/zip' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${session.id}.dbsession`;
	a.click();
	URL.revokeObjectURL(url);
};
```

Adicionar botão "Exportar" ANTES do "Excluir":
```tsx
<Button size="sm" variant="ghost" onClick={() => setExportOpen(true)}>
	Exportar
</Button>
<ExportConfirmDialog
	open={exportOpen}
	onOpenChange={setExportOpen}
	onConfirm={() => void onConfirmExport()}
/>
```

Atualizar `grid-cols-[auto_1fr_auto_auto_auto_auto_auto]` (uma coluna a mais).

### Step 3.5: Criar `ImportButton.tsx`

`app/src/components/recording/ImportButton.tsx`:

```tsx
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Props {
	onImported?: (sessionId: string) => void;
}

export function ImportButton({ onImported }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();

	const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const buf = await file.arrayBuffer();
		const res = await chrome.runtime.sendMessage({
			action: 'importSession',
			data: buf,
			filename: file.name,
		});
		// Reset input pra permitir re-importar mesmo arquivo
		e.target.value = '';
		if (!res?.ok || !res.sessionId) {
			window.alert(`Falha ao importar: ${res?.error ?? 'erro desconhecido'}`);
			return;
		}
		onImported?.(res.sessionId);
		navigate(`/replay/${res.sessionId}`);
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".dbsession,application/zip"
				className="hidden"
				onChange={onChange}
			/>
			<Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
				Importar .dbsession
			</Button>
		</>
	);
}
```

### Step 3.6: Adicionar `ImportButton` no `SessionsPage.tsx`

No header da página, ao lado da contagem:

```tsx
<div className="flex items-center gap-3">
	<span className="text-muted-foreground text-sm">
		{sessions.length} / 10 (limite de retenção)
	</span>
	<ImportButton onImported={() => void refresh()} />
</div>
```

(Ajustar o layout flex/justify pra não estourar.)

> Note: `useSessions` agora precisa expor `refresh` no destructuring — já expõe.

### Step 3.7: Test do ExportConfirmDialog

`app/src/components/recording/__tests__/ExportConfirmDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExportConfirmDialog } from '../ExportConfirmDialog';

describe('ExportConfirmDialog', () => {
	it('renderiza aviso de privacidade quando aberto', () => {
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		expect(screen.getByText(/Authorization headers e cookies/i)).toBeInTheDocument();
		expect(screen.getByText(/senha, token ou número de cartão/i)).toBeInTheDocument();
	});

	it('botão "Entendi, exportar" chama onConfirm e fecha', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(
			<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />,
		);
		await user.click(screen.getByRole('button', { name: /Entendi/i }));
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('botão Cancelar fecha sem chamar onConfirm', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(
			<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />,
		);
		await user.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
```

### Step 3.8: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/recording/__tests__/ExportConfirmDialog.test.tsx
cd app && npm test 2>&1 | tail -5
cd app && npm run build
git add app/src/types/messages.ts app/src/entrypoints/background.ts app/src/components/recording/ app/src/pages/SessionsPage.tsx
git commit -m "feat(session): handlers exportSession/importSession + UI Export modal + Import button"
```

Esperado: 3 testes ExportConfirmDialog, suite total 877.

---

## Self-Review Checklist

- [ ] **Spec coverage Phase 1d:**
  - .dbsession zip com manifest + session + viewer ✓ (Task 1)
  - Viewer.html standalone (sem rrweb ainda) ✓ (Task 1)
  - Modal de confirmação agressivo ✓ (Task 3)
  - Import via file picker → IDB ✓ (Task 3)
  - origin=imported ao importar ✓ (Task 2)
  - Importadas contam no limite de 10 ✓ (já vinha da Phase 1c — useSessions lista todas)

- [ ] **No-fallbacks check:** importer rejeita schema inválido (não inventa dados); exporter falha se session não existe.

---

## Pontos abertos pra Phase 2 / Phase 6

- Body blobs de network não são incluídos no zip — bodyRef referencia blob inexistente após import. Phase 2 ou follow-up adiciona blobs.
- Viewer.html sem rrweb (Phase 2 atualiza com rrweb-player embedded).
- Privacidade só com modal de confirmação — Fase 6 adiciona mascaramento real.
- Sem download progress UI (sessions pequenas, ~MB, transfer instantânea).
