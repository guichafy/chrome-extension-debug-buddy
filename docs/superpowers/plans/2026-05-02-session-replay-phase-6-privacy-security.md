# Session Replay — Phase 6: Privacidade e Segurança

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Endereçar **todos** os `> **TODO Privacidade:**` da spec (seções 6, 7, 7-bis, 8, 9, 10, 11) e a seção 13 inteira. Esta é a **última** fase antes de release público amplo. Pré-requisito: Fase 5 entregue (Angular taps + state capture + antipatterns + rrweb visual replay). Saída: extensão segura para QA exportar `.dbsession` por Jira/Slack sem vazar senhas, tokens, cookies, PII em headers/bodies/console/state, com gate de URLs blacklisted, banner ruidoso de gravação, aviso ao importar sessões cross-origin, auto-purge configurável e mascaramento rrweb default agressivo.

**Architecture:** Tudo gira em torno de uma única estrutura `RedactionConfig` persistida em `chrome.storage.local.privacyConfig`, lida pelo background no momento da captura (network/console/state/source-map). Utils puros em `app/src/lib/session/privacy/*` (header / body / console / state / path / url) consumidos tanto pelo background quanto por um `urlGate` chamado **antes** de qualquer tap. rrweb recebe os seletores via `record({ maskTextSelector, maskInputOptions, maskInputFn })` configurados a partir da mesma config. Auto-purge roda em `chrome.runtime.onStartup` + `onInstalled` deletando sessões com `endedAt < now - retentionDays`. Cada `Session` ganha campo opcional `redactionApplied?: RedactionConfig` (subset sanitizado, sem regex sensível) preenchido no `recorder.stopRecording()` para auditoria. Banner `RecordingBanner` ganha cor vermelha forte, animação `animate-pulse` permanente e label "GRAVANDO — clique aqui para parar". `ExportConfirmDialog` deixa de mencionar "versão futura" e referencia a config aplicada. Nova rota `/settings/privacy` em `app/src/pages/PrivacySettingsPage.tsx` com toggles e listas editáveis. ImportButton/ReplayPage detectam origem da sessão importada vs. tab atual via `metadata.initialUrl`.

**Spec source:** `docs/superpowers/specs/2026-05-02-session-replay-design.md` — seção 13 (Privacidade e segurança) inteira; e os blocos `> **TODO Privacidade:**` em §6 (paths em stack), §7 (rrweb mask), §7-bis (console regex), §8 (source-map paths), §9 (state whitelist), §10 (`redactionApplied`), §11 (banner ruidoso, sessão importada cross-origin).

---

## File Structure

**Modify:**
- `app/src/lib/session/types.ts` — adicionar `RedactionConfig` + `redactionApplied?: RedactionConfig` em `Session`.
- `app/src/lib/session/recorder.ts` — preencher `redactionApplied` no stop; passar `RedactionConfig` para os taps; integrar `urlGate` antes de iniciar gravação.
- `app/src/entrypoints/background.ts` — aplicar `headerRedactor`/`bodyRedactor` em network capture; `consoleRedactor` em console capture; `stateRedactor` antes do diff; `pathTruncator` no source-map resolver e em stacks; `urlGate` para descartar URLs banidos; auto-purge no startup; novos handlers `getPrivacyConfig`/`setPrivacyConfig`.
- `app/src/components/recording/RecordingBanner.tsx` — cor vermelha forte, animação permanente, dismiss bloqueado, texto "GRAVANDO — clique aqui para parar".
- `app/src/components/recording/RecordingToggle.tsx` — link para `/settings/privacy` no modal pré-gravação ("Configurar privacidade").
- `app/src/components/recording/ExportConfirmDialog.tsx` — remover "Mascaramento automático será adicionado em uma versão futura"; substituir por sumário do `RedactionConfig` aplicado ("A sessão já está mascarada conforme suas configurações: <bullets>").
- `app/src/components/recording/ImportButton.tsx` — chamar `useImportOriginCheck` e disparar modal `ImportOriginWarningDialog` se origem da sessão importada ≠ origem da tab atual.
- `app/src/pages/ReplayPage.tsx` — banner de aviso permanente ("Sessão importada de <origem> — diferente da tab atual <origem-atual>") quando aplicável.
- `app/src/routes.tsx` — adicionar rota `/settings/privacy`.
- `app/src/components/layout/NavMain.tsx` (ou equivalente) — link "Privacidade" na sidebar de Settings.
- `app/src/probe/main.ts` — passar `maskTextSelector`/`maskInputOptions` para `record()` do rrweb a partir da config sincronizada via bridge.
- `app/src/probe/bridge.ts` — propagar a `RedactionConfig` (subset rrweb) do isolated content script para o MAIN-world probe.
- `app/src/types/messages.ts` — adicionar `getPrivacyConfig`, `setPrivacyConfig`, `purgeOldSessions`.

**Create:**
- `app/src/lib/session/privacy/defaults.ts` — `DEFAULT_REDACTION_CONFIG` agressiva.
- `app/src/lib/session/privacy/config.ts` — leitura/escrita em `chrome.storage.local`, validação de regex (lança em `RegExp.SyntaxError`), subset-para-`redactionApplied`.
- `app/src/lib/session/privacy/headerRedactor.ts` — redação de headers por keyList + regex.
- `app/src/lib/session/privacy/bodyRedactor.ts` — string-sweeping com regex configurável.
- `app/src/lib/session/privacy/consoleRedactor.ts` — sanitiza `description` em `ConsoleArgPreview`.
- `app/src/lib/session/privacy/stateRedactor.ts` — whitelisting/blacklisting de paths JSON antes do diff.
- `app/src/lib/session/privacy/pathTruncator.ts` — truncar `/Users/<u>/`, `/home/<u>/`, `C:\\Users\\<u>\\`.
- `app/src/lib/session/privacy/urlGate.ts` — `shouldIgnoreUrl(url, config): boolean`.
- `app/src/lib/session/privacy/autoPurge.ts` — `purgeOldSessions(retentionDays): Promise<number>`.
- `app/src/pages/PrivacySettingsPage.tsx` — UI da rota `/settings/privacy`.
- `app/src/components/recording/ImportOriginWarningDialog.tsx` — modal de aviso cross-origin.
- `app/src/hooks/usePrivacyConfig.ts` — hook React que lê/grava em `chrome.storage.local.privacyConfig`.

**Test (co-located):**
- `app/src/lib/session/privacy/__tests__/defaults.test.ts`
- `app/src/lib/session/privacy/__tests__/config.test.ts`
- `app/src/lib/session/privacy/__tests__/headerRedactor.test.ts`
- `app/src/lib/session/privacy/__tests__/bodyRedactor.test.ts`
- `app/src/lib/session/privacy/__tests__/consoleRedactor.test.ts`
- `app/src/lib/session/privacy/__tests__/stateRedactor.test.ts`
- `app/src/lib/session/privacy/__tests__/pathTruncator.test.ts`
- `app/src/lib/session/privacy/__tests__/urlGate.test.ts`
- `app/src/lib/session/privacy/__tests__/autoPurge.test.ts`
- `app/src/lib/session/__tests__/recorder.privacy.test.ts` — integração end-to-end no recorder.
- `app/src/components/recording/__tests__/RecordingBanner.test.tsx`
- `app/src/components/recording/__tests__/ExportConfirmDialog.privacy.test.tsx` — atualiza testes existentes.
- `app/src/components/recording/__tests__/ImportOriginWarningDialog.test.tsx`
- `app/src/pages/__tests__/PrivacySettingsPage.test.tsx`

---

## Decisões de design

**Onde aplicamos a redação?** No **momento da captura, no background**, nunca no momento do export. Razão: se o blob bruto chegar à IndexedDB, ele pode vazar via `useAllRequests` ou via outro caminho (ex: `getAllRequests`). Redigir-na-captura é o único ponto que garante "header não-redigido nunca toca disco".

**Sem fallback silencioso (regra do projeto):** Regex inválida em `RedactionConfig` lança `RegExp.SyntaxError` no momento de `setPrivacyConfig`. Não aceitamos config quebrada com fallback "ignora regex e segue". Mensagem clara para o usuário consertar.

**`redactionApplied` é subset sanitizado da config viva:** salvamos apenas as **chaves/listas** aplicadas (ex: `headerKeys: ['authorization', 'cookie']`, `urlBlacklist: ['banco.com.br']`), **não** as próprias regex (que podem ser específicas demais para vazar intent ou pattern). Isso é auditoria, não auditoria forense — o objetivo é "outro dev consegue saber o que ficou redigido", não reproduzir exatamente.

**rrweb default agressivo, configurável menos:** o default ON `maskAllInputs: true` é forte demais para muitas apps de dev. Vamos com:
- `maskInputOptions: { password: true, color: false, date: false, ... }` — só password mascarado por default.
- `maskTextSelector: '[autocomplete^="cc-"], .dbb-mask, [data-dbb-mask]'` — cartões + opt-in DOM.
- `maskInputFn` aplicado em campos com `autocomplete="cc-*"` ou `[name*="card"]`/`[name*="cvv"]`/`[name*="password"]`.
Dev liga "modo paranoico" via toggle "Mascarar todos os inputs (rrweb)" se quiser.

**Console redactor em `description`, não em `value`:** o preview do CDP às vezes traz `properties[i].value` mas aplicar regex em todo `value` é caro e pouco útil — devs raramente logam senha como propriedade nomeada de objeto. Por enquanto Phase 6 cobre só `args[i].description` (que é onde o `console.log('password:', x)` vai parar). Documentar limitação.

**State redactor com paths JSON:** glob simples `auth.*.token`, `user.email`, `cart.items.*.cardNumber`. Implementação: regex sobre o caminho serializado durante walk recursivo do snapshot. Aplica **antes** do diff — diff sobre snapshot redigido produz diff redigido.

**URL gate vs. URL blacklist:** `urlGate` filtra URLs **inteiras** (a sessão ignora 100% essas URLs — não captura request, console emitido na origin, rrweb se navegar). Diferente de `bodyRedactor` que só sanitiza conteúdo. Default vazio (usuário precisa adicionar `*.banco.com.br`, etc.).

**Auto-purge é opcional:** default OFF para preservar comportamento atual ("usuário deleta manualmente"). Quando ON, retentionDays default 30. Roda em `chrome.runtime.onStartup` e `chrome.runtime.onInstalled` (não em `onMessage` para não bloquear).

**Banner ruidoso aceita dismiss?** **NÃO**. Spec é explícita ("dismiss bloqueado"). Único caminho para sumir: parar gravação. Cor vermelha forte (`bg-red-600 text-white`), animação `animate-pulse` no dot + glow sutil no fundo, posição sticky no topo.

**Aviso de import cross-origin:** comparamos `metadata.initialUrl` (origin da sessão importada) com `chrome.tabs.query({active:true, currentWindow:true})[0].url` (origin da tab atual). Diferente → modal "Esta sessão foi gravada em <X> mas você está em <Y>. Continue se for esperado." Não bloqueia, só avisa (replay é cross-origin por design — spec §11).

**Sem migração explícita:** sessões antigas sem `redactionApplied` continuam abrindo (campo opcional). UI do replay mostra "Sessão gravada antes da Fase 6 — sem redação aplicada" se faltar o campo.

---

## Task 1: Tipos `RedactionConfig` + defaults

**Files:**
- Modify: `app/src/lib/session/types.ts`
- Create: `app/src/lib/session/privacy/defaults.ts`
- Test: `app/src/lib/session/privacy/__tests__/defaults.test.ts`

### Step 1.1: Estender `types.ts`

Adicionar ao final de `app/src/lib/session/types.ts`:

```ts
export interface RedactionConfig {
	enabled: boolean;
	// Network — headers
	headerKeys: string[];                // case-insensitive; ex: ['authorization', 'cookie']
	headerRegex: string[];               // ex: ['^x-.*-token$']
	// Network — bodies
	bodyRegex: string[];                 // ex: card-pan, JWT-like
	// Console
	consoleRegex: string[];              // aplicado em ConsoleArgPreview.description
	consoleEnabled: boolean;             // permite desligar p/ localhost
	// State
	stateBlacklistPaths: string[];       // glob simples — ex: 'auth.*.token'
	stateWhitelistPaths: string[];       // se preenchido, SÓ esses paths são preservados
	// rrweb
	rrwebMaskAllInputs: boolean;         // default false — só password
	rrwebMaskTextSelector: string;       // default '.dbb-mask, [data-dbb-mask]'
	// URL gate
	urlBlacklist: string[];              // domains/glob — ex: '*.banco.com.br'
	// Paths em stacks/source maps
	truncateUserPaths: boolean;          // default true
	// Retenção
	autoPurgeEnabled: boolean;
	autoPurgeRetentionDays: number;      // default 30
}
```

E modificar `Session`:

```ts
export interface Session {
	id: string;
	schemaVersion: 1;
	startedAt: number;
	endedAt: number | null;
	origin: SessionOrigin;
	tabId: number;
	metadata: SessionMetadata;
	detectionPhases: DetectionPhase[];
	events: SessionEvent[];
	telemetry?: SessionTelemetry;
	redactionApplied?: RedactionConfig;  // NOVO em Phase 6 — opcional
}
```

### Step 1.2: Criar `defaults.ts`

`app/src/lib/session/privacy/defaults.ts`:

```ts
import type { RedactionConfig } from '../types';

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
	enabled: true,
	headerKeys: [
		'authorization',
		'cookie',
		'set-cookie',
		'x-api-key',
		'x-auth-token',
		'proxy-authorization',
	],
	headerRegex: ['^x-.*-token$', '^x-.*-secret$'],
	bodyRegex: [
		// JWT eyJ... (3 segmentos base64url)
		'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
		// Card PAN (13–19 dígitos com possíveis separadores)
		'\\b(?:\\d[ -]?){13,19}\\b',
		// "password":"..." em JSON
		'"password"\\s*:\\s*"[^"]+"',
		// "secret":"..." em JSON
		'"(?:secret|token|api[_-]?key)"\\s*:\\s*"[^"]+"',
	],
	consoleEnabled: true,
	consoleRegex: [
		'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
		'\\b(?:\\d[ -]?){13,19}\\b',
		'(?:password|senha|token|secret|api[_-]?key)\\s*[:=]\\s*\\S+',
	],
	stateBlacklistPaths: [
		'auth.*.token',
		'auth.token',
		'user.password',
		'user.email',
		'session.cookie',
	],
	stateWhitelistPaths: [],
	rrwebMaskAllInputs: false,
	rrwebMaskTextSelector: '[autocomplete^="cc-"], [name*="card" i], [name*="cvv" i], [name*="password" i], .dbb-mask, [data-dbb-mask]',
	urlBlacklist: [],
	truncateUserPaths: true,
	autoPurgeEnabled: false,
	autoPurgeRetentionDays: 30,
};

export const REDACTION_PLACEHOLDER = '[REDACTED]';
```

### Step 1.3: Test

`app/src/lib/session/privacy/__tests__/defaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG, REDACTION_PLACEHOLDER } from '../defaults';

describe('DEFAULT_REDACTION_CONFIG', () => {
	it('habilitado por default', () => {
		expect(DEFAULT_REDACTION_CONFIG.enabled).toBe(true);
	});

	it('cobre headers de auth comuns', () => {
		expect(DEFAULT_REDACTION_CONFIG.headerKeys).toEqual(
			expect.arrayContaining(['authorization', 'cookie', 'set-cookie']),
		);
	});

	it('rrweb default não mascara todos os inputs (apenas password e cc-*)', () => {
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskAllInputs).toBe(false);
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskTextSelector).toContain('cc-');
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskTextSelector).toContain('password');
		expect(DEFAULT_REDACTION_CONFIG.rrwebMaskTextSelector).toContain('dbb-mask');
	});

	it('auto-purge desligado por default', () => {
		expect(DEFAULT_REDACTION_CONFIG.autoPurgeEnabled).toBe(false);
		expect(DEFAULT_REDACTION_CONFIG.autoPurgeRetentionDays).toBe(30);
	});

	it('regex defaults compilam (não lançam SyntaxError)', () => {
		for (const r of [
			...DEFAULT_REDACTION_CONFIG.headerRegex,
			...DEFAULT_REDACTION_CONFIG.bodyRegex,
			...DEFAULT_REDACTION_CONFIG.consoleRegex,
		]) {
			expect(() => new RegExp(r)).not.toThrow();
		}
	});

	it('placeholder é "[REDACTED]"', () => {
		expect(REDACTION_PLACEHOLDER).toBe('[REDACTED]');
	});
});
```

### Step 1.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/defaults.test.ts
git add app/src/lib/session/types.ts app/src/lib/session/privacy/defaults.ts app/src/lib/session/privacy/__tests__/defaults.test.ts
git commit -m "feat(session): tipos RedactionConfig + redactionApplied + defaults agressivos"
```

---

## Task 2: `headerRedactor`

**Files:**
- Create: `app/src/lib/session/privacy/headerRedactor.ts`
- Test: `app/src/lib/session/privacy/__tests__/headerRedactor.test.ts`

### Step 2.1: Implementar

`app/src/lib/session/privacy/headerRedactor.ts`:

```ts
import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

export interface HeaderMap {
	[name: string]: string;
}

function compileRegexList(list: string[]): RegExp[] {
	// Lança RegExp.SyntaxError em regex inválida — sem fallback silencioso (regra do projeto).
	return list.map((r) => new RegExp(r, 'i'));
}

/**
 * Redige um mapa de headers conforme a config.
 * - Match em headerKeys é case-insensitive (HTTP headers são case-insensitive).
 * - Match em headerRegex é case-insensitive.
 * Headers redigidos têm valor substituído por '[REDACTED]'; nome preservado para auditoria.
 */
export function redactHeaders(headers: HeaderMap, config: RedactionConfig): HeaderMap {
	if (!config.enabled) return headers;

	const keySet = new Set(config.headerKeys.map((k) => k.toLowerCase()));
	const regexes = compileRegexList(config.headerRegex);
	const out: HeaderMap = {};

	for (const [name, value] of Object.entries(headers)) {
		const lower = name.toLowerCase();
		const matchKey = keySet.has(lower);
		const matchRegex = regexes.some((r) => r.test(lower));
		out[name] = matchKey || matchRegex ? REDACTION_PLACEHOLDER : value;
	}

	return out;
}
```

### Step 2.2: Test

`app/src/lib/session/privacy/__tests__/headerRedactor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { redactHeaders } from '../headerRedactor';

describe('redactHeaders', () => {
	it('redige headers default (authorization, cookie, set-cookie, x-api-key)', () => {
		const out = redactHeaders(
			{
				Authorization: 'Bearer xyz',
				Cookie: 'sid=abc',
				'Set-Cookie': 'sid=abc; HttpOnly',
				'X-API-Key': 'secret',
				'Content-Type': 'application/json',
			},
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out.Authorization).toBe('[REDACTED]');
		expect(out.Cookie).toBe('[REDACTED]');
		expect(out['Set-Cookie']).toBe('[REDACTED]');
		expect(out['X-API-Key']).toBe('[REDACTED]');
		expect(out['Content-Type']).toBe('application/json');
	});

	it('match é case-insensitive', () => {
		const out = redactHeaders(
			{ AUTHORIZATION: 'x', authorization: 'y' },
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out.AUTHORIZATION).toBe('[REDACTED]');
		expect(out.authorization).toBe('[REDACTED]');
	});

	it('regex match: x-trace-token redigido', () => {
		const out = redactHeaders(
			{ 'X-Trace-Token': 'abc', 'X-Request-Id': 'keep' },
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out['X-Trace-Token']).toBe('[REDACTED]');
		expect(out['X-Request-Id']).toBe('keep');
	});

	it('respeita enabled=false (passthrough)', () => {
		const headers = { Authorization: 'Bearer xyz' };
		const out = redactHeaders(headers, { ...DEFAULT_REDACTION_CONFIG, enabled: false });
		expect(out.Authorization).toBe('Bearer xyz');
	});

	it('lança SyntaxError em regex inválida (no-fallback)', () => {
		expect(() =>
			redactHeaders({ a: 'b' }, { ...DEFAULT_REDACTION_CONFIG, headerRegex: ['(invalid'] }),
		).toThrow(SyntaxError);
	});
});
```

### Step 2.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/headerRedactor.test.ts
git add app/src/lib/session/privacy/headerRedactor.ts app/src/lib/session/privacy/__tests__/headerRedactor.test.ts
git commit -m "feat(session): headerRedactor com keyList + regex (no fallback em regex inválida)"
```

---

## Task 3: `bodyRedactor`

**Files:**
- Create: `app/src/lib/session/privacy/bodyRedactor.ts`
- Test: `app/src/lib/session/privacy/__tests__/bodyRedactor.test.ts`

### Step 3.1: Implementar

`app/src/lib/session/privacy/bodyRedactor.ts`:

```ts
import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

function compileRegexList(list: string[]): RegExp[] {
	// Flag g obrigatório para varredura (replaceAll).
	return list.map((r) => new RegExp(r, 'g'));
}

/**
 * Aplica a lista de regex de body em uma string.
 * Cada match é substituído por REDACTION_PLACEHOLDER.
 * Para conteúdo binário/non-string, o caller decide se chama ou não.
 */
export function redactBody(text: string, config: RedactionConfig): string {
	if (!config.enabled) return text;
	const regexes = compileRegexList(config.bodyRegex);
	let out = text;
	for (const r of regexes) {
		out = out.replace(r, REDACTION_PLACEHOLDER);
	}
	return out;
}
```

### Step 3.2: Test

`app/src/lib/session/privacy/__tests__/bodyRedactor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { redactBody } from '../bodyRedactor';

describe('redactBody', () => {
	it('redige JWT', () => {
		const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
		const out = redactBody(`token=${jwt}&user=foo`, DEFAULT_REDACTION_CONFIG);
		expect(out).toContain('[REDACTED]');
		expect(out).not.toContain(jwt);
		expect(out).toContain('user=foo');
	});

	it('redige card PAN', () => {
		const out = redactBody('pan=4111 1111 1111 1111', DEFAULT_REDACTION_CONFIG);
		expect(out).toContain('[REDACTED]');
		expect(out).not.toMatch(/4111 1111/);
	});

	it('redige "password":"..." em JSON', () => {
		const out = redactBody(
			'{"username":"alice","password":"hunter2","keep":"yes"}',
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out).toContain('[REDACTED]');
		expect(out).toContain('alice');
		expect(out).toContain('keep');
		expect(out).not.toContain('hunter2');
	});

	it('redige múltiplas ocorrências (flag g)', () => {
		const jwt = 'eyJabc.eyJdef.signed1234567890_abcdefghij';
		const text = `${jwt} pediu, ${jwt} retornou`;
		const out = redactBody(text, {
			...DEFAULT_REDACTION_CONFIG,
			bodyRegex: ['eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]{10,}'],
		});
		expect(out.match(/\[REDACTED\]/g)?.length).toBe(2);
	});

	it('respeita enabled=false', () => {
		const text = '{"password":"hunter2"}';
		const out = redactBody(text, { ...DEFAULT_REDACTION_CONFIG, enabled: false });
		expect(out).toBe(text);
	});

	it('lança SyntaxError em regex inválida', () => {
		expect(() =>
			redactBody('foo', { ...DEFAULT_REDACTION_CONFIG, bodyRegex: ['(broken'] }),
		).toThrow(SyntaxError);
	});
});
```

### Step 3.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/bodyRedactor.test.ts
git add app/src/lib/session/privacy/bodyRedactor.ts app/src/lib/session/privacy/__tests__/bodyRedactor.test.ts
git commit -m "feat(session): bodyRedactor com regex de varredura sobre strings"
```

---

## Task 4: `consoleRedactor`

**Files:**
- Create: `app/src/lib/session/privacy/consoleRedactor.ts`
- Test: `app/src/lib/session/privacy/__tests__/consoleRedactor.test.ts`

### Step 4.1: Implementar

`app/src/lib/session/privacy/consoleRedactor.ts`:

```ts
import type { ConsoleArgPreview, RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

function compileRegexList(list: string[]): RegExp[] {
	return list.map((r) => new RegExp(r, 'g'));
}

/**
 * Sanitiza um array de ConsoleArgPreview substituindo matches em `description`
 * (e em `preview.properties[].value`, se presente) por REDACTION_PLACEHOLDER.
 */
export function redactConsoleArgs(
	args: ConsoleArgPreview[],
	config: RedactionConfig,
): ConsoleArgPreview[] {
	if (!config.enabled || !config.consoleEnabled) return args;
	const regexes = compileRegexList(config.consoleRegex);

	const sweep = (s: string): string => {
		let out = s;
		for (const r of regexes) out = out.replace(r, REDACTION_PLACEHOLDER);
		return out;
	};

	return args.map((arg) => ({
		...arg,
		description: sweep(arg.description),
		preview: arg.preview
			? {
					...arg.preview,
					properties: arg.preview.properties.map((p) => ({
						...p,
						value: p.value === undefined ? undefined : sweep(p.value),
					})),
				}
			: undefined,
	}));
}
```

### Step 4.2: Test

`app/src/lib/session/privacy/__tests__/consoleRedactor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ConsoleArgPreview } from '../../types';
import { redactConsoleArgs } from '../consoleRedactor';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';

describe('redactConsoleArgs', () => {
	const arg = (description: string): ConsoleArgPreview => ({
		type: 'string',
		description,
	});

	it('redige "password: hunter2" em description', () => {
		const out = redactConsoleArgs([arg('password: hunter2'), arg('safe')], DEFAULT_REDACTION_CONFIG);
		expect(out[0].description).toContain('[REDACTED]');
		expect(out[0].description).not.toContain('hunter2');
		expect(out[1].description).toBe('safe');
	});

	it('redige JWT em description', () => {
		const jwt = 'eyJabcdefghij.eyJklmnopqrst.signed1234567890';
		const out = redactConsoleArgs([arg(`bearer ${jwt}`)], DEFAULT_REDACTION_CONFIG);
		expect(out[0].description).toContain('[REDACTED]');
		expect(out[0].description).not.toContain(jwt);
	});

	it('redige preview.properties[].value', () => {
		const out = redactConsoleArgs(
			[
				{
					type: 'object',
					description: 'Object',
					preview: {
						properties: [
							{ name: 'pwd', type: 'string', value: 'password: hunter2' },
							{ name: 'name', type: 'string', value: 'alice' },
						],
						overflow: false,
					},
				},
			],
			DEFAULT_REDACTION_CONFIG,
		);
		expect(out[0].preview?.properties[0].value).toContain('[REDACTED]');
		expect(out[0].preview?.properties[1].value).toBe('alice');
	});

	it('respeita consoleEnabled=false (não redige nada)', () => {
		const out = redactConsoleArgs([arg('password: hunter2')], {
			...DEFAULT_REDACTION_CONFIG,
			consoleEnabled: false,
		});
		expect(out[0].description).toBe('password: hunter2');
	});

	it('lança em regex inválida', () => {
		expect(() =>
			redactConsoleArgs([arg('x')], { ...DEFAULT_REDACTION_CONFIG, consoleRegex: ['(broken'] }),
		).toThrow(SyntaxError);
	});
});
```

### Step 4.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/consoleRedactor.test.ts
git add app/src/lib/session/privacy/consoleRedactor.ts app/src/lib/session/privacy/__tests__/consoleRedactor.test.ts
git commit -m "feat(session): consoleRedactor sanitiza description + preview.properties.value"
```

---

## Task 5: `stateRedactor`

**Files:**
- Create: `app/src/lib/session/privacy/stateRedactor.ts`
- Test: `app/src/lib/session/privacy/__tests__/stateRedactor.test.ts`

### Step 5.1: Implementar

`app/src/lib/session/privacy/stateRedactor.ts`:

```ts
import type { RedactionConfig } from '../types';
import { REDACTION_PLACEHOLDER } from './defaults';

/**
 * Converte um glob simples ('auth.*.token') em regex que casa com paths JSON.
 * '*' = qualquer segmento; '**' = qualquer profundidade.
 */
function globToRegex(glob: string): RegExp {
	const escaped = glob
		.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
		.replace(/\\\*\\\*/g, '.+')
		.replace(/\\\*/g, '[^.]+');
	return new RegExp(`^${escaped}$`);
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Walka um snapshot de state e aplica:
 * - whitelist (se preenchida): apenas paths que casam ficam preservados; resto vira REDACTED.
 * - blacklist: paths que casam viram REDACTED.
 * Whitelist tem precedência: se preenchida, blacklist é ignorada (evita ambiguidade).
 */
export function redactState(snapshot: unknown, config: RedactionConfig): unknown {
	if (!config.enabled) return snapshot;

	const useWhitelist = config.stateWhitelistPaths.length > 0;
	const whitelist = config.stateWhitelistPaths.map(globToRegex);
	const blacklist = config.stateBlacklistPaths.map(globToRegex);

	const matches = (path: string, list: RegExp[]) => list.some((r) => r.test(path));

	const walk = (value: unknown, path: string): unknown => {
		if (useWhitelist) {
			// Preserva apenas paths whitelisted. Em containers, recursivamente walka filhos.
			if (matches(path, whitelist)) return value; // path inteiro liberado
		} else if (matches(path, blacklist)) {
			return REDACTION_PLACEHOLDER;
		}

		if (Array.isArray(value)) {
			return value.map((item, i) => walk(item, `${path}.${i}`));
		}
		if (isObject(value)) {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(value)) {
				const childPath = path ? `${path}.${k}` : k;
				out[k] = walk(v, childPath);
			}
			return out;
		}
		// Primitivo
		if (useWhitelist && !matches(path, whitelist)) {
			// Folha não whitelisted some
			return REDACTION_PLACEHOLDER;
		}
		return value;
	};

	return walk(snapshot, '');
}
```

### Step 5.2: Test

`app/src/lib/session/privacy/__tests__/stateRedactor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { redactState } from '../stateRedactor';

describe('redactState — blacklist', () => {
	it('redige path exato auth.token', () => {
		const out = redactState(
			{ auth: { token: 'secret', user: 'alice' }, app: 'ok' },
			{ ...DEFAULT_REDACTION_CONFIG, stateBlacklistPaths: ['auth.token'] },
		) as Record<string, Record<string, string>>;
		expect(out.auth.token).toBe('[REDACTED]');
		expect(out.auth.user).toBe('alice');
		expect(out.app).toBe('ok');
	});

	it('redige glob auth.*.token (qualquer key intermediária)', () => {
		const out = redactState(
			{ auth: { google: { token: 's1' }, github: { token: 's2', user: 'u' } } },
			{ ...DEFAULT_REDACTION_CONFIG, stateBlacklistPaths: ['auth.*.token'] },
		) as Record<string, Record<string, Record<string, string>>>;
		expect(out.auth.google.token).toBe('[REDACTED]');
		expect(out.auth.github.token).toBe('[REDACTED]');
		expect(out.auth.github.user).toBe('u');
	});

	it('redige user.password com defaults', () => {
		const out = redactState(
			{ user: { name: 'alice', password: 'hunter2' } },
			DEFAULT_REDACTION_CONFIG,
		) as Record<string, Record<string, string>>;
		expect(out.user.password).toBe('[REDACTED]');
		expect(out.user.name).toBe('alice');
	});
});

describe('redactState — whitelist', () => {
	it('whitelist preserva só paths listados; resto vira REDACTED', () => {
		const out = redactState(
			{ a: 1, b: 2, c: { d: 3, e: 4 } },
			{
				...DEFAULT_REDACTION_CONFIG,
				stateBlacklistPaths: [],
				stateWhitelistPaths: ['a', 'c.d'],
			},
		) as Record<string, unknown>;
		expect(out.a).toBe(1);
		expect(out.b).toBe('[REDACTED]');
		expect((out.c as Record<string, unknown>).d).toBe(3);
		expect((out.c as Record<string, unknown>).e).toBe('[REDACTED]');
	});
});

describe('redactState — passthrough', () => {
	it('enabled=false retorna snapshot inalterado', () => {
		const snap = { auth: { token: 'secret' } };
		expect(redactState(snap, { ...DEFAULT_REDACTION_CONFIG, enabled: false })).toEqual(snap);
	});

	it('arrays preservam shape mas filhos são walkados', () => {
		const out = redactState(
			{ items: [{ pwd: 'x' }, { pwd: 'y' }] },
			{ ...DEFAULT_REDACTION_CONFIG, stateBlacklistPaths: ['items.*.pwd'] },
		) as { items: Array<{ pwd: string }> };
		expect(out.items[0].pwd).toBe('[REDACTED]');
		expect(out.items[1].pwd).toBe('[REDACTED]');
	});
});
```

### Step 5.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/stateRedactor.test.ts
git add app/src/lib/session/privacy/stateRedactor.ts app/src/lib/session/privacy/__tests__/stateRedactor.test.ts
git commit -m "feat(session): stateRedactor com whitelist/blacklist via glob de paths"
```

---

## Task 6: `pathTruncator`

**Files:**
- Create: `app/src/lib/session/privacy/pathTruncator.ts`
- Test: `app/src/lib/session/privacy/__tests__/pathTruncator.test.ts`

### Step 6.1: Implementar

`app/src/lib/session/privacy/pathTruncator.ts`:

```ts
import type { RedactionConfig } from '../types';

const PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
	{ regex: /\/Users\/[^/]+\//g, replacement: '/Users/<user>/' },
	{ regex: /\/home\/[^/]+\//g, replacement: '/home/<user>/' },
	{ regex: /C:\\Users\\[^\\]+\\/g, replacement: 'C:\\Users\\<user>\\' },
	{ regex: /\/home\/runner\/work\//g, replacement: '/home/runner/work/' }, // CI — não trunca user mas mantém previsível
];

/**
 * Trunca caminhos absolutos com nome de usuário em URLs / file paths.
 * Idempotente: aplicar duas vezes é seguro.
 */
export function truncateUserPath(path: string, config: RedactionConfig): string {
	if (!config.enabled || !config.truncateUserPaths) return path;
	let out = path;
	for (const { regex, replacement } of PATTERNS) {
		out = out.replace(regex, replacement);
	}
	return out;
}
```

### Step 6.2: Test

`app/src/lib/session/privacy/__tests__/pathTruncator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { truncateUserPath } from '../pathTruncator';

describe('truncateUserPath', () => {
	it('trunca /Users/<u>/...', () => {
		expect(
			truncateUserPath('/Users/alice/projects/foo/src/App.tsx', DEFAULT_REDACTION_CONFIG),
		).toBe('/Users/<user>/projects/foo/src/App.tsx');
	});

	it('trunca /home/<u>/...', () => {
		expect(truncateUserPath('/home/bob/code/foo', DEFAULT_REDACTION_CONFIG)).toBe(
			'/home/<user>/code/foo',
		);
	});

	it('trunca C:\\Users\\<u>\\...', () => {
		expect(
			truncateUserPath('C:\\Users\\carol\\Documents\\app.ts', DEFAULT_REDACTION_CONFIG),
		).toBe('C:\\Users\\<user>\\Documents\\app.ts');
	});

	it('é idempotente', () => {
		const once = truncateUserPath('/Users/alice/foo.js', DEFAULT_REDACTION_CONFIG);
		const twice = truncateUserPath(once, DEFAULT_REDACTION_CONFIG);
		expect(twice).toBe(once);
	});

	it('respeita truncateUserPaths=false', () => {
		const path = '/Users/alice/foo.js';
		expect(truncateUserPath(path, { ...DEFAULT_REDACTION_CONFIG, truncateUserPaths: false })).toBe(
			path,
		);
	});

	it('preserva paths sem usuário', () => {
		expect(truncateUserPath('/var/log/app.log', DEFAULT_REDACTION_CONFIG)).toBe(
			'/var/log/app.log',
		);
	});
});
```

### Step 6.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/pathTruncator.test.ts
git add app/src/lib/session/privacy/pathTruncator.ts app/src/lib/session/privacy/__tests__/pathTruncator.test.ts
git commit -m "feat(session): pathTruncator para /Users/, /home/, C:\\Users\\"
```

---

## Task 7: `urlGate`

**Files:**
- Create: `app/src/lib/session/privacy/urlGate.ts`
- Test: `app/src/lib/session/privacy/__tests__/urlGate.test.ts`

### Step 7.1: Implementar

`app/src/lib/session/privacy/urlGate.ts`:

```ts
import type { RedactionConfig } from '../types';

function globToHostnameRegex(glob: string): RegExp {
	// '*.banco.com.br' → /^(?:[^.]+\.)*banco\.com\.br$/i
	const escaped = glob
		.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
		.replace(/\\\*/g, '[^.]+');
	return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Retorna true se a URL deve ser ignorada por ALL os caminhos de captura
 * (network, console emitido na origin, rrweb se navegar pra ela).
 * Match em hostname (domínio), não em path.
 */
export function shouldIgnoreUrl(rawUrl: string, config: RedactionConfig): boolean {
	if (!config.enabled || config.urlBlacklist.length === 0) return false;
	let hostname: string;
	try {
		hostname = new URL(rawUrl).hostname;
	} catch {
		// URL inválida não é ignorada (cabe ao caller decidir o que fazer com ela).
		return false;
	}
	const regexes = config.urlBlacklist.map(globToHostnameRegex);
	return regexes.some((r) => r.test(hostname));
}
```

### Step 7.2: Test

`app/src/lib/session/privacy/__tests__/urlGate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import { shouldIgnoreUrl } from '../urlGate';

describe('shouldIgnoreUrl', () => {
	it('default não ignora nada', () => {
		expect(shouldIgnoreUrl('https://example.com/foo', DEFAULT_REDACTION_CONFIG)).toBe(false);
	});

	it('match exato em domínio', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['banco.com.br'] };
		expect(shouldIgnoreUrl('https://banco.com.br/login', cfg)).toBe(true);
		expect(shouldIgnoreUrl('https://api.banco.com.br/x', cfg)).toBe(false); // exato, sem wildcard
	});

	it('wildcard em subdomínio', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['*.banco.com.br'] };
		expect(shouldIgnoreUrl('https://api.banco.com.br/x', cfg)).toBe(true);
		expect(shouldIgnoreUrl('https://app.dev.banco.com.br/x', cfg)).toBe(false); // só 1 nível
	});

	it('múltiplos blacklist entries', () => {
		const cfg = {
			...DEFAULT_REDACTION_CONFIG,
			urlBlacklist: ['banco.com.br', 'cards.example.com'],
		};
		expect(shouldIgnoreUrl('https://banco.com.br/', cfg)).toBe(true);
		expect(shouldIgnoreUrl('https://cards.example.com/', cfg)).toBe(true);
		expect(shouldIgnoreUrl('https://safe.com/', cfg)).toBe(false);
	});

	it('URL inválida retorna false (caller decide)', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['x.com'] };
		expect(shouldIgnoreUrl('not-a-url', cfg)).toBe(false);
	});

	it('respeita enabled=false', () => {
		const cfg = { ...DEFAULT_REDACTION_CONFIG, enabled: false, urlBlacklist: ['banco.com.br'] };
		expect(shouldIgnoreUrl('https://banco.com.br/', cfg)).toBe(false);
	});
});
```

### Step 7.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/urlGate.test.ts
git add app/src/lib/session/privacy/urlGate.ts app/src/lib/session/privacy/__tests__/urlGate.test.ts
git commit -m "feat(session): urlGate para descartar URLs em domains banidos"
```

---

## Task 8: `config.ts` (load/save em chrome.storage) + `autoPurge`

**Files:**
- Create: `app/src/lib/session/privacy/config.ts`
- Create: `app/src/lib/session/privacy/autoPurge.ts`
- Test: `app/src/lib/session/privacy/__tests__/config.test.ts`
- Test: `app/src/lib/session/privacy/__tests__/autoPurge.test.ts`
- Modify: `app/src/types/messages.ts`

### Step 8.1: Implementar `config.ts`

`app/src/lib/session/privacy/config.ts`:

```ts
import type { RedactionConfig } from '../types';
import { DEFAULT_REDACTION_CONFIG } from './defaults';

const STORAGE_KEY = 'privacyConfig';

function validateRegexList(label: string, list: string[]): void {
	for (const r of list) {
		// Lança SyntaxError se inválida — sem fallback (regra do projeto).
		new RegExp(r);
	}
	void label;
}

/**
 * Valida config inteira; lança em qualquer regex inválida.
 * Caller (UI / setPrivacyConfig handler) deve tratar e mostrar ao usuário.
 */
export function validateRedactionConfig(config: RedactionConfig): void {
	validateRegexList('headerRegex', config.headerRegex);
	validateRegexList('bodyRegex', config.bodyRegex);
	validateRegexList('consoleRegex', config.consoleRegex);
	if (config.autoPurgeRetentionDays < 1 || !Number.isFinite(config.autoPurgeRetentionDays)) {
		throw new RangeError('autoPurgeRetentionDays deve ser >= 1');
	}
}

export async function getPrivacyConfig(): Promise<RedactionConfig> {
	const stored = await chrome.storage.local.get(STORAGE_KEY);
	const raw = stored[STORAGE_KEY] as Partial<RedactionConfig> | undefined;
	if (!raw) return DEFAULT_REDACTION_CONFIG;
	// Merge raso com defaults: campos novos adicionados em uma versão futura
	// caem nos defaults atuais, mas regex/listas existentes do usuário são preservados.
	const merged: RedactionConfig = { ...DEFAULT_REDACTION_CONFIG, ...raw };
	return merged;
}

export async function setPrivacyConfig(config: RedactionConfig): Promise<void> {
	validateRedactionConfig(config);
	await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

/**
 * Subset sanitizado para gravar em Session.redactionApplied.
 * NÃO inclui regex específicas do usuário (podem revelar pattern interno).
 * Inclui apenas as listas/flags que indicam "o quê foi mascarado".
 */
export function toRedactionApplied(config: RedactionConfig): RedactionConfig {
	return {
		...config,
		// Substitui regex por placeholders que dizem "quantas regras foram aplicadas".
		headerRegex: config.headerRegex.length > 0 ? [`<${config.headerRegex.length} regex(es)>`] : [],
		bodyRegex: config.bodyRegex.length > 0 ? [`<${config.bodyRegex.length} regex(es)>`] : [],
		consoleRegex:
			config.consoleRegex.length > 0 ? [`<${config.consoleRegex.length} regex(es)>`] : [],
	};
}
```

### Step 8.2: Implementar `autoPurge.ts`

`app/src/lib/session/privacy/autoPurge.ts`:

```ts
import { sessionStore } from '../storage';

/**
 * Deleta sessões cujo endedAt seja anterior a (now - retentionDays).
 * Sessões em gravação (endedAt=null) nunca são deletadas.
 * Retorna o número de sessões deletadas.
 */
export async function purgeOldSessions(retentionDays: number, now: number = Date.now()): Promise<number> {
	if (retentionDays < 1 || !Number.isFinite(retentionDays)) {
		throw new RangeError('retentionDays deve ser >= 1');
	}
	const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
	const sessions = await sessionStore.list();
	let deleted = 0;
	for (const s of sessions) {
		if (s.endedAt !== null && s.endedAt < cutoff) {
			await sessionStore.delete(s.id);
			deleted++;
		}
	}
	return deleted;
}
```

### Step 8.3: Estender `messages.ts`

Em `app/src/types/messages.ts`, adicionar à união:

```ts
| { action: 'getPrivacyConfig' }
| { action: 'setPrivacyConfig'; config: RedactionConfig }
| { action: 'purgeOldSessions' }
```

E adicionar em `MessageResponse` o campo opcional `privacyConfig?: RedactionConfig` e `purgedCount?: number`.

### Step 8.4: Tests

`app/src/lib/session/privacy/__tests__/config.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '../defaults';
import {
	getPrivacyConfig,
	setPrivacyConfig,
	toRedactionApplied,
	validateRedactionConfig,
} from '../config';

describe('validateRedactionConfig', () => {
	it('aceita config default', () => {
		expect(() => validateRedactionConfig(DEFAULT_REDACTION_CONFIG)).not.toThrow();
	});

	it('lança em headerRegex inválido', () => {
		expect(() =>
			validateRedactionConfig({ ...DEFAULT_REDACTION_CONFIG, headerRegex: ['(broken'] }),
		).toThrow(SyntaxError);
	});

	it('lança em retentionDays < 1', () => {
		expect(() =>
			validateRedactionConfig({ ...DEFAULT_REDACTION_CONFIG, autoPurgeRetentionDays: 0 }),
		).toThrow(RangeError);
	});
});

describe('getPrivacyConfig / setPrivacyConfig', () => {
	beforeEach(() => {
		const store = new Map<string, unknown>();
		(globalThis as unknown as { chrome: typeof chrome }).chrome = {
			...(globalThis as unknown as { chrome: typeof chrome }).chrome,
			storage: {
				...(globalThis as unknown as { chrome: typeof chrome }).chrome.storage,
				local: {
					get: vi.fn(async (keys: string | string[]) => {
						const keyArr = Array.isArray(keys) ? keys : [keys];
						const result: Record<string, unknown> = {};
						for (const k of keyArr) {
							if (store.has(k)) result[k] = store.get(k);
						}
						return result;
					}),
					set: vi.fn(async (kv: Record<string, unknown>) => {
						for (const [k, v] of Object.entries(kv)) store.set(k, v);
					}),
				} as unknown as typeof chrome.storage.local,
			} as typeof chrome.storage,
		};
	});

	it('retorna defaults quando storage vazio', async () => {
		const cfg = await getPrivacyConfig();
		expect(cfg.enabled).toBe(true);
		expect(cfg.headerKeys).toContain('authorization');
	});

	it('round-trips uma config válida', async () => {
		const custom = { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['banco.com.br'] };
		await setPrivacyConfig(custom);
		const cfg = await getPrivacyConfig();
		expect(cfg.urlBlacklist).toEqual(['banco.com.br']);
	});

	it('rejeita set com regex inválida', async () => {
		await expect(
			setPrivacyConfig({ ...DEFAULT_REDACTION_CONFIG, bodyRegex: ['(unbalanced'] }),
		).rejects.toThrow(SyntaxError);
	});
});

describe('toRedactionApplied', () => {
	it('redacted regex contagem ao invés de pattern', () => {
		const applied = toRedactionApplied(DEFAULT_REDACTION_CONFIG);
		expect(applied.headerRegex.length).toBeGreaterThan(0);
		expect(applied.headerRegex[0]).toMatch(/^<\d+ regex/);
		expect(applied.bodyRegex[0]).toMatch(/^<\d+ regex/);
		// keys são preservadas (não-sensíveis)
		expect(applied.headerKeys).toEqual(DEFAULT_REDACTION_CONFIG.headerKeys);
	});
});
```

`app/src/lib/session/privacy/__tests__/autoPurge.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetForTests, sessionStore } from '../../storage';
import type { Session } from '../../types';
import { purgeOldSessions } from '../autoPurge';

const session = (id: string, endedAt: number | null): Session => ({
	id,
	schemaVersion: 1,
	startedAt: endedAt ?? Date.now(),
	endedAt,
	origin: 'recorded',
	tabId: 1,
	metadata: { initialUrl: 'http://e/', userAgent: '', viewportSize: { w: 1, h: 1 }, canvasCaptureEnabled: false },
	detectionPhases: [],
	events: [],
});

describe('purgeOldSessions', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
	});

	afterEach(async () => {
		await sessionStore.clear();
		_resetForTests();
	});

	it('deleta sessões antigas (endedAt < cutoff)', async () => {
		const now = 1_000_000_000_000;
		const oneDayMs = 24 * 60 * 60 * 1000;
		await sessionStore.put(session('old', now - 60 * oneDayMs));
		await sessionStore.put(session('mid', now - 5 * oneDayMs));
		await sessionStore.put(session('new', now - 1 * oneDayMs));

		const deleted = await purgeOldSessions(30, now);
		expect(deleted).toBe(1);

		const remaining = (await sessionStore.list()).map((s) => s.id).sort();
		expect(remaining).toEqual(['mid', 'new']);
	});

	it('preserva sessões em gravação (endedAt=null)', async () => {
		const now = 1_000_000_000_000;
		await sessionStore.put(session('active', null));
		const deleted = await purgeOldSessions(1, now);
		expect(deleted).toBe(0);
		expect(await sessionStore.get('active')).not.toBeNull();
	});

	it('lança em retentionDays inválido', async () => {
		await expect(purgeOldSessions(0)).rejects.toThrow(RangeError);
		await expect(purgeOldSessions(Number.NaN)).rejects.toThrow(RangeError);
	});
});
```

### Step 8.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/privacy/__tests__/config.test.ts src/lib/session/privacy/__tests__/autoPurge.test.ts
git add app/src/lib/session/privacy/config.ts app/src/lib/session/privacy/autoPurge.ts app/src/lib/session/privacy/__tests__/config.test.ts app/src/lib/session/privacy/__tests__/autoPurge.test.ts app/src/types/messages.ts
git commit -m "feat(session): privacyConfig persistido em chrome.storage + autoPurge job"
```

---

## Task 9: Integração no background

**Files:**
- Modify: `app/src/entrypoints/background.ts`
- Test: `app/src/lib/session/__tests__/recorder.privacy.test.ts`

### Step 9.1: Aplicar redaction no momento da captura

Em `app/src/entrypoints/background.ts`:

```ts
import { getPrivacyConfig } from '@/lib/session/privacy/config';
import { redactHeaders } from '@/lib/session/privacy/headerRedactor';
import { redactBody } from '@/lib/session/privacy/bodyRedactor';
import { redactConsoleArgs } from '@/lib/session/privacy/consoleRedactor';
import { redactState } from '@/lib/session/privacy/stateRedactor';
import { truncateUserPath } from '@/lib/session/privacy/pathTruncator';
import { shouldIgnoreUrl } from '@/lib/session/privacy/urlGate';
import { purgeOldSessions } from '@/lib/session/privacy/autoPurge';
```

**Cache da config viva no background:**

```ts
let livePrivacyConfig: RedactionConfig | null = null;

async function reloadPrivacyConfig(): Promise<RedactionConfig> {
	livePrivacyConfig = await getPrivacyConfig();
	return livePrivacyConfig;
}

chrome.storage.onChanged.addListener((changes) => {
	if (changes.privacyConfig) {
		void reloadPrivacyConfig();
	}
});

// Boot
void reloadPrivacyConfig();
```

**Antes de QUALQUER captura, urlGate:**

```ts
function privacyOrThrow(): RedactionConfig {
	if (!livePrivacyConfig) {
		throw new Error('privacyConfig ainda não carregada');
	}
	return livePrivacyConfig;
}

function isUrlGated(url: string): boolean {
	return shouldIgnoreUrl(url, privacyOrThrow());
}
```

**Network capture (`handleRequestPaused`):**

```ts
// No início: gate
if (isUrlGated(params.request.url)) {
	void chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId: params.requestId });
	return;
}

// Antes de persistir o InterceptedResponse na sessão:
const cfg = privacyOrThrow();
const sanitized = {
	...response,
	headers: redactHeaders(response.headers, cfg),
	body: response.body !== undefined ? redactBody(response.body, cfg) : undefined,
	requestHeaders: response.requestHeaders ? redactHeaders(response.requestHeaders, cfg) : undefined,
	requestBody: response.requestBody !== undefined ? redactBody(response.requestBody, cfg) : undefined,
};
sessionRecorder.appendNetworkEvent({ ...sanitized });
```

**Console capture (`Runtime.consoleAPICalled`):**

```ts
const cfg = privacyOrThrow();
const safeArgs = redactConsoleArgs(consoleEvent.args, cfg);
const safeStack = consoleEvent.stackTrace
	? {
			frames: consoleEvent.stackTrace.frames.map((f) => ({
				...f,
				url: truncateUserPath(f.url, cfg),
			})),
		}
	: undefined;
sessionRecorder.appendConsoleEvent({ ...consoleEvent, args: safeArgs, stackTrace: safeStack });
```

**State capture (Phase 4/5 hook):**

```ts
const cfg = privacyOrThrow();
const safeSnapshot = redactState(rawSnapshot, cfg);
// Diff é calculado a partir do safeSnapshot.
const diff = computeStateDiff(prevSafeSnapshot, safeSnapshot);
```

**Source map / antipattern (Phase 3 source map resolver):**

```ts
const cfg = privacyOrThrow();
const resolvedSafe: ResolvedCallsite = {
	raw: { ...resolved.raw, file: truncateUserPath(resolved.raw.file, cfg) },
	resolved: resolved.resolved
		? { ...resolved.resolved, file: truncateUserPath(resolved.resolved.file, cfg) }
		: undefined,
};
```

**Auto-purge no startup:**

```ts
chrome.runtime.onStartup.addListener(async () => {
	const cfg = await getPrivacyConfig();
	if (cfg.autoPurgeEnabled) {
		const deleted = await purgeOldSessions(cfg.autoPurgeRetentionDays);
		console.log('[debug-buddy] auto-purge:', deleted, 'sessões deletadas');
	}
});

chrome.runtime.onInstalled.addListener(async () => {
	const cfg = await getPrivacyConfig();
	if (cfg.autoPurgeEnabled) {
		const deleted = await purgeOldSessions(cfg.autoPurgeRetentionDays);
		console.log('[debug-buddy] auto-purge:', deleted, 'sessões deletadas');
	}
});
```

**Handlers de privacy:**

```ts
if (message.action === 'getPrivacyConfig') {
	(async () => {
		try {
			const cfg = await getPrivacyConfig();
			sendResponse({ ok: true, privacyConfig: cfg });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}

if (message.action === 'setPrivacyConfig') {
	(async () => {
		try {
			await setPrivacyConfig(message.config);
			await reloadPrivacyConfig();
			sendResponse({ ok: true });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}

if (message.action === 'purgeOldSessions') {
	(async () => {
		try {
			const cfg = await getPrivacyConfig();
			const purgedCount = await purgeOldSessions(cfg.autoPurgeRetentionDays);
			sendResponse({ ok: true, purgedCount });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) });
		}
	})();
	return true;
}
```

### Step 9.2: Recorder preenche `redactionApplied` no stop

Em `app/src/lib/session/recorder.ts`, no `stopRecording`:

```ts
import { getPrivacyConfig, toRedactionApplied } from './privacy/config';

async stopRecording(): Promise<void> {
	// ... lógica existente
	const cfg = await getPrivacyConfig();
	this.session.redactionApplied = toRedactionApplied(cfg);
	this.session.endedAt = Date.now();
	await sessionStore.put(this.session);
}
```

### Step 9.3: Test integração end-to-end

`app/src/lib/session/__tests__/recorder.privacy.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetForTests, sessionStore } from '../storage';
import { DEFAULT_REDACTION_CONFIG } from '../privacy/defaults';
// O recorder deve aceitar um getter de privacyConfig (passar via construtor para testabilidade).
import { Recorder } from '../recorder';

describe('Recorder + privacy', () => {
	beforeEach(async () => {
		_resetForTests();
		await sessionStore.clear();
		// Mock chrome.storage.local
		const store = new Map<string, unknown>([['privacyConfig', DEFAULT_REDACTION_CONFIG]]);
		(globalThis as unknown as { chrome: typeof chrome }).chrome = {
			...(globalThis as unknown as { chrome: typeof chrome }).chrome,
			storage: {
				...(globalThis as unknown as { chrome: typeof chrome }).chrome.storage,
				local: {
					get: vi.fn(async (k: string) => ({ [k]: store.get(k) })),
					set: vi.fn(async (kv: Record<string, unknown>) => {
						for (const [k, v] of Object.entries(kv)) store.set(k, v);
					}),
				} as unknown as typeof chrome.storage.local,
			} as typeof chrome.storage,
		};
	});

	it('appendNetworkEvent redige Authorization', async () => {
		const rec = await Recorder.start({ tabId: 1, initialUrl: 'http://e/' });
		rec.appendNetworkEvent({
			type: 'network',
			timestamp: 1,
			phaseId: 'p1',
			requestId: 'r1',
			method: 'GET',
			url: 'http://e/api',
			status: 200,
			headers: { Authorization: 'Bearer xyz' },
			body: '{"password":"hunter2"}',
		});
		await rec.stop();
		const saved = await sessionStore.get(rec.sessionId);
		const ev = saved!.events.find((e) => e.type === 'network');
		expect((ev as unknown as { headers: Record<string, string> }).headers.Authorization).toBe(
			'[REDACTED]',
		);
		expect((ev as unknown as { body: string }).body).toContain('[REDACTED]');
		expect((ev as unknown as { body: string }).body).not.toContain('hunter2');
	});

	it('appendConsoleEvent redige description', async () => {
		const rec = await Recorder.start({ tabId: 1, initialUrl: 'http://e/' });
		rec.appendConsoleEvent({
			type: 'console',
			timestamp: 2,
			phaseId: 'p1',
			source: 'app',
			level: 'log',
			args: [{ type: 'string', description: 'password: hunter2' }],
		});
		await rec.stop();
		const saved = await sessionStore.get(rec.sessionId);
		const ev = saved!.events.find((e) => e.type === 'console');
		expect((ev as unknown as { args: Array<{ description: string }> }).args[0].description).toContain('[REDACTED]');
	});

	it('urlGate descarta evento de URL banida', async () => {
		await chrome.storage.local.set({
			privacyConfig: { ...DEFAULT_REDACTION_CONFIG, urlBlacklist: ['banco.com.br'] },
		});
		const rec = await Recorder.start({ tabId: 1, initialUrl: 'http://e/' });
		rec.appendNetworkEvent({
			type: 'network',
			timestamp: 3,
			phaseId: 'p1',
			requestId: 'r2',
			method: 'GET',
			url: 'https://banco.com.br/login',
			status: 200,
			headers: {},
		});
		await rec.stop();
		const saved = await sessionStore.get(rec.sessionId);
		const ev = saved!.events.find((e) => e.type === 'network');
		expect(ev).toBeUndefined();
	});

	it('preenche session.redactionApplied com subset sanitizado', async () => {
		const rec = await Recorder.start({ tabId: 1, initialUrl: 'http://e/' });
		await rec.stop();
		const saved = await sessionStore.get(rec.sessionId);
		expect(saved!.redactionApplied).toBeDefined();
		expect(saved!.redactionApplied!.headerKeys).toContain('authorization');
		// regex específicas NÃO devem vazar
		expect(saved!.redactionApplied!.headerRegex[0]).toMatch(/^<\d+ regex/);
	});
});
```

> Nota: `Recorder.appendNetworkEvent`/`appendConsoleEvent` precisam aceitar a config viva via construtor/método. Adapte a API existente do recorder pra receber `privacyConfig` como dependência (carregada uma vez no `start`, atualizada via `chrome.storage.onChanged` para `urlGate` em runtime).

### Step 9.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/lib/session/__tests__/recorder.privacy.test.ts
cd app && npm test 2>&1 | tail -8
git add app/src/entrypoints/background.ts app/src/lib/session/recorder.ts app/src/lib/session/__tests__/recorder.privacy.test.ts
git commit -m "feat(session): aplica redaction (header/body/console/state/path) no captura + auto-purge"
```

---

## Task 10: rrweb mascaramento

**Files:**
- Modify: `app/src/probe/main.ts` — `record({ maskTextSelector, maskInputOptions, maskInputFn })`.
- Modify: `app/src/probe/bridge.ts` — propagar config para o MAIN-world.
- Test: `app/src/probe/__tests__/rrwebMask.test.ts`

### Step 10.1: Configurar `record()` com mascaramento

Em `app/src/probe/main.ts`, onde `rrwebRecord(...)` é chamado, ler config via bridge antes:

```ts
import type { RedactionConfig } from '@/lib/session/types';

interface RrwebMaskOptions {
	maskTextSelector: string;
	maskAllInputs: boolean;
}

function startRrweb(opts: RrwebMaskOptions) {
	rrwebRecord({
		emit: (event) => bridgePost({ kind: 'rrweb', event }),
		maskTextSelector: opts.maskTextSelector,
		maskInputOptions: opts.maskAllInputs
			? { password: true, color: true, date: true, 'datetime-local': true, email: true, month: true, number: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true, textarea: true, select: true }
			: { password: true },
		maskInputFn: (text, element) => {
			// Mascara inputs com autocomplete cc-* mesmo se maskTextSelector já cobrir.
			const el = element as HTMLInputElement;
			const ac = el?.getAttribute?.('autocomplete') ?? '';
			if (ac.startsWith('cc-')) return '[REDACTED]';
			return text;
		},
	});
}
```

### Step 10.2: Propagar via bridge

`app/src/probe/bridge.ts` recebe `{ kind: 'init', privacyConfig: { rrwebMaskTextSelector, rrwebMaskAllInputs } }` no startup do content script (background lê config e injeta).

### Step 10.3: Test

`app/src/probe/__tests__/rrwebMask.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

// Apenas validação de "as opções passadas a rrwebRecord refletem a config"
// porque rrweb roda em ambiente browser real — em jsdom só validamos shape.
describe('rrweb mask options', () => {
	it('default não mascara todos os inputs', async () => {
		const recordSpy = vi.fn();
		vi.doMock('rrweb', () => ({ record: recordSpy }));
		const { startRrwebForTest } = await import('../main');
		startRrwebForTest({ maskTextSelector: '.dbb-mask', maskAllInputs: false });
		expect(recordSpy).toHaveBeenCalled();
		const opts = recordSpy.mock.calls[0][0];
		expect(opts.maskInputOptions.password).toBe(true);
		expect(opts.maskInputOptions.text).toBeFalsy();
		expect(opts.maskTextSelector).toBe('.dbb-mask');
	});

	it('maskAllInputs=true cobre todos os tipos', async () => {
		const recordSpy = vi.fn();
		vi.doMock('rrweb', () => ({ record: recordSpy }));
		const { startRrwebForTest } = await import('../main');
		startRrwebForTest({ maskTextSelector: '.x', maskAllInputs: true });
		const opts = recordSpy.mock.calls[0][0];
		expect(opts.maskInputOptions.password).toBe(true);
		expect(opts.maskInputOptions.text).toBe(true);
		expect(opts.maskInputOptions.email).toBe(true);
		expect(opts.maskInputOptions.textarea).toBe(true);
	});
});
```

> Nota: exportar `startRrwebForTest` em `main.ts` apenas em ambiente de test (re-export gated por `import.meta.env.MODE === 'test'`), ou refatorar para extrair `buildRrwebOptions(opts)` puro testável separadamente.

### Step 10.4: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/probe/__tests__/rrwebMask.test.ts
git add app/src/probe/main.ts app/src/probe/bridge.ts app/src/probe/__tests__/rrwebMask.test.ts
git commit -m "feat(session): rrweb mascara inputs sensíveis (password+cc-*) por default"
```

---

## Task 11: Página `/settings/privacy` + hook

**Files:**
- Create: `app/src/pages/PrivacySettingsPage.tsx`
- Create: `app/src/hooks/usePrivacyConfig.ts`
- Modify: `app/src/routes.tsx`
- Modify: `app/src/components/layout/NavMain.tsx` (ou correspondente)
- Test: `app/src/pages/__tests__/PrivacySettingsPage.test.tsx`

### Step 11.1: Hook

`app/src/hooks/usePrivacyConfig.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { RedactionConfig } from '@/lib/session/types';

export function usePrivacyConfig() {
	const [config, setConfig] = useState<RedactionConfig | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const res = await chrome.runtime.sendMessage({ action: 'getPrivacyConfig' });
		if (!res?.ok || !res.privacyConfig) {
			setError(`Falha ao carregar privacyConfig: ${res?.error ?? 'desconhecido'}`);
			return;
		}
		setConfig(res.privacyConfig);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const save = useCallback(async (next: RedactionConfig): Promise<void> => {
		const res = await chrome.runtime.sendMessage({
			action: 'setPrivacyConfig',
			config: next,
		});
		if (!res?.ok) {
			throw new Error(`Falha ao salvar: ${res?.error ?? 'desconhecido'}`);
		}
		setConfig(next);
	}, []);

	return { config, error, save, reload: load };
}
```

### Step 11.2: Página

`app/src/pages/PrivacySettingsPage.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePrivacyConfig } from '@/hooks/usePrivacyConfig';
import type { RedactionConfig } from '@/lib/session/types';

function ListEditor({
	label,
	value,
	onChange,
	help,
}: {
	label: string;
	value: string[];
	onChange: (next: string[]) => void;
	help?: string;
}) {
	const [text, setText] = useState(value.join('\n'));
	return (
		<div className="space-y-1">
			<Label>{label}</Label>
			{help && <p className="text-muted-foreground text-xs">{help}</p>}
			<Textarea
				rows={4}
				value={text}
				onChange={(e) => {
					const t = e.target.value;
					setText(t);
					onChange(
						t
							.split('\n')
							.map((s) => s.trim())
							.filter((s) => s.length > 0),
					);
				}}
			/>
		</div>
	);
}

export function PrivacySettingsPage() {
	const { config, error, save } = usePrivacyConfig();
	const [draft, setDraft] = useState<RedactionConfig | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const current = draft ?? config;
	if (!current) {
		return <div className="p-4">{error ?? 'Carregando...'}</div>;
	}

	const update = (patch: Partial<RedactionConfig>) => setDraft({ ...current, ...patch });

	const onSave = async () => {
		setSaveError(null);
		try {
			await save(current);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
			setDraft(null);
		} catch (e) {
			setSaveError(String(e));
		}
	};

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-4">
			<header>
				<h1 className="font-semibold text-xl">Privacidade</h1>
				<p className="text-muted-foreground text-sm">
					Configura mascaramento aplicado durante a gravação. Mudanças valem para gravações
					futuras (sessões já gravadas não são re-redigidas).
				</p>
			</header>

			<section className="space-y-3 rounded border p-4">
				<div className="flex items-center justify-between">
					<Label htmlFor="enabled">Mascaramento global</Label>
					<Switch
						id="enabled"
						checked={current.enabled}
						onCheckedChange={(v) => update({ enabled: v })}
					/>
				</div>
				<p className="text-muted-foreground text-xs">
					Se desligado, nenhum redactor roda — sessões saem totalmente brutas.
				</p>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">Headers</h2>
				<ListEditor
					label="Header keys (case-insensitive)"
					value={current.headerKeys}
					onChange={(v) => update({ headerKeys: v })}
					help="Um por linha. Ex: authorization, cookie."
				/>
				<ListEditor
					label="Header regex"
					value={current.headerRegex}
					onChange={(v) => update({ headerRegex: v })}
					help="Um por linha. Ex: ^x-.*-token$"
				/>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">Bodies</h2>
				<ListEditor
					label="Regex aplicada em request/response bodies"
					value={current.bodyRegex}
					onChange={(v) => update({ bodyRegex: v })}
				/>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">Console</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="console-enabled">Mascarar args de console</Label>
					<Switch
						id="console-enabled"
						checked={current.consoleEnabled}
						onCheckedChange={(v) => update({ consoleEnabled: v })}
					/>
				</div>
				<ListEditor
					label="Regex aplicada em console arg description"
					value={current.consoleRegex}
					onChange={(v) => update({ consoleRegex: v })}
				/>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">State</h2>
				<ListEditor
					label="Blacklist de paths (glob)"
					value={current.stateBlacklistPaths}
					onChange={(v) => update({ stateBlacklistPaths: v })}
					help="Ex: auth.*.token, user.password"
				/>
				<ListEditor
					label="Whitelist de paths (se preenchida, SÓ esses paths são preservados)"
					value={current.stateWhitelistPaths}
					onChange={(v) => update({ stateWhitelistPaths: v })}
				/>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">rrweb (visual)</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="rrweb-all">Mascarar TODOS os inputs (modo paranoico)</Label>
					<Switch
						id="rrweb-all"
						checked={current.rrwebMaskAllInputs}
						onCheckedChange={(v) => update({ rrwebMaskAllInputs: v })}
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor="rrweb-selector">Selector CSS adicional para mascarar texto</Label>
					<Input
						id="rrweb-selector"
						value={current.rrwebMaskTextSelector}
						onChange={(e) => update({ rrwebMaskTextSelector: e.target.value })}
					/>
				</div>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">URL gate (não capturar nada)</h2>
				<ListEditor
					label="Domains banidos (glob, ex: *.banco.com.br)"
					value={current.urlBlacklist}
					onChange={(v) => update({ urlBlacklist: v })}
				/>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">Paths em stack traces</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="trunc">Truncar /Users/&lt;u&gt;/, /home/&lt;u&gt;/, C:\Users\&lt;u&gt;\</Label>
					<Switch
						id="trunc"
						checked={current.truncateUserPaths}
						onCheckedChange={(v) => update({ truncateUserPaths: v })}
					/>
				</div>
			</section>

			<section className="space-y-3 rounded border p-4">
				<h2 className="font-medium">Retenção</h2>
				<div className="flex items-center justify-between">
					<Label htmlFor="auto-purge">Auto-purge de sessões antigas</Label>
					<Switch
						id="auto-purge"
						checked={current.autoPurgeEnabled}
						onCheckedChange={(v) => update({ autoPurgeEnabled: v })}
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor="retention">Reter por (dias)</Label>
					<Input
						id="retention"
						type="number"
						min={1}
						value={current.autoPurgeRetentionDays}
						onChange={(e) => update({ autoPurgeRetentionDays: Number(e.target.value) })}
					/>
				</div>
			</section>

			{saveError && <p className="text-red-700 text-sm">{saveError}</p>}
			{saved && <p className="text-green-700 text-sm">Salvo.</p>}

			<div className="flex gap-2">
				<Button onClick={() => void onSave()} disabled={!draft}>
					Salvar
				</Button>
				<Button variant="ghost" disabled={!draft} onClick={() => setDraft(null)}>
					Descartar
				</Button>
			</div>
		</div>
	);
}
```

### Step 11.3: Adicionar rota

Em `app/src/routes.tsx`, adicionar:

```tsx
import { PrivacySettingsPage } from '@/pages/PrivacySettingsPage';

// ... dentro de children do Layout:
{ path: 'settings/privacy', element: <PrivacySettingsPage /> },
```

E link na sidebar (em `app/src/components/layout/NavMain.tsx`):

```tsx
{ title: 'Privacidade', url: '/settings/privacy', icon: ShieldIcon }
```

### Step 11.4: Test

`app/src/pages/__tests__/PrivacySettingsPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '@/lib/session/privacy/defaults';
import { PrivacySettingsPage } from '../PrivacySettingsPage';

describe('PrivacySettingsPage', () => {
	beforeEach(() => {
		(globalThis as unknown as { chrome: typeof chrome }).chrome = {
			...(globalThis as unknown as { chrome: typeof chrome }).chrome,
			runtime: {
				...(globalThis as unknown as { chrome: typeof chrome }).chrome.runtime,
				sendMessage: vi.fn(async (msg: { action: string; config?: unknown }) => {
					if (msg.action === 'getPrivacyConfig') {
						return { ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG };
					}
					if (msg.action === 'setPrivacyConfig') {
						return { ok: true };
					}
					return { ok: false };
				}),
			} as unknown as typeof chrome.runtime,
		};
	});

	it('carrega config e mostra header keys default', async () => {
		render(
			<MemoryRouter>
				<PrivacySettingsPage />
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText(/Privacidade/i)).toBeInTheDocument());
		expect(screen.getByText(/Header keys/i)).toBeInTheDocument();
		const ta = screen.getAllByRole('textbox').find((el) =>
			el.textContent?.includes('authorization'),
		);
		expect(ta).toBeDefined();
	});

	it('toggle "Mascaramento global" muda estado', async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter>
				<PrivacySettingsPage />
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByLabelText(/Mascaramento global/i)).toBeInTheDocument());
		const toggle = screen.getByLabelText(/Mascaramento global/i);
		await user.click(toggle);
		// Botão Salvar habilita após edição
		const save = screen.getByRole('button', { name: /Salvar/i });
		expect(save).not.toBeDisabled();
	});

	it('mostra erro se setPrivacyConfig rejeita (regex inválida)', async () => {
		(globalThis as unknown as { chrome: typeof chrome }).chrome.runtime.sendMessage = vi.fn(
			async (msg: { action: string }) => {
				if (msg.action === 'getPrivacyConfig') {
					return { ok: true, privacyConfig: DEFAULT_REDACTION_CONFIG };
				}
				return { ok: false, error: 'SyntaxError: Invalid regular expression' };
			},
		) as unknown as typeof chrome.runtime.sendMessage;

		const user = userEvent.setup();
		render(
			<MemoryRouter>
				<PrivacySettingsPage />
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByLabelText(/Mascaramento global/i)).toBeInTheDocument());
		await user.click(screen.getByLabelText(/Mascaramento global/i));
		await user.click(screen.getByRole('button', { name: /Salvar/i }));
		await waitFor(() =>
			expect(screen.getByText(/Invalid regular expression/i)).toBeInTheDocument(),
		);
	});
});
```

### Step 11.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/pages/__tests__/PrivacySettingsPage.test.tsx
git add app/src/pages/PrivacySettingsPage.tsx app/src/hooks/usePrivacyConfig.ts app/src/routes.tsx app/src/components/layout/NavMain.tsx app/src/pages/__tests__/PrivacySettingsPage.test.tsx
git commit -m "feat(session): página /settings/privacy + hook usePrivacyConfig"
```

---

## Task 12: Banner ruidoso

**Files:**
- Modify: `app/src/components/recording/RecordingBanner.tsx`
- Test: `app/src/components/recording/__tests__/RecordingBanner.test.tsx`

### Step 12.1: Atualizar `RecordingBanner.tsx`

Substituir conteúdo:

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

	return (
		<output
			aria-label="Gravação ativa"
			role="status"
			aria-live="polite"
			data-testid="recording-banner"
			className="sticky top-0 z-50 flex items-center justify-between border-red-900 border-b bg-red-600 px-4 py-2 text-sm text-white shadow-md"
		>
			<div className="flex items-center gap-3">
				<span
					className="size-3 animate-pulse rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.3)]"
					aria-hidden="true"
				/>
				<span className="font-bold uppercase tracking-wide">GRAVANDO</span>
				<span className="font-mono text-xs opacity-90">
					{formatDuration(status.durationMs)} / {DURATION_LIMIT_MIN}:00 ·{' '}
					{formatBytes(status.sizeBytes)} / {SIZE_LIMIT_MB} MB
				</span>
			</div>
			<Button
				size="sm"
				variant="outline"
				className="border-white/40 bg-transparent text-white hover:bg-white/10"
				onClick={() => void stopRecording()}
			>
				Parar gravação
			</Button>
		</output>
	);
}
```

> Nota: dismiss bloqueado significa que **não há botão "X"** — único caminho é "Parar gravação".

### Step 12.2: Test

`app/src/components/recording/__tests__/RecordingBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordingBanner } from '../RecordingBanner';

vi.mock('@/hooks/useRecording', () => ({
	useRecording: () => ({
		status: { active: true, durationMs: 60_000, sizeBytes: 1024 * 1024 },
		stopRecording: vi.fn(),
	}),
}));

describe('RecordingBanner (ruidoso)', () => {
	it('mostra label "GRAVANDO" em caixa alta', () => {
		render(<RecordingBanner tabId={1} />);
		expect(screen.getByText('GRAVANDO')).toBeInTheDocument();
	});

	it('aplica cor vermelha (bg-red-600)', () => {
		render(<RecordingBanner tabId={1} />);
		const banner = screen.getByTestId('recording-banner');
		expect(banner.className).toContain('bg-red-600');
	});

	it('tem dot animado (animate-pulse)', () => {
		const { container } = render(<RecordingBanner tabId={1} />);
		const dot = container.querySelector('.animate-pulse');
		expect(dot).not.toBeNull();
	});

	it('NÃO tem botão de dismiss/fechar (X)', () => {
		render(<RecordingBanner tabId={1} />);
		expect(screen.queryByRole('button', { name: /fechar|dismiss|×/i })).toBeNull();
	});

	it('botão "Parar gravação" é o único caminho de saída', () => {
		render(<RecordingBanner tabId={1} />);
		expect(screen.getByRole('button', { name: /Parar gravação/i })).toBeInTheDocument();
	});
});
```

### Step 12.3: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/recording/__tests__/RecordingBanner.test.tsx
git add app/src/components/recording/RecordingBanner.tsx app/src/components/recording/__tests__/RecordingBanner.test.tsx
git commit -m "feat(session): banner ruidoso GRAVANDO em vermelho com pulse, sem dismiss"
```

---

## Task 13: Aviso ao importar sessão de origem diferente

**Files:**
- Create: `app/src/components/recording/ImportOriginWarningDialog.tsx`
- Modify: `app/src/components/recording/ImportButton.tsx`
- Modify: `app/src/pages/ReplayPage.tsx`
- Test: `app/src/components/recording/__tests__/ImportOriginWarningDialog.test.tsx`

### Step 13.1: `ImportOriginWarningDialog.tsx`

`app/src/components/recording/ImportOriginWarningDialog.tsx`:

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
	importedOrigin: string;
	currentOrigin: string;
	onContinue: () => void;
	onCancel: () => void;
}

export function ImportOriginWarningDialog({
	open,
	importedOrigin,
	currentOrigin,
	onContinue,
	onCancel,
}: Props) {
	return (
		<Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Sessão de origem diferente</DialogTitle>
					<DialogDescription>
						Esta sessão foi gravada em <strong>{importedOrigin}</strong>, mas a tab atual está em
						<strong> {currentOrigin}</strong>. O replay funciona normalmente, mas verifique se a
						origem é confiável antes de prosseguir — sessões de origem desconhecida podem conter
						conteúdo inesperado.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={onCancel}>
						Cancelar
					</Button>
					<Button onClick={onContinue}>Continuar</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

### Step 13.2: Adaptar `ImportButton.tsx`

```tsx
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { parseDbsession } from '@/lib/session/importer';
import { ImportOriginWarningDialog } from './ImportOriginWarningDialog';

interface Props {
	onImported?: (sessionId: string) => void;
}

function originOf(rawUrl: string): string {
	try {
		return new URL(rawUrl).origin;
	} catch {
		return rawUrl;
	}
}

async function getCurrentTabOrigin(): Promise<string> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.url ? originOf(tab.url) : '';
}

export function ImportButton({ onImported }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();
	const [pending, setPending] = useState<{
		buf: ArrayBuffer;
		filename: string;
		importedOrigin: string;
		currentOrigin: string;
	} | null>(null);

	const persist = async (buf: ArrayBuffer, filename: string) => {
		const res = await chrome.runtime.sendMessage({
			action: 'importSession',
			data: buf,
			filename,
		});
		if (!res?.ok || !res.sessionId) {
			window.alert(`Falha ao importar: ${res?.error ?? 'erro desconhecido'}`);
			return;
		}
		onImported?.(res.sessionId);
		navigate(`/replay/${res.sessionId}`);
	};

	const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		const buf = await file.arrayBuffer();
		// Pré-parse SÓ pra ler initialUrl. Reparse depois no background é idempotente.
		const session = await parseDbsession(buf);
		const importedOrigin = originOf(session.metadata.initialUrl);
		const currentOrigin = await getCurrentTabOrigin();
		if (currentOrigin && importedOrigin && importedOrigin !== currentOrigin) {
			setPending({ buf, filename: file.name, importedOrigin, currentOrigin });
			return;
		}
		await persist(buf, file.name);
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".dbsession,application/zip"
				className="hidden"
				onChange={(e) => void onChange(e)}
			/>
			<Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
				Importar .dbsession
			</Button>
			{pending && (
				<ImportOriginWarningDialog
					open={true}
					importedOrigin={pending.importedOrigin}
					currentOrigin={pending.currentOrigin}
					onCancel={() => setPending(null)}
					onContinue={async () => {
						const p = pending;
						setPending(null);
						await persist(p.buf, p.filename);
					}}
				/>
			)}
		</>
	);
}
```

### Step 13.3: Banner permanente em `ReplayPage`

Em `ReplayPage.tsx`, no topo:

```tsx
{session.origin === 'imported' && currentTabOrigin && originOf(session.metadata.initialUrl) !== currentTabOrigin && (
	<div className="border-amber-300 border-b bg-amber-50 px-4 py-2 text-amber-900 text-sm">
		Sessão importada de <strong>{originOf(session.metadata.initialUrl)}</strong> — diferente da tab atual <strong>{currentTabOrigin}</strong>.
	</div>
)}
```

### Step 13.4: Test

`app/src/components/recording/__tests__/ImportOriginWarningDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportOriginWarningDialog } from '../ImportOriginWarningDialog';

describe('ImportOriginWarningDialog', () => {
	it('mostra origem importada e atual', () => {
		render(
			<ImportOriginWarningDialog
				open={true}
				importedOrigin="https://app.foo.com"
				currentOrigin="https://app.bar.com"
				onContinue={() => {}}
				onCancel={() => {}}
			/>,
		);
		expect(screen.getByText(/app\.foo\.com/i)).toBeInTheDocument();
		expect(screen.getByText(/app\.bar\.com/i)).toBeInTheDocument();
	});

	it('Continuar dispara onContinue', async () => {
		const onContinue = vi.fn();
		const user = userEvent.setup();
		render(
			<ImportOriginWarningDialog
				open={true}
				importedOrigin="https://a"
				currentOrigin="https://b"
				onContinue={onContinue}
				onCancel={() => {}}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /Continuar/i }));
		expect(onContinue).toHaveBeenCalledOnce();
	});

	it('Cancelar dispara onCancel', async () => {
		const onCancel = vi.fn();
		const user = userEvent.setup();
		render(
			<ImportOriginWarningDialog
				open={true}
				importedOrigin="https://a"
				currentOrigin="https://b"
				onContinue={() => {}}
				onCancel={onCancel}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onCancel).toHaveBeenCalledOnce();
	});
});
```

### Step 13.5: Validate + Commit

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/recording/__tests__/ImportOriginWarningDialog.test.tsx
git add app/src/components/recording/ImportOriginWarningDialog.tsx app/src/components/recording/ImportButton.tsx app/src/pages/ReplayPage.tsx app/src/components/recording/__tests__/ImportOriginWarningDialog.test.tsx
git commit -m "feat(session): aviso ao importar sessão de origem diferente da tab atual"
```

---

## Task 14: ExportConfirmDialog atualizado

**Files:**
- Modify: `app/src/components/recording/ExportConfirmDialog.tsx`
- Modify: `app/src/components/recording/__tests__/ExportConfirmDialog.test.tsx`

### Step 14.1: Atualizar componente

`app/src/components/recording/ExportConfirmDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import type { RedactionConfig } from '@/lib/session/types';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

function summarizeConfig(c: RedactionConfig): string[] {
	const out: string[] = [];
	if (!c.enabled) {
		out.push('Mascaramento DESLIGADO — exportação contém conteúdo bruto.');
		return out;
	}
	if (c.headerKeys.length > 0)
		out.push(`Headers: ${c.headerKeys.length} key(s) + ${c.headerRegex.length} regex(es) redigidos.`);
	if (c.bodyRegex.length > 0)
		out.push(`Bodies: ${c.bodyRegex.length} regex(es) aplicado(s) em request/response.`);
	if (c.consoleEnabled && c.consoleRegex.length > 0)
		out.push(`Console: ${c.consoleRegex.length} regex(es) em descriptions de args.`);
	if (c.stateBlacklistPaths.length > 0 || c.stateWhitelistPaths.length > 0)
		out.push(
			`State: ${c.stateBlacklistPaths.length} blacklist + ${c.stateWhitelistPaths.length} whitelist paths.`,
		);
	if (c.urlBlacklist.length > 0)
		out.push(`URL gate: ${c.urlBlacklist.length} domain(s) totalmente ignorado(s).`);
	out.push(`rrweb: inputs ${c.rrwebMaskAllInputs ? 'TODOS' : 'sensíveis (password+cc-*)'} mascarados.`);
	return out;
}

export function ExportConfirmDialog({ open, onOpenChange, onConfirm }: Props) {
	const [config, setConfig] = useState<RedactionConfig | null>(null);

	useEffect(() => {
		if (!open) return;
		void chrome.runtime
			.sendMessage({ action: 'getPrivacyConfig' })
			.then((res) => {
				if (res?.ok && res.privacyConfig) setConfig(res.privacyConfig);
			});
	}, [open]);

	const summary = config ? summarizeConfig(config) : null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Exportar sessão — leia antes</DialogTitle>
					<DialogDescription className="text-sm">
						A sessão <strong>já está mascarada conforme suas configurações</strong>. Ainda assim,
						o arquivo contém dados sensíveis residuais (telemetria, URLs, timestamps, snapshots de
						DOM). Revise antes de anexar em qualquer lugar público (Jira, Slack, e-mail). Para
						ajustar o que é mascarado, abra <strong>Configurações &gt; Privacidade</strong>.
					</DialogDescription>
				</DialogHeader>
				{summary && (
					<ul className="list-disc space-y-1 pl-5 text-xs">
						{summary.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				)}
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

### Step 14.2: Atualizar tests

`app/src/components/recording/__tests__/ExportConfirmDialog.test.tsx` (substituir conteúdo):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REDACTION_CONFIG } from '@/lib/session/privacy/defaults';
import { ExportConfirmDialog } from '../ExportConfirmDialog';

beforeEach(() => {
	(globalThis as unknown as { chrome: typeof chrome }).chrome = {
		...(globalThis as unknown as { chrome: typeof chrome }).chrome,
		runtime: {
			...(globalThis as unknown as { chrome: typeof chrome }).chrome.runtime,
			sendMessage: vi.fn(async () => ({
				ok: true,
				privacyConfig: DEFAULT_REDACTION_CONFIG,
			})),
		} as unknown as typeof chrome.runtime,
	};
});

describe('ExportConfirmDialog (Phase 6)', () => {
	it('NÃO menciona mais "versão futura"', async () => {
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		await waitFor(() =>
			expect(screen.getByText(/já está mascarada/i)).toBeInTheDocument(),
		);
		expect(screen.queryByText(/versão futura/i)).toBeNull();
	});

	it('mostra sumário das proteções aplicadas', async () => {
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		await waitFor(() =>
			expect(screen.getByText(/Headers:/i)).toBeInTheDocument(),
		);
		expect(screen.getByText(/rrweb/i)).toBeInTheDocument();
	});

	it('botão "Entendi, exportar" chama onConfirm e fecha', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		render(
			<ExportConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={onConfirm} />,
		);
		await waitFor(() => screen.getByText(/já está mascarada/i));
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
		await waitFor(() => screen.getByText(/já está mascarada/i));
		await user.click(screen.getByRole('button', { name: /Cancelar/i }));
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('alerta quando enabled=false', async () => {
		(globalThis as unknown as { chrome: typeof chrome }).chrome.runtime.sendMessage = vi.fn(
			async () => ({
				ok: true,
				privacyConfig: { ...DEFAULT_REDACTION_CONFIG, enabled: false },
			}),
		) as unknown as typeof chrome.runtime.sendMessage;
		render(<ExportConfirmDialog open={true} onOpenChange={() => {}} onConfirm={() => {}} />);
		await waitFor(() =>
			expect(screen.getByText(/Mascaramento DESLIGADO/i)).toBeInTheDocument(),
		);
	});
});
```

### Step 14.3: Validate + Commit Final

```bash
cd app && node_modules/.bin/tsc --noEmit
cd app && npm run lint
cd app && node_modules/.bin/vitest run src/components/recording/__tests__/ExportConfirmDialog.test.tsx
cd app && npm test 2>&1 | tail -8
cd app && npm run build
git add app/src/components/recording/ExportConfirmDialog.tsx app/src/components/recording/__tests__/ExportConfirmDialog.test.tsx
git commit -m "feat(session): ExportConfirmDialog mostra sumário de redaction aplicado (Fase 6)"
```

---

## Self-Review Checklist

- [ ] **Spec coverage Fase 6 — todos os TODOs Privacidade endereçados:**
  - rrweb mask (passwords, cc-*, .dbb-mask, [data-dbb-mask]) ✓ (Task 10)
  - Header redaction (Authorization, Cookie, Set-Cookie, X-API-Key, regex) ✓ (Task 2 + Task 9)
  - Body redaction (regex JWT, card PAN, JSON token/password) ✓ (Task 3 + Task 9)
  - Console args redaction (regex em description + preview.value) ✓ (Task 4 + Task 9)
  - State whitelist/blacklist via glob de paths ✓ (Task 5 + Task 9)
  - URL gate (domains banidos não capturam nada) ✓ (Task 7 + Task 9)
  - Path truncation em stack traces e source maps ✓ (Task 6 + Task 9)
  - Política para sessões importadas cross-origin (modal) ✓ (Task 13)
  - Banner permanente ruidoso "GRAVANDO" sem dismiss ✓ (Task 12)
  - Auto-purge configurável (default 30d) ✓ (Task 8 + Task 9)
  - `redactionApplied?: RedactionConfig` em Session (auditoria) ✓ (Task 1 + Task 9)
  - Modal Export sem "versão futura", com sumário de proteções ✓ (Task 14)
  - Configuração persistida em chrome.storage.local + UI `/settings/privacy` ✓ (Task 8 + Task 11)

- [ ] **No-fallbacks check:**
  - Regex inválida lança `SyntaxError` em `validateRedactionConfig` (Task 8) e em cada redactor isoladamente (Tasks 2/3/4) — caller decide, sem fallback silencioso.
  - `purgeOldSessions` lança `RangeError` em retentionDays inválido (Task 8).
  - `privacyOrThrow` no background lança se config ainda não carregou — sem fallback para "rodar sem mascaramento".
  - `urlGate` só retorna `false` em URL inválida porque é decisão do caller (não é redação faltando).

- [ ] **TypeScript strict + Biome:**
  - Todos os arquivos novos compilam com `tsc --noEmit`.
  - `npm run lint` verde.
  - Tabs (size 2), single quotes, trailing commas — conforme `.editorconfig`/`biome.json`.
  - Strings UI em PT-BR.

- [ ] **Testes co-localizados em `__tests__/`:**
  - 9 utils (defaults, config, header, body, console, state, path, urlGate, autoPurge).
  - 1 integração recorder.
  - 4 componentes UI (RecordingBanner, ExportConfirmDialog, ImportOriginWarningDialog, PrivacySettingsPage).
  - rrweb mask (smoke test de shape de opções).

- [ ] **Build da extensão funciona:** `npm run build` produz `dist/` carregável em `chrome://extensions`.

- [ ] **Sessões antigas (sem `redactionApplied`) continuam abrindo** — campo opcional, replay tolera ausência.

- [ ] **CI verde:** lint, build, test, e2e.

---

## Pontos abertos pra pós-Fase 6

- **Console redactor em `value` aninhado profundo:** Phase 6 cobre só `description` + 1 nível de `preview.properties.value`. Objetos profundos com tokens em folhas internas escapam. Documentar limitação.
- **Source map fetch via auth/CORS:** continua sem solução; Fase 6 só trunca paths já resolvidos. UI para upload manual de `.map` fica como follow-up.
- **rrweb canvas masking:** quando canvas opt-in está ON, frames podem revelar dados. rrweb tem `recordCanvas` mas sem masking nativo. Por enquanto usuários com canvas ON são responsáveis. Follow-up: avisar no checkbox de canvas.
- **Auto-purge "soft delete"** — atual é hard delete imediato. Considerar lixeira de 7d antes de purgar de fato (Phase 6.x).
- **Pré-export "preview"** — mostrar diff entre raw e redacted antes do export. Fora do escopo (caro de renderizar).
- **Chave por origin** para rrweb mask config — alguns devs querem regras diferentes por domain. Fora da v1 da Fase 6.
- **`redactionApplied` mais rico** — incluir contadores ("47 headers redigidos, 12 console args, 3 state paths") como telemetria interna.
