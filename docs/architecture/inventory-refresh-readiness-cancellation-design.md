# Inventory refresh readiness cancellation design

Date: 2026-10-31 (America/New_York). Status: implemented and verified locally.
See the separate [outcome](inventory-refresh-readiness-cancellation-outcome.md).
Predecessor: [primary log normalization outcome](primary-log-data-normalization-outcome.md).

## Problem and agreed first boundary

Description and representative refreshes use a preliminary readiness read before
heavy locks, cache scans and model clients. The current read acquires a normal
transaction, then installs a three-second SQL timeout. Pool acquisition and BEGIN
precede that setting. The outer wrapper coalesces callers and fences late results
after stop, but does not cancel the pending probe or forward caller cancellation.

Limit this batch to those two automatic refresh runtimes. Other consumers of
withInventoryBackgroundReadiness/readInventoryBackgroundReadiness retain their
existing behavior. Preserve readiness SQL, scheduler cadence/startup delay,
worker caches/cooldowns, resource admission, ownership fail-stop and retry
authority. Add no UI, operator CLI trigger, setting, endpoint, job, schema,
provider call, release, deployment, cleanup or restart.

The database module already provides explicitly read-only cancellation with
owner fencing, a local caller deadline, guarded queries, targeted same-role
cancellation, statement-timeout fallback and client discard. Reuse that boundary
without changing cancellation semantics for its existing consumers or for writes.

## Agreed resource contract

Use a three-second probe budget starting before connection acquisition. It covers
pool wait, transaction setup, readiness SQL and acceptance of its result. Keep
the existing read runner's bounded cancellation cleanup, which can add up to
1,500 ms before the caller settles. These are timer/cleanup budgets, not a hard
real-time guarantee under a blocked event loop or a server termination SLA.

The read runner cannot remove pool.connect from pg's pending queue. Merely racing
the returned transaction promise against a timer can let repeated probes leave
more acquisitions behind, especially with a long configured connection timeout.
Per-runtime state also resets when scheduling replaces a worker.

Add narrow process-local admission in the database module, keyed by two fixed
logical refresh scopes. One scope admits at most one read operation or undrained
acquisition; there is no admission queue. Keep its slot until both the read's
existing cleanup and the actual connect promise have settled. Track that specific
promise, never infer drain from pool counters. Stable database-module scope state
survives stop/re-registration of a runtime. Distinct refresh types can proceed
independently, subject to the existing shared pool and control limits.

Expose the scope only through the internal read-only transaction adapter. Reject
unknown scopes and use outside explicit signaled read-only work before acquiring.
Ordinary transactions and other abortable reads keep their existing path. Use
public pg pooling/release APIs; do not mutate private queue structures, replace
the pool, change global timeouts or introduce another connection pool.

A pre-aborted probe never acquires. A late grant after abort is released without
BEGIN or readiness SQL, using the existing read runner. A new runtime/tick while
the prior scope is draining defers immediately and cannot add another acquisition.
Once drain completes, the existing automatic cadence can run a fresh check.
No timer replays the abandoned request or starts heavy work after a late grant.

## Agreed lifecycle and result contract

Keep one coalesced flight per wrapper, with the first non-aborted caller owning
its signal and arguments. Later callers share that flight and cannot cancel its
owner through a newly supplied signal. A pre-aborted joining caller receives its
own cancelled result without affecting the active flight. This does not add a
queue of caller requests or perform a second worker invocation.

Permanent stop aborts the current probe and stops the underlying worker; stop
wins over every pending probe result. Caller abort returns cancelled. Local deadline
and known occupied-scope admission return deferred/unavailable. None admits heavy
work, creates a worker cooldown, changes recovery state or announces recovery.
Expected stop/caller cancellation, local deadline and occupied-scope deferral do
not mint readiness failure diagnostics. Existing cancellation-control transport
warnings retain their existing behavior; no new warning category is introduced.

After a ready result, recheck stop, owner cancellation and deadline before
invoking the worker. Clear the probe timer/listeners after the probe, before
heavy work begins: the three-second budget must not shorten an admitted worker's
existing execution budget. Preserve its original caller arguments and stop path.
Readiness permits the worker's normal checks; it proves neither storage health
nor successful refresh completion.

Continue to observe actual query/transaction boundaries. Capture a trustworthy
query failure observed while the probe is live before the shared read runner
can replace its exception. Preserve that existing evidence for diagnoses such as
native SQLSTATE 57014; do not derive SQLSTATE from AbortError, a local clock,
caller reason, raw text or a provider object. Stop/caller cancellation remains
quiet. Failures first observed after local abort cannot upgrade that deadline
into a database cause. Setup/commit cancellation without surviving native proof
remains unknown. Preserve the shared read runner's error contract for other users.

Do not reapply SET LOCAL statement_timeout='3s' inside the bounded callback: that
could lengthen a shorter existing setting or the remaining probe budget. Reuse
the existing runner's transaction-local minimum of remaining and inherited
statement time, with the unchanged readiness SQL. Its setup stages before local
settings retain existing connection defaults. Cancellation requests are best-effort;
the checked-out target remains pinned during control cleanup and is discarded
after abort. Do not return an uncertain session to another borrower or replay SQL.

No new durable state exists. Process restart resets admission along with its
pool; this is not a cross-process lease or retention mechanism. Existing owner
fencing remains authoritative. A long pool timeout can delay drain and therefore
defer one scope for longer than the caller budget, without accumulating requests.

## Official research, alternatives and recommendation stack

Sources discovered and read through MCP on 2026-10-31, alongside installed
pg 8.23.1 / pg-pool source and the repository's existing cancellation tests:

- [node-postgres pool API](https://node-postgres.com/apis/pool) documents FIFO
  acquisition and mandatory release/destructive release. Installed source
  confirms native queue timeout removal. Inference: a caller timeout alone
  cannot prove that its particular pending acquisition drained.
- [node-postgres client API](https://node-postgres.com/apis/client) documents
  connection/query/statement settings, but supplies no AbortSignal query option.
  Reuse the application's existing cancellation adapter rather than inventing
  support from an ignored property or using private driver internals.
- [Node 24 AbortSignal guidance](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)
  supports composed signals and one-shot listeners with cleanup. The
  [DOM Standard](https://dom.spec.whatwg.org/), updated October 19, 2026, describes
  pre-abort handling and stopping ongoing activity. These inform lifecycle design;
  caller reasons are deliberately not retained in application diagnostics.
- [PostgreSQL connection defaults](https://www.postgresql.org/docs/current/runtime-config-client.html)
  defines statement timeout from server command arrival and discourages setting
  it globally. Inference: it cannot cover pool wait, and a later local assignment
  must not extend an already shorter deadline.
- [PostgreSQL cancellation](https://www.postgresql.org/docs/18/libpq-cancel.html)
  distinguishes dispatch from guaranteed effect. This documents protocol limits,
  not adoption of libpq in this JavaScript application.
  [Server signaling functions](https://www.postgresql.org/docs/18/functions-admin.html)
  describe cancellation privileges. Keep existing same-role, exact-backend binding;
  add no role grant or broad backend termination authority.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) supports data
  minimization. Keep fixed statuses and existing bounded diagnostics; do not
  expose SQL, backend identities, credentials or arbitrary abort reasons. There
  is no visual change or new WCAG conformance claim.

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Existing read-only runner plus stable scoped admission | Reuses cancellation/fencing; caps abandoned pool requests across replacement | Small internal database option and fixed admission state; drain can defer later ticks | First batch |
| Promise race alone | Small caller change | Leaves SQL and pending acquisitions behind; may admit late work | Reject |
| Server statement timeout alone | Useful SQL fallback | Does not cover pool wait/setup or caller cancellation | Insufficient |
| Change every shared readiness caller | Broad cancellation coverage | Changes unrelated schedulers/studies without their lifecycle contracts | Defer |
| Dedicated pool or global timeout change | Different acquisition controls | Adds connections/configuration or changes unrelated callers | Exclude |
| Private pg queue removal | Could remove a queued callback | Unsupported driver coupling and race-sensitive ownership | Reject |

Recommended stack: two-runtime opt-in guard, first-owner cancellation and probe
budget, stable database-scoped admission through real drain, existing read-only
runner and server fallback, preserved native diagnostics, then focused real
PostgreSQL verification. Keep execution automatic and the existing UI quiet.

## Verification and delivery

Reproduce the current gap with a blocked/saturated isolated database and an aborted
probe. Test pre-abort, exact deadline, coalescing, joining-caller authority, stop,
replacement, late success/rejection, cleanup and no post-abort worker admission.
Verify the probe timer does not cancel admitted heavy work. Preserve cache and
cooldown regressions, genuine 53100/42501/57014 diagnoses, unknown evidence and
the existing bounded warning policy; local abort cannot become SQL proof.

Use the production database factory for transport tests: the default integration
facade ignores transaction options and cannot prove cancellation. Saturate a
small pool with a long configured timeout, replace runtimes repeatedly, and prove
fixed scope admission through late grant/rejection. Observe real blocked SQL,
unrelated-reader isolation, pool recovery, shorter inherited timeouts, read-only
enforcement and unavailable-control fallback. Preserve ordinary writes and other
abortable consumers. No physical disk exhaustion or production mutations.

Run focused checks, then backend coverage/ratchet and applicable quality gates.
Review any static ownership drift explicitly; never refresh a baseline silently.
Keep design/outcome separate, update Unreleased, recheck PRs, and commit/push on
main without release or deployment.
