# Selective neighbor fallback: outcome

## Outcome

The selective fallback identified **11 additional familiarity-qualified review
candidates** in the existing 300-item movie/TV regression cohort. All 11 matched
existing placement. This is evidence of potential review reduction, not verified
accuracy or a change to live routing.

The [design](selective-neighbor-fallback-design.md) records the fixed protocol,
September-verified official sources, security boundaries and pros/cons. No policy
score was inflated, no user acknowledgement was added, and no restriction was
removed to obtain this result.

## Reconciliation and implementation

Commit `8ed6c4cf` established that cross-fitting makes calibration available in
small libraries, but a wholesale replacement would discard 76 strict-supported
proposals. This change preserves the strict rule and evaluates potential gains
only. The original seven-arm neighbor report was **exactly unchanged** after
extracting its label-free full-corpus proposal helper.

- `inventoryNeighborProposal.mjs` shares the full-corpus description proposal,
  top-three strict comparison and shared-description veto between experiments.
- `inventoryNeighborFallback.mjs` assesses the unchanged strict rule first. Only
  `neighbors_disagree` may continue, with candidate-bound cross-fit support,
  full-pool agreement and the same positive, uniquely leading metadata predicate.
- The existing comparison service owns the extracted metadata predicate, avoiding
  a second implementation of the production rule.
- `--neighbor-fallback` extends the existing fresh-policy evaluator. It requires
  exclusive fresh mode and grouped folds, filters targets before the generation
  cap, and shares one parsed response between both assessments.
- A separate report service emits aggregate selection, disagreement, review and
  familiarity counts for the whole cohort, media types and anonymous libraries.

There are no new dependencies, database migrations, API contracts, UI components,
settings, singleton services or live routing integrations. Calibration input is
private snapshot-owned evaluation data, not a public receipt or routing token.

## Local Compose measurement: 13 September 2026

The rebuilt service used the same **300 items, 150 movies and 150 TV shows, ten
libraries and five folds**. This is the existing regression cohort, not 300 new
items or an untouched final test set.

| Stage | Movies | TV shows | Total |
| --- | ---: | ---: | ---: |
| Original strict-neighbor support | 91 | 78 | 169 |
| Additional calibrated neighbor candidates | 10 | 17 | 27 |
| Admitted for fresh AI comparison | 10 | 12 | 22 |
| Additional AI/metadata review agreement | 6 | 8 | 14 |
| Also passes existing familiarity check | 4 | 7 | 11 |

All 22 generated cases initially returned `neighbors_disagree` from the unchanged
strict review resolver. The fallback retained four cases because AI proposed a
different destination, and four because learned metadata did not uniquely support
the candidate. Of the 14 remaining cases, three did not pass familiarity.

The five other selected TV cases did not enter adjudication mode; the experiment
did not force an AI call or overwrite their deterministic handling. Their absence
from this comparison is neither success nor failure of the fallback.

The 14 additional review agreements and 11 familiarity-qualified candidates all
matched existing placement. One of the original 27 description proposals disagreed
with placement; it did not become a qualified gain. A placement disagreement does
not itself prove an error, and an agreement does not prove correctness.

Strict-success preservation is enforced structurally and tested directly. The
169 strict-supported cases were not regenerated, so the zero strict losses among
the 22 evaluated targets must not be presented as a new 300-case AI validation.

## Cost, identity and freshness

- Seed: `classifarr-profile-20260912`.
- Sample fingerprint: `ed0ba4c466ffafd78edb483d8c3b5d23296aa4a9ae17f8e097c7c13868b30528`.
- Fresh source fingerprint: `5a5e50af06b4fb918114edfc70ebf6945a9dad6668a2306cf31ba1de75e78c76`.
- Evidence fingerprint: `ec820ae5d539368d567fb4ffb2af5ac623b48f44a64b57f3862f1ad5bfc4b3ce`.
- Embeddings: `mxbai-embed-large:latest`, 1,024 dimensions, pinned digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Generation: local `gemma4:e4b`, pinned digest
  `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`;
  32,768-token context, temperature 0, seed 42, thinking disabled.
- **22 actual generation calls**, 61,639 prompt tokens, 334 output tokens;
  mean measured generation latency 1,030.68 ms.
- Complete evaluation took **45,924 ms**, including preparation and verification.
  No heavy test or build ran concurrently. This is one local measurement, not a
  performance guarantee or an inference-repeatability study.

The zero-generation preflight took 23,068 ms and identified the same 27 targets
and 22 admitted cases. It reported background metadata refresh honestly. The
subsequent generation run completed with `sourceVerified=true`,
`evaluationSnapshotValid=true` and no changed source components.

Database access was read-only; embedding generation, routing receipts, questions,
learning writes and route changes were all zero. Local Compose remained healthy
with a read-only root filesystem. Its working-tree build has `VCS_REF=unknown`,
not release provenance.

## Verification

- Focused coverage: **17 suites and 256 tests passed**, with **100% lines and 99%
  branches** across seven affected services.
- PostgreSQL integration selection: **6 suites and 29 tests passed**.
- Broader policy/routing/code-health selection: **608 suites and 28,498 tests passed**.
- Changed-file ESLint, the configured backend typecheck, static-import and service
  ESM mock-shape checks passed. All ten changed production files matched their
  deployed Compose hashes. Markdown lint and whitespace checks passed.
- Tests cover strict parity, candidate and calibration scope, metadata conflict,
  sparse and missing evidence, operator restrictions, local provider authority,
  target-before-cap selection, one response for both assessments, zero-generation
  preflight, cancellation, source drift, privacy and no routing authority.
- The unchanged full neighbor benchmark reproduced the preceding report exactly.
- The production naming gate still reports **26 pre-existing production references**
  against its zero baseline. It was not weakened; a fully green CI claim would be
  incorrect. Scoped coverage does not replace the repository-wide coverage ratchet.
- Frontend code is unchanged; no new client test result is claimed. The configured
  server typecheck is not comprehensive static typing of every JavaScript service.

## Reproduction

From the repository root with the configured local Compose service:

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --fresh-policy-evaluation --neighbor-fallback --generate-cases 27 --max-minutes 20
```

Omit `--generate-cases 27` for a zero-generation preflight. The cap applies to
selected, adjudication-ready cases, not the first 27 cohort rows. Raw source data,
prompts, vectors and individual identities are never exported in the public
report. Local aggregate artifacts remain ignored in `.tmp/`.

## Recommendation and next high-value component

Keep strict matching first and use calibrated fallback only for neighbor overlap.
Its benefit is 11 measured potential gains without discarding strict successes;
its cost is additional snapshot-scoped fitting, and the gains remain weakly
labeled. Reject both a wholesale strict-rule replacement and relaxed metadata or
familiarity requirements.

**Next: shadow this fallback inside the existing live learned-evidence service.**
Reuse the already-admitted AI proposal, automatically refreshed evidence and
bounded calibration cache. Measure whether these candidates also pass current
identity, administrative confirmation and fresh receipt checks, without adding
an AI call, settings panel or operator task. Those checks are not evaluated by
this offline report and must not be assumed satisfied. Promote only after the
shadow results and contradiction checks support it; never treat an empirical
rank as a calibrated probability or routing permission.

## PR and release

The follow-up [live shadow outcome](live-neighbor-shadow-outcome.md) now documents
the selective live integration and current Compose verification. It does not
promote these offline gains into automatic routing. In particular, the current
administrative confirmation setting still blocks live preparation; separating
background evaluation from final routing approval is the next component.

GitHub MCP returned no open Classifarr PRs on 13 September 2026. No random PR was
available to implement, and none was substituted or merged. The changelog was
updated under Unreleased. No version bump, tag or release was created.
