# Provider recovery probes: outcome

## Delivered

Implemented the [leased recovery design](provider-recovery-probes-design.md) on
September 29, 2026. Rejected OMDb, Tavily, Brave and Serper access can recover after
an account repair without editing an unchanged key. Checks run through the
existing enrichment scheduler only while eligible movie/TV work is waiting.

The implementation is split into ESM policy, query, quota, repository, transport
and coordinator modules. Migration 303 adds bounded per-configuration state;
configuration deletion removes its probe state. The shared HTTP client gains an
opt-in redirect policy without changing existing callers' default behavior.
Settings describe scheduled recovery and retain explicit corrective actions.
The Unreleased changelog records the behavior; no version or release was created.

## Verified behavior

- Concurrent workers reserve one probe and one quota unit for a configuration.
- Expired/crashed work retains backoff and uncertain request cost. Late results
  cannot clear a newer rejection or undo verified recovery.
- Success requires the same enabled configuration, generation, options and live
  lease. It rotates the generation to invalidate older in-flight failures.
- Empty setups, absent/exhausted demand, disabled libraries/servers, music,
  active ingestion and dependency cooldowns do not admit probe HTTP requests.
- Item retry attempts, due times, terminal states and inventory are not reset.
- Malformed, oversized, compressed, slow and redirected HTTP responses fail
  closed. Multi-day delay hints are preserved within the documented 30-day cap.
- Only fixed outcome categories and timing are retained; provider secrets and
  response bodies are not persisted or logged by the coordinator.

## Validation evidence

Runtime commit: `a3190019b658d75f43fb367f64fcf3542a2c9ef0`.

| Check | Result |
| --- | --- |
| Focused backend/HTTP regressions | 19 suites, 230 tests passed |
| Focused PostgreSQL regressions | 4 suites, 61 tests passed |
| Full backend, frozen runtime | 1,535 suites, 46,481 tests passed |
| Full frontend with coverage | 406 files, 5,719 tests passed |
| Full PostgreSQL integration | 198 suites, 2,339 tests passed; one existing opt-in Compose suite skipped |
| ESLint, server/client types, dependency and ownership preflight | Passed |
| ESM/static-import and mock-shape gates, policy gates | Passed |
| Frontend production build, migration validation, isolated schema comparison | Passed |
| Coverage ratchet | Passed for server and client; baseline unchanged |
| Fresh installation and published upgrade | All 12 checks passed; cleanup passed |

The first full backend run also passed all 46,481 tests. A complete rerun against
the frozen runtime passed after the multi-day delay correction, taking 510.163
seconds. An initial integration fixture used an invalid ingestion phase and one
frontend assertion expected the old status text; both were corrected and the
affected suites rerun. No validation gate or coverage baseline was weakened.
Markdown lint passed all 1,650 documents. Final statement coverage was 90.23% for
the server and 86.02% for the client; the coverage ratchet reported no regression.

HTTP tests use fixtures and a local loopback server, not paid provider calls.
Database tests use disposable PostgreSQL, not the persistent library database.
This evidence does not claim a live-account verification against each provider.

## Installation and deployment boundary

The clean-source installation receipt completed at `2026-09-29T12:32:22.642Z`.
It verified published `v0.48.4-beta` provenance, a fresh installation, scheduler
progress, crash recovery, persisted-volume upgrade, interrupted-restore rejection,
explicit verified retry, and movie/TV recovery through learning.

PostgreSQL `180006` reached 303 migrations on both the fresh and upgraded database;
the published baseline had 222. Candidate image ID:
`sha256:729347a917d174a1b5298e353ba59d1af50a2c919976de6587c19bd2b57ee849`.
The runner removed only its disposable containers, volumes, network and candidate
image tag; none contained user library data. The regeneration receipt remains
under `.tmp/ci/runtime-installation-acceptance.json`, intentionally uncommitted.

The live Classifarr container, persistent data and routing settings were left
unchanged. No release, tag, live Compose rebuild or live deployment was performed.
GitHub MCP searches on September 29 returned no open Classifarr PRs, so no random
PR could be selected or implemented; none was merged.

## Recommendation and next component

Keep the existing scheduler, modular ESM services, PostgreSQL leases and bounded
native HTTP. The benefit is automatic, restart-safe recovery without spending
per-item attempts. The cost is a small migration, occasional provider credits and
intentional waiting under backoff. An external workflow engine or another polling
daemon is not warranted for this fixed workflow. Official sources and the option
comparison are in the design document.

Next: **atomic shared web-provider quota admission**. Ordinary web searches still
check usage-based soft limits and record cost after requests; concurrent callers
can pass the same check. Probe reservations are conservative, but do not close
that wider race. Give ordinary searches, retries and probes one bounded reservation
contract, with concurrency/crash/day-and-month-reset tests. Keep cached hits free,
retain uncertain costs conservatively, and never reset media retry budgets to
recover provider access.
