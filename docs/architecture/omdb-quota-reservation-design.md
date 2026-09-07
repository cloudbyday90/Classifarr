# OMDb quota reservation design

Date: 2026-09-07. See the separate [outcome](omdb-quota-reservation-outcome.md).

## Problem and chosen behavior

The previous provider-selection fix preserves one stable configuration identity.
OMDb lookup accounting still reads usage, sends the request and increments only
after `Response: True`. Concurrent lookups can all pass the same remaining-quota
check. Not-found responses, failed attempts and retries are not counted. A separate
day-reset write can erase a concurrent increment. Node's local date comparison
also differs from PostgreSQL's reset date when their time zones differ.

Reserve one unit immediately before each configured lookup HTTP attempt, after
the existing pacing wait. The reservation uses the existing PostgreSQL transaction
helper and the same `SHARE ROW EXCLUSIVE` table lock as provider settings writers.
Read the selected active row only after acquiring that lock; validate the limit,
derive usage and increment on the same client before committing. The transaction
ends before HTTP or backoff. All application instances therefore share admission
state, and settings/restore cannot overwrite an in-flight reservation.

Use PostgreSQL's current statement time in UTC as the local calendar boundary.
This is Classifarr's local budget, not a claim about the provider's billing clock.
The first reservation after a completed UTC day resets and increments together.
Undated usage is carried forward; future dates and invalid limits/counters fail
closed. The advisory availability read uses the same calculation without writing.

Each retry consumes a new reservation. Success, not-found responses, HTTP errors
and uncertain network failures keep the reservation; there is no post-response
increment or refund. A crash between commit and dispatch can conservatively consume
one unit. Database failure prevents dispatch and is not retried as a provider error.
Diagnostics contain only fixed messages and numeric usage, never keys or SQL errors.

Scope covers title, IMDb-ID and search lookups. Existing explicit-key connection
and health probes remain separate because they can test unsaved credentials.
Other applications using the same API key also remain outside this local counter.
These limitations must be clear in documentation and the settings usage copy.
There is no new operator workflow, endpoint, schema object, dependency or routing
authority. Independent labels and readiness/frozen-study gates remain unchanged.

## Official research, checked September 2026

URLs were discovered through the web and GitHub MCP tools and then read.

- PostgreSQL [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains why an ordinary read is a snapshot rather than a reservation. Explicit
  locking and a transaction protect this small read/validate/write operation.
- PostgreSQL [LOCK](https://www.postgresql.org/docs/18/sql-lock.html) recommends
  acquiring the write-compatible lock before the initial read. Reuse the provider
  writer protocol and release it promptly; ordinary configuration reads continue.
- node-postgres [transactions](https://node-postgres.com/features/transactions)
  requires a single checked-out client for all transaction statements. Network
  calls occur only after the transaction helper commits and releases that client.
- OMDb's [API key page](https://www.omdbapi.com/apikey.aspx) documents the free
  1,000-per-day allowance. It does not specify the reset time or exact failed-call
  charging rules. The provider repository's [reset-time question](https://github.com/omdbapi/OMDb-API/issues/335)
  has no maintainer answer in the reviewed thread. Conservative local accounting
  and an explicit UTC boundary are design choices, not a provider guarantee.
- OWASP [Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends controlling request/resource use, including third-party costs. Count
  attempts at admission and stop when the shared budget is exhausted.
- W3C [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  understandable data semantics and explicit quality limitations. Describe local
  attempts and their day boundary accurately; a quota counter is not successful
  metadata coverage or a provider-side usage measurement.

## Alternatives, pros and cons

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Short PostgreSQL transaction using the existing writer lock | One coordination protocol; deterministic selection, day reset and admission | Serializes small quota/configuration writes. Selected. |
| Single conditional UPDATE with row locking | Fewer database round trips | Must also coordinate selection with legacy/configuration changes and distinguish rejection reasons. Defer optimization until measured. |
| Process-local mutex/counter | Simple and fast | Other workers and restarts bypass it. Rejected as the daily budget authority. |
| Reservation ledger with refunds | Detailed accounting and possible quota recovery | New retention, reconciliation and uncertain provider charging semantics. Deferred. |
| Increment only successful responses | Fewer counted calls | Oversubscribes concurrent requests and ignores retries/failures. Replaced. |

Recommended stack: existing request pacing → committed PostgreSQL reservation →
bounded HTTP attempt → existing retry budget, with a fresh reservation per retry.
Use fixed SQL, bound values, stable provider IDs, UTC calendar dates, conservative
attempt accounting and existing queue pause/fallback behavior.

## Verification plan

Reproduce the legacy concurrent admission bug with real PostgreSQL and fixture
credentials. Verify strict bounds, empty/disabled/invalid configurations, concurrent
rollover, settings and restore interleavings, transaction rollback and database
failure. Test HTTP dispatch counts independently from reservation counts, including
retry exhaustion and not-found responses. No real provider calls are required.
Run the complete backend unit suite, relevant integration and client regressions,
typecheck/lint/ESM checks, then rebuild local Compose and use read-only smoke checks.
