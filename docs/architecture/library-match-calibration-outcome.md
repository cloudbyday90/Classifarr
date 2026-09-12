# Automatic library match baselines: outcome

## Implemented behavior

The fresh-policy evaluator now automatically learns a match baseline for each
movie/TV library from the captured inventory. It does not ask users to describe
their libraries or change settings. It tests whether each incoming description
looks ordinary for that library, not just whether it is closer than alternatives.

Four small ESM service modules separate the numeric baseline, private corpus
validation/splitting, snapshot-scoped model cache, and aggregate reporting:

- `libraryMatchBaseline.mjs`: bounded top-three similarity and empirical ranks.
- `inventoryMatchCalibrationCorpus.mjs`: identity/representation validation,
  duplicate grouping, shared-description exclusion and deterministic splits.
- `inventoryMatchCalibration.mjs`: per-fold fitting, immutable source copies,
  cached results, cancellation and a bounded arithmetic budget.
- `inventoryMatchCalibrationReport.mjs`: before/after qualification, sparse
  coverage, movie/TV and anonymous-library counts, without private content.

Only the existing fresh-policy evaluator and report builder consume the new
modules. The preceding learned-evidence resolver remains unchanged as the paired
baseline. No routing receipt, policy-score change, model-confidence boost, live
learning write, extra inference or extra retrieval call was introduced. There is
no new singleton, dependency, migration, endpoint, UI panel or acknowledgement.

## Related preparation fix

A local attempt identified metadata and observed-trait refresh between capture
and the initial source check. Preparation had used only the captured snapshot,
yet this refresh stopped the run. The same refresh was already allowed later,
during generation, with explicit frozen-snapshot labeling.

Preparation now uses that existing rule consistently. The report records
`sourceVerified: false` and `liveMetadataRefreshed: true` when appropriate while
retaining `evaluationSnapshotValid: true`. Changes to configuration, policy,
libraries, vectors or descriptions still stop pre-generation work or invalidate
an active run. Tests cover both phases; no live routing freshness check changed.

## Recommendation and tradeoffs

Keep the split empirical baseline as a measured library-specific novelty signal,
not a live routing veto yet. This run did not demonstrate better placement
agreement: it withheld four previously agreeing proposals and retained the
single disagreement. Do not tune the cutoff against this same cohort to make
the result look better.

It is deterministic, uses existing vectors, requires no model calls and measures
each library against its own contents. The cost is bounded fitting work and more
reviews for sparse libraries or unusual minority themes. Existing misplaced
clusters can still look ordinary; a percentile is not a correctness probability.

Final stack: pinned vectors → grouped reference/calibration split → per-library
empirical match rank → full-pool description and learned-metadata agreement →
bounded AI proposal → fresh server-side authorization when live integration is
implemented. Research, protocol choices and alternatives are detailed in the
[design document](library-match-calibration-design.md).

## Completed local Compose benchmark

September 12, 2026; same 300-item regression cohort and five grouped folds used
by the preceding commit, not 300 additional items. There were 172 movies and
128 TV shows. All ten libraries participated as candidate/training libraries;
only seven had unused test items. Three libraries without test items must not
be presented as independently tested.

| Measure | Before novelty check | After novelty check |
| --- | ---: | ---: |
| Qualified proposals | 147 | 143 |
| Agreed with observed placement | 146 | 142 |
| Disagreed with observed placement | 1 | 1 |
| Movie qualifications | 83 | 82 |
| TV qualifications | 64 | 61 |
| Qualified proposals differing from policy leader | 14 | 13 |

All 248 admitted generations produced valid proposals. The unmodified resolver
reproduced the preceding run's aggregate counts exactly. The novelty filter
withheld one movie and three TV proposals, all of which agreed with their current
placements. A familiar match does not prove the destination is correct, and an
unusual match does not prove that an existing placement is wrong.

- 45 of 50 library/fold models had enough exclusive descriptions to fit; none
  was numerically degenerate. One 29-description movie library was sparse in all
  five folds. The two small TV libraries could fit, but had no test items.
- Across 1,500 item/library comparisons: 830 familiar, 498 unusual, 172 sparse.
  These are correlated candidate comparisons, not 1,500 independent test items.
- At observed destinations, 283 of 300 test items were familiar and 17 unusual.
  This 5.7% observed-placement tail is descriptive, not a correctness error rate.
- Across all AI proposals: 229 familiar, 16 unusual, three sparse. Familiarity
  alone does not satisfy the full-pool, metadata or hard-policy checks.
- The smallest fitted baseline used 25 reference and 20 calibration groups.
  Larger baselines obeyed the fixed 256-reference/128-calibration caps.
- Frozen-snapshot status: complete and valid. Metadata/observed traits refreshed
  during generation, so `sourceVerified` is false; this is not current live
  routing evidence. No policy, library, vector, description or model drift was
  reported.

The retained disagreement remains in movie test stratum 4. Aggregate evaluation
alone cannot determine whether the existing placement or the AI proposal is
wrong. The earlier run did not retain a case identity.

### Private exception diagnosis

A separate local replay selected only the 41 admitted cases in that observed
movie stratum, without supplying the placement label to scoring or AI. It
reproduced one qualified disagreement. This added 41 local inference calls for
diagnosis, separate from the 248-call paired benchmark. A further zero-generation
preflight inspected the selected case's metadata and policy contracts. No raw
case content, identities, library names or responses are committed here.

The upstream finding is more important than the novelty score:

1. The item had only two retained genre tags. Its existing library's inferred
   purpose listed five other genres, none matching those tags.
2. That purpose came from `media_server_library_profile`, was marked `inferred`,
   and its genre rule was marked `advisory`. It had no explicit hard limits.
3. Nevertheless, native-intent eligibility removed that library before RAG/AI
   comparison. Only two other destinations survived. AI could not choose the
   missing destination, and its strongest neighbors shared a broad plot theme.
4. A per-library familiarity check cannot recover a destination that candidate
   admission has already removed. The retained dispute is not evidence that the
   original library is wrong or that the proposed destination is correct.

This diagnostic used a newer frozen source snapshot and is not an additional
independent accuracy evaluation. It confirms a candidate-admission mechanism;
it does not establish an item-specific verified label.

### Reproduction and provenance

```text
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --fresh-policy-evaluation --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200,300,300 --folds 5 --generate-cases 300 --context 32768 --max-minutes 120
```

The completed invocation used a local wrapper around this existing runner to
print only allowlisted snapshot-change categories and less frequent progress.
It did not replace scoring, model responses, source checks or report building.
Wait for Compose health before invoking the diagnostic after a rebuild.

- Sample: `ca0cb510c117061372a669e58a69fca6975f1f4a50c2b5da6ff26cf9742784ba`.
- Fold assignment: `77cb7990b67c02ab7db01bb764334910af9e744d4df04ad8979aa78f98bbe7f3`.
- Source: `5a5e50af06b4fb918114edfc70ebf6945a9dad6668a2306cf31ba1de75e78c76`.
- Existing evidence/prompt preparation: `fa1a095ecb715913930cb8b2d9c99e78bff9f3b915a526e4b29d03ddd0331ecc`.
- Embeddings: `mxbai-embed-large:latest`, 1,024 dimensions,
  digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Generation: `gemma4:e4b`,
  digest `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`;
  context 32,768, temperature 0, seed 42, thinking disabled.
- 663,576 prompt tokens and 3,623 output tokens across 248 calls. Mean measured
  generation latency was 1,802.79 ms; this is not an isolated performance test
  and does not include fitting or snapshot-read time.

No additional provider calls were made for calibration: the paired filters used
the same 248 responses. The JSON aggregate remains an ignored local intermediate;
raw content and model responses are not committed.

## Verification

- Focused regression: 12 suites, 288 tests passed.
- Changed-service coverage: 100% statements, functions and lines; 98.58% branches
  across the four new modules and two changed service modules.
- Broader routing/replay/code-health check: 14 suites, 24,401 checks passed.
- Database integrations: four suites, 57 tests passed, including live description
  retrieval, policy replay, policy engine and route/outcome acceptance.
- Backend typecheck, changed-file ESLint, static-import and ESM mock-shape checks
  passed. Markdown lint and whitespace checks passed.
- All six changed service hashes match the rebuilt, healthy Compose container.
- The pre-existing production-naming gate remains blocked on 26 references
  against its zero-reference baseline. No CI gate or baseline was relaxed.

These are targeted and structural checks, not a new full-workspace coverage
sweep. No frontend/API contract changed, and the global coverage ratchet was not
claimed from targeted reports.

## Next high-value component

Fix **inferred-intent candidate admission** before enabling learned automatic
routing. Profile-derived genre lists should contribute ranking evidence, not
silently become hard exclusions. Distinguish explicit administrator hard limits
and declared intent from inferred/advisory inventory observations. Let RAG and AI
compare all active same-media libraries that pass genuine constraints.

Add regressions for incomplete genre metadata, minority themes and description
support for a library outside its top observed genres. Test candidate recall as
well as final ranking; do not solve this by adding library-name rules, changing
user policies automatically or requiring a new declaration questionnaire. Once
that upstream issue is corrected, re-evaluate the paired resolver and integrate
qualified live decisions with existing fresh server-side checks.

## Release and pull-request scope

The GitHub MCP search returned no open Classifarr PRs on September 12, 2026.
There was no eligible random PR to implement; no closed or unrelated PR was
substituted and no PR was merged. Only Unreleased is updated. No version bump,
release or release tag is created.
