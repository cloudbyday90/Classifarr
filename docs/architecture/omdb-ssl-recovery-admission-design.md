# OMDb SSL recovery admission design

Decision: 2026-10-12. Unreleased, local implementation; no Unraid deployment.

## Cause and scope

`QueueTaskProcessorService.isOmdbSslBlocked` calls the legacy `checkHealth` helper
while an SSL pause is active. Unlike lookups and System health, it bypasses shared
quota/pacing and receives only a key, without the saved credential generation.
It can therefore spend uncounted requests and accept recovery from obsolete
settings. Its exception logging also trusts upstream message text.

Move this automatic probe into a small ESM service using the existing PostgreSQL
admission store. Keep the local SSL pause, warning throttle, sixty-second default
probe interval and fifteen-minute default block expiry. Expiry still permits an
ordinary admitted lookup; it is not evidence that SSL recovered. No new migration,
worker, timer, queue, endpoint, dependency or deployment setting is required.

## Contract

- No active SSL pause means no synthetic probe. Missing/invalid credential context
  makes no request. The enrichment caller passes its complete saved configuration.
- Reserve one existing daily credit with `pacing: true` and the expected credential
  generation. Exhaustion, pacing, rejection, disabled/replaced configuration and
  database failure all defer recovery without HTTP. Never refund an uncertain
  commit or retry admission within the call.
- Keep the shared one-second floor and existing durable provider cooldown. Use
  existing one-second lock, five-second statement, ten-second idle-transaction and
  fifteen-second transaction bounds. HTTP starts only after confirmed commit.
- At most one probe is in flight per task processor. Across processes, shared
  admission limits rate, not total HTTP concurrency. Process restart loses the
  old local SSL pause, as before, but cannot reset persisted credits or pacing.
- Probe one fixed HTTPS endpoint, with certificate validation, no redirects,
  ten-second timeout and 1 MiB decoded-body limit. A validated success or confirmed
  not-found response establishes transport recovery, matching the old SSL contract.
  Authentication/quota/rate-limit errors, cancellation, malformed responses and
  transport failures do not. Only a certificate failure extends the SSL pause.
- Re-read active credential ID/generation/rejection after the response. Changed
  settings or an unreadable configuration cannot clear or extend the pause. An
  in-flight reset or newer SSL pause also invalidates the old result. As with any
  remote read, a setting can change after this check; the subsequent real lookup
  still has its own admission. This does not lock configuration across HTTP.
- Keep durable item retry handoff while recovery is pending; do not fabricate
  enrichment, trigger web fallback, reject credentials, or mutate inventory from
  the synthetic probe. Safe fixed reason codes replace raw probe error logging.
  Do not relax TLS, database ownership or memory safeguards.
- No historical debit/backfill: unrecorded requests cannot be reconstructed.
  Existing and fresh deployments use the new code on the next normal task.
  Separate databases sharing a key and explicit settings tests are outside scope.

## Official sources and options

Discovered and opened with MCP search on 2026-10-12:

- [OMDb key registration](https://www.omdbapi.com/apikey.aspx) documents the free
  daily allowance. [OMDb API](https://www.omdbapi.com/) documents title queries and
  HTTPS; neither establishes a free synthetic health-request exemption.
- [PostgreSQL 18 LOCK](https://www.postgresql.org/docs/18/sql-lock.html) explains
  transaction-scoped table locks and consistent acquisition order. Reuse the
  existing `SHARE ROW EXCLUSIVE` lock rather than adding a competing lock path.
- [OWASP Web Service Security](https://cheatsheetseries.owasp.org/cheatsheets/Web_Service_Security_Cheat_Sheet.html)
  recommends authenticating provider certificates. A probe must not bypass TLS
  validation to claim recovery. The admission and fencing design is our inference
  from these sources and the existing application contracts.
- Follow-up review: [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
  defines `Retry-After` as a wait before a follow-up request. The shared lookup
  response observer already records this, but System-health and SSL probes only
  consume existing cooldowns; they do not persist new response wait evidence.
  Add bounded, credential-fenced response observation next, before changing probe
  cadence. Do not describe this admission increment as closing that separate gap.

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Shared admission plus bounded recovery probe | Accounts for automatic traffic; preserves recovery behavior | Recovery consumes credits and may wait | Adopt |
| Disable the SSL recovery probe | Saves synthetic requests | Changes recovery latency and existing behavior | Defer |
| Shared response-wait observation | Applies new provider wait advice across callers | Requires bounded header handling and credential-fenced writes | Next increment |
| Reuse recent lookup evidence | Can avoid synthetic requests | Needs credential/time attribution and recovery policy | After response-wait handling |
| Process-local budget or TLS bypass | Small patch | Restart bypass or false security guarantee | Reject |

Recommended stack: existing PostgreSQL quota/pacing, a dedicated ESM recovery
service, bounded HTTP transport and fixed response classifier, credential and
local-state fences, existing item retry handoff. No UI contract changes.

## Verification plan

Test blocked/expired/not-due behavior, single-flight/reset races, all admission
denials, failed or uncertain commit, credential replacement during HTTP, failures
reading final configuration, TLS/non-TLS outcomes and sanitized diagnostics.
Disposable PostgreSQL with real loopback HTTP must show committed accounting and
released locks before dispatch, shared final-credit contention, retained cooldown
and generation fencing. Use isolated fixtures, never live provider calls for
failure tests. Run focused and broader quality gates, then an exact no-cache
image rehearsal and backed-up local Compose replacement. Record results separately.
