# Classification retrieval cancellation outcome

## Implemented behavior

Semantic retrieval now passes the caller signal into an explicitly read-only database
transaction and rejects late SQL results/errors as cancellation. Small ESM modules
own abortable reads and bounded, on-demand PostgreSQL cancellation. Generic write
transaction behavior is unchanged. The AbortError utility also constructs its typed
properties together so the imported boundary passes JavaScript type checking.

The independent PostgreSQL control test reproduces the prior behavior: aborting a
caller with no SQL handoff leaves its sleep query active. New tests observe active
SQL, abort it, verify the backend disappears within a three-second test bound, and
confirm an unrelated concurrent reader and subsequent pool request succeed. This
bound is an assertion, not a production latency percentile or SLA.

Fallback testing deliberately makes the control transport unavailable: a 500 ms
test statement budget still stops a ten-second query. Additional cases cover a
saturated one-connection pool, late grants without SQL, local settings restoration,
read-only write rejection and cancellation of the real semantic executor waiting
on an exclusive table lock. Unit cases include bounded control admission, late
connect refusal, every transaction stage, sanitized failure logging and late-result
suppression. No timeout is represented as an empty successful retrieval.

## Verification and limits

The final focused unit run passed 473 tests in 13 suites. The code-health and
ownership review rerun passed 31,247 checks in three suites after correcting an
intentional teardown-suppression comment and reviewing the changed source pins.
The expanded PostgreSQL run, including the separately documented CI fixture fixes,
passed 41 tests in five suites; final database-boundary validation passed 11 tests
in three suites, including ordinary-role and simultaneous-caller cases.

Frontend coverage passed 412 suites / 5,835 tests. Lint, server/client type checks,
documentation lint, ESM checks, naming/language/maintenance gates and CI preflight
passed. Ownership review preserves 490 unresolved paths, with 19 owned and 227
separately coordinated paths; the passing static gate is not authorization for
unresolved writers. The full PostgreSQL run passed 225 suites / 2,638 tests, with
one existing skipped suite/test, in 973.58 seconds. All three suites that failed
in the linked CI run passed. The final full backend coverage run passed 1,607
suites / 49,110 tests, with one existing skipped test, in 697.00 seconds. The
combined server/client coverage ratchet passed without lowering any baseline.

Control capacity or network failure can defer actual PostgreSQL termination until
its local statement timeout. Cancellation acknowledgements alone do not prove
termination. Setup statements before local settings retain the existing connection
defaults. This does not claim complete image-provider, full-text, graph, network
partition or multi-process capacity coverage. No live database or container was
changed by these isolated tests.

Both GitHub MCP and the saved GitHub CLI login returned no open PRs for
`cloudbyday90/Classifarr`; no random open PR was available and no PR was merged.
No release, version bump or deployment update is part of this change.

## Recommendation

Keep explicit read-only cancellation, bounded same-role control capacity and the
server deadline together. The benefit is controlled cleanup without reducing
retrieval quality; the costs are a setup query and transient control connections
on cancellation. Retain connection destruction after abort even when a cancel
request appears successful, avoiding delayed-signal reuse races.

Next: cancellable image-provider admission and transport, with tests for an aborted
queued request never starting and an active request releasing capacity. This is a
specific remaining code boundary, not a proposal to repeat the SQL work.

See the [design and researched alternatives](classification-retrieval-cancellation-design.md)
and the separate [CI recovery outcome](ci-provider-fixture-recovery-outcome.md).
