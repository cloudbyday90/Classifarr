# Credential-aware enrichment recovery

## Decision

Pause rejected saved credentials, not media items. Store a random credential
generation and rejection timestamp on OMDb, web-search and legacy Tavily
configuration rows. Reuse the existing TMDb generation pattern, provider router,
retry scheduler and fenced item writes. No new daemon, broker or dependency.

Changing the key or enabled state creates a new generation atomically in a
database trigger. Ordinary saves, quota updates and telemetry do not. A late
authentication failure can reject only the generation actually used for HTTP.
No key, key hash or upstream response is stored in recovery diagnostics.

## Behavior and boundaries

- OMDb admission checks rejection before reserving local quota. Web search skips
  rejected candidates while retaining healthy-provider fallback.
- Authentication/access rejection waits without spending an item's failure
  budget. Transient failures, quota limits and confirmed misses keep distinct
  existing policies. Do not reopen already exhausted historical work.
- Persist provider rejection independently of item results: it describes the
  remote credential, not authority over a media item. Item results still require
  the received claim token, deadline and unchanged source identity.
- Automatic and manual retry claims wait when every configured candidate for
  their dependency has rejected credentials. Statistics count this as deferred.
  In-flight requests may finish; this is not exactly-once HTTP dispatch.
- Corrected configuration becomes eligible through the existing minute scheduler,
  subject to existing due times, quotas and cooldowns. Saving unchanged settings
  does not retry a rejected key. Explicit disable/re-enable permits another
  attempt after an account-side correction. Connection tests alone do not clear
  durable rejection in this increment.
- Existing settings show a concise cause and next action. Movie/TV eligibility,
  music exclusion and reviewed legacy ownership recovery remain unchanged.

## Alternatives

| Approach | Pro | Con |
| --- | --- | --- |
| Keep retrying each item | Minimal state | Repeats rejected requests and exhausts library budgets |
| Persist generation-scoped rejection (selected) | Restart-safe, rotation-safe, bounded recovery | Requires a migration and explicit configuration action for account-only repairs |
| Periodically probe rejected credentials | Detects account-side repair automatically | Needs separate probe leases, quota accounting and stale-result fencing |

Recommended stack: modular Node ES modules, PostgreSQL triggers and conditional
updates, existing scheduler/router, Vue settings, Jest and real PostgreSQL tests.
Add controlled health-probe recovery later only with its own concurrency and
quota contract; do not use a successful cached result as credential verification.

## Official research, September 29, 2026

- [HTTP semantics](https://datatracker.ietf.org/doc/rfc9110/): authentication and forbidden responses differ from transient failures; repeating identical rejected credentials is not a recovery strategy.
- [AWS circuit breaker guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html): stop calls that are likely to fail, retain observable state and define recovery explicitly. Here recovery is configuration-driven, not an arbitrary timeout.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages): communicate waiting and corrective actions programmatically without moving focus or repeatedly interrupting users.

These are design principles, not mandates for a particular schema or interval.
GitHub MCP returned no open Classifarr PRs during initial discovery; none could
be randomly selected or merged.

## Acceptance

Test restart-equivalent reads, repeated/no-op saves, key rotation including
A-to-B-to-A, stale failures after rotation, independent providers, legacy Tavily,
quota preservation, unchanged item attempts, manual claim exclusion, fresh setup,
and recovery after configuration correction. Use fake keys and mocked HTTP only.
