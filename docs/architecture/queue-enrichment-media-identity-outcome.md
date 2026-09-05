# Queue enrichment media identity outcome

Date: 4 September 2026. See the separate
[design and research](queue-enrichment-media-identity-design.md) for the August
2026 practice baseline, official sources, alternatives, and recommendation stack.

## Delivered behavior

Queue refill now selects `media_server_items.media_type` instead of the library's
type. Unsupported types are excluded before the existing batch limit; the
payload builder independently rejects them. No absent type becomes `movie`.

The shared ESM `payloadMediaType` function accepts explicit nested or top-level
movie/TV declarations and requires agreement. The source-history contract reuses
it without changing its existing validation behavior. `queueEnrichmentPayload`
captures the payload before waits and checks item-backed tasks against the
current source type, library, and known TMDb identity. Missing IDs/library
metadata can be recovered from a matching source record. Missing/conflicting
type, absent records, or conflicting known IDs skip provider calls and produce
an explicit `enriched: false` task result. Source-read database errors propagate
to the existing task failure/retry path.

`queueEnrichmentResults` validates provider result types and IDs. TVDB lookup is
TV-only. IMDb lookup selects only the declared movie/TV bucket, even if both
are present. Normalized OMDb `imdbId` and legacy `imdbID` are supported; conflicting
aliases are not trusted. OMDb results must declare a matching movie/series type
before metadata/rating acceptance. Classifarr's existing OMDb adapter still maps
`tv` to `series`. Title search uses an explicit type and filters malformed or
conflicting results before the existing title/year ranking heuristic.

TMDb ID updates require item ID, matching type, and a null stored ID. OMDb rating
updates also require matching type. Metadata writes verify type, library, and
resolved TMDb ID; if no row matches, history creation is skipped and completion
reports source drift. Backfill success logs require one affected row. Owned
payloads prevent caller mutation from changing type/item ID during awaits.

The services remain modular ESM with existing dependency injection. There is
no new dependency, migration, API/UI change, historical rewrite, release, or
version bump. Unreleased records the high-level behavior change.

## Validation

- Focused unit regression: 9 suites and 262 tests passed, including the queue
  facade, task processor, refill, TMDb/OMDb services, source history, and new
  identity-boundary cases.
- PostgreSQL integration: 4 suites and 49 tests passed, covering the complete
  enrichment identity fixture, source-history isolation, queue robustness,
  and queue API behavior.
- The same end-to-end SQL fixture passed in existing local Compose. Actual
  queue services performed refill, source admission, provider selection,
  rating/ID backfills, metadata updates, and history insertion using stubbed
  provider responses. Movie/TV source identities produced IDs 111/222 from a
  mixed IMDb result; a TV item in a movie-typed library remained TV.
- The fixture rejected a stale task before provider calls and changed a source
  type during lookup to prove later ID/metadata/history writes were blocked.
  Direct backfills preserved existing IDs and rejected mismatched type.
- Fixture writes used connection-local temporary tables inside a rolled-back
  transaction. Real inventory/history records were not modified and no provider
  credits were used.
- Existing pipeline fixtures now supply explicit types and matching source
  records. Separate rejection tests supply conflicting/absent rows directly.
  Tests also cover malformed IDs, normalized OMDb IDs, type conflicts,
  caller mutation, provider failures, and zero-row update diagnostics.
- Backend lint, server/client type checks, and both ESM gates passed.
- The full backend unit suite passed: 1,042 suites and 28,937 tests. The final
  focused run also verified the zero-row logging changes. Markdown lint passed
  across 971 files, and `git diff --check` passed.

## Repository and PR handling

Work started from the previously pushed source-history commit `50b5805f` on
`fix/queue-enrichment-media-identity`. The user authorized committing, pushing,
and merging all completed work into `origin/main`, including that prior commit.

The GitHub MCP pull-request endpoint returned an empty array for
`cloudbyday90/Classifarr` with `state=open&per_page=100` on 4 September 2026.
No open PR was available for random local implementation. No closed PR was
substituted or separately merged.

## Recommendation stack and tradeoffs

Keep authoritative item type → captured explicit declarations → source-record
admission → typed provider selection → conditional writes → typed history.
This prevents type inference from masquerading as source identity and makes
the boundaries independently testable. The cost is an additional source read
and conservative skips for malformed/stale tasks or untyped provider responses.
Long database locks across provider calls were rejected because network latency
and outages would prolong lock contention. Conditional writes do not provide
whole-flow atomicity; a later source change or another history writer can still
race with the separate history operation.

## Next recommended item

Make title-based TMDb resolution abstain on weak or ambiguous matches. The
remaining `find(exact title/year) || searchResults[0]` fallback can still backfill
an unrelated same-type item. Define unambiguous acceptance rules and test
remakes, absent/conflicting years, localized titles, and multiple candidates.
Ambiguous matches should retain an unknown ID and become eligible for explicit
review, with no automatic media routing. This is a code finding, not measured
evidence of historical corruption.

Then address concurrent source-history deduplication with a two-connection
regression and a deliberate constraint/locking strategy. Other administrative
reprocess/retry entry points also need their own compatibility audit; this fix
does not certify every platform identity producer. The semantic study still
requires an eligible held-out cohort and independent human labels before the
existing readiness and frozen-study preflight can justify review-only semantic
counter-evidence. No historical IDs or types should be corrected without
independent evidence.
