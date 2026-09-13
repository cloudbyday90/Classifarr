# Library-calibrated neighbor comparison: outcome

## Decision and implementation

The weakest-example veto merits further work, but these results do not justify
replacing it with a mean-only rule. Keep live routing unchanged. The next component
is **sample-efficient calibration for small libraries**, not another settings
screen or a request for users to describe their libraries.

Added `--neighbor-calibration` to the existing inventory-description benchmark.
Four modular ESM services separate numeric fitting, snapshot ownership, experiment
orchestration and aggregate reporting. They reuse validated corpus/vector reads,
typed identities, deterministic sampling and grouped folds. No new dependency,
migration, HTTP endpoint, live resolver import, scheduler, setting or UI is added.

The previous commit `322e2a27` optimized synopsis-query work without changing
classification outcomes. This follow-up evaluates its documented next hypothesis;
it does not undo the query optimization. Research, alternatives, pros/cons and the
recommended stack are in the separate [design document](neighbor-margin-comparison-design.md).

## Local Compose experiment

On 12 September 2026 local time, the rebuilt healthy Compose service evaluated
**300 existing items: 150 movies and 150 TV shows across all ten libraries**.
The five description-group folds contained 60 cases each. Every library contributed
test cases and retained training examples in every fold. The smallest movie library
contributed 29 test descriptions; other strata contributed 30 or 31 memberships.
Multi-library membership means per-library counts need not sum to unique items.

This deliberately reuses the original deterministic sampling sequence for balanced
regression coverage. It is not another 300 newly discovered items, an independent
label collection, or a claim of no overlap with earlier experiments. The report's
`previousSampleOverlap: 0` refers only to explicit exclusion cohorts; none were
specified for this run.

- Seed: `classifarr-profile-20260912`; size 300; five folds.
- Sample fingerprint: `ed0ba4c466ffafd78edb483d8c3b5d23296aa4a9ae17f8e097c7c13868b30528`.
- Embeddings: local `mxbai-embed-large:latest`, 1,024 dimensions, pinned digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Two consecutive runs produced **identical complete aggregate reports** in
  8,004 ms and 6,904 ms. These are local end-to-end observations, not throughput
  guarantees. No heavy test/build process ran during either measurement.
- Zero generation calls, embedding-generation calls, routes, learned-state writes
  or user questions. Database writes were additionally prohibited with
  `PGOPTIONS=-c default_transaction_read_only=on`.

All five deployed production-file hashes matched the workspace. The local image
was built from the working tree and honestly retains `VCS_REF=unknown`; this is
not release or maintenance-provenance evidence. Its root filesystem remained
read-only. Stored routing/confirmation preferences were not changed.

## Results

The same unique full-corpus description-mean proposal was used in every arm for
each case. These counts isolate neighbor support; they do not apply the remaining
AI, metadata, policy, familiarity and fresh-authority requirements for live routing.

| Neighbor check | Available cases | Supported proposals | Supported placement agreement | Supported placement disagreement |
| --- | ---: | ---: | ---: | ---: |
| Full-corpus strict veto | 300 | 169 | 146 | 23 |
| Bounded-reference strict veto | 210 | 89 | 84 | 5 |
| Same-reference top-three mean | 210 | 162 | 132 | 30 |
| Empirical calibrated margin | 0 | 0 | 0 | 0 |

On the **same 210 available cases**, replacing strict separation with a mean added
73 supported proposals: **48 agreed with existing placement and 25 disagreed**.
There were no losses for that paired comparison. Movies contributed 18 gains
(10 agreements, 8 disagreements); TV contributed 55 (38 agreements, 17
disagreements). Existing placement can itself be wrong: these are neither 48
verified fixes nor 25 proven errors.

Reference sampling also changed outcomes independently of the rule. Comparing
full-corpus strict with bounded-reference strict on those same 210 cases gained
23 and lost 49 supported proposals. Therefore comparing their raw overall counts
would confound sampling with the veto change.

## Why calibration had no available cases

The fixed protocol requires 20 exclusive reference descriptions and 20 separate
calibration descriptions per same-media library, after test/copy exclusions.
All rivals remain in scope; a sparse library cannot silently be removed.

- The smallest movie stratum had 29 inventory descriptions. After fold exclusion,
  shared-group removal and allocating 20 calibration descriptions, only **2–3
  reference descriptions** remained. Three folds therefore also lacked the three
  references required for the strict/mean diagnostic arms, excluding 90 movie cases.
- The smallest TV stratum had 45 inventory descriptions, with 39 remaining in
  each fold. Its split left **19 references and 20 calibration descriptions**:
  one reference below the fixed calibration minimum.
- Consequently both complete same-media pools were sparse in every fold. The
  empirical threshold was not fitted on this real corpus. Synthetic tests cover
  its positive, negative, overlapping, degenerate and sparse behavior.

Zero calibrated support is thus **missing calibration coverage**, not evidence
that all 300 proposed destinations are wrong or that the margin method is safe.
Do not lower a threshold after seeing this cohort or ask the operator to pad a
small library solely to satisfy an evaluation split.

## Reproduction and verification

From the repository root, using the configured local Compose service:

```powershell
docker exec -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --neighbor-calibration --max-minutes 5
```

The CLI rejects mixed modes, missing folds and nonzero `--generate-cases` before
loading runtime. Partial/interrupted runs cannot be treated as complete. Counts
are anonymized; individual titles, descriptions, IDs, vectors and errors remain
out of public output. Private repeat/coverage artifacts remain ignored in `.tmp/`.

- Focused coverage: **6 suites, 64 tests passed**; four new services achieved
  **100% lines and 97.1% branches**. This is scoped coverage, not the global ratchet.
- Broader policy/routing/code-health selection: **603 suites, 28,351 tests passed**.
  The final memory-bound adjustment was additionally covered by the focused run.
- Real PostgreSQL integration selection: **6 suites, 29 tests passed**, covering
  corpus projection, fresh retrieval, refresh/cache behavior and routing recovery.
- Backend's configured typecheck scope, changed-file ESLint, static imports,
  service ESM mock shapes, Markdown lint and whitespace checks passed.
- Frontend source is unchanged; Compose reused the frontend build layer. No new
  client test result or complete CI/coverage-ratchet success is claimed.
- The naming gate still fails on **26 pre-existing production references** against
  its zero-reference baseline. No gate was relaxed.

## Recommendation stack and next item

Keep PostgreSQL/pgvector, pinned local embeddings, library-name-independent
description evidence, held-out grouping, bounded ESM computation and fresh live
authorization. Retain the strict live veto while improving calibration coverage.
The mean-only alternative is cheaper and admits more matches, but the observed
disagreements show why it cannot be promoted merely to reduce review counts.

**Next: group-excluded cross-fitted calibration for sparse libraries.** Evaluate
each training description against references that exclude that description and
all its copies, while keeping the entire test fold excluded throughout. Reuse
eligible training descriptions across separate fits instead of permanently
dividing a small library into two inadequate halves. Bound the added computation,
compare against this frozen baseline, and continue reporting coverage and weak-label
limitations explicitly. Cross-fitting is a new protocol, not permission to claim
a correctness probability or automatic routing authority.

This addresses the measured small-library blocker organically, using the items
and metadata already present. Independent contradiction checks and quality evidence
still matter before any live promotion; more acknowledgements or per-library
declaration forms are not required for this next component.

The follow-up is now implemented and measured in
[cross-fitted neighbor calibration outcome](cross-fitted-neighbor-calibration-outcome.md).
That comparison preserves this original protocol as its regression baseline.

## PR and release status

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr` in both checks on
12 September 2026 local time. There was no eligible random PR to implement; none
was substituted or merged. Changes are recorded under Unreleased only, with no
version bump, release tag or release creation.
