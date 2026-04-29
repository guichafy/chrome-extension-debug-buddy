# Releasing Debug Buddy

This doc describes how a new version of Debug Buddy reaches the Chrome Web Store. Tools involved: **semantic-release** (automatic versioning + changelog + GitHub Release on every merge to `main`), **chrome-webstore-upload-cli** (ZIP upload via the CWS API), and a custom **`lint:ext`** validator (Chrome MV3 manifest sanity check).

## TL;DR

1. Land Conventional Commits on `main` (`feat:`, `fix:`, `feat!:`, etc.).
2. The `Release` GitHub Action runs automatically on every push to `main`. If there are release-worthy commits since the last tag, it:
   - bumps `app/package.json` and `app/manifest.json` versions in lockstep,
   - regenerates `app/CHANGELOG.md`,
   - commits the bump back to `main` with `[skip ci]` (no recursion),
   - creates the git tag `vx.y.z`,
   - publishes a GitHub Release with auto-generated notes.
3. The **Publish to Chrome Web Store** workflow auto-triggers on `release: published` and uploads the ZIP **as a draft** to the Chrome Web Store (no `--publish`). Manual `workflow_dispatch` is still available for hot-fixes or re-uploads.
4. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → Debug Buddy → click **"Submit for review"** to send the draft to Google's review queue. Confirm the new version is live afterward.

There is **no intermediate release PR** to review. Conventional commit messages on the merging PR ARE the source of truth.

## Step-by-step

### 1. Conventional Commits → automatic release

Every commit on `main` must follow [Conventional Commits](https://www.conventionalcommits.org/). Husky's `commit-msg` hook enforces this locally. If you squash-merge a PR, edit the squashed commit message to follow the convention before merging.

semantic-release decides whether to release based on the commits since the last `vx.y.z` tag. Mapping (configured in `app/.releaserc.json`):

| Commit type | Bump |
|---|---|
| `fix:`, `perf:`, `refactor:`, `revert:` | patch (`0.0.1` → `0.0.2`) |
| `feat:` | minor (`0.0.1` → `0.1.0`) |
| `feat!:` or `BREAKING CHANGE:` footer | major (`0.0.1` → `1.0.0`) |
| `docs:`, `style:`, `test:`, `build:`, `ci:`, `chore:` | no release |

If the commits since the last tag include only no-release types, the workflow exits cleanly with "no release published" — no version bump, no tag, no GitHub Release.

### 2. What the Release workflow does

When a release-worthy push lands on `main`:

1. **Checkout, npm ci, build, lint:ext.** Same gates as the PR CI. If any fail, the release aborts.
2. **`npx semantic-release`** runs:
   - **commit-analyzer** scans commits since the last tag and computes the next version.
   - **release-notes-generator** builds the changelog entry.
   - **changelog plugin** prepends it to `app/CHANGELOG.md`.
   - **exec plugin** runs `node scripts/sync-manifest-version.mjs <version>` to mirror the version into `app/manifest.json`.
   - **git plugin** commits `package.json`, `package-lock.json`, `manifest.json`, `CHANGELOG.md` with message `chore(release): x.y.z [skip ci]\n\n<notes>` and pushes to `main`. The `[skip ci]` token + the workflow's `if: github.actor != 'github-actions[bot]'` guard ensure the bot's commit doesn't re-trigger the workflow.
   - **github plugin** creates the `vx.y.z` git tag and the GitHub Release with the auto-generated notes.

The whole flow runs in one workflow execution (~2 min). No intermediate PR.

### 3. (One-time setup) Configure CWS secrets

Skip this section if it's already done. Secrets live in the **`ChromeStore` GitHub Environment** (Settings → Environments → ChromeStore → "Add environment secret"), not at the repo level. The workflow declares `environment: ChromeStore` to scope access. Required:

| Secret | What it is | How to get |
|---|---|---|
| `CWS_EXTENSION_ID` | The extension's CWS ID (long string in dashboard URL after `/detail/`) | https://chrome.google.com/webstore/devconsole |
| `CWS_CLIENT_ID` | OAuth2 client ID (type: **Desktop app**) for the CWS API | Google Cloud Console → APIs → Credentials |
| `CWS_CLIENT_SECRET` | OAuth2 client secret | Same place |
| `CWS_REFRESH_TOKEN` | Long-lived OAuth2 refresh token | Run `npx -y chrome-webstore-upload-keys` locally, follow the browser prompt; the terminal prints the token. Use the same Google account that owns the extension on the Web Store. |

Add each secret via GitHub → repo Settings → Environments → `ChromeStore` → New environment secret.

### 4. Publish to Chrome Web Store

The `Release` workflow creates the GitHub Release. The `Publish to Chrome Web Store` workflow then auto-triggers on `release: published` and uploads the ZIP **as a draft** (no `--publish`). The "Submit for review" click stays manual on purpose — it gives a maintainer a chance to eyeball what's about to ship and Google's review queue cannot be aborted once submitted.

**Option A — Automatic on every release (default):**
1. Merge a Conventional Commit to `main`. The `Release` workflow runs.
2. The `Publish to Chrome Web Store` workflow auto-triggers on the new GitHub Release and uploads the ZIP as a draft (~3 min).
3. Visit the [CWS Developer Dashboard](https://chrome.google.com/webstore/devconsole) → Debug Buddy → confirm the **Draft** column shows the new version → click **"Submit for review"**.
4. Wait for Google's review (1–48h). You receive an email when it's approved or rejected.

**Pre-releases are skipped.** The job has `if: github.event_name == 'workflow_dispatch' || github.event.release.prerelease != true`, so manually-marked pre-release tags (e.g. `v1.0.0-rc.1`) don't trigger upload. The Chrome Web Store rejects versions with suffixes anyway. Use `workflow_dispatch` if you ever need to force-upload from a non-stable tag.

**On failure, an issue is opened.** If the auto-triggered run fails (token expired, network blip, validator regression, etc.), the workflow opens a `CWS publish falhou para vX.Y.Z` issue tagged with the run URL. Fix the underlying issue and re-trigger via `workflow_dispatch`. Requires `issues: write` permission on the workflow's `GITHUB_TOKEN` (declared in the workflow's `permissions` block).

**Environment approval (optional).** The job is scoped to the `ChromeStore` GitHub Environment. If the environment is configured with **Required reviewers** (Settings → Environments → ChromeStore), every run — including the automatic one after release — pauses until a maintainer approves it on the Actions UI. The `Deployment branches and tags` setting on the same environment should be restricted to `main` and the `v*.*.*` tag pattern to keep secrets out of feature-branch workflows.

**Option B — Manual workflow_dispatch (re-runs, hot-fixes):**
1. Actions tab → "Publish to Chrome Web Store" → "Run workflow".
2. Branch: `main` (the tagged version is what's checked out).
3. Toggle "Auto-publish to all users":
   - **Off (default):** Uploads as a draft (same as Option A). Visit the CWS dashboard to "Submit for review" manually.
   - **On:** Skips the draft step — goes straight to Google's review and auto-publishes once approved.
4. Click "Run workflow" and watch the action complete.

**Option C — Local CLI (for hot-patching or testing):**
1. Set the four `CWS_*` env vars in your shell (use a password manager, not `.env` checked into git).
2. `cd app && npm run publish:cws` (upload-only draft) OR `npm run publish:cws -- --publish` (auto-publish).

**Option D — Dry run (just build the ZIP, don't upload):**
```bash
cd app && npm run package
```
Produces `app/debug-buddy-x.y.z.zip` and exits. Useful for testing the ZIP contents, or for manual upload via the CWS dashboard if the API is having issues.

### 5. Verify

- The GitHub Release at `https://github.com/<owner>/<repo>/releases` shows the new tag and notes.
- https://chrome.google.com/webstore/detail/<id> shows the new version (may take minutes to propagate).
- Reload the extension locally (`chrome://extensions` → toggle off/on) and confirm the new version number in `chrome://extensions`.

## What the validator checks

`npm run lint:ext` (defined in `app/scripts/validate-extension.mjs`) runs in CI on every PR after `npm run build`, in the Release workflow before semantic-release runs, and in the publish script as defense in depth before any upload. It validates:

- `dist/manifest.json` parses as JSON.
- `manifest_version === 3`.
- Required string fields: `name`, `version`, `description`.
- `background.service_worker` file exists in `dist/`.
- `options_page` and `side_panel.default_path` resolve under `dist/`.
- All icons in `icons` and `action.default_icon` exist.
- `web_accessible_resources` patterns match at least one file (warning if not).
- `version` matches Chrome Web Store's accepted format (1–4 dot-separated integers, no pre-release tags like `1.0.0-rc1`).
- `permissions` array contains only known Chrome MV3 permissions (warning-only — list updated as Chrome evolves).

It exits 0 on success (even with warnings) and 1 on errors. **Why custom?** Mozilla's `web-ext lint` only knows the Firefox WebExtensions schema and flags Chrome-only fields like `background.service_worker` as invalid. Google doesn't ship a Chrome-aware equivalent.

## Avoiding workflow recursion

The Release workflow pushes a commit back to `main` (the version bump). Two safeguards prevent that commit from re-triggering the same workflow:

1. **`[skip ci]` in the commit message** — GitHub Actions natively respects this token and skips workflow runs for commits containing it.
2. **`if: github.actor != 'github-actions[bot]'` guard** in the workflow — defense in depth in case the token is stripped by some intermediate tool.

The PR CI (`ci.yml`) only triggers on `pull_request`, not `push`, so the bot's commit doesn't trigger it either.

## Troubleshooting

- **Release workflow ran but didn't tag/release:** The push had only no-release commits (docs, chore, style, etc.). Check the workflow log for "no release published". To force a release, land a `fix:` or `feat:` commit (even a trivial one).
- **Release workflow failed at `git push`:** The bot doesn't have permission. Check `permissions: contents: write` is set in the workflow YAML (should be).
- **`lint:ext` fails on release:** The PR CI step would have caught it; if it slipped through, fix the manifest issue and reland on a new fix commit.
- **CWS upload fails with `invalid_grant`:** The refresh token expired or was revoked. Regenerate via `npx -y chrome-webstore-upload-keys` (uses the same OAuth client) and update the `CWS_REFRESH_TOKEN` secret in the `ChromeStore` environment.
- **Workflow fails with "secret not found":** The `Publish to Chrome Web Store` job needs `environment: ChromeStore` set. Check that all four secrets (`CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`) exist on that environment, not on repo-level Actions secrets.
- **Version mismatch between `package.json` and `manifest.json`:** Should never happen — `sync-manifest-version.mjs` keeps them in sync via the exec plugin. If they diverge, manually patch and reland on a new fix commit.
- **Need to roll back a release:** Chrome Web Store doesn't support deleting a published version. Best path: bump a patch version with the rollback as a `fix:` commit and republish. The bad version stays in the store but new installs get the patched one.
- **`workflow_dispatch` button doesn't appear:** Only repo collaborators with `Actions` write permission can trigger it. Ask a maintainer.
- **Two release workflow runs queued:** The `concurrency` group `release-${{ github.ref }}` ensures they serialize, not cancel. The second one will see no new commits and exit cleanly.

## File map

| File | Purpose |
|---|---|
| `.github/workflows/release.yml` | Auto-release on push to `main` |
| `.github/workflows/publish-cws.yml` | Manual upload to Chrome Web Store |
| `.github/workflows/ci.yml` | Lint/typecheck/build/lint:ext/test on PRs |
| `app/.releaserc.json` | semantic-release config |
| `app/scripts/sync-manifest-version.mjs` | Mirrors package.json version into manifest.json |
| `app/scripts/validate-extension.mjs` | Chrome MV3 manifest validator |
| `app/scripts/publish-cws.mjs` | Build + ZIP + upload pipeline |
| `app/CHANGELOG.md` | Auto-generated by semantic-release |
