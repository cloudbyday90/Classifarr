# Shared web-search pacing design

## Decision

Use the existing short PostgreSQL admission transaction to coordinate automatic
request timing as well as credit reservations. A three-provider pacing table
stores the next admission time and a generation-scoped upstream wait. Cache hits
remain outside admission. Local waits consume neither credits nor item attempts;
the existing scheduler handles resumption without sleeping workers or open locks.

Start with a conservative one-second minimum admission interval per provider.
This is Classifarr policy, not a claim about every account's purchased capacity.
Network delay and other applications can still cause upstream throttling. Do not
infer a faster account limit or reset credits from a response header.

Parse bounded timing hints at the HTTP boundary. Brave's comma-separated limit,
remaining and reset values must align; only exhausted, finite windows contribute
a delay. Unlimited windows do not block. Honor valid Retry-After seconds or HTTP
dates; missing or malformed hints on 429 use a bounded fallback. Keep only delay
numbers, never raw headers, keys or response text. Positive waits are monotonic
within the same credential generation; responses from a replaced generation
cannot update the current provider. A successful recovery probe transfers its
valid wait to the newly verified generation.

Untrusted positive waits are capped at 30 days; a throttled response without a
usable hint waits 60 seconds. Deferred items retain the earliest positive wait
among deferred provider alternatives. This sets the item's due time without
charging an attempt or installing a dependency-wide pause for other providers.

Pacing precedes credit reservation under the same provider lock. Only successful
admission advances the next slot. Transactions use the database clock and bounded
lock, statement and transaction waits; no lock is held over HTTP. Database failure
defers admission. Failed feedback persistence cannot erase the durable base slot.
Explicit connection tests, external applications and old binaries remain outside
this cooperative automatic-request contract.

## Alternatives and stack

| Choice | Benefit | Cost |
| --- | --- | --- |
| Per-process sleep or limiter | Small implementation | Replicas and restarts escape coordination; workers wait |
| Shared PostgreSQL pacing (selected) | Durable, atomic with credits; no new service | Brief DB contention; conservative throughput |
| External queue/rate-limit service | Rich distributed scheduling | New infrastructure and migration contract |

Keep modular Node ESM policy/store modules, existing provider clients, PostgreSQL,
the scheduler/router and Vue settings. No new runtime dependency or polling loop.
Use additive schema migration and real-database tests, preserving media ownership
and classification behavior. W3C guidance favors concise, programmatic waiting
status without focus changes or an alert for every deferred request.

## Official research, September 29, 2026

Sources were discovered through search and official links, not assumed URLs.

- [Brave rate limiting](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting): sliding windows, aligned response headers, exhausted-window resets and evenly distributed requests.
- [Serper](https://serper.dev/): account tiers have different request rates; a local conservative floor is not a purchased-capacity estimate.
- [PostgreSQL locking](https://www.postgresql.org/docs/18/sql-lock.html): consistent lock order and transaction-scoped locks; do not hold locks while waiting on remote work.
- [HTTP semantics, Retry-After](https://www.rfc-editor.org/rfc/rfc9110.pdf): delay seconds or an HTTP date describe the requested wait.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): waiting status should be available to assistive technology without moving focus or unnecessary interruption.

Tavily's official index identified a rate-limit page, but retrieval failed during
research. No unverified Tavily throughput is embedded in this policy.

## Acceptance

Prove competing callers, restart, probe/search sharing, no-credit waits, cache
access, expiry, monotonic delays, generation replacement and verified recovery.
Test malformed/oversized/misaligned headers and non-exhausted monthly windows.
Run regression, lint, coverage and isolated fresh/upgrade installation checks.
See the separate [outcome and verification](web-search-pacing-outcome.md). No
release or live deployment.
