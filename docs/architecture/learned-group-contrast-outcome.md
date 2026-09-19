# Learned content-group contrast: outcome

Date: 2026-09-19. Implements the experiment in the
[design](learned-group-contrast-design.md), following commit `77f31a50`.

## Decision

**Do not promote term contrast to live routing.** It recovered zero additional
cases over the existing combined baseline in 900 source-verified evaluations.
This is a negative experiment result, not an improvement in classification accuracy.
The implementation remains an explicit read-only diagnostic mode, not another
background task, setting, acknowledgement or review screen.

The previous commit added nearest-example and metadata checks. Its remaining 101
overlaps motivated training recurring, distinctive synopsis terms for each learned
group. New ESM modules isolate fitting from evidence resolution; the existing local
resolver shares its unchanged consistency checks with the experiment. No fixed
library categories, library-name rules or hand-authored media-title exceptions were added.

## Verified local Compose results

Each cohort uses five copy-grouped folds, training-only fitting, full candidate
scope, cached vectors, zero generation and source/model revalidation after the run.
An initial run was invalidated by concurrent metadata changes and discarded; its
replacement completed with `sourceVerified: true`, as did the other two cohorts.

| Cohort | Method | Compared | Placement agreements | Placement disagreements | Abstained |
| --- | --- | ---: | ---: | ---: | ---: |
| Original 300 | Independent starts | 222 | 196 | 26 | 78 |
| Original 300 | Previous combined / enhanced | 225 | 199 | 26 | 75 |
| Additional 300 | Independent starts | 218 | 197 | 21 | 82 |
| Additional 300 | Previous combined / enhanced | 221 | 200 | 21 | 79 |
| Fresh 300 | Independent starts | 229 | 208 | 21 | 71 |
| Fresh 300 | Previous combined / enhanced | 230 | 209 | 21 | 70 |

Across 900: previous combined and enhanced each compared 676 items, with 608
placement agreements, 68 disagreements and 224 abstentions. The earlier six local
recoveries remain intact; the fresh cohort adds one local recovery, not a term-model
recovery. Stable decisions and non-overlap failures are preserved by construction.
The standalone term arm selected only two original-cohort cases and none in the
other cohorts; both were already resolved by the existing combined baseline.

The original cohort covers all ten libraries (150 movies / 150 TV descriptions).
The additional and fresh cohorts each cover seven libraries with unseen descriptions
(172 movie / 128 TV); three small libraries had exhausted eligible unseen descriptions.
All ten remain in candidate/training scope. We did not duplicate small-library items
to claim new coverage. Reports retain anonymous library, media, nearest-example and
support-range slices; no titles, IDs, descriptions, learned terms or vectors are committed.

These are historical-placement comparisons, **not verified accuracy**. There are
zero independent labels; accuracy remains null. Related stories can share semantics
despite exact-copy exclusion. Source revalidation proves within-run consistency,
not equality with an earlier historical database snapshot. The fresh query cohort
was not previously evaluated, but its surrounding training corpus is not untouched.

## Why there was no gain

The old combined arm leaves 49, 52 and 45 nearest-example overlaps respectively.
Of these 146 cases, 142 stop at `group_incomplete_terms`: at least one same-media
competing group has no supported discriminative vocabulary. Three lack a distinct
term winner and one disagrees with nearest-example group membership. Missing terms
are not evidence against a competing library, so the resolver does not silently
remove that candidate. Counts do not distinguish sparse groups from common wording,
language/tokenization limitations or inherently overlapping content.

This is the current model's limiting condition; it does **not** establish that
library metadata is malformed or that the safety requirement alone is wrong. The
fixed three-description support, document-frequency filter and rival comparison
were not relaxed after inspecting results. Lexical frequency is not semantic proof.

## Recommendation stack and next component

| Choice | Benefit | Cost / recommendation |
| --- | --- | --- |
| Keep the offline learner | Reproducible negative result, reusable bounded fitting | No observed routing gain; retain diagnostic-only |
| Loosen support or ignore empty rivals | More decisions appear possible | Unmeasured error risk and incomplete comparison; reject |
| Group evidence readiness with targeted enrichment | Separates missing data from truly overlapping content; reuses automatic recovery | Needs coverage diagnostics and provider budget controls; next component |
| Semantic contrast between competing groups | Can represent shared wording and synonyms beyond terms | Requires a separately frozen evaluation; follow readiness diagnosis |

**Next high-value item: group-level evidence readiness and targeted enrichment.**
Extend the existing automatic backfill selector with counts that distinguish absent
descriptions/metadata, too few distinct examples, and complete-but-indistinguishable
groups. Reuse current validated memberships, checkpoints, provider cooldowns and
fair scheduling. Re-fetch only missing/stale source metadata; do not repeatedly
generate descriptions for already complete but semantically overlapping groups.
For those groups, test semantic contrast rather than another vocabulary threshold.
Keep the UI to one automatically refreshed summary with expandable exceptions.
Do not ask users to declare every library or treat prior placements as truth.

Final stack: validated inventory → automatic targeted enrichment → learned groups
and existing vector retrieval → complete rival comparison → paired evaluation →
existing routing authorization. Training-only fitting, bounded private diagnostics
and accessible quiet status follow the official sources linked in the design.

## Validation and reproduction

- Backend: 1,303 suites / 37,876 tests passed with full coverage.
- Final focused profile/evidence/benchmark checks: 4 suites / 46 tests passed;
  focused services reached 100% statements, lines and functions, 98.11% branches.
- Real PostgreSQL recovery/backfill integration: 2 suites / 13 tests passed.
- Source-drift invalidation, zero generation, exclusive CLI modes, copy exclusion,
  Unicode, resource ceilings, cancellation, metadata guards and unchanged baseline
  arms are tested. Coverage thresholds were not lowered.
- Client tooling and browser verification are recorded separately in
  [PR 532 validation](pr-532-client-tooling-validation.md).

Run inside the healthy local Compose service:

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --group-contrast --max-minutes 15
```

For the additional cohort add `--exclude-prior-sizes 300,300,100,100`; for fresh add
`--exclude-prior-sizes 300,300,100,100,300`. Fingerprint prefixes are `7f40e9ebf6f3`,
`58ec647b494f` and `d8d72ac31cb2`. Private outputs stay in ignored `.tmp/`.
The command rejects generation/mixed experiment modes and never publishes profiles,
changes policies or routes media. Normal application workers remain active.

Rollback is a new revert commit of the diagnostic modules/CLI wiring; no schema or
data rollback is needed. No release, tag or product-version change is included.
