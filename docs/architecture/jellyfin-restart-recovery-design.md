# Jellyfin restart recovery acceptance design

Date: 2026-09-28. Research cutoff: September 2026.

## Problem and decision

The shared source-content circuit already has database-backed integration tests,
including failed sessions. Reconstructing a service object is not a process
restart, and terminating a session still permits JavaScript error/finally handlers
to run. Neither proves recovery after abrupt ingestion-worker death.

Add an acceptance suite to the existing isolated PostgreSQL integration harness.
Run the real Jellyfin HTTP adapter, ingestion ownership, circuit, capture and
inventory persistence in disposable Node processes. Kill a worker while a later
page is blocked; start a different process against the same suite database.
Exercise metadata backfill and profile refresh with synthetic provider responses.
Do not introduce another scheduler, recovery ledger, production setting or schema.

## Acceptance contract

1. A fresh installation waits without libraries; populated legacy movie and TV
   libraries without completed ingestion also keep learning waiting.
2. A Jellyfin outage persists one shared cooldown. A new process cannot bypass it
   or issue one failing request per library.
3. A live ingestion owner excludes a competing process. A killed owner leaves its
   unfinished capture/checkpoint intact; PostgreSQL releases its session locks.
4. A replacement process honors the persisted retry time, then replays from page
   zero. Existing and partially imported inventory survives until both media and
   collection enumeration finish. Successful replay does not duplicate items.
5. Movie and TV backfill completes through the real queue/persistence services.
   Music is ignored. Pending backfill keeps the background readiness wrapper from
   invoking its worker; only completed work permits invocation.
6. Profile revisions catch up to source revisions. No routing or model evaluation
   is performed or claimed by this test.

## Isolation and bounded execution

- Reuse the integration runner's per-suite database and test-owned PostgreSQL
  container, not local application volumes or credentials.
- Child processes receive only required operating-system environment variables,
  explicit synthetic database configuration and a fixed fixture entrypoint.
  Suppress the production dotenv loader in this test process before service imports.
- Bind the synthetic Jellyfin server to loopback on an ephemeral port. Use unique
  library identities, bounded pages and explicit fault barriers, not sleep-based
  assumptions. Keep request diagnostics free of authentication headers/query values.
- Bound commands and process shutdown; always stop owned children and sockets.
- Advance only test-owned retry timestamps, after proving that early retries are
  rejected. Never shorten production cooldowns to accelerate acceptance testing.

## Options and recommendation stack

| Option | Benefit | Cost / limit | Decision |
| --- | --- | --- | --- |
| More in-process mocks | Fast, precise branch coverage | Does not prove abrupt process death | Keep existing tests |
| Real worker processes + PostgreSQL + synthetic Jellyfin | Reproducible crash, durable-state and HTTP-contract checks | Does not prove a complete deployed application restart | Implement now |
| Full released image + real Jellyfin instance | Deployment and provider compatibility evidence | Slower, needs pinned images, provenance and managed fixtures | Next acceptance layer |

Final stack: existing service boundaries → real PostgreSQL session ownership →
durable source circuit and full replay → metadata queue → revisioned profiles →
readiness-gated evaluation. Keep expensive evaluation downstream of ingestion;
do not infer routing quality from profile freshness.

An important limit: the readiness query currently checks queued/running backfill,
not unenqueued enrichment demand. This suite explicitly invokes the real refill
service after ingestion; it does not prove an atomic scheduler handoff. Follow-up
design should cover that boundary before claiming fully automatic end-to-end
readiness. Do not replace this with a blanket wait for every optional provider.

## Official research and application

- [Jellyfin item request contract](https://typescript-sdk.jellyfin.org/interfaces/generated-client.LibraryApiGetItemsRequest.html)
  exposes parent, offset, limit, item-type and total-count controls. Fixtures use
  the same paginated envelope as the existing production adapter.
- [Jellyfin monitoring](https://jellyfin.org/docs/general/post-install/networking/advanced/monitoring/)
  describes health checks and migration limitations. Design inference: a health
  response alone cannot prove complete media and collection enumeration.
- [PostgreSQL 18 advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html)
  documents session-level locks and automatic release when sessions end. Assert
  observed lock release after killing the process, rather than guessing from age.
- [Node 24 module hooks](https://nodejs.org/docs/latest-v24.x/api/module.html)
  describe preloading synchronous hooks before the application graph loads. The
  fixture uses `--import` to suppress dotenv without converting production imports
  or bypassing the repository's static-ESM checks.
- [Jellyfin proxy security guidance](https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/)
  warns that request URLs can contain credentials. Test diagnostics retain only
  synthetic pagination coordinates, never request headers or raw URLs/logs.
- [Microsoft circuit-breaker guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
  motivates limited recovery probes; [transient-fault guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
  motivates bounded retry budgets. A fresh process must preserve the shared wait.
- [W3C status-message technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  supports polite, programmatically exposed status updates. No UI changes are
  needed for this test-only increment; this is not a new accessibility certification.

Sources were discovered/checked through connected GitHub and web tools. Outcome
and validation results are recorded separately after implementation.
