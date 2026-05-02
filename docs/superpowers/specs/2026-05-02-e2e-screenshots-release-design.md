# Screenshots de evidência no Golden Path + anexo na GitHub Release

**Data:** 2026-05-02
**Status:** Aprovado para implementação
**Issue tracker:** beads (epic + filhos a criar pelo plano)

## Contexto

A suite E2E do Golden Path (spec [2026-05-02-e2e-golden-path-design.md](./2026-05-02-e2e-golden-path-design.md), implementada nesta mesma branch) cobre o pipeline ponta-a-ponta mas hoje só produz `playwright-report/` em falhas. Em runs verdes, não há artefato visual.

Queremos:

1. Cada execução verde do E2E produzir um conjunto curado de **screenshots como evidência visual** do funcionamento.
2. A **GitHub Release** gerada pelo `semantic-release` em pushes para `main` ter esses screenshots **anexados como release assets**, servindo de "prova" pública de que aquela versão passou pelo Golden Path.

## Objetivo

Capturar 6 screenshots determinísticos em pontos-chave do Golden Path, persistir como artefato em todo run da workflow `e2e`, e anexar à GitHub Release durante a workflow `release`. O escopo desse spec é **só esses dois entregáveis** — ferramentas mais ricas (vídeo, trace.zip, visual regression) ficam fora.

## Decisões de design (acordadas com o usuário)

1. **Conjunto fixo de 6 screenshots curados** — não trace, não vídeo. Escolhidos em pontos onde a UI mostra estado distinto e demonstrativo do pipeline.
2. **Capturados em toda execução E2E** (PR + main push + release) — não condicionais. Isso elimina ramos `if (CI)` ou `if (release)` e garante que o Golden Path testa exatamente o mesmo fluxo em todos os contextos.
3. **Salvos em `app/e2e/evidence/` (gitignored)** — pasta limpada no `globalSetup` antes de cada run pra evitar arquivos órfãos.
4. **Helper `captureEvidence(page, slug)`** — abstrai o path/format/extensão; teste fica legível.
5. **Workflow E2E sobe `playwright-evidence` como artefato em runs verdes** (já uploads `playwright-report` em falhas — separado).
6. **Workflow Release roda o E2E antes de semantic-release** e usa `@semantic-release/github` com `assets` apontando pra `e2e/evidence/*.png` para anexar na Release.
7. **Release gated em E2E**: se o E2E falhar no release workflow, semantic-release não roda → sem release nova nem upload CWS.

## Arquitetura

### 1. Captura no Golden Path

Inserir 6 chamadas a `captureEvidence(page, slug)` em momentos específicos de `app/e2e/tests/golden-path.spec.ts`. Cada slug vira o nome do PNG correspondente.

| # | Slug | Momento no test |
|---|------|-----------------|
| 1 | `01-target-real` | depois do primeiro `goto target.html` + assert `real-user` |
| 2 | `02-options-loaded` | depois do `goto options.html`, antes de clicar Selecionar Aba |
| 3 | `03-tab-dialog` | depois de clicar Selecionar Aba, antes de selecionar a opção |
| 4 | `04-debugging-active` | depois do click em Iniciar Interceptação + assert "Parar Interceptação" visível |
| 5 | `05-target-mocked` | depois do reload da aba alvo + assert `mocked-user` |
| 6 | `06-history-row` | depois do reload da options + poll do `tr` em /command-center |

Cada `captureEvidence` é a **última operação antes** de avançar pro próximo passo do test, garantindo que o frame capturado reflete o estado já validado pelo `expect` anterior.

### 2. Helper `captureEvidence`

Novo arquivo `app/e2e/helpers/evidence.ts`:

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

`fullPage: false` (default do Playwright) — captura só o viewport, mantém o PNG em ~100KB. Se algum checkpoint precisar de full page no futuro, helper aceita extensão futura sem mudar assinatura.

### 3. Limpeza no globalSetup

Modificar `app/e2e/helpers/global-setup.ts` para limpar `app/e2e/evidence/` no início de cada run:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup() {
	const __dirname = path.dirname(fileURLToPath(import.meta.url));
	const distPath = path.resolve(__dirname, '../../dist');
	const evidenceDir = path.resolve(__dirname, '../evidence');

	// ...validação existente do manifest.json...

	await rm(evidenceDir, { recursive: true, force: true });
	await mkdir(evidenceDir, { recursive: true });
	console.log(`[e2e] dist validado em ${distPath}`);
}
```

### 4. Gitignore

Adicionar uma linha no `.gitignore` raiz:

```
app/e2e/evidence/
```

junto com as outras entradas Playwright já presentes (`app/playwright-report/`, `app/test-results/`, `app/.playwright/`).

### 5. Workflow E2E — upload em runs verdes

Modificar `.github/workflows/e2e.yml` adicionando um step de upload condicional ao sucesso, **antes** do existente "Upload Playwright report" (que é `if: failure()`):

```yaml
- name: Upload evidence (success)
  if: success()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-evidence
    path: app/e2e/evidence/
    retention-days: 7
```

`if: success()` garante que só sobe se o test passou (não polui artefatos com PNGs de runs ruins). Retention de 7 dias é alinhada com `playwright-report`.

### 6. Workflow Release — rodar E2E + anexar

Modificar `.github/workflows/release.yml`:

- Inserir steps **entre** `Build (so semantic-release runs against a known-good tree)` e `Run semantic-release`:

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

Mesma sequência da workflow `e2e.yml`. Os 6 PNGs ficam em `app/e2e/evidence/` no runner antes do semantic-release rodar.

### 7. `@semantic-release/github` com assets

Modificar `.releaserc.json` substituindo a string `"@semantic-release/github"` por uma tupla com configuração de assets:

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

Notas:
- `path` é relativo ao `cwd` do semantic-release. Como o release workflow tem `working-directory: app`, o glob `e2e/evidence/*.png` resolve para `app/e2e/evidence/*.png`.
- `${nextRelease.gitTag}` é interpolado pelo plugin no momento da publicação (já é prática usada por outros plugins do `.releaserc`).

### 8. Falha do E2E gating a release

Já implícito na ordem dos steps: se `Run E2E` falhar no release workflow, o job para nesse step (sem `continue-on-error`), semantic-release nunca roda, nenhuma tag é criada, nada é publicado na CWS. Comportamento desejado.

## Riscos e mitigações

- **Tempo de release aumenta ~1–2min** com instalação do Chromium + Xvfb + run do E2E. Aceitável para o ganho de confiança e gating. O cache de browsers reduz após o primeiro run.
- **Flakiness do E2E bloqueia release**: o test atualmente passa em ~3s consistentemente. `retries: 2` (já configurado em `playwright.config.ts`) cobre flakiness leve. Se ficar instável no futuro, a investigação tem prioridade — não relaxar o gate sem motivo.
- **PNGs órfãos em `evidence/` local**: globalSetup limpa antes de cada run, então só ficam os 6 do run mais recente. Pasta é gitignored.
- **`fullPage: false` pode cortar conteúdo importante**: viewport padrão do Playwright é 1280x720; o Command Center cabe nesse viewport pra essa request única. Se um checkpoint específico precisar de mais altura, o helper pode evoluir pra aceitar `fullPage` opcional sem quebrar callers existentes.
- **Glob `e2e/evidence/*.png` não casar arquivos no release runner**: se o E2E run não criar os PNGs (bug), o asset upload falha silencioso (semantic-release loga aviso mas não falha o build). Mitigado pelo gating no step anterior — se o E2E não passar, não chegamos aqui.

## Não escopo

- **Trace `.zip` ou vídeo MP4** como evidência — só PNGs curados.
- **Visual regression testing** (comparar pixels entre releases) — fora.
- **Comentar PNGs no PR** automaticamente — revisor baixa do artefato.
- **Otimização WebP/AVIF** — PNGs em ~100KB cada são triviais.
- **Anexar screenshots em outros canais** (Slack, email) — não solicitado.
- **Captura de side panel** — Golden Path só cobre options.html.

## Critérios de aceitação

- `cd app && npm run e2e` cria `app/e2e/evidence/01-target-real.png` … `06-history-row.png` (6 arquivos), todos com tamanho > 0.
- O segundo `npm run e2e` consecutivo regenera os arquivos sem deixar resíduo de runs anteriores (limpeza no globalSetup).
- Workflow `e2e` em GitHub Actions sobe artefato `playwright-evidence` em runs verdes, contendo os 6 PNGs.
- Workflow `release` roda E2E antes do semantic-release; em sucesso, a GitHub Release publicada por semantic-release contém os 6 PNGs como assets, com o label configurado.
- Falha no E2E durante release workflow impede que semantic-release rode (sem release nova).
- Lint/typecheck/build/vitest/Playwright continuam verdes (incluindo o teste com as novas chamadas `captureEvidence`).
- Documentação atualizada em `CLAUDE.md` (seção E2E) mencionando os artefatos.
