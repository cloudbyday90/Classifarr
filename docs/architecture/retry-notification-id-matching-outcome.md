# Retry notification ID matching outcome

November 15, 2026 (America/New_York). Implemented the agreed
[design](retry-notification-id-matching-design.md) on main, following the
[pending-notification repair](pending-notification-id-matching-outcome.md).
No release, deployment or live cleanup is included.

## Behavior and preserved contract

Retry cleanup's notification DELETE now lives in the small
`classificationRetryNotificationSql.mjs` leaf. It compares extracted notification
text with the normalized INTEGER target, removing numeric conversion from the
notification values only. The original client, one parameter and query ordering
remain unchanged.

An unrelated notification ID such as `"2147483648"` previously aborted ordinary
cleanup with `22003`. The production-factory diagnostic reproduced that failure
and rollback for both JSON keys; two new full-retry regressions also failed
against the old runtime. With the repair, a valid retry queues once, clears the
intended links and deletes matching notifications while retaining unrelated
overflow data unchanged. No production occurrence was established.

The existing target INTEGER coercion/range remains. Both comparison sides lose
leading ASCII zeroes: positive targets retain zero-prefix compatibility, zero
still matches all-zero notification text, and negative targets cannot match
digit-only values. The existing regex excludes an empty stored string. Invalid
or out-of-INTEGER targets still fail; the query is not entirely cast-free and
this batch does not introduce canonical positive BIGINT admission.

Both JSON keys retain independent OR meaning. Either matching key deletes the
whole notification, including when its sibling is malformed, oversized or points
elsewhere. A row with neither key matching remains unchanged. Read state,
notification type and `notificationType` do not become new filters. Deletion is
not replaced with marking read, and no global malformed-record cleanup occurs.

JSONB extracted-text behavior remains explicit: numeric exponents can become
integer text, while retained fractional scale and exponent strings do not gain
new acceptance. Arbitrary zero prefixes remain supported; no length cutoff,
index or constant-time/performance claim is added.

The owning retry transaction still controls locks, eligibility/readiness,
duplicate-task refusal, lineage capture, other cleanup, task INSERT, the optional
receipt callback, History and outcome writes. Existing budgets and authorization
remain. Follow-up waits for successful transaction settlement. Genuine SQL
failures roll back; uncertain COMMITs are not replayed. The existing
`retry_failed` result after a lost reply does not establish rollback or expose a
new explicit unknown-outcome state.

## Verification

- Baseline: 29 unit tests, seven production-factory PostgreSQL diagnostics and
  ten existing retry integration tests passed. The diagnostics also established
  current direct-target coercion and the INTEGER limit before scope selection.
- Regression-first: both full-retry overflow cases failed against old runtime.
  That diagnostic invocation selected two tests; no permanent skip was added.
- Focused checks: six suites passed 139 tests for retry state/service,
  eligibility, follow-up, routes and ownership-gate controls.
- PostgreSQL: six suites passed 235 tests. The new 110-case production-factory
  suite covers both keys, malformed/conflicting siblings, read/type states,
  INTEGER limits, leading zeroes including 64-KiB strings, numeric JSON forms,
  full retry and refusal, real task/receipt SQL rollback and concurrent retries.
  Existing suites retain automatic recovery, provider-budget and notification
  HTTP lifecycle boundaries, as well as the earlier pending-notification repair.
- The new acknowledgement controls execute native COMMIT before delaying or
  losing its reply. They observe durable state before acknowledgement, one
  callback/COMMIT and no replay. Follow-up runs only after successful settlement;
  acknowledgement loss retains the existing failure result and durable state.
- A fresh production build and all eight production-browser checks passed.
  Client coverage reuse was verified against unchanged relevant source, the
  installed graph and the prior raw report hash. The HTML metrics consumed by
  the ratchet also agree with that raw report: 87.93/82.17/87.71/89.61 percent
  statement/branch/function/line coverage.

Fresh backend coverage passed 1,954 suites and 63,984 tests, with one existing
skip. Statement/branch/function/line coverage is 89.35/86.86/90.91/89.35 percent.
The combined coverage ratchet passed with the verified client report. Markdown
checks pass for 2,561 documents with zero errors.

Type, lint, dependency and other ordinary quality checks pass. The ownership
gate was rerun after explicitly reviewing its changed service entry. Only that
entry's source/analysis digests and the existing review rationale changed. It
retains `shared_writer_debt` with classification `unresolved`; the imported-query
analysis gap and lack of proven ingestion ownership remain explicit. The
protected `media_server_items` write is unchanged. Other entries, parser pin,
baseline, protected relations and the 100-review cap are unchanged. Passing
PostgreSQL tests do not resolve that separate ownership debt.

Root/client audits retain zero findings; server retains five known LOW findings
in the Jest/deepmerge chain. No exception, severity, expiry, dependency,
installation policy or assertion was changed.

## Research, tradeoffs and recommendation

The [design's official sources](retry-notification-id-matching-design.md#official-research-and-independent-review)
were discovered/opened through MCP on November 15. PostgreSQL expression, string,
collation, numeric and JSONB contracts support removing conversion from
notification data while preserving the separate parameter contract. Applicable
W3C guidance supports documenting representation and compatibility; this adds no
UI or conformance claim. Astra independently reviewed the alternatives, proposal,
runtime/tests and limited ownership review, finding no blockers.

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| More Boolean guards around JSON casts | Small apparent change | Does not establish safe evaluation order |
| CASE and input/range validation | Can fence conversion | Retains unnecessary conversion and more validation logic |
| Notification text matching with existing INTEGER target | Repairs malformed-data interference with a small compatibility surface | Retains the target limit, scanning cost and existing admission debt |
| Canonical positive BIGINT cleanup target | Stronger local identity contract and wider range | Changes admission/range/timing; upstream and lineage work still required |

Recommended stack: existing target coercion and transaction, a small SQL leaf,
exact normalized text comparison for each key, unchanged OR/deletion semantics,
and truthful failure/uncertain-commit handling. Existing application retry paths
perform this work without a new page, setting, scheduled job or operator CLI.

## Delivery and next item

No PR was open at intake or delivery recheck. No closed PR was reused, PR merged
or fresh/unrelated branch rebased. Separate design/outcome documents and
Unreleased notes accompany the change; commit/push and CI inspection use main.

Local maintenance preserved recovery/reference assets, current evidence,
toolchains, worktrees and shared resources. The before/after inventory retained
34 containers, 493 image/tag entries and four worktrees on the same pinned daemon;
container identities, image references, start times, state and observed health
were unchanged. A fresh metadata inventory did not follow reparse points and
left protected asset trees unexpanded. Three older logs remained excluded because
ownership was not established. No file/image retirement, shared-cache change,
volume action or reclaimed-capacity claim is made.

Next, define one exact retry-target contract across admission, cleanup, lineage
and outcome records before widening the INTEGER range. Public parsing and later
lineage rebinding still use Number.parseInt, and direct calls have different
admission semantics. Keep that work separate from this resilience fix. Other
task/enrichment JSON casts, historical migration SQL, wider API/receipt/Discord
limits and UUID migration remain outside this batch.
