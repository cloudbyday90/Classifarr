# Comparison resource retry design

Date: 2026-10-06. Follows the
[resident-memory findings](comparison-resident-memory-outcome.md).

## Evidence and intended behavior

The unchanged catalog study completed import, metadata and vector backfill but
missed comparison revalidation before its 25-minute deadline. After three real
failures/invalidations, a memory refusal increased the same exponential counter
again, delaying the next admission check by 480–600 seconds. A deterministic probe
of that exact image reproduced the delay without calling a provider.

Use a small ESM retry-policy factory for comparison, following the representative
refresh pattern without changing that worker. Typed `DiscoveryDeferredError`
outcomes (`busy`, `memory_pressure`, `memory_unknown`) impose a 60-second resource
cooldown. They neither increment nor reset genuine failure history. Independent
resource/failure deadlines prevent a deferral from shortening an outstanding
failure delay. Actual failures, invalidation, degraded builds and cache-capacity
refusals retain the existing exponential sequence, six counter increments,
30-minute base cap and clamped 0–25% jitter (37.5-minute maximum including jitter).

Successful cacheable publication/revalidation and disabled configuration remain
the reset points. Commit the success reset only after admission's final checkpoint
returns; pressure at that checkpoint must not erase prior failure history.
Clock rollback/invalid clock and a changed warm
entry clear eligibility deadlines, not failure history, as before. Cold configuration
changes do not gain a new budget-reset path. Caller cancellation/shutdown do not
spend or reset retry history. Five-minute successful refresh scheduling stays in
the refresher; the helper creates no timers and stores no model or error objects.

## Safety, prerequisites and completion

- Disabled/unsupported configuration and background readiness retain their no-work
  paths. Readiness pauses do not clear failure history. Late scheduler ticks do
  at most one attempt; the 60-second delay is eligibility, not exact execution time.
- Preserve memory thresholds, hysteresis, unknown-memory refusal, advisory lock,
  shared reservations, one active attempt, 250 ms pressure checks, six-minute
  deadline and publication checkpoint. Every eligible attempt re-enters admission.
- Keep source/model/configuration/revision verification, cache capacity and TTL.
  Contention can retain verified cache only within its existing validity; pressure
  or unknown memory clears it. No partial publication on pressure or cancellation.
- Retry the existing read/fit/in-memory publication path, not uncertain remote
  mutations. No migration, deployment setting, operator action, forced GC or
  allocator flag. Existing sanitized diagnostic codes and log deduplication stay.
- Retry state is process-local and disappears on restart as before. This recurring
  maintenance worker has no lifetime attempt cap: rate, concurrency and each
  attempt are bounded, not the installation's total future maintenance attempts.

First reproduce the mixed-failure regression against unchanged code. Verify exact,
early and late eligibility; repeated refusals; retained true-failure escalation;
cache invalidation; cancellation; clock/configuration changes; and unchanged real
admission. Then run focused/broad checks, a clean no-cache image build and the
unchanged isolated catalog study through ready **and** later revalidation. Preserve
failed traces; do not extend the deadline or inject clock advances into image proof.
Finally recreate only local testing Compose, dump/check schema in isolated
containers and observe health. Unraid and unrelated containers are out of scope.

## Research, options and recommendation stack

Official sources discovered/retrieved on October 6, 2026:

- [AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)
  recommends error classification, bounded retry work, jitter and testing overload
  behavior. Keep existing exponential jitter for actual failures. Our fixed local
  resource-eligibility delay is a project-specific policy, not an AWS duration or
  a replacement for request retry limits.
- [Node AbortSignal documentation](https://nodejs.org/docs/latest/api/globals.html)
  documents composed cancellation and preserving the abort reason. Continue using
  the existing admission/cancellation path; do not replace pressure with a generic
  failure or let an eligible retry bypass cancellation.
- [DefinitelyTyped version policy](https://github.com/Definitelytyped/DefinitelyTyped)
  aligns declaration major/minor versions with the described library/runtime.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Separate resource cooldown from true failures | Rechecks capacity promptly while preserving real failure history | More bounded admission checks during pressure; recommended |
| Reset all history on refusal | Simple | Hides real failures and weakens backoff; reject |
| Lower safeguards or extend the study deadline | Easier apparent completion | Does not fix retry accounting; reject |
| Add global scheduling/persistent retry state | Broader coordination | Unnecessary schema and behavior expansion; defer |

Stack: fix and prove retry classification; repeat unchanged natural recovery and
revalidation; then resume native/anonymous-residency attribution before selecting
another memory optimization. This is not a claimed memory-leak fix.

## Random PR trial plan

Fresh enumeration found two open PRs (#555 and #556); random selection chose
[client Node declarations #555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. Apply its exact manifest/lockfile
change locally and run the unchanged runtime-major gate before installation.
Node 26 declarations conflict with the pinned Node 24 deployment; revert only
that trial if rejected, without a merge or runtime-major expansion. Registry
metadata confirms 26.6.4 and undici-types ~8.9.0. Client postcss 8.5.29 and Vite
8.3.3 are separate available patch updates, not part of this runtime change.
