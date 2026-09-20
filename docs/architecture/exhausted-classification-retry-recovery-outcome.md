# Exhausted classification retry recovery: outcome

Date: 2026-09-20. Follows the
[design, tradeoffs, and official-source research](exhausted-classification-retry-recovery-design.md).

## Root cause and implementation

The scheduler's exhaustion transition and the retry service disagreed: the former
made the record `failed`, while the latter rejected that status. The previous
live-routing diagnostics commit did not change this lifecycle. Its complete
[CI/CD run](https://github.com/cloudbyday90/Classifarr/actions/runs/35524615176)
and the five security/copyright workflows passed before this follow-up.

A pure ESM eligibility module now identifies exhausted, pre-route AI failures
using their persisted status, method, absent destination/retry time, and valid
retry counters. History's list and detail responses include a derived
`retry_recovery` field. The same predicate is applied again under the existing
history row lock; neither the client projection nor arbitrary metadata grants
authority. A generic failed classification is not sufficient.

Only a server-selected manual retry may recover an exhausted record. Scheduler
retries additionally recheck remaining budget under the lock, so a stale selection
cannot bypass exhaustion or retry a row that moved to operator review. The existing
transaction preserves task deduplication, request lineage, outcome recording, and
learning evidence. Manual recovery starts a fresh bounded cycle; automatic retries
carry the existing counter. No policy threshold, confirmation setting, source
metadata, routing grant, or learning policy was changed.

History uses a small recovery component, the existing named API method, a native
button, and inline accessible status. It checks the per-item queue result instead
of assuming HTTP success means a retry was queued. A lost response, changed row,
duplicate task, denied permission, or closing the detail view cannot produce a
false success or an automatic second submission. No new polling or acknowledgement
screen was introduced.

## Operator steps

1. Restore the configured AI provider/model or correct its configuration.
2. Open **History**, then select the failed item's title.
3. Eligible exhausted records show **Automatic retries stopped**. Select
   **Retry Classification** once and follow progress in the Command Center.
4. If a task already exists, let it finish. If the response could not be confirmed,
   check the Command Center and reopen History before attempting another retry.

This change enables existing qualifying records without a migration or bulk
backfill. It deliberately does not claim that a reachable provider proves every
failed operation safe to replay.

## Verification

- Focused server regression: eight suites, 111 tests passed.
- Retry/authentication route regression: three suites, 117 tests passed, including
  read-only and anonymous denial and ignored client source/budget overrides.
- Focused client regression: three files, 42 tests passed; final recovery-component
  rerun also passed after adding direct duplicate-invocation assertions.
- Real PostgreSQL integration: one suite, ten tests passed. Movie and TV exhaustion
  transitions, two concurrent service instances, duplicate pending tasks, rollback
  after insertion, manual budget reset, and stale scheduler rejection are covered.
  These tests use the isolated integration database, not the operator's library.
- Browser regression: mobile containment, keyboard activation, inline live status,
  exactly one POST, History refresh, and removal of the action after reopening the
  reclassified record passed against both Vite and the Compose-served production
  assets, using intercepted synthetic API fixtures. The retained screenshot was
  visually inspected; no real classification was retried by the browser test.
- Rebuilt local Compose smoke: healthy, zero restarts, no OOM. The deployed module
  passed eligibility/budget assertions. A read-only check found one existing failed
  record, which qualifies for recovery. Anonymous History GET and retry POST both
  returned 401; the UI returned 200. This smoke performed no application-data
  writes, provider calls, or media routes.
- Full backend coverage: 1,367 suites, 40,000 tests passed; statements/lines 90.30%,
  branches 83.62%, functions 92.45%. The new eligibility module has 100% coverage
  in all four metrics.
- Full client coverage: 370 files, 5,171 tests passed; statements 85.62%, branches
  77.59%, functions 85.10%, lines 87.69%. The recovery component has no uncovered
  statements, functions, or branches. The combined coverage ratchet passed without
  baseline changes.
- Lint, type checks, copyright/dependency preflight, ESM import/mock-shape checks,
  documentation lint, and local container build passed.
- The separate production-naming gate still reports 43 pre-existing production
  references against its zero baseline. The count is unchanged; no waiver or
  baseline relaxation was made.

The open-PR collection was checked twice through the GitHub connector and was
empty. No PR could be randomly selected; none was merged or claimed as implemented.
No release, tag, version bump, new dependency, or database migration is included.
Private data and test artifacts remain in ignored directories.

## Recommendation and next item

Keep the existing PostgreSQL transaction/queue, shared ESM eligibility, and small
Vue recovery component. This repairs an actual blocked workflow with little new
infrastructure; its remaining limitation is operator intervention after exhaustion.

The next high-value item is **dependency-aware automatic recovery with a durable
replay budget**, not another sampling study or additional review UI:

- Reuse existing provider health checks and circuit-breaker infrastructure. The
  current `classificationProviderRecovery` module is a safe result projection, not
  a durable redrive executor; do not build a competing retry queue.
- Distinguish transient outages from invalid input, permissions, and missing-model
  configuration. A successful reachability check alone is not model readiness.
- Persist the recovery attempt limit/cooldown and claim in PostgreSQL. Bound work
  per recovery event and recheck current classification state before enqueueing.
  Restarting the app or repeating a health notification must not renew the budget.
- Prove outage → exhaustion → verified recovery → one bounded resubmission across
  two workers, repeated failures, rollback, and restart. Preserve cancellation,
  already-routed exclusions, learning provenance, and all normal routing checks.

The benefit is fewer user actions during temporary outages; the cost is durable
state and stronger concurrency/lifecycle tests. Implement this targeted recovery
handoff before adopting another orchestration product or weakening routing gates.
