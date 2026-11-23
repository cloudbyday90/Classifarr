# Exact History IDs for classification retry outcome

November 22, 2026 Eastern. Implementation of the approved
[design and research](classification-retry-bigint-design.md).

Ordinary retry now accepts History IDs through PostgreSQL's BIGINT maximum.
The HTTP route and shared service reject unsafe numbers and invalid decimal
strings before retry work begins. A batch preserves order, deduplicates
equivalent safe numbers and strings, and returns large IDs as exact strings.
Direct calls preserve the admitted scalar type. Command Center bulk retry
forwards loaded IDs unchanged, and History's existing keyboard retry action
can submit an exact large ID.

The notification DELETE casts only the bound target to BIGINT. Either
matching JSON key can remove a notification, including a digit string with
leading zeros and a JSON number outside JavaScript's safe range. A malformed
or unrelated value stays outside the cast. The retry transaction still
controls cleanup, task insertion, source status, and lineage proof. Existing
preflight eligibility, authorization, budgets, provider readiness and
postcommit follow-up govern execution. The historic refresh command retains
its 32-bit selection limit and existing receipt protocol. Lineage's provider
and reference IDs retain their separate 32-bit limits.

## Verification

- The earlier 200-test PostgreSQL retry baseline passed. The expanded focused
  run passed 209 tests across five suites. The real HTTP router selected each
  adjacent History row independently, including the BIGINT maximum. Invalid
  batches refused before a transaction, and historic overflow refused before
  receipt creation. Existing eligible historic requests still created
  actor-bound receipts with numeric IDs.
- PostgreSQL preserved unrelated notifications and links, checked exact
  numeric and string JSON keys, and exercised rollback after task insertion
  or receipt failure. Competing retries recorded one task and receipt
  callback. Delayed and lost acknowledgements after real commits left one
  saved task, with follow-up withheld when acknowledgement was lost.
- Existing scheduler and provider-readiness paths queued eligible exact IDs
  with their saved budgets. A permanent failure beside an eligible large
  row stayed untouched. The queue worker transferred request and webhook
  links from an exact large source under the existing claim and proof checks.
- The focused server and client suites passed 225 and 31 tests respectively.
  All four Chromium scenarios passed, including bulk retry with adjacent
  large IDs and keyboard retry from History at the database maximum. Astra
  independently reviewed the identity domains, SQL binding and lifecycle.
- GitHub showed no open PRs at assessment. Tests used local fixtures and
  isolated databases. The source change requires no schema migration.

## Next recommended item

Treat historic refresh as one bounded compatibility change. Trace exact
History IDs through inventory pagination, selection, execution, actor-bound
receipt lookup and reconciliation. Test overflow in the existing lineage
reader and preserve answer fingerprints and replay behavior. Keep BIGINT
identity until a specific requirement justifies introducing UUIDv7.

The [historic refresh follow-up](historic-refresh-bigint-outcome.md) widens
that workflow and bounds the stored lineage read.
