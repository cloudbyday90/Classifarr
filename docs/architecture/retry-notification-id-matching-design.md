# Retry notification ID matching design

November 15, 2026 (America/New_York). Agreed first batch at main
`b279ee7d270deb97a87a8b340d45b4eb1a462682`; the complete scope was confirmed under
the repository workflow before implementation.
This follows the [pending notification repair](pending-notification-id-matching-outcome.md).

## Observed failure and consumer contract

`ClassificationRetryStateService.cleanupClassificationArtifacts` first clears
request/webhook links, then deletes matching app notifications, then removes
other classification artifacts. Its notification statement casts extracted JSON
text to INTEGER after a digits-only predicate. An unrelated value such as
`"2147483648"` can raise `22003` and abort otherwise valid cleanup.

The isolated production-factory baseline reproduces that failure for each JSON
key spelling and proves rollback restores both links and notifications. Seven
diagnostic checks pass, including current target coercion and range behavior;
two existing unit suites pass 29 tests. The existing retry integration suite also
passes ten tests. No production occurrence was established.

This consumer's contract differs from pending replacement:

- It deletes matching notifications, rather than marking them read.
- It has no read-state or notification-type filter.
- `classificationId` and `classification_id` are independent OR branches.
  Either matching key deletes the row, even if the other key is malformed or
  names another classification. Retain malformed/unrelated rows only when
  neither key matches.
- Its parameter is currently inferred as INTEGER. Target coercion/range is not
  the canonical positive BIGINT precondition used by pending replacement.

The current classification-linked writer uses camelCase and serializes the raw
database ID. No current snake_case producer was found; its historical/imported
origin is unproven, but its existing matching compatibility must remain.

## Recommended first boundary

Repair notification-side matching only. Extract the fixed DELETE into a small
retry-specific SQL leaf, retaining the same client.query call and parameter.
For each existing key, keep the existence and digits-only checks and compare:

```sql
(ltrim(data->>'classificationId', '0') COLLATE "C")
  = ltrim(($1::integer)::text, '0')
```

Repeat independently for `classification_id`, preserving OR. This removes
numeric conversion of notification data. It intentionally retains numeric
conversion of the bound target parameter and its existing INTEGER type.

Trim both sides. A zero target becomes empty text and still matches all-zero
notification text; the original regex excludes a genuinely empty stored string.
Negative targets remain negative text and do not match digit-only values.
Existing parameter forms such as leading zeroes or surrounding whitespace retain
PostgreSQL's INTEGER coercion. Null, malformed and out-of-range target behavior
remains governed by that same parameter conversion. Add no JavaScript target
validator or new admission rule in this batch.

For supported targets, leading-zero and exact INTEGER matches remain compatible.
Oversized notification digits cannot equal the bounded normalized target and no
longer undergo conversion. Preserve JSONB extracted-text semantics: numeric
exponents can normalize to integer text, while retained fractional scale and
exponent strings remain nonmatching. Add no raw-length cutoff; arbitrary zero
prefixes remain compatible. Long text still requires scanning, with no measured
performance or constant-time claim and no new index.

## Why BIGINT admission is separate

The public batch path currently uses permissive Number.parseInt. Direct
`retrySingle` calls bypass it, and automatic recovery obtains database row IDs
without a positive-ID predicate. History's BIGINT primary key has no positive
CHECK constraint. The baseline confirms zero/negative/noncanonical direct targets
can currently reach cleanup, while a target above INTEGER range fails even when
there are no notifications.

A canonical positive BIGINT guard would therefore change admission, range and
failure timing. It would reject some prior direct inputs and admit larger targets.
It also cannot undo upstream parsing or fix downstream lineage's Number.parseInt
conversions. Assess exact retry IDs across those boundaries as a separate batch;
do not claim global BIGINT or UUID readiness from this notification repair.

## Transaction, authority and failure boundaries

Keep the existing transaction owner in `retrySingle`: identity/row locks,
eligibility/readiness and duplicate-task refusal, lineage capture, artifact and
enrichment cleanup, task INSERT, optional receipt callback, History status and
outcome write. Metadata-enrichment follow-up remains after successful transaction
settlement. Add no provider I/O or new retry attempt.

Preserve every other cleanup statement, embedding audit behavior, ordering,
parameter/result shape, inherited isolation and existing resource/write limits.
No new query, connection, lock, savepoint or catch-and-continue behavior is needed.
Genuine SQL failures still abort the owning transaction. A helper invoked outside
that transaction does not gain atomicity from this change.

The production transaction runner performs one callback attempt and does not
replay uncertain COMMITs. `retrySingle` still maps exceptions to the existing
`retry_failed` result; that result does not prove rollback after a lost COMMIT
reply. Do not claim a new unknown-outcome UI, universal request receipt or safe
operator replay. Keep existing receipt hooks, budgets, provider readiness,
postcommit follow-up, authorization and learning behavior unchanged.

No schema, migration, endpoint, UI, setting, job, operator CLI trigger, provider
call, live cleanup, release or deployment is included. Historical migration SQL,
pending-task lookup and enrichment-task JSON casts remain separate.

## Verification and delivery

After final shared understanding, add old-failing production regressions before
repairing runtime SQL. Verify:

- Each key, both keys, independent matching, conflicting keys and malformed or
  overflow sibling keys in both directions. Preserve OR and delete semantics.
- Read/unread notifications and several types; no added type/read restriction.
- Leading zeroes, zero/all-zero compatibility, INTEGER boundaries and neighboring
  values, arbitrarily long prefixes/digits, null/containers, raw numeric JSON
  exponent/scale and rejected string forms.
- Existing direct target coercion, zero/negative/null and malformed/out-of-range
  refusal; preserve the bound parameter's INTEGER type. Larger targets continue
  to fail rather than silently expanding this batch's authority.
- A successful full retry despite unrelated malformed notifications, with one
  queued task and the intended link/artifact changes only.
- Real downstream SQL/receipt failure restoring links, notifications, History
  and task state; existing concurrent retries and eligibility/budget controls.
- Delayed and lost acknowledgement after native PostgreSQL COMMIT: durable state,
  one callback/COMMIT, existing result mapping and no internal replay. Follow-up
  must remain after transaction settlement.

Run fresh backend coverage and normal quality/security gates. Reuse client
evidence only after verifying unchanged relevant inputs, installed graph and
report hashes. Review affected ownership entries without weakening their
classification, parser pin, baseline or review cap; keep analysis gaps explicit.
Maintain artifacts and write a separate observed outcome plus Unreleased entry.
Commit/push intended changes on main and inspect that exact commit's CI.

No PR is open at intake. Recheck before delivery; do not reuse a closed PR or
rebase fresh/unrelated branches. The existing application retry paths perform the
work without another operator control or manual CLI workflow.

## Official research and independent review

Discovered and opened through MCP on November 15, 2026:

- [PostgreSQL expression evaluation](https://www.postgresql.org/docs/18/sql-expressions.html):
  Boolean predicate order is not a conversion fence. Application inference:
  remove conversion from untrusted notification data.
- [PostgreSQL string functions](https://www.postgresql.org/docs/18/functions-string.html)
  and [collation](https://www.postgresql.org/docs/18/collation.html): explicit
  zero-prefix removal and exact C comparison preserve this key contract.
- [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
  and [JSONB representation](https://www.postgresql.org/docs/18/datatype-json.html):
  keep INTEGER range and stored numeric representation distinct from BIGINT
  identity requirements and original JSON spelling.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/): document
  structural and representation contracts. Here this supports an explicit
  two-key compatibility contract; no new UI or conformance claim follows.

Astra independently reviewed target admission and matching alternatives. Given
the observed direct-call behavior, it recommends preserving target INTEGER
coercion/range for this first malformed-notification resilience batch. A separate
read-only trace established callers, producers, transaction ordering and fixtures.
Those reviews did not change source or execute tests.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Another AND/OR guard around JSON casts | Small apparent edit | Still depends on unsafe conversion/evaluation assumptions |
| CASE plus range/input validation | Can fence conversion | More conversion and range logic than matching needs |
| Notification-side text comparison, retain INTEGER target | Fixes malformed-data interference and preserves target behavior | Deliberately retains the local INTEGER limit and existing admission debt |
| Canonical positive BIGINT target plus text comparison | Stronger local identity contract and wider range | Changes admission, timing and range; broader retry/lineage work still required |
| Rewrite/delete malformed records globally | Could simplify stored data | Different retention and live-data scope; unnecessary for valid retries |

Recommended stack: retain parameter coercion and the owning transaction, remove
notification-side numeric casts in a small SQL leaf, normalize both comparison
sides, preserve independent-key OR/deletion semantics, and keep genuine failures
and uncertain commits truthful. Next, assess one exact retry-target contract
across admission, cleanup, lineage and outcomes before widening the target range.
