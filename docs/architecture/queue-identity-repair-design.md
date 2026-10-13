# Reviewed failed-task identity repair

## Decision — 13 October 2026

Build an explicit administrator preview, confirmation, durable receipt and separate
retry for unrouted missing-record tasks. This extends the
[read-only evidence check](queue-identity-evidence-design.md); it does not approve
Endgame Encore, guess from titles, modify Plex/Unraid, or run a release backfill.

The failing scenario is a saved movie/series ID that now returns 404, while retained
external IDs identify another record. A matching title or external ID alone does
not establish that a different edition is interchangeable. Confirmation must name
both typed IDs and require the administrator to verify the work and edition.

## Evidence and recommendations

Official documentation was discovered and read through MCP search on 13 October
2026. These are implementation recommendations inferred from those sources:

- Keep significant transaction data server-owned, bind consent to a short-lived
  preview, invalidate changed data and check authority at the final write.
  [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).
- Existing writers use Read Committed. Row locks alone do not exclude new matching
  tasks/history, so a rare administrative final gate needs short table locks as
  well as current-row checks; merely adding an advisory lock to the new service
  would not fence old writers.
  [PostgreSQL application consistency](https://www.postgresql.org/docs/current/applevel-consistency.html).
- Preserve movie/TV type. Require all supported saved external IDs to resolve
  uniquely to one candidate, with matching reverse IDs and valid details; do not
  substitute title search for missing evidence.
  [TMDb Find by ID](https://developer.themoviedb.org/reference/find-by-id).

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Automatic ID substitution | Least operator work | Can silently replace an edition or work | Reject |
| Diagnostics only | No identity writes | Cannot repair verified failures | Retain for uncertain cases |
| Reviewed repair, separate retry | Explicit scope, durable outcome, preserved budgets | Operator review and brief write contention | Implement |
| Global queue/identity redesign | Could unify all writers | Large unrelated migration and regression surface | Defer |

Recommended stack: bounded provider evidence → expiring server preview → explicit
work/edition confirmation → atomic task repair plus receipt → separately authorized
one-time retry. Existing same-ID recovery remains the automatic first line.

## Admission and bounds

Only active administrators with ordinary access sessions can use this workflow.
API keys, scoped tokens and refresh tokens are rejected; cookie mutations require
CSRF. Requests accept exact fields, never a client-selected replacement ID. All
responses are private/no-store. Status reads perform no provider I/O.

`POST /api/queue/task/:id/identity-repair/preview` takes an empty body;
`.../confirm` takes only `previewId` and `sameWorkAndEdition: true`;
`.../retry` takes only `receiptId`. `GET /api/queue/task/:id/identity-repair`
returns the saved receipt (or null), including after task retention.

Eligible tasks are failed classification tasks at metadata fetch with an allowed
saved failure, no claim/routing result, remaining attempts within the existing
five-attempt ceiling and no previous repair. Only simple movie/series request
payloads are supported: alternate nested identities, pre-enriched metadata,
inventory/reprocess context and unknown fields are rejected rather than discarded.
The direct saved source must still agree. No library/server name is special-cased.
Any decision witness, linked classification, or competing task/history for either
typed identity prevents repair. Fresh installs create empty tables and do no work.

Preview/confirmation share one in-flight admission per process and five requests
per minute/IP. Each reuses the evidence reader: at most five sequential provider
GETs, one ten-second deadline, one MiB per response, no redirects or transport
retries. One preview per administrator expires after ten minutes using database
time. Confirmation repeats provider evidence outside transactions and rejects
changed task/source/provider revisions or changed candidate presentation.

The final write uses Read Committed and short, fixed-order locks on the queue,
classification receipts/witnesses/history, saved source and provider configuration.
Lock wait is limited to one second and each SQL statement to three seconds. A busy
database fails closed; there is no automatic transaction retry. All values are
parameterized. No provider body, raw error, credential or endpoint is persisted.

The writer checks apply to this application version, not arbitrary old application
binaries or database-superuser writes. Stop old writers before enabling reviewed
repair in a mixed-version deployment; this feature does not replace the separate
privilege-isolation work. Database transactions have a five-second lifetime limit.

## Durable state and completion

Confirmation consumes the preview and atomically writes a receipt and the task's
new TMDb ID plus a receipt marker. Status stays failed. Original webhook, title,
intake/history, attempts, recovery counters and cooldowns remain untouched. The
receipt records actor, old/new typed identities, bounded candidate, checked sources,
versions, original attempt budget and confirmation time. Its task identifier has
no cascading FK: dismissing a task must not erase proof of the repair. Receipts are
not credentials and require current administrator authorization to read.

The separate retry action rechecks the failed task, remaining budget and absence
of competing work/effects under the same final locks, marks its receipt once and
queues the repaired task without resetting attempts. Generic Retry and Retry All,
and automatic same-ID recovery, exclude repaired tasks. No uncertain routing write
is replayed. If this retry later fails, retain the failure for a new investigation.

Cancellation before the final commit rolls back. A disconnected client after commit
can query the durable receipt; repeated confirmation/retry returns the saved result
without another identity change or requeue. A negative receipt read is not proof
that an in-flight transaction cannot still commit. Restart loses only in-flight
reads, not previews, consumed confirmations, receipts or budgets.

Transient provider failure/429/timeout means no repair; malformed, absent, conflicting
or incomplete evidence remains unresolved. Stale/expired previews require review
again. Unknown database failures roll back and return a sanitized error. The UI
does not infer success from a timeout and offers a read-only saved-outcome check.

## Verification and next boundary

Completion requires real HTTP authorization/CSRF tests, isolated PostgreSQL tests
for stale state, concurrent writers, lost responses, atomic rollback and preserved
budgets, client tests, current coverage gates and an evaluated no-cache local image.
Generate the fresh schema only from an explicitly isolated database. Keep separate
[outcome evidence](queue-identity-repair-outcome.md), including limitations.

Next: evaluate opt-in, bounded backfill of already-reviewed repairs using these
receipts, not automatic replacement approval. First observe the manual path and
real unresolved evidence; no production mappings or blanket retries are authorized.
