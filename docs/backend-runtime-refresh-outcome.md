# Backend runtime refresh outcome

Date: 2026-10-03. Work started on `main` at `86d97a8209212579bf331637d11759e49fa1eab5`
with a clean worktree. No release, version bump, tag or live deployment is part
of this change. See [the design and official sources](backend-runtime-refresh-design.md).

## Changes

| Direct dependency | Before | After |
| --- | --- | --- |
| `pg` | 8.23.0 | 8.23.1 |
| `dotenv` | 18.0.3 | 18.0.5 |
| `pino` | 10.3.1 | 10.4.0 |

The reviewed lockfile also updates `pg-cloudflare` 1.4.0 → 1.4.1,
`pg-connection-string` 2.14.0 → 2.14.1 and `pg-protocol` 1.16.0 → 1.16.1,
and adds Pino's own `real-require` 1.0.0 resolution. The existing 0.2.0
resolution remains for the worker dependency. No unrelated packages, overrides
or allowed install scripts changed. The initial lockfile review used
`--ignore-scripts`; the subsequent clean install used the existing strict policy.

All new test/fixture code is ESM. No database schema, application query, API,
log format, parser mode, pool budget or recovery policy changed.

## Before-and-after regressions

The same tests were run against the old installed packages before upgrading.

- `pg` 8.23.0 mutated caller-owned query settings when using callbacks. It also
  swallowed an injected `ECONNRESET` after a real parameterized round trip.
  The mixed-parameter serialization baseline passed.
- Dotenv 18.0.3 wrote an injection notice to stderr during a side-effect import.
  Existing parsing and explicit quiet-mode tests passed.
- Pino 10.3.1 crashed when logging a valid JSON object with its own `__proto__`
  property. The worker fixture explicitly retains its worker reference through
  close; its initial unsettled-await failure was a test-harness issue, corrected
  before recording the package failure.

The updated logging and dotenv tests pass. Pino checks actual worker stdout and
rolling files, target-specific numeric levels, escaped child keys, redacted
synthetic secrets and worker shutdown. Subprocesses use bounded output/timeouts,
an explicit minimal environment and owned temporary directories.

The database regression uses the existing disposable PostgreSQL/pgvector runner
and per-suite databases. Fault injection is at the socket-event boundary after
a real query; it is not an operating-system TCP reset simulation.

## Validation

Local tools: pinned Node 24.21.0 and npm 12.2.0 on Windows; integration databases
run in disposable Linux containers. No check targets the running Classifarr data.

- Clean server `npm ci`: passed; reviewed install policy unchanged.
- Server `npm ls --all`: passed, no dependency-tree problems.
- Server `npm audit --json`, including development dependencies: zero findings.
- OSV Scanner 2.6.0: zero findings across all three lockfiles, 1,143 package
  entries; no exclusions added. Audits describe results on this date, not a
  guarantee that all dependencies are safe.
- Targeted dotenv/logging suite: 9 suites, 95 tests passed.
- Admission/private-runtime checks: 3 suites, 40 tests passed, including pressure,
  busy, cancellation and unsafe-configuration rejection paths.
- Full frontend coverage: 418 suites, 5,951 tests passed. Isolation and worker
  limits remained unchanged.
- Full backend coverage: 1,650 suites, 50,613 tests passed; one Linux-only case
  skipped on Windows and then executed successfully in Linux below.
- Coverage ratchet: passed against fresh reports from both workspaces. Backend
  line coverage 90.04%, branch coverage 85.50%; frontend line coverage 88.15%,
  branch coverage 79.02%. No baseline was lowered.
- Linux filesystem, dotenv and real logging-worker suites: 3 suites, 11 tests
  passed with zero skips after a clean Linux `npm ci --include=dev`. The runner
  used Node 24.21.0/npm 12.2.0 and the current server lockfile. Its immutable base
  was `sha256:5477561daf352b422a55529b75715c97279e4810e6ca56205afa821d05ae34b4`;
  current source/manifests were read-only mounts, with no live data mounted.
- Dependency/toolchain policy suite: 28 tests passed.
- Both workspaces' lint and typecheck: passed.
- CI preflight, both knip modes, copyright, static-import and ESM mock-shape
  checks: passed. Markdown lint and whitespace checks passed.
- Focused PostgreSQL/quality rerun: 4 suites, 36 tests passed. Legacy/discovery
  rerun: 3 suites, 76 tests passed. Shared-fixture consumers and matching
  ingestion/cross-process tests: 16 suites, 225 tests passed.
- Second full integration run: 227 suites/2,692 tests passed, 3 suites/8 tests
  failed, and one opt-in Compose suite/test was skipped. This run exposed the
  remaining host-memory fixtures and a legacy-retry timer leak described below.
- After those final fixture corrections, all affected and adjacent suites passed:
  legacy retry, pacing and scheduling (3 suites/47 tests); upgrade handoff
  (1 suite/1 test); sync 404 and API-key routes (2 suites/41 tests). A third full
  integration run was not performed; these focused reruns verify the final edits.
- The opt-in AI provider fault Compose test was also run through its dedicated
  command: one suite, one test passed. Its isolated stub, disposable database
  and project network were cleaned up. This is an integration result, not a
  production-image or release receipt.
- Staged secret scan: passed with no findings.

The first full integration run had 88 failures across 9 suites, 2,612 passing
tests and one opt-in Compose suite skipped. The quality-experiment test supplied
synthetic discovery memory but left shared admission reading host memory. Shared
import fixtures and several direct media-sync constructors also used host memory,
so a resource deferral left later retry tests without fixture inventory. These
setups now use the existing real-policy helper with controlled telemetry; the
matching entry points were corrected consistently. No production threshold,
database behavior or assertion was relaxed. These fixture gaps predate the update;
the failures do not establish a `pg` regression.

The second full run exposed two more host-memory-dependent fixtures: sync 404
routes and the host-run upgrade-handoff integration test. Both now use controlled
telemetry with the real admission policy; the analogous API-key route fixture
was aligned too. The standalone image probe remains unchanged and continues to
observe real container memory. The legacy-enrichment retry test also left a real
one-second continuation timer alive between cases. It now asserts that the wake
was scheduled and cancels it in `finally` before another fixture can be claimed.
No scheduling behavior or resource gate changed in production.

An initial Linux attempt used a stale test image with Node 24.18.1 and omitted
development dependencies. It did not execute Jest and is not counted as a pass.
The successful run above used the verified pinned toolchain and explicit dev
dependencies; nothing was installed into the host's global toolchain.

No external TLS server, Cloudflare runtime, native libpq, pipeline-mode query,
live rollout or new production-image rehearsal was exercised in this batch.
The application continues using its existing non-pipelined JavaScript driver.
Frontend browser/build behavior is unchanged; its earlier validation is recorded
in [the frontend outcome](frontend-tooling-refresh-outcome.md), not counted as a
new runtime-batch browser test.

## PR and CI status

Both the GitHub MCP search and the saved-login GitHub CLI returned zero open
Classifarr PRs. No random selection was possible; no closed or upstream PR was
substituted, and nothing was merged.

The starting commit's [CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/37138437552)
completed successfully during this work, including database, build/test and
fresh-install/published-upgrade checks. Release-only jobs were skipped as expected.
Those results belong to the starting commit, not this dependency update. New
post-push CI results must be evaluated for the new commit before release use.

## Next recommendation

Update shared ESLint/plugin tooling and review Node typings against the actual
Node 24 runtime. This keeps tooling failures separate from database/logging
runtime changes. That work is recorded separately in the
[lint tooling outcome](lint-tooling-refresh-outcome.md). Review Testcontainers/Supertest updates and the Vue client's
TypeScript 7 migration as subsequent bounded batches. Keep release publication
blocked on the existing exact-image gates; these local checks do not replace them.
