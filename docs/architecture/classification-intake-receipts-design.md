# Classification intake receipts: design

Date: 2026-09-23. Follows the separate
[prospective intake diagnostic outcome](prospective-intake-diagnostic-outcome.md).

## Problem and boundary

The prospective report found no classification history in its local observation
window. A release is needed before new code can observe requests in another
installation; this change does **not** create one. The existing `webhook_log`,
`task_queue`, and `classification_history` each retain part of the story, but
task queue cleanup can remove the middle link before an operator investigates.
The comparison is stored only when a complete live inventory comparison passes
its existing guards. Its absence currently has no durable fixed reason.

Record an internal, id-only receipt for **queued classification tasks**. This
scope covers both webhook and other queue sources without assuming movie-only
content. A webhook rejected before authentication is deliberately outside this
journal; the endpoint must not persist untrusted identifiers or secrets. An
authorized webhook skipped by configuration remains visible through the
existing webhook log, but never falsely counts as a queued classification.

## Contract

One upserted receipt per queue task retains the task ID, optional existing
webhook-log and classification IDs, a coarse allowlisted source class, queue
state, timestamps, attempt count, fixed failure code, and fixed inventory
comparison state/reason. It stores no title, provider ID, library, policy,
description, AI output, URL, header, payload, username, email, IP, or secret.
The table deliberately has no foreign key to `task_queue`, so it survives
normal task cleanup. A bounded reconciliation before that cleanup fills missing
receipts from still-retained tasks and links classifications from existing
queue-decision witnesses when available. Later successful stage writes also
upsert missing receipts. The queue row is authoritative for current status, so
an out-of-order diagnostic write cannot regress it. Duplicate/retried writes are idempotent. Receipt failures
never authorize or block classification; diagnostics distinguish absent receipt
evidence from a completed intake.

At the retrieval boundary, record a fixed comparison outcome code for why the
prospective shadow was not captured. This is a diagnostic of evidence
eligibility, not a score, ground-truth label, or route grant. Save it with the
classification history and link the task receipt after history insertion.

An internal read-only CLI queries a fixed time window and caps returned rows.
It outputs IDs and fixed codes only. No public endpoint or Command Center panel
is added; the existing busy UI does not need another live status message.
Receipts become eligible for expiry after 30 days; existing queue maintenance
deletes them in bounded batches. Reconciliation is also bounded and best-effort:
it cannot reconstruct a task after the source queue row and any witness have
both been deleted. The legacy `task_queue` timestamps lack time-zone offsets;
reconciliation interprets them using the current database session time zone.
Historic classification and webhook data are not backfilled or relabeled by
this migration.

## Options, pros and cons

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Id-only receipt plus existing source records | Retains the queue link after cleanup; bounded and queryable | Extra small database writes and 30-day storage | Implement |
| Query current task queue only | No new writes | Deletes the very link needed for later investigation | Reject |
| Copy webhook and classification payloads into an event log | Rich inspection | Duplicates sensitive content and increases breach surface | Reject |
| Full distributed tracing backend | Cross-service visualization | New operations, cardinality, and retention burden for one local pipeline | Defer |
| Automatic UI alert for quiet intake | Visible | Treats ordinary idle traffic as failure and adds screen density | Reject |

Recommended stack: PostgreSQL constrained receipt table and `ON CONFLICT`
upserts; small ES Module recorder, fixed-code comparison projection, bounded
reconciliation/expiry, and read-only CLI; existing webhook/task/history records
remain authoritative for their own stages. No ranking, provider, routing,
confidence, or release change.

## Official guidance checked September 2026

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends interaction identifiers while excluding secrets and validating
  data that crosses trust zones.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) informs the
  correlation/privacy tradeoff. Internal database task IDs are sufficient here;
  no untrusted external `traceparent` is accepted or propagated as authority.
- [OpenTelemetry logging specification](https://opentelemetry.io/docs/specs/otel/logs/)
  describes correlating records without copying the request body. A full
  telemetry backend is unnecessary for this bounded diagnostic.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents atomic conflict handling for idempotent receipts.
- [PostgreSQL DELETE](https://www.postgresql.org/docs/18/sql-delete.html)
  supports bounded expiry using a selected batch of receipt keys.

## External PR boundary

The repository's open-PR API returned `[]` on this date. There is no random
open PR to implement locally; no closed PR is substituted and no PR is merged.
