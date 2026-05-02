# Screenshots de evidência no Golden Path + anexo na GitHub Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar 6 screenshots curados durante o Golden Path E2E, persistir como artefato em todo run da workflow `e2e`, e anexar à GitHub Release gerada pelo `semantic-release` em pushes para `main`.

**Architecture:** Helper `captureEvidence(page, slug)` em `app/e2e/helpers/evidence.ts` salva PNGs em `app/e2e/evidence/` (gitignored). `golden-path.spec.ts` chama o helper em 6 checkpoints determinísticos. `globalSetup` limpa a pasta antes de cada run. Workflow `e2e.yml` upa artefato `playwright-evidence` em runs verdes. Workflow `release.yml` roda E2E antes de semantic-release; `@semantic-release/github` fica configurado com `assets: e2e/evidence/*.png` e anexa na Release.

**Tech Stack:** TypeScript estrito · Playwright 1.59 · `@semantic-release/github` · GitHub Actions · `actions/upload-artifact@v4`.

**Convenções do projeto a respeitar (CLAUDE.md):**
- Comandos `npm` rodam de `app/`. Use `cd app && <cmd>`.
- Indentação: **tabs (size 2)** em TS/JSON; **spaces (2)** em YAML.
- Strings de UI/teste, comentários e logs em **pt-BR**.
- Single quotes em TS.
- TS strict ligado.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `ci:`, `docs:`.
- Husky pré-commit (Biome cobre `src/` e `e2e/` desde Task 8 do Golden Path) + commit-msg (commitlint).

**Spec base:** [docs/superpowers/specs/2026-05-02-e2e-screenshots-release-design.md](../specs/2026-05-02-e2e-screenshots-release-design.md)

---

## File Structure

**Novos arquivos:**
- `app/e2e/helpers/evidence.ts` — `captureEvidence(page, slug)` (salva PNG em `evidence/<slug>.png`)

**Arquivos modificados:**
- `app/e2e/helpers/global-setup.ts` — limpar `evidence/` antes de cada run
- `app/e2e/tests/golden-path.spec.ts` — 6 chamadas a `captureEvidence` em checkpoints
- `.gitignore` — adicionar `app/e2e/evidence/`
- `.github/workflows/e2e.yml` — novo step "Upload evidence (success)"
- `.github/workflows/release.yml` — adicionar steps de cache + install Playwright + xvfb + run E2E antes de `Run semantic-release`
- `app/.releaserc.json` — substituir `"@semantic-release/github"` por tupla com `assets`
- `CLAUDE.md` (raiz) — atualizar seção E2E mencionando os artefatos de evidência

**Arquivos NÃO modificados:**
- `app/playwright.config.ts` — config atual já adequada
- `app/e2e/helpers/extension.ts` / `seed.ts` — sem mudanças
- `.github/workflows/ci.yml` — workflow vitest separado, fora do escopo

---

## Task 1: Helper `captureEvidence`

**Files:**
- Create: `app/e2e/helpers/evidence.ts`

- [ ] **Step 1: Criar `app/e2e/helpers/evidence.ts`**

```ts
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '../evidence');

export async function captureEvidence(page: Page, slug: string): Promise<void> {
	const file = path.join(EVIDENCE_DIR, `${slug}.png`);
	await page.screenshot({ path: file, fullPage: false });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npx tsc --noEmit -p e2e/tsconfig.json
```

Expected: zero erros / sem saída.

- [ ] **Step 3: Lint**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npm run lint
```

Expected: `Checked NN files in NNms. No fixes applied.`

- [ ] **Step 4: Commit**

```bash
git add app/e2e/helpers/evidence.ts
git commit -m "$(cat <<'EOF'
feat(e2e): adiciona helper captureEvidence para screenshots curados

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Limpeza de `evidence/` no globalSetup

**Files:**
- Modify: `app/e2e/helpers/global-setup.ts`

- [ ] **Step 1: Substituir o conteúdo de `app/e2e/helpers/global-setup.ts`**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup() {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const distPath = path.resolve(__dirname, '../../dist');
	const manifestPath = path.join(distPath, 'manifest.json');
	const evidenceDir = path.resolve(__dirname, '../evidence');

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

	await rm(evidenceDir, { recursive: true, force: true });
	await mkdir(evidenceDir, { recursive: true });

	console.log(`[e2e] dist validado em ${distPath}`);
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npx tsc --noEmit -p e2e/tsconfig.json && npm run lint
```

Expected: zero erros em ambos.

- [ ] **Step 3: Commit**

```bash
git add app/e2e/helpers/global-setup.ts
git commit -m "$(cat <<'EOF'
feat(e2e): globalSetup limpa app/e2e/evidence/ antes de cada run

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Atualizar `.gitignore`

**Files:**
- Modify: `.gitignore` (raiz do repo)

- [ ] **Step 1: Editar `.gitignore` raiz**

Localizar o bloco `# Playwright` (foi adicionado na Task 3 do Golden Path) e acrescentar `app/e2e/evidence/` como nova linha logo abaixo de `app/.playwright/`:

```
# Playwright
app/playwright-report/
app/test-results/
app/.playwright/
app/e2e/evidence/
```

- [ ] **Step 2: Verificar que o git ignora a nova pasta**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && mkdir -p app/e2e/evidence && touch app/e2e/evidence/test.png && git status app/e2e/evidence/ && rm app/e2e/evidence/test.png && rmdir app/e2e/evidence
```

Expected: `git status` lista nada novo (a pasta está ignorada).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore(e2e): ignora pasta app/e2e/evidence/

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Inserir capturas no Golden Path

**Files:**
- Modify: `app/e2e/tests/golden-path.spec.ts`

Inserir 6 chamadas `await captureEvidence(...)` após cada checkpoint validado pelo `expect`. Cada slug vira o nome do PNG.

- [ ] **Step 1: Substituir o conteúdo de `app/e2e/tests/golden-path.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import type { Rule } from '../../src/types/rules';
import { captureEvidence } from '../helpers/evidence';
import { getExtensionId, launchExtensionContext } from '../helpers/extension';
import { seedRules } from '../helpers/seed';

test('Golden Path: regra mocka fetch e request aparece no histórico', async () => {
	const context = await launchExtensionContext();
	try {
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
		await captureEvidence(targetPage, '01-target-real');

		const optionsPage = await context.newPage();
		await optionsPage.goto(`chrome-extension://${extId}/options.html`);
		await captureEvidence(optionsPage, '02-options-loaded');

		// Abre o diálogo de seleção e escolhe a aba alvo. As linhas da lista
		// usam <div role="option"> — ver app/src/components/select-tab/TabRow.tsx.
		await optionsPage.getByRole('button', { name: /selecionar aba/i }).click();
		await captureEvidence(optionsPage, '03-tab-dialog');
		await optionsPage.getByRole('option', { name: /target\.html/i }).click();

		// Inicia interceptação (botão fica habilitado quando a aba é válida).
		const startButton = optionsPage.getByRole('button', { name: /iniciar interceptação/i });
		await expect(startButton).toBeEnabled();
		await startButton.click();

		// Confirma a transição: o botão muda para "Parar Interceptação".
		await expect(optionsPage.getByRole('button', { name: /parar interceptação/i })).toBeVisible();
		await captureEvidence(optionsPage, '04-debugging-active');

		// Recarrega a aba alvo: o fetch agora passa pelo Fetch.requestPaused e é mockado.
		await targetPage.bringToFront();
		await targetPage.reload();
		await expect(targetPage.locator('#users-data')).toContainText('mocked-user');
		await captureEvidence(targetPage, '05-target-mocked');

		// Histórico: a request precisa aparecer no Command Center (visão canônica).
		// Navega explicitamente para /command-center e força reload — sem o reload
		// o React Router só atualiza o fragment, sem remontar `useAllRequests`,
		// e o IndexedDB recém-populado não é relido.
		await optionsPage.goto(`chrome-extension://${extId}/options.html#/command-center`);
		await optionsPage.reload();
		await expect
			.poll(async () => optionsPage.locator('tr', { hasText: '/api/users' }).count(), {
				timeout: 8000,
			})
			.toBeGreaterThan(0);
		await captureEvidence(optionsPage, '06-history-row');
	} finally {
		await context.close();
	}
});
```

- [ ] **Step 2: Garantir que `dist/` está atualizado**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npm run build
```

Expected: build verde.

- [ ] **Step 3: Rodar o E2E e confirmar que os 6 PNGs foram criados**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && lsof -ti:3100 | xargs kill 2>/dev/null
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npx playwright test
ls -la /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/e2e/evidence/
```

Expected:
- `1 passed` no playwright (em ~3s).
- `ls` mostra exatamente 6 arquivos: `01-target-real.png`, `02-options-loaded.png`, `03-tab-dialog.png`, `04-debugging-active.png`, `05-target-mocked.png`, `06-history-row.png` (todos com tamanho > 0).

- [ ] **Step 4: Rodar de novo e validar que `globalSetup` limpou e regerou (sem resíduo)**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && lsof -ti:3100 | xargs kill 2>/dev/null
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npx playwright test
ls /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/e2e/evidence/ | wc -l
```

Expected: `6` (não 12 nem 7).

- [ ] **Step 5: Lint + typecheck**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npm run lint && npx tsc --noEmit -p e2e/tsconfig.json
```

Expected: ambos verdes.

- [ ] **Step 6: Commit**

```bash
git add app/e2e/tests/golden-path.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): captura screenshots de evidência em 6 checkpoints do Golden Path

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Workflow E2E — upload de artefato em runs verdes

**Files:**
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Inserir step `Upload evidence (success)` em `.github/workflows/e2e.yml`**

Localizar o step existente "Run E2E tests" (após `xvfb-run --auto-servernum npx playwright test`) e o subsequente "Upload Playwright report" (`if: failure()`). **Entre os dois**, inserir o novo step:

```yaml
      - name: Upload evidence (success)
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-evidence
          path: app/e2e/evidence/
          retention-days: 7
```

Resultado esperado do bloco final:

```yaml
      - name: Run E2E tests
        run: xvfb-run --auto-servernum npx playwright test
        env:
          CI: '1'

      - name: Upload evidence (success)
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-evidence
          path: app/e2e/evidence/
          retention-days: 7

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

- [ ] **Step 2: Validar YAML local (best effort)**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e.yml')); print('OK')" 2>/dev/null || echo "python yaml indisponível, pular"
```

Expected: `OK` (ou skip se módulo não disponível).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "$(cat <<'EOF'
ci(e2e): upa artefato playwright-evidence em runs verdes do workflow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Workflow Release — rodar E2E antes de semantic-release

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Inserir steps de E2E em `.github/workflows/release.yml`**

Localizar o step `Build (so semantic-release runs against a known-good tree)` (atualmente seguido por `Lint extension shape`). **Entre `Build` e `Lint extension shape`**, inserir 4 novos steps:

```yaml
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('app/package-lock.json') }}

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Install Xvfb
        run: sudo apt-get install -y xvfb

      - name: Run E2E (gera evidência para a release)
        run: xvfb-run --auto-servernum npx playwright test
        env:
          CI: '1'
```

O `Lint extension shape` (`npm run lint:ext`) e o `Run semantic-release` que vêm depois ficam intactos.

Resultado esperado da sequência:

```yaml
      - name: Build (so semantic-release runs against a known-good tree)
        run: npm run build

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('app/package-lock.json') }}

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Install Xvfb
        run: sudo apt-get install -y xvfb

      - name: Run E2E (gera evidência para a release)
        run: xvfb-run --auto-servernum npx playwright test
        env:
          CI: '1'

      - name: Lint extension shape
        run: npm run lint:ext

      - name: Run semantic-release
        ...
```

- [ ] **Step 2: Validar YAML**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('OK')" 2>/dev/null || echo "python yaml indisponível, pular"
```

Expected: `OK` (ou skip).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci(release): roda E2E antes de semantic-release para gerar evidência

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `.releaserc.json` — configurar `@semantic-release/github` com assets

**Files:**
- Modify: `app/.releaserc.json`

- [ ] **Step 1: Substituir a entrada `"@semantic-release/github"` em `app/.releaserc.json`**

Localizar a linha `"@semantic-release/github"` (último item da array `plugins`) e substituí-la pela tupla com configuração de assets.

ANTES (último item da array `plugins`):
```json
		"@semantic-release/github"
```

DEPOIS:
```json
		[
			"@semantic-release/github",
			{
				"assets": [
					{
						"path": "e2e/evidence/*.png",
						"label": "E2E evidence — golden path (${nextRelease.gitTag})"
					}
				]
			}
		]
```

A vírgula que separa este do plugin anterior (`@semantic-release/git`) deve permanecer; manter ordenação geral da array.

- [ ] **Step 2: Validar JSON local**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && node -e "JSON.parse(require('fs').readFileSync('.releaserc.json','utf-8')); console.log('OK')"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add app/.releaserc.json
git commit -m "$(cat <<'EOF'
ci(release): anexa screenshots de evidência aos GitHub Releases

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Atualizar documentação em `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (raiz do repo)

- [ ] **Step 1: Localizar a seção `### E2E (Playwright)` em `CLAUDE.md`**

Foi adicionada na Task 8 do plano anterior. A seção contém um bloco com `npm run e2e`, `npm run e2e:headed`, `npm run e2e:ui`, e um parágrafo sobre o `headless: false`.

- [ ] **Step 2: Adicionar parágrafo novo sobre evidência ao final da seção (antes de `## Commit hooks`)**

Inserir o seguinte parágrafo logo após a frase "Limites desse primeiro corte: cobre **só o Golden Path**..." (final da seção atual):

```markdown
**Evidência visual**: cada execução verde gera 6 PNGs em `app/e2e/evidence/` (gitignored, regenerada a cada run pelo globalSetup). O workflow `e2e` sobe esses arquivos como artefato `playwright-evidence` (retenção 7 dias) — útil para revisores de PR. O workflow `release` também roda o E2E antes do semantic-release; em sucesso, os 6 PNGs são anexados à GitHub Release publicada via plugin `@semantic-release/github` com label `E2E evidence — golden path (<tag>)`.
```

- [ ] **Step 3: Confirmar markdown**

```bash
grep -A2 "Evidência visual" /Users/guichafy/Workspaces/chrome-extension-debug-buddy/CLAUDE.md | head -5
```

Expected: o novo parágrafo aparece formatado.

- [ ] **Step 4: Rodar bateria final de gates**

```bash
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && lsof -ti:3100 | xargs kill 2>/dev/null
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npm run lint && npm run typecheck && npm run build && npm test
cd /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app && npx playwright test
ls -1 /Users/guichafy/Workspaces/chrome-extension-debug-buddy/app/e2e/evidence/
```

Expected:
- Lint, typecheck, build, vitest todos verdes.
- Playwright `1 passed`.
- Listagem mostra 6 arquivos PNG.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(e2e): documenta evidência visual + anexo na Release

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (executado durante a escrita do plano)

**Spec coverage:**
- ✅ Helper `captureEvidence` em `app/e2e/helpers/evidence.ts` — Task 1
- ✅ 6 screenshots curados em pontos-chave — Task 4
- ✅ `globalSetup` limpa pasta antes do run — Task 2
- ✅ `.gitignore` ignora `app/e2e/evidence/` — Task 3
- ✅ Workflow `e2e` upa artefato `playwright-evidence` em runs verdes — Task 5
- ✅ Workflow `release` roda E2E antes do semantic-release — Task 6
- ✅ `@semantic-release/github` anexa PNGs com label dinâmico — Task 7
- ✅ Release gated em E2E verde (implícito pela ordem dos steps no release.yml) — Task 6
- ✅ Documentação no CLAUDE.md — Task 8
- ✅ Critérios de aceitação rodam na bateria final do Task 8 step 4

**Placeholder scan:** zero "TBD"/"TODO". Todos os blocos de código estão completos. Comandos têm output esperado explícito. Caminhos absolutos onde necessário.

**Type consistency:**
- `captureEvidence(page: Page, slug: string): Promise<void>` — assinatura idêntica em Task 1 (definição) e Task 4 (uso).
- 6 slugs (`01-target-real`, `02-options-loaded`, `03-tab-dialog`, `04-debugging-active`, `05-target-mocked`, `06-history-row`) consistentes entre Task 4 (test) e Task 8 (validação final).
- `EVIDENCE_DIR` resolve para o mesmo path em `evidence.ts` (Task 1) e `global-setup.ts` (Task 2): `app/e2e/evidence`.
- `Rule`, `BrowserContext`, `Page` importados dos lugares corretos.

**Riscos cobertos pelo plano:**
- `dist/` desatualizado: Task 4 step 2 força `npm run build`.
- Pasta de evidência não existir na primeira execução: `globalSetup` em Task 2 cria via `mkdir { recursive: true }`.
- Colisão de port 3100: comandos de teste prefixam com `lsof -ti:3100 | xargs kill 2>/dev/null`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-e2e-screenshots-release.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
