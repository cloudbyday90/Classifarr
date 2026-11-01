# Capture workload check cancellation outcome

Date: 2026-10-31 (America/New_York).
Design: [agreed scope, official research and alternatives](capture-workload-check-cancellation-design.md).

## Result

Automatic capture's workload guard now bounds initial, periodic and fresh
reservation checks. A check has one three-second budget from acquisition through
both SELECTs and result acceptance, plus the existing cancellation cleanup of up
to 1.5 seconds. Its second read receives only the remaining budget. Shorter
inherited SQL timeouts remain effective.

The fixed reader preserves two separate transactions and inherited isolation.
Budget/revision/window refusal still skips readiness. Initial/periodic and fresh
reservation checks use separate fixed database scopes; no monitor result can
stand in for fresh reservation evidence. Local role ownership bounds overlap to
one check per role. Each database scope stays charged through its read cleanup
and actual acquisition settlement, preventing queued growth across replacements.
There is no queue or cached-success path.

The small owned-check service handles deadlines, parent cancellation and closing.
The existing guard retains the serial two-second monitor schedule. Callback
completion or failure closes admission, aborts pending reads and drains both
owned roles together while preserving the callback's primary result/error.
Escaped and late checks cannot admit new work. No query details, caller abort
reason or raw caught error is logged; local uncertainty retains the existing
evaluation_workload_deferred refusal.

Reservation, budget reads that insert/reset/prune, finish, checkpoint and
publication writes are unchanged. Replay, quota, revision, window, cooldown and
provider-response checks remain independent. No charged attempt is refunded or
uncertain provider work replayed. Default-off setup, automatic schedules and
existing status/UI stay unchanged. No operator CLI trigger, endpoint, setting,
job, schema, routing, learning, release or deployment is added.

## Verification and corrections

The original guard failed the new callback-completion regression: its pending
monitor had no cancellation signal. The regression now passes. Focused lifecycle,
read-bound, scheduler, budget, refresh and ownership/code-health checks passed
twelve suites / 37,586 tests. Tests cover exact deadlines, remaining timeout,
short-circuit refusals, pre-abort, fresh reservation evidence, unexpected overlap,
primary-result preservation and simultaneous role drain without timer rearming.

The final new PostgreSQL suite passed twelve tests through the production
database factory. It proves actual read-only transactions and unchanged budget
state; two queued role acquisitions stay bounded through ten recreated guards,
then late grants execute no SQL. A shared deadline refuses initial work without
resuming it later. Both real SELECT phases cancel independently without harming
another reader, and shorter inherited deadlines survive unavailable control.
The actual second server timeout shrinks after time spent in the first transaction.

Repeatable-read and serializable fixtures retain an old snapshot inside the first
transaction, then prove the second sees a committed readiness change. A loopback
HTTP fixture blocks an actual monitor read until the shared deadline, observes
the generation connection close, retains one charged request / 8,448 tokens and
prevents another dispatch or publication. Existing workload/HTTP checks passed
nine tests; related database cancellation, readiness, evaluation and budget
regressions passed six suites / fifty-eight tests.

The first PostgreSQL run exposed a fixture-only unique-URL collision. Synthetic
servers now have unique endpoints; the corrected suite passes. No production
data or paid provider was involved.

The ownership gate correctly rejected the new SQL reader and stale entry for the
old guard, which no longer owns SQL. Reviewed the complete reader/check lifecycle,
guard/callers, both fixed queries and shared database/cancellation/admission paths.
Moved that one source-boundary entry under the same existing review. Other pins,
analysis digests, classifications, baseline revision and one-hundred-group limit
remain unchanged. The rationale was condensed within the existing 2,000-character
cap rather than relaxing it. The gate passes with productionCompatible: false;
this does not resolve unrelated writer debt or authorize production recovery.

Backend lint/type checking, both dependency scans, static ESM import/mock shape
checks, copyright, four policy gates, Markdown, whitespace and staged secret
checks passed.

Full backend coverage passed 1,913 suites / 62,019 tests, with one existing skip,
in 918.639 seconds. Coverage was 89.22% statements/lines, 86.64% branches and
90.77% functions. The new reader and owned-check service reached 100% across
these metrics. The scheduling guard reached 100% statements/lines/functions and
80% branches. The coverage ratchet passed without baseline changes, reusing the
October 30 client report because client source is unchanged. No fresh frontend
test/build is claimed.

Artifact maintenance reused the same-day verified growth inventory and fresh
Docker snapshots. Classifarr retained its container identity, image, start time
and healthy state; isolated PostgreSQL containers are gone. No files or images
were removed. Current evidence, backups and recovery/reference assets remain
protected, and other projects were untouched. No image build, deployment or
restart occurred.

## Limits and next item

Only workload checks and their guard finalization are bounded. Earlier capture
budget/repository operations and its failure handler's unsigned budget.finish
remain unchanged write paths. Whole-worker shutdown is not bounded by this
change. Normal callback completion can cancel owned reads, but does not prove
remote inference termination, refund a reservation or authorize replay.

The timer is not a hard event-loop SLA. Setup before the shared runner installs
local settings retains connection defaults. Cancellation dispatch is not proof
of server termination; unavailable control relies on the existing server fallback
and uncertain-client discard. Actual pool acquisition can outlive local check
completion; its scope remains charged until settlement without blocking guard
finalization. Admission is per database module/process, not a cross-process lease,
and resets with its pool.

The unsigned failure-finalization follow-up is addressed in the separate
[cooperative stop outcome](capture-failure-finalization-stop-outcome.md).
It preserves awaited write settlement and uncertain commit handling; it adds no
write deadline or full shutdown guarantee. Finish ordering/cooldown preservation,
library comparison and caller cancellation of admitted workers remain separate.

GitHub MCP found no open PRs, including Dependabot, so no random local PR
implementation or stale rebase was applicable. No PR was merged. Unreleased
records the automatic behavior, and the design document records the recommendation
stack and pros/cons.
