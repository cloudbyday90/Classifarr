# TMDb external-ID abstention outcome

Date: 5 September 2026. The separate [design document](tmdb-external-id-abstention-design.md)
records official-source research for the August 2026 practice baseline, the
acceptance table, alternatives, and tradeoffs. Living documentation was verified
in September and is not presented as an archived August snapshot.

## Delivered behavior

`tmdbExternalIdMatch` defines pure ESM validation for external-ID requests,
captured queue declarations and complete typed result buckets. A selected
movie/TV bucket must exist and contain zero or one valid, unique identity for
continued resolution. More than one identity, repeated IDs, malformed entries,
missing buckets and batches above the application cap of 20 require review.
Other object types cannot contribute IDs to the requested type. No corrupt
entries are discarded to turn an invalid batch into a match.

The small `queueTmdbExternalResolution` module evaluates the complete captured
request plan with at most two sequential provider calls. A single external ID
can resolve uniquely. If both TVDB and IMDb are supplied, both must resolve to
the same TMDb ID. Distinct results require review, as does one positive result
and one empty result. A provider failure after an earlier success cannot be
hidden by that success. Payload and matching-type OMDb IMDb declarations must
agree before any request starts. Both normalized and legacy OMDb aliases remain
supported. Missing/null declarations are absent; supplied malformed IDs fail
closed. Movie tasks continue ignoring TVDB identifiers.

The strict `findIdentityByExternalId` facade uses the existing identity lookup
adapter's credential lookup, fixed TMDb base URL, rate limiter and ten-second
timeout. Validated identifiers cannot add URL path/query syntax. Missing
credentials and provider errors propagate to a fixed review decision rather
than synthetic empty results. The general `findByExternalId` helper retains its
existing behavior for compatibility. Tests cover both contracts separately.

The queue resolver consumes explicit `resolved`, `not_found` and `review_required`
decisions. Only absent external IDs or valid empty results from every lookup
permit the existing conservative title path. A review decision returns null
before title search or ID backfill and persists the minimal version-1 receipt
through the existing metadata update. Single-source methods are `tvdb` or
`imdb`; combined evidence uses `external_ids`. The receipt contains no raw
provider content, external IDs, exception text, or credentials. Queue external-ID
diagnostics contain only a fixed reason.

The old filter-first result helper and precedence-based OMDb ID helper were
removed after their only runtime consumer moved to the explicit contract.
The existing direct resolver methods retain their ID-or-null compatibility
behavior; the full backfill path evaluates all applicable evidence together.
There are no new dependencies, CommonJS files, migrations or public API changes.

## Persisted decisions and limits

| Outcome | Method | Fixed reason |
| --- | --- | --- |
| One accepted external identity | `tvdb` or `imdb` | `external_id_match` |
| Both identifiers agree | `external_ids` | `external_ids_agree` |
| Conflicting declarations/results | `external_ids` | `conflicting_external_ids` |
| One result and one empty lookup | `external_ids` | `incomplete_external_evidence` |
| Malformed input | `external_ids` | `invalid_external_id` |
| Multiple distinct results | Offending lookup | `ambiguous_external_id` |
| Repeated result identity | Offending lookup | `duplicate_external_results` |
| Invalid/missing selected bucket or invalid entry | Offending lookup | `invalid_response` |
| Too many result entries | Offending lookup | `external_result_limit` |
| Unavailable provider/credentials | Offending lookup | `provider_unavailable` |

Existing source IDs remain authoritative for this enrichment path and bypass
new external lookups. They are not retroactively verified or corrected. Later
independently established source IDs replace old review receipts. Null-ID source
history still records existing library membership; it does not certify an
external identity. Conditional writes and source-drift checks remain in force.

The receipt has no authorization, learning, or routing authority. No dedicated
ID-review screen or operator resolution endpoint was added. The existing
[aggregate receipt query](tmdb-title-match-abstention-outcome.md#review-boundary-and-operator-inspection)
also counts these new review reasons. It measures unresolved coverage, not
matching accuracy. The cap bounds application processing after HTTP decoding;
it does not add a body-byte limit. This scoped fix is not a platform-wide
security certification.

## Validation

- Focused pure-contract, queue resolver, provider facade and enrichment pipeline:
  5 suites and 143 tests passed. Tests cover invalid declarations, exact aliases,
  provider failures, duplicates, distinct IDs, malformed/sparse arrays, limits,
  source-type isolation, caller mutation and terminal fallback behavior.
- PostgreSQL integration: 5 suites and 35 tests passed, covering external-ID
  resolution, title abstention, typed enrichment, typed history and queue APIs.
- Local Docker Compose executed the same 13-case external-ID SQL fixture using
  actual queue resolver, metadata and history services: four cases resolved and
  nine retained null IDs with the expected review reasons. Uncertain cases made
  no title call. A later known source ID cleared the prior review receipt.
- The eight-case title fixture and the complete typed-enrichment fixture also
  passed in Compose, preserving the preceding work's behavior and drift guards.
- Fixture writes used connection-local temporary tables inside rolled-back
  transactions. Providers were stubbed; no production inventory/history was
  changed, application code under `/app` was not replaced, and no provider
  credits were used. These are regression fixtures, not an independently
  labelled real semantic-study cohort.
- Backend lint, server/client type checks, Knip, and both ESM checks passed.
- The final focused run including the classification-method guard passed:
  6 suites and 144 tests. The production dependency check also passed, as did
  Markdown lint across 975 documents and `git diff --check`.
- The broad classification-method check initially confused the new receipt's
  `external_ids` method with a classification-history value. Its existing
  non-classification-service exclusion now includes the receipt-only resolver;
  the actual history SQL fixture continues asserting `source_library`. The
  database's classification-method allowlist and constraint were not expanded.
- After correcting that check, the full backend unit suite passed: 1,045 suites
  and 29,154 tests. No runtime change was needed for that test correction.

## Repository and PR handling

Started from `301e5ace`, synchronized with `origin/main`, on
`fix/tmdb-external-id-abstention`. Recent completed work established held-out
study isolation, typed history scoring, source-history identity, typed queue
enrichment and conservative title matching. This fix closes the next documented
external-ID acceptance gap. Unreleased records the high-level behavior change;
there is no release or version bump.

The GitHub MCP returned no open pull requests for `cloudbyday90/Classifarr` on
5 September 2026, including a final recheck. The five most recently updated closed PRs were dependency
updates (#521–525), all closed without a merge. None was substituted for the
requested random open PR. Completed local work is authorized for commit, push
and integration into `origin/main`.

## Recommendation stack and next item

Adopt captured typed declarations → strict provider adapter → whole-bucket
validation → agreement between supplied IDs → explicit decision → minimal
receipt → guarded writes. This prevents order-dependent acceptance and keeps
provider failure distinguishable from no match. It costs up to two sequential
requests and more operator review. Filtering/deduplicating suspect results or
falling back to title after uncertainty would weaken that guarantee.

Implemented next in [the media-ID review design](media-identity-review-design.md)
and [outcome](media-identity-review-outcome.md): the authenticated workflow consumes unresolved
receipts. The inspected `mediaSyncRouteShared` inventory route already requires
authentication, but its `getLibraryItems` query has no resolution-status filter
and the client does not consume `tmdb_resolution`. Start with a read-only
filtered queue and accessible reason/evidence
presentation, then add explicit operator confirmation with current source-state
checks and an audit receipt. Review must establish movie/TV identity and must
not silently route media or rewrite historical classifications. Any UI should
support keyboard operation, labelled controls, and text explanations of errors,
as discussed in the [W3C research](tmdb-external-id-abstention-design.md#official-research-and-application).
Review metadata alone must never authorize an identity write.

Concurrent source-history deduplication remains a separate follow-up requiring
a two-connection regression and a deliberate database constraint/locking design.
The semantic study still requires an eligible held-out 24–32-case cohort,
independent human labels, and the existing readiness and frozen-study preflight.
Review-only semantic counter-evidence remains gated on acceptable measured errors.
