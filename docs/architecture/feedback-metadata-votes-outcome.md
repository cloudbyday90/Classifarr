# Unique metadata votes: implementation outcome

## Delivered changes

The [previous cohort follow-up](suggestion-cohort-outcome.md) identified repeated
tags as a source of inflated confidence. The grouping service now counts each
normalized value once per feedback record before applying discovery thresholds or
calculating confidence. The existing normalizer, input records, ordering and
null-prototype grouping remain intact. No new service dependency was needed.

Before the fix, one correction with three repeated genres could become a pattern.
It now contributes one vote and cannot meet either the two-record discovery or
three-record failure-pattern threshold alone. Three genuine correction records
produce pattern confidence 60 and suggestion confidence 45, regardless of repeated
copies of those values in their metadata. These are existing heuristic scores,
not newly calibrated probabilities.

The cohort version is now `feedback_suggestions.v2`. Version 1 suggestions fail
application with the existing stale-evidence conflict even when their data has
not changed. Normal analysis supersedes obsolete pending suggestions and either
creates a correctly scored replacement or creates no pattern when support is
insufficient. Old cohort data and applied/rejected history remain intact.

Real database testing also found that the existing pattern-application query used
a nonexistent `source` column and omitted required `library_name`. The corrected
query reads the current destination name and writes the actual schema inside the
existing review transaction. Pattern attribution remains in the suggestion,
immutable cohort and policy change log. Existing conflict behavior preserves the
higher confidence while approving the matching pattern. Approved historical
patterns are not automatically recalibrated.

## Validation

Validation used the local Node environment and disposable Docker PostgreSQL
databases on 6 September 2026:

| Check | Outcome |
| --- | --- |
| New regression tests before the fix | 8 failed, reproducing inflated counts and discoveries; 1 compatibility case passed |
| Focused backend units after the fix | 134 passed across 10 suites |
| PostgreSQL integration | 85 passed across 4 suites |
| Dashboard and API compatibility | 25 passed across 2 frontend files |
| Integration-only coverage of grouping and application modules | 76% statements/lines, 78.04% branches, 83.33% functions |
| Type checking, affected-file lint and ESM checks | Passed |
| Local Docker image | Built; packaged v2 counting assertion passed |
| Disposable application startup and schema check | Healthy startup; no schema drift |

Tests include mixed strings/objects/JSON lists, whitespace normalization,
malformed values, reserved names, Unicode/case compatibility, input immutability,
distinct records, confidence invariance under duplicated tags, v1 invalidation,
automatic replacement/removal, historical preservation, and transactional rollback
for both new and existing patterns. Integration assertions verify that original
feedback and frozen duplicate-containing metadata are preserved.

The full frontend/backend suites and repository-wide coverage ratchet were not
rerun for this focused backend change. No endpoint, UI or schema was changed.

## Local data and PR availability

Read-only Compose inspection at 2026-09-06 23:54:58 UTC found PostgreSQL 18.6 with
zero feedback and zero suggestions; no eligible cohort was available. The query
took 25.635 ms with zero production writes, provider requests or individual record
exports. It reused the existing inspection helper, streamed through standard input
because the container filesystem is read-only. The evidence above is controlled
regression testing, not a measured production classification error profile.

GitHub MCP returned no open PRs on both checks, so none was available for random selection or
local implementation. No external PR was merged. This work updates Unreleased
without a version bump, release tag or release publication.

## Recommendations and tradeoffs

Recommended stack: existing normalization → per-record native `Set` → corrected
pattern counts/confidence → v2 frozen evidence → existing locked review and audit.
This keeps collection automatic and adds no operational labeling step.

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Deduplicate before analysis | Prevents one record from manufacturing multiple votes | Keeps separate feedback events separate |
| Preserve existing matching rules | Avoids conflating unrelated names or changing other consumers | Case/Unicode variants can still differ |
| Invalidate the old analysis version | Reuses the current stale-evidence and supersession workflow | Even unaffected v1 pending suggestions need regeneration |
| Retain the existing pattern table and audit transaction | Repairs the reviewed application path with no migration | Other legacy writers still need separate review |

The [design document](feedback-metadata-votes-design.md) contains the official
ECMAScript and W3C sources, August 2026 baseline, alternatives and versioning
decision. The July W3C string-matching source is explicitly identified as a draft.

## Next item

**Repair prompt-action pattern persistence and its success count.** Inspection of
`server/src/routes/promptsRouteShared.mjs` found the same nonexistent `source`
column and missing `library_name` in its pattern insert. That path catches write
errors but returns `patternsCreated: patternActions.length`, so attempted actions
can be reported as created even when persistence fails. Follow up with a small
shared ESM writer, an explicit transaction boundary and real PostgreSQL tests
that count successfully committed patterns. Keep repeated feedback about the same
media identity as a separate later analysis; it requires a policy for corrections
over time rather than a blanket deduplication rule.
