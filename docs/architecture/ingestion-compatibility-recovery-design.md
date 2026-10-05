# Legacy ingestion compatibility recovery

## Decision

Use a database compatibility fence to reject **unmodified older writers**, then
recover pre-fence import markers in the existing library owner. This is the
administrator-selected compatibility boundary, not privilege isolation against a
database owner/superuser deliberately disabling triggers or copying the protocol.
Separate database/OS identities remain a security-hardening follow-up.

No Compose, Unraid template, credentials, or media-server changes are required.
Two installations reading the same Plex server but using separate databases do
not share ingestion ownership.

## Contract

- A transactional migration takes bounded exclusive locks on the six ingestion
  tables. Existing writes finish before cutover; late old writes fail afterward.
- Row triggers cover insert/update/delete (including cascades); statement triggers
  cover truncate. Reads remain available. The current application announces a
  fixed protocol in each connection's startup options, retaining existing options.
- Existing sync/capture markers receive protocol zero. The trigger stamps every
  subsequent marker write with protocol one. Recovery never guesses from age and
  never takes over unknown work created by current software.
- Under the existing library advisory lock and two-slot capacity limit, recover
  at most 100 old sync markers per invocation. Recheck fence installation and
  enabled/configured source under transaction locks. Disabled, archived,
  unsupported, and unconfigured libraries do no recovery work.
- Every retired batch has an atomic system audit record, without impersonating an
  administrator or claiming workers stopped. Extra batches wait for the existing
  scheduler. The final batch starts tracked import-and-metadata recovery.
- Preserve inventory. Force full replay using existing enumeration validation,
  pruning, retry budgets, source revision checks, and metadata handoff. Optional
  AI/embedding jobs do not hold completion open.
- A crash before commit rolls back retirement and audit together. A crash after
  commit resumes through durable ownership/retry state. A missing/disabled fence,
  current-protocol foreign writer, or uncertain state remains blocked.
- Migration lock timeout is five seconds; recovery transaction lock/statement
  budgets are 500 ms/five seconds. No network call occurs in these transactions.

## Tradeoffs and recommendation stack

1. Compatibility fence and automatic bounded recovery: deployable with existing
   templates; adds trigger overhead and requires protocol-aware maintenance tools.
2. Existing owned full import plus metadata backfill: preserves inventory and
   completion semantics; a full scan costs more than resuming an unverified page.
3. Separate privilege isolation: stronger protection against compromised writers;
   requires deployment/identity migration and remains a distinct workstream.

Do not set the protocol as a database/role default: old clients would inherit it.
Do not downgrade onto the upgraded database: restore a pre-upgrade backup into
a separate database for rollback. External write scripts must be reviewed before
opting into the protocol; merely stamping an old importer is not a safe upgrade.

## Official sources checked 2026-10-05

- [PostgreSQL trigger semantics](https://www.postgresql.org/docs/18/sql-createtrigger.html):
  row events, truncate statements, and foreign-key cascades inform fence coverage.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  exclusive cutover locks drain conflicting transactions before activation.
- [node-postgres client configuration](https://node-postgres.com/apis/client) and
  [pool configuration](https://node-postgres.com/apis/pool): connection startup
  options belong on each client, not asynchronous pool connection event handlers.

Outcome and exact validation results are recorded separately after implementation.
