# Inventory-driven library understanding

## Objective and operator burden

The user clarified on 2026-09-05 that Classifarr should understand what already
exists, where it is stored, and which traits are common, with as little ongoing
operator input as possible. That observed evidence should improve future
classification and AI automation.

Routine collection, normalization, profile refresh, and comparison should run
automatically. Identity review is an exception path for unresolved evidence;
manually entering TMDb IDs or declaring every common trait is not the intended
primary workflow. Existing library placement is useful observed evidence, but
does not by itself prove that every placement is correct.

## Existing foundation

| Capability | Existing implementation | How to use it |
| --- | --- | --- |
| Library membership and source metadata | `media_server_items`, media-server synchronization | Reuse the synchronized inventory |
| Rating, genre, studio, and keyword distributions | `libraryProfileService.mjs`, `libraryProfileComputations.mjs`, `libraryProfileQueries.mjs` | Improve the existing profile contract |
| Automated profile maintenance | `policyProfileRefreshAutomationService.mjs`, native planner, outbox worker, scheduler | Verify coverage and freshness before adding another scheduler |
| Typed current-library examples | `currentLibraryCandidateRetriever.mjs` | Reuse bounded candidate-scoped retrieval |
| Semantic comparisons | `currentLibraryCandidateSemanticRetriever.mjs` and held-out study services | Measure and gate additional semantic authority |
| Observed evidence separated from policy authority | `policyLibraryProfileEvidence.mjs`, profile evidence loader and initial-intent services | Preserve provenance and existing authority boundaries |

## Local assessment

A read-only local Compose query on 2026-09-05 returned:

| Observation | Count |
| --- | ---: |
| Active libraries | 10 |
| Libraries with stored profiles | 10 |
| Inventory items in active libraries | 6,692 |
| Items with a non-null TMDb ID | 6,659 |
| Items without a source rating | 154 |
| Items without source genres | 31 |
| Profiles generated more than 24 hours ago | 10 |

These are point-in-time counts, not accuracy measurements. A non-null ID does not
prove identity correctness. Missing source fields can have enrichment fallbacks.
Profile age alone does not establish staleness when inventory has not changed;
verify the inventory revision and automatic refresh eligibility before changing
scheduling. No real data was updated during this assessment.

Source inspection and a two-item fixture exposed a denominator mismatch. For
one Action/Drama item and one Action item, `countDistribution` produces Action
100% and Drama 50%: prevalence across items. `getGenreDistribution` uses genre
occurrences as its denominator, producing 66.7% and 33.3%. Both calculations are
internally meaningful, but callers should not treat them as the same measure of
what is common in a library. The SQL formula was reproduced inside a read-only
Compose transaction; the profile calculation ran locally with the same fixture.

The profile builder also derives rating exclusions from absent ratings, including
when source rating coverage is missing. The newer evidence contract already
keeps observed absence as review-only outlier evidence. Follow its downstream
consumers before changing behavior; do not promote missing metadata or observed
absence into an automatic restriction. `generateProfile` returns null for an
empty inventory, so also verify how existing stored profiles are invalidated.

## Implementation sequence

**Unify observed-library prevalence and metadata coverage.** Reuse the existing
profile services and refresh pipeline:

1. Define a versioned per-trait measure with item count, observed count, matched
   count, unknown count, and clearly named denominators. Count each trait once
   per item. Preserve typed identities and distinguish inventory rows from
   unique media when duplicates exist.
2. Make the stored profile and AI-facing query use the same definition. Present
   unknown metadata explicitly; absence and sparse coverage must not become
   inferred hard exclusions. Update consumers together, with fixture tests for
   multiple genres, duplicates, sparse fields, and empty libraries.
3. Verify automatic refresh against inventory changes and empty/deleted-library
   transitions using the existing planner/outbox. Add only the missing trigger
   or invalidation behavior established by that investigation.
4. Measure profile coverage, freshness, overlap, and outlier rates automatically.
   Use them to decide which evidence can support future classification and
   which exceptional cases need attention.

The shared prevalence and coverage contract, coordinated consumers, and empty
profile cleanup are implemented in the subsequent
[observation design](library-profile-observation-design.md) and
[validation outcome](library-profile-observation-outcome.md). An automatic
post-upgrade refresh rebuilds existing active-library profiles. The next product
task was inventory-change-driven refresh and invalidation through the existing
planner/outbox, including libraries without an enabled native policy. That work
is now recorded in the [refresh design](inventory-profile-refresh-design.md)
and [refresh outcome](inventory-profile-refresh-outcome.md). Keyword and
original-language provenance is implemented in the
[metadata design](inventory-metadata-provenance-design.md) and
[32-item assessment](inventory-metadata-provenance-outcome.md).
Safe retention of resolved typed identities when source resync omits an identifier
is implemented in the [retention design](resolved-identity-sync-retention-design.md)
and [retention outcome](resolved-identity-sync-retention-outcome.md).
Source snapshot guards now cover late OMDb rating, metadata and history writes;
see the [write-guard design](enrichment-source-write-guards-design.md) and
[validation outcome](enrichment-source-write-guards-outcome.md).
The bounded, coverage-aware cross-library overlap summary is implemented in the
[overlap design](library-overlap-design.md) and
[measured outcome](library-overlap-outcome.md).
The separate shared HTTP mutation-retry audit remains a correctness follow-up;
the receipt-recovery change already disables replay for identity confirmation.

## Recommendation stack and tradeoffs

| Approach | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Reuse synchronized inventory and automatically refreshed profiles | Low operational burden; uses real library organization | Inherits source mistakes and missing metadata | Primary foundation |
| Explicit prevalence, coverage, freshness, and provenance | Makes common traits interpretable and comparable | Provider outages and incorrect source identities still limit evidence | Coverage, change-driven refresh, and [TMDb trait provenance](inventory-metadata-provenance-outcome.md) implemented |
| Bounded item and semantic comparisons across candidate libraries | Explains similarities, overlaps, and outliers | Semantic evidence needs independent evaluation | Build on existing retrieval |
| Manual per-item identity and policy setup | Resolves exceptional ambiguity | Does not scale as the main workflow | Exception path |
| Treat all existing placements or model labels as verified truth | Removes apparent review effort | Conceals errors and creates circular evaluation | Reject |

The recommended stack is synchronized inventory → typed normalized evidence →
automatically maintained library profiles with coverage → bounded comparative
evidence → measured classification and AI automation. Human effort should be
concentrated on exceptional uncertainty and small validation samples, rather
than routine inventory analysis.

The original held-out semantic readiness contract remains in force. Automatically
prepare and capture the 24–32-case cohort, but do not count model-generated labels
as independent human review or enable semantic routing on that basis. A good
measured profile can support review-only counter-evidence under the existing gates.

## Research basis and implementation status

The [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) describes quality
measurements and their provenance so consumers can judge fitness for purpose.
It is a Working Group Note, not a requirement to adopt RDF in this application.
Applying its principle here means recording explicit coverage and freshness
metrics with the evidence that produced them. The URL was discovered through
web search on 2026-09-05; this established guidance predates the requested
August 2026 baseline.

This document preserves the original assessment and implementation sequence.
The linked design and outcome record the subsequent profile contract fix and
the measured remaining gaps. The receipt-recovery patch remains a separate change.
