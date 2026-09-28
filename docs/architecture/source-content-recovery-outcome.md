# Shared content recovery outcome

## Behavior

Implemented the [design and researched alternatives](source-content-recovery-design.md)
for Jellyfin, Emby and Plex movie/TV imports. One unavailable source now establishes
a durable shared wait instead of charging a new retry for every waiting library.
On eligibility, one owned canary validates bounded media and collection pages;
healthy normal imports remain concurrent. No provider/library names or IDs are
hard-coded.

| Situation | Result |
| --- | --- |
| Transport outage, 429 or 502/503/504 | Shared durable wait, then one recovery canary |
| Five unsuccessful attempts | Sparse six-hour probes, respecting longer server hints |
| Permission, missing library, malformed page or HTTP 500 | Library-local failure; no global outage inference |
| Owner/session lost during probe | HTTP cancelled; charged crash delay retained |
| Newer failure arrives before probe success | Old success rejected by epoch fence |
| Source configuration changes | Previous revision's circuit cannot block or overwrite the new source |
| Excessive Retry-After | Review required; no silent shortening or manual-sync bypass |

The existing watchdog excludes cooling sources from its ten-library batch.
No additional worker, polling timer, service, dependency or queue was added.
Existing SWR reads show a concise wait/review message and the later source/library
eligibility time. The W3C-compatible polite status region does not move focus or
announce changing counts. Unknown progress is not displayed as a percentage.

## Safety and limits

All circuit writes and the recovery lock use the current ingestion owner's leased
database connection. Probe attempts are charged before provider calls. The
configuration revision and circuit epoch reject stale success. Only fixed failure
categories and retry timing are retained, not provider payloads, tokens or URLs.

Recovery does not certify a complete import. Full enumeration, completeness,
pruning, unknown-owner, archive, music exclusion and learning gates remain intact.
Fresh/legacy supported libraries use the same existing adoption path. No historical
outage is inferred or backfilled from old error logs. The new migration is additive.

The watchdog has five-minute granularity and a bounded batch, so eligibility times
are not deadlines. Already-admitted requests can finish; a sequential 100-library
fixture does not imply only one request is possible during a concurrent outage.
This circuit covers ingestion media/collection pages, not catalog discovery,
unrelated enrichment/identity calls or external legacy scripts.

## Verification

Local synthetic HTTP fixtures and disposable PostgreSQL exercise all three
providers, 100 libraries on one unavailable source, independent sources, concurrent
healthy imports, exclusive probes, five-attempt persistence, Retry-After,
configuration changes, late-page failures without pruning, stale successes,
connection loss, fresh schemas and recovery into learning only after both movie
and TV imports finish. Unit tests cover safe classification, cancellation and
lock release when durable admission fails. Browser checks retain unsaved settings,
keep refresh read-only, and verify a readable mobile status.
Nested recovery canaries preserve their original media/collection cause rather
than replacing permission guidance with a generic outer preflight failure.

Validation on 2026-09-28:

- Full backend coverage: 1,508 suites / 45,374 tests passed.
- Full integration: 187 suites / 2,161 tests passed, with one existing suite/test
  skipped. Final focused integration after the diagnostic fix: 4 suites / 72 tests.
- Frontend coverage: 401 files / 5,648 tests passed; final API fixture rerun passed.
- Final focused backend regressions: 6 suites / 115 tests passed.
- Playwright status/unsaved-settings/mobile check and production frontend build
  passed. The final local image booted an empty database and passed schema drift
  comparison; test container/data cleanup completed without touching the deployment.
- Lint, server/client type checks, ownership/copyright/dependency preflight,
  migration integrity, policy gates, ESM checks and Markdown lint passed.

The coverage ratchet passed: backend statements/branches 90.30%/84.74%, frontend
statements/branches 85.95%/78.45%. No coverage or safety thresholds were lowered.
The standard schema command's
live-source precheck correctly reported unapplied migrations in the older local
deployment; the isolated current-image check passed instead. See the separate
[Actions investigation](actions-36305930631-investigation.md).

## Recommendation stack and next item

Keep PostgreSQL durable admission/session locks, the existing bounded native HTTP
client, modular ESM services and Vue/SWR status. This avoids new infrastructure but
adds an admission read per page and deliberately trades some recovery latency for
controlled outage traffic. [PR 547](pr-547-codeql-local-adoption.md) was adopted
locally without merging; no release or deployment was performed.

Next: improve failure evidence from the existing fresh-install/upgrade acceptance
checks, starting with bounded stderr and early container-exit reporting in the
schema harness. The [reported Actions run](actions-36305930631-investigation.md)
demonstrates why a generic timeout hides an actionable startup cause. Build on
the existing acceptance job instead of adding another recovery subsystem.
