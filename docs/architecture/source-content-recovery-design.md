# Shared media-source content recovery

Research date: 2026-09-28. Status: Unreleased.

## Finding

Catalog discovery now has durable admission, but each library still retries its
own content pages. One unavailable server can therefore receive requests from
many libraries. Generic adapter error wrapping also loses transport classification
after preflight. This change coordinates content-page admission at the source,
without treating catalog health as content health or replacing library ownership.

## Design

- Keep healthy imports concurrent within the existing two ingestion slots.
- Persist one configuration-revision-bound circuit per source. Only explicit
  network failures, timeouts, HTTP 429 and gateway/unavailability 502/503/504 open it.
  Permission failures, missing libraries, HTTP 500 and malformed pages remain
  library-local; one bad library must not disable healthy peers.
- Check the circuit before claiming library work and before every media/collection
  page. Defer rather than sleep. After cooldown, allow one bounded canary checking
  both media and collections (at most four two-item requests) under a PostgreSQL
  session lock on the ingestion owner's connection.
- Charge probe attempts before HTTP. Persist conservative crash delay. Five failed
  attempts lead to six-hour probes; successful validated probes reset the budget.
  Honor Retry-After, including longer delays; excessive hints require review or a
  corrected connection revision. Neither restart nor ordinary manual sync resets
  the source wait.
- Fence completions with revision and epoch. An older success cannot clear a newer
  failure. Connection loss cancels HTTP and prevents replacement-connection writes.
  A due timestamp alone never proves that a probe owner stopped.
- A probe validates bounded pages, not a complete library. Media success cannot
  clear a collections outage. Preserve full
  preflight, enumeration, pruning, archive, music exclusion and learning gates.
  Inconclusive probes retain a bounded wait; other eligible libraries can probe
  later. The watchdog skips cooling sources and retains its existing bounded batch.
- Project only fixed reasons, counters and times in the existing read-only import
  status. Keep SWR and its polite status region; no new polling loop or endpoint.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Per-library backoff only | Simple, already present | Multiplies outage requests; insufficient. |
| Serialize all healthy source requests | Easy exclusion | Unnecessary throughput loss; reject. |
| Shared durable circuit with one recovery probe | Restart-safe and source-scoped | One admission read per page; recommended. |
| External workflow or service mesh | Broad coordination | Additional infrastructure; not needed for this boundary. |

Use modular ESM policy/repository/reader services, existing PostgreSQL ownership,
bounded native HTTP and Vue/SWR. Retry timing trades immediate recovery for a
controlled load. This does not coordinate unrelated metadata/enrichment clients or
older external scripts, and a catalog success cannot close this circuit.
Already-admitted concurrent requests may finish or fail; their failure can extend
the wait, but their success cannot close it. The sequential 100-library test is
not a claim that concurrent outage detection permits exactly one total request.

## Verification plan

Test many libraries against one outage, independent sources, healthy concurrency,
one due probe, restart/crash and connection loss, stale success, changed settings,
Retry-After, late-page failures, permission/malformed-data isolation, and recovery
through complete movie/TV ingestion before learning. Exercise upgrade and fresh
schema paths in disposable PostgreSQL and real HTTP fixtures for all providers.

## Official sources

- [Microsoft circuit breakers](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker):
  bounded half-open trials, exception classification and resource isolation.
- [Microsoft transient-fault guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults):
  coordinate retry layers and respect server recovery timing.
- [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html): Retry-After delay/date
  handling and distinctions among response status codes.
- [PostgreSQL session locks](https://www.postgresql.org/docs/17/explicit-locking.html):
  retain cooperative ownership on the same session through the protected operation.
- [Jellyfin item API](https://typescript-sdk.jellyfin.org/interfaces/generated-client.LibraryApiGetItemsRequest.html):
  parent-library filtering, bounded pagination and explicit total counts.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22):
  identify status updates programmatically without moving keyboard focus.
