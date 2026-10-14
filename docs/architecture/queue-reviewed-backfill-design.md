# Selected reviewed-repair backfill

Date: 13 October 2026. Implementation plan; no release or live recovery approval.

## Problem and decision

Legacy/nested identities now normalize consistently and reviewed repairs update
all supported aliases atomically. Several approved repairs still require separate
retry clicks. Approval must never spread to other requests with the same old ID.

Implement an administrator-selected batch of one to five existing repair receipts,
with explicit retry consent. Use the existing guarded retry transaction and durable
per-task receipts, not a new scheduler. Nothing runs on installation, page load,
receipt discovery or ID confirmation. No real task is enrolled by this change.

## Official research and alternatives

Sources discovered and opened through MCP on 13 October 2026:

- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block):
  enforce authorization and allowed transitions server-side, bind significant
  transaction data, and check authority at execution.
- [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html):
  atomic commits keep queue writes and durable receipts consistent across failures.

Our application-specific recommendation is inferred from those principles:

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep individual retries only | Smallest surface | Repetitive for reviewed backlog | Retain as fallback |
| Selected atomic batch | Explicit scope; existing durable budget; no background leases | One stale item blocks the batch; maximum five | Implement |
| Unattended scheduler | Less operator involvement | New persistent consent, leases, cooldown and cancellation state | Defer |
| Propagate replacement by old ID | Broad coverage | Approval can leak across works, editions and requests | Reject |

Final stack: normalized identity → reviewed per-task repair → explicit selection
and retry consent → current guarded transaction → durable enqueue receipts → normal
queue processing. Queued is not classified or routed successfully.

## Contract and bounds

GET `/api/queue/identity-repair/backfill` reads up to 20 unretried receipts joined
to failed tasks, with an optional positive `afterId` cursor. This is discovery,
not an eligibility guarantee. No raw payload, provider URL or credential is returned.
POST on the same path accepts exactly `items` (one to five unique task/receipt
pairs) and `confirmRetry: true`; clients cannot supply replacement IDs.

Require ordinary administrator access sessions, reject API keys/scoped/refresh
tokens, enforce cookie CSRF, no-store, 20 reads/minute and the existing shared five
mutations/minute limit. No automatic HTTP retry. Selection starts empty and is
cleared on refresh/page changes. Interrupted writes require checking saved outcomes.

One transaction per batch, sequential items, existing fixed-order table locks
exclude other current writers. One-second lock wait, three-second statement limit,
five-second transaction lifetime. One batch per service instance; database locks
serialize instances and manual retries. No provider HTTP in the transaction:
read configuration locally and require its revision to match each unconsumed
receipt, with the provider still configured. Recheck active administrator, original
task/source revisions, repair marker, remaining unchanged attempts, absence of
claims/routing/decisions and competing work. Cancellation checked before commit.

Each receipt permits one successful enqueue for its exact task, durably recorded
with retry actor/time. Original attempt and recovery budgets never reset. There is
no recurring probe, automatic transaction retry, persistent pending batch, lease
or cooldown to reset: only explicit commands and existing queue work. The request
rate limit is per process; the durable one-enqueue ceiling is database-wide.

## Outcomes and recovery

All newly queued items and receipt updates commit together, or none do. Existing
consumed receipts return their saved result without touching even a retained/deleted
task or performing provider I/O. Replaying the exact selection after restart cannot
enqueue twice; it is not permission to resubmit unknown routing side effects.

Changed/deleted tasks, source/configuration drift, exhausted budget, invalid receipt,
competing work or withdrawn administrator authority fail closed. Busy/timeout errors
allow a later explicit attempt; no hidden retry. Cancellation before commit rolls
back. A lost connection after commit is an unknown client outcome: read each saved
receipt before further action. Unknown errors stay sanitized. Discovery does not
promise that items are currently safe to retry. Dismissed tasks remain excluded.

No schema migration, provider mutation, memory-guard change, library special case
or production data repair is needed. Existing manual retries and generic Retry All
keep their contracts; the latter continues to exclude repaired tasks.

## Acceptance and deferred work

Prove exact input bounds, real HTTP authentication/CSRF/rate limits, isolated
PostgreSQL all-or-nothing writes, stale state, concurrent manual/batch commands,
revocation, cancellation, lost response/restart, retention and unchanged budgets.
Test accessible selection/status and named client API methods. Run coverage and
quality gates, no-cache build, isolated packaged checks and local health evaluation.
Record results separately in an outcome document.

The follow-up [readiness design](queue-repair-readiness-design.md) adds bounded,
read-only per-item reasons before batch submission. Then assess durable opt-in
unattended scheduling after observing this selected path. Scheduling needs explicit
persisted consent/cancellation, cooldowns and admission limits; it must not
auto-enroll existing approvals.
