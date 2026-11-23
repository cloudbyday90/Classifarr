# Exact History IDs in learning receipt validation outcome

November 23, 2026 Eastern. See the
[design](learning-answer-receipt-identity-design.md) for guidance and tradeoffs.

## Implementation

The transaction reader shared by exact-item memory and destination evidence
compares the saved answer's History binding with the locked row. New and
existing bound answers use exact matching. Unbound legacy answers remain
eligible for safe IDs under the existing checks. The reader rejects an
unbound larger ID, a malformed binding or a binding to another row before
loading the destination or replaying a learning receipt.

Direct and intake selectors use canonical positive BIGINT strings. An
explicit malformed or conflicting selector fails before the lookup. Valid
event IDs retain their bytes. Pending-answer admission keeps its safe range.

## Verification

- Astra reviewed both consumers and identified the explicit null selector
  case. The focused run passed 159 tests across 10 suites, including exact
  BIGINT event IDs and refusal before the first lookup.
- All 30 scoped PostgreSQL tests passed. The manual exact-item command
  used a bound answer to record and replay a learning receipt for a large ID.
  Both commands refused a later foreign binding. The source-event receipts
  and exact-item evidence rows remained identical after refusal. The
  destination command reported no execution.
- Fresh backend coverage on the qualified server tooling passed 64,304 tests
  across 1,957 suites with one test skipped. The coverage ratchet passed
  with the verified client source, lockfile and preceding coverage report.
  Lint, type checks, preflight, policy gates and Markdown lint passed.

## Next recommended item

Trace exact History IDs through pending web and bulk request selectors,
responses and completed replay. Use that evidence to plan an admission
change. Discord transport and its component identifiers can be verified
separately.
