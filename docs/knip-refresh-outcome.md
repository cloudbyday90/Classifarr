# Knip 6.39 refresh: outcome

Date: 2026-10-03. Starting revision: `b76ce7d64eeb064753a90687d1617593662c6b7a`.
See the [design, sources and tradeoffs](knip-refresh-design.md).

## Delivered

- Backend development dependency Knip 6.38.0 → 6.39.0. The lockfile changes
  only Knip's version, registry integrity and root dependency range. No added,
  removed or upgraded transitive packages; native packages remain unchanged.
- Eight ESM CLI contracts in `server/src/__tests__/knipContract.test.mjs`,
  automatically included in the existing backend unit suite. They run against
  installed Knip, not mocks of its reporting logic or private internal APIs.
- Updated ongoing quality-gate instructions and Unreleased. No new ignores,
  weaker rule severities, changed entry points, installer approvals or overrides.

## Before and after

After correcting a test-table argument-shape mistake in the new suite, the
unchanged 6.38.0 dependency produced **3 failures and 5 passes**. It incorrectly
reported the deliberately retained source export for direct and renamed
re-exports, and both the source/barrel exports in the alias case.

With 6.39.0, **all 8 contracts passed**. Untagged unused exports still fail,
including the untagged alias alongside the tagged export. This demonstrates
the upstream fix without claiming an existing Classifarr runtime defect.
The repository itself passed both uncached checks before and after the upgrade.

## Validation

Environment: Windows x64, pinned Node 24.21.0 and npm 12.2.0.

| Check | Result |
| --- | --- |
| Lock generation with scripts disabled | Passed; only Knip changed |
| Clean `npm --prefix server ci --no-audit --no-fund` | Passed under existing strict installer policy |
| `npm --prefix server ls --all` | Passed |
| `npm --prefix server audit --json` | Zero reported vulnerabilities, including development dependencies |
| Knip contracts, CI preflight, lint contracts | 3 suites / 22 tests passed; no skips |
| Existing code-health suite | 31,783 generated structural checks passed; no skips |
| Root `npm run test:tooling:dependencies` | 30 tests passed; no skips |
| Server lint and scoped typecheck | Passed |
| Full-repository Knip, normal and production-dependencies modes | Passed without cache and through both existing cached scripts |
| npm CLI flag and static-import checks | Passed |
| OSV Scanner 2.6.0, all three lockfiles | No issues across 1,143 package records; existing empty filter unchanged |
| Copyright, Markdown and staged whitespace checks | Passed |
| Gitleaks 8.30.0, staged changes | No secrets reported |

The 22-test result includes the eight new contracts; do not count them twice.
Structural checks are not thousands of distinct end-to-end scenarios. This was
scoped tooling validation, not a full backend/client/browser test run. Database
integration, coverage ratchet, image rehearsals and live provider tests were not
needed or executed for this development-only update. Production containers were
not rebuilt or restarted.

The CLI fixtures use only local generated ESM and package metadata. Child
processes have no shell, a 15-second timeout and a 1 MiB output limit, with a
small environment allowlist rather than inherited application credentials.
Fixtures and their caches are removed in `finally`. Invalid JSON configuration
returns exit code 2 rather than silently producing a clean report. Finding
reports return 1; valid clean analysis returns 0. No package download or live
service is used by the contract tests.

## PR availability and recommendation stack

GitHub MCP and the saved-login GitHub CLI both returned **zero open Classifarr
PRs**. Random selection was unavailable; no unrelated or closed PR was
substituted, and no PR was merged.

1. Keep Knip 6.39.0 with both analysis modes and the executable contracts.
   Benefit: corrected tag/alias reporting while retaining genuine findings.
   Cost: a small CLI fixture suite and ongoing review of detection changes.
2. Assess frontend TypeScript 7.0.2 compatibility with Vue tooling next. The
   frontend remains on 6.0.3; assess supported APIs, typechecking and builds
   before deciding to upgrade. A major version is a separate batch.
3. Keep `@types/node` 24.19.1 aligned with the Node 24 runtime rather than
   following the registry's newer Node 26 typings. The post-update server
   inventory has no remaining update within its declared dependency ranges.

The earlier interrupted-restore CI failure is not repaired or explained by this
tooling update. New-commit CI must be evaluated independently; local checks do
not establish image/release readiness. Clean vulnerability scans are evidence,
not a guarantee of security.

The dependency-update skill kept the package change isolated and required
before/after detection tests, lockfile review and development-dependency scans.
No version bump, tag, release, new branch or deployment is part of this change.

The subsequent Vue compiler compatibility review and scoped frontend refactor are
recorded in [the Vue TypeScript outcome](vue-typescript-compatibility-outcome.md).
