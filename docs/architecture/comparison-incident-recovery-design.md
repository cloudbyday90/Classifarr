# Comparison warning recovery

Date: 2026-10-09. Scope: error-log lifecycle, not comparison admission or fitting.

## Evidence and contract

Read-only local and Unraid investigations found incomplete-vector warnings whose
backfill and comparison refresh subsequently succeeded. The recovery information
was written to the container log, but the warning remained open in `error_log`.
Vector completion alone is insufficient: only `ready` or `revalidated`, after
fresh source/model/configuration verification and publication, proves recovery.

Use the existing logger's returned warning UUIDs. Attach a random episode ID and
an opaque runtime/configuration/model scope to new warnings. Retain at most 128
UUIDs for the current scope. A small repository resolves only these exact UUIDs,
with matching module, severity, message and episode metadata. Preserve the
original timestamp, severity, message, context and metadata; append a recovery
reference, observed time and fixed explanation using existing resolution fields.
Manual resolution is never overwritten. No schema migration is needed.

Busy, disabled, stopped, cancelled, invalidated, degraded, incomplete and not-due
outcomes never resolve warnings. Configuration/model changes start a new scope;
stopped or replaced schedulers cannot resolve their successor's incidents.
Unscoped readiness, clock and state-read failures remain visible but are not
automatically resolved. Scope begins after configuration observation; the first
successful model inspection establishes its identity. A subsequent digest,
dimension, provider or model change rotates it. Inventory revisions alone do not
rotate scope: recovery proves the current comparison is available, not that each
previously missing description was necessarily embedded rather than removed.
No plaintext endpoint, model digest, credentials, media text or raw error enters
incident metadata. No new provider request, recovery job or retry-budget reset.

Resolution is one parameterized, idempotent update under a bounded transaction
(3-second statement, 1-second lock, 5-second transaction limit). It runs only
after verified recovery. Failure leaves IDs pending for the next verified refresh;
no independent timer or retry loop is added. Logging failure must not change the
worker outcome. The existing pool bounds connection acquisition. Warning writes
use the existing logger/pool limits and are awaited before resolution, preventing
a late insert from escaping the matching recovery.

A failed resolution emits one fixed, sanitized informational reference per
episode, without database text. Initial and recurring scheduler callbacks share
one promise through warning persistence and resolution. A stop invalidates late
callbacks; a change detected before transaction completion rolls back the update.
The transaction's final ownership check is not a distributed database lease:
this feature resolves only IDs already owned by this process, not other writers.

## Restart and legacy limits

Episode ownership is deliberately process-local. A restart, scope change or
capacity overflow can leave a warning open for operator review; records without
an owned correlation are never inferred recovered from age or a new process's
success. In particular, this patch does not rewrite the two historical reports.
A durable cross-restart incident ledger is a separate design requiring instance
ownership and configuration continuity. No live data is manually resolved here.

## Options and recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Exact owned IDs and verified recovery | Small change; preserves evidence; cannot clear another process's warning | Does not reconcile older/restarted episodes; selected |
| Resolve every warning from the module | Simple | Can hide unrelated, concurrent or historical failures; reject |
| Suppress incomplete-cache warnings | Quieter UI | Hides persistent failures; reject |
| Durable incident ledger | Recovery across restarts | New ownership/schema/retention contracts; defer |

Recommended stack: validated worker result → scoped episode tracker → existing
logger → exact conditional resolution → existing resolved-log UI. Keep memory,
completeness, retry, routing and ownership safeguards unchanged.

## Verification and research

Test verified versus non-success outcomes, scope/model changes, late persistence,
replacement/shutdown, bounded tracking, null/throwing loggers, database failure,
ambiguous commit retry, manual resolution, foreign/legacy IDs, duplicate updates
and original-evidence preservation. Exercise the actual SQL against isolated
PostgreSQL; mocks alone are insufficient. Rebuild only local Compose without
cache, then dump/check schema using the disposable image runner.

Official sources discovered through MCP and reviewed on 2026-10-09:

- [OpenTelemetry logs data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/):
  separate event time, severity and contextual attributes. Episode UUIDs here
  are application correlation, not fabricated W3C trace/span identifiers.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  correlate related events, minimize sensitive data and test logging failures
  without letting them interrupt application behavior.
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html):
  conditional updates and `RETURNING` identify records actually changed.

These sources inform the design; none mandates this application-specific policy.
