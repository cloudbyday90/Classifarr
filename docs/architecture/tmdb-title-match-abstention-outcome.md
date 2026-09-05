# TMDb title-match abstention outcome

Date: 4 September 2026. The separate [design document](tmdb-title-match-abstention-design.md)
contains official-source research, the August 2026 practice baseline, alternatives,
and the recommendation stack. Living documentation was checked in September;
the cited W3C string-matching draft is dated 16 July 2026.

## Delivered behavior

Queue title resolution no longer accepts the first result or first exact match.
The new pure ESM `tmdbTitleMatch` contract requires an explicit movie/TV type,
a bounded nonblank title, a known four-digit year, and exactly one matching
identity in a complete single-page response of at most 20 candidates. IDs and
dates must be valid, counts must agree, and duplicate IDs or malformed rows
invalidate the response. Multiple exact matches remain unresolved regardless
of provider ordering. Every candidate is checked, including candidates beyond
the ten-result display limit.

The separate ESM `tmdbIdentitySearch` adapter preserves raw response fields and
pagination. It sends the original title separately from the movie primary-year
or TV first-air-year filter through the existing credential lookup, fixed TMDb
base URL, rate limiter, adult-content policy, and ten-second timeout. Invalid
requests access neither credentials nor the network. Interactive search keeps
its existing display behavior. No dependency or large service refactor is needed.

Localized and original titles are compared using NFC normalization, lowercase,
NFC again, and collapsed whitespace. Punctuation, accents, script differences,
and word order remain significant. This deliberately sacrifices recall for
identity caution; it is not fuzzy matching or full Unicode case folding.

The existing item metadata receives `tmdb_resolution` with `version: 1`,
`status`, `method`, and a fixed `reason`. Accepted matches use `resolved` and
`exact_title_year_match`. The `review_required` reasons are `missing_year`,
`invalid_request`, `invalid_response`, `incomplete_results`,
`ambiguous_title_year`, `no_exact_title_year_match`, and `provider_unavailable`.
Title lookup diagnostics and receipts exclude raw errors, candidate data and
credentials. An existing source ID or successful external-ID resolution replaces
the old review receipt with a resolved receipt and its corresponding method.

An abstention leaves `tmdb_id` null through the existing conditional metadata
write and source-library history insertion. The recorded source library remains
an inventory fact, not evidence that the media identity was resolved. Existing
source-drift checks and guarded backfills remain effective. Existing known IDs
are preserved. Historical records are not rewritten.

## Review boundary and operator inspection

This change records unresolved identity for explicit review; it does not add a
dedicated review screen, candidate selection endpoint, or routing decision.
For local inspection, this read-only query counts the new review reasons:

```sql
SELECT metadata->'tmdb_resolution'->>'reason' AS reason, COUNT(*) AS items
FROM media_server_items
WHERE tmdb_id IS NULL
  AND metadata->'tmdb_resolution'->>'status' = 'review_required'
GROUP BY metadata->'tmdb_resolution'->>'reason'
ORDER BY reason;
```

These counts show operational coverage only, not accuracy. Existing records
without a receipt are not retroactively evaluated. No frontend or public API
contract changes were needed; the receipt is additive item metadata.

## Validation

- Focused resolver, matcher, TMDb facade and enrichment pipeline: 4 suites,
  133 tests passed. Cases include Unicode composition, original/localized names,
  remakes, absent/invalid years, invalid dates, multiple exact matches, duplicate
  and malformed IDs, hidden eleventh candidates, incomplete pagination,
  response-count contradictions, provider failures and caller mutation.
- PostgreSQL integration: 4 suites, 34 tests passed, including title resolution,
  typed queue enrichment, typed source history, and queue API behavior.
- The new eight-case SQL fixture passed in the existing local Docker Compose
  container: two exact identities resolved and six cases retained null IDs with
  the expected review receipts. A later independently established source ID
  cleared its old review status without another provider call. Actual resolver,
  metadata and history services executed against PostgreSQL.
- The existing complete typed-enrichment SQL fixture also passed in Compose,
  including source-type preservation, stale-task rejection and guarded writes.
- Fixtures used provider stubs and connection-local temporary tables inside
  rolled-back transactions. Production code, inventory and history were not
  replaced or modified, and no provider credits were used. These eight cases
  are regression fixtures, not the real independently labelled semantic cohort.
- Backend lint, server/client type checks, and both ESM gates passed.
- The broader Knip check initially found one pre-existing, unused corpus-capture
  version export. Repository-wide search found no consumer; the unused declaration
  was removed without changing any persisted version, schema, or runtime behavior.
- The full backend unit suite passed: 1,043 suites and 29,041 tests. The final
  focused run covering title resolution and corpus-capture maintenance passed
  11 suites and 151 tests. Both Knip checks passed after the cleanup.
- Markdown lint passed across 973 documents, and `git diff --check` passed.

## Repository and PR handling

Started from `57322211`, already synchronized to `origin/main`, on
`fix/tmdb-title-match-abstention`. The user authorized committing, pushing and
integrating completed work into `origin/main`. Unreleased contains the high-level
fix; no release or version bump is part of this work.

The GitHub MCP open-pull-request endpoint returned an empty array for
`cloudbyday90/Classifarr` on 4 September 2026, including the final recheck.
There was no open PR to choose randomly and implement locally. No closed PR
was substituted or separately merged.

## Recommendation stack and limits

Adopt typed captured request → bounded provider search → complete-response
validation → unique exact title/year decision → minimal receipt → conditional
writes. The benefits are deterministic decisions, explicit abstention, isolated
tests and bounded provider calls. The costs are more manual review, missed
alternate spellings and rejection of batches containing incomplete metadata.
Fetching every page and fuzzy/popularity-based acceptance remain rejected.

A single search response cannot establish catalogue completeness or prove that
a title/year uniquely identifies a real item. The existing HTTP transport also
has no new body-byte cap. This is a scoped identity fix, not a platform-wide
security certification or a measured claim about historical error rates.

## Next recommended item

The external-ID follow-up below is now implemented. See its separate
[design](tmdb-external-id-abstention-design.md) and
[outcome](tmdb-external-id-abstention-outcome.md) for acceptance rules,
fallback boundaries, validation, and the next product task.

Harden external-ID resolution against ambiguous same-type results. The TVDB and
IMDb paths still take the first valid result in the chosen type bucket. Apply
a separate explicit uniqueness contract with tests for distinct IDs, duplicates,
malformed entries and conflicting external evidence, preserving unresolved
identity and the review receipt when acceptance fails. This is a source-code
finding, not proof of observed provider corruption.

Then add an authenticated ID-review workflow with explicit operator confirmation,
concurrency checks and an audit receipt, followed by concurrent source-history
deduplication with a two-connection regression. The semantic study still needs an
eligible held-out 24–32-case cohort and independent human labels, followed by
existing readiness and frozen-study preflight. Only measured acceptable errors
can justify review-only semantic counter-evidence; this fix does not enable it.
