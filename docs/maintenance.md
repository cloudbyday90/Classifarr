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

## CI and Runtime Version Policy

Current maintenance posture:

- GitHub Actions use the rolling Node `24` line.
- Docker runtime/build stages are pinned to a concrete Node `24.x` Alpine image.
- CI service containers should prefer explicit image versions over floating tags.

Recommended pattern:

- CI runners: major-line pin such as `node-version: '24'`
- Docker images: explicit patch/minor tag or digest pin
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
