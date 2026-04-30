# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Routes lazily registered** in `app/src/routes.tsx` via `lazy(() => import(...))` under the shared `Layout` shell. Add new routes there as children.
- **Sidebar nav items + badges**: `app/src/components/layout/AppSidebar.tsx` builds a `navItems` array consumed by `NavMain.tsx`. Each item supports a `count` field; `NavMain` renders `SidebarMenuBadge` only when `count > 0`. Wire counts via props on `AppSidebar` (e.g., `pendingResponsesCount`).
- **`useResponses` hook** is the single source of truth for pending responses. It already polls every 2s and listens for `newPendingResponse`/`responseBodyReady`. Now also listens for `requestUpdated` with `updates.isWaiting === false` to remove pending entries reactively across UI instances.
- **State badges** for request rows: use `getRequestState` + `getStateBadgeMeta` from `app/src/lib/requestState.ts` for consistent visuals (variant, label, icon, pulse) wherever you display request state.
- **Duration formatting**: `formatDuration` and `getDurationColorClass` from `app/src/components/requests/duration.ts` — never reimplement.
- **Test pattern for pages using react-router**: wrap with `MemoryRouter` from `react-router-dom`. Mock chrome.runtime via `vitest.setup.ts` defaults, then override `chrome.runtime.sendMessage` per test. Capture the `messageListener` installed by hooks via `chrome.runtime.onMessage.addListener` mock to drive broadcast-driven UI updates from tests.
- **Pending response actions are centralized** in `app/src/components/command-center/PendingResponseActions.tsx` — split button (Aprovar primário + chevron com Aprovar e editar / Criar Mock / separator / Ignorar). Hotkeys Enter/E/M são locais ao componente; `I` permanece no listener global `usePendingHotkeys`. Reuse this component anywhere you need to act on a paused response.
- **Testing Radix DropdownMenu in jsdom**: pointer events are flaky, so prefer to `vi.mock('@/components/ui/dropdown-menu', ...)` and replace `DropdownMenuItem` with a plain `<button onClick={() => onSelect?.({ preventDefault: () => {} })}>`. This renders the items inline and lets `fireEvent.click` exercise the `onSelect` handler directly. See `PendingResponseActions.test.tsx` for the canonical setup.
- **Sheet width override**: shadcn `SheetContent side="right"` defaults to `w-3/4 sm:max-w-sm` which is too narrow for the `RequestInspector` (3 tabs + headers + body). Use `className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"` to widen and remove default padding so the inspector's own `border-l` and inner padding take over. See `PendingResponses.tsx` for the canonical setup.

---

## 2026-04-30 - chrome-extension-debug-buddy-wlr.1 (US-001: rota /pending)

- Implemented dedicated `/pending` page listing paused responses (isWaiting=true) as a table with columns Método, URL, Status, Tempo, Ações.
- Files changed:
  - `app/src/pages/PendingResponses.tsx` (new) — page component with empty state + table.
  - `app/src/pages/__tests__/PendingResponses.test.tsx` (new) — 5 tests covering empty state, listing, filtering non-waiting, reactive removal via `requestUpdated`, reactive insertion via `newPendingResponse`.
  - `app/src/routes.tsx` — registered `/pending` route (lazy-loaded).
  - `app/src/components/layout/AppSidebar.tsx` — added "Pausadas" nav item with hourglass icon + badge driven by `pendingResponsesCount`.
  - `app/src/components/__tests__/AppSidebar.test.tsx` — updated assertions (3 nav items, badge with count) + new test for badge hidden at count=0.
  - `app/src/hooks/useResponses.ts` — added handler for `requestUpdated` broadcast: removes pending entry when `updates.isWaiting === false`, also clears `currentResponse` if it was the one updated.
- **Learnings:**
  - The `pendingResponsesCount` prop on `AppSidebar` was already plumbed from `Layout.tsx` (`Object.keys(pendingResponses).length`), but no nav item was using it before. The wiring just needed the new "Pausadas" item.
  - `useResponses` is instantiated separately in `Layout.tsx` (for sidebar count) and in any consuming page (CommandCenter, PendingResponses). They sync via background broadcasts + 2s polling — adding `requestUpdated` listener was needed so other-path approvals propagate without waiting for poll.
  - Quality gates: lint, build, test — all green; build emits `PendingResponses-<hash>.js` chunk thanks to lazy import.
  - Existing AppSidebar test expected exactly 2 nav items; updating to 3 is required when adding a new entry.
---

## 2026-04-30 - chrome-extension-debug-buddy-wlr.3 (US-004: Edição one-shot de Response)

- Implemented one-shot edit dialog for paused responses: status (100–599), headers (key/value rows), body (textarea). Submits via new `approveResponseWithEdit` action; background calls `Fetch.fulfillRequest` with edited fields and patches the persisted request with `editedAtRuntime: true`. No fallback to `continueRequest` if fulfill fails — error propagates to UI as toast (regra "no fallbacks").
- Files changed:
  - `app/src/types/intercepted.ts` — added `editedAtRuntime?: boolean` to `InterceptedResponse`.
  - `app/src/types/messages.ts` — added `approveResponseWithEdit` to `MessageAction` union.
  - `app/src/entrypoints/background.ts` — added `approveResponseWithEdit` handler + `applyEditedResponse` helper. Validates required fields, calls `Fetch.fulfillRequest`, then `patchRequest` with edited values + `editedAtRuntime: true` + `isWaiting: false`. Errors propagate via `sendResponse({ success: false, error })`.
  - `app/src/hooks/useResponses.ts` — added `approveResponseWithEdit(requestId, payload)` returning `{ success, error? }`. On success, removes pending entry and clears current response if it matched.
  - `app/src/components/command-center/EditResponseDialog.tsx` (new) — dialog with status/headers/body editors, validation, error/warning toast outputs. Pre-fills from `request.response?.headers ?? request.headers` and `request.response?.body ?? request.body`. Renders explicit aviso when `bodyUnavailableReason` is set (no silent empty body).
  - `app/src/components/command-center/__tests__/EditResponseDialog.test.tsx` (new) — 8 tests: pre-fill, valid submission, error toast (success=false), error toast (exception), status validation blocks submit, Cancel does not submit, Content-Length warning toast, header removal.
  - `app/src/components/requests/columns.tsx` — status/state column now renders an additional `editada` outline badge when `editedAtRuntime === true`, distinguishing one-shot edits from mock-applied modifications. Column size bumped 100 → 140 to fit both badges.
- **Learnings:**
  - The dialog uses `<output>` element instead of `<div role="status">` because Biome's `lint/a11y/useSemanticElements` rule prefers semantic HTML — `RuleSaveToast.tsx` already follows this pattern.
  - `useResponses` hook has an existing dependency-array quirk (`[loadPendingResponses, pendingResponses, currentResponseId, currentResponse]`) that makes `renderHook` tests trigger "Maximum update depth" errors due to polling re-running on every state change. Hook-level tests via `renderHook` are unreliable; the established pattern is page-level tests with `MemoryRouter` (see `PendingResponses.test.tsx`). The dialog test passes a mock `onSubmit` and asserts payload — sufficient for criteria coverage without touching the hook.
  - CDP `Fetch.fulfillRequest` always accepts base64 in the `body` param. `encodeBodyToBase64` (already in `domain/http.ts`) handles UTF-8 via TextEncoder, so we re-encode unconditionally rather than passing text plain — keeps non-ASCII bodies safe.
  - The "no fallbacks" rule mattered in the background handler: temptation was to call `continueRequest` if `Fetch.fulfillRequest` fails so the page doesn't hang. Resisted that — instead, the error is propagated and the UI surfaces it; user can retry or click Ignorar. Hanging request is the correct behavior for surfacing the bug.
  - Validation in the background is defensive: even though the dialog validates status (100–599), we re-check at the message handler boundary (`typeof status !== 'number'`) to avoid bad payloads from breaking `getHttpStatusPhrase`. Matches CLAUDE.md's "no fallbacks" stance — validate then surface error, don't substitute defaults.
---


## 2026-04-30 - chrome-extension-debug-buddy-wlr.4 (US-005: RequestInspector split button)

- Substituí o trio de botões `Criar Mock` / `Aprovar` / `Ignorar` no `RequestInspector` por um split button com hierarquia clara: `Aprovar` primário à esquerda + chevron à direita abrindo dropdown com `Aprovar e editar…` (E) / `Criar Mock` (M) / separador / `Ignorar` (I, destrutivo). Quando `isWaiting=false` o split button é substituído por um indicador read-only `Resolvida`. Badge `Aguardando decisão` (variant `warning`) aparece no header do inspector quando a request está pausada.
- Files changed:
  - `app/src/components/command-center/PendingResponseActions.tsx` (new) — componente compartilhado entre inspector e (futura) tabela `/pending` (US-003). Owns o `EditResponseDialog` localmente (abre via item do dropdown ou hotkey `E`). Hotkeys locais Enter/E/M com guarda contra inputs/textarea/contenteditable; `I` continua a cargo do `usePendingHotkeys` global do CommandCenter.
  - `app/src/components/command-center/__tests__/PendingResponseActions.test.tsx` (new) — 12 testes cobrindo render do split button, indicador `Resolvida`, click no primário, cada item do dropdown, abertura do `EditResponseDialog`, hotkeys (Enter/E/M), supressão em INPUT, estado `disabled`.
  - `app/src/components/command-center/RequestInspector.tsx` — removeu botões inline e usa `PendingResponseActions`. Adicionou badge `Aguardando decisão` no header. `Criar Mock` separado só aparece quando NÃO pendente (caso o usuário queira gerar regra a partir de um histórico já resolvido).
  - `app/src/components/command-center/__tests__/RequestInspector.test.tsx` — atualizou assertions: `Ignorar` não está mais como botão visível; novos testes para o split button, badge `Aguardando decisão`, click no primário, hotkeys (Enter/M).
  - `app/src/pages/CommandCenter.tsx` — passa `approveResponseWithEdit` (já exposto pelo `useResponses` desde US-004) como nova prop `onApproveWithEdit` para o inspector.
- **Learnings:**
  - **Split button via shadcn**: dois `<Button variant="default">` lado a lado, o primeiro com `rounded-r-none` e o segundo (chevron) com `rounded-l-none border-l border-primary-foreground/20 px-2`. O `DropdownMenuTrigger asChild` envolve o segundo botão. Não precisei adicionar nenhum componente novo.
  - **Hotkey scoping**: o listener global `usePendingHotkeys` (em `CommandCenter.tsx`) ainda lida com A/I/J/K. O componente `PendingResponseActions` adiciona seu próprio listener para Enter/E/M. Não há conflito porque as teclas são diferentes; `I` é mostrado apenas como `<Kbd>` no item do dropdown (documentação) — o handler real é o global. Isso evita dupla execução do `onIgnore`.
  - **Radix DropdownMenu em jsdom**: o pointer-events do Radix não funciona no jsdom, então no teste eu mocko o módulo `@/components/ui/dropdown-menu` e substituo `DropdownMenuItem` por um `<button onClick={() => onSelect?.({preventDefault:()=>{}})}>` simples. Padrão que o `AppSidebar.test.tsx` já usava.
  - **Biome `noConfusingVoidType`**: `(x) => void | Promise<unknown>` em union dispara essa rule. Usei `(x) => unknown` que cobre os dois casos (sync void + async).
  - **Prop drilling de `onApproveWithEdit`**: já existia desde US-004 no `useResponses`; só precisei adicionar no contrato do `RequestInspector` e propagar no `CommandCenter`. Outros consumidores do `RequestInspector` (não há) precisariam atualizar.
---

## 2026-04-30 - chrome-extension-debug-buddy-wlr.2 (US-002: Banner "Ver pausadas")

- Adicionado terceiro botão `Ver pausadas (N)` ao `PendingAlertBanner` ao lado de Ignorar/Aprovar. Click navega para `/pending` via `useNavigate()` no `CommandCenter`. Ordem dos botões agora: Ver pausadas → Ignorar todos → Aprovar próximo (ação primária à direita, mantendo hierarquia).
- Files changed:
  - `app/src/components/command-center/PendingAlertBanner.tsx` — nova prop obrigatória `onViewPending: () => void`; render do botão `outline` com a contagem entre parênteses.
  - `app/src/pages/CommandCenter.tsx` — passa `onViewPending={() => navigate('/pending')}` para o banner.
  - `app/src/components/command-center/__tests__/PendingAlertBanner.test.tsx` (novo) — 8 testes: não renderiza com count=0, singular vs plural, contagem nos parênteses, atualização reativa do count, ordem dos botões, click chama cada handler isoladamente.
- **Learnings:**
  - O ícone `list` não está registrado no wrapper `LucideIcon` (`app/src/components/ui/lucide-icon.tsx` mantém um allowlist explícito). Para evitar inflar o bundle, deixei o botão sem ícone — o texto + contagem já é suficiente como CTA secundário. Se um ícone for desejado no futuro, adicionar primeiro ao mapa `ICONS` daquele arquivo.
  - O Biome formatter exige `expect(...).toBeInTheDocument()` em uma única linha quando o argumento cabe no `lineWidth: 100` — não quebrar manualmente em múltiplas linhas. Lint catch idêntico ao que já vi no histórico desse projeto.
---

## 2026-04-30 - chrome-extension-debug-buddy-wlr.5 (US-003: Ações inline na tabela /pending)

- Tabela `/pending` agora tem split button por linha (reuso de `PendingResponseActions`) + botão de Inspecionar (ícone lupa) que abre o `RequestInspector` em um `Sheet` lateral sem navegar para fora. Cada linha opera por seu próprio `requestId` (sem dependência de "request selecionada" global). "Aprovar e editar" reaproveita o `EditResponseDialog`; "Criar Mock" abre o `QuickMockPanel` no contexto da linha.
- Files changed:
  - `app/src/pages/PendingResponses.tsx` — substituiu botões inline simples por `PendingResponseActions size="sm" hotkeysEnabled={false}` + ícone Inspecionar. Adicionou estados `inspectingId` e `quickMockTarget`. Sheet (radix) com `RequestInspector` dentro; `useEffect` auto-fecha o sheet quando a request inspecionada deixa de estar pausada.
  - `app/src/pages/__tests__/PendingResponses.test.tsx` — +7 testes (12 totais): Aprovar dispara `approveResponse` com `modifications: {}`, Ignorar dispara `approveResponse` sem `modifications`, Aprovar e editar abre dialog, submit do dialog dispara `approveResponseWithEdit`, Inspecionar abre o sheet, Criar Mock abre `QuickMockPanel`, ações são por `requestId` (não dependem de seleção global). Adicionou mock do `@/components/ui/dropdown-menu` (mesmo padrão do `PendingResponseActions.test.tsx`) e do `chrome.storage.local.get` (necessário pelo `useRules`).
- **Learnings:**
  - **Sheet padrão do shadcn é estreito**: o `sheetVariants` para `side="right"` traz `w-3/4 sm:max-w-sm`, o que é desconfortável para o inspector que tem 3 abas (Overview/Request/Response). Override com `className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"` no `SheetContent` dá espaço suficiente sem precisar mexer no componente vendorizado.
  - **Hotkeys multi-instância**: ter o `PendingResponseActions` em N linhas + 1 dentro do sheet poderia gerar dispatches duplicados se todos tivessem `hotkeysEnabled` true. Solução: mantemos `hotkeysEnabled={false}` em todas as linhas da tabela (o usuário interage com o mouse) e deixamos hotkeys apenas no inspector quando aberto. Não houve necessidade de adicionar onChange handlers no Sheet — o componente do inspector dentro já lida com seus próprios atalhos via `PendingResponseActions hotkeysEnabled`.
  - **Auto-fechamento do sheet**: quando a request é aprovada/ignorada (pelo split button da própria linha ou pelo broadcast `requestUpdated`), `pendingResponses[inspectingId]` vira undefined. Sem o `useEffect` que limpa `inspectingId`, o sheet fica aberto mostrando estado obsoleto. O cleanup é reativo e elimina a corrida entre o submit no inspector e o fechamento do sheet.
  - **Test coverage do `requestId` por linha**: o teste "cada linha tem seu próprio split button" usa `getAllByTestId('pending-actions-approve')` para validar que existem 2 botões e que clicar no segundo dispara a action com o `requestId` correspondente (`req2`, não `req1`). Isso cobre o critério "ações operam sobre o requestId da linha" sem depender de inspeção visual.
  - **Mock de `chrome.storage.local.get` é necessário** quando um teste de página renderiza componentes que indiretamente usam `useRules` (ex.: `RequestInspector` precisa de `rules`, `QuickMockPanel` chama `addRule` que primeiro lê via `useRules`). Sem o mock, o `loadRules` cai no `catch` e loga erro, mas não quebra o teste — adicionar o mock evita ruído no output e cobre o caminho feliz.
---
