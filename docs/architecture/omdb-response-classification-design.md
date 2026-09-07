# OMDb response classification design

Date: 2026-09-07. Follows the
[committed quota reservation](omdb-quota-reservation-design.md).

## Problem and intended behavior

OMDb lookup code currently treats every `Response: False` body as a missing title.
Its health probe treats both True and False as healthy, and the dashboard timing
wrapper discards a connection test's `success: false` result. Provider outages,
bad credentials and exhaustion can therefore become misleading coverage evidence.

Use one small, deterministic ESM response classifier, a separate payload validator
and a typed error adapter. Only a recognized missing-title response on successful
HTTP transport produces null or an empty search. Credential failures, explicit
provider quota exhaustion, malformed data and unknown provider failures remain
distinct failures. An HTTP error cannot become a successful lookup or a miss.

Explicit provider exhaustion retains the existing quota pause/fallback path.
Authentication failure uses the existing operational retry path rather than
claiming that the daily quota reset will repair a credential. Transient transport
retries retain their bounded attempts and committed reservation per attempt.
Unknown response failures are not retried within the HTTP loop. The background
enrichment queue still has its existing bounded retry/exhaustion fallback policy.

Health accepts valid metadata or a confirmed miss for its intentionally arbitrary
probe title. The connection test requires valid metadata for its fixed title.
The dashboard must honor its success flag and preserve the last successful check
on failure. Existing response fields carry fixed, credential-free messages.

## Research and design decisions

Sources were discovered with web tools and fetched on September 7, 2026; GitHub
MCP was also used to inspect open PR availability.

- [OMDb parameters and changelog](https://www.omdbapi.com/) document title/ID
  lookup, separate search results, movie/series/episode types and HTTPS support.
  The linked [official Swagger](https://www.omdbapi.com/swagger.json) identifies
  401 as unauthenticated but provides no complete success/error body schema.
  Consequently, the application's narrow message recognition and consumed-field
  validation are compatibility policy, not a claimed exhaustive provider contract.
- [OWASP API10: Unsafe Consumption of APIs](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
  recommends TLS and validating third-party data before downstream use. Validate
  identity, consumed scalar fields, ratings and bounded search rows. Do not pass
  unknown error bodies, upstream request configuration or credentials to the UI.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  documenting data quality and known limitations. Applying that principle here
  means distinguishing missing evidence from unavailable evidence; this is an
  architectural application of the guidance, not a claim of W3C conformance.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Continue treating False as missing | Simple, fewer visible failures | Corrupts health and coverage meaning | Reject |
| Broad substring matching | Tolerates many messages | Unknown or injected text can masquerade as a miss | Reject |
| Bounded exact message recognition and consumed-field validation | Predictable behavior, safe diagnostics, no dependencies | New provider messages fail closed until reviewed | Adopt |
| New provider state service and operator workflow | Could coordinate cross-worker recovery | More state and operational input before measured need | Defer |

Recommended stack: TLS transport, existing process pacing and atomic PostgreSQL
quota admission, bounded HTTP attempts, pure response classification, validated
metadata formatting, typed operational errors and truthful existing health fields.
No new dependency, migration or operator step is required. Optional missing values
must remain absent/null rather than causing formatter exceptions or NaN values.
These field bounds apply after decoding; transport byte limits remain a separate
follow-up for the shared buffered HTTP client.

No classification routing authority or semantic counter-evidence is added. Existing
independent-study readiness gates remain required. This change improves the
reliability of the evidence used by later classification and automation work.

## Validation plan

Use credential-free HTTP fixtures to reproduce false misses and false health,
exercise status/body conflicts, malformed success payloads, optional fields and
quota/retry behavior. Verify queue dispatch and dashboard last-success semantics.
Run relevant regressions, backend checks and the full backend suite, then rebuild
local Compose without cache and perform authenticated read-only smoke checks.
Keep real credentials, raw logs and database backups in ignored local storage.
Record completed checks and limitations in a separate outcome document.
