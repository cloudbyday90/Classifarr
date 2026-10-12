# System health summary: design

Date: 2026-10-12. Follow-up to [pgvector health separation](pgvector-health-separation-outcome.md).

## Findings and scope

The client aggregate defaults to healthy even for unknown-only or disabled-only
observations. The detailed-services API considers an empty list healthy because
zero healthy equals zero total. Its mapper also treats configured-only evidence
as healthy and inactive services inconsistently. System retains old green results
after failed polling, while its refresh fallback can disguise a failed fresh check.

The database readiness endpoint and `/system/health` HTTP status are intentionally
database-focused. Preserve those contracts and the service-status store's database
indicator. `/system/health/services` and System assess different service sets
(instances versus configured service categories); their counts need not match.

## Decision and tradeoffs

| Option | Pros | Cons |
| --- | --- | --- |
| Change banner wording only | Small patch | False health decisions remain in API and counts |
| Explicit aggregates and failed-observation state (chosen) | Honest uncertainty; no new checks or provider traffic | More status categories for API consumers |
| Replace probes and share a new cross-package runtime | One implementation everywhere | Changes build/deployment boundaries and readiness semantics unnecessarily |

Recommendation stack:

1. Small pure ESM aggregation modules in the existing client/server boundaries,
   with parity tests to prevent policy drift; do not introduce build coupling.
2. Known failure outranks degraded, which outranks unknown. Healthy requires at
   least one active service and every active service healthy. Disabled and not
   configured are inactive, counted separately, never healthy or failed.
3. Missing, malformed and unsupported status values are unknown. `configured`
   means degraded, not verified connectivity. Keep the API's existing
   `summary.unhealthy` field, but count failed plus degraded instead of every
   non-healthy row (including unknown/inactive). Document that correction and
   add explicit category counts,
   `active`, and `unknown`. Empty/inactive-only summaries return unknown.
4. Retain previous cards on request failure, but label the summary unavailable and
   counts as last received, not current operational evidence. Keep the error while
   retrying; only a successful current request clears it. Ignore out-of-order and
   post-unmount responses. A failed forced refresh must not silently claim success
   from a cached fallback. Use fixed operator-facing error text.
5. Keep authentication, polling cadence, provider calls, database probes, memory
   guards, container protections and HTTP readiness codes unchanged.

No arbitrary per-service expiry is added: heartbeat cadence is configurable and
the API response timestamp is not a fresh probe time. This change handles explicit
unknowns and failed UI observations, not age-based invalidation of server caches.
That requires a separate freshness contract with the actual configured cadence.

## Official sources

Discovered and read through MCP on 2026-10-12:

- [Kubernetes condition model](https://kubernetes.io/docs/concepts/workloads/pods/pod-condition/)
  separates unknown from true/false and probe time from transition time. Our
  inference: absence of negative evidence is not sufficient for a positive health
  summary; retain observation context rather than inventing a successful check.
- [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  recommends a stable polite status region, including context in announcements.
  Keep the summary text/counts in that region; receipt timestamps stay outside it
  so unchanged polls do not repeatedly announce the time.

## Verification

Cover empty/inactive/unknown/malformed, mixed severity, alias normalization,
count invariants and client/server parity. Route tests verify additive counts and
unchanged readiness codes. UI tests cover initial failure, failure after success,
retry, malformed response, concurrent requests and unmount. Browser fixtures test
the real summary component at mobile width, status-region updates and no network
mutations. Run fresh frontend/backend coverage, quality gates, no-cache local
Compose rebuild, isolated schema dump and read-only post-rebuild checks.

Initial GitHub MCP request timed out; retry returned zero open PRs. No random PR
was available. Work stays on main; no version bump, release, production mutation
or PR merge. Record actual checks and limitations in a separate outcome document.
