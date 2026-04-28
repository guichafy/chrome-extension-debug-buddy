# Debug Buddy

Debug Buddy is a Manifest V3 Chrome Extension for developers who need to inspect
requests/responses, intercept HTTP responses, and change network behavior
directly in the browser.

Using the Chrome Debugger API and the `Fetch` domain from the Chrome DevTools
Protocol, the extension pauses network responses, displays the captured content,
and lets you change what the application receives to simulate failure scenarios
without changing the backend, frontend, or environment infrastructure.

## What it is for

Debug Buddy helps you test how an application behaves when an API:

- returns a `500`, `404`, `401`, or any other HTTP status;
- takes longer than expected to respond;
- returns a body that differs from the expected contract;
- changes headers or content-type;
- becomes unavailable during a critical flow;
- needs to be mocked during development.

Instead of editing server code, creating local proxies, or depending on hard to
reproduce states, you choose a Chrome tab, start interception, and control the
responses received by the application.

## Features

- Target tab selection for the application being debugged.
- Response interception through `chrome.debugger` and the Chrome DevTools
  Protocol.
- Rules with URL, HTTP method, header, and body matching.
- Mock actions that respond with custom status, headers, body, content-type, and
  latency.
- Response pause for inspection before continuing navigation.
- Status, headers, and body editing before releasing an intercepted response.
- Request history for observed, intercepted, mocked, pending, and failed
  captures.
- Mock creation from real captured responses.
- Dedicated tab UI and Chrome Side Panel support.
- Local persistence for rules and history through `chrome.storage.local` and
  IndexedDB.

## How it works

1. The Debug Buddy UI opens in a dedicated tab or in the Side Panel.
2. You choose the target tab, which is the web application being debugged.
3. When interception starts, the extension attaches the debugger to the target
   tab.
4. The background service worker enables the `Network` and `Fetch` domains.
5. Each response can be observed, paused, mocked, or modified according to the
   configured rules.
6. The history remains available in the UI for analysis and new mock creation.

The Chrome debugging warning shown on the target tab is expected: it appears
because the extension uses the `debugger` permission.

## How to use

1. Install and load the extension in developer mode.
2. Click the Debug Buddy icon in the Chrome toolbar.
3. Select the application tab you want to debug.
4. Create interception rules in **Configurações** (Settings).
5. Click **Iniciar Interceptação** (Start Interception).
6. Navigate through the target application and follow requests in **Histórico**
   (History).
7. When a response is waiting for action, inspect it, edit it, approve it,
   ignore it, or turn it into a mock.
8. Click **Parar Interceptação** (Stop Interception) when you are done.

## Local development

Project commands run from the `app/` folder.

```bash
cd app
npm install
npm run build
```

After the build:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `app/dist/` folder.

During development, use watch mode to rebuild the extension when files change:

```bash
cd app
npm run watch
```

## Useful scripts

```bash
cd app
npm run dev
npm run build
npm run watch
npm run lint
npm run lint:fix
npm run format
npm run typecheck
npm test
npm run test:coverage
```

## Stack

- Chrome Extension Manifest V3
- Chrome Debugger API
- Chrome DevTools Protocol (`Fetch` and `Network`)
- React 19
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- IndexedDB
- Vitest
- Biome

## Permissions

The extension requests the permissions it needs to work as a debugging tool:

- `debugger`: attach the Chrome Debugger to the target tab and control the
  network flow.
- `tabs`: list and select the tab being debugged.
- `storage`: save rules, target tab information, and local preferences.
- `sidePanel`: make the UI available in the Chrome Side Panel.
- `<all_urls>`: allow interception for applications and APIs accessed by the
  target tab.

## Limitations

- Interception only happens in the selected target tab.
- Chrome shows a warning while the debugger is attached to the tab.
- Some responses may not have a body available for capture through the CDP.
- Pending requests must be released, mocked, or continued so the page does not
  wait indefinitely.

## Releasing

See [`app/RELEASING.md`](app/RELEASING.md) for the release flow (release-please + Chrome Web Store).

## License

MIT

## Translations

- [Português (Brasil)](README.pt-BR.md)
