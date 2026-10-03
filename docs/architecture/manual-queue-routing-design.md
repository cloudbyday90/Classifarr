# Manual Queue Routing: Short Transactions and Explicit Outcomes

Reviewed: 2026-10-03. No release or deployment changes.

Implementation and tests: [outcome](manual-queue-routing-outcome.md).

## Decision

Save the operator's classification and an unconfirmed routing marker in one
short transaction with queue completion. Only after commit, call the existing
verified Radarr/Sonarr adapter. Record the result with a conditional update tied
to the original classification, library and attempt token.

Queue completion means the selection was saved, not that media was routed.
The API returns both facts explicitly. No automatic retry is added. A duplicate
request against the completed task cannot send another provider request.

## Contract and failure boundaries

- Keep the queue row lock for validation, history insertion and completion only.
  Failed/uncertain commit never authorizes a provider call.
- Preserve manual-action evidence and the original database recording timestamp.
  Override caller-supplied routing fields with server-generated state and token.
  Do not copy a previous operation's outcome link/path into this new observation;
  the source task payload and previous history remain unchanged.
- Only active movie/TV libraries of the matching media type are eligible.
- Run provider I/O after the transaction releases its connection and locks.
- Persist only normalized routing reasons and fixed safe messages. A success
  flag without the expected routing contract is not confirmation.
- Use the attempt token, selected library and original pending routing state
  when saving the outcome. A late result cannot overwrite a changed decision.
- On provider failure, keep the selection and record routing failure. On outcome
  write failure or conflict, report unconfirmed and leave newer history intact.
- An interrupted process may leave unconfirmed history. Do not reset the queue
  to pending or repeat an external write automatically. This is a durable marker,
  not a transactional outbox or a restart-recovery worker.

The existing history JSONB and queue states are sufficient for this bounded
change; no migration, daemon, additional permission or dependency is needed.
This does not make PostgreSQL and Radarr/Sonarr one atomic system, fence an
external provider against every concurrent configuration change, or promise
exactly-once effects. A separate explicit reprocessing action remains separate
authority; it is not the duplicate-request behavior described above.

## API and presentation

`POST /queue/tasks/:id/classify` retains its permission and validation middleware.
HTTP 200 and `success: true` mean the selection was committed. The additional
`routing` object carries `attempted`, `routed`, `arrType`, `reason`, `error` and
`recorded`. `recorded: false` means the final observation was not confirmed saved.
Never infer routing success from HTTP 200. Repeated completed-task requests still
return the existing invalid-state conflict, without another provider call.

The named client API method preserves the raw Axios response and disables
automatic transport retry. History labels unconfirmed routing plainly. There
is no current Vue consumer of this manual queue endpoint to add a new toast to.
Future consumers should announce concise status text without moving focus and
distinguish selection saved from routing confirmed.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep HTTP inside the transaction | Simple local ordering | Long locks; rollback cannot undo provider effects | Replace |
| Call provider before saving anything | Short database work | Response loss can lose the selection and encourage replay | Reject |
| Commit selection and unconfirmed marker, then verify and conditionally save | Short locks; honest durable state; no new infrastructure | Crashes may require review | Adopt |
| Full outbox/reconciliation worker | Can recover longer outages automatically | Needs frozen intent, authorization checks, budgets and lifecycle tests | Follow-up |

Recommended stack: short same-client transaction → durable unconfirmed marker
→ existing bounded provider verification → token-conditional outcome write →
clear API/history feedback. Keep automatic retry authority out of this change.

## Official sources

URLs were discovered with web search and opened on 2026-10-03.

- [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html):
  row locks last through transaction completion; avoid long-lived transactions.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  transactional statements must use one checked-out client. Reuse our existing
  `withTransaction` helper rather than mixing pooled queries into the transaction.
- [AWS transactional outbox guidance](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html):
  database and external effects have a dual-write gap. Our marker makes that
  gap visible; it is not a claim that this patch implements an outbox.
- [W3C notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) and
  [status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  give concise, accurate feedback and appropriate programmatic status semantics.
  This small change makes no blanket WCAG-conformance claim.
