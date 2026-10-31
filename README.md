# Debug Buddy

[Português (Brasil)](README.pt-BR.md)

Debug Buddy is a Manifest V3 Chrome extension that intercepts, modifies, mocks,
and pauses the HTTP traffic of a browser tab, so you can see how your web app
behaves when an API fails, slows down, or changes its contract — without
touching the backend, the frontend code, or the environment.

It drives the Chrome DevTools Protocol (`Fetch` and `Network` domains) through
`chrome.debugger`, so it works with any page, framework, or HTTP client.

![Command Center showing intercepted traffic: a blocked checkout, a mocked cart, a delayed orders call, a transformed product list, and real 404/500 responses](docs/images/command-center.png)

> The UI is currently in Portuguese (pt-BR). Screen and button names below are
> written as **pt-BR label** (English meaning). i18n is tracked in
> [#3](https://github.com/guichafy/chrome-extension-debug-buddy/issues/3).

## What it is for

Use Debug Buddy to reproduce, on demand, situations that are hard to get from
a real backend:

- an endpoint returns `500`, `503`, `404`, `401`, or any other status;
- a request takes seconds longer than usual;
- the body differs from the expected contract (missing field, wrong type, zeroed value);
- a request never reaches the server (connection refused, aborted, offline);
- a header must be injected or removed (auth token, feature flag);
- an API does not exist yet and needs a mock during development;
- you need to pause a request, look at it, and decide what happens next.

## Quick start

This repository does not link a public Chrome Web Store listing yet, so install
from source:

```bash
cd app
npm install
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `app/dist/` folder.
3. Click the Debug Buddy toolbar icon. The UI opens in a dedicated tab; it is
   also available docked in Chrome's Side Panel.
4. In the header, pick the **target tab** — the web app you want to debug.
5. Click **Iniciar Análise** (Start analysis). Chrome shows a
   "started debugging this browser" bar on the target tab; that is expected.
6. Use the app normally and follow the traffic in **Command Center**.
7. Click **Parar Análise** (Stop analysis) when you are done. Any
   request still paused is released before the debugger detaches.

## Feature tour

### Command Center — live traffic

Every request from the target tab shows up in one table with its interception
type (pass-through, mock, modified, transform, delay, block, breakpoint),
duration, size, method, URL, and status. The header shows live metrics
(requests, bytes transferred, resources) and the filter bar accepts `method:`,
`status:`, `state:`, or free text. History is persisted in IndexedDB, so it
survives closing the UI.

Click a row to open the **inspector** with Overview, Request, and Response
tabs, plus a **Modificações** (Modifications) tab whenever a rule rewrote the
request or response. **Criar regra** (Create rule) turns a real capture into a
pre-filled rule.

![Request inspector open on a mocked request](docs/images/request-inspector.png)

### Breakpoints — pause, inspect, decide

A `breakpoint` action holds the request — before it is sent or after the
server replied — until you act. The pending dock lets you **Aprovar**
(Approve), **Editar…** (Edit status, headers, and body before releasing),
**Criar Mock** (Create mock), or ignore it. Keyboard shortcuts: <kbd>A</kbd>
approve, <kbd>I</kbd> ignore, <kbd>J</kbd>/<kbd>K</kbd> next/previous.

![Pending action dock with a paused request to /api/inventory](docs/images/pending-breakpoint.png)

### Rules Lab — interception rules

Rules are ordered by priority (drag, or <kbd>Ctrl/Cmd</kbd> + <kbd>↑/↓</kbd>),
can be paused one by one, and can be filtered by type and HTTP method. Each
rule matches on URL (substring or regex), method, header, and body, and runs
an ordered **chain of actions** at one stage:

| Stage | Runs | Actions |
|---|---|---|
| `request` | before the request leaves the browser | `requestModify`, `requestDelay`, `mock`, `block`, `breakpoint` |
| `response` | after the server replied | `responseModify`, `transform`, `mock`, `breakpoint` |

`mock`, `block`, and `breakpoint` are **terminal**: they end the chain, so they
must be the last action. Rules can be exported and imported as JSON; imports
are validated against these invariants.

![Rules Lab listing request and response stage rules](docs/images/rules-lab.png)

The rule editor walks through **Tipo** (type and stage), **Matcher**,
**Ação** (actions), and **Revisar** (review):

![Rule editor on the actions step, editing request headers](docs/images/rule-editor.png)

#### Rule example

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "name": "Inject auth header and mock /api/users",
  "enabled": true,
  "stage": "request",
  "matchers": [
    { "type": "url", "enabled": true, "pattern": "/api/users", "isRegex": false }
  ],
  "actions": [
    {
      "type": "requestModify",
      "enabled": true,
      "addHeaders": { "Authorization": "Bearer test-token" }
    },
    {
      "type": "mock",
      "enabled": true,
      "status": 200,
      "headers": { "Content-Type": "application/json" },
      "body": "{\"users\":[]}"
    }
  ],
  "createdAt": 1715000000000,
  "updatedAt": 1715000000000
}
```

`requestModify` rewrites the headers, then the terminal `mock` answers without
hitting the network. To act on what the server sent back (force a `503`, patch
a JSON field with `transform`), use `"stage": "response"`.

### Sessões — Session Replay

While interception is on, Debug Buddy records the target tab with
[rrweb](https://github.com/rrweb-io/rrweb) (up to 50 MB or 10 minutes per
session; the **Gravação** (Recording) switch in the header turns it off). The
replay page plays the DOM back next to a timeline of network calls, console
errors, and navigations, a **Requisições** (Requests) tab, and
**Recomendações** (Recommendations). Sessions can be exported and imported as
`.dbsession` files; importing one recorded on a different origin asks for
confirmation first.

![Session replay of the demo store with the network and console timeline](docs/images/session-replay.png)

The activity icon next to the recording switch opens **Live Insights**: the
technologies detected on the target page and recommendations, updated while
you navigate.

### Privacidade — redaction

The **Privacidade** (Privacy) page controls what is masked before data is
stored: header names and value patterns, body patterns, console output, all
form inputs or chosen CSS selectors in the DOM recording, domains that must
never be recorded, user paths in stack traces, and automatic purge after N
days.

## How it works

1. The UI (tab or Side Panel) sends commands to the background service worker,
   which owns all runtime state.
2. On **Iniciar Análise**, the worker calls `chrome.debugger.attach` on
   the target tab and enables `Network` (timing) and `Fetch` with two intercept
   patterns: the `Request` stage and the `Response` stage.
3. Each `Fetch.requestPaused` event runs the matching rules for that stage and
   is then continued, fulfilled (mock), failed (block), or held (breakpoint).
4. Every request is written to IndexedDB and pushed to the UI; durations arrive
   later from `Network` events and are merged in.
5. **Parar Análise** releases anything still paused and detaches the
   debugger.

Rules live in `chrome.storage.local`; requests and sessions live in IndexedDB.
Everything stays in your browser profile. The only requests the extension
makes on its own are fetches of `.map` source maps next to the inspected
page's scripts, used to symbolicate stack traces.

## Permissions

| Permission | Why |
|---|---|
| `debugger` | Attach to the target tab and control its network through the DevTools Protocol. |
| `tabs` | List tabs so you can choose the target, and open the UI. |
| `storage` | Save rules, the target tab, and preferences. |
| `sidePanel` | Offer the UI docked in Chrome's Side Panel. |
| `offscreen` | Host the sandbox that runs advanced (script-based) transforms, which a service worker cannot do. |
| `scripting` | Inject the probe and recorder into tabs that were already open before the extension was installed or updated. |
| `webNavigation` | Detect navigations in the target tab to refresh technology detection. |
| `host_permissions: <all_urls>` | Required by `scripting` injection, and to work with whatever app you debug. |

The manifest also declares three content scripts on all URLs at
`document_start`: a probe in the page's `MAIN` world, a bridge in the isolated
world, and the rrweb recorder. They stay idle until interception or recording
is turned on for that tab. Once activated, the probe wraps `history.pushState`/
`replaceState` and `XMLHttpRequest` in that page, and those wrappers remain
until the page reloads.

## Limitations

- Only the selected target tab is intercepted.
- Chrome shows a warning bar while the debugger is attached to the tab.
- Some responses have no body available through the CDP.
- A paused request blocks the page until it is approved, edited, mocked, or
  ignored.
- The UI is Portuguese-only for now ([#3](https://github.com/guichafy/chrome-extension-debug-buddy/issues/3)).

## Development

All commands run from `app/`.

```bash
npm run watch             # rebuild dist/ on save (then reload the extension)
npm run watch:dev         # same, with a development bundle for React DevTools
npm run lint              # Biome
npm run typecheck         # tsc --noEmit
npm test                  # Vitest (jsdom)
npm run e2e               # Playwright against dist/ (run npm run build first)
npm run docs:screenshots  # regenerate docs/images/ and the store assets in docs/store/
```

Stack: Manifest V3, Chrome Debugger API / DevTools Protocol, React 19,
React Router, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, IndexedDB, rrweb,
Vitest, Playwright, Biome.

Architecture notes and conventions live in [`CLAUDE.md`](CLAUDE.md). Releases
are automated with semantic-release and uploaded to the Chrome Web Store as a
draft — see [`app/RELEASING.md`](app/RELEASING.md).

## License

[MIT](LICENSE).
