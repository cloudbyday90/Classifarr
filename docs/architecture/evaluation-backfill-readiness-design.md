# Evaluation backfill readiness

Date: 2026-10-09. Scope: read-only evaluation diagnostics, not a recovery bypass.

## Finding

The prior local snapshot found three completed imports without backfill handoff
completion. On recheck all ten active libraries had completed the handoff, with
the last three checkpoints at 10:30 UTC. Normal scheduled replay subsequently
published policy report v2 with 300 cases. No completion markers were changed by
the investigation. This was a temporary admission wait, not a reproduced stall.

The relay intentionally scans at most twenty 250-item pages per five-minute
invocation. An empty task queue does not prove that this scan has finished: pages
can contain only already-enriched or currently ineligible items. A completed
handoff means eligible work was considered and enqueued, not that all metadata
providers succeeded. These local observations do not diagnose Unraid.

## Design and security contract

Add an optional, versioned inventory-readiness object to the existing authenticated
evaluation-history GET. Use its read-only repeatable-read transaction and five-second
statement timeout. Compose the actual admission query and aggregate counts in one
statement, keeping due-task checks on one statement clock. Project only aggregate
counts and one timestamp from the same snapshot. Do not duplicate its decision
rules in the UI. A ready inventory check is not proof that memory, ownership,
provider configuration, AI quotas or other later checks will admit a worker.

- Count completed imports on active movie/TV libraries and active media sources.
  Partition their handoffs into not started for this run, scanned pages with work
  remaining, and completed for this run. Exclude disabled libraries; the schema
  currently rejects music libraries, and the query retains its movie/TV scope.
- Expose due pending tasks and processing tasks separately; these are all task
  types because admission checks the whole queue. Future retries are not due work.
- Show the latest saved page timestamp among pending current-run handoffs. It is
  not a heartbeat, proof every library advanced, an ETA, or an automatic stall
  diagnosis. Never estimate percentages from sparse row IDs.
- No row locks, writes, provider calls, task creation, quota resets or live repair
  on GET. No library names, identifiers, run UUIDs, cursors, titles or credentials
  leave this diagnostic boundary. Invalid aggregates fail closed.
- No new timer or cache. Reuse existing pause/resume, visibility, access-loss and
  refresh behavior. Older servers omit the object and are shown as unavailable;
  malformed diagnostics never imply readiness. Historical results stay separate.
- Use a short polite status region for admission changes, not the changing clock
  or every count. Keep explanatory details in a native disclosure; no new action
  buttons. Unknown/stuck cases direct operators to diagnostics, not import resets.

This changes no schema, scheduler cadence, resource limit, retry policy, ownership
fence or ingestion/backfill completion definition. Fresh/empty/disabled setups
perform no additional background work. Query errors use the existing generic GET
failure and retry behavior; cancellation/restart never creates durable work.

## Research and options

Official sources discovered and opened through web search on 2026-10-09:

- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  `SKIP LOCKED` suits queue consumers but does not give a complete view. Therefore
  missing eligible work in a relay invocation is not completion evidence.
- [AWS transactional outbox guidance](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html):
  retain atomic durable intent and replay-safe consumers. Application inference:
  observe the existing run-fenced handoff rather than writing success from GET.
- [W3C status-message technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22):
  a polite status region announces updates without moving focus. Apply only to
  concise state transitions; do not announce the entire frequently refreshed panel.

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Mark complete when the queue is empty | Appears to unblock work | Can skip unscanned inventory | Reject |
| Increase cadence or scan budget | May shorten waiting | Added load; no demonstrated need | Defer |
| Read existing checkpoints and admission | Explains real waiting without writes | Small bounded status-query cost; not a heartbeat | Adopt |
| Persist a new worker-event history | Richer stall diagnosis | Schema, retention and lifecycle complexity | Consider only if needed |

Recommended stack: existing run-fenced relay → existing readiness SQL → allowlisted
read-only diagnostic service → existing API/polling → compact accessible disclosure.

## Validation and next step

Prove empty queue plus unfinished pages remains deferred; checkpoint progress and
completion stay distinct; restart/new generation, held locks, inactive libraries,
future retries and malformed data do not fabricate success. Use real isolated
PostgreSQL and client status tests. Rebuild local Compose without cache and dump
the schema in an isolated database; do not mutate Unraid or reset local budgets.

Next: observe actual scheduled progress and remaining comparison gaps with the
updated image. Only then consider an explicitly authorized AI-capture budget;
more coverage is not an independent accuracy measurement.
