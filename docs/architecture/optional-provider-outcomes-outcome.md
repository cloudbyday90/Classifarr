# Optional-provider durable outcomes — outcome

Date: 2026-09-30. Implements [the design, research and trade-offs](optional-provider-outcomes-design.md).

## Delivered behavior

OMDb early-return paths now retain recoverable work. A stale quota warning latch
cannot suppress per-item outcomes or block later recovery. Active incomplete
settings yield a durable wait during the initial pass; absent/disabled settings
do not create retry work. Analyzed legacy items without usable credentials no
longer generate standard refill demand, and configuring the provider restores
eligibility without changing their inventory.

Quota exhaustion stays with OMDb recovery instead of moving work to web search
solely because the quota is unavailable. Genuine misses retain the existing
fallback. Type mismatches now create that fallback without accepting metadata or
ratings; retry enrichment applies the same type check. A retry mismatch records
its skipped outcome and fallback atomically.

No new table, scheduler, API contract or UI was needed. Existing small ESM policy,
provider and persistence modules were extended. The changelog remains under
Unreleased; there is no release or version bump.

## Reproduction and validation

Three initial PostgreSQL regression cases failed before implementation because
the quota latch, missing key and mismatch produced no durable row. A separate
recovery regression failed because retry processing incorrectly reported success
for a series result on a movie. These cases now pass using actual request
admission, task claims, retry persistence and the disposable integration schema.
HTTP is injected at the transport boundary; no live provider quota is spent.

Tests cover repeated refill settlement, per-item quota waits, movie/TV reset
recovery, a fresh retry service instance, credential repair, absent/disabled
provider activation, legacy missing-key eligibility, and rollback of failed
handoffs and mismatch fallbacks. Settlement also verifies that optional-provider
waits do not hold the shared ingestion/backfill readiness gate, and that an
unconfigured web-search fallback neither calls HTTP nor spends attempts.

Final validation:

- Complete backend rerun: **1,556 suites / 47,246 tests passed**.
- Complete frontend coverage run: **411 files / 5,795 tests passed**.
- Targeted PostgreSQL run: **15 suites / 236 tests passed**, covering quota,
  pacing, credential waits, legacy Plex/Jellyfin/Emby recovery, source identity,
  task/retry write fencing and refill. The new outcome suite's **13 tests** also
  passed again with the final settlement assertions. This is targeted integration
  coverage, not a claim that the entire integration suite ran.
- Backend measured coverage: **90.23% statements/lines, 85.07% branches,
  92.03% functions**. The cross-workspace coverage ratchet passed without changing
  its baseline. The full coverage run initially encountered the expected stale
  source-review fingerprint; after review refresh, the gate passed independently
  and the entire backend suite passed again with unchanged production code.
- Server test/security lint, type checking, both dependency checks, ESM imports
  and mock shapes, npm CLI flags, copyright, Markdown and whitespace checks passed.

Older success fixtures now declare their movie/series type instead of depending
on acceptance of incomplete provider evidence. No assertion was removed to allow
a mismatched result through.

Ownership review keeps the initial OMDb service's existing unresolved shared
writer classification. Passing the static drift gate does not certify all legacy
writers, authorize external writers or claim production-wide compatibility. The
gate still records 490 unresolved paths and `productionCompatible: false`.

## Scope and follow-up

Live containers, provider settings, routing and library data are unchanged.
No historical evidence is automatically removed. GitHub MCP returned no open
Classifarr PRs to choose from; none was selected, applied or merged.

Next: replace the isolated resource study's no-op provider adapter with bounded
faults and successful recovery. Measure unique completed items, attempts, waits,
queue settlement and CPU/RSS together. Do not adjust live limits based on repeat
task throughput or describe a durable wait as successful enrichment.
