# Native Policy Profile Refresh Automation

## Decision

Active native policies must not rely on a browser action or an operator dialog
to recover a missing or stale stored library profile. Classifarr now extends the
existing durable profile-refresh outbox with a second, server-owned request
shape for native-policy readiness.

The scheduler-owned planner scans only enabled libraries that have an active
native intent, observed media items, and a persisted profile that is missing or
older than the shared seven-day freshness limit. It creates a compact request
keyed to the library and observed profile version. A missing profile is instead
keyed to a bounded item-count/high-water-mark revision, so an empty library is
not polled and a later media import can trigger one new recovery request. The
existing outbox worker then claims and processes that request using its existing advisory lock, short lease,
`SKIP LOCKED` claim, and capped retry policy.

The policy-read endpoint stays read-only. A policy view can report a stale
profile immediately, but it cannot enqueue work, generate a profile, mutate a
policy, or depend on a browser session. The scheduled planner is the sole
native-readiness producer.

## Research

PostgreSQL documents row locking and `SKIP LOCKED` for coordination among
concurrent workers. The worker uses those semantics only for queue claims, not
for policy authority or application reads. [PostgreSQL explicit
locking](https://www.postgresql.org/docs/17/explicit-locking.html) and
[PostgreSQL partial indexes](https://www.postgresql.org/docs/17/indexes-partial.html)
support the short-claim and active-per-library constraints used here.

OWASP recommends allowlist validation and server-side semantic validation even
when an input originates in an internal workflow. The planner therefore builds
a fixed native-readiness record from database state and the migration enforces
its exact request shape. [OWASP Input Validation Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

OWASP also recommends logging meaningful operational events while excluding
secrets and unnecessary sensitive data. Planning and worker logs contain only
fixed status identifiers and counts, not profile labels, raw media metadata,
provider payloads, or exception messages. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options Considered

### Keep an Explicit Refresh Action in the Policy UI

Pros: minimal server work and direct operator control.

Cons: leaves a known, deterministic recovery step dependent on a browser,
creates inconsistent behavior for operators who never open the policy page,
and contradicts intent-first automation. Rejected.

### Generate the Profile While Reading Native Readiness

Pros: a stale summary could become current in the same request.

Cons: turns a read endpoint into a hidden write, holds HTTP capacity on profile
generation, cannot coordinate process crashes or concurrent readers, and makes
policy display depend on client traffic. Rejected.

### Add a Separate Native-Readiness Queue and Worker

Pros: isolates the new producer from learning-origin refreshes.

Cons: duplicates lease, retry, scheduling, monitoring, and profile-generation
logic; concurrent queues could regenerate the same library. Rejected.

### Generalize the Existing Durable Outbox With a Native-Readiness Request

Pros: one recovery mechanism, one worker lifecycle, active work coalesced per
library, fixed server-owned request provenance, and no browser dependency.

Cons: requires a guarded schema migration and a planner-to-worker contract.
Selected.

## Final Recommendation Stack

1. Keep policy summaries and browser reads side-effect free.
2. Scan only enabled libraries with active native intent, using persisted
   profile freshness and a bounded batch.
3. Append a fixed native-readiness request through the existing transactional
   outbox; never fabricate a classification, learning operation, or candidate.
4. Enforce one active refresh per library with a partial unique index, while
   retaining source-event idempotency for exact replays.
5. Recheck profile freshness after the worker claim and before generation so a
   concurrent successful refresh completes the claim without redundant work.
6. Retain the existing advisory lock, short claim transaction, UUID lease,
   `SKIP LOCKED` batch, and bounded retry policy.
7. Allow a planner failure to be observable but not to block delivery of
   already committed outbox work.

## Implementation

`20260726_140000_generalize_policy_profile_refresh_outbox.sql` adds a
`request_type` to the existing outbox. It preserves `learning_evidence` rows
and adds the constrained `native_readiness` shape. Learning records still need
their classification, operation, tier, candidate key, and fixed source system.
Native-readiness records must have none of those learning fields and instead
use the server-owned source, reason, and source-system identifiers.

The migration also coalesces any pre-existing duplicate active rows before
adding a partial unique index over active `(library_id)` values. An in-flight
row takes precedence during this upgrade, because it can still produce the one
required profile refresh.

`policyNativeProfileRefreshCandidateRepository.mjs` scans the database for
eligible active-native libraries with observed items.
`policyNativeProfileRefreshRequest.mjs` converts only missing or stale
persisted profile state into a compact outbox record. Missing-profile requests
also require the bounded item revision, preventing a completed empty-library
request from suppressing a later import. `policyNativeProfileRefreshPlanner.mjs` writes those records in one
short transaction and reports queued, replayed, coalesced, or invalid counts.

`PolicyProfileRefreshAutomationService` runs that planner immediately before
the existing outbox worker in the existing lock-protected schedule. A planner
failure is recorded with a fixed reason code, then the worker still delivers
prior committed learning or native-recovery refreshes.

The worker now re-reads profile freshness for a `native_readiness` claim. If a
different recovery path has already generated a current profile, it completes
the claim as `completedAlreadyCurrent` instead of generating again.

## Security Outcome

- No UI, API caller, AI provider, Discord event, or media-server payload can
  create a native-readiness request directly.
- All planner inputs are persisted database fields and all SQL remains
  parameterized.
- Database constraints separate learning provenance from native-recovery
  provenance and reject mixed or fabricated records.
- The partial unique index and token-guarded worker updates prevent concurrent
  active refreshes of the same library and stale-claim completion.
- Stored and logged data remain bounded to identifiers, timestamps, states,
  and counts. No raw profile distributions, media labels, or exception text are
  added.
- The planner performs no provider, TMDB, AI, routing, or policy-intent write.
  Profile generation remains the existing local media-item aggregation path.

## Verification

Focused unit coverage verifies request construction, active-native candidate
selection, transactional queue planning, exact replay, active-library
coalescing, scheduler delegation, planner-failure isolation, and the worker's
already-current and stale-profile race paths.

## Next Step

Update the native policy status surface to present a stale profile as
background recovery in progress instead of offering it as an operator action.
That UI task should consume only the existing read-only readiness summary and
must not add a browser-triggered refresh path.
