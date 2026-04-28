# Releasing Debug Buddy

This doc describes how a new version of Debug Buddy reaches the Chrome Web Store. Tools involved: **release-please** (versioning + changelog), **chrome-webstore-upload-cli** (ZIP upload via the CWS API), and a custom **`lint:ext`** validator (Chrome MV3 manifest sanity check).

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
| `feat!:` or `BREAKING CHANGE:` footer | minor while in pre-1.x bump policy, major after 2.0.0 cutover |
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
| `CWS_EXTENSION_ID` | The extension's CWS ID (long string in dashboard URL after `/detail/`) | https://chrome.google.com/webstore/devconsole |
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
Produces `app/debug-buddy-x.y.z.zip` and exits. Useful for testing the ZIP contents, or for manual upload via the CWS dashboard if the API is having issues.

### 5. Verify

- https://chrome.google.com/webstore/detail/<id> shows the new version (may take minutes to propagate).
- Reload the extension locally (`chrome://extensions` → toggle off/on) and confirm the new version number in `chrome://extensions`.

## What the validator checks

`npm run lint:ext` (defined in `app/scripts/validate-extension.mjs`) runs in CI on every PR after `npm run build`, and the publish script re-runs it as defense in depth before any upload. It validates:

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

## Troubleshooting

- **release-please didn't open a PR:** Check that at least one Conventional Commit landed on `main` since the last tag. `chore:`/`docs:`/etc. don't trigger a release.
- **`lint:ext` fails on publish:** The CI step would have caught it; if it slipped through, fix the manifest issue and reland on a new patch version.
- **CWS upload fails with `invalid_grant`:** The refresh token expired. Regenerate via `npx chrome-webstore-upload-cli token` and update the `CWS_REFRESH_TOKEN` secret.
- **Version mismatch between `package.json` and `manifest.json`:** Should never happen — release-please's `extra-files` keeps them in sync. If they diverge, manually patch and reland on a new patch version.
- **Need to roll back a release:** Chrome Web Store doesn't support deleting a published version. Best path: bump a patch version with the rollback as a `fix:` commit and republish. The bad version stays in the store but new installs get the patched one.
- **`workflow_dispatch` button doesn't appear:** Only repo collaborators with `Actions` write permission can trigger it. Ask a maintainer.

## File map

| File | Purpose |
|---|---|
| `.github/workflows/release-please.yml` | Watches `main`, opens release PRs |
| `.github/workflows/publish-cws.yml` | Manual upload to Chrome Web Store |
| `.github/workflows/ci.yml` | Lint/typecheck/build/lint:ext/test on PRs |
| `app/release-please-config.json` | release-please config (paths, version sources) |
| `app/.release-please-manifest.json` | release-please state (current version) |
| `app/scripts/validate-extension.mjs` | Chrome MV3 manifest validator |
| `app/scripts/publish-cws.mjs` | Build + ZIP + upload pipeline |
| `app/CHANGELOG.md` | Auto-generated by release-please |
