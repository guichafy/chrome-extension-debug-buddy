# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Debug Buddy** — Manifest V3 Chrome extension (name `Debug Buddy` in both `app/manifest.json` and `app/package.json` slug `debug-buddy`) that intercepts and modifies network responses via the `chrome.debugger` Fetch domain. Used to inject failures, mock responses, and pause requests for inspection while developing web apps.

GitHub repo: `guichafy/chrome-extension-debug-buddy`. Issues track known bugs and feature requests — read them with `gh issue list` before changing related code.

## Working directory

All npm/build/lint/test commands run from the `app/` subdirectory, **not** from the repo root. CI (`.github/workflows`) sets `working-directory: app` for this reason.

```bash
cd app
npm install              # install deps
npm run dev              # vite dev server (mostly used for type/build feedback; see "Loading the extension")
npm run build            # production build → app/dist/
npm run build:dev        # development build → app/dist/ (não minificado, React em modo dev, sourcemaps; compatível com a extensão React Developer Tools)
npm run watch            # vite build --watch (rebuild on save while extension is loaded from dist/)
npm run watch:dev        # vite build --watch --mode development (mesmo do watch, mas com bundle dev p/ depurar com React DevTools)
npm run lint             # biome check src
npm run lint:fix         # biome check --write src
npm run format           # biome format --write src
npm test                 # vitest run (jsdom)
npm run test:watch       # vitest (interactive)
npm run test:coverage    # vitest run --coverage (v8)
npx vitest path/to/file.test.tsx        # run a single test file
npx vitest -t "name pattern"            # filter by test name
```

CI runs `lint`, `build`, `test` (in that order) on PRs to `main` — keep all three green.

## Loading the extension

1. `cd app && npm run build` (or `npm run watch` for iterative dev)
2. `chrome://extensions` → Developer mode → "Load unpacked" → select `app/dist/`
3. Click the extension's toolbar icon to open the interceptor tab (the React app — `app/options.html` is both `options_page` and what `chrome.action.onClicked` opens via `chrome.tabs.create`). Alternatively, open Chrome's side panel (toolbar button or right-click action icon → "Open side panel") to use the docked UI from `app/sidepanel.html`; both entrypoints share state via `chrome.storage.local` and IndexedDB.
4. In the interceptor UI, pick a **target tab** (the page the debugger attaches to), then "Start Debugging"

The "Start Debugging" warning bar in Chrome appears on the target tab — that's expected (`chrome.debugger.attach`).

## Depurando a UI da própria extensão com React DevTools

A extensão *React Developer Tools* do Chrome **não** consegue inspecionar páginas `chrome-extension://` — o Chrome bloqueia content scripts entre extensões. Para ver a árvore de componentes em `options.html` ou no side panel, usamos a versão **standalone** (Electron) que escuta WebSocket em `localhost:8097`. O fluxo só é ativado em build dev:

- `npm run build:dev` / `npm run watch:dev` injetam `<script src="http://localhost:8097"></script>` como primeira tag no `<head>` de `options.html` e `sidepanel.html` (sandbox fica de fora — não tem React) e adicionam `content_security_policy.extension_pages: "script-src 'self' http://localhost:8097; object-src 'self'"` ao `dist/manifest.json`. Tudo isso é controlado por `mode === 'development'` em `app/vite.config.mts` — o build de produção continua idêntico (sem CSP custom, sem script remoto), o que é obrigatório para a Chrome Web Store aceitar o pacote.
- Uso prático:
  1. Terminal A: `cd app && npm run devtools` — abre a janela standalone.
  2. Terminal B: `cd app && npm run watch:dev` — gera `dist/` com a injeção.
  3. `chrome://extensions` → recarregar Debug Buddy → abrir `options.html` ou o side panel. A árvore aparece na janela standalone; se ela diz "Waiting for React to connect..." é porque o `npm run devtools` não está rodando ou o navegador foi aberto antes do bundle terminar de buildar.

## Architecture overview

Four moving parts you must understand before changing anything substantial:

### 1. Two-tab model (background.ts)

`app/src/entrypoints/background.ts` is the service worker and the **authority for runtime state**. It tracks two distinct tab IDs:

- `interceptorTabId` — the tab where the React UI runs (set when user clicks the action icon)
- `targetTabId` — the tab the user picked to debug (persisted in `chrome.storage.local.targetTabInfo`)

The debugger only attaches to `targetTabId`. Closing `interceptorTabId` automatically stops debugging (`chrome.tabs.onRemoved` listener). Don't conflate the two — most bugs in this area come from messaging the wrong tab.

### 2. Interception flow (dual-stage, Phase 1–9)

`startDebugging()` calls `chrome.debugger.attach({tabId}, '1.3')` and enables `Network.enable` (timing) plus `Fetch.enable` with **two** intercept patterns: `requestStage: 'Request'` (before the request leaves the browser) and `requestStage: 'Response'` (after the server replied). Cada `Fetch.requestPaused` cai num dos dois caminhos pelo presença/ausência de `responseStatusCode`.

**Request stage** (`responseStatusCode === undefined`):

1. `findMatchingRulesChain(rules, 'request', input)` retorna a chain ordenada de regras com `stage === 'request'` que casam o input. Chain corta no primeiro terminal (`mock`/`block`/`breakpoint`).
2. `executeChain(plan, requestId, 'request', { request: initialSnapshot }, ctx)` itera cada `Action`:
   - `requestModify` → reescreve url/method/headers/body via `applyHeaderOps`/`applyBodyOperations`.
   - `requestDelay` → `await wait(timeMs)`.
   - `block` (terminal) → `Fetch.failRequest`.
   - `mock` (terminal) → `Fetch.fulfillRequest` curto-circuita a rede.
   - `breakpoint` (terminal) → enfileira em `pendingInterceptions` (UI mostra EditRequestSheet).
3. Phase 7: ao final, `diffRequestSnapshots(initial, result.requestSnapshot)` gera `RequestModificationSnapshot` quando a chain mexeu em algo. Para terminais mock/block o snapshot é anexado direto ao `InterceptedResponse`; para chain modify-only que continua para a rede, o snapshot vai pro Map `pendingRequestModified` e é consumido no Response stage.
4. Pass-through (sem regras stage='request' casadas, ou só modifiers) → `Fetch.continueRequest` (com mods aplicados).

**Response stage** (`responseStatusCode` é número):

1. `findMatchingRuleAction(rules, input, 'response')` localiza a primeira regra stage='response' que casa (engine legacy ainda usado para mock/transform/breakpoint do Response stage — migração pra `executeChain` planejada).
2. `Fetch.getResponseBody` captura o corpo; `buildResponseSnapshot` monta o `InterceptedResponse`.
3. Para `mock` → `applyMockResponse` (Fetch.fulfillRequest com mock; descarta o body original).
4. Para `transform` → `applyTransformResponse` aplica o script/operations e Fetch.fulfillRequest com body modificado. Phase 7: `responseModified` é populado comparando body antes×depois.
5. Para `breakpoint` → marca `isWaiting: true` e enfileira em `pendingInterceptions` (UI mostra EditResponseSheet).
6. Sem regra casando → `Fetch.continueRequest` pass-through.
7. Phase 7: se `pendingRequestModified` tem entry para o requestId, consome e anexa `requestModified` ao `InterceptedResponse` persistido.

`stopDebugging()` continua todas as requests pendentes antes de detach. Qualquer coisa deixada em `pendingInterceptions` travaria a página.

### 2a. Real-time duration capture

`Fetch` and `Network` are different CDP domains with **different `requestId` namespaces**. Correlation uses the `networkId` field on `Fetch.requestPaused` (when both domains are enabled, it equals `Network.requestWillBeSent.requestId`).

`Fetch.requestPaused` (Response stage) fires *before* `Network.responseReceived`/`loadingFinished` get delivered to the listener — so duration cannot be read synchronously. `app/src/lib/networkTiming.ts` exposes a `NetworkTimingTracker` class that buffers `start` (`requestWillBeSent.timestamp`) and `end` (`loadingFinished.timestamp`, with `responseReceived` as TTFB fallback) and emits `onDurationReady(fetchRequestId, durationMs)` once both sides plus `linkFetchId` (called from `handleRequestPaused`) are present. The background's emit callback updates `allRequests[fetchId].duration` and broadcasts a `requestUpdated` message; `useAllRequests` merges the partial update into state and IndexedDB.

The tracker filters Network events to a 4-event allowlist (`requestWillBeSent`/`responseReceived`/`loadingFinished`/`loadingFailed`) and caps internal entries at 2000 (FIFO eviction) to bound memory in long debugging sessions.

### 3. Rule schema (dual-stage)

`Rule[]` em `app/src/types/rules.ts` carrega o schema v2 dual-stage:

```ts
interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  stage: 'request' | 'response';     // Phase 1 — qual ponto do CDP interceptar
  matchers: Matcher[];               // URL/method/header/body
  actions: Action[];                 // Phase 1 — chain ordenada de ações
  createdAt: number;
  updatedAt: number;
}
```

`Action.type` ∈ `'requestModify' | 'responseModify' | 'requestDelay' | 'transform' | 'mock' | 'block' | 'breakpoint'`. **Ações terminais** (`mock`, `block`, `breakpoint`) interrompem a chain — só podem aparecer na última posição (validado em Phase 4). Cada `Action.type` é válida em um ou ambos os stages — ver `REQUEST_STAGE_ACTIONS`/`RESPONSE_STAGE_ACTIONS` em `types/rules.ts`.

Exemplo (regra Request stage que injeta header + manda mock):

```json
{
  "id": "uuid",
  "name": "Mock /api/users com bearer",
  "enabled": true,
  "stage": "request",
  "matchers": [
    { "type": "url", "enabled": true, "pattern": "/api/users", "isRegex": false }
  ],
  "actions": [
    { "type": "requestModify", "enabled": true, "addHeaders": { "Authorization": "Bearer x" } },
    { "type": "mock", "enabled": true, "status": 200, "headers": {}, "body": "[]" }
  ]
}
```

`legacyMigration.ts` (Phase 1) converte storage v0 (`urlPatterns`/`mocks`) para `Rule[]` v2 — breakpoints e mocks legados nascem com `stage: 'response'`. Backup do dado pré-migração fica em `chrome.storage.local.legacy_backup_v1` por um release. Phase 9 mostra um banner one-shot ao usuário avisando do breaking change (`DualStageMigrationNotice`).

A UI (`useRules`) é leitora pura; o background é o dono da migração.

### 4. Persistence split

- **`chrome.storage.local`** — `rules`, `targetTabInfo`, plus `legacy_migrated_at` (timestamp) and `legacy_backup_v1` (one-release safety net containing the pre-migration `urlPatterns`/`mocks`). The background subscribes to `chrome.storage.onChanged` to keep its in-memory `rules` array in sync (so changes apply without restart).
- **In-memory (background)** — `pendingResponses`, `allRequests`, `isDebugging`, `attachedTabId`. The in-memory `allRequests` is a fast cache; the durable copy is in IndexedDB.
- **IndexedDB (shared by background and UI)** — `debugger-extension-db` v1, store `requests` (keyPath `id`, indexes on `data.url`/`data.timestamp`/`data.method`/`data.status`). The same `IndexedDBServiceImpl` (`app/src/lib/indexedDB.ts`) is imported by both the service worker and the UI; each context opens its own connection to the same database (IndexedDB allows concurrent connections).
- **Background is the writer**, frontend is the reader. Two helpers in `background.ts` enforce this:
  - `persistRequest(id, response)` — writes to `allRequests`, IndexedDB, and broadcasts `newRequest` to the UI. Called from `handleRequestPaused` (intercepted/passthrough), `applyMockResponse`, and any other point that creates a request.
  - `patchRequest(id, updates)` — merges into existing `allRequests[id]`, persists, and broadcasts `requestUpdated`. Called from the `NetworkTimingTracker` callback (when `duration` arrives) and from `approveResponse` finalization (when `isWaiting: false` plus modifications are committed).
- **`useAllRequests` is a pure reader**: loads the snapshot from IndexedDB on mount, listens to `newRequest`/`requestUpdated` to keep state reactive while mounted, polls IndexedDB every 10s as resync. It does **not** write to IndexedDB anymore — eliminates data loss when the user navigates away from `/request-history` during interception (the original cause of "intercepted request disappears from history" and issue #4).

### 5. Messaging

UI → background: `chrome.runtime.sendMessage({action, ...})`. Action names live as a union type at the top of `background.ts` (e.g. `startDebugging`, `getDebuggingStatus`, `getPendingResponses`, `getAllRequests`, `approveResponse`, `setTargetTab`, `clearAllRequests`).

Background → UI: `chrome.tabs.sendMessage(interceptorTabId, {action, ...})` via the `broadcastToUI` helper for events targeted at the React app (`newRequest`, `requestUpdated`, `targetTabSelected`, `openSelectTabDialog`), or `chrome.runtime.sendMessage(...)` broadcasts (`newPendingResponse`, `responseBodyReady`). `requestUpdated` carries `{ requestId, updates }` for partial merges (e.g. duration arriving asynchronously after `loadingFinished`, or `isWaiting: false` after dialog approval).

When you add a new action, edit `app/src/types/messages.ts` — that file is the single source of truth, imported by `background.ts` and the UI hooks alike.

## Frontend layout

`app/src/`:

- `entrypoints/options/main.tsx` and `entrypoints/sidepanel/main.tsx` — two React entrypoints that both mount the same `RouterProvider` from `src/routes.tsx`. Options runs in a regular tab (opened via `chrome.action.onClicked` or the manifest's `options_page`); Side Panel runs docked inside Chrome's native side panel. Both share state via `chrome.storage.local` and IndexedDB.
- `entrypoints/background.ts` — the service worker (manifest's `background.service_worker`).
- `routes.tsx` — React 19 + `react-router-dom` `createHashRouter` (hash routing because `chrome-extension://` URLs don't play with HTML5 history). Three routes under `Layout`: `/` (Settings/rules), `/requests` (pending intercepts), `/request-history` (IndexedDB-backed history).
- `pages/Layout.tsx` — sidebar + header shell, owns the `SelectTabDialog`.
- `hooks/` — one hook per concern: `useDebugging`, `useResponses` (pending), `useAllRequests` (history), `useRules` (rule CRUD).
- `components/ui/` — vendored shadcn-ui primitives. Add new ones via `npm run shadcn:add <name>` (configured in `app/components.json`). Tailwind v4 with config in CSS — `@theme` block in `app/src/styles/globals.css` declares `--color-*` design tokens; `tw-animate-css` provides the Radix-targeted animation utilities (`animate-in/out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`).
- `components/layout/` — `AppSidebar`, `SiteHeader`, `NavMain` (chrome shell shared by both entrypoints).
- `components/requests/duration.ts` — pure helpers (`formatDuration`, `getDurationColorClass`, `compareDurations`) used by the "Tempo" column. Co-located tests in `__tests__/duration.test.ts`.
- `lib/` — shared utilities (`indexedDB`, `networkTiming`, `legacyMigration`, `statusBadge`, `helpers`, `utils` — the `cn` shadcn helper). Imported by both background and UI.
- `types/` — shared type contracts (`messages`, `rules`, `intercepted`, `legacy`).
- `domain/` — pure functions for HTTP semantics, mock latency, rule matching.
- `styles/globals.css` — Tailwind v4 + design tokens.

## Build pipeline (Vite)

`app/vite.config.mts` declares four Rollup entry points so the extension's flat-file layout works:

- `options` → `options.html` (the React UI in a tab — manifest `options_page`)
- `sidepanel` → `sidepanel.html` (the React UI docked as a side panel — manifest `side_panel.default_path`)
- `background` → `src/entrypoints/background.ts` (service worker; manifest references `background.js`)
- `main` → `src/entrypoints/options/main.tsx` (kept as an explicit input so the React bundle gets a stable `main.js` filename)

Output `entryFileNames: '[name].js'` is required so `manifest.json`'s `service_worker: "background.js"` resolves. `vite-plugin-static-copy` ships `manifest.json`, `images/`, and `lib/` (jsonlint, codemirror, prettier — used by rule editors) into `dist/`. Path alias `@` → `app/src/`.

## TypeScript & lint

- **TS is strict** (`strict: true` in `app/tsconfig.json`). `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables` are all enforced. `tsc --noEmit` runs in CI as a separate step from `lint` and `build`. `noUnusedLocals`/`noUnusedParameters` are deliberately off (matching Biome's `noUnusedImports`/`noUnusedVariables` posture). When a third-party type is too loose to model precisely (rare), use `as any` with a one-line comment OR `// @ts-expect-error: <motivo>` with a TODO and an issue link — both should be uncommon.
- **Biome** (`app/biome.json`) is the single linter+formatter. Recommended rules with project-specific disables (`noExplicitAny`, `noUnusedVariables`, `noUnusedImports`, `noConsoleLog`, `useOptionalChain`, `noForEach`, etc.). Test files (`**/__tests__/**`) further disable `useButtonType` and `useValidAnchor`.
- Files ignored by Biome: `dist`, `node_modules`, `coverage`, `lib`, `images`, `package-lock.json`, `**/codemirror.d.ts`. Plus everything in `.gitignore` via `vcs.useIgnoreFile: true`.

## Code style

- **Indentation: tabs (size 2)** per `.editorconfig` and Biome config. Don't switch to spaces — diffs will be huge.
- Biome formatter: single quotes, trailing commas everywhere, semicolons always, print width 100, JSX double quotes.
- UI strings, comments, and console logs are written in Portuguese-BR — match that when editing existing files.
- Functional React + hooks. Classes only for the two service wrappers: `IndexedDBServiceImpl` (`app/src/lib/indexedDB.ts`) and `NetworkTimingTracker` (`app/src/lib/networkTiming.ts`).

## No fallbacks / no default values (project-wide rule)

**Implementations must not silently return fallback or default values.** If a code path is currently producing placeholder data when something fails (empty string instead of decoded body, `'Unknown'` instead of a real status phrase, hash-derived "duration" instead of real timing, `Fetch.continueRequest` after a modification error, `m.method || 'ANY'` when a method is required, etc.), the correct behavior is to **surface an error** to the caller — not to fabricate a plausible-looking value.

Why this matters here: this is a debugging tool. Fake-but-valid data is the worst possible output — it hides the bug being investigated. Errors must remain visible.

When writing or auditing code:
- Don't add `try { ... } catch { return defaultValue }` to swallow failures. Let errors bubble up (or convert to a typed error result) and let the UI / message handler decide how to surface them.
- Don't introduce `||` / `??` defaults on fields that are required by the contract — validate and fail instead.
- When refactoring near an existing fallback site, flag it for the user; don't silently preserve it.
- Only add a default when the user explicitly approves it for that specific case.

## Tests

**Vitest** with `jsdom` environment and `globals: true` (no per-file `import { describe, test, expect, vi } from 'vitest'` needed). `app/vitest.setup.ts` imports `@testing-library/jest-dom/vitest` for DOM matchers and mocks the `chrome` global (`runtime`, `storage.local`, `tabs.query`); add to that mock when a new test needs an API beyond what's there. Test files live next to the code in `__tests__/` directories. Path alias `@/*` → `src/*` is configured in `vitest.config.ts`.

### E2E (Playwright)

Suite E2E em `app/e2e/` cobre o Golden Path da interceptação (anexar debugger → request mockada → request renderizada no Command Center, lida do IndexedDB). Roda Chromium real com a extensão construída em `dist/`.

```bash
cd app
npm run build              # pré-requisito: dist/ atualizado
npm run e2e                # roda contra dist/ + Express em :3100
npm run e2e:headed         # janela visível, útil pra debugar fluxos
npm run e2e:ui             # modo interativo do Playwright
```

`launchExtensionContext` usa `headless: false` deliberadamente: Playwright 1.59 seleciona o binário `chromium-headless-shell` quando `headless: true`, e esse binário não consegue carregar extensões. Em runners Linux sem display nativo, o comando precisa ser envolvido em `xvfb-run` — o workflow `.github/workflows/e2e.yml` faz isso.

CI: o workflow `e2e` roda em todo PR para `main` e em pushes para `main`. Em falha, baixe o artefato `playwright-report` (HTML report + trace) por 7 dias. Para virar bloqueante, adicionar manualmente o check `e2e` aos required status checks de `main` no GitHub.

Limites desse primeiro corte: cobre **só o Golden Path** com regra de mock; outros tipos (`delay`, `transform`, `breakpoint`), criação de regra via UI, side panel e migração legacy ficam em issues de follow-up.

**Evidência visual**: cada execução verde gera 6 PNGs em `app/e2e/evidence/` (gitignored, regenerada a cada run pelo globalSetup). O workflow `e2e` sobe esses arquivos como artefato `playwright-evidence` (retenção 7 dias) — útil para revisores de PR. O workflow `release` também roda o E2E antes do semantic-release; em sucesso, os 6 PNGs são anexados à GitHub Release publicada via plugin `@semantic-release/github` com label `E2E evidence — golden path (<tag>)`.

## Commit hooks

**Husky 9** at the repo root (`.husky/`) wires two hooks:
- `pre-commit` runs `cd app && npx lint-staged`, which invokes `biome check --apply --no-errors-on-unmatched` on staged `src/**/*.{ts,tsx,js,jsx,json}` files.
- `commit-msg` runs `cd app && npx --no -- commitlint --edit "$1"`, which validates against `@commitlint/config-conventional` (Conventional Commits: `feat:`, `fix:`, `chore:`, etc.).

The `prepare` script in `app/package.json` (`cd .. && husky`) reinstalls the hooks after every `npm install` from `app/`. Don't run `npm install` from the repo root — husky won't find the right git directory.

## Quirks worth remembering

- **Request *headers* are not stored separately from response headers** (issue #19) — `InterceptedResponse.headers` always holds response headers. Anything claiming to show "request headers" in `ResponseDialog` is currently misleading.

## Known open issues (April 2026)

Run `gh issue list --state open` for the live list. Active items as of last sync:

- **#3** — i18n (PT-BR / EN) integration with Vite.
- **#6** — Display `package.json` version in `AppSidebar` footer.
- **#19** — Capture and store request headers separately in the background script.

When fixing one of these, link the PR with `Closes #<n>` and update the issue if scope changes.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
Use 'bd' for task tracking
