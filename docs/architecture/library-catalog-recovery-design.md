# Controlled library catalog recovery

Research date: 2026-09-27. Status: Unreleased.

## Finding and intended behavior

The existing six-hour library-sync task refreshes known library contents; it does
not rediscover the provider catalog. The previous diagnostics outcome overstated
that relationship. Use the existing five-minute ingestion watchdog to admit one
bounded catalog discovery when due, then continue its existing guarded ingestion.
No second worker, retry loop, new dependency or release is needed.

## Design

- Persist a configuration-bound attempt budget and next eligible time alongside
  the last discovery result. Charge attempts before network work, including crashes.
- Serialize manual and automatic reconciliation with one PostgreSQL session lock.
  Use its checked-out connection for status and merge writes, cancel provider work
  on connection loss, and never infer owner death merely from elapsed time.
- After success, discover again in six hours. Retry transient connectivity,
  timeout, rate-limit and retryable server errors with bounded jitter and at most
  five attempts in the fast-retry burst (including its initial attempt). Persistent
  transient failures then get one recovery probe per six hours until success;
  restarts do not renew the fast budget. Persist waits rather than sleeping.
- Honor valid Retry-After values. An excessive valid delay suspends automation
  instead of shortening the server's requested pause. Never retain raw headers.
- Rejected credentials wait for a saved connection revision or explicit manual
  retry. Invalid catalogs require review. Configuration
  changes invalidate prior admission evidence; ordinary restarts do not reset it.
- Automatic admission fails closed if its durable attempt cannot be recorded.
  Manual diagnostics remain best-effort; they do not make successful merges fail.
- Preserve all completeness checks, movie/TV filtering, reversible archives,
  ingestion ownership and learning-readiness gates. Catalog success does not mean
  ingestion or backfill has completed.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| In-memory retry timer | Small change | Loses budgets on restart and duplicates replica work; reject. |
| Dedicated queue/workflow engine | Rich scheduling | New infrastructure for one bounded operation; defer. |
| Existing watchdog + durable PostgreSQL admission | Restart-safe, shared ownership, no new worker | Five-minute timing granularity; recommended. |

Keep modular ESM services, native bounded HTTP, PostgreSQL and the existing Vue/SWR
read-only status card. Expose retry time or review requirement as text in its polite
status region, not only a color. Do not add UI polling, percentages or AI calls.

## Verification

Cover fresh/unconfigured setup, all three providers, access failure and changed
credentials, transient outage/recovery, Retry-After, exhaustion, restart, overlapping
manual/automatic runs, connection loss and stale completion. Exercise migration
and fresh-schema installation on disposable PostgreSQL. Prove discovery alone
cannot admit learning before complete ingestion, and preserve legacy-owner guards.

## Official research

- [AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/2024-06-27/framework/rel_mitigate_interaction_failure_limit_retries.html)
  recommends bounded retries, backoff and jitter at a deliberate layer, with
  idempotency and failure-path testing.
- [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) defines Retry-After
  as a delay in seconds or an HTTP date. Access failures are not repaired by retry.
- [Microsoft circuit-breaker guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
  supports limited recovery probes after sustained failure. Here the catalog read
  itself is the probe; there is no separate health endpoint or timer.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html)
  distinguishes session locks from transaction locks; ownership must be cooperative
  and held on the same session until the protected operation settles.
- [Jellyfin's virtual-folder API](https://typescript-sdk.jellyfin.org/functions/generated-client.LibraryStructureApiFp.html)
  returns an array. Recovery must not substitute Emby's query contract.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  describes polite, programmatically identifiable updates without moving focus.
