# OMDb health admission design

Decision: 2026-10-12. Unreleased; no production deployment.

## Evidence and boundary

System-page OMDb health uses a real title request but bypasses `reserveOmdbQuota`.
The normal fifteen-minute heartbeat implies 96 scheduled requests per day per
continuously running installation, plus startup and manual checks. This is a
calculation, not measured provider billing. Lookup and credential-recovery traffic
already share database-backed daily admission and pacing. Health must join that
boundary before changing cadence or claiming a complete account-wide budget.

Account for each admitted System-health attempt in the existing `requests_today`
counter. Reuse the same configuration lock, credential-generation check, local
daily policy, durable one-second admission floor and existing provider cooldown.
Do not add a second counter, queue, scheduler or schema migration. Reading cached
OMDb health and reconciling its configuration do not reserve credits or call OMDb.
Only a requested or scheduled OMDb provider check reserves a credit.

## Contract and failure handling

- Missing configuration produces no work. Invalid credential context fails closed.
- Admission is one bounded transaction; HTTP begins only after successful commit.
  Competing lookups, recovery and health checks cannot spend the same credit.
  The coordinator shares one in-flight OMDb check per process. Across processes,
  the existing one-second admission floor is rate control, not a global in-flight
  request limit. Keep the existing one-second lock, five-second statement,
  ten-second idle-transaction and fifteen-second total-transaction bounds.
- Busy pacing, depleted local quota, rejected credentials, configuration drift
  and unavailable admission produce a safe, specific unknown health observation.
  No provider request, item attempt or last-success timestamp is fabricated.
- An admitted check performs at most one bounded HTTPS request: ten seconds,
  1 MiB decoded body, no redirects. Existing payload validation and provider failure
  classification remain in place. No retry sleeps or extra workers are added.
- Preserve last-success history, not a stale healthy result. Admission failures
  remain configuration-watched so correcting settings retires obsolete advice.
  Watch the configured daily limit, but do not turn usage counters or pacing
  timestamps into configuration fingerprints.
- A crash after reservation may consume a local credit without an HTTP request.
  Uncertain commits are never refunded or retried inside the check. Restarted
  callers observe durable quota/pacing. The existing heartbeat or explicit refresh
  can attempt again; admission waits do not claim that provider recovery succeeded.
- Credential generation is checked before reservation and the existing health
  guard checks saved configuration again before publication. A committed request
  can race a later settings change, but its stale result cannot become current.
- Health does not clear/reject credentials, reset imports, route media, write
  inventory, relax TLS or change memory safeguards. Fixed public diagnostics never
  expose keys, upstream bodies, URLs or database exception text.

Existing explicit settings tests can use unsaved credentials and remain outside
this local-budget boundary. Call-site review also found a legacy SSL-recovery
probe in `QueueTaskProcessorService.isOmdbSslBlocked` calling `omdbService.checkHealth`.
It has process-local timing and remains outside this System-health increment;
review that recovery contract next before claiming complete automatic accounting.
Separate databases sharing one key, other applications
and old binaries are not coordinated. Historical health traffic cannot be safely
reconstructed: no guessed retroactive debit or backfill. Local UTC rollover remains
Classifarr policy, not a documented OMDb account reset guarantee.

## Official sources and alternatives

Sources discovered and opened using MCP search on 2026-10-12:

- [OMDb key registration](https://www.omdbapi.com/apikey.aspx) lists a 1,000-request
  daily free tier. [OMDb API documentation](https://www.omdbapi.com/) documents
  title/year requests and HTTPS support; no free health endpoint is established.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  documents conflicting table-lock modes and consistent acquisition order.
  Keep the existing `SHARE ROW EXCLUSIVE` configuration-table lock and short
  transactions; do not hold one across HTTP.
- [OWASP resource consumption guidance](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  calls for bounded execution and third-party resource/spending controls. Applying
  the existing credit gate to health is our design inference from that guidance.

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Shared quota and pacing | Durable accounting; no new deployment or schema | Health competes for the same local credits | Adopt |
| Separate health budget | Makes health traffic explicit | Two budgets can disagree with one upstream allowance | Defer |
| Longer/adaptive health cadence | Fewer provider requests | Must redesign freshness and recovery latency together | Measure next |
| Reuse lookup success as health | Avoids synthetic traffic | Requires endpoint/context/time attribution and failure policy | Investigate next |
| Process-local limiter | Small implementation | Restart and multi-process bypass | Reject |

Recommended stack: a small ESM health-admission service, existing PostgreSQL quota
and pacing stores, bounded metadata probe, configuration-fenced health coordinator,
and unchanged Express/Vue health contract. Keep heartbeat and freshness policy
unchanged for this increment; do not conceal skipped work as fresh success.

## Acceptance

Unit tests cover all admission classes, safe output, preserved history and zero
HTTP on denied/uncertain admission. Disposable PostgreSQL plus synthetic HTTP
must prove commit-before-request, concurrent health/lookup contention, restart,
rollback, exhaustion, generation replacement and inherited cooldown. Verify public
summary status and configuration reconciliation. Run coverage/static checks, an
exact-image isolated rehearsal and backed-up local no-cache Compose replacement.
Record outcomes separately; do not describe unrun checks as passing.
