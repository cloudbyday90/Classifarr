# Classification metadata failure outcome

## Findings

Read-only Unraid inspection reproduced a current TMDb 404 for the stored movie
identity behind the reported error. Five old attempts stopped at metadata fetch;
the original exception is no longer in retained logs. A 404 does not establish
which replacement, if any, represents the same work. Production was not changed.

The code defect is independently reproducible: metadata enrichment discarded
the provider status before the queue could classify the error. The fix preserves
only safe category/status/transport fields in a typed ESM error. A 404 from the
details call stops automatic retries on the current owned claim, while unknown
and transient failures retain the normal retry schedule. A later certification
404 cannot falsely declare that the movie itself is missing.

Command Center explains the failure and displays a task reference. Known missing
records require verification, not blind title replacement. The next release's
idempotent migration updates only eligible failed/unclaimed metadata-stage tasks
and their generic failed intake receipts. It backfills **diagnostic context**,
not a replacement ID, a successful classification or a new retry budget.
There are no network calls in that migration and no schema structure changes.

## Verification

A read-only production count found exactly one row eligible for the future
backfill. No migration was run there. The ownership gate initially flagged the
new SQL and two modified queue modules; their exact changes were reviewed.
Only those review entries were updated. Existing shared-writer debt remains
unresolved, and the gate subsequently passed.

The typed-boundary tests first failed with the missing module. Focused backend
checks pass: four suites, 130 tests. Isolated PostgreSQL checks pass: three suites,
15 tests, including existing queue fencing and source cross-reference tests.
The new migration fixture verifies excluded active/cancelled/completed/routed
rows, preservation of every other task column, receipt alignment and idempotence.
Real PostgreSQL acknowledgement checks distinguish permanent missing records from
transient failures and reject stale claims without changing attempt counts.
Two focused client suites pass, 16 tests, including rendered guidance and no
implicit retry. Full gates and rebuilt-image receipts follow below when complete.

## Limits and next item

The affected Unraid item is **not repaired or retried**. Its identity still needs
authoritative review. This release groundwork fixes misleading diagnostics and
repeated automatic calls to a confirmed missing record, not upstream catalog
data. The [design](classification-metadata-failure-design.md) records official
sources, recovery semantics and tradeoffs.

Prioritize a reviewed identity-repair flow tied to the existing task/history,
with fresh catalog proof and protection against repeating remote actions.
Also address stale-decision maintenance's separate reset/enqueue operations and
missing history lineage. Negative historical stage durations were observed;
they are a separate timestamp/timezone diagnostic defect, not proof of the 404's
historical cause. No memory or ownership safeguard was relaxed.
