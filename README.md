# Debug Buddy

[Português (Brasil)](README.pt-BR.md)

Debug Buddy is a Manifest V3 Chrome extension that intercepts, modifies, mocks,
and pauses the HTTP traffic of a browser tab, so you can see how your web app
behaves when an API fails, slows down, or changes its contract — without
touching the backend, the frontend code, or the environment.

It drives the Chrome DevTools Protocol (`Fetch` and `Network` domains) through
`chrome.debugger`, so it works with any page, framework, or HTTP client.

![Command Center showing intercepted traffic: a blocked checkout, a mocked cart, a delayed orders call, a transformed product list, and real 404/500 responses](docs/images/command-center.png)

> The UI is available in English and Portuguese (Brazil). It follows Chrome's
> language and can be switched at any time from the sidebar footer. The
> screenshots below still show the Portuguese UI.

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
   also available docked in Chrome's Side Panel. To change the language, use
   the selector in the sidebar footer.
4. In the header, pick the **target tab** — the web app you want to debug.
5. Click **Start Analysis**. Chrome shows a
   "started debugging this browser" bar on the target tab; that is expected.
6. Use the app normally and follow the traffic in **Command Center**.
7. Click **Stop Analysis** when you are done. Any
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
tabs, plus a **Modifications** tab whenever a rule rewrote the request or
response. **Create rule** turns a real capture into a pre-filled rule.

![Request inspector open on a mocked request](docs/images/request-inspector.png)

### Breakpoints — pause, inspect, decide

A `breakpoint` action holds the request — before it is sent or after the
server replied — until you act. The pending dock lets you **Approve**,
**Edit…** (change status, headers, and body before releasing), **Create
Mock**, or ignore it. Keyboard shortcuts: <kbd>A</kbd> approve, <kbd>I</kbd>
ignore, <kbd>J</kbd>/<kbd>K</kbd> next/previous.

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

The rule editor walks through **Type** (type and stage), **Matcher**,
**Action** (the action chain), and **Review**:

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

### Sessions — Session Replay

While interception is on, Debug Buddy records the target tab with
[rrweb](https://github.com/rrweb-io/rrweb) (up to 50 MB or 10 minutes per
session; the **Recording** switch in the header turns it off). The replay page
plays the DOM back next to a timeline of network calls, console errors, and
navigations, a **Requests** tab, and **Recommendations**. Sessions can be
exported and imported as
`.dbsession` files; importing one recorded on a different origin asks for
confirmation first.

![Session replay of the demo store with the network and console timeline](docs/images/session-replay.png)

The activity icon next to the recording switch opens **Live Insights**: the
technologies detected on the target page and recommendations, updated while
you navigate.

### Privacy — redaction

The **Privacy** page controls what is masked before data is
stored: header names and value patterns, body patterns, console output, all
form inputs or chosen CSS selectors in the DOM recording, domains that must
never be recorded, user paths in stack traces, and automatic purge after N
days.

## How it works

1. The UI (tab or Side Panel) sends commands to the background service worker,
   which owns all runtime state.
2. On **Start Analysis**, the worker calls `chrome.debugger.attach` on
   the target tab and enables `Network` (timing) and `Fetch` with two intercept
   patterns: the `Request` stage and the `Response` stage.
3. Each `Fetch.requestPaused` event runs the matching rules for that stage and
   is then continued, fulfilled (mock), failed (block), or held (breakpoint).
4. Every request is written to IndexedDB and pushed to the UI; durations arrive
   later from `Network` events and are merged in.
5. **Stop Analysis** releases anything still paused and detaches the
   debugger.

Rules live in `chrome.storage.local`; requests and sessions live in IndexedDB.
Everything stays in your browser profile. The only requests the extension
makes on its own are fetches of `.map` source maps next to the inspected
page's scripts, used to symbolicate stack traces.

## Permissions

| Permission | Why |
|---|---|
| `debugger` | Attach to the target tab and control its network through the DevTools Protocol. |
| `storage` | Save rules, the target tab, and preferences. |
| `sidePanel` | Offer the UI docked in Chrome's Side Panel. |
| `offscreen` | Host the sandbox that runs advanced (script-based) transforms, which a service worker cannot do. |
| `scripting` | Inject the probe and recorder into tabs that were already open before the extension was installed or updated. |
| `host_permissions: <all_urls>` | Required by `scripting` injection, to read the title and URL of the tabs you can pick as the target, and to work with whatever app you debug. |

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
- Texts generated by the service worker (recommendation summaries, capture
  errors, and error messages it returns) and the exported `viewer.html` are
  still in Portuguese.

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

### Internationalization (i18n)

The UI uses [i18next](https://www.i18next.com/) with
[react-i18next](https://react.i18next.com/), only in the extension pages
(options tab and Side Panel). Everything lives in `app/src/i18n/`:

| Path | Role |
|---|---|
| `languages.ts` | Supported languages, their native names, and how the language is picked: saved choice → Chrome UI language → English. |
| `locales/pt-BR/<namespace>.ts` | Source catalog. It defines every namespace and key. |
| `locales/<lang>/<namespace>.ts` | Translations, typed against the pt-BR catalog. |
| `ui.ts` | Page bootstrap: reads the preference, loads only that language's chunk, and keeps the tab and the Side Panel in sync. |
| `instance.ts` | The i18next instance and its options. |

The choice is saved in `chrome.storage.local` (`uiLanguage`).

**Adding a translatable text**

1. Add the key to the pt-BR file of the right namespace (`locales/pt-BR/commandCenter.ts`,
   `locales/pt-BR/ruleEditor.ts`, …), then the same key in every other
   language. `npm run typecheck` fails while a language is missing a key or has
   one too many.
2. In a component, use `const { t } = useTranslation('<namespace>')` and
   `t('section.key')`. Keys are type-checked.
3. Interpolation uses `{{name}}`. For text with markup, put named tags in the
   string (`'Click <strong>{{label}}</strong>'`) and render it with
   `<Trans t={t} i18nKey="…" components={{ strong: <strong /> }} />`.
4. Plurals use i18next suffixes and are driven by `count`: `_one`/`_other`
   in English, `_one`/`_many`/`_other` in Portuguese. `_zero` is optional in
   any language, for example to keep "0 abas", since Portuguese treats 0 as
   singular.
5. Keys are camelCase without `_` (the underscore is reserved for plural
   suffixes).
6. Outside components, in code used only by the UI, call `i18n.t(...)` from
   `@/i18n/instance`. Never import i18n in code reachable from the service
   worker or the content scripts: MV3 service workers cannot lazy-load the
   catalogs. `npm run lint:ext` fails the build if the i18next runtime shows up
   there.

There is no fallback language. A missing key renders as `namespace:key` and is
logged; in Vitest it throws. `src/i18n/__tests__/catalogParity.test.ts` also
checks plural forms, interpolation variables, component tags, and empty
strings.

**Adding a language** (for example `es`)

1. Copy `app/src/i18n/locales/en/` to `app/src/i18n/locales/es/` and translate
   the values.
2. Add `'es'` to `SUPPORTED_LANGUAGES` and its native name to
   `LANGUAGE_NATIVE_NAMES` in `languages.ts`.
3. Run `npm run typecheck`. It points at the remaining places to register the
   catalog: the lazy loader in `ui.ts`, the test setup in `testing.ts`, and the
   parity test.
4. Run `npm test`; the parity test lists missing plural forms for the new
   language.

Vitest starts every test file in pt-BR (the existing tests assert Portuguese
texts). The Playwright suites pin pt-BR through `chrome.storage.local` before
opening the extension, because Playwright emulates `en-US` in its pages;
`launchExtensionContext({ uiLanguage: 'en' })` opens them in English.

Architecture notes and conventions live in [`CLAUDE.md`](CLAUDE.md). Releases
are automated with semantic-release and uploaded to the Chrome Web Store as a
draft — see [`app/RELEASING.md`](app/RELEASING.md).

## License

[GPL-3.0](LICENSE). The technology detection catalog in
`app/src/lib/insights/catalog/` is derived from
[webappanalyzer](https://github.com/enthec/webappanalyzer) (GPL-3.0). See
[NOTICE](NOTICE) for details.
