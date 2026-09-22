# Classification organization metadata: design

Date: 2026-09-22. Continues the
[rating parity investigation](learned-query-metadata-parity-outcome.md).

## Root cause and scope

Inventory stores one source-reported `studio`; TMDB supplies a list of
`production_companies`. Refill selection/payloads, classification parsing and
reconstruction, and retry/reprocess payloads omit organization fields. A test
starting with reconstructed inventory metadata bypasses these losses.

Preserve the two field roles through a small pure ESM adapter. Do not rename a
production company to studio, pick the first company, substitute a TV network,
or infer anything from a library name. Existing learned profiles consume the
explicit studio using the same normalization as inventory. Existing policy,
prompt and embedding consumers retain the production-company list. Adding a new
company-set learned feature would require separate training data and evaluation;
it is not necessary to repair these handoffs.

## Contract and recovery

- Allowlist studio text and production-company names/optional numeric IDs only.
  Discard URLs, provider instructions and arbitrary object properties.
- Bound names to 160 characters before and after Unicode normalization and lists
  to 32 entries. Do not silently truncate a malformed/oversized company list into
  a seemingly complete observation. Copy values; never mutate provider objects.
- Missing fields stay missing. An unusable field is neutral and cannot be
  reconstructed from the other role. Keep field roles and provider IDs intact;
  these observations are not declarations or routing authority.
- Rechecks may fill missing data or use a compatible expanded company set.
  Conflicting studio claims or incompatible company sets remain neutral rather
  than selecting a source by string length. Preserve known company IDs and check
  ID/name conflicts across both lists. Keep unrelated merge rules unchanged.
- Refresh studio from the current identity-checked inventory row when processing
  an enrichment task, so old queued payloads self-heal without a mass rewrite.
- New retries preserve available organization metadata. Already-lost historical
  values cannot be invented. No route, threshold, confirmation setting, model
  version, schema or administrator workflow changes.

## Official research and options

Sources were discovered with search/GitHub MCP and read on 2026-09-22.

[TMDB's published OpenAPI schema](https://developer.themoviedb.org/openapi/tmdb-api.json)
defines production companies as arrays of objects for movies and TV, and TV
networks as a separate array. It does not identify a first company as a canonical
studio. Preserve the schema's distinction instead of deriving false equivalence.

[Google's ML engineering rules](https://developers.google.com/machine-learning/guides/rules-of-ml)
recommend sharing feature conversion between training and serving and measuring
skew. Test real payload producers through the consumer, not only a convenient
intermediate shape. A repaired input is not an accuracy or calibration result.

[OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
recommends validation early for external feeds as well as user inputs.
[OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
also separates retrieved observations from downstream authorization. Keep the
existing prompt boundary and routing guards; normalization cannot make content
trusted or prevent every prompt injection.

[W3C WCAG 2.2](https://www.w3.org/TR/wcag/)
requires accessible status messages without taking focus. This backend repair
needs no new screen or acknowledgement; retain existing status/disclosure UI.
The separate jsdom tooling change needs client tests and real-browser checks,
because a DOM simulator is not proof of visual accessibility.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Shared bounded adapter; preserve distinct roles | Repairs arrivals and retries; no new runtime | Touches several handoffs | Implement |
| First production company becomes studio | Easy to populate | Order-dependent, unsupported semantics | Reject |
| New company-set learned channel | Could use all companies statistically | Requires attributable inventory capture and calibration | Separate future study |
| More unlabeled replay samples only | Broader inventory coverage | Bypasses ingress loss; no root-cause fix | Not the next step |

Final stack: existing inventory and provider adapters → shared ESM organization
contract → current learned studio profile and separate company consumers →
unchanged freshness/identity/policy/routing guards. Verify arrival/retry parity,
malformed inputs, conflict behavior, SQL-backed enrichment and client PR tooling.
Record measured outcomes separately; do not claim a production deployment or
accuracy improvement from unit tests.
