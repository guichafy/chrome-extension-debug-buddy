# Testes E2E — Golden Path com Playwright

**Data:** 2026-05-02
**Status:** Aprovado para implementação
**Issue tracker:** beads (epic + filhos a criar pelo plano)

## Contexto

Hoje a cobertura de testes do Debug Buddy é 100% unitária (`vitest` + `jsdom`) — útil para módulos puros (`domain/`, `lib/networkTiming`, helpers de UI), mas **não exercita o pipeline real** que é o coração do produto: `chrome.debugger.attach` → `Fetch.enable` → `Fetch.requestPaused` → aplicar mock → `Fetch.fulfillRequest` → persistir em IndexedDB → renderizar no histórico.

Sem teste integrado real, qualquer refator no `background.ts`, na separação de duas abas, ou na correlação `Fetch`/`Network` da `NetworkTimingTracker` depende de teste manual antes de cada release. Não é uma rede de segurança que escale.

## Objetivo

Estabelecer uma suite E2E rodando Chromium real com a extensão carregada (`--load-extension=app/dist`), pilotada por Playwright, cobrindo **um único cenário Golden Path** que valida o pipeline ponta-a-ponta. A suite roda em todo PR para `main` no GitHub Actions, bloqueia merge em caso de falha, e produz traces/screenshots como artefato em falhas.

Este spec cobre **só o Golden Path**. Outros tipos de regra (`delay`, `transform`, `breakpoint`), criação de regra via UI, side panel, persistência cross-reload e migração legacy ficam como issues de follow-up (seção "Não escopo").

## Decisões de design (acordadas com o usuário)

1. **Escopo: apenas Golden Path** — um cenário só, focado em validar que o pipeline de interceptação funciona ponta-a-ponta. Mais cobertura vem em iterações futuras.
2. **Página alvo: servidor de fixture local** — Express embutido em `:3100` servindo HTML estático e endpoint JSON determinístico. Sem dependência de rede pública, sem flakiness.
3. **Ferramenta: Playwright (`@playwright/test`)** — `chromium.launchPersistentContext` com `--load-extension`, suporte oficial a MV3, trace viewer pra debug de falhas em CI.
4. **CI: bloqueante em todo PR para `main`** — suite alvo deve rodar em <90s. Se ficar lenta/flaky no futuro, migra pra check não bloqueante.
5. **Regra do Golden Path: seedada via `chrome.storage.local`**, não criada pela UI. Justificativa: o Golden Path valida o pipeline de interceptação, não a UI de criação de regras (que terá seu próprio E2E depois). Mantém o cenário focado e curto.
6. **Convivência com vitest**: testes E2E vivem em `app/e2e/`, fora do `testDir` do vitest. Runner próprio (`npx playwright test`), sem interferência mútua.

## Arquitetura

### 1. Estrutura de arquivos

```
app/
  e2e/
    fixtures/
      target.html              # página alvo: chama fetch('/api/users') no load, renderiza JSON em #users-data
      server.ts                # Express: serve target.html + GET /api/users → JSON real
    helpers/
      extension.ts             # launchExtensionContext() + getExtensionId()
      seed.ts                  # seedRules(context, rules[]) escrevendo em chrome.storage.local
      global-setup.ts          # valida que app/dist/ existe e tem manifest válido
    tests/
      golden-path.spec.ts      # único spec por enquanto
    tsconfig.json              # extends do tsconfig raiz, adiciona types do Playwright
  playwright.config.ts         # config do runner E2E
```

### 2. Servidor de fixture (`e2e/fixtures/server.ts`)

Express mínimo:

- `GET /target.html` → serve `e2e/fixtures/target.html`
- `GET /api/users` → responde `200 { users: [{ id: 1, name: 'real-user' }] }` com `Content-Type: application/json`
- Porta fixa `3100` (alta o suficiente pra evitar colisão com dev servers comuns)
- Logs silenciosos por padrão; `DEBUG_E2E=1` ativa log de cada request

Roda como `webServer` do Playwright (start automático antes dos testes, stop no teardown). Em local, `reuseExistingServer: true` permite manter o server rodando entre execuções.

### 3. Página alvo (`e2e/fixtures/target.html`)

HTML mínimo:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>E2E Target</title></head>
<body>
  <h1>E2E Target Page</h1>
  <pre id="users-data">loading...</pre>
  <script>
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { document.getElementById('users-data').textContent = JSON.stringify(data); })
      .catch(err => { document.getElementById('users-data').textContent = 'ERROR: ' + err.message; });
  </script>
</body>
</html>
```

Sem framework, sem build — HTML estático servido diretamente. Faz um `fetch('/api/users')` no load e renderiza o body em `#users-data` (JSON literal). Esse `<pre>` é o ponto de assert: se o body contém `mocked-user`, o mock foi aplicado; se contém `real-user`, passou direto.

### 4. Helper de extensão (`e2e/helpers/extension.ts`)

Duas funções principais:

```ts
export async function launchExtensionContext(): Promise<BrowserContext> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-buddy-e2e-'));
  const extensionPath = path.resolve(__dirname, '../../dist');
  return chromium.launchPersistentContext(userDataDir, {
    headless: true, // Chromium novo (--headless=new) suporta extensões
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
    ],
  });
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  // Extensão MV3 expõe um service worker target. URL é chrome-extension://<id>/...
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker');
  }
  const match = sw.url().match(/chrome-extension:\/\/([a-z]+)\//);
  if (!match) throw new Error(`Service worker URL inesperado: ${sw.url()}`);
  return match[1];
}
```

`launchExtensionContext` cria um profile em `os.tmpdir()` que é descartado no teardown do contexto. `getExtensionId` resolve o ID dinâmico aguardando o service worker target — não dá pra hardcodar.

### 5. Seed de regras (`e2e/helpers/seed.ts`)

Em vez de pilotar a UI de criação de regra (fora de escopo do Golden Path), escreve direto em `chrome.storage.local`:

```ts
export async function seedRules(context: BrowserContext, rules: Rule[]) {
  const sw = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await sw.evaluate(async (rulesToSeed) => {
    await chrome.storage.local.set({ rules: rulesToSeed });
  }, rules);
}
```

O background reage a `chrome.storage.onChanged` e atualiza seu cache em memória — sem reload da extensão.

### 6. Cenário Golden Path (`e2e/tests/golden-path.spec.ts`)

Sequência única, falha em qualquer ponto = teste vermelho:

```ts
test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
  // 1. Lançar contexto com extensão
  const context = await launchExtensionContext();
  const extId = await getExtensionId(context);

  // 2. Seedar regra de mock para /api/users
  const now = Date.now();
  await seedRules(context, [{
    id: 'e2e-rule-1',
    name: 'E2E mock users',
    enabled: true,
    matchers: [
      { type: 'url', enabled: true, pattern: '/api/users', isRegex: false },
      { type: 'method', enabled: true, method: 'GET' },
    ],
    action: {
      type: 'mock',
      enabled: true,
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: [{ id: 1, name: 'mocked-user' }] }),
    },
    createdAt: now,
    updatedAt: now,
  }]);

  // 3. Abrir aba alvo (request inicial vai sem interceptação — ainda não startou debugging)
  const targetPage = await context.newPage();
  await targetPage.goto('http://localhost:3100/target.html');
  await expect(targetPage.locator('#users-data')).toContainText('real-user');

  // 4. Abrir options page
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extId}/options.html`);

  // 5. Selecionar aba alvo + Start Debugging
  await optionsPage.getByRole('button', { name: /selecionar aba/i }).click();
  await optionsPage.getByRole('option', { name: /target\.html/i }).click();
  await optionsPage.getByRole('button', { name: /start debugging|iniciar/i }).click();
  await expect(optionsPage.getByText(/depurando|ativo/i)).toBeVisible();

  // 6. Recarregar aba alvo — fetch passa pelo Fetch.requestPaused e é mockado
  await targetPage.reload();

  // 7. Assert A — body renderizado é o mockado
  await expect(targetPage.locator('#users-data')).toContainText('mocked-user');

  // 8. Assert B — request aparece no histórico (IndexedDB renderizado pela UI)
  await optionsPage.goto(`chrome-extension://${extId}/options.html#/request-history`);
  await expect(optionsPage.getByRole('row', { name: /\/api\/users/ })).toBeVisible();

  await context.close();
});
```

Notas sobre seletores:

- `getByRole` com regex case-insensitive (`/iniciar/i`, `/depurando/i`) reduz acoplamento ao texto exato. Quando a issue #3 (i18n PT/EN) chegar, helpers centralizam labels.
- O texto exato dos botões/estados será verificado no plano de implementação contra o código atual de `Layout.tsx`/`SelectTabDialog`/header — esses regexes são placeholders alinhados ao que CLAUDE.md descreve, e podem precisar ajuste fino na fase de implementação.

### 7. Configuração Playwright (`app/playwright.config.ts`)

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  globalSetup: './e2e/helpers/global-setup.ts',
  webServer: {
    command: 'tsx e2e/fixtures/server.ts',
    port: 3100,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
```

`globalSetup` valida que `app/dist/manifest.json` existe e tem o nome `Debug Buddy`. Se não existir, falha imediatamente com mensagem clara pedindo `npm run build`. Em CI, o workflow roda `npm run build` antes de `npx playwright test`, então o setup é só uma checagem defensiva.

### 8. Workflow CI (`.github/workflows/e2e.yml`)

```yaml
name: E2E

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            app/playwright-report/
            app/test-results/
          retention-days: 7
```

Branch protection: o usuário deve adicionar manualmente o check `e2e` aos required status checks de `main` (passo manual documentado no plano, fora do controle de código).

### 9. Scripts em `app/package.json`

Adicionar:

- `"e2e": "playwright test"`
- `"e2e:headed": "playwright test --headed"` — pra debug local com janela visível
- `"e2e:ui": "playwright test --ui"` — modo interativo do Playwright

## Riscos e mitigações

- **Extension ID em headless**: resolvido via service worker target (`context.serviceWorkers()[0].url()`). Padrão documentado pelo Playwright, funciona com `--headless=new`.
- **Banner do `chrome.debugger`**: invisível em headless; em headed aparece junto com o banner de "controlado por software automatizado". Nenhum impacto em assertions.
- **Timing assíncrono de `Fetch.requestPaused`**: usar `expect(...).toContainText(...)` (auto-retry built-in do Playwright) em vez de `waitForTimeout`. `retries: 2` no CI absorve flakiness residual.
- **Drift de seletores em pt-BR**: regexes case-insensitive minimizam acoplamento; quando i18n da issue #3 chegar, helpers centralizam labels.
- **`dist/` desatualizado localmente**: `globalSetup` valida que existe; CI sempre roda build antes do teste. Em local, dev sabe rodar `npm run build` ou `npm run watch`.
- **Profile dir poluindo `/tmp`**: `await context.close()` libera o profile; CI usa runner descartável a cada job. Local é limpo pelo SO em reboot.
- **`chrome.debugger.attach` competindo com CDP do Playwright**: Playwright e `chrome.debugger` usam debuggees diferentes (browser-level vs tab-level com identificadores próprios); coexistem na prática. Será verificado na primeira execução; se houver conflito real, o plano deve incluir abordagem alternativa (target page em browser separado).
- **Suite vira flaky e atrasa PRs**: começar com 1 cenário curto; se rodar em <90s consistente, ok. Se flakiness aparecer, primeiro investigar (bd issue) antes de relaxar pra check não bloqueante.

## Não escopo (explicitamente fora)

- Outros tipos de regra (`delay`, `modify`, `breakpoint`) — issue de follow-up por tipo
- UI de criação de regra (wizard `RuleEditor` ponta a ponta) — issue separada
- Side panel — só `options.html` nesse primeiro spec
- Persistência cross-reload da extensão — issue separada
- Testes de migração legacy (`legacy_migrated_at` / `legacy_backup_v1`) — issue separada
- Cobertura de erros (mock que retorna 500, request modificado com header inválido, etc.) — issue separada
- Integração com beads (rastreio de quais E2E cobrem quais issues) — fora de escopo
- Cross-browser (Firefox/Edge) — Debug Buddy é Chromium-only por enquanto

## Critérios de aceitação

- `cd app && npx playwright test` passa localmente em <90s com `dist/` construído
- Workflow `e2e` no GitHub Actions roda em PR para `main` e bloqueia merge em falha (após adicionar aos required status checks)
- Em falha, o artefato `playwright-report` contém HTML report + trace navegável
- Suite atual de vitest (`npm test`) continua passando sem modificações
- Lint, typecheck e build passam (`npm run lint`, `npm run typecheck`, `npm run build`)
- Documentação de execução E2E adicionada ao `CLAUDE.md` (seção "Tests" ou nova seção "E2E")
