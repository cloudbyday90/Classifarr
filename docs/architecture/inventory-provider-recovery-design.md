# Inventory provider recovery: design

## Decision and scope

Implement durable, item-scoped TMDb observation recovery on the existing metadata
queue. A provider 404 proves that the requested typed identity is unavailable; it
does not prove deletion, a merge, or the identity of a replacement. This increment
automatically recovers when that identity becomes available or source metadata
changes. It does not guess a replacement, authorize routing, ingest music, invoke
AI, or add a second scheduler.

## State and ownership

Keep one bounded current recovery record on `media_server_items`, separate from
log retention and observed learning metadata. It contains an opaque case ID,
typed provider identity, allowlisted failure category, attempt count, first/last
observation times, and resolution time. Separate typed columns hold the next
eligible retry and a five-minute attempt lease. There is no raw response, request
URL, credential, or duplicated title in the record.

The queue refreshes the source snapshot, then claims a due attempt with a
compare-and-set update before provider I/O. A fresh UUID fences completion.
Expired leases can be reclaimed after interruption. A source change clears the
lease, recovery state and observation clocks, so an old result cannot win even
after a source changes away and back. No network request holds a database lock.

Save validated observation, recovery status, retry deadline, lease release and
activity counters in the same guarded statement. Emit warnings only after that
commit, on a new case or changed cause; repeated failures update the existing
record. Recovery emits an informational transition. Existing queue replay and
refill resume work after restart. General enrichment completion remains distinct
from successful provider observation.

## Retry policy and limits

Transient failures start at six hours and use capped exponential backoff with
jitter. Missing identities and configuration/response problems start at one day
and cap at seven days. Retry-After is accepted only as bounded sanitized timing
evidence; no provider headers or response bodies enter persistence or logs.
There are no immediate retry loops in this layer. Periodic rechecks remain
available rather than permanently abandoning unresolved items. Configuration
changes do not yet trigger immediate rechecks; that requires provider-wide
recovery admission, not per-item credential fingerprints.

## Research checked 2026-09-27

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data): external-ID
  lookup is distinct from title search. Replacement discovery must use corroborated
  evidence, not the closest title alone.
- [TMDb rate limiting](https://developer.themoviedb.org/docs/rate-limiting): respect
  throttling; do not assume a permanently fixed request allowance.
- [AWS retry/backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html):
  distinguish transient failures and make retries idempotent.
- [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  guarded updates re-evaluate their predicates after concurrent changes. Use a
  current lease token, not a read-then-unconditional-write sequence.
- [HTTP Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3):
  support delay seconds and HTTP dates without exposing arbitrary headers.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  validate event fields and exclude credentials and sensitive provider payloads.
  Recovery records use allowlisted categories and bounded identifiers/timestamps.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  the follow-up recovery UI must expose meaningful text and programmatic status,
  not color alone. This backend change does not claim UI accessibility conformance.

## Alternatives and recommendation stack

| Approach | Advantage | Disadvantage |
| --- | --- | --- |
| Fixed retries and warnings | Small implementation | Repeated noise, no restart-safe diagnosis |
| Title-based automatic replacement | Appears hands-off | Can corrupt identity and learning; rejected |
| Existing PostgreSQL + queue + typed recovery | Atomic, bounded, restart-safe | Requires migration and concurrency tests |
| Separate workflow platform | Rich orchestration | Adds infrastructure without solving identity evidence |

Recommended stack: PostgreSQL guarded updates and leases; small ESM policy,
persistence and reporting modules; existing queue admission/refill; allowlisted
diagnostics; deterministic unit and real PostgreSQL fault tests. Next: bounded
external-ID revalidation for unresolved 404 cases, with source corroboration and
an explicit evidence gate before any replacement is allowed.
