# Inventory metadata provenance design

## Problem and decision

Inventory sync preserves source tags, but sends them to content analysis as
keywords and assumes English. The enrichment queue resolves typed TMDb identity
without retaining provider keywords or original language. The previous local
assessment found no keyword or language observations across 6,692 inventory rows.

Store a compact `metadata.inventory_tmdb` observation with a version, movie/TV
identity, provider keywords, original language, and acquisition time. Accept
these two traits only when the record matches the current typed identity.
Source tags remain separate. Missing language is null; neither UI locale nor
audio-track language establishes a work's original language.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Infer keywords from tags and assume English | No requests | Fabricates evidence and mixes local organization with provider descriptions | Remove |
| Require operators to complete missing metadata | Direct oversight | Recurring work and inconsistent coverage | Avoid |
| Reuse typed resolution and TMDb detail transport, persist compact observations | Automatic, attributable, bounded, reusable | Provider outages and imperfect upstream metadata remain | Implement |
| Introduce a second provider cache or new enrichment scheduler | Independent tuning | Duplicate lifecycle and operational complexity | Defer |

Recommended stack: existing identity resolution → existing rate-limited TMDb
details → validated, bounded observation → identity-guarded persistence →
existing change-driven library profile refresh. Keep placements observational.

## Lifecycle and security

Use the existing enrichment queue and five-minute gap-analysis scheduler, which
also runs 30 seconds after startup. Previously enriched,
active-library items with a positive TMDb identity become eligible automatically
when TMDb is configured. Successful records are reused for 30 days, including
valid empty keyword lists and unknown language. Unavailable or malformed
responses retry after six hours. A typed database timestamp controls retry
eligibility, avoiding casts of arbitrary metadata strings. New enrichment work
continues to use existing identity abstention for ambiguity.
Changing the typed identity resets acquisition/retry clocks, so a previous
identity's cooldown cannot delay the new identity's observation.

Backfill-only tasks skip OMDb, web search, and classification history writes.
They describe inventory and do not establish classification labels. Normal
enrichment also captures the TMDb observation after identity resolution. Every
write retains the current item/type/library/TMDb identity guard. Mismatched
provider IDs and malformed keyword envelopes are rejected. Error logs contain
fixed reason codes, not provider responses or credentials.

Normalize labels with bounded Unicode text and deduplicate them per item.
Normalize language tags using the platform internationalization API; reject
unknown and nonlinguistic placeholders. Preserve no provider titles, plots,
URLs, or credentials in the new observation. Keep SQL parameterized. Reuse
existing provider timeouts/rate limiting and existing OMDb/web-search caches;
there is no shared TMDb detail cache today, so the persisted observation is the
cache for this work. No new dependency, endpoint, UI workflow, or release.

Language validation accepts a two- or three-letter primary subtag and bounded
hyphenated subtags, then applies `Intl.getCanonicalLocales`. It is a constrained
metadata contract, not an implementation of every BCP 47 extension or a live
IANA registry validator. TMDb observations remain separate from the existing
OMDb/web-search workflow status; library coverage reports their known traits.

Extend the shared SQL observation projection to include the typed record while
excluding acquisition/retry timestamps. Provider bookkeeping alone must not
cause profile regeneration. Seed existing profiles dirty once because legacy
unattributed keyword/language fields no longer count as current observations.

## Official research

Sources were discovered and opened through the web tool on September 5, 2026,
for the requested August 2026 baseline. Living documentation is not represented
as an archived August snapshot.

- [TMDb details](https://developer.themoviedb.org/reference/movie-details) and
  [append-to-response](https://developer.themoviedb.org/docs/append-to-response)
  support fetching details and namespaced keywords together. The request's
  display-language default does not establish original language.
- [TMDb keywords](https://developer.themoviedb.org/reference/movie-keywords)
  identifies the provider endpoint, distinct from media-server labels.
- [TMDb rate limiting](https://developer.themoviedb.org/docs/rate-limiting)
  advises respecting 429 responses and changeable service limits. Reuse the
  existing limiter and defer failed observations rather than immediate loops.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) is a Working
  Group Note supporting quality measurements and provenance. Apply those
  principles to JSON observations without claiming RDF conformance.
- [W3C language tags](https://www.w3.org/International/articles/language-tags/Overview.en)
  explains BCP 47 tags. Preserve the supplied language meaning without adding
  a region or deriving it from localization settings.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  supports server-side type, shape, range, and length validation of external
  data. Existing escaped Vue tables continue to present coverage accessibly.

## Validation and next boundary

Exercise movie/TV response shapes, unknown values, malformed responses, typed
identity changes, cache reuse, provider failure cooldown, background selection,
and profile refresh in real PostgreSQL. Assess real Compose inventory through
read-only reads or rollback-isolated fixtures. Provider metadata completeness
is not classification accuracy. Semantic counter-evidence remains gated by the
independently labeled 24–32-case readiness and frozen-study preflight.

See the separate [outcome](inventory-metadata-provenance-outcome.md) for measured
results and the next recommended item.
