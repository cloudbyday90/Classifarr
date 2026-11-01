# Capture finalization cooldown preservation outcome

Date: 2026-11-01 (America/New_York). Status: implemented and verified.
Design and official sources:
[cooldown preservation design](capture-finalization-cooldown-preservation-design.md).

## Change and evidence

Before implementation, four isolated PostgreSQL regressions reproduced the same
problem: captured, waiting_for_replay, budget_exhausted and deferred each replaced
an unavailable outcome's one-hour deadline with five minutes.

Finish now awaits a singleton/revision-bound row lock, checks its existing stop
signal, and separately dispatches the UPDATE. The SQL lives in the existing
adjudicationBudgetSql module. Its CASE/GREATEST expression retains a later deadline
only inside the reader's existing future/sixty-minute horizon. Due, past and
ignored finite far-future values receive the requested deadline. The UPDATE's
post-lock statement time anchors both the requested interval and validity test.

This prevents a waiting short finalizer from rejecting a concurrently saved
one-hour cooldown against an older command-time horizon. The later status still
writes normally, and fingerprint COALESCE, stale zero-row results, bootstrap,
configuration revision, counters, progress and caches retain their contracts.
The process-local failure fallback remains five minutes and independent.

The extra query runs on the existing transaction's client, holds at most the
matching row, and retains inherited isolation and per-statement fifteen-second
statement/one-second lock timeouts. No queue, retry or write-cancellation runner
was added. Stop while waiting for the prelock prevents the subsequent UPDATE once
the query settles. Already-executed SQL can roll back, while an already-dispatched
COMMIT can still succeed despite stop or a lost acknowledgement. Existing awaited
settlement, uncertain-client discard and no-replay rules remain authoritative.

## Verification

The original baseline passed three PostgreSQL suites / twenty-two tests. The new
four-case regression then failed against the original SQL before the fix.

The focused PostgreSQL run passed four suites / forty-one tests, including:

- All four short statuses preserving the exact saved deadline; unavailable
  extending a shorter deadline; fingerprint replacement/COALESCE and quota
  preservation through disable/resume.
- Past, due, shorter and longer valid deadlines, exact sixty-minute inclusion,
  one-microsecond overflow, finite far-future replacement and schema infinity
  refusal. Exact boundary fixtures use one PostgreSQL command message rather
  than changing the server clock or claiming elapsed cooldown testing.
- Concurrent finalizers in both orders, with the second prelock observed waiting
  before the first UPDATE computes its deadline. The long deadline survives that
  race exactly. Inherited repeatable-read isolation and both existing timeout
  settings are observed through the production database factory.
- Real one-second lock refusal without state changes; stale revision/no-op;
  stop during queued acquisition and prelock wait; rollback after real UPDATE;
  and delayed/lost acknowledgement after real COMMIT without replay or refunds.

Adjacent isolated PostgreSQL checks passed three suites / twenty-one tests for
inner workload cancellation, database recovery and restore-session ownership.
The restore-reference suite passed ten tests, including added merge/replace
checks proving the complete local budget row survives and its fingerprint is
absent from the portable export. Together these runs passed eight PostgreSQL
suites / seventy-two tests. They use isolated fixtures, not a production restore.

Focused service, database ownership, code-health and inventory-ownership tests
passed four suites / 37,515 tests. Backend lint/type checking, both dependency
scans, static import/mock-shape checks, copyright and four policy checks passed.

The inventory ownership gate passes with productionCompatible false. The exact
repository, imported SQL, callers and transaction/stop path were reviewed before
updating its source digest and review text. Its original baseline, analysis digest,
unresolved classification and historical ownership debt were retained. This gate
does not authorize production writers or live activation.

## Delivery and limits

The process remains automatic with existing admission and status surfaces. No UI,
operator CLI trigger, endpoint, setting, job, schema, provider capability, routing
or learning authority was added. The design documents official research available
through October 2026, tradeoffs and the recommendation stack. No diagnostic
payload or raw error exposure was introduced.

Preservation is bounded by the existing reader policy. A backward clock step can
make a previously valid timestamp exceed that horizon and become replaceable.
This is not unconditional monotonic time, a whole-finalizer deadline or a durable
attempt-ordering protocol. Per-statement timeouts do not bound pool acquisition,
commit acknowledgement or whole-worker shutdown.

Same-revision status can still be overwritten, even while the longer cooldown is
retained. Stale zero-row finishes remain ordinary query results. Singleton
recreation and deletion/recreation races remain separate. No uncertain operation
is replayed or refunded.

Next: design explicit finalization outcome/attempt ownership, starting with
distinguishing a stale zero-row finish from an acknowledged update. Evaluate its
effect on status publication and retries before changing authority. Keep singleton
lifecycle and broader write cancellation separately scoped.

## Validation handoff

Full backend coverage passed 1,913 suites / 62,025 tests, with one existing skip,
in 909.329 seconds. Coverage was 89.22% statements/lines, 86.64% branches and
90.77% functions. The coverage ratchet passed without baseline changes. Client
source is unchanged; the ratchet reused the October 30 07:37 client coverage-final
report. No fresh client test/build is claimed.

Markdown passed 2,418 files; whitespace and staged secret checks passed. Unreleased
records the change, and the predecessor outcome links to this batch. Work and
delivery use main, with no version bump, release, deployment or service restart.

GitHub MCP found no open PRs, including Dependabot, on the final intake. Random
open-PR implementation and stale dependency rebasing were therefore inapplicable.
No PR was merged.

Artifact maintenance reused the verified filesystem inventory and captured fresh
Docker context/daemon, all-container and image metadata. The Classifarr container,
image, start time and healthy state are unchanged; no Testcontainers remain.
Previous metadata-change exclusions and unreviewed older files remain protected,
along with recovery assets and shared Docker resources. No files or images were
removed. Shared transient fixtures observed during the task were left untouched;
their cause is unassessed. Private receipts remain in .tmp.
