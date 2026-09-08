# Library Observed Trait Prevalence Design

Status: implemented, unreleased. Research and implementation reviewed on
2026-09-08.

## Problem

Classifarr already refreshes a per-library profile and can show pairwise
overlap. That was enough to answer whether two libraries have values in common,
but it did not give an automatic, comparable answer to these questions:

- what values are observed most often in this library;
- how frequent are those values across selected peer libraries of the same
  media type; and
- whether a current source-identity conflict made a row unsafe to use as
  evidence.

As a result, a person or a future automation would otherwise have to read
separate profile cards and infer the comparison manually. A profile frequency
also cannot establish a library's intended purpose, a hard exclusion, semantic
accuracy, or a route.

## Decision

Extend the existing authenticated `GET /api/libraries/overlap` snapshot with a
versioned, bounded `library.observed_trait_prevalence.v1` projection. It is
constructed in memory from the same selected inventory snapshot as overlap;
there is no new collector, provider request, database write, policy mutation,
or routing action.

For each selected library and non-empty movie/TV cohort, the projection reports
the five already-normalized traits: rating, genres, studio, keywords and
original language. For each displayed value it reports:

- local count and percentage of *locally observed identities*;
- selected-peer count and percentage of *peer observed identities*;
- the percentage-point difference; and
- local and peer observation denominators, conflict count, coverage state,
  value count and truncation state.

The browser receives at most five values per trait, validates the version,
field names, media types, counts, percentages, text length, uniqueness and
array bounds, then renders native disclosure controls. Unknown projection
fields do not cross the presentation boundary.

## Source-identity boundary

`media_source_observations` records active invalid or conflicting source
identity evidence. The snapshot uses the existing 30-day
`sourceConflictAuthorityPredicateForMediaServerItem` guard and excludes a row
when it is currently blocked. Excluded-row counts remain visible per library;
the row's identity and traits do not affect overlap, prevalence, peer baselines
or displayed values.

This is deliberately stricter than treating absence of a conflict as proof of
identity. A row that survives this filter is still an observed placement only.
Duplicate trait disagreements within an otherwise eligible typed identity are
also retained as coverage uncertainty by the existing cohort builder.

## Architecture

```text
bounded active-library inventory snapshot
        |
        +-- current source-conflict guard --> excluded-row count
        |
        v
typed movie / TV overlap cohorts
        |
        +-- pairwise common-trait comparison
        |
        +-- local observed traits + same-type selected peers
                  |
                  v
    bounded prevalence projection and client allow-list
                  |
                  v
  automatic Libraries disclosure (information only)
```

`libraryOverlapQuery.mjs` owns the one parameterized source read and emits the
conflict flag into its private snapshot. `libraryOverlapService.mjs` applies the
exclusion before cohort construction. The pure
`libraryObservedTraitPrevalence.mjs` module aggregates only the in-memory
cohorts. This keeps data access, authority filtering and deterministic analysis
separate.

The peer baseline intentionally counts identity placements across the selected
libraries. It is not a globally deduplicated catalogue rate. If active-library
selection is capped, `partial_active_library_scope` says so instead of implying
that the selected peers represent every active library.

## Authority and security

- Existing authentication, no-store response and rate limit remain on the
  existing overlap route.
- SQL uses fixed bounds and existing parameter placeholders. The client cannot
  choose a library, a trait, a sort expression or a threshold.
- Current source conflicts exclude evidence; lack of a conflict is never a
  verified identity claim.
- The response has no media title, description, external ID, source payload,
  provider credential, policy term, model output or routing control.
- The UI treats every value as plain text and its normalizer removes unknown
  properties before rendering.
- The projection supplies neither a confidence score nor an automatic review,
  policy or route transition.

## Research basis

The following official sources were retrieved on 2026-09-08, the requested
September 2026 baseline:

- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  provenance, data-quality and coverage information so people and machines can
  understand a dataset. This supports versioning the projection and naming both
  observed denominators instead of presenting an unexplained percentage.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented measurement processes, test sets and independent review.
  Prevalence is therefore descriptive context for a future evaluation, never a
  substitute for the independently labelled cohort and frozen-study gates.
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  supports server-side field allow-listing. The route projects only required
  aggregate trait evidence and the browser revalidates the contract.
- [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  supports the native disclosure presentation, which gives keyboard users the
  same optional detail without permanently expanding the Libraries page.

## Alternatives

| Approach | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Read profiles and calculate comparisons manually | No code change | Repeats operator work and obscures denominators | Reject |
| Persist an incremental cross-library feature index | Could serve larger inventories cheaply | New invalidation, retention and synchronization obligations | Defer until the bounded reader reaches measured capacity limits |
| Use all observed values as policy identity or exclusions | Reduces an apparent configuration step | Repeats profile-derived false-positive risk | Reject |
| Bounded read-only prevalence beside existing overlap | Reuses current lifecycle, preserves coverage and source-conflict boundaries | Selected-library scope can be partial | Adopt |

## Recommended stack

1. Guarded source synchronization and identity-conflict retention.
2. Automatic profile refresh and attributable metadata capture.
3. Bounded typed overlap plus observed local/peer prevalence.
4. Deterministic policy candidate generation with profile facts limited to
   compatibility context.
5. A complete independently labelled 24–32-case study, readiness evaluation
   and frozen-study preflight.
6. Only after a satisfactory measured error profile, semantic counter-evidence
   that refers ambiguous cases to review and never routes them automatically.
