# Deterministic inventory content ranker — outcome

## Decision

Implemented the [design](linear-inventory-ranker-design.md) as a bounded,
read-only ESM benchmark. **Do not promote the linear ranker into live routing.**
Both final 300-item runs passed source/model verification, with zero generation
calls and no sampling shortfall. The existing organic metadata profile outperformed
the new model in both cohorts. These are observational placement agreements, not
verified accuracy or calibrated confidence.

No policies, routing thresholds, user acknowledgements, media placements, model
settings, version numbers or releases changed. Training uses library contents and
anonymous class IDs, not library names or hard-coded genres.

## Implemented boundaries

- An opt-in, parameterized provenance query in the existing repeatable-read,
  read-only repository snapshot. Default consumers retain their existing behavior.
- Whole-description grouping across identities/media types; held copies, shared
  destinations, conflicting metadata and retained decisions are excluded. Sparse
  classes are reported, not padded with guessed labels.
- A class-balanced, regularized, full-batch linear softmax learner, fixed numeric
  worker, bounded cancellation and guaranteed worker termination before admission
  is released. Numeric vectors only enter the worker; no text or configuration.
- Nearest-description and existing organic-metadata baselines on exactly the same
  admitted population, plus a separate deterministic 10% label-noise stress arm.
- Aggregate-only results, source/model revalidation, explicit incomplete-training
  failures, and existing shared memory/lock admission. No learned model persists.

Modules separate provenance, source preparation, mathematics, worker ownership,
comparison metrics and orchestration. The existing CLI gains `--linear-ranker`,
which requires exclusive grouped folds and zero generation.

## Provenance discovery and correction

An initial blanket exclusion of every classification-history match left no
training data. Code and a read-only database audit showed why: sync inserts
`source_library` observations into the same table as classifier decisions. The
audit found 6,714 source-observation rows covering 6,677 identities, versus 77
decision rows covering five identities. Only 13 source rows had the newer explicit
non-classifier capture; 6,701 were legacy observations.

The final predicate distinguishes those observations from decisions using the
actual writer contract. It excludes non-source/unknown methods, malformed or
nonmatching captures, and `Resolved via library placement` reconciliation rows.
Any other retained decision for the identity still excludes the whole description
group. Real PostgreSQL tests cover legacy observations, exact captures, nulls,
reconciliations and mixed histories.

This does **not** certify legacy observations as independently correct. Missing or
expired decisions may conceal prior automated placements; `provenanceComplete`
remains false, independent labels remain zero, and accuracy remains unknown.

## Local Compose results

Measured September 19, 2026 local time (September 20 UTC), using the existing
`mxbai-embed-large:latest` cache, 1,024 dimensions. The snapshot contained 6,655
eligible identities, 6,652 distinct description vectors and ten active libraries.
Every evaluated fold trained five movie classes and five TV classes. Across both
media, 6,587–6,588 distinct descriptions were admitted per fold after exclusions.

The exploratory cohort excludes the earlier 1,700 descriptions; the next cohort
excludes those plus the exploratory 300. Settings were frozen between cohorts:
80 epochs, learning rate 0.5, L2 0.01, five grouped folds. Prior cohort items may be
training observations, but all copies of the current held fold are excluded.

| Arm | Exploratory 300 | Next disjoint 300 | Combined 600 |
| --- | ---: | ---: | ---: |
| Nearest description | 240 | 240 | 480 |
| Existing organic metadata profile | **269** | **251** | **520** |
| New linear content ranker | 229 | 235 | 464 |
| Linear ranker with synthetic label noise | 223 | 224 | 447 |

Counts are top-ranked destinations matching an existing library placement.
Every arm selected a destination for every sampled item: these are ranking tests,
not evidence that automatic routing is safe. Numerical tie abstention is tested
synthetically; novel/out-of-distribution rejection is not established here.

| Cohort/media | Items | Nearest | Metadata | Linear | Noisy linear |
| --- | ---: | ---: | ---: | ---: | ---: |
| Exploratory movies | 172 | 140 | 146 | 139 | 134 |
| Exploratory TV | 128 | 100 | 123 | 90 | 89 |
| Next movies | 207 | 167 | 167 | 157 | 155 |
| Next TV | 93 | 73 | 84 | 78 | 69 |

All ten libraries contribute training data, but three have no remaining held-out
items after earlier cohorts. The next cohort has only seven items in one TV
stratum. Do not describe this as equally balanced evaluation of all ten libraries.
The reports retain every anonymous stratum, including zero-count entries.

Label perturbation changed 48/300 exploratory and 42/300 next-cohort decisions.
Each fit changes `floor(class size / 10)` labels within its media domain, so the
actual fraction is slightly below 10%. It is a synthetic stress test, not a
measurement of real contamination or resistance to all poisoning attacks.

Clean-plus-noisy fitting across all folds took 97,113 ms and 93,803 ms respectively.
Process high-water RSS was 451,972 KiB and 514,924 KiB. These local measurements are
not a latency guarantee or a directly comparable timing of earlier generative
experiments. Initial balanced loss was about 1.609; final clean loss was
1.281–1.338, with gradient norms still 0.057–0.059. The fixed budget completed; it
does not establish optimizer convergence or optimal hyperparameters.

### Invalidated attempts and recovery

Earlier attempts were correctly invalidated when metadata changed during fitting.
A private diagnostic identified content-rating changes on three and four eligible
items, without emitting identities, titles or rating values. Descriptions/vectors
did not change. The metadata later settled; both final runs independently verified
the same source digests. No verification condition was removed, no background
backfill was disabled and no score-based parameter tuning occurred.

Admission also returned `busy` and `memory_pressure` during earlier attempts. A
fresh local Compose instance and subsequent retries used the unchanged limits.
The final comparison container recorded no memory-limit hits or OOM kills. This
is evidence of tested deferral and recovery, not a claim that every provider or
data failure self-heals without intervention.

### Reproduction and source stamps

Run inside local Compose with a complete exact-model vector cache and shared
discovery admission available:

```sh
node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --seed classifarr-profile-20260912 --size 300 --folds 5 \
  --linear-ranker --max-minutes 30 \
  --exclude-prior-sizes 300,300,100,100,300,300,300
```

Append one `,300` to the prior-size list for the next cohort. The measurements used
`PGOPTIONS=-c default_transaction_read_only=on` as an additional write safeguard.
The normal CLI also owns read-only snapshots. No raw corpus exports are committed.

| Stamp | SHA-256 |
| --- | --- |
| Exploratory sample | `ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c` |
| Next sample | `bcb5be448f92e2c2d0f10c2e98f897d6df02940ff92d7ed126ae1cb18e422f74` |
| Embedding model | `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8` |
| Documents | `d899a0adbe16bc417caac57006d6e64fb4a8c066a0d7e8028b0f06b29c5d56e8` |
| Libraries | `e6be67a94a8f3b551ead05a24d223cd7b19e7431694f538b4407e1cc17d4c084` |
| Vectors | `49fe5be63dac7f7a49cc94a46fe046f7f4294f5d4eb62072f8274586778eb5b9` |
| Descriptions | `07ce8396dd836cb1b66f4f752015d18060a4712a5b5f85368212b432e64d480d` |
| Metadata | `e7318fca2dc140d675753cb475a727ea7913b8ee2bdb8566200f49c966ea92bd` |
| Training exclusions | `0a06355a860e2da958b20df5144a986666fbb062c698df9811a4d4ae37e1afeb` |

## Validation and PR status

Focused tests cover analytical gradients against finite differences, class
imbalance, repeatability, class/row ordering, ties, malformed vectors, work bounds,
real worker cancellation, whole-description leakage, provenance and source drift.
The initial focused run passed 99 tests across seven suites. PostgreSQL tests
exercise the actual provenance predicate, not a mocked interpretation of SQL.

Final verification:

- Full backend coverage run: **1,334 suites / 38,824 tests passed**, 422.676 seconds.
- Targeted PostgreSQL integration: **three suites / 24 tests passed**.
- Lint, server/client type checks, copyright/dependency preflight, static ESM
  imports, ESM mock-shape checks and Markdown lint (1,380 files) passed.
- Coverage ratchet passed: backend 90.26% lines / 83.27% branches. All six new
  non-thread services have 100% line coverage; the worker entry point is exercised
  by real worker tests but not included in Jest's parent-process coverage capture.
- Client source is unchanged. Its existing coverage report was reused for the
  ratchet (87.67% lines / 77.54% branches); the full frontend suite was not rerun.
- The production-naming gate still fails on **43 pre-existing references**, with
  no added references, waiver or baseline adjustment. This is not an all-gates-green
  claim.

The previous commit's CI was green. GitHub's open-PR collection returned an empty
list at the start, during work and before commit: no random open PR existed to
implement, and no PR was merged. The changes are recorded under Unreleased with
no release or version bump.

## Final recommendation stack and next high-value item

1. Keep the linear experiment available for reproducible evaluation, not live
   adoption. It was deterministic but weaker overall and sensitive to label noise.
2. Preserve the existing organic metadata profiles and raw description retrieval.
   They are complementary observations, **not independent votes** when both derive
   from the same library inventory. Metadata wins overall, while some anonymous
   strata favor description-based learning; do not replace one globally with the
   other based only on aggregate counts.
3. **Next: evaluate a content-supported provisional-leader challenge.** The current
   `rankLearnedCandidateShortlist` returns the original order for pools of at most
   three libraries; for larger pools it only reranks alternatives and pins the
   policy leader. Test whether the existing learned metadata and raw content
   evidence can challenge that provisional leader, including two/three-candidate
   cases, without changing hard eligibility or routing authorization.
4. Carry the provenance protections into that comparison, preserve self/duplicate
   exclusions and the raw-description candidate, and measure gained/lost outcomes,
   disagreement, missing evidence and truly unknown content. No new generative
   model or library-purpose questionnaire is needed to test this decision path.
5. Any validated live integration should reuse source-stamped background refresh,
   SWR last-known-good results, bounded retries, cancellation and rollback. It must
   not manufacture calibrated confidence from rank scores or add a dense UI panel.

This next item targets how available library understanding reaches the actual
candidate decision, rather than introducing another model with weaker results.
The source-backed design rationale, trade-offs and W3C considerations are in the
separate [design document](linear-inventory-ranker-design.md).
