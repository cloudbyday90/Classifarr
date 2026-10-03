# Provider-aware routing checks

## Decision — 3 October 2026

Keep background routing checks opt-in and read-only. Add a durable guard shared
by checks using the same Radarr or Sonarr configuration. Do not replay adds,
change library destinations, or enable services on fresh installations.

## Failure policy

| Evidence | Action | Recovery |
| --- | --- | --- |
| HTTP 401/403 | Stop automatic provider checks | Correct credentials/access; a saved credential change or a later explicit check can recover |
| Other non-transient HTTP errors, invalid response or TLS configuration | Stop automatic provider checks | Review provider settings, then explicitly check |
| Rate limit, timeout, connection failure, transient server error | Pause this provider | One later read, with persistent backoff and jitter |
| Valid empty list | Spend an item check | Existing three-check policy |
| Matching or mismatched item | Stop item checks | Existing review flow |

The first failed read establishes the provider pause. Confirmed provider failures
return the reserved automatic item allowance; crashes or indeterminate completion
retain it conservatively. A pause checked before admission costs no allowance.
Disabling an item during a read must never be undone by completion.

## Boundaries

- One guard row per configured provider, removed by a foreign-key cascade when
  that configuration is deleted. Credential/endpoint revisions use an internal
  digest, never returned to the UI or logs. Old revisions are replaced.
- Reuse the cross-process routing-check advisory lock. Reserve a one-minute
  provider cooldown before HTTP, retain the ten-second response deadline and
  two-MiB limit, and keep database transactions out of network I/O.
- Fence completions with a single-use reservation ID. A late result from a lost
  lease must not clear a newer provider pause or refund an uncompleted check.
- Revalidate the provider revision immediately before reading. A changed
  credential must not be probed under the old revision's admission.
- Temporary pauses start at five minutes, double to one hour, and add jitter.
  Honor valid Retry-After values up to one day; longer requests require review
  instead of being shortened. Invalid headers use ordinary backoff.
- A blocked item is deferred locally for at most five minutes before checking
  configuration again. This prevents it from monopolizing the one-item scheduler
  and allows other providers to proceed. These local checks perform no HTTP.
- Manual checks obey provider cooldowns too. Once a cooldown ends, an explicit
  check may test repaired permissions without requiring an arbitrary key change.
- Status reads never contact providers. UI explanations distinguish a provider
  pause from an exhausted item allowance and retain accessible status messages.

## Alternatives and recommendation stack

1. **Safe error categories + durable provider guard (selected):** restart-safe,
   shared protection and clear recovery. Costs one small table and orchestration.
2. **Per-item retries only:** simple, but each item pays for the same outage.
3. **In-memory circuit:** cheaper persistence, but resets on restart and splits
   across instances. Not appropriate for this existing database-coordinated path.
4. **Generic retry framework:** broader reuse, but unnecessary cross-cutting risk
   for a read-only workflow. Defer until another proven consumer needs it.

## Research

Official sources retrieved on 3 October 2026; the concrete thresholds above are
Classifarr design decisions, not requirements imposed by these sources.

- [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html): distinguish
  authentication/refusal from service unavailability and interpret Retry-After.
- [HTTP 429](https://www.rfc-editor.org/info/rfc6585/): rate limiting can include
  a server-provided delay.
- [Circuit breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker):
  gate calls to failing dependencies separately from individual operation retries.
- [Transient fault handling](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/handle-transient-faults):
  classify failures and bound retry behavior.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  expose changing status programmatically without moving focus.

## Verification contract

Exercise real HTTP status/headers and malformed responses for both providers;
real PostgreSQL persistence, two instances, revision changes, cancellation,
disable-during-read, restart and provider isolation; UI fixed-copy rendering;
fresh and upgraded schemas. No live provider requests or production recovery are
needed to validate this change.
