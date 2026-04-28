# Phase 7 — CI/Release Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up release tooling that the previous phases set up the codebase for. Adds (1) `web-ext lint` to CI to catch manifest/extension-shape issues that `tsc`/`biome`/`vite` don't; (2) `release-please` workflow that turns Conventional Commits into auto-generated CHANGELOG + version bumps + GitHub Releases; (3) `chrome-webstore-upload-cli` plumbing so a maintainer can run `npm run publish:cws` to ship the ZIP after a release; (4) a `RELEASING.md` describing the end-to-end flow so future maintainers don't have to reverse-engineer it.

**Architecture:** Five small, independent commits — none of them require touching `src/`. CI gates on the branch verify the new workflows are syntactically valid and that `web-ext lint` is happy with the existing build output. Release-please and webstore upload **cannot** be exercised on the branch (they need the merge to `main` and Chrome Web Store API secrets respectively); we test them by inspection plus a "trial run" against a fork or `--dry-run` flag where supported. Manual user verification covers what CI cannot.

**Tech Stack:** GitHub Actions, `googleapis/release-please-action@v4`, `web-ext` 8.x (Mozilla — works for Chrome MV3 lint), `chrome-webstore-upload-cli` 3.x, Node 22 LTS.

**Spec reference:** [docs/superpowers/specs/2026-04-27-refactor-modernization-design.md](../specs/2026-04-27-refactor-modernization-design.md), section "Fase 7 — CI/Release" (lines 306-330).

**Working directory:** `app/` for npm/biome/tsc/vitest commands; repo root for git, `.github/workflows/`. The release-please action runs at the repo root but its config points at the `app/` subdirectory because that's where `package.json` lives.

**Worktree:** `/Users/guichafy/Workspaces/chrome-extension-debug-buddy/.claude/worktrees/phase-7` (already created from `main` at `819ce09`).

**Spec deviations / open questions:**
- The spec says `chrome-webstore-upload-cli` should "validar com `web-ext lint`" inside the publish script. We split this: `web-ext lint` runs in CI on every PR (catches issues earlier), AND the publish script runs it again as a final guard before upload (defense in depth, fast on local dev).
- The spec doesn't specify the `release-please-action` major version. We pin to `@v4` (latest stable as of plan-write date).
- The spec says "Não dispara automaticamente". We implement publish as a `workflow_dispatch` GitHub Action (manual button click) AND as a local script — both routes available, both gated by the same `web-ext lint` check.
- The spec mentions updating `app/README.md` OR creating `app/RELEASING.md`. We create `app/RELEASING.md` (single-purpose doc, easier to find) AND add a one-line pointer in the repo-root `README.md`.

---

## File structure (final)

```
.github/workflows/
├── ci.yml                  ← MODIFIED (add web-ext lint step)
├── release-please.yml      ← NEW
└── publish-cws.yml         ← NEW (workflow_dispatch trigger)

app/
├── package.json            ← MODIFIED (add devDeps + scripts)
├── package-lock.json       ← MODIFIED (lockfile update)
├── RELEASING.md            ← NEW (release flow docs)
├── release-please-config.json   ← NEW (release-please config)
├── .release-please-manifest.json ← NEW (release-please state)
└── scripts/
    └── publish-cws.mjs     ← NEW (local-friendly publish helper)

README.md                   ← MODIFIED (one-line link to app/RELEASING.md)
```

---

## Task 1: Add `web-ext lint` to CI

**Why:** `tsc`/`biome`/`vite` validate code; none validates the **extension shape** (manifest schema, file permissions, deprecated APIs). Mozilla's `web-ext` ships a `lint` subcommand that knows MV3 schemas. Adding it to CI catches manifest mistakes (missing keys, invalid permissions, broken paths in `web_accessible_resources`) at PR time.

**Files modified:**
- `app/package.json` (add `web-ext` to devDeps)
- `app/package-lock.json` (lockfile)
- `.github/workflows/ci.yml` (add a step that runs `web-ext lint` against `app/dist/`)

**Note on tool choice:** `web-ext lint` is Mozilla's tool but its lint engine accepts MV3 manifests and Chrome's flavor of WebExtensions. Confirmed working for Chrome extensions per [Mozilla docs](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#lint).

- [ ] **Step 1: Inspect the current CI workflow**

  ```bash
  cat .github/workflows/ci.yml
  ```

  Confirm: Node 22 setup, working-directory `app/`, current steps `lint → typecheck → build → test`. The new `web-ext lint` step goes **after `build`** (it needs `dist/`) and **before `test`** (so a malformed manifest fails earlier).

- [ ] **Step 2: Add `web-ext` to devDependencies**

  From `app/`:
  ```bash
  cd app
  npm install --save-dev web-ext@^8.0.0
  ```

  This bumps `package.json` and `package-lock.json`. Confirm:
  ```bash
  grep '"web-ext"' package.json
  # expected: "web-ext": "^8.x.x" under devDependencies
  ```

- [ ] **Step 3: Add a `lint:ext` npm script**

  In `app/package.json`, add to `scripts`:
  ```json
  "lint:ext": "web-ext lint --source-dir dist --self-hosted",
  ```

  The `--self-hosted` flag tells web-ext we're not publishing to Mozilla AMO (skips AMO-specific checks). The `--source-dir dist` points at the Vite build output.

  Verify it runs locally first:
  ```bash
  npm run build
  npm run lint:ext
  ```

  Expected output: a list of warnings (if any) and a final exit-0. **Common issues to address before committing:**
  - "Missing icons" warnings — fine, our manifest declares icons in `images/`.
  - "Manifest version not 2" — IGNORE; we're MV3.
  - Real errors (TypeError on manifest, missing required fields) — must be fixed before committing.

  If `web-ext lint` produces persistent NON-fixable warnings (e.g. about `host_permissions: <all_urls>` being broad), pass `--ignore-files` for those rules and document why in a comment. Don't blanket-ignore.

- [ ] **Step 4: Add the CI step**

  Edit `.github/workflows/ci.yml`. After the `Build` step, add:
  ```yaml
        - name: Lint extension shape (web-ext)
          run: npm run lint:ext
  ```

  Final `steps:` order should be:
  1. checkout
  2. setup-node (cache npm)
  3. npm ci
  4. lint (biome)
  5. typecheck (tsc)
  6. build (vite)
  7. lint:ext (web-ext)  ← NEW
  8. test (vitest)

- [ ] **Step 5: Commit**

  ```bash
  git add app/package.json app/package-lock.json .github/workflows/ci.yml
  git commit -m "$(cat <<'EOF'
  ci: add web-ext lint step to validate extension shape

  Adds Mozilla's web-ext lint to CI. Runs after `vite build` against
  app/dist/ to catch manifest schema issues, broken file references in
  web_accessible_resources, and other MV3 shape violations that
  tsc/biome/vite don't detect.

  --self-hosted flag skips AMO-specific rules; --source-dir dist points
  at the Vite output. Adds devDep web-ext@^8 and npm run lint:ext for
  local invocation.
  EOF
  )"
  ```

---

## Task 2: Add `release-please` workflow

**Why:** Manual versioning + CHANGELOG maintenance is error-prone. `release-please` watches `main` for Conventional Commits, builds a "release PR" that bumps versions and updates CHANGELOG.md, and creates a GitHub Release tag when the release PR merges. We already enforce Conventional Commits via commitlint, so all our commits are release-please-ready.

**Critical detail:** `package.json` lives at `app/package.json` AND `manifest.json` lives at `app/manifest.json`. Both need to bump in lockstep. release-please supports this via `extra-files` config.

**Files added:**
- `.github/workflows/release-please.yml` (workflow trigger)
- `app/release-please-config.json` (config — path layout, packages, extra-files)
- `app/.release-please-manifest.json` (state file — current version)

- [ ] **Step 1: Create `.github/workflows/release-please.yml`**

  ```yaml
  name: Release Please

  on:
    push:
      branches: [main]

  permissions:
    contents: write
    pull-requests: write

  jobs:
    release-please:
      runs-on: ubuntu-latest
      steps:
        - uses: googleapis/release-please-action@v4
          with:
            config-file: app/release-please-config.json
            manifest-file: app/.release-please-manifest.json
  ```

  Notes:
  - `permissions` is required for the action to push commits and open PRs.
  - The action runs at repo root; `config-file` and `manifest-file` paths are relative to repo root.
  - No `release-type` here — it's per-package in the config file.

- [ ] **Step 2: Create `app/release-please-config.json`**

  ```json
  {
    "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
    "packages": {
      "app": {
        "release-type": "node",
        "package-name": "debug-buddy",
        "changelog-path": "CHANGELOG.md",
        "include-component-in-tag": false,
        "include-v-in-tag": true,
        "extra-files": [
          {
            "type": "json",
            "path": "manifest.json",
            "jsonpath": "$.version"
          }
        ]
      }
    },
    "bump-minor-pre-major": true,
    "bump-patch-for-minor-pre-major": false
  }
  ```

  Notes:
  - `packages."app"` — keys are paths relative to repo root.
  - `release-type: node` — uses `package.json` as version source of truth.
  - `package-name: debug-buddy` — used in the GitHub Release title and tag (we use `debug-buddy` since the manifest's `name` is `Debug Buddy`).
  - `include-component-in-tag: false` — tag is `v1.0.1` not `app-v1.0.1`.
  - `extra-files[0]` — auto-bump `manifest.json`'s `$.version` field whenever `package.json` bumps.
  - `bump-minor-pre-major: true` + `bump-patch-for-minor-pre-major: false` — while we're at `0.x` or `1.0.x`, breaking changes (`feat!`) get **minor** bumps not majors. Sane for pre-1.x stability.

- [ ] **Step 3: Create `app/.release-please-manifest.json`**

  ```json
  {
    "app": "1.0.0"
  }
  ```

  This is release-please's state file. Records the current version of each package; the next release will compute the next version from this baseline + the commit log. Initial value matches what's already in `app/package.json`.

- [ ] **Step 4: Verify config validity (best-effort, no live trigger)**

  release-please can't run on a branch — it needs `main`. Verify by inspection:
  ```bash
  # JSON is valid
  cat app/release-please-config.json | jq .
  cat app/.release-please-manifest.json | jq .
  # YAML is valid
  npx --yes -- yaml-lint .github/workflows/release-please.yml || true
  # (yaml-lint may not be installed; fallback: cat the file and visually check)
  ```

  After merge to main, the **first push** of a `feat:`/`fix:` commit will trigger release-please to open a release PR titled `chore(main): release debug-buddy 1.0.1` (or `1.1.0` depending on the conventional commit type accumulated since the last tag).

- [ ] **Step 5: Commit**

  ```bash
  git add .github/workflows/release-please.yml app/release-please-config.json app/.release-please-manifest.json
  git commit -m "$(cat <<'EOF'
  ci: add release-please workflow for automated versioning

  Adds googleapis/release-please-action@v4 wired to push events on main.
  Conventional Commits accumulate into a "release PR" that bumps versions
  in both app/package.json and app/manifest.json (via extra-files), updates
  app/CHANGELOG.md, and creates a GitHub Release on merge.

  Initial state file pinned at 1.0.0 to match current package version.
  Pre-1.x bump policy: feat! → minor, breaking until 2.0.0 cutover.
  EOF
  )"
  ```

---

## Task 3: Add `chrome-webstore-upload-cli` + publish script

**Why:** After a release-please tag lands, a maintainer needs to ship the ZIP to Chrome Web Store. We provide TWO paths: (a) a local script `npm run publish:cws` for hands-on releases; (b) a manual GitHub Action that does the same but with secrets stored in repo settings. Auto-publish is **explicitly out of scope** per spec.

**Files added/modified:**
- `app/package.json` (devDeps: `chrome-webstore-upload-cli`, `archiver`; scripts: `package`, `publish:cws`)
- `app/package-lock.json`
- `app/scripts/publish-cws.mjs` (new helper script)
- `.github/workflows/publish-cws.yml` (new workflow_dispatch action)

- [ ] **Step 1: Add devDependencies**

  From `app/`:
  ```bash
  npm install --save-dev chrome-webstore-upload-cli@^3.0.0 archiver@^7.0.0
  ```

  - `chrome-webstore-upload-cli` — official-ish CLI for the Chrome Web Store API. Maintained, ESM-friendly.
  - `archiver` — builds the ZIP we upload (more reliable than shelling out to `zip`, and works on Windows for contributors).

- [ ] **Step 2: Create `app/scripts/publish-cws.mjs`**

  This is a single-file Node ESM script. It:
  1. Resolves `app/dist/` (must exist; runs `npm run build` if not).
  2. Re-runs `web-ext lint` as a defense-in-depth check.
  3. Builds a ZIP at `app/debug-buddy-<version>.zip` using `archiver`.
  4. Reads CWS credentials from environment (`CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`). Fails clearly if any are missing.
  5. Invokes `chrome-webstore-upload-cli upload --source <zip> --extension-id ...` (and `publish` if `--publish` flag is passed).

  Script body:
  ```js
  #!/usr/bin/env node
  // app/scripts/publish-cws.mjs
  // Manual publish helper for Chrome Web Store.
  // Usage:
  //   npm run publish:cws            # upload only (stays in CWS draft)
  //   npm run publish:cws -- --publish  # upload + publish to all users
  //
  // Required env vars:
  //   CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN

  import { existsSync, createReadStream, createWriteStream, readFileSync, statSync } from 'node:fs';
  import { execSync, spawnSync } from 'node:child_process';
  import { resolve, dirname } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import archiver from 'archiver';

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const appDir = resolve(__dirname, '..');
  const distDir = resolve(appDir, 'dist');
  const pkgPath = resolve(appDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;
  const zipPath = resolve(appDir, `debug-buddy-${version}.zip`);

  const required = ['CWS_EXTENSION_ID', 'CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`✘ Missing required env vars: ${missing.join(', ')}`);
    console.error(`  Set them via shell, .env, or GitHub Actions secrets.`);
    process.exit(1);
  }

  // 1. Build if needed
  if (!existsSync(distDir)) {
    console.log('▸ dist/ missing — running npm run build');
    execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
  }

  // 2. Lint extension shape (defense in depth)
  console.log('▸ Validating extension shape (web-ext lint)');
  const lintResult = spawnSync('npm', ['run', 'lint:ext'], { cwd: appDir, stdio: 'inherit' });
  if (lintResult.status !== 0) {
    console.error('✘ web-ext lint failed — fix issues before publishing');
    process.exit(1);
  }

  // 3. Build the ZIP
  console.log(`▸ Packaging ${distDir} → ${zipPath}`);
  await new Promise((resolveZip, rejectZip) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`  ${(statSync(zipPath).size / 1024).toFixed(1)} KB`);
      resolveZip();
    });
    archive.on('error', rejectZip);
    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize();
  });

  // 4. Upload (and optionally publish) via CLI
  const publish = process.argv.includes('--publish');
  const args = [
    'upload',
    '--source', zipPath,
    '--extension-id', process.env.CWS_EXTENSION_ID,
    '--client-id', process.env.CWS_CLIENT_ID,
    '--client-secret', process.env.CWS_CLIENT_SECRET,
    '--refresh-token', process.env.CWS_REFRESH_TOKEN,
  ];
  if (publish) {
    args.push('--auto-publish');
  }

  console.log(`▸ Uploading to Chrome Web Store (publish=${publish})`);
  const upload = spawnSync('npx', ['--yes', 'chrome-webstore-upload-cli', ...args], {
    cwd: appDir,
    stdio: 'inherit',
  });
  if (upload.status !== 0) {
    console.error('✘ Upload failed');
    process.exit(1);
  }
  console.log('✓ Done');
  ```

  **No fallbacks rule applies:** the script must `process.exit(1)` on any error. Don't swallow CWS errors with try/catch and continue.

  Make it executable:
  ```bash
  chmod +x app/scripts/publish-cws.mjs
  ```

- [ ] **Step 3: Add npm scripts**

  In `app/package.json` `scripts`:
  ```json
  "package": "node scripts/publish-cws.mjs --dry-run",
  "publish:cws": "node scripts/publish-cws.mjs"
  ```

  Wait — `--dry-run` isn't implemented above. Either implement a dry-run mode (which only runs steps 1-3, skipping the upload) OR drop the `package` script and tell users to inspect the generated ZIP manually. **Decision:** add a `--dry-run` flag to the script that exits after step 3 (ZIP creation, no upload). Cheap to add, useful for testing.

  Add to script (after the `publish` constant):
  ```js
  const dryRun = process.argv.includes('--dry-run');
  // ... after step 3:
  if (dryRun) {
    console.log(`✓ Dry run complete — ZIP at ${zipPath}`);
    process.exit(0);
  }
  // ... step 4 unchanged
  ```

  Final scripts entries:
  ```json
  "package": "node scripts/publish-cws.mjs --dry-run",
  "publish:cws": "node scripts/publish-cws.mjs"
  ```

- [ ] **Step 4: Add `.gitignore` entry for the ZIP artifacts**

  Append to repo root `.gitignore` (or `app/.gitignore` if scoped):
  ```
  app/debug-buddy-*.zip
  ```

  Inspect the existing `.gitignore` first:
  ```bash
  cat .gitignore
  ```

  Add the line in the most consistent spot (next to `app/dist` if listed, otherwise at the bottom under a new comment).

- [ ] **Step 5: Create `.github/workflows/publish-cws.yml`**

  Manual-trigger workflow that runs the same script with secrets:

  ```yaml
  name: Publish to Chrome Web Store

  on:
    workflow_dispatch:
      inputs:
        publish:
          description: 'Auto-publish to all users (uncheck for upload-only draft)'
          type: boolean
          default: false

  jobs:
    publish:
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: app
      steps:
        - uses: actions/checkout@v4
        - name: Use Node.js 22
          uses: actions/setup-node@v4
          with:
            node-version: 22
            cache: 'npm'
            cache-dependency-path: app/package-lock.json
        - run: npm ci
        - run: npm run build
        - run: npm run lint:ext
        - name: Publish
          env:
            CWS_EXTENSION_ID: ${{ secrets.CWS_EXTENSION_ID }}
            CWS_CLIENT_ID: ${{ secrets.CWS_CLIENT_ID }}
            CWS_CLIENT_SECRET: ${{ secrets.CWS_CLIENT_SECRET }}
            CWS_REFRESH_TOKEN: ${{ secrets.CWS_REFRESH_TOKEN }}
          run: |
            if [ "${{ inputs.publish }}" = "true" ]; then
              npm run publish:cws -- --publish
            else
              npm run publish:cws
            fi
  ```

  Trigger via Actions tab → Publish to Chrome Web Store → Run workflow → toggle "Auto-publish" if going live.

- [ ] **Step 6: Verify locally with dry-run**

  ```bash
  cd app
  npm run build
  CWS_EXTENSION_ID=dummy CWS_CLIENT_ID=dummy CWS_CLIENT_SECRET=dummy CWS_REFRESH_TOKEN=dummy npm run package
  ```

  Expected: builds the dist/, runs web-ext lint, creates `app/debug-buddy-1.0.0.zip`, exits with `✓ Dry run complete`. The dummy env vars satisfy the "all required" check; we never hit the upload step.

  Inspect the ZIP:
  ```bash
  unzip -l app/debug-buddy-1.0.0.zip
  ```

  Should contain `manifest.json`, `background.js`, `options.html`, `sidepanel.html`, `main.js`, `sidepanel.js`, `assets/...`, `images/...`, `lib/...` — i.e. the exact contents of `dist/`.

- [ ] **Step 7: Commit**

  ```bash
  git add app/package.json app/package-lock.json app/scripts .github/workflows/publish-cws.yml .gitignore
  git commit -m "$(cat <<'EOF'
  feat(release): add chrome-webstore-upload publish script + workflow

  - app/scripts/publish-cws.mjs — local-friendly Node ESM script that
    builds, lint:ext-validates, ZIPs, and uploads via
    chrome-webstore-upload-cli. Supports --dry-run (skip upload) and
    --publish (auto-publish to all users vs upload-only draft).
  - npm run package: dry-run (build + ZIP, no upload)
  - npm run publish:cws: full upload (requires CWS_* env vars)
  - .github/workflows/publish-cws.yml: manual workflow_dispatch trigger
    that runs the same script with repository secrets.

  Auto-publish stays opt-in (unchecked checkbox = upload-only draft).
  No fallbacks: any error fails fast with a clear message.
  EOF
  )"
  ```

---

## Task 4: Document the release flow in `app/RELEASING.md`

**Why:** The release tooling has 3 moving pieces (release-please PR, manual ZIP upload, secrets setup). Without a doc, the next maintainer has to reverse-engineer it. A single `RELEASING.md` is the cheapest way to make it discoverable and mistake-resistant.

**File added:**
- `app/RELEASING.md`

- [ ] **Step 1: Write the doc**

  Path: `app/RELEASING.md`. Content:

  ```markdown
  # Releasing Debug Buddy

  This doc describes how a new version of Debug Buddy reaches the Chrome Web Store. Tools involved: **release-please** (versioning + changelog), **chrome-webstore-upload-cli** (ZIP upload via the CWS API), and a manual `web-ext lint` check.

  ## TL;DR

  1. Land Conventional Commits on `main` (`feat:`, `fix:`, `feat!:`, etc.).
  2. release-please opens a release PR titled `chore(main): release debug-buddy x.y.z` whenever there are unreleased changes. Review and merge it.
  3. After merge, release-please creates a GitHub Release tagged `vx.y.z` and bumps `app/package.json` + `app/manifest.json` in lockstep.
  4. Trigger the **Publish to Chrome Web Store** GitHub Action (Actions tab → Run workflow). Or run `npm run publish:cws` locally with secrets set.
  5. Confirm the new version is live on the Web Store.

  ## Step-by-step

  ### 1. Conventional Commits → release PR

  Every commit on `main` must follow [Conventional Commits](https://www.conventionalcommits.org/). Husky's `commit-msg` hook enforces this locally; CI doesn't separately check.

  release-please watches `main` and opens a release PR aggregating all commits since the last tag. Mapping:

  | Commit type | Bump |
  |---|---|
  | `fix:` | patch (`1.0.0` → `1.0.1`) |
  | `feat:` | minor (`1.0.0` → `1.1.0`) |
  | `feat!:` or `BREAKING CHANGE:` footer | minor while `0.x`/`1.0.x` (pre-1.x policy), major after `2.0.0` cutover |
  | `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:`, `build:` | no bump |

  The release PR contains:
  - Updated `app/CHANGELOG.md` (auto-generated)
  - Bumped `version` in `app/package.json`
  - Bumped `version` in `app/manifest.json` (via release-please's `extra-files` config)
  - Updated `app/.release-please-manifest.json`

  Review the diff. If wrong, push corrections to `main` (e.g. amend changelog notes by editing the relevant commit's body) and release-please will update the PR.

  ### 2. Merge the release PR

  Squash- or rebase-merge to `main`. release-please then:
  1. Creates the git tag `vx.y.z`.
  2. Creates the GitHub Release with the auto-generated notes.
  3. Stops. **It does NOT publish to the Chrome Web Store.**

  ### 3. (One-time setup) Configure CWS secrets

  Skip this section if it's already done. Required GitHub repository secrets:

  | Secret | What it is | How to get |
  |---|---|---|
  | `CWS_EXTENSION_ID` | The extension's CWS ID (a long string in the dashboard URL after `/detail/`) | https://chrome.google.com/webstore/devconsole |
  | `CWS_CLIENT_ID` | OAuth2 client ID for the CWS API | Google Cloud Console → APIs → Credentials |
  | `CWS_CLIENT_SECRET` | OAuth2 client secret | Same place |
  | `CWS_REFRESH_TOKEN` | Long-lived OAuth2 refresh token | Run `npx chrome-webstore-upload-cli token` once locally and follow the prompt |

  Step-by-step token setup: see [chrome-webstore-upload-cli docs](https://github.com/fregante/chrome-webstore-upload-cli#getting-an-api-key-and-refresh-token).

  Add each secret via GitHub → repo settings → Secrets and variables → Actions → New repository secret.

  ### 4. Publish

  **Option A — GitHub Actions (recommended for production releases):**
  1. Actions tab → "Publish to Chrome Web Store" → "Run workflow".
  2. Branch: `main`.
  3. Toggle "Auto-publish to all users":
     - **Off (default):** Uploads as a draft. Visit the CWS dashboard to review and click "Publish" manually.
     - **On:** Goes live to all users immediately after Google's review (typically 1–48h).
  4. Click "Run workflow" and watch the action complete.

  **Option B — Local CLI (for hot-patching or testing):**
  1. Set the four `CWS_*` env vars in your shell (use a password manager, not `.env` checked into git).
  2. `cd app && npm run publish:cws` (upload-only draft) OR `npm run publish:cws -- --publish` (auto-publish).

  **Option C — Dry run (just build the ZIP, don't upload):**
  ```bash
  cd app && npm run package
  ```
  Produces `app/debug-buddy-x.y.z.zip` and exits. Useful for testing the ZIP contents or for manual upload via the CWS dashboard if the API is having issues.

  ### 5. Verify

  - https://chrome.google.com/webstore/detail/<id> shows the new version (may take minutes to propagate).
  - Reload the extension locally (`chrome://extensions` → toggle off/on) and confirm the new version number in `chrome://extensions`.

  ## Troubleshooting

  - **release-please didn't open a PR:** Check that at least one Conventional Commit landed on `main` since the last tag. `chore:`/`docs:`/etc. don't trigger a release.
  - **`web-ext lint` fails on publish:** The CI step would have caught it; if it slipped through, fix the manifest issue and reland.
  - **CWS upload fails with `invalid_grant`:** The refresh token expired. Regenerate via `npx chrome-webstore-upload-cli token` and update the `CWS_REFRESH_TOKEN` secret.
  - **Version mismatch between `package.json` and `manifest.json`:** Should never happen — release-please's `extra-files` keeps them in sync. If they diverge, manually patch and reland.
  - **Need to roll back a release:** Chrome Web Store doesn't support deleting a published version. Best path: bump a patch version with the rollback as a `fix:` commit and republish. The bad version stays in the store but new installs get the patched one.
  ```

- [ ] **Step 2: Add a one-line pointer in repo-root `README.md`**

  Find a sensible spot (e.g. after the "Installation" or "Usage" section). Add:
  ```markdown
  ## Releasing

  See [`app/RELEASING.md`](app/RELEASING.md) for the release flow (release-please + Chrome Web Store).
  ```

  Inspect `README.md` first to pick a non-disruptive insertion point.

- [ ] **Step 3: Commit**

  ```bash
  git add app/RELEASING.md README.md
  git commit -m "docs(release): document release flow in app/RELEASING.md"
  ```

---

## Task 5: End-to-end verification

**Why:** Phase gate. No commit. Confirms the cumulative effect.

- [ ] **Step 1: Clean install + all gates**

  ```bash
  cd app
  rm -rf node_modules dist
  npm ci
  npm run lint
  npm run typecheck
  npm run build
  npm run lint:ext
  npm test
  ```

  Expected: all six green. `lint:ext` may emit warnings (icon size, broad host_permissions) but exit 0.

- [ ] **Step 2: Dry-run the publish script**

  ```bash
  CWS_EXTENSION_ID=dummy CWS_CLIENT_ID=dummy CWS_CLIENT_SECRET=dummy CWS_REFRESH_TOKEN=dummy npm run package
  ls -la debug-buddy-*.zip
  unzip -l debug-buddy-*.zip | head -20
  ```

  Expected: ZIP exists, contents match `dist/`, no upload attempted.

- [ ] **Step 3: Validate workflow YAML syntax**

  ```bash
  # actionlint is the canonical tool for GH Actions YAML
  npx --yes -- actionlint .github/workflows/*.yml || true
  ```

  Expected: no errors. (If `actionlint` flags style issues, fix them; if it's noisy about minor nitpicks like 'shellcheck SC2086', use `# shellcheck disable=...` comments or address legitimately.)

- [ ] **Step 4: Validate release-please config JSON**

  ```bash
  cat app/release-please-config.json | jq .
  cat app/.release-please-manifest.json | jq .
  ```

  Expected: both parse without errors.

- [ ] **Step 5: Confirm `.gitignore` excludes ZIPs**

  ```bash
  git status
  # debug-buddy-*.zip should NOT appear as untracked
  ```

- [ ] **Step 6: Confirm git history**

  ```bash
  git log --oneline main..HEAD
  ```

  Expected (newest first):
  ```
  <hash> docs(release): document release flow in app/RELEASING.md
  <hash> feat(release): add chrome-webstore-upload publish script + workflow
  <hash> ci: add release-please workflow for automated versioning
  <hash> ci: add web-ext lint step to validate extension shape
  <hash> docs: implementation plan for Phase 7 (CI/release tooling)
  ```

  Five commits (4 feature + 1 plan).

---

## Done criteria

- All 4 task commits + plan commit present on the branch (Task 5 is verification, no commit).
- `npm ci && npm run lint && npm run typecheck && npm run build && npm run lint:ext && npm test` from `app/` is green.
- `npm run package` (with dummy CWS env) produces a valid ZIP and exits cleanly.
- `.github/workflows/{ci,release-please,publish-cws}.yml` all exist; CI on the PR has run web-ext lint successfully.
- `app/RELEASING.md` exists and explains the flow end-to-end.
- `README.md` links to `app/RELEASING.md`.
- `.gitignore` excludes `app/debug-buddy-*.zip`.
- After merge: the first `feat:`/`fix:` commit on `main` causes release-please to open a PR titled `chore(main): release debug-buddy x.y.z`. **(Cannot be tested on the branch — verified by user post-merge.)**
- After merge + release PR merge: the GitHub Release `v1.0.x` is created automatically. **(Same caveat.)**

Once the in-branch boxes are ticked, Phase 7 is ready to merge into `main`. The post-merge boxes get verified during the next routine release.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `web-ext lint` flags pre-existing manifest warnings as errors | Medium | Run locally first (Task 1 Step 3). If real errors surface, fix the manifest in this same task; if cosmetic warnings, exit-0 still; if blocking warnings, use `--ignore-files` selectively with a code comment explaining each suppression. Don't blanket-disable. |
| `release-please` config syntax wrong (action no-ops silently) | Medium | The action prints config-parse errors to its workflow log. After merge, monitor the first push for "release-please" workflow run; if it doesn't open a PR within 5 min of a `feat:`/`fix:` commit, inspect the action log. Iterate post-merge. |
| Initial state file (`1.0.0`) doesn't match actual git history | Low | release-please will compute the next bump from `1.0.0` based on commits since the manifest was created (i.e. since this PR merges). Pre-merge commits are NOT counted (release-please uses the manifest as the cutoff). Acceptable for clean-slate adoption. |
| `chrome-webstore-upload-cli` API auth fails with our token | Low | Tokens get tested by user during one-time setup (Task 4 step 3); auth errors surface clearly. RELEASING.md troubleshooting section covers `invalid_grant`. |
| `archiver` package size adds bloat to `node_modules` | Low | `archiver` is ~1MB; well-maintained; alternative (`adm-zip`) is fewer features. Acceptable. |
| Manual workflow dispatch lets contributors accidentally publish | Medium | Workflow only runs from `main` and uses repo secrets. If a contributor without push access can't trigger workflows on `main` (default GitHub permission is "write" required), risk is contained. Document in RELEASING.md that only maintainers should trigger. |
| `--auto-publish` flag publishes a buggy build | Medium | The default in the workflow_dispatch is unchecked (upload-only draft). User must explicitly opt in. Plus `web-ext lint` runs in the workflow before upload as a final guard. |
| `web-ext` v8 has different CLI surface than older versions | Low | Pin to `^8` in package.json; major version bump in future requires manual review. |

## Open follow-ups (not addressed in this plan)

These are flagged but out of Phase 7's scope:

1. **Coverage upload to Codecov / similar.** The `npm run test:coverage` script already exists; CI doesn't currently upload coverage. Future enhancement.
2. **Multi-browser publish (Firefox, Edge).** Spec marked as follow-up (line 350). Each browser has its own store API + manifest dialect. Significant effort.
3. **`bundlesize` or `size-limit` budget for `dist/main.js`.** Currently the bundle is ~620KB; the build warns at 500KB. Setting a hard CI limit would catch regressions.
4. **GitHub Release notes link to the CWS listing.** `release-please` supports custom release-notes formatting; could append a "Install from the Chrome Web Store" link automatically.
5. **`host_permissions` → `optional_host_permissions`.** Phase 6 deferred follow-up. Independent of this phase.
6. **`getStatusBadgeClass` consumer wiring.** Phase 5 follow-up. Independent.
7. **Pre-existing `try/catch` fallback sites in `ResponseDialog.tsx`.** Independent.
