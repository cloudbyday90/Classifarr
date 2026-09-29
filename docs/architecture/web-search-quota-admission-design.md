# Atomic web-search quota admission

## Decision and scope

Replace check-then-send usage accounting with a short PostgreSQL transaction that
locks the selected configuration, revalidates its credential generation and
options, serializes the provider budget, and reserves credits before HTTP.
Routed classification searches, enrichment retries and recovery probes share this
boundary, including the legacy Tavily bridge. No new daemon or schema is needed.

Routing remains a preview. A fresh cache hit costs zero; budget-limited candidates
may still serve a cached response, but misses require admission. Disabled,
rejected and cooling-down providers remain excluded. Stale settings and unavailable
database admission defer work without sending HTTP or spending item attempts.

## Accounting and concurrency

Use the existing usage ledger and its current-month retention protection. Acquire
configuration locks before the provider-scoped transaction advisory lock; keep
lock/statement/transaction waits bounded and never hold a transaction over HTTP.
Use the database UTC clock after acquiring locks, not a worker's cached usage
snapshot. The same usage row is completed once, retaining its admission timestamp
and reserved credits. No refund is inferred from timeout, crash, telemetry failure
or an ambiguous remote outcome. This is conservative local accounting, not a bill.

Tavily advanced requests reserve two credits; basic/fast/ultra-fast reserve one.
Current Brave and Serper search requests reserve one. Recovery probes use basic
minimal requests and reserve one. No automatic retries are added inside dispatch.
Changing a key, toggling a provider or restarting does not reset monthly usage.

Existing `softDailyLimit` and `softMonthlyLimit` API/storage names remain compatible;
the UI now calls them automatic credit budgets. No configured limit means no local
cap, not unlimited upstream access. All shared-database runtime instances must use
this protocol; an older application cannot participate in its locking contract.

Explicit connection/diagnostic tests, especially tests with unsaved keys, and usage
from other applications are outside this automatic budget. Do not claim an
account-wide spending guarantee. These boundaries are visible in settings.

## Alternatives and recommendation

| Approach | Advantage | Trade-off |
| --- | --- | --- |
| Usage preview only | No blocking transaction | Concurrent overspend and lost crash accounting |
| Process-local mutex | Simple | Does not coordinate replicas or survive restarts |
| PostgreSQL reservation (selected) | Reuses durable ledger; coordinates runtime workers | Brief lock contention; conservative uncertain costs |
| New external quota service | Independent cross-application admission | New infrastructure and rollout contract |

Keep Node ESM modules, PostgreSQL, the existing scheduler and usage retention,
bounded provider clients, Vue status text, Jest and real PostgreSQL race tests.
Separate credit policy/reservation from configuration admission and cached search
orchestration. No new SDK, cache library, polling layer or release is required.

## Official research: September 29, 2026

URLs were discovered through search and official links and retrieved before this
decision. W3C guidance informs the existing programmatic status text, not a new
alert stream or dashboard.

- [PostgreSQL explicit locks](https://www.postgresql.org/docs/18/explicit-locking.html): consistent lock order and transaction-scoped advisory locks coordinate cooperating workers.
- [Tavily search modes](https://help.tavily.com/articles/6938147944-basic-vs-advanced-search-what-s-the-difference): basic and advanced searches have different credit costs.
- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search): basic, fast and ultra-fast cost one credit; advanced costs two. Explicit search depth prevents automatic parameters from increasing that cost.
- [Brave rate limits](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting): upstream rate windows and billing differ from local conservative reservations.
- [Serper](https://serper.dev/): queries consume credits; local reservations are not authoritative account balances.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): status updates should be available without moving focus or unnecessary interruption.

## Acceptance

Test concurrent last-credit contention, two-credit Tavily admission, shared probe
and search reservations, restart/crash cost retention, UTC day/month boundaries,
stale/disabled/rejected configuration, database failure, cache hit/miss behavior,
single-row completion, retention protection and unchanged retry attempts.
The [outcome document](web-search-quota-admission-outcome.md) records final
evidence. No live provider calls, persistent-library changes, release or
deployment are part of this round.
