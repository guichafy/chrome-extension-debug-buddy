---
title: Refactor & modernization — Debug Buddy
date: 2026-04-27
status: approved
owner: guichafy
---

# Refactor & modernization — Debug Buddy

## Resumo

Refactor incremental in-place do Debug Buddy (Chrome MV3 extension) para alinhar
o projeto com as práticas atuais de extensões Chrome com TypeScript: toolchain
moderno (Tailwind v4, Vitest, Biome, Husky+lint-staged+commitlint), TypeScript
strict gradual, dark-only por padrão, redesign de polimento com correção de
bugs de layout causados por inconsistências de configuração, limpeza de
formatos legados e código morto, reorganização da estrutura em
`src/entrypoints/` e adoção do Side Panel API. CI/release automatizados com
release-please, `web-ext lint` e `chrome-webstore-upload-cli`.

Sem reescrita. Sem monorepo. Sem migração para WXT/CRXJS. Cada fase
mergeable individualmente.

## Princípios

- **Incremental e mergeable.** Cada fase é um PR independente; CI verde sempre.
- **Dark-only.** Sem toggle, sem `prefers-color-scheme`. Remove qualquer infra
  de troca de tema.
- **Errors over fallbacks.** Mantém a regra documentada no `CLAUDE.md` — sem
  placeholders, sem default fabricado.
- **Strings e comentários em PT-BR** — manter convenção existente.
- **Background é single writer** — não muda; persistência continua sendo
  responsabilidade do service worker.
- **Tabs (size 2)** — Biome configurado para preservar a indentação atual e
  o estilo Prettier (single-quote, trailing-comma, print-width 100).

## Decisões travadas (interview)

| Tópico | Decisão |
|---|---|
| Escopo | Refactor incremental in-place |
| Redesign | Polir + dark default + corrigir bugs |
| Tema | Somente dark (sem toggle) |
| CSS | Tailwind v4 (CSS-first) |
| Test runner | Vitest |
| Hooks de commit | Husky + lint-staged + commitlint |
| Lint+format | Biome (substitui ESLint+Prettier) |
| Legado de regras | Migrar `urlPatterns`/`mocks` para `rules` e remover |
| Dead code | Apagar `extension-reloader.ts` e `hot-reload.ts` |
| Tipos | Consolidar `Message`/`MessageAction` e `InterceptedResponse` |
| Strict TS | Ligar `strict: true` gradualmente |
| CI | GitHub Actions atual + release-please + web-ext lint + CWS CLI |
| Estrutura | `src/entrypoints/` + adicionar Side Panel + manter app/ único |
| Permissões | Auditar e mover `<all_urls>` para `optional_host_permissions` |

## Arquitetura final (pós-refactor)

```
app/
├── manifest.json              # side_panel + optional_host_permissions
├── package.json
├── biome.json                 # substitui .prettierrc + eslint.config.js
├── vitest.config.ts           # substitui jest.config.cjs
├── tsconfig.json              # strict: true
├── vite.config.mts
├── components.json            # paths corrigidos
└── src/
    ├── entrypoints/
    │   ├── background.ts
    │   ├── options/
    │   │   ├── index.html
    │   │   └── main.tsx
    │   └── sidepanel/
    │       ├── index.html
    │       └── main.tsx       # reutiliza routes/pages compartilhadas
    ├── lib/
    │   ├── indexedDB.ts
    │   ├── networkTiming.ts
    │   ├── messaging.ts       # helpers tipados de chrome.runtime
    │   └── utils.ts
    ├── components/
    │   ├── ui/                # shadcn primitives (renomeado de shadcn/)
    │   ├── requests/
    │   ├── rules/
    │   └── layout/
    ├── hooks/
    ├── pages/
    ├── types/
    │   ├── messages.ts        # Message/MessageAction unificado
    │   ├── intercepted.ts     # InterceptedResponse unificado
    │   └── rules.ts
    └── styles/
        └── globals.css        # Tailwind v4 @theme + tokens dark
```

## Fases de execução

Cada fase corresponde a um PR independente. A ordem importa: foundation antes
de toolchain, toolchain antes de cleanup, cleanup antes de strict, strict antes
de visual, visual antes de estrutura, estrutura antes de release.

### Fase 0 — Foundation fixes

Mudanças puramente corretivas, sem efeito funcional. Estabelece baseline
consistente para o resto do refactor.

- Atualiza `@types/react` e `@types/react-dom` de `^18` para `^19` para casar
  com `react@19`.
- Corrige `app/components.json`:
  - `tailwind.config` → `tailwind.config.cjs`
  - `tailwind.css` → `src/ui/globals.css`
- Apaga `app/src/backend/utils/extension-reloader.ts`.
- Apaga `app/src/backend/utils/hot-reload.ts`.
- Remove dependência auto-referenciada `chrome-interceptor: file:` em
  `package.json`.
- CI: lint + build + test continuam verdes (nenhuma mudança de comportamento).

**Critério de aceite:** `npm run lint && npm run build && npm test` passa
sem nada novo, e o shadcn CLI (`npm run shadcn:add`) opera contra os paths
corretos.

### Fase 1 — Toolchain swap (Biome + Vitest + hooks)

Substitui ESLint+Prettier por Biome, Jest por Vitest, e adiciona hooks de
commit.

- Adiciona `@biomejs/biome` em devDeps; cria `app/biome.json` configurado para:
  - `formatter.indentStyle: "tab"`, `indentWidth: 2`
  - `formatter.lineWidth: 100`
  - `javascript.formatter.quoteStyle: "single"`,
    `trailingCommas: "all"`
  - regras equivalentes às atuais (no-unused-vars off, etc.)
- Remove `eslint*`, `prettier*`, `eslint-config-*`, `eslint-plugin-*` de
  devDeps.
- Apaga `app/eslint.config.js` e `app/.prettierrc`.
- Adiciona `vitest`, `@vitest/ui`, `jsdom` em devDeps; cria
  `app/vitest.config.ts` com:
  - `environment: 'jsdom'`
  - `globals: true`
  - `setupFiles: ['./vitest.setup.ts']`
  - alias `@` → `src` (espelha vite.config.mts)
- Migra `app/jest.setup.js` → `app/vitest.setup.ts` (mocks de `chrome`).
- Atualiza arquivos de teste: troca imports de `@jest/globals` se houver,
  ajusta `jest.fn()` → `vi.fn()`.
- Remove `jest`, `jest-environment-jsdom`, `ts-jest`, `@types/jest`,
  `@testing-library/jest-dom` (substitui por `@testing-library/jest-dom/vitest`).
- Adiciona `husky`, `lint-staged`, `@commitlint/cli`,
  `@commitlint/config-conventional` em devDeps.
- Configura:
  - `app/.husky/pre-commit` → `npx lint-staged`
  - `app/.husky/commit-msg` → `npx --no -- commitlint --edit "$1"`
  - `package.json` `lint-staged` → `biome check --apply`
  - `app/commitlint.config.cjs` → `extends: ['@commitlint/config-conventional']`
- Atualiza scripts em `package.json`:
  - `lint`: `biome check src`
  - `lint:fix`: `biome check --apply src`
  - `format`: `biome format --write src`
  - `test`: `vitest run`
  - `test:watch`: `vitest`
  - `test:coverage`: `vitest run --coverage`
- Atualiza CI (`.github/workflows/`) para usar os novos comandos e Node 22 LTS.

**Critério de aceite:** `biome check`, `vitest run`, `npm run build` verdes.
Commit local com mensagem inválida é rejeitado pelo commitlint.

### Fase 2 — Tailwind v4

Migra de Tailwind 3.4 para 4.x (CSS-first, Lightning CSS).

- Substitui `tailwindcss@^3.4` por `tailwindcss@^4` e adiciona
  `@tailwindcss/vite` em devDeps.
- Remove `autoprefixer`, `postcss`, `tailwindcss-animate` (este último é
  reescrito em CSS — Tailwind v4 já cobre as keyframes do shadcn).
- Apaga `app/tailwind.config.cjs` e `app/postcss.config.cjs`.
- Atualiza `app/vite.config.mts` para incluir o plugin `@tailwindcss/vite`.
- Reescreve `app/src/ui/globals.css`:
  - `@import "tailwindcss"`
  - Bloco `@theme` com tokens dark-only (sem `:root` light, sem `.dark` class)
  - Animações de accordion como `@keyframes` + `@theme` `animate-*`
- Atualiza `components.json`:
  - `tailwind.config` → `""` (Tailwind v4 não usa config JS)
  - `tailwind.css` → `src/ui/globals.css` (já corrigido na Fase 0)
- Ajusta shadcn primitives onde houver classes que mudaram em v4 (raros
  casos: `shadow-sm` → `shadow-xs`, espaçamentos com unidade dinâmica).
- Garante que o build emite `styles.css` corretamente para
  `web_accessible_resources` no manifest.

**Critério de aceite:** UI renderiza idêntica à Fase 1; `npm run build`
verde; bundle de CSS reduzido (Tailwind v4 é mais enxuto).

### Fase 3 — Cleanup de código e tipos

- Adiciona migração one-shot no startup do background:
  - Lê `chrome.storage.local.urlPatterns` e `chrome.storage.local.mocks`.
  - Converte cada `UrlPattern` em uma `Rule` de `breakpoint` e cada
    `MockConfig` em uma `Rule` de `mock`.
  - Faz backup em `chrome.storage.local.legacy_backup_v1` (mantido por
    1 release como rede de segurança).
  - Apaga `urlPatterns` e `mocks` após sucesso.
  - Marca `chrome.storage.local.legacy_migrated_at` com timestamp.
- Remove o ramo legado em `shouldInterceptUrl`, `checkForMock` e
  `checkForBreakpoint` em `background.ts`.
- Apaga `app/src/ui/hooks/useUrlPatterns.ts` e qualquer UI que dependa do
  formato legado (página/aba de URL Patterns separada se ainda existir).
- Move o tipo `Message`/`MessageAction` da declaração inline em
  `background.ts` para `app/src/types/messages.ts`. Importa nos dois lados
  (background e UI). Apaga o tipo stale em `app/src/backend/types/index.ts`.
- Unifica `InterceptedResponse`:
  - Cria `app/src/types/intercepted.ts` com a versão canônica (inclui
    `request.postData`, `headers` documentado como response-only com
    referência à issue #19).
  - Remove a cópia divergente em `useResponses.ts`.

**Critério de aceite:** `vitest run` passa, build verde, e ao reabrir a
extensão com dados legados pré-existentes a UI mostra as `rules` migradas.

### Fase 4 — Strict TS gradual

- Liga `strict: true` em `app/tsconfig.json` (`noImplicitAny`,
  `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
  `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`).
- Roda `tsc --noEmit` e classifica erros:
  - Triviais (tipo de retorno, narrow guard) — corrige.
  - Custosos — adiciona `// @ts-expect-error: <motivo>` com TODO e abre
    issue de cleanup linkada.
- Foca primeiro em `background.ts` e hooks (`useDebugging`, `useResponses`,
  `useAllRequests`, `useRules`) — superfície mais propensa a bugs de null.
- Atualiza `CLAUDE.md`:
  - Remove a seção "TS é intencionalmente non-strict".
  - Adiciona nota sobre como adicionar `@ts-expect-error` justificado.

**Critério de aceite:** `tsc --noEmit` passa em modo strict (com
`@ts-expect-error` justificado quando necessário); CI verde.

### Fase 5 — Visual refresh (dark default + bug fixes)

- Auditoria visual em cada página/dialog:
  - `Settings` (rules editor): alinhamento de campos, espaçamento de
    botões, contraste em badges de tipo de ação.
  - `Requests` (pending): pading do dialog, tipografia monoespaçada para
    URL e payload, scroll interno consistente.
  - `RequestHistory`: densidade da tabela, color tokens para status HTTP
    (2xx verde, 3xx azul, 4xx amarelo, 5xx vermelho — todos derivados dos
    tokens dark), sticky header.
  - `Layout` (sidebar + header): largura colapsada, foco visível em
    elementos interativos, separadores.
  - `SelectTabDialog`, `ResponseDialog`: foco inicial, tab order, ESC
    fecha, alinhamento de footer.
- Padroniza tokens via `@theme` em `globals.css`:
  - Background, surface, border, ring, primary, destructive, success,
    warning — todos em HSL com variantes para hover/active.
  - Radius unificado (`--radius: 0.5rem`).
- Remove qualquer código que troque tema (`darkMode: ["class"]` em
  Tailwind v3 já some na Fase 2; varrer hooks/contexts).
- Documenta os tokens no topo do `globals.css` (comentário curto em PT-BR).

**Critério de aceite:** screenshots before/after revisadas; nenhum
elemento usa cor hardcoded fora dos tokens; foco visível em todos os
elementos interativos.

### Fase 6 — Estrutura + Side Panel

- Move arquivos:
  - `src/backend/background.ts` → `src/entrypoints/background.ts`
  - `src/backend/services/*` → `src/lib/`
  - `src/backend/types/*` → `src/types/`
  - `src/backend/lib/utils.ts` + `src/backend/utils/helpers.ts` →
    `src/lib/`
  - `src/ui/main.tsx` → `src/entrypoints/options/main.tsx`
  - `index.html` → `src/entrypoints/options/index.html`
  - `src/ui/components/shadcn/` → `src/components/ui/`
  - `src/ui/components/{requests,rules}/` → `src/components/{requests,rules}/`
  - `src/ui/components/{AppSidebar,SiteHeader,...}.tsx` →
    `src/components/layout/`
  - `src/ui/hooks/` → `src/hooks/`
  - `src/ui/pages/` → `src/pages/`
  - `src/ui/globals.css` → `src/styles/globals.css`
  - Atualiza `components.json` `tailwind.css` →
    `src/styles/globals.css`.
- Atualiza imports em massa (script `node` + busca/substituição via Biome
  format).
- Cria entrypoint do Side Panel:
  - `src/entrypoints/sidepanel/index.html`
  - `src/entrypoints/sidepanel/main.tsx` — mesma `RouterProvider` que
    options, mesma árvore de pages, só `<base>` ou wrapper diferente
    se necessário.
- Atualiza `manifest.json`:
  - Adiciona `"side_panel": { "default_path": "sidepanel.html" }`
  - Adiciona `"sidePanel"` em `permissions`
  - Move `"<all_urls>"` de `host_permissions` para
    `optional_host_permissions` — usuário aprova o domínio quando escolhe
    o target tab. Background usa `chrome.permissions.request` antes de
    `debugger.attach`.
  - Mantém `options_page: "options.html"` (renomear arquivo gerado).
- Atualiza `vite.config.mts`:
  - Adiciona `sidepanel` como entry point.
  - Renomeia `index` para `options`.
  - Garante `entryFileNames: '[name].js'`.
- Adiciona handler em background para abrir Side Panel via `chrome.action.onClicked`
  (alternativa ao options_page para usuário avançado).

**Critério de aceite:** Side Panel abre, mostra a mesma UI do options_page,
target tab pode ser selecionada e o flow de interceptação funciona em ambos.
Todas as referências a `app/dist/` continuam corretas no manifest.

### Fase 7 — CI/Release

- Atualiza `.github/workflows/ci.yml`:
  - Node 22 LTS.
  - Steps: `biome check`, `vitest run`, `npm run build`, `web-ext lint
    --source-dir app/dist`.
  - Cache de `~/.npm`.
- Adiciona `.github/workflows/release-please.yml`:
  - Action `googleapis/release-please-action` com config para
    Conventional Commits.
  - Path `app/` (porque `package.json` está lá).
  - Gera `CHANGELOG.md` em `app/CHANGELOG.md`.
  - Bump de `app/package.json` e `app/manifest.json` em paralelo
    (config `extra-files`).
- Adiciona `chrome-webstore-upload-cli` em devDeps:
  - Script `app/scripts/publish-cws.mjs` que zipa `dist/`, valida com
    `web-ext lint`, sobe via CLI usando secrets.
  - Não dispara automaticamente — usuário roda manualmente após validar
    a release. (Auto-publish foi descartado nas decisões.)
- Atualiza `app/README.md` ou cria `app/RELEASING.md` com o passo a passo.

**Critério de aceite:** PR com commit `feat: ...` em main abre release PR
do release-please; merge da release PR cria tag, GitHub Release e bumpa
versões. `npm run publish:cws` (manual, com secrets configurados) sobe
o ZIP para a Chrome Web Store.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Tailwind v4 quebra shadcn primitives | Fase 2 isolada e revertível; shadcn já tem path oficial v4. Se mudança de classe quebrar componente, ajuste pontual. |
| Vitest config diverge do Jest setup | Migra `jest.setup.js` → `vitest.setup.ts` 1:1; mocks de `chrome` global preservados. Roda full suite antes de mergear. |
| `optional_host_permissions` quebra UX | Fluxo: ao selecionar target tab, background chama `chrome.permissions.request` para o domínio antes de `debugger.attach`. Se intrusivo, flag de feature reverte para `host_permissions`. |
| Strict TS exige refactor invasivo | `@ts-expect-error` pontual com TODO+issue. Fase 4 não bloqueia merge se houver issues abertas. |
| Migration de regras legadas perde dados | Backup automático em `legacy_backup_v1`; mantido por 1 release. Migration é idempotente (checa `legacy_migrated_at`). |
| Side Panel + options_page divergem | Compartilham 100% de routes/pages — só os HTMLs entry mudam. Lint check garante ambos buildam. |
| Renomear arquivos quebra Git blame | `git mv` preserva histórico. PR de Fase 6 explicitamente isolado para facilitar review. |

## Não-objetivos

- Reescrita em WXT, CRXJS ou Plasmo.
- Monorepo (pnpm workspaces, turborepo).
- Migração de gerenciamento de estado (continua hooks + useState).
- Remover IndexedDB.
- Multi-browser (Firefox/Edge) — fica como follow-up.
- Issue #3 (i18n PT-BR/EN) — separado.
- Issue #19 (request headers separados) — separado, mas a Fase 3 prepara o
  terreno ao unificar `InterceptedResponse`.
- Auto-publish na Chrome Web Store sem ação humana.

## Dependências entre fases

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5 ──► Fase 6 ──► Fase 7
```

Cada fase depende apenas da anterior. Cada fase é um PR mergeable
independentemente. Pausar entre fases é seguro: a extensão funciona em
qualquer ponto.
