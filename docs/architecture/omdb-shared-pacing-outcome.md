# Shared OMDb pacing outcome

Implemented September 29, 2026, under Unreleased. No release, version bump,
production database operation or deployment. The separate
[design document](omdb-shared-pacing-design.md) records official sources,
alternatives, tradeoffs and the recommended stack.

## Delivered

- Automatic ID, title and search requests now share a PostgreSQL admission floor
  with recovery probes. Timing and daily credit commit before HTTP. The old
  process-local sleep queue is gone; no transaction spans HTTP or sleep.
- Bounded Retry-After observations extend waits for the current configuration and
  credential generation only. Verified same-key recovery transfers wait evidence;
  changed credentials ignore old long waits but retain the one-second floor.
- Admission waits preserve attempts and do not trigger web-search fallback.
  Retry planning checks timing before claiming work and uses the existing
  coalesced wake. Fresh, disabled and quota-blocked setups do not create requests.
- A source-digested IMDb-miss checkpoint lets a restarted retry continue with the
  title lookup. It expires after 24 hours, contains no title/key/response body,
  and is cleared on source change or terminal result. Title admission checks its
  credential generation under the same configuration lock before spending.
- Existing pausable SWR status views receive the existing waiting category and
  timing fields. Daily quota retains its original meaning. No client API shape,
  routing settings, AI behavior, music eligibility or ownership policy changed.
- Added an additive migration and regenerated the fresh-install schema snapshot.
  Checkpoints are nullable and bounded to 1 KiB; pacing storage is one row.

## Verification

- Real disposable PostgreSQL: 13 suites / 200 tests passed, including lookup/probe
  contention, rollback, lock timeout, restart, credential changes, continuation,
  quota, read-only readiness and existing retry ownership/maintenance regressions.
- Frontend coverage: 411 suites / 5,795 tests passed; 86.11% statements, 78.76%
  branches, 85.56% functions and 88.03% lines. Containerized production build passed.
- Additive migration was exercised against the prior schema, then the regenerated
  snapshot was loaded and round-trip checked in a second isolated container.
  A final-image fresh-setup check found zero automatic OMDb admission records
  and zero continuation checkpoints after startup readiness.
- Type checks, repository lint, documentation lint, dependency checks, migration
  naming/snapshot checks, ESM checks, four policy gates and 32 dependency-tooling
  tests passed. Copyright and ownership drift reviews are current.

- Frozen-code backend coverage: 1,545 suites / 46,907 tests passed; 90.21%
  statements and lines, 84.99% branches and 92.03% functions. The four new services
  have 100% statement, line and function coverage; branch coverage is 100% except
  the header/error policy at 95.65%.
- The combined coverage ratchet passed against both fresh reports without
  changing thresholds or baselines. No reported validation failure remains.

## Limits and recovery

The floor is a local admission policy, not an OMDb account-wide guarantee or exact
network-arrival spacing. Explicit connection tests, external clients and older
binaries remain outside it. No external paid API request was used for validation.

Database admission failures fail closed before HTTP and defer for rechecking
without charging an item attempt or triggering fallback. An uncertain commit is not
replayed or refunded. Wait-observation persistence failures produce a deduplicated
warning but cannot discard successful evidence or replay HTTP; the committed base
floor remains. A crash before the retry-result transaction can repeat an IMDb
miss, since this is at-least-once recovery, not exactly-once upstream execution.

Existing dependency-wide retry cooldowns remain a separate gate and can still
delay retries after credentials change. This patch does not clear those records
or claim that every historical wait is generation-scoped.

Rollback of application code can leave the additive columns/table in place; do
not remove live timing records merely to force retries. Migration deployment must
precede starting the new application code. Existing ingestion/claim checks remain
authoritative; time alone never proves an unknown historical writer has stopped.

The ownership drift review explicitly watches the new modules. Indirect SQL
analysis limitations and existing shared-writer debt are retained, not waived.

## PR disposition

Initial and repeat GitHub MCP searches returned no open PRs for this repository.
There was no eligible random selection. No PR was merged, reopened or substituted
with an already-closed change.

## Recommendation and next component

Keep Node ESM services, PostgreSQL admission and the existing scheduler.
Benefits: bounded durable coordination, restart recovery and no new deployment
dependency. Costs: a few short queries per request and explicit handling of
continuation evidence. A separate broker is not justified for this request rate.

Next: **credential-scoped retry cooldown recovery**. The current
`enrichmentRetrySchedulePolicy.mjs` persists transport cooldowns by dependency,
and `enrichmentRetryCandidates.mjs` withholds work until those records expire.
Neither record identifies the credential generation that caused the wait.
Consequently, old transport waits can still postpone work after a key is fixed,
even though shared pacing correctly ignores the old generation.

Associate future cooldown evidence with the provider/configuration/generation;
reconcile only demonstrably obsolete waits after repair, preserving valid
same-key waits and conservatively expiring legacy unknown records. Verify that
recovering one provider cannot reopen another provider's blocked work. Reuse the
current status view for a concise reason and next action; no new daemon or AI
evaluator is needed for this deterministic recovery problem.
