# Learned query metadata parity: outcome

Date: 2026-09-22. Implements the
[metadata parity design and research](learned-query-metadata-parity-design.md).
The separate [PR #544 outcome](server-tooling-pr-544-outcome.md) records the
randomly selected tooling update. No release, PR merge or version bump.

## What was wrong and what changed

The live learned-library query discarded `certification`, the age-rating field
produced by classification, because it expected the inventory field
`content_rating`. Training retained the feature. Older tests used the inventory
shape and missed this training/query mismatch.

A shared, pure ESM projection now accepts either classification rating alias,
normalizes it consistently with inventory training, and treats contradictory or
malformed supplied aliases as absent evidence. Numeric audience scores are never
age ratings. The existing inventory transformation is unchanged. There are no
library-name rules, new weights, lowered thresholds or additional user prompts.

A zero-inference audit of the same 120 selected items confirmed the feature loss:

| Media type | Sampled | Available certifications | Lost before | Lost after |
| --- | ---: | ---: | ---: | ---: |
| Movie | 58 | 56 | 56 | 0 |
| TV | 62 | 61 | 61 | 0 |
| Total | 120 | 117 | 117 | 0 |

The other three items had no certification to recover. Stored metadata already
has the necessary information: the next evaluation repairs the query projection
without a database migration or external backfill. Historical decisions are not
rewritten, and reviewed items are not automatically resubmitted.

## Fresh live comparison

Reused the current inventory selector and live review-only evaluation components.
The deterministic selection excluded 200 distinct descriptions from the previous
two cohorts. Both completed passes used the same 120 distinct descriptions across
all ten sampled libraries: 58 movies and 62 TV items.

Selection seed: `admission-diagnosis-20260920`; size: 120; folds: 2;
prior exclusion sizes: `[100, 100]`.

Sample fingerprint:
`711eaf7649e5ede923df2dd2490d762e673ce089dcc74537f038d245c25fe2a8`.

There were 107 eligible adjudications per pass: 58 movies and 49 TV items. Thirteen
TV cases followed existing policy paths outside this adjudication: six
`prompt_confirm` and seven `auto_classify`. These are policy result labels, not
executed routes; this evaluation never routed any item.

Both passes produced 107 valid local-provider proposals, prepared every eligible
context, and reported no changed policy/library/configuration components. Provider
model digest, inventory and relevant routing code were held constant. Before/after
code comparisons isolated the shared projection and its two consumers.

| Review-only outcome | Before | After |
| --- | ---: | ---: |
| Strict evidence qualified; confirmation still required | 48 | 51 |
| Calibrated shadow evidence qualified; confirmation still required | 4 | 3 |
| Live evidence/identity guards blocked | 44 | 41 |
| Calibrated fallback blocked | 11 | 12 |
| Outside this adjudication path | 13 | 13 |

Strict qualification had five gains and two losses, not a uniform score increase.
Restoring a feature can support one candidate and count against another. Shadow
qualification remains observational and does not itself grant routing authority.

The first learned-evidence check changed as follows: agreement 50 → 53, neighbor
disagreement 48 → 47, metadata disagreement 7 → 5, and shared-description support
2 → 2. Two agreeing cases in each pass still failed identity guards. The final
live-guard failures were unsupported comparison 42 → 39 and unclear identity
2 → 2. There were no case-level provider-unavailable, busy or stale-evidence holds.

### Coverage by source-library slice

Strata are anonymous report identifiers, not actual library names or IDs. A slice
records source placement for coverage only; it is not an authoritative label.

| Stratum | Type | Sampled | Eligible | Strict before → after | Shadow before → after |
| --- | --- | ---: | ---: | --- | --- |
| 1 | Movie | 10 | 10 | 0 → 0 | 0 → 0 |
| 2 | Movie | 12 | 12 | 5 → 5 | 2 → 2 |
| 3 | Movie | 12 | 12 | 12 → 12 | 0 → 0 |
| 4 | Movie | 12 | 12 | 6 → 7 | 0 → 0 |
| 5 | Movie | 12 | 12 | 5 → 6 | 0 → 0 |
| 6 | TV | 13 | 12 | 2 → 2 | 0 → 0 |
| 7 | TV | 12 | 5 | 1 → 0 | 1 → 0 |
| 8 | TV | 12 | 12 | 8 → 8 | 0 → 0 |
| 9 | TV | 12 | 11 | 6 → 6 | 1 → 1 |
| 10 | TV | 13 | 9 | 3 → 5 | 0 → 0 |

### Safety and limitations

- The database session enforced read-only transactions. All proposals used the
  installed local provider; no paid-provider fallback or model download occurred.
- Actual administrator configuration requires all confirmations. The caller also
  required confirmation. Both passes created zero routes, receipts or data writes.
- Query identities/descriptions were excluded from learned fitting. Existing-item
  identity context can still be visible to other live guards: this is a current
  inventory regression comparison, not a fully held-out arrival benchmark.
- Placement agreement changed from 100/107 to 101/107; placement is not ground
  truth. Neither that number nor 48 → 51 measures independently labeled accuracy.
  Real provider output can vary. The deterministic feature audit and regression
  tests establish the repair; the live comparison describes observed effects.
- The after pass waited for three discovery admission checks before starting.
  Those were successful serialization, not case-level provider failures. An
  earlier diagnostic helper needed a Set-shape correction after one discarded
  setup generation; the two complete passes account for 214 further generations.
- This exercises real retrieval, prompt preparation, parsing, freshness and live
  guards, but not the full ingress/queue lifecycle or concurrent throughput.
- The normal Compose application was not rebuilt or restarted. Revised code ran
  in a disposable, read-only benchmark container with a read-only source mount;
  that container exited and was removed. Deployment is a separate step.

Private runtime artifacts remain ignored under `.tmp/`; only content-free
aggregates are committed. No titles, descriptions, credentials or provider output
are included in these documents.

## Verification

The new canonical-shape tests first failed on the old implementation, then passed
after the repair. Movie/TV coverage includes equivalent aliases, Unicode
normalization, null/blank values, malformed/oversized values, conflicting claims,
numeric audience scores, cache reuse and SQL-backed retrieval without writes.

- Focused regression: 8 suites / 242 tests passed.
- Final full backend unit run: 1,374 suites / 40,309 tests passed.
- Full database integration after tooling update: 146 suites / 1,694 tests passed;
  one separate Compose-only test was intentionally skipped by that command.
- After the content repair, the affected database integration suite passed all
  15 tests, including two new canonical-rating tests.
- Focused new-module coverage: 100% statements, branches, functions and lines;
  two suites / 36 tests. This is not a fresh repository-wide coverage result.
- Server type checks, uncached ESLint, both Knip gates, static ESM checks, mock
  shape checks, copyright and npm-flag checks passed.
- Client production build and seven production browser route/asset checks passed.
  No client implementation or API contract changed.
- Installation audit reported zero known vulnerabilities; production-only audit
  also reported zero after retrying a transient DNS failure.
- Documentation lint, whitespace checks and staged secret scanning passed before
  commit. No coverage baseline, test waiver or CI configuration changed.

The previous main commit's workflows were green before this work. The new commit
still needs its own CI run; local results are not a substitute for that status.

## Next high-value item

Repair **studio/production-company metadata across normal ingestion and retries**.
The current learned profile uses inventory `studio`, while classification payload
parsing and existing-metadata reconstruction can drop it. Fresh TMDB enrichment
provides `production_companies`, which is not the same contract as one studio.
The inventory replay already supplies `studio`, so it cannot expose that ingress
loss by itself.

Define a bounded, provenance-aware contract shared by inventory training and the
query path. Do not silently choose the first production company or infer meaning
from a library name. Add producer-to-learner parity tests for ordinary requests and
retries, then run a fresh-arrival smoke test. Keep contradictory claims neutral
and the current routing guards intact.

This addresses another demonstrated missing feature before adding more samples,
changing confidence thresholds or building another review UI. It moves toward
library-agnostic learning with less user intervention by improving the evidence
the existing system actually receives.
