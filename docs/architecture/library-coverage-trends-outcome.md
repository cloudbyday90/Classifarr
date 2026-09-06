# Per-library coverage trends outcome

## Delivered behavior

The [design](library-coverage-trends-design.md) extends automatic hourly sampling
with bounded per-library counts and private inventory fingerprints. Libraries
shows each selected library's latest coverage and expandable hourly history,
using current library names as labels. Signed count changes require consecutive
hourly samples, unchanged inventory population and unchanged acquisition
configuration. Equal-count replacements, library selection changes, unavailable
detail, capacity limits and gaps are explicit.

Consecutive intervals with unchanged captures and known traits are described
without asserting an outage or classification readiness. Empty keyword arrays
and unknown language remain valid captures with unknown traits. Current coverage
and history retain the existing 12-library/20,000-row scope; fixed hourly slots
bound retained detail to 168 frames and 2,016 library entries.

## Prior work and PR inspection

The latest mainline changes established source identity guards, cross-library
comparison, observation health, automatic malformed-observation repair and
aggregate acquisition history. This increment addresses the documented gap in
that last history: aggregate gains could conceal uneven per-library progress,
and equal inventory counts did not establish a comparable population.

GitHub MCP returned no open pull requests on 5 September 2026, so there was no
eligible random PR to implement. The five most recently updated closed PRs were
dependency proposals [522](https://github.com/cloudbyday90/Classifarr/pull/522),
[523](https://github.com/cloudbyday90/Classifarr/pull/523),
[524](https://github.com/cloudbyday90/Classifarr/pull/524),
[525](https://github.com/cloudbyday90/Classifarr/pull/525) and
[521](https://github.com/cloudbyday90/Classifarr/pull/521); none was reported as
merged. No PR was merged or substituted for the requested open-PR task.

## Local Compose assessment

Reused the existing private assessment runner against local Compose. Selected 32
real inventory identities across eight libraries: 16 movies and 16 TV identities.
All writes used transaction-local temporary tables and rolled back. Provider
responses and sample-time advancement were controlled fixtures, not a live
elapsed-time study or independent human labels.

| Measurement | Result |
| --- | --- |
| Explicit observation validity cases | 6 valid; 26 malformed |
| Controlled outage outcomes | 26 unavailable; no refill during cooldown |
| Controlled recovery | 26 additional captures; 32 fresh captures total |
| Per-library captured deltas after recovery | Sum exactly 26 |
| Same-count identity replacement | Affected library marked changed; delta withheld |
| Other libraries after replacement | Seven remained comparable |
| Missing hourly sample | All affected comparisons withheld |
| Retained assessment detail | Five frames; 40 library points |
| Read after recovery | 8 ms; 8,696-byte response |
| Final trend response | 14,198 bytes; fingerprints excluded |
| Provider network / live / classification writes | 0 / 0 / 0 |
| Temporary-table rollback | Verified |

The first private-run attempt lacked a copied projection migration and stopped
before cohort writes. Copying the existing prerequisite into the private runtime
resolved the harness issue; the complete assessment then passed. No production
migration or live application deployment was needed for this assessment.

## Validation

Targeted backend checks passed 70 tests. Final PostgreSQL integration passed 47
tests across five trend, acquisition-history, health, observation and profile suites. Checks cover
atomic first-sample retention, equal-count identity/type/row changes, deterministic
fingerprints, unchanged populations after metadata or name changes, invalid and
legacy detail, gaps, configuration changes, and storage/response bounds. The full
168-frame × 12-library response stayed below the tested 1.5 MB bound.

Targeted client checks passed 63 tests, including escaped library names, semantic
tables, unknown values and distinct comparison reasons. The complete client run
passed 323 suites and 4,429 tests with 87.78% line, 85.78% statement, 77.44% branch
and 84.78% function coverage. The final API fixture check passed nine tests.

All three Chromium health/history/overlap checks passed, including mobile
containment, keyboard disclosure and horizontal scrolling, one automatic history
read and no mutation requests. The mobile trend screenshot was visually checked.
An initial screenshot-reset assertion raced Chromium's keyboard scroll animation;
the browser test now waits for `scrollend` before resetting the screenshot position.

Lint, type checking, static ESM imports, strict test mock shapes, both Knip checks,
migration/snapshot checks and all 1,000 Markdown documents passed. Backend full
coverage passed 1,058 suites and 29,976 tests, with 90.10% line/statement, 80.52%
branch and 92.74% function coverage. The combined coverage ratchet passed without
regressions. The new frame validator has complete coverage; trend projection has
complete line coverage and 97.56% branch coverage.

The new migration adds a nullable bounded JSON column; existing samples remain
unknown until automatic sampling records new detail. The schema snapshot was
regenerated and checked using an isolated local test image. Existing installations
apply the migration; fresh installations receive the same column and constraint.

## Recommendations and next item

The recommended stack remains synchronized inventory → attributable observations
→ automatic profiles and health → population-aware trends → bounded library
comparisons → independently evaluated review-only semantic evidence. The main
advantages are low operational input, bounded storage and honest comparison
boundaries. Limits are short retention, excluded libraries, no item-level change
attribution and no causal explanation of unchanged coverage.

The subsequent [fair sampling outcome](fair-library-sampling-outcome.md) delivers
the recommended active-library traversal and separate capacity boundaries.
Automatic history now visits libraries beyond the first 12 and measures smaller
libraries even when another exceeds 20,000 rows. This document's hourly behavior
describes the retained legacy contract. The next item is revision-checked,
incremental coverage for an individual library above the per-visit capacity.

The readiness and frozen-study gates remain unchanged. Controlled fixtures and
existing placements provide no independent human review or semantic correctness
measurement. This work grants no automatic routing authority and creates no release.
