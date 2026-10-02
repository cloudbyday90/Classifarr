# Maintenance Policy

This document defines the current dependency and workflow maintenance policy for Classifarr.

## Goals

- Keep npm dependencies current without turning routine maintenance into noisy, unreviewable churn.
- Keep GitHub Actions pinned to immutable commits instead of floating tags.
- Route routine update work through CI-backed pull requests.
- Separate low-risk patch/minor updates from migrations that may need deliberate follow-up work.

## Automation

Automation is configured in [`/.github/dependabot.yml`](../.github/dependabot.yml).

Current behavior:

- `github-actions` updates run weekly on Monday.
- Root npm updates run weekly on Monday.
- Client npm updates run weekly on Monday.
- Server npm updates run weekly on Monday.
- Updates are grouped to reduce PR noise:
  - one grouped PR for GitHub Actions
  - one grouped PR for root npm
  - separate runtime and tooling PR groups for client
  - separate runtime and tooling PR groups for server

## GitHub Actions Policy

Workflow actions are pinned to full 40-character commit SHAs with an inline comment showing the corresponding tag version.

Example:

```yaml
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
```

Repository setting to enable manually in GitHub:

1. Open `Settings`
2. Open `Actions`
3. Open `General`
4. Enable `Require actions to be pinned to a full-length commit SHA`

This setting is not stored in the repo and must be managed in GitHub.

## npm Update Policy

Default preference:

- Accept patch and minor updates when they pass lint, tests, and builds.
- Treat major-version updates as migrations unless proven otherwise.
- Keep lockfiles committed and current.
- Use `npm ci` in CI workflows whenever a lockfile exists.

Current repo split:

- Root package: automation/helpers and repo tooling
- `client/`: Vue/Vite frontend dependencies
- `server/`: Express/backend dependencies

### Dependency Install Scripts

Use npm 12.2.0 with the committed workspace `.npmrc` files. Every workspace
enforces `strict-allow-scripts=true`; unreviewed dependency installers fail
installation. Exact identities in `package.json` record the review decision.

When updating a dependency with an installer:

1. Inspect its locked source, lifecycle command, network use and native fallback.
2. Run `npm --prefix server install-scripts ls --json` (or the affected workspace).
   This lists **unreviewed** scripts, not all scripts. An empty list does not
   mean installers are absent or universally allowed.
3. Record an exact-version `allowScripts` decision in that workspace. Registry
   packages use `name@version`; local sources use their source identity, not
   their self-declared name/version. Do not approve all packages or use a wildcard.
4. Run a clean `npm ci`, affected tests and native binding checks. Verify Linux
   image builds when production/native dependencies change.
5. Run `npm run test:tooling:dependencies` from the root with the pinned npm.

Currently only `bcrypt@6.0.0` is allowed. Optional native fallback and telemetry
installers remain denied; shipped platform bindings still need testing.
Never set `dangerously-allow-all-scripts` or use `ignore-scripts` to conceal a
failed review in production/CI. Do not commit credentials in `.npmrc`.
This policy restricts dependency installation hooks, not runtime execution or
explicit project scripts; it is not a sandbox.

Keep npm updates separate from application dependency sweeps. Preserve lockfile
versions/integrities unless that dependency is deliberately under review. See
the [npm 12.2 design](architecture/npm-12-2-design.md).

## Verification Expectations

For routine npm maintenance, use the smallest verification surface that matches the change:

- Root tooling changes:
  - `npm install`
  - `npm outdated --json`
  - any directly affected root script

- Client changes:
  - `npm --prefix client install`
  - `npm --prefix client run lint`
  - `npm --prefix client test`
  - `npm --prefix client run build`

- Server changes:
  - `npm --prefix server install`
  - `npm --prefix server run test:unit`
  - `npm --prefix server test` when Docker-backed integration prerequisites are available

Report platform skips separately from passing tests. The Linux-only
[migration-copy case](testing-linux-filesystem.md) must run on Linux (CI, WSL or
a disposable container) before claiming coverage for database-copy behavior.

## CI and Runtime Version Policy

Current maintenance posture:

- GitHub Actions read the exact Node version from `.nvmrc` and install the
  exact supported npm version.
- Docker runtime/build stages use concrete Node and npm versions in a shared
  Alpine base stage.
- CI service containers should prefer explicit image versions over floating tags.

Recommended pattern:

- Local, CI, and Docker Node: one exact LTS patch version in `.nvmrc` and the
  Docker build arguments
- npm and npx: one exact npm version; npx is bundled with npm and must not be
  managed independently
- Docker images: explicit patch/minor tag, with a digest pin evaluated for
  production release promotion
- Service images: explicit version pin instead of `latest`

## Review Guidance

When reviewing automated dependency PRs:

- Merge routine patch/minor updates after CI passes and no behavior regressions are found.
- Hold major updates for deliberate review when they affect:
  - linting or type-check rules
  - build tooling
  - runtime requirements
  - test framework behavior
  - Docker or workflow semantics

## Changelog Guidance

Do not record every bot PR as its own operational diary entry.

Preferred style:

- Summarize dependency refreshes as grouped release-note items.
- Summarize workflow maintenance and automation changes at the policy level.
