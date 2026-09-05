# Library profile prevalence and coverage design

## Problem and intended outcome

Classifarr should learn common library traits automatically from synchronized
inventory. The stored profile currently measures genre prevalence across items,
while AI-facing queries measure genre occurrences. One Action/Drama item plus
one Action item therefore produces either 100%/50% or 66.7%/33.3%.

The same paths differ in metadata fallbacks and unknown-value handling. The
generator also turns absent ratings into exclusions. These differences make
observed library patterns unreliable inputs for future automation.

## Recommendation stack and alternatives

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Shared deterministic ESM observation calculation | One normalization and denominator contract for stored profiles and live statistics | Reads projected inventory rows to calculate exact counts | Implement |
| Separate SQL and JavaScript formulas | SQL aggregates can minimize transfer | Duplicates fallback and rating semantics and has already drifted | Replace |
| Explicit known, missing, and matched counts | Distinguishes weak coverage from unusual content | Additive persisted/API fields and consumer changes | Implement |
| Treat absent values as exclusions | Appears decisive | Mistakes incomplete observations for policy intent | Remove from generated profiles and profile scoring |
| Ask operators to label every item or trait | Can supply curated intent | High operational burden | Keep only exception review and independent evaluation samples |

Use synchronized inventory → one typed, normalized observation → stored profile
and live-stat projections → coverage-aware UI and AI evidence → existing measured
classification gates. Reuse the automatic refresh worker and post-upgrade task
mechanism. No new scheduler, provider call, release, or dependency is required.

## Observation contract

Persist `observation_summary` as an additive JSONB object with version
`library.profile_observation.v1`. The population is explicitly `inventory_rows`,
not unique titles or a verified label set. Include the total row count, counts
of identified/unidentified rows, distinct typed identities, and duplicate
identified rows. Movie and TV numeric IDs occupy different namespaces.

For rating, genre, studio, keyword, and language, record observed item count,
unknown item count, coverage percentage, and sorted entries containing value,
matched item count, percent of all inventory items, and percent of observed
items. Each normalized value counts once per item. Both percentage fields use
one decimal place. Zero denominators produce zero without claiming coverage.

Keep existing distribution maps and stats arrays as projections of that same
observation. Their `percentage` means percent of all inventory rows. Multivalue
traits can sum above 100%; unknown fields are not invented categories. Preserve
explicit NR/Unrated ratings, but missing or unusable provider values remain
unknown. Use existing typed rating normalization and normalized metadata lists.

Source fields take precedence over provider fallbacks. Read only identity and
trait fields needed for aggregation; do not fetch titles, plots, credentials,
or full provider payloads. Bound labels and remove control characters. Use Maps
for counts and safe own-property reads for externally supplied distribution keys.
Studio retains the existing primary-studio convention, with the first provider
production company as fallback. Keyword observations use the existing nested
TMDb keyword field, including its movie/TV response wrappers; source tags are
not substituted. Language uses a recorded original-language field, never a
default based on the installation language.

## Persistence, rollout, and empty libraries

One parameterized SELECT supplies each live observation from one PostgreSQL
statement snapshot. A failure propagates as unavailable evidence; it must not be
reported as an empty library. Persist the summary and legacy projections together.
Capture the observation time at the read, and avoid overwriting a newer stored
observation with an older concurrent calculation. Preserve PostgreSQL timestamp
precision for this comparison. Reject a delayed nonempty write if the inventory
is already empty at its write snapshot.

Generating an empty library removes its obsolete profile only while the library
is still empty. The existing null-result behavior remains compatible with the
refresh worker and maintenance endpoint. Deleted libraries retain FK cleanup.
Include empty libraries with old profiles in bulk regeneration.

Add an automatic one-time observation refresh to the existing post-upgrade
mechanism under the current version, without changing the version. Do not mark
the task complete if any library fails. The ordinary planner remains responsible
for its existing eligible native-policy libraries. Inventory-change and empty
transition scheduling must be assessed separately; profile age alone is not an
inventory revision.

## Consumers and authority

The existing profile GET remains read-only and exposes the additive summary.
The named client API leaf continues to serve the same endpoint. A small coverage
component explains denominators and missing values with semantic table headers.
Old profiles visibly lack measured coverage until automatic regeneration.
Remove the misleading “Never in this library” presentation.

Reuse the component in historical profile snapshots. Legacy history explicitly
has an unverified denominator. Keep only numeric coverage in per-classification
snapshots and local candidate AI evidence; the full trait entries stay in the
library profile. Remote candidate evidence keeps its existing coarse projection.

AI prompt text states the denominator, coverage, and observational nature of the
statistics. Candidate evidence retains its existing local/remote disclosure
boundary. No absent trait becomes a hard restriction. Existing declared policy
rules remain authoritative; profile evidence does not verify historical placement.
Semantic counter-evidence still requires independent held-out evaluation.

## Official research and validation

URLs were discovered through web tools on 2026-09-05 for the requested August
2026 baseline. Living documentation is not an archived August snapshot.

- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) describes quality
  metrics and provenance for judging fitness for purpose. It is a Working Group
  Note; this design adopts the measurement principle without adding RDF.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains statement snapshots at read committed isolation. A single observation
  read avoids mixing totals and distributions from different moments.
- [OWASP SQL injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  supports bound query values and fixed SQL structure.
- [W3C information and relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
  supports programmatically associated labels, table headers, and textual meaning.
- [W3C minimum contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
  provides the 4.5:1 threshold for ordinary text. Check the profile maintenance
  explanation against its rendered background in Chromium.

Verify multi-genre percentages, duplicate traits and identities, typed ratings,
fallbacks, missing data, unsafe object keys, empty libraries, SQL failures,
stored/live agreement, automatic upgrade retries, and UI/prompt semantics. Use
isolated PostgreSQL integration tests and read-only measurements against local
Compose. Document measured results and the next task in a separate outcome.
