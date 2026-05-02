# Testes E2E — Golden Path com Playwright Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer uma suite E2E que carrega Chromium real com a extensão construída, exercita o pipeline ponta-a-ponta (`chrome.debugger.attach` → `Fetch.requestPaused` → mock aplicado → request persistida no IndexedDB → renderizada no histórico) e roda como check bloqueante em todo PR para `main`.

**Architecture:** Servidor Express embutido em `app/e2e/fixtures/server.ts` (porta `3100`) serve uma página HTML estática que dispara `fetch('/api/users')`. Playwright lança Chromium via `chromium.launchPersistentContext` com `--load-extension=app/dist`, resolve o ID da extensão pelo service worker target, semeia uma regra de mock direto em `chrome.storage.local`, pilota a UI de `options.html` (selecionar aba → "Iniciar Interceptação"), recarrega a aba alvo e valida (a) body mockado renderizado e (b) request aparecendo em `#/request-history`.

**Tech Stack:** TypeScript estrito · `@playwright/test` 1.x · Chromium headless (`--headless=new`) · Express 4 · `tsx` (runner ESM) · Node 22 · GitHub Actions.

**Convenções do projeto a respeitar (CLAUDE.md):**
- Todos os comandos `npm` rodam de `app/`. Use `cd app && <cmd>`.
- Indentação: **tabs (size 2)**.
- Strings de UI/teste, comentários e logs em **pt-BR**.
- TS strict ligado em todo arquivo `.ts` novo.
- **No-fallback rule**: helpers não retornam defaults silenciosos — falham explicitamente.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `ci:`, `docs:`.
- Husky `pre-commit` (biome) + `commit-msg` (commitlint) ativos.
- Path alias `@` → `app/src/`. Helpers E2E ficam em `app/e2e/` e **não** usam o alias `@` (vivem fora de `src/`).

**Spec base:** [docs/superpowers/specs/2026-05-02-e2e-golden-path-design.md](../specs/2026-05-02-e2e-golden-path-design.md)

---

## File Structure

**Novos arquivos:**
- `app/e2e/fixtures/server.ts` — Express servindo `target.html` + `GET /api/users`
- `app/e2e/fixtures/target.html` — página alvo que faz `fetch('/api/users')` no load
- `app/e2e/helpers/extension.ts` — `launchExtensionContext()` + `getExtensionId()`
- `app/e2e/helpers/seed.ts` — `seedRules(context, rules)` via `chrome.storage.local`
- `app/e2e/helpers/global-setup.ts` — valida `app/dist/manifest.json` antes da suite
- `app/e2e/tests/golden-path.spec.ts` — cenário único
- `app/e2e/tsconfig.json` — extends do tsconfig raiz, types do Playwright
- `app/playwright.config.ts` — config do runner E2E
- `.github/workflows/e2e.yml` — workflow CI dedicado
- `.gitignore` (repo raiz) entradas: `app/playwright-report/`, `app/test-results/`

**Arquivos modificados:**
- `app/package.json` — devDependencies (`@playwright/test`, `playwright`, `express`, `@types/express`, `tsx`); scripts `e2e`, `e2e:headed`, `e2e:ui`
- `CLAUDE.md` (raiz) — nova seção "E2E tests" no bloco de testes
- `app/biome.json` — adicionar `e2e/` aos paths considerados por biome (ou ignorar `playwright-report`/`test-results`)

**Arquivos NÃO modificados:**
- `app/src/**` — produção fica intacta nesse plano
- `app/vitest.config.ts` / `app/vitest.setup.ts` — vitest não enxerga `app/e2e/`
- `.github/workflows/ci.yml` — workflow E2E é dedicado, não estende o existente

---

## Task 1: Dependências e scripts npm

**Files:**
- Modify: `app/package.json` (devDependencies + scripts)

- [ ] **Step 1: Instalar dependências de runtime e dev**

```bash
cd app
npm i -D @playwright/test playwright express @types/express tsx
```

- [ ] **Step 2: Adicionar scripts em `app/package.json`**

Adicionar dentro do bloco `"scripts"` (depois de `"test:coverage"`):

```json
"e2e": "playwright test",
"e2e:headed": "playwright test --headed",
"e2e:ui": "playwright test --ui",
```

- [ ] **Step 3: Instalar o browser Chromium do Playwright**

```bash
cd app
npx playwright install chromium
```

Expected: download de ~140MB pra `~/Library/Caches/ms-playwright/chromium-*/`.

- [ ] **Step 4: Verificar versão**

```bash
cd app
npx playwright --version
```

Expected: `Version 1.x.y` (algum 1.x atual).

- [ ] **Step 5: Confirmar que `npm test` (vitest) ainda passa**

```bash
cd app && npm test
```

Expected: PASS — convivência com vitest está OK.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore(e2e): instala Playwright + Express para suite E2E"
```

---

## Task 2: Servidor de fixture + página alvo

**Files:**
- Create: `app/e2e/fixtures/server.ts`
- Create: `app/e2e/fixtures/target.html`

- [ ] **Step 1: Criar `app/e2e/fixtures/target.html`**

```html
<!doctype html>
<html lang="pt-br">
	<head>
		<meta charset="utf-8" />
		<title>E2E Target</title>
	</head>
	<body>
		<h1>Página alvo E2E</h1>
		<pre id="users-data">loading...</pre>
		<script>
			fetch('/api/users')
				.then((r) => r.json())
				.then((data) => {
					document.getElementById('users-data').textContent = JSON.stringify(data);
				})
				.catch((err) => {
					document.getElementById('users-data').textContent = 'ERROR: ' + err.message;
				});
		</script>
	</body>
</html>
```

- [ ] **Step 2: Criar `app/e2e/fixtures/server.ts`**

```ts
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3100;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.get('/api/users', (_req, res) => {
	res.status(200).json({ users: [{ id: 1, name: 'real-user' }] });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`[e2e fixture] servidor ouvindo em http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Subir o servidor em background**

```bash
cd app && npx tsx e2e/fixtures/server.ts &
SERVER_PID=$!
sleep 1
```

Expected: log `[e2e fixture] servidor ouvindo em http://localhost:3100`.

- [ ] **Step 4: Verificar `GET /api/users`**

```bash
curl -s http://localhost:3100/api/users
```

Expected: `{"users":[{"id":1,"name":"real-user"}]}`

- [ ] **Step 5: Verificar `GET /target.html`**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/target.html
```

Expected: `200`

- [ ] **Step 6: Derrubar servidor**

```bash
kill $SERVER_PID
```

- [ ] **Step 7: Commit**

```bash
git add app/e2e/fixtures/
git commit -m "feat(e2e): adiciona servidor de fixture com endpoint /api/users"
```

---

## Task 3: Configuração Playwright + tsconfig + global setup

**Files:**
- Create: `app/e2e/tsconfig.json`
- Create: `app/e2e/helpers/global-setup.ts`
- Create: `app/playwright.config.ts`
- Modify: `.gitignore` (raiz do repo)

- [ ] **Step 1: Criar `app/e2e/tsconfig.json`**

```json
{
	"extends": "../tsconfig.json",
	"compilerOptions": {
		"rootDir": ".",
		"types": ["@playwright/test", "node"],
		"module": "ESNext",
		"moduleResolution": "bundler",
		"baseUrl": ".",
		"paths": {}
	},
	"include": ["./**/*"],
	"exclude": ["node_modules"]
}
```

- [ ] **Step 2: Criar `app/e2e/helpers/global-setup.ts`**

```ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
	const distPath = path.resolve(__dirname, '../../dist');
	const manifestPath = path.join(distPath, 'manifest.json');

	if (!existsSync(manifestPath)) {
		throw new Error(
			`[e2e] manifest.json não encontrado em ${manifestPath}. ` +
				`Rode "npm run build" antes de "npm run e2e".`,
		);
	}

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name?: string };
	if (manifest.name !== 'Debug Buddy') {
		throw new Error(
			`[e2e] manifest.json com nome inesperado: "${manifest.name}". Esperado "Debug Buddy".`,
		);
	}

	// eslint-disable-next-line no-console
	console.log(`[e2e] dist validado em ${distPath}`);
}
```

- [ ] **Step 3: Criar `app/playwright.config.ts`**

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

- [ ] **Step 4: Adicionar entradas ao `.gitignore` da raiz**

Editar `.gitignore` (raiz do repo) e acrescentar no fim:

```
# Playwright
app/playwright-report/
app/test-results/
app/.playwright/
```

- [ ] **Step 5: Garantir que o build da extensão existe**

```bash
cd app && npm run build
```

Expected: `dist/manifest.json` existe.

- [ ] **Step 6: Confirmar que a config do Playwright carrega**

```bash
cd app && npx playwright test --list
```

Expected: log `[e2e] dist validado em ...` seguido de `Total: 0 tests in 0 files` (sem testes ainda — config OK).

- [ ] **Step 7: Commit**

```bash
git add app/playwright.config.ts app/e2e/tsconfig.json app/e2e/helpers/global-setup.ts .gitignore
git commit -m "feat(e2e): configura Playwright com globalSetup validando dist/"
```

---

## Task 4: Helper de lançamento da extensão

**Files:**
- Create: `app/e2e/helpers/extension.ts`

Helper sem teste unitário próprio — sua corretude é validada quando o Golden Path roda em Task 6.

- [ ] **Step 1: Criar `app/e2e/helpers/extension.ts`**

```ts
import { type BrowserContext, chromium } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../dist');

export async function launchExtensionContext(): Promise<BrowserContext> {
	const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'debug-buddy-e2e-'));
	return chromium.launchPersistentContext(userDataDir, {
		headless: true,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH}`,
			`--load-extension=${EXTENSION_PATH}`,
			'--no-first-run',
			'--no-default-browser-check',
		],
	});
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
	let sw = context.serviceWorkers()[0];
	if (!sw) {
		sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
	}
	const url = sw.url();
	const match = url.match(/^chrome-extension:\/\/([a-z]+)\//);
	if (!match) {
		throw new Error(`[e2e] URL de service worker inesperada: ${url}`);
	}
	return match[1];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/e2e/helpers/extension.ts
git commit -m "feat(e2e): helpers para lançar contexto persistente com extensão"
```

---

## Task 5: Helper de seed de regras

**Files:**
- Create: `app/e2e/helpers/seed.ts`

- [ ] **Step 1: Criar `app/e2e/helpers/seed.ts`**

```ts
import type { BrowserContext } from '@playwright/test';
import type { Rule } from '../../src/types/rules';

export async function seedRules(context: BrowserContext, rules: Rule[]): Promise<void> {
	let sw = context.serviceWorkers()[0];
	if (!sw) {
		sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
	}

	await sw.evaluate(async (rulesToSeed) => {
		await chrome.storage.local.set({ rules: rulesToSeed });
	}, rules);
}
```

> Observação: o tipo `Rule` é importado de `app/src/types/rules.ts` para garantir que o seed sempre case com a forma real consumida por `background.ts`. Se o tipo evoluir, o teste E2E quebra em `tsc` antes de rodar — desejado.

- [ ] **Step 2: Verificar typecheck dos arquivos E2E**

```bash
cd app && npx tsc --noEmit -p e2e/tsconfig.json
```

Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add app/e2e/helpers/seed.ts
git commit -m "feat(e2e): helper seedRules grava chrome.storage.local"
```

---

## Task 6: Cenário Golden Path

**Files:**
- Create: `app/e2e/tests/golden-path.spec.ts`

A construção do teste é **incremental e TDD-style**: cada subseção adiciona um passo, roda, vê passar (ou diagnostica trace), e segue. O build da extensão (`npm run build`) é pré-requisito de qualquer execução; o `globalSetup` falha rápido se faltar.

- [ ] **Step 1: Garantir build atualizado**

```bash
cd app && npm run build
```

Expected: `dist/manifest.json` presente; build verde.

- [ ] **Step 2: Criar esqueleto que só lança o contexto e fecha**

`app/e2e/tests/golden-path.spec.ts`:

```ts
import { test } from '@playwright/test';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	const extId = await getExtensionId(context);
	// eslint-disable-next-line no-console
	console.log(`[e2e] extensão carregada com id=${extId}`);
	await context.close();
});
```

- [ ] **Step 3: Rodar — esqueleto deve passar**

```bash
cd app && npx playwright test
```

Expected: `1 passed`. Log mostra `extensão carregada com id=<32 chars>`.

- [ ] **Step 4: Adicionar abertura da aba alvo + assert "real-user"**

Substituir o conteúdo do teste por:

```ts
import { expect, test } from '@playwright/test';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	const extId = await getExtensionId(context);

	const targetPage = await context.newPage();
	await targetPage.goto('http://localhost:3100/target.html');
	await expect(targetPage.locator('#users-data')).toContainText('real-user');

	await context.close();
});
```

- [ ] **Step 5: Rodar — confirma fixture + extensão coexistindo**

```bash
cd app && npx playwright test
```

Expected: `1 passed`. Se falhar com `ECONNREFUSED 3100`, confirma que `webServer` da config subiu (logs do Playwright mostram saída do `tsx`).

- [ ] **Step 6: Adicionar seed de regra de mock**

Atualizar imports + corpo do teste:

```ts
import { expect, test } from '@playwright/test';
import type { Rule } from '../../src/types/rules';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	const extId = await getExtensionId(context);

	const now = Date.now();
	const mockRule: Rule = {
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
	};
	await seedRules(context, [mockRule]);

	const targetPage = await context.newPage();
	await targetPage.goto('http://localhost:3100/target.html');
	await expect(targetPage.locator('#users-data')).toContainText('real-user');

	await context.close();
});
```

> Por que o assert ainda é `real-user`? Porque ainda **não iniciamos a interceptação** — a regra está semeada mas debugger não está anexado, então o fetch passa direto.

- [ ] **Step 7: Rodar — seed não deve quebrar nada**

```bash
cd app && npx playwright test
```

Expected: `1 passed`. Se falhar com erro de tipo no `tsc`, ajuste a forma da regra para casar com `app/src/types/rules.ts` (referência: `MockAction` exige `enabled`, `status`, `headers`).

- [ ] **Step 8: Adicionar abertura de options + Iniciar Interceptação**

Substituir o teste inteiro por:

```ts
import { expect, test } from '@playwright/test';
import type { Rule } from '../../src/types/rules';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	const extId = await getExtensionId(context);

	const now = Date.now();
	const mockRule: Rule = {
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
	};
	await seedRules(context, [mockRule]);

	const targetPage = await context.newPage();
	await targetPage.goto('http://localhost:3100/target.html');
	await expect(targetPage.locator('#users-data')).toContainText('real-user');

	const optionsPage = await context.newPage();
	await optionsPage.goto(`chrome-extension://${extId}/options.html`);

	// Abre o diálogo de seleção e escolhe a aba alvo
	await optionsPage.getByRole('button', { name: /selecionar aba/i }).click();
	await optionsPage.getByText(/target\.html/i).first().click();

	// Inicia interceptação (botão fica habilitado quando a aba é válida)
	const startButton = optionsPage.getByRole('button', { name: /iniciar interceptação/i });
	await expect(startButton).toBeEnabled();
	await startButton.click();

	// Confirma transição para estado "debugging" — botão muda para "Parar Interceptação"
	await expect(
		optionsPage.getByRole('button', { name: /parar interceptação/i }),
	).toBeVisible();

	await context.close();
});
```

- [ ] **Step 9: Rodar — confirma fluxo de UI até começar a interceptar**

```bash
cd app && npx playwright test
```

Expected: `1 passed`. Se falhar em algum dos seletores:

- Abrir o trace: `cd app && npx playwright show-trace test-results/<falha>/trace.zip`
- Conferir labels reais em `app/src/components/layout/SiteHeader.tsx` (linhas 56, 135, 144)
- Conferir como `SelectTabDialog` renderiza linhas em `app/src/components/select-tab/`
- Ajustar o seletor (preferir `getByRole`/`getByText` com regex `/i` em vez de match exato)

- [ ] **Step 10: Adicionar reload da aba alvo + assert "mocked-user"**

Adicionar antes do `await context.close();`:

```ts
	// Recarrega a aba alvo: o fetch agora passa pelo Fetch.requestPaused e é mockado
	await targetPage.bringToFront();
	await targetPage.reload();
	await expect(targetPage.locator('#users-data')).toContainText('mocked-user');
```

- [ ] **Step 11: Rodar — coração do Golden Path**

```bash
cd app && npx playwright test
```

Expected: `1 passed`. Se o body continuar com `real-user`:

- O debugger pode não ter anexado em tempo. Inserir `await optionsPage.waitForTimeout(500)` antes do reload, **apenas** como diagnóstico — depois substituir por uma asserção explícita (texto "Depurando" ou similar no header) usando `expect.poll` ou outro `waitFor` baseado em estado.
- Confirmar nos logs do service worker que `Fetch.enable` foi chamado: trace viewer mostra cada navegação e console.

- [ ] **Step 12: Adicionar assert do histórico**

Adicionar antes do `await context.close();`:

```ts
	// Histórico: request aparece em /request-history (lê do IndexedDB)
	await optionsPage.goto(`chrome-extension://${extId}/options.html#/request-history`);
	const historyRow = optionsPage.getByRole('row', { name: /\/api\/users/ });
	await expect(historyRow).toBeVisible();
```

- [ ] **Step 13: Rodar — fim do Golden Path**

```bash
cd app && npx playwright test
```

Expected: `1 passed` em <90s. Se a linha não aparecer:

- Conferir no trace que a navegação foi para `chrome-extension://<id>/options.html#/request-history` (hash router).
- A tabela usa TanStack Table — pode ser que o role não seja `row`. Alternativa: `optionsPage.getByText('/api/users').first()` ou `optionsPage.locator('table tr', { hasText: '/api/users' })`.
- Se o item não estiver lá ainda (race com IDB), envolver em `expect.poll`.

- [ ] **Step 14: Rodar suite completa em modo CI local**

```bash
cd app && CI=1 npx playwright test
```

Expected: `1 passed` com `retries: 2` ativos (não devem ser exercidos). Confirma que a config CI também passa.

- [ ] **Step 15: Commit**

```bash
git add app/e2e/tests/golden-path.spec.ts
git commit -m "test(e2e): adiciona cenário Golden Path com mock + histórico"
```

---

## Task 7: Workflow GitHub Actions

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Criar `.github/workflows/e2e.yml`**

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

      - name: Use Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('app/package-lock.json') }}

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Build extension
        run: npm run build

      - name: Run E2E tests
        run: npx playwright test
        env:
          CI: '1'

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            app/playwright-report/
            app/test-results/
          retention-days: 7
```

- [ ] **Step 2: Validar sintaxe YAML local**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/e2e.yml'))" && echo OK
```

Expected: `OK`. (Se Python não estiver disponível, pular — a validação real é o GitHub aceitando o workflow.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci(e2e): adiciona workflow E2E bloqueante em PRs para main"
```

- [ ] **Step 4: Anotar passo manual para o usuário**

Após o merge, o usuário precisa adicionar o check `e2e` aos required status checks de `main`:

> Em GitHub: **Settings → Branches → Branch protection rule para `main` → Require status checks to pass before merging → Add check `e2e`**.

Esse passo não é automatizável via código do repo; deve ser executado pelo dono após o primeiro PR rodar e o check aparecer na lista de checks observados.

---

## Task 8: Atualizar documentação

**Files:**
- Modify: `CLAUDE.md` (raiz do repo)

- [ ] **Step 1: Adicionar seção sobre E2E em `CLAUDE.md`**

Localizar a seção `## Tests` (ou equivalente — atualmente o título é `## Tests` e contém parágrafo sobre Vitest). Adicionar um subitem novo logo abaixo:

```markdown
### E2E (Playwright)

Suite E2E em `app/e2e/` cobre o Golden Path da interceptação (anexar debugger → request mockada → histórico). Roda Chromium real com a extensão construída em `dist/`.

```bash
cd app
npm run build              # pré-requisito: dist/ atualizado
npm run e2e                # headless, roda contra dist/ + Express em :3100
npm run e2e:headed         # janela visível, útil pra debugar fluxos
npm run e2e:ui             # modo interativo do Playwright
```

CI: `.github/workflows/e2e.yml` roda em todo PR para `main` e em pushes para `main`. Em falha, baixe o artefato `playwright-report` para HTML report + trace.

Limites desse primeiro corte: cobre **só o Golden Path** com regra de mock; outros tipos (`delay`, `transform`, `breakpoint`), criação de regra via UI, side panel e migração legacy ficam em issues de follow-up.
```

- [ ] **Step 2: Confirmar que o markdown ainda é válido**

```bash
cat CLAUDE.md | head -100 | grep -A3 "E2E (Playwright)"
```

Expected: a nova seção aparece formatada.

- [ ] **Step 3: Rodar suite completa de checks locais**

```bash
cd app && npm run lint && npm run typecheck && npm run build && npm test && npx playwright test
```

Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(e2e): documenta como rodar a suite Playwright"
```

---

## Self-review (executado durante a escrita do plano)

**Spec coverage:**
- ✅ Servidor de fixture local — Task 2
- ✅ HTML alvo + endpoint determinístico — Task 2
- ✅ Playwright + persistent context + extensão — Tasks 1, 3, 4
- ✅ Resolução dinâmica do extension ID — Task 4
- ✅ Seed via `chrome.storage.local` (não pela UI) — Task 5
- ✅ Cenário Golden Path com 4 etapas (anexar → mock → assert UI → assert histórico) — Task 6
- ✅ Configuração Playwright com webServer + globalSetup — Task 3
- ✅ Workflow CI bloqueante em PRs — Task 7
- ✅ Branch protection: passo manual documentado — Task 7 step 4
- ✅ Convivência com vitest sem regressão — Task 1 step 5, Task 8 step 3
- ✅ Documentação em CLAUDE.md — Task 8

**Placeholder scan:** nenhum "TBD"/"TODO". Os pontos com incerteza (texto exato dos botões, role da linha do histórico) têm orientação concreta de troubleshooting com referências de arquivo:linha.

**Type consistency:**
- `seedRules(context, rules)` — assinatura igual em Task 5 e Task 6
- `Rule` importado do mesmo path em Task 5 e Task 6
- `launchExtensionContext()` / `getExtensionId(context)` — assinaturas batem entre Task 4 e Task 6
- `MockAction` segue o tipo real (`enabled`, `status`, `headers` obrigatórios; `body` string)

**Riscos a manter no radar durante a execução:**
- `chrome.debugger.attach` competindo com CDP do Playwright: se a primeira execução de Task 6 step 11 mostrar erro de "Another debugger already attached", abrir o tab alvo num navegador separado (segundo `launchPersistentContext`) ou usar `chrome.tabs.create` em vez de `context.newPage()` — deixar como issue paralela se acontecer.
- `tsx` e ESM: o `webServer` do Playwright executa `tsx e2e/fixtures/server.ts`; o pacote precisa estar no `node_modules` (devDeps) — Task 1 garante.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-e2e-golden-path.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
