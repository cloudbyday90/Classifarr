# Selected reviewed-repair backfill outcome

Date: 13 October 2026. No release, version change or production recovery.

## Delivered behavior

Command Center provides a collapsed, explicitly loaded list of reviewed repairs.
Administrators select up to five task/receipt pairs and separately consent to retry.
One guarded transaction queues all newly eligible selections and records their
retry receipts, or rolls them all back. Existing saved retries are never undone
or replayed. Replacement approvals cannot propagate to other requests.

A modular ESM coordinator reuses the individual guarded retry writer, preserving
attempts, identity aliases, source evidence and competing-work checks. The batch
also verifies current local provider configuration against each unconsumed receipt.
No provider HTTP occurs while the database locks are held. Discovery and receipt
checks are read-only. Generic Retry All and automatic same-ID recovery still
exclude repaired requests.

There is no new scheduler, schema migration or automatic enrollment. The durable
one-enqueue ceiling uses existing receipts; an interrupted client can query saved
outcomes. A lost response does not trigger another write. The UI distinguishes
enqueue evidence from classification completion and escapes candidate titles.

## Verification so far

- Focused backend unit and real HTTP tests: 31 passed. Authentication, ordinary
  admin sessions, API-key refusal, cookie CSRF, no-store, input bounds and shared
  mutation rate limits are covered.
- Initial focused frontend run: 38 tests passed across three suites.
- Final isolated PostgreSQL run: 126 tests passed across six suites. Coverage
  includes five-item admission, bounded pagination, changed/deleted requests,
  provider changes/disablement, revoked actor, transaction rollback, competing
  manual/batch commands, interruption after the first and final receipt writes,
  repeated saved outcomes after service restart/retention and unchanged budgets.
- Type checking, ESLint, copyright, dependency/unused-code preflight, static ESM
  imports, ESM mock shape, migration naming/schema integrity and Markdown passed.
- Inventory ownership check passed without baseline changes. Its existing
  unresolved writer-isolation debt remains; this does not claim full production
  writer isolation.

Full coverage, packaged restart checks and no-cache local evaluation are pending.

## PR and recommendation

GitHub MCP enumeration found zero open Classifarr PRs on 13 October 2026. There
was no eligible random PR to implement; no closed PR was substituted or merged.

The [design and verified official sources](queue-reviewed-backfill-design.md)
record the pros, cons and recommendation stack. Selected atomic backfill reduces
repetitive work without granting unattended retry authority. The cost is a
five-item ceiling and a stale item blocking the whole selection.

Next: evaluate durable opt-in unattended scheduling, with persisted consent,
cancellation, cooldowns and admission limits. Do not automatically enroll previous
approvals or extend an approval beyond its original task.
