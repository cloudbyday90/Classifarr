# Inventory TMDb failure diagnostics design

Date: 2026-09-07. Scope: warning `44f1f738-957c-46a7-bd3e-d1244b254549`.

## Problem and decision

The detail-service wrapper discarded HTTP status and transport codes. The queue
then reported every thrown failure as `provider_unavailable`. That made an item
missing from TMDb indistinguishable from throttling or a network outage.

Use one pure ESM failure module shared by the movie/TV detail wrapper and inventory
enrichment service. Preserve only an integer HTTP error status and an allowlisted
transport code across the wrapper. Use a fixed message; discard URLs, response
bodies, headers, credentials, arbitrary messages and error causes.

The inventory warning includes validated media type and numeric TMDb ID for
correlation. HTTP 404 produces `reason: identity_not_found`, `category: not_found`.
Other failures retain the existing broad reason with a more precise category:
authentication/access, rate limiting, upstream error, rejected request, timeout,
cancellation, response size, TLS, network or unknown. Categories describe the
observed response, not a conclusive diagnosis of a provider's internal cause.

Preserve existing observations when acquisition fails, and keep the existing
six-hour attempt cooldown and 30-day successful-observation reuse. This change
does not retry immediately, select an alternative ID, alter routing, bypass TLS,
or turn a 404 into an empty successful observation.

## Alternatives and recommendation stack

| Option | Advantages | Costs or limits |
| --- | --- | --- |
| Safe typed failure metadata — selected | Actionable correlation with small, bounded logs; no operator step | Cannot reconstruct older warnings that omitted context |
| Log raw transport errors | Rich debugging detail | May disclose keys, URLs and private response data |
| Retry or search for another ID immediately | Could recover some transient or stale records | Extra provider traffic; ambiguous identity could become authoritative |
| Suppress all warnings | Reduces noise | Conceals credential, network and data-quality failures |

Recommended stack: existing validated identity → existing rate-limited TMDb
client → safe failure wrapper → categorized inventory warning → existing cooldown.
Keep independent identity resolution and any routing decisions outside this path.

## Official sources

Discovered through search and opened on September 7, 2026:

- [TMDb errors](https://developer.themoviedb.org/docs/errors) distinguishes missing
  resources/IDs (404), credentials (401), request throttling (429), and upstream
  failures. HTTP status is useful evidence, though some statuses have multiple
  meanings; the implementation does not infer a replacement identity.
- [TMDb rate limiting](https://developer.themoviedb.org/docs/rate-limiting) asks
  clients to respect 429 responses and notes that limits can change. Keep the
  existing limiter and cooldown rather than increasing retry traffic.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  informs strict validation of external status/code metadata.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) informs the
  distinction between an unavailable observation and a verified data value.

These are application choices, not certification. See the separate
[outcome](inventory-tmdb-failure-outcome.md) for evidence and remaining limits.
