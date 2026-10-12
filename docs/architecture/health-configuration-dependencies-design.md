# Health configuration dependencies: design

Date: 2026-10-12. Follow-up to completed-cache reconciliation; no release.

## Evidence and scope

Whole-row comparison treats unrelated counters and timestamps as configuration
changes. In particular, OMDb request accounting can invalidate a completed health
result even when its credential and active selection remain unchanged. A digest
does not retain old row contents, so an existing warning cannot name the exact
changed field. Do not claim a particular counter caused an individual warning.

Audit the probe and its helpers, not just the top-level health function:

| Check | Dependencies retained | Excluded from comparison |
| --- | --- | --- |
| Radarr/Sonarr | ID/name, URL, protocol/host/port/base path, API key, TLS verification, timeout; active membership | Creation/update timestamps, library/profile/monitoring preferences |
| TMDb | Selected ID/API key; active membership and newest-ID ordering | Language, timestamps |
| OMDb | Selected ID/API key, credential generation/rejection; active membership/order | Request count, reset date, daily quota, timestamps |
| Tavily | Selected ID/API key, credential generation/rejection; active membership/order | Search options, domain filters, timestamps |
| Image embeddings | Weight, mode, local host/port, cloud provider/key | Model-cache refresh timestamp |
| RAG | Existing four selected fields affect status or displayed provider/model | Already explicit; unchanged |
| Discord | Existing selected token, plus runtime bot state | Already explicit; unchanged |
| AI/Ollama | Keep conservative existing comparison | Defer narrowing: helper also reads cached/legacy Ollama settings |
| Media server | Keep conservative existing comparison | Defer narrowing: health reader expects legacy token/connection fields unlike the current schema's API-key contract |

Arr helpers consume fallback addressing, TLS and timeout fields, so retaining only
URL/key would be incomplete. Keep credential generation/rejection conservatively
even though current metadata health probes do not inspect those fields directly.
No claim is made that quota changes cannot affect later lookup availability: this
check is connection/configuration health, not a quota readiness assessment.

## Implementation contract

Use a small ESM module with six fixed SQL projections. The same query supplies the
probe, completion guard and later reconciliation: no separate field list or dynamic
caller-supplied SQL. Preserve filters/order/limits and status API contracts. Missing
required columns or failed reads remain unknown through the existing safe boundary.

No migration, provider request, retry, recovery write, listener or timer is added.
Existing admission, two-reader concurrency, 30-second completion-based cadence,
query/probe timeouts and reset fencing remain unchanged. Empty/disabled rows require
no probe; enabling/deleting/replacing selected configuration still invalidates.
Fresh installs need no backfill. Restart discards process-local observations and
normal checks rebuild them. Unknown, transient and cancelled reads keep existing
diagnostics and next-heartbeat/Refresh recovery. No raw credentials or row diffs are
logged. Authentication, readiness and memory safeguards stay intact.

## Alternatives and recommendation

1. Choose explicit SQL projections for fully traced paths: fewer false alarms and
   less fetched data, with a maintenance obligation when probe inputs change.
2. Retain whole rows for unresolved dependency paths: conservative, but some false
   invalidations remain. Do not guess through legacy/cached configuration.
3. Reject a global timestamp/counter denylist: cheap initially, but unreviewed new
   fields and differently named counters make it unpredictable.
4. Defer durable configuration revisions: stronger event history, but requires
   writer/migration coordination and does not replace a dependency audit.

## Proof and next item

Test actual projected queries on isolated PostgreSQL: incidental updates must
retain the observation, every retained field must invalidate, active/newest-row
selection must remain intact, and rollback must not invalidate. Keep existing
race/failure tests. Rebuild local Compose without cache and dump schema afterward
using only an isolated synthetic database. Record outcomes separately.

Next: repair the AI/Ollama and media-server health adapters against current saved
configuration and consistently handle helpers returning `success: false` without
throwing. This audit found those pre-existing gaps; they are not fixed by changing
comparison fields and must not be hidden by more optimistic health labels.

## Official research

Discovered with MCP search and opened on 2026-10-12:

- [PostgreSQL select lists](https://www.postgresql.org/docs/18/queries-select-lists.html):
  explicit output columns constrain the returned row. Applying this to a health
  dependency contract is our design inference, not a database-provided cache rule.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html):
  Read Committed observes committed state at each statement's start. These checks
  remain eventual snapshots, not leases or protection against later commits.
