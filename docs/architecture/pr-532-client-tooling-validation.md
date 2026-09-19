# PR 532: local tooling integration and validation

Date: 2026-09-19. Design and outcome for the independently selected tooling change.

## Selection and implementation

GitHub MCP listed open PRs for this repository. The population contained only
[PR 532](https://github.com/cloudbyday90/Classifarr/pull/532); random selection over
that singleton selected it. Applied its package/lock changes locally from head
`e8ed9ab4450462029d01160636d359472ae1cd3f`, then reconciled overrides.
No GitHub PR merge, approval or release was performed.

| Direct tool | Previous | Applied |
| --- | --- | --- |
| Playwright | 1.62.1 | 1.63.0 |
| Node type definitions | 26.4.1 | 26.5.1 |
| ESLint | 10.9.1 | 10.10.0 |
| Vue ESLint plugin | 10.10.0 | 10.11.0 |
| Vite | 8.2.2 | 8.3.0 |

The supported Node runtime remains 24.18.1, and the product stays `0.48.4-beta`.
Node type definitions are tooling, not a runtime upgrade. ESLint now requires a
newer cache package; move the existing `file-entry-cache` override from 11.1.2 to
compatible 11.1.5. Move the jsdom-specific Undici override from 7.29.0 to patched
7.29.1. Regenerate the client lock without running installation scripts.

Official sources discovered through search/MCP and checked on this date:

- [Playwright releases](https://github.com/microsoft/playwright/releases),
  [Vite releases](https://github.com/vitejs/vite/releases),
  [Vue lint releases](https://github.com/vuejs/eslint-plugin-vue/releases) and
  [ESLint cache dependency update](https://github.com/eslint/eslint/pull/20801)
  support the selected versions and compatibility reconciliation.
- [Undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-8436-99hf-9mmv)
  identifies 7.29.1 as patched. Updating this test dependency does not assert that
  Classifarr's production paths used the vulnerable cache behavior.
- [npm override documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/)
  documents `$dependency` references for direct-dependency override compatibility.
  The reference is versioned documentation, not a recommendation to use npm 8.

## Previous-commit failure reconciliation

The previous application CI/CD and security scans passed. A separate
[Dependabot run](https://github.com/cloudbyday90/Classifarr/actions/runs/35440082898)
failed while proposing js-yaml 5.4.2: the direct dependency changed while its
duplicated `^5.2.3` override remained fixed, causing npm `EOVERRIDE`.

Change the server override to `$js-yaml`, preserving the direct version range and
current locked 5.2.3 resolution. A regression test asserts this relationship;
lock-only installation succeeds without a server lock diff. This removes the
observed conflicting-spec cause; a future hosted Dependabot run must still verify
its complete update workflow. It is not a js-yaml runtime upgrade.

## Browser failures and repair

The first development run included production-bundle checks, which must use a
built preview server. The separate production suite passed. Development now ignores
that file; both suites have separate artifact directories and still run independently.

Other failures involved obsolete lifecycle fixtures, absent proposal adjustment
data, invalid short references, ambiguous disclosure selectors and incomplete
source-health sibling responses. Three representative failures also reproduced in
a detached `77f31a50` worktree with the old tooling: overlap disclosure, automatic
recovery and no-action guidance. This is evidence of existing test drift, not proof
that every failure was exercised on the old stack.

Shared ESM fixtures now conform to strict adapters, scope mocks to real `/api/`
paths rather than intercepting Vite's `/src/api/` modules, and isolate unknown API
calls with explicit failures. Fixture contract tests catch those mistakes directly.
Keyboard disclosure, narrow viewport, stale-state and duplicate-admission assertions
remain. Swallowed click exceptions were removed.

A real aborted-response test then exposed admission retries; the production fix
and its tradeoffs are documented in
[policy admission recovery](policy-admission-no-replay-recovery.md).
Two-tab tests verify client reconciliation of mocked created/conflict results, not
server-side transactional uniqueness. PostgreSQL integration remains separate.

## Recommendation and verification

Recommend retaining the locally integrated updates and repaired harness. Benefits:
current tooling, patched test transport and meaningful recovery coverage. Costs:
a larger lockfile diff and browser-fixture maintenance. Do not loosen runtime
validators to accept obsolete test data or combine dev and production asset budgets.

Final stack: pinned lockfile → compatible explicit overrides → strict fixture
contracts → unit/coverage checks → isolated development and production browsers →
healthy Compose build → hosted checks after push. No new application framework.

Local verification:

- Full backend: 1,303 suites / 37,876 tests passed; final targeted server run:
  6 suites / 80 tests passed.
- Full client: 369 suites / 5,126 tests passed; statements 85.59%, branches 77.54%,
  functions 85.09%, lines 87.67%. The ratchet passed using current backend and client
  coverage; no threshold was reduced.
- Development Chromium: 24 tests passed. Production Vite build and cold route-asset
  checks: 7 tests passed with Playwright 1.63.0. A repeated run also exposed a
  timing-dependent ambiguous success-text selector; it now targets the status role.
- Real PostgreSQL recovery/backfill: 2 suites / 13 tests passed.
- Preflight, both type checks, server/client/Markdown lint, ESM import/mock checks,
  whitespace checks and all five release/provenance contract checks passed.

Hosted results are not implied by local passes. No version bump, release or merge
is requested.

Dependency updates can be reverted separately after security/compatibility review.
Browser repairs should remain unless the underlying contracts change again.
