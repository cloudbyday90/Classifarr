# Supertest loopback refresh: outcome

Date: 2026-10-03. Starting revision: `4a4881ac33fbe71914c64282a7d4c46b3aaf1a41`.
See the [design and official research](supertest-loopback-design.md).

## Delivered

- Supertest 7.3.0 → 7.3.1 in backend development dependencies. Only its resolved
  package version, registry integrity and root dependency range changed in the
  lockfile. No package was added/removed and no transitive version changed.
- Ten ESM tests using public HTTP/Supertest interfaces. They cover loopback-only
  generated listeners, deferred URL/query construction, callback completion,
  cookie agents and redirects, concurrency, assertion/timeout cleanup,
  caller-owned IPv4/IPv6 listeners, and injected asynchronous startup failure.
- Existing npm installer approvals, security overrides and production listeners
  are unchanged. No schema, API, UI, deployment or release changes.

## Before and after

Against 7.3.0, the new suite produced **2 failures and 8 passes**:

1. The generated listener reported `::`, not the required `127.0.0.1`.
2. The injected startup error was replaced by a null-address `TypeError`.

After installing 7.3.1, **all 10 passed**. They also passed inside the broader
HTTP unit selection below. The reported macOS port-sharing scenario was not
reproduced on this Windows host; the explicit binding contract was verified.

## Executed validation

Environment: Windows x64, repository-pinned Node 24.21.0 and npm 12.2.0.

| Check | Observed result |
| --- | --- |
| Initial lock generation with scripts disabled | Passed; only Supertest changed |
| Clean `npm --prefix server ci --no-audit --no-fund` | Passed with existing strict installer policy |
| `npm --prefix server ls --all` | Passed |
| `npm --prefix server audit --json` | Zero reported vulnerabilities, including development dependencies |
| HTTP unit suites importing Supertest | 136 suites / 1,379 tests passed; no skips; 77.895 seconds |
| HTTP integration suites importing Supertest | 36 suites / 694 tests passed; no skips; 84.976 seconds |
| `npm run test:tooling:dependencies` | 30 passed; no skips |
| Backend lint and scoped typecheck | Passed |
| Knip normal and production dependency modes | Passed |
| npm CLI flags, static import and copyright checks | Passed |
| OSV Scanner 2.6.0, all three lockfiles | No issues across 1,143 package records; existing empty filter unchanged |
| Markdown and staged whitespace checks | Passed |
| Gitleaks 8.30.0, staged changes | No secrets reported |

The **2,073 HTTP tests** include the ten new contracts; do not add them again.
The integration runner used disposable PostgreSQL databases, not live appdata.
Selection was all `*.test.mjs` / `*.test.js` files importing `from 'supertest'`,
split at `src/__tests__/integration/`. From `server/`, use the existing
`scripts/run-jest.mjs --runTestsByPath` wrapper: unit tests used two workers and
512 MB worker-idle recycling; integration tests used their configuration and
`--runInBand`. Both selections used `--no-coverage`.

These are scoped checks, not the full backend suite. Client/browser suites,
coverage ratchet, optional provider-fault Compose test, macOS testing and image
rehearsals were not run. No application container was rebuilt or restarted.
Clean scanners do not prove absence of vulnerabilities.

## Recommendations and boundaries

GitHub MCP and the saved-login GitHub CLI both found **zero open Classifarr PRs**.
Random selection was unavailable; no PR was substituted or merged.

Final recommendation stack:

1. Keep upstream Supertest 7.3.1 plus these lifecycle contracts. Benefit:
   local-only fixtures and correct startup error handling. Cost: maintaining a
   small dependency-contract suite and validating future lifecycle changes.
2. Review Knip 6.38.0 → 6.39.0 next, with detection/configuration regressions and
   both normal/production modes. A separate batch makes any detection changes
   attributable to Knip rather than HTTP tooling.
3. Keep Node typings on 24.x. Review frontend TypeScript 7 only when compatible
   with the Vue toolchain; a larger latest version is not enough justification.

The earlier interrupted-restore CI failure remains a separate investigation;
this development-only dependency patch does not establish its cause or repair.
Evaluate subsequent CI against its own commit and image evidence.

The dependency-update skill kept the change limited to one package and required
the before/after contract test, lock review and development-dependency scans.
No version bump, tag, release or new branch is part of this change.
