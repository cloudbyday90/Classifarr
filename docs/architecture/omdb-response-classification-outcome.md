# OMDb response classification outcome

Date: 2026-09-07. See the separate
[design, official sources and alternatives](omdb-response-classification-design.md).

## Result

Title, IMDb-ID and search lookups now use a shared response classifier. Only
confirmed missing-title messages produce absent lookup evidence. Invalid keys,
explicit provider quota exhaustion, rejected requests, malformed payloads and
unknown provider errors retain distinct failures with fixed messages. HTTP 401
does not become daily quota exhaustion unless the body explicitly identifies the
request limit. Explicit exhaustion on HTTP 429 stops without immediate retry.

The existing quota pause path remains available for actual exhaustion. Other
operational failures use the existing bounded enrichment retry path. Historical
`Error getting data` messages no longer trigger an immediate not-found fallback.
Exhausted background retries can still use the existing web-search fallback; this
change does not redesign that queue policy or automatically route media.

Both probes validate provider responses. Arbitrary-title health accepts a
confirmed miss; the fixed-title connection test requires valid metadata. Dashboard
health now honors a resolved `success: false` and preserves its last successful
timestamp. Public response shapes are unchanged; messages distinguish failure
categories without copying upstream diagnostics. HTTP retry diagnostics retain
the status without storing upstream bodies or request credentials.

Consumed metadata fields, ratings and search collections receive bounded shape
validation. Absent optional fields remain legitimate; unavailable numbers become
null instead of exceptions, partial numeric parses or NaN. There are no new
dependencies, schema objects, endpoints or operator steps. Independent-study
readiness requirements and classification authority are unchanged.

## Compatibility and limitations

The internal search service now rejects operational failures instead of returning
an empty array. Repository inspection found no production callers of that search
method; the settings search endpoint already uses `getByTitle` and its existing
error handler. Existing client provider methods need no changes.

The published provider specification does not define an exhaustive body contract.
Recognition is deliberately narrow; unfamiliar messages fail closed until reviewed.
`api_reachable` means an HTTP response was received, including an error response;
it does not imply the provider can currently supply usable metadata. Explicit-key
health/connection probes remain outside the stored local lookup quota.

Field/collection bounds apply after decoding. The shared buffered HTTP client
still consumes JSON/text bodies before enforcing any provider-specific shape
checks. This change does not claim a transport-level response-size limit.

## Validation

The focused regression run passed **299 tests across ten suites** before the final
HTTP-diagnostic and HTTP-429 regressions were added. It covers status/body conflicts,
malformed responses, optional fields, credential-free diagnostics, queue dispatch,
health timestamp preservation and committed quota admission. Existing fixtures
were corrected to contain a valid IMDb identity or explicit missing-title message;
legacy tests expecting auth to mean quota were updated to the new contract.

Real PostgreSQL quota/configuration regressions passed **30 tests across two suites**
in 4.876 seconds. Existing client provider API tests passed **41 tests** in 2.87
seconds. Backend typechecking, scoped ESLint, production dependency checks and ESM
static-import/mock-shape checks passed.

The full backend run, including the final HTTP regressions, passed **31,360 tests
across 1,096 suites** in 203.122 seconds with two workers and 512 MB idle worker
recycling. Documentation lint passed across 1,081 Markdown files.

Final Compose results will be recorded after validation completes.

## Open PR availability

GitHub MCP returned an empty open-PR collection at task start. There was no PR
population for random selection; no closed PR was substituted or merged.

## Recommendation stack and next item

Keep TLS, process pacing, atomic PostgreSQL quota reservation, bounded retries,
pure response classification, consumed-field validation and fixed diagnostics.
This is a small ESM change with no additional operational workflow. Its main
tradeoff is that new provider error wording is treated as unavailable evidence
until compatibility is checked. A separate provider state service would add
coordination and recovery machinery without evidence that it is needed here.

Next, add a bounded JSON/text response reader to the shared HTTP client, with an
explicit OMDb size budget. Stop oversized responses while streaming, including
chunked or misleading Content-Length responses, and test cancellation and timeout
behavior. The current `response.json()`/`response.text()` path buffers the entire
body before this classifier runs. This follows the resource-consumption concern in
[OWASP API10](https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/)
and can improve robustness without more operator input. Preserve larger legitimate
responses for other providers through scoped defaults and compatibility tests.

No release or tag is created.
