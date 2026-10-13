# Alias-consistent reviewed repair outcome

Date: 13 October 2026. No release or Unraid deployment.

## Delivered behavior

Supported failed manual/webhook requests can now receive an explicitly reviewed
TMDb replacement across root snake/camel-case IDs, nested media IDs and exact
legacy provider labels. All declarations must agree before review. A small ESM
planner validates both identities and produces fixed path/value patches; a single
parameterized PostgreSQL update and the existing durable receipt commit together.
The UI explains that task IDs change while original webhook evidence is retained.

Unknown/enriched request shapes remain held for separate investigation. The change
does not guess identities, alter media type, drop request context, reset attempts,
requeue on confirmation or expand automatic recovery. Explicit retry remains a
separate guarded command. No database migration or API request/response change was
required. Memory safeguards and ownership baselines were not modified.

Review identified an additional preservation risk in replacing a whole JSON
document: JavaScript cannot retain every numeric value PostgreSQL can store.
Targeted patches preserve unrelated large integers and precise decimals exactly.
The writer also rolls back if its result exceeds the saved-request size ceiling.

## Verification so far

- Focused unit/HTTP authorization checks: 90 tests in four suites passed.
- Isolated PostgreSQL: 110 tests in five suites passed, including all 68 ID paths,
  nested/legacy-only retries, contradictory aliases added after review, exact
  numeric preservation, oversize rollback, cancellation, receipt-write failure,
  concurrent writers, idempotence and unchanged recovery history/budgets.
- Type checking, ESLint, dependency/unused-code preflight, copyright, migration
  naming/schema integrity and ESM checks passed. Markdown: 2,189 files, no errors.
- Inventory ownership gate passed without baseline changes. Its existing
  unresolved ownership debt remains unresolved; it does not claim full production
  writer isolation.

Full coverage and packaged/local image evaluation are pending at this checkpoint;
their final results will be recorded after completion.

## PR and recommendation

GitHub MCP enumeration found zero open Classifarr PRs on 13 October 2026, so there
was no eligible random PR to implement. No closed PR was substituted or merged.
All seven workflows for the preceding main commit `2d491709f` had passed.

The [design and official research](queue-identity-alias-repair-design.md) record
the alternatives and recommendation stack. Shape-preserving atomic repair keeps
evidence and consumers consistent; its tradeoff is a deliberately narrow write
allowlist and continued administrator review for each replacement.

Next: assess bounded, opt-in processing of already-approved repair receipts, with
explicit retry consent, persisted limits and restart-safe outcomes. An approval
for one task must not silently authorize other requests with the same old ID.
