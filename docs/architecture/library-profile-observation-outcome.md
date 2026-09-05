# Library profile observation outcome

## Delivered behavior

The September 5, 2026 implementation follows the
[separate design and research](library-profile-observation-design.md). Stored
library profiles and live AI-facing statistics now share one deterministic ESM
calculation. For one Action/Drama item and one Action item, both report Action
100% and Drama 50%. Repeated traits within an item count once.

Profiles disclose the inventory-row population, typed identity duplication, and
known/missing counts for ratings, genres, studios, keywords, and languages. They
retain both all-item and observed-item percentages; existing UI and AI
distribution fields use the all-item denominator, rounded to one decimal place.

An additive JSONB migration stores this measurement beside existing distribution
columns. The existing upgrade mechanism automatically regenerates active-library
profiles and retries an incomplete task on the next startup. No operator setting,
dependency, provider request, scheduler, or version change was added.

Observed absence no longer creates generated exclusions or negative profile-score
contributions, including from old stored exclusion arrays. This can increase a
candidate's profile score relative to the previous incorrect penalty. Declared
policy rules remain in effect. This change does not introduce semantic routing
or establish that existing placements are correct.

## Real Compose measurement

The new reader scanned the existing local Compose inventory in a read-only
transaction. Only aggregate results were retained; real inventory was not changed.

| Measurement | Count |
| --- | ---: |
| Active libraries measured | 10 |
| Inventory rows | 6,692 |
| Rows with a positive typed TMDb identity | 6,659 |
| Repeated typed identities within a library | 0 |
| Known ratings / missing ratings | 6,509 / 183 |
| Known genres / missing genres | 6,661 / 31 |
| Known studios / missing studios | 6,597 / 95 |
| Known keywords / missing keywords | 0 / 6,692 |
| Known original languages / missing original languages | 0 / 6,692 |

The measured pass took 528 ms on this local installation. Every per-trait
known-plus-missing count matched its library population, and every matched count
and percentage stayed within its denominator. This is a local measurement, not
a general performance guarantee or a classification accuracy study.

The original assessment found 154 rows without a source rating. The stricter
normalized observation reports 183 missing usable ratings: placeholders and
unsupported rating text are not silently converted into observed NR ratings.
Explicit NR and Unrated values remain valid observations.

Zero keyword and language coverage means the synchronized fields this reader
consumes do not supply those observations. It does not prove that the underlying
media lacks keywords or language. Do not infer English, reinterpret arbitrary
tags as authoritative keywords, or ask an operator to fill every row.

## Architecture and security outcome

Small services separate calculation, database projection, persistence, and
presentation. One bound SQL read supplies all per-library measurements from one
statement snapshot. It projects needed traits instead of titles, plots, or full
provider payloads. Database errors remain unavailable evidence, not empty data.

The persistence statement writes the summary and distributions together. It
preserves database timestamp precision, rejects an older observation when a newer
one exists, and avoids recreating a profile while its library is empty. Empty
profile deletion also checks the current inventory. These checks do not replace
inventory revision tracking across later synchronization and enrichment changes.

Trait normalization bounds text and strips control characters. Maps and own-key
reads handle untrusted distribution keys. The profile endpoint retains its
existing authorization and read-only behavior. Historical snapshots and local
candidate evidence carry aggregate coverage only; the remote candidate projection
does not gain exact counts or trait values.

The shared Vue coverage component supplies a caption and associated row/column
headers, textual missing-data meaning, and a legacy-history explanation. Profile
maintenance text uses a more readable foreground. No new routine review step is
introduced. Independent human labels remain necessary for the separate held-out
semantic readiness and frozen-study preflight; this inventory measurement does
not satisfy those gates.

## Validation

| Check | Result |
| --- | --- |
| Full backend suite with coverage | 1,049 suites, 29,347 tests passed |
| Full frontend suite with coverage | 319 files, 4,312 tests passed |
| PostgreSQL 18 integration | 6 passed: stored/live agreement, private-field projection, read-only/error behavior, empty cleanup, and delayed writes across populated/empty refreshes |
| Chromium library profile | Passed: semantic headers, item percentages, no read-triggered writes, mobile fit, and maintenance-text contrast at least 4.5:1 |
| Docker production build | Passed locally as `classifarr:test` |
| Isolated schema dump and parity check | Passed through migration `20260905_140000_add_library_profile_observation_summary.sql` |
| Type checks, server/client lint, normal and production Knip | Passed |
| Static ESM imports and strict ESM mock shapes | Passed |
| Migration naming and documentation lint | Passed |
| Coverage ratchet | Passed against the committed baseline; backend lines 90.05%, branches 80.31%; frontend lines 87.68%, branches 77.16% |

The mobile screenshot was visually inspected. The Compose assessment above
used the real synchronized inventory; integration and browser fixtures used
isolated data. No production data was modified or live service redeployed.

## Repository delivery and PR availability

Recent local work protected typed source identity, abstained on ambiguous ID or
title matches, and added exceptional administrator correction with receipt
recovery. This change follows the inventory-understanding direction documented
after that work; it does not expand routine manual correction.

The GitHub connector returned no open PRs on both checks during this task. The
five most recently updated closed PRs were dependency updates (#521–525). No
open PR was available for random selection, and no closed PR was substituted or
merged. The requested local implementation is delivered with an Unreleased
changelog entry; package versions remain unchanged and no release is created.

## Recommendation stack and next item

| Recommendation | Benefit | Cost or limitation | Priority |
| --- | --- | --- | --- |
| Keep one normalized observation contract | Comparable stored, UI, and AI evidence with explicit uncertainty | Exact aggregation uses memory proportional to one library's projected inventory | Implemented |
| Refresh from inventory changes through the existing outbox | Low operational input and reliable empty-library invalidation | Requires durable revision/change tracking | Implemented in the subsequent refresh change |
| Preserve authoritative keyword and language provenance during enrichment | Makes missing traits useful for later comparisons | Provider cost, caching, typed identity confidence, and source precedence need verification | After freshness |
| Add bounded overlap/outlier measurements using existing retrieval | Explains similarities and ambiguous membership | Requires coverage-aware thresholds and held-out evaluation | Follow-on |

The subsequent [inventory refresh design](inventory-profile-refresh-design.md)
and [refresh outcome](inventory-profile-refresh-outcome.md) implement this
follow-up through transactional input revisions and the existing planner/outbox.
The next item is keyword and original-language provenance in synchronized
inventory, using the automatic refresh mechanism when those observations change.

The subsequent metadata task should trace provider fields into synchronized
inventory. `mediaSyncUpsert.mjs` currently supplies `original_language: 'en'`
to content analysis, and classification enrichment has separate flat metadata
shapes. Audit those boundaries before treating inferred/defaulted values as
observed language or adding provider work. This implementation does not change
those paths.

The final stack remains synchronized inventory → typed normalized observations →
automatically refreshed coverage-aware profiles → bounded comparative evidence →
measured classification and AI automation. Concentrate human input on exceptional
ambiguity and small independent evaluation samples.
