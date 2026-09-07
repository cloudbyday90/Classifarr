# Metadata provider selection design

Date: 2026-09-07. See the separate [outcome](metadata-provider-selection-outcome.md).

## Problem and evidence

TMDb and OMDb backup restore used `ON CONFLICT (id)` without inserting an ID.
Their sequences therefore allocated another row on every restore. Settings saves
also performed read/delete-or-disable/insert sequences without serializing the
initial read, allowing concurrent saves to race. Readers used unordered `LIMIT 1`
queries, while the Tavily bridge selected the highest ID. TMDb cached its first
credential indefinitely, so settings changes could leave runtime on an old key.

A read-only local audit found three active TMDb rows and two active OMDb rows.
Each provider had exactly one distinct credential and one distinct set of
operational settings. Tavily had no legacy rows. No secrets were exported.

## Selected behavior

Use a small ESM storage service shared by runtime, health, settings and backups.
Runtime selects the highest-ID active row. Storage-level settings and backup
reads prefer an active row, otherwise the highest-ID inactive row. The existing
TMDb settings endpoint continues to return only active configuration. Selection uses fixed,
allowlisted SQL and never depends on physical table order. Existing conflicting
active configurations remain visible to the integrity audit; selection does not
delete them or infer that their credentials are interchangeable.

Every application configuration writer takes a transaction-scoped table lock
before reading fallback fields or replacing configuration. This also covers an
empty table and coordinates with OMDb counter updates. Upserts reuse the selected
row's explicit ID; new IDs are allocated only for an empty table. An explicit
settings save or restore deactivates the other rows while retaining their stored
credentials. OMDb counters remain attached to the stable selected ID. The Tavily
legacy mirror follows the same writer protocol.

A data-only migration consolidates active duplicates only when **all** active
rows have exactly equal operational settings, including their exact credential
bytes. It retains the highest-ID row and every stored credential value. For
OMDb it conservatively combines nonnegative current-day counters, capped at the
integer column limit. Historical rows and their counters remain stored. Distinct
settings are left untouched and continue to produce an integrity warning. This
repairs the measured local drift without selecting or disabling a distinct key.

TMDb resolves its active credential on each request instead of retaining an
unbounded process cache. Explicit test credentials and the existing environment
fallback remain supported. No extra operator workflow, API endpoint, client
contract, dependency or classification decision is introduced.

## Official research, checked September 2026

URLs were discovered through web search and read through the web tool.

- PostgreSQL [LOCK](https://www.postgresql.org/docs/18/sql-lock.html) explains
  acquiring `SHARE ROW EXCLUSIVE` before a read-then-write transaction and the
  importance of consistent lock order. Unlike locking returned rows alone, this
  protects the empty configuration table. Normal reads remain available.
- PostgreSQL [LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html)
  requires an explicit, unique ordering for predictable limited results. The
  primary-key tie-breaker makes provider selection independent of query plans.
- node-postgres [transactions](https://node-postgres.com/features/transactions)
  requires every statement in a transaction to use the same checked-out client.
  The shared writer receives the caller's transaction client, never the pool.
- PostgreSQL [constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
  documents unique partial indexes. A unique active-row index would reject an
  upgrade containing distinct legacy active credentials. This change deliberately
  preserves that data and serializes all application writers instead.
- OWASP [Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
  recommends limiting human handling and secret access. Keep existing masked
  responses, authenticated settings access and bound credential parameters; log
  aggregate repair outcomes without keys or key hashes.
- W3C [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  explicit provenance and data-quality limitations. Preserve integrity warnings
  for unresolved configurations and existing observation unknowns. There is no
  changed interface or new accessibility claim.

## Alternatives and recommendation stack

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Shared ordered reads and serialized stable-ID writes | Repairs restore/save races; consistent selection; retains credentials | Small configuration writes briefly block one another and quota updates. Selected. |
| Conservative duplicate migration | No operator step for provably equivalent configurations | Counter consolidation can conservatively overcount duplicated historical usage. Selected. |
| Unique index on active rows | Enforces the rule for every SQL writer | Cannot preserve conflicting legacy active rows during upgrade. Deferred. |
| Automatically pick a different credential and delete the rest | Removes every warning | Guesses authority and destroys retained configuration. Rejected. |
| Credential cache with revision invalidation | Fewer configuration reads | Requires new revision state and cross-process invalidation. Defer until measured. |

Recommended stack: fixed ordered SQL reads → transaction table lock → stable-ID
upsert → masked API response → existing integrity diagnostics. Direct SQL writers
remain outside the application writer protocol and can recreate drift; the audit
continues detecting it. Any future writer must use the shared service.

## Verification

Use real PostgreSQL tests for repeated restore, concurrent first saves, masked
updates after a concurrent rotation, counter preservation, rollback and migration
behavior on equivalent and conflicting settings. Check cache rotation, provider
health, backups, disabled-state selection and rejection of unsupported table
identifiers. Run relevant route/client API regressions and the full backend suite.
Local Compose validation must compare credential equality in memory without
printing keys, preserve all configuration rows, and avoid paid provider probes.
