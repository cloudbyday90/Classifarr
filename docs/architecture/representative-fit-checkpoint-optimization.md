# Representative fitting: checkpoint overhead

Date: 2026-09-19

## Design and reason

Loaded coverage runs exposed a ten-second timeout in the existing deterministic
geometry regression. Inspection found an avoidable cost in the shared fitting
session: every item awaited an async checkpoint, even when its index was not a
multiple of 256 and no event-loop yield occurred. Async no-ops still create
promises and microtask continuations.

Move the modulo check to the three call sites. Await the checkpoint only at the
same real `setImmediate` boundaries. Preserve input traversal, arithmetic, tie
ordering, group budgets, pass limits, cancellation/disposal checks and continuation
state. Do not increase the test timeout or loosen a convergence assertion.

This is a fitting-loop optimization used by both automatic profiles and the new
[group semantic comparison](group-semantic-comparison-design.md), not a new scoring
rule. There is no migration, additional inference, model change or UI change.

## Verification and limits

A same-process synthetic comparison imported the previous committed session and
the modified session, alternated order across three runs, and compared full JSON
outputs including diagnostics and memberships. All three outputs were identical,
with 28 iterations. Previous/current milliseconds were 96/83, 76/70 and 57/41.
These are small, loaded-machine observations, not a throughput guarantee or proof
that checkpoint overhead was the only contributor to the test timeout.

Focused fitting, profile, semantic and benchmark regression passed 108 tests in
nine suites. Existing tests retain four pre-refactor output fingerprints,
continuation equivalence, exhaustion, concurrent-call exclusion, cancellation and
disposal checks. Full final-code validation is recorded in the separate
[comparison outcome](group-semantic-comparison-outcome.md).

The previously timing-out geometry suite then passed under the same focused
coverage command: seven tests, unchanged ten-second per-test limit. Its whole-suite
wall time was 11.348 seconds; that is not a per-test timing or a performance SLA.

The first superseded full coverage run and one focused coverage attempt timed out
before this optimization. The superseded full run was stopped after recording the
failure and restarted on final code. Neither incomplete run is reported as passing.

## Recommendation

Keep the bounded real yields and remove unnecessary promise churn. The benefit is
less repeated scheduling work; the tradeoff is fewer intervening microtask turns,
while actual event-loop cancellation checkpoints stay in place. Do not replace
these checkpoints with a fully synchronous, uninterruptible fit. Continue using
the existing worker, work budgets and source-validated publication boundaries.
