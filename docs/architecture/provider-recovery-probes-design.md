# Demand-driven provider recovery probes

## Decision

Add a small leased coordinator to the existing enrichment retry wake-up. Recheck
rejected OMDb, Tavily (including the legacy bridge), Brave and Serper credentials
only when eligible movie/TV enrichment is waiting. No daemon, new endpoint,
provider SDK, cached verification or AI call is required.

The first check is due 15 minutes after rejection. Subsequent failures use
exponential backoff with jitter, capped at six hours before provider delay hints
(retained up to an explicit 30-day operational cap).
One invocation sends at most one bounded five-second request. A database lease
prevents concurrent checks for the same saved credential generation. Crash
recovery retains the reserved quota and next due time rather than issuing an
immediate duplicate. No transaction stays open over HTTP.

Only a valid live provider response can clear rejection. Finishing requires the
same selected, enabled configuration, generation, unexpired lease and captured
provider options. Success rotates the generation even though the key is unchanged,
so an older in-flight failure cannot undo recovery. Failed or stale verification
never changes item attempts, terminal states, ownership or library content.

## Admission and cost

- Fresh setup, disabled providers/libraries/servers, music, finished/exhausted
  retries and libraries still importing produce no probe request.
- Do not require enrichment backfill completion: these retries can be part of
  that backfill, so waiting for completion would deadlock recovery.
- OMDb reserves one request against its existing UTC-day quota before HTTP.
- Web probes reserve one conservative cost unit in existing usage accounting,
  respect configured soft daily/monthly limits and provider cooldowns, and use a
  minimal basic search. A crash/failure does not refund an uncertain request.
- Web limits remain soft: ordinary web calls use existing usage-based admission,
  not a globally serialized hard reservation contract. This change does not claim
  to eliminate that pre-existing race across unrelated callers.
- Existing dependency cooldowns and per-item due times are not shortened.

## Security and operator experience

Fixed HTTPS endpoints, redirect rejection, response-size/deadline limits and
strict success validation protect the verification boundary. Persist only opaque
generations, leases, times and fixed outcome categories, never keys, key hashes,
queries containing private library data or provider response bodies. Settings
retain accessible status text and explain scheduled checks without promising a
recovery time. Unchanged settings saves and ad-hoc connection tests cannot reopen
the circuit. Corrected keys and explicit disable/re-enable remain available.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Manual configuration recovery only | No probe requests | Cannot discover account-only repair |
| Per-item checks | Simple local decision | Multiplies traffic and burns item budgets |
| Leased provider checks (selected) | Bounded, durable and generation-safe | Small migration and occasional quota cost |
| External workflow engine | Rich orchestration | New operational dependency for a small fixed workflow |

Use Node ESM service factories, PostgreSQL conditional writes/leases, existing
retry scheduling, bounded native HTTP transport, Vue settings, Jest and real
PostgreSQL concurrency tests. Keep probe transport, eligibility, quota and durable
state separate from orchestration.

## Official research: September 29, 2026

URLs were discovered through search, repository references or official page links
and retrieved; no third-party blog is a design authority.

- [AWS circuit breakers](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html): stop repeated calls and define controlled recovery with observable state.
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html): conditional writes and locked bounded candidates coordinate competing workers.
- [OMDb API](https://www.omdbapi.com/): verify using a documented ID lookup over HTTPS, not an invented health endpoint.
- [Tavily API](https://docs.tavily.com/documentation/api-reference/introduction): authenticated search and project tracking must match the saved provider context.
- [Tavily search](https://docs.tavily.com/documentation/api-reference/endpoint/search): basic search costs one credit; disable answer/raw-content generation for verification.
- [Brave rate limits](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting): respect response delay hints and multiple quota windows.
- [Serper API](https://serper.dev/): search consumes credits; a probe is not assumed free.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): announce waiting/recovery status without moving focus or repetitive alerts.

## Acceptance

Prove same-key account recovery, stale success and failure, configuration rotation,
competing workers, restart/expired leases, quota saturation/reset, malformed HTTP,
timeouts, disabled/empty/ingesting setups, legacy override and unchanged item
attempts. Use fixture credentials and mocked HTTP only. Record final results in
the separate outcome document. No release or live deployment in this round.
