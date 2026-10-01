# Image-index repair visibility

## Decision

Add a read-only System card and administrator-only, parameter-free GET report.
Show a three-segment index checklist, a plain-language state, the durable automatic
attempt count, and one next action. This is a snapshot with an explicit refresh
button, not another polling loop. It cannot enqueue, retry, reset, cancel, or repair.

## Evidence and interpretation

- Reuse the worker's exact catalog inspection. Only matching, valid, ready and
  live indexes count as verified. Unexpected definitions require review.
- Observe live PostgreSQL index-build activity for the three fixed indexes in
  the current database. A queue claim alone is not proof that DDL is running.
- Read the existing durable episode and its queue task. Missing/pruned tasks,
  terminal failures, and exhausted budgets remain visible; reading never resets them.
- Explain disabled configuration, restore verification, ingestion/backfill,
  cooldown, queue admission and expired claims separately. Future eligibility is
  a lower bound, not a promised start time. Manual jobs do not inherit automatic
  attempt semantics.
- A verified catalog means index readiness, not classification accuracy or proof
  that a particular repair job succeeded. Observations can change immediately.

## Boundaries

Use a dedicated read-only transaction, fixed parameterized queries, statement
and transaction deadlines, connection error handling, and in-flight coalescing.
The checked-out session is discarded after at most 10 seconds; SQL statements
have a 3-second timeout, lock waits 1 second, and the transaction 8 seconds.
Pool acquisition uses the existing configured connection timeout (5 seconds by
default). Coalescing is per router instance, not a cross-process lock.
Authorize administrators before database access; rate-limit and prohibit caching.
Return only closed status codes, bounded counts and timestamps. Never expose
query text, process IDs, claim tokens, queue payloads, endpoints or credentials.
No migrations, workers, runtime identities or deployment templates change.

## Research and alternatives

Official sources were discovered through MCP web search and read on 1 October
2026 for the requested September 2026 baseline. These are live documents, not
archived September snapshots.

- [PostgreSQL progress reporting](https://www.postgresql.org/docs/current/progress-reporting.html)
  describes phase-specific counters. A build-wide percentage or ETA would be
  misleading; use states and verified index counts instead.
- [PostgreSQL index catalog](https://www.postgresql.org/docs/current/catalog-pg-index.html)
  distinguishes valid, ready and live flags; index names alone are insufficient.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  calls for endpoint-level authorization and generic errors. Apply the existing
  administrator guard before observation and return no internal error details.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  supports a pre-existing polite status region without moving focus.
- [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html?trk=public_post_comment-text)
  requires textual cues alongside colors. Each segment includes a label and state.
- [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  motivates explicit refresh for this small diagnostic instead of another timer.

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Read-only snapshot + exact catalog + existing ledger | Clear, bounded, unchanged repair authority | Must refresh to see changes | Implement |
| Continuous polling / push channel | Faster updates | Extra lifecycle, load and pause controls | Not needed yet |
| Estimated global percentage | Familiar graphic | Unsupported precision across build phases | Reject |
| Reset/retry controls | Convenient intervention | New mutation authority can defeat safety budgets | Separate reviewed work |

Recommended stack: existing bounded worker, exact catalog observation, durable
episode ledger, administrator-only GET, modular Vue card. Follow with a
large-fixture resource/recovery study before changing automatic repair budgets.
