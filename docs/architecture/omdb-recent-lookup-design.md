# OMDb recent lookup reuse design

Date: 2026-10-13. Status: implementation contract.

## Problem and scope

System health and automatic SSL recovery currently reserve a credit and send a
synthetic lookup even when this process just completed a verified ordinary OMDb
lookup. The existing error-only WeakMap records credential provenance for retry
decisions, not successful connectivity. It must not be repurposed as a cache.

Keep one short-lived, process-local connectivity observation from ordinary title,
IMDb ID or search requests. This is not a metadata/HTTP response cache: no body,
title, key, URL or raw error is retained. No schema, dependency, worker, provider
write, inventory recovery, UI redesign or production deployment is required.

## Official guidance and decisions

Sources discovered through search MCP and opened on 2026-10-13:

- [OMDb key plans](https://www.omdbapi.com/apikey.aspx) specify a 1,000-request
  daily free allowance; [OMDb API documentation](https://www.omdbapi.com/) describes
  ordinary title/ID/search requests. No separate free health endpoint was found.
- [RFC 9111, freshness](https://www.rfc-editor.org/rfc/rfc9111.html)
  distinguishes age from freshness lifetime; reuse must not reset the observation
  time. This informs our application policy, not a claim of HTTP-cache compliance
  or permission to reuse metadata contrary to provider cache directives.
- [OWASP web-service security](https://cheatsheetseries.owasp.org/cheatsheets/Web_Service_Security_Cheat_Sheet.html)
  requires TLS and service-certificate verification. A successful plaintext/custom
  endpoint request cannot become production OMDb connectivity evidence.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/sql-lock.html) documents
  transaction-scoped locks. Reuse uses a bounded SHARE lock while reading eligibility,
  never while awaiting a provider.
- [Node 24 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
  provide process-relative timing. Monotonic age supplements the UTC timestamp so
  a wall-clock adjustment cannot extend reuse beyond the intended lifetime.

The one-minute lifetime and conservative concurrency rules below are Classifarr
design choices, not provider guarantees or standards-mandated values.

## Contract

1. Capture only admitted ordinary requests to the exact fixed HTTPS OMDb endpoint.
   Existing response classifiers must confirm success or a genuine not-found.
   Health requires success; SSL recovery may also use a confirmed miss. Neither
   outcome authorizes enrichment, changes media identity or clears a credential
   rejection. Explicit unsaved-settings tests remain separate.
2. Retain one observation: validated config ID/opaque generation, outcome, original
   UTC completion time and measured request duration. Monotonic age and wall-clock
   age must both be nonnegative and strictly less than 60 seconds. Reads never
   renew it; restart loses it and safely falls back to admitted probes.
3. Starting any tracked lookup or saved probe invalidates previous evidence. Any
   overlap makes both requests ineligible for reuse; an old completion cannot
   overwrite a newer failure. Unknown, malformed, aborted, timed-out, oversized,
   authentication, quota, rate-limit and transport failures leave no observation.
   Probe outcomes invalidate but do not seed the record.
4. A new queue SSL pause, reset or repeated certificate failure invalidates all
   previous and in-flight evidence. Only a later non-overlapping ordinary lookup
   may establish new evidence. Existing probe interval, single-flight and queue
   epoch checks remain in force; this does not accelerate retries or bypass pauses.
5. Before reuse, a short bounded read transaction rechecks the active highest-ID
   configuration, nonempty key, generation, rejection, daily budget and shared
   pacing. A matching record must still be current after the read. No key is
   returned or retained. Reuse consumes no credit and does not change cooldowns.
   No database lock spans HTTP. Settings changes after a snapshot remain subject
   to existing health publication/queue fences, as with other observations.
6. Missing, stale, ineligible or changed evidence follows existing quota/pacing
   admission and bounded probe behavior. Database-read failure returns a fixed
   unavailable result without HTTP. Uncertain admission is never refunded/replayed.
   Health reuse preserves original lastCheck, lastSuccessfulCheck and latency.
7. Scope is one application process, not every host sharing a key. Remote transient
   failures cannot invalidate local memory; durable rejection/budget/waits are
   still checked. No persistent stale-success record survives restart. Fresh or
   disabled installations invent no work. Memory and TLS safeguards are unchanged.

The read transaction uses the existing one-second lock, five-second statement,
ten-second idle-transaction and fifteen-second transaction limits. Its SHARE lock
coordinates with configuration writes and admission; it is released before any
fallback HTTP. Saved probes retain one attempt, ten-second/1 MiB transport limits,
per-service coalescing and the queue's one recovery probe in flight. Ordinary
lookup retry policy and the shared one-second admission floor remain unchanged.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep all synthetic probes | Simplest behavior; direct sample each time | Uses credits unnecessarily after real requests; fallback only |
| One local, expiring observation | Constant retained memory; local transport evidence; no migration | Loses reuse on restart and overlap; recommended first increment |
| Durable/shared success cache | More reuse across processes | More writes, failure ordering and host-specific TLS ambiguity; defer |

Recommended stack: existing strict classifiers and HTTPS transport; a small ESM
observation factory; a separate bounded saved-context reader; existing admitted
health/SSL probes as fallback. Do not relax quota, cooldowns, failure semantics,
ownership or health timestamps to increase the hit rate.

## Verification and completion

Unit tests cover age boundaries, clock rollback, wrong context/endpoint, overlap,
late completion, failure invalidation, original timestamps and no credential/body
retention. Real loopback HTTP plus disposable PostgreSQL verify ordinary lookup
production wiring, no extra request/debit on reuse, fallback, generation/disable/
rejection/wait changes and SQL lock release before HTTP. Synthetic loopback transport
is injected behind a checked production URL; it is not evidence of provider TLS.

Run affected quality gates, then rebuild local Compose without cache and verify
the exact packaged modules and synthetic behavior in an isolated image. Record
all results, limits, image identities and local deployment in a separate outcome.
Next deferred item: measure reuse opportunities before considering longer retention
or distributed evidence. No release, branch creation or PR merge is planned.
