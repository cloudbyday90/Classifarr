# Completed health-cache reconciliation: design

Date: 2026-10-12. Scope: cached health observations after configuration commits,
including commits made by another Classifarr process. No release or production
recovery is authorized by this change.

## Evidence and writer coverage

Completion fencing already re-reads configuration before publishing a probe, but
an accepted result can survive a later settings save until another probe runs.
Writers are not limited to HTTP settings handlers:

| Configuration | Writer families | Health readers |
| --- | --- | --- |
| AI provider | AI/Ollama settings transactions, RAG operations/model metadata, provider capability/lock and usage services | AI, RAG, image embeddings |
| Radarr/Sonarr | arr configuration service, library mapping, backup restore | Radarr, Sonarr |
| Media server | configuration helpers, Plex/Jellyfin/Emby OAuth transactions, library sync, backup restore | Media server |
| Notification | Discord persistence service | Discord |
| TMDb/OMDb/Tavily | transactional metadata configuration store; quota and credential recovery services | Corresponding metadata provider |

Route-only callbacks would miss direct SQL and background writes. Instead, retain
the existing configuration guard after successful acceptance: a fixed read callback
and process-private keyed digest, never a configuration row set. Every writer is
covered through the same selected rows used by the health check. INSERT, UPDATE,
DELETE, disabling and new configuration after an empty result require no writer hooks.

## Contract and bounds

- Reconcile only accepted observations that captured configuration and have no
  failure diagnostic. Database, process memory and queue worker are not watched.
- One process-local cycle, at most ten watched services and two concurrent reads.
  Wait 30 seconds after a cycle settles before starting the next. No provider
  requests, database writes, retry attempts, cooldown reset or automatic Refresh.
- Reads retain the existing pool acquisition and statement timeouts (defaults five
  and 30 seconds). The cadence is not a 30-second hard delivery guarantee: query
  latency, sequential batches and event-loop scheduling add delay.
- Compare committed content, not events. Uncommitted and rolled-back writes do not
  invalidate a cache. Reconnection needs no event replay: the next successful
  ordinary health check captures current state, then reconciliation resumes.
- A changed or unreadable configuration invalidates only that service, removes
  stale provider/instance details and its watch, and advances aggregate cache
  version. Preserve the original check time and historical last success; validation
  is not a successful provider probe. Next heartbeat/explicit Refresh can recover.
- A per-service generation fences a probe already in progress when invalidation
  occurs. Keep its admission occupied until it settles; no duplicate transport is
  launched. Old reconciliation must never invalidate a newer accepted observation.
- Reset fences all pending work. Stopping the heartbeat stops future reconciliation
  cycles. An admitted read may finish; no claim of transport cancellation is made.
- Fresh process: no observations, no reconciliation queries. Fresh configuration:
  normally accepted empty/disabled results remain watched for later setup changes.
- Transient, permission, schema, cancellation and unexpected read failures use the
  existing safe diagnostics. No raw errors, URLs, credentials or fingerprints are
  exposed. Authentication, readiness and memory safeguards stay unchanged.

## Alternatives and recommendation stack

1. **Chosen: background content reconciliation.** Covers all current writers with
   no schema or privilege change, no dedicated connection and no provider traffic.
   Costs at most ten small reads per cycle; selected-row comparison is conservative
   and may invalidate for unrelated counters/timestamps. It is eventual, not atomic.
2. **Post-commit route hooks.** Fast for local saves and cheap, but incomplete for
   OAuth, restores, workers and other processes unless every writer participates.
3. **Durable revisions plus LISTEN/NOTIFY.** Faster cross-process delivery and can
   detect A-to-B-to-A histories, but requires schema/triggers, explicit field scope,
   listener lifecycle and reconciliation after disconnect. Defer until the latency
   or read cost of the simpler approach is measured to be insufficient.

Content comparison does not detect A-to-B-to-A between snapshots or prevent a commit
after a validation read. It is not a revision lease or a security boundary. Existing
whole-row completion comparison remains unchanged to avoid silently narrowing its
safety contract. A later dependency-field audit can reduce incidental invalidations.

## Official research

Discovered through MCP search and opened on 2026-10-12:

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html):
  ordinary Read Committed queries observe commits visible when their statement
  begins. This supports rollback-safe inspection without holding a transaction
  over external work.
- [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html):
  delivery follows commit; payloads are visible to database users, and a full
  notification queue can fail a committing transaction.
- [PostgreSQL LISTEN](https://www.postgresql.org/docs/16/sql-listen.html):
  initial registration has a race requiring a subsequent state inspection.
- [PostgreSQL trigger behavior](https://www.postgresql.org/docs/current/trigger-definition.html):
  row and statement triggers have different firing/transition semantics. A trigger
  design needs explicit treatment of all write forms, not only ordinary UPDATE.
- [Node.js timers](https://github.com/nodejs/node/blob/main/doc/api/timers.md):
  scheduling is not an exact-time guarantee; unreferenced timers do not keep a
  process alive. Use completion-based scheduling to avoid overlapping slow cycles.

## Proof required and next item

Tests must cover commit/rollback across real PostgreSQL connections, disable/delete,
unchanged/empty data, failed reads, reset, concurrent Refresh and reconciliation,
new-result races, per-service isolation, timer stop/restart and no provider calls.
Rebuild from a clean runtime commit without cache; verify exact local image and run
the schema dump on an isolated synthetic database after rebuilding. Record outcomes
separately. Next: audit health-specific configuration dependencies to avoid unrelated
usage counters invalidating observations, without overlooking transport settings.
