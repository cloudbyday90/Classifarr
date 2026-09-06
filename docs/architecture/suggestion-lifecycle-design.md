# Suggestion lifecycle design

## Problem and decision

The [deduplication follow-up](pending-suggestion-deduplication-outcome.md) prevents
duplicate creation, but apply does not require pending status and reject updates any
matching ID. Competing requests can overwrite review history or apply a suggestion
more than once. The suggestions route also writes `before_accuracy` outside the
application transaction, including before a failed policy authority check.

Allow exactly one pending-to-applied/rejected transition through the review service.
Use one Read Committed transaction and a consistent lock order: locate the policy,
lock the policy, re-read and lock the suggestion, then validate pending status. Both
review actions share this protocol, compatible with per-policy suggestion storage.

## Architecture and contract

Add a focused ESM lifecycle module for locking and conditional terminal updates.
The initial suggestion read locates its policy only; all action/configuration data
come from the locked re-read. If its policy changed while waiting, return a conflict
rather than acquire another policy lock or act under stale authority. Missing rows or
policies produce 404. Any non-pending state, including unknown/null states, produces
409 with `SUGGESTION_NOT_PENDING`; ownership changes use `SUGGESTION_POLICY_CHANGED`.

Apply retains the existing native-intent policy write guard. Rejection can dismiss
pending suggestions for native-intent policies because it does not modify policy
behavior. Both paths use a conditional terminal update and verify a returned row.
Policy changes, application audit entry, review status, actor and timestamps commit
together. Application also records `applied_at`, `applied_by` and the current learning
accuracy baseline in the transaction. Failed/conflicting actions leave all these
values unchanged. Existing history is not backfilled or rewritten.

Move the route-level baseline write into the service so both suggestion API families
have the same transaction semantics. Success payloads and endpoint paths remain
unchanged. Missing rejection targets now return 404, and repeated or conflicting
reviews return 409 instead of success. The named client API functions propagate these
errors. The dashboard refreshes stale suggestions after a lifecycle conflict without
resubmitting the mutation or describing it as a success. Other errors retain existing
handling. No new confirmation step is added.

Use bound SQL parameters and the existing allowed signal names for dynamic policy
columns. Transaction failures propagate through the current error handler; no provider
calls occur under locks. Existing database timeouts apply. This is a service guarantee
for updated writers, not a database trigger restricting arbitrary SQL or older writers.
No migration, dependency, automatic routing or cohort-labeling claim is introduced.

## Official research and alternatives

URLs were discovered with web search and read on 6 September 2026. These established
semantics support the August 2026 baseline; living documentation is not an archived
August snapshot.

- [PostgreSQL consistency checks](https://www.postgresql.org/docs/current/applevel-consistency.html)
  explain explicit row locking and Read Committed visibility. Re-read mutable state
  after acquiring the required locks and hold them through the terminal update.
- [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
  defines 409 for requests conflicting with resource state. Returning an explicit
  conflict distinguishes an earlier completed action from a new successful review.
- [W3C PROV-O](https://www.w3.org/TR/prov-o/) describes entities, activities and
  generation/invalidation. Preserve the original completed action's actor/time and
  provenance instead of overwriting them on retries. This informs application policy;
  no W3C conformance claim or RDF requirement is introduced.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Check pending state before the transaction | Small patch | State can change before writes | Reject |
| Guard only the final status update | Protects status with rollback if checked | Does not establish current policy authority/configuration before work | Insufficient alone |
| Lock policy then suggestion and guard the update | Coordinates store/apply/reject; preserves audit history | Same-policy operations wait; all writers must use the protocol | Implement |
| Return success for every repeated action | Simple retries | Hides conflicting reviews and obscures who performed the action | Reject |
| Add database lifecycle triggers | Covers arbitrary SQL writers | Requires migration and import/history policies | Defer |

Recommended stack: authenticated request → policy lock → locked suggestion re-read
→ pending-state check → existing apply authority check → transactional effects and
terminal update → committed response → refresh stale client state on conflict.

## Validation and next item

Use PostgreSQL tests for every repeated/terminal combination, simultaneous apply/apply,
reject/reject and apply/reject, lock waits, policy ownership changes, rollback after
side effects, native-intent authority and unchanged audit/baseline fields on failure.
Exercise both route families and client error propagation/refresh behavior. Inspect
local Compose read-only and build the production image locally.

Next, persist complete cohort provenance and validate evidence freshness at application
time. Lifecycle state alone does not prove a pending suggestion's evidence still has
eligible destinations; threshold and weight support arrays are currently empty.
The separate [outcome](suggestion-lifecycle-outcome.md) records implementation results.
