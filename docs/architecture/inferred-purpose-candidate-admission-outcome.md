# Inferred-purpose candidate admission outcome

## Design and implementation

This implements the next component from the
[library-match calibration outcome](library-match-calibration-outcome.md).
The [design document](inferred-purpose-candidate-admission-design.md) records
official research, alternatives, tradeoffs and the recommendation stack.

The new pure ESM admission module recognizes the server-generated inferred
profile-purpose shape. The native evaluator separates those observations from
required purpose rules, checks real constraints first and retains zero scores
when observations do not match. In mixed contracts, observed matches cannot
compensate for an unmatched declared purpose. Unknown provenance stays on the
required-purpose path.

Filtering and ranking now preserve eligible zero-score candidates for comparison.
Observed profile absence cannot silently remove those candidates; explicit hard
limits still can. The existing description-preserving shortlist can then bring a
strong description candidate into the three-library AI comparison. The full pool
remains bounded at 64. A zero-score result remains manual even with zero policy
thresholds; admission is not positive evidence or routing authority.

No schema migration, dependency, model, threshold, policy edit, UI setting,
acknowledgement, release version or new singleton was introduced. These changes
apply to fresh live evaluations after rebuild; saved historical decisions are
not rewritten. The benchmark itself remains read-only: its
`liveRoutingChanged: false` field describes the replay's lack of routing writes,
not an assertion that the shipped admission behavior is unchanged.

## Local evaluation

The repeated cohort contains the same 300 items, not 300 additional items:
172 movies and 128 TV items, five held-out folds of 60, with all ten libraries
available for same-media comparison. Seven libraries have sampled test items;
three small libraries have no new test samples in this cohort. Held-out identities
and duplicate descriptions are excluded from learned evidence.

| Measure | Previous commit | Admission fix |
| --- | --- | --- |
| Evaluated items | 300 | 300 |
| Existing destination absent from full policy pool | 8 | 0 |
| AI comparisons / valid proposals | 248 / 248 | 255 / 255 |
| Existing destination absent from AI shortlist | 3 / 248 | 1 / 255 |
| Policy leader agrees with existing placement | 225 / 300 | 228 / 300 |
| AI proposal agrees with existing placement | 225 / 248 | 231 / 255 |
| Learned-review qualification, before novelty check | 147 | 129 |
| Placement disagreements among those qualifications | 1 | 0 |
| Qualification after per-library novelty check | 143 | 126 |
| Placement disagreements after novelty check | 1 | 0 |
| Existing strict-consensus qualifications | 2 | 2 |

The wider pool removes eight admission misses. It also exposes competing
description evidence, so the selective resolver qualifies fewer cases instead
of treating separation in an incomplete pool as sufficient. Its 126 remaining
qualifications comprise 76 movies and 50 TV items. All agree with existing
placements, but those placements are weak labels, not independently verified
ground truth. In particular, the overall AI agreement rate did not improve:
225/248 is about 90.73%, while 231/255 is about 90.59%, with different admitted
subsets. This is a candidate-coverage fix, not a claim of better measured accuracy.

The unchanged novelty check withholds three otherwise qualified cases (one movie,
two TV). It was not tuned to this replay. There are still 24 AI proposals that
differ from existing placements, one movie shortlist miss, 24 abstain-mode cases,
16 verify-mode cases and five existing policy-auto decisions. The replay invokes
only adjudication and routes nothing; these other modes were not AI-tested.

### Reproducibility and freshness

The before/after runs have identical starting source, sample, evidence and fold
fingerprints, as well as embedding and generation model digests:

- Source: `5a5e50af06b4fb918114edfc70ebf6945a9dad6668a2306cf31ba1de75e78c76`
- Sample: `ca0cb510c117061372a669e58a69fca6975f1f4a50c2b5da6ff26cf9742784ba`
- Evidence: `fa1a095ecb715913930cb8b2d9c99e78bff9f3b915a526e4b29d03ddd0331ecc`
- Folds: `77cb7990b67c02ab7db01bb764334910af9e744d4df04ad8979aa78f98bbe7f3`
- Embedding: `mxbai-embed-large:latest`, 1,024 dimensions;
  digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Generation: `gemma4:e4b`;
  digest `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`;
  context 32,768, temperature zero, seed 42, thinking disabled.

The completed replay reports `evaluationSnapshotValid: true` and
`sourceVerified: false`: background metadata/observed-trait refreshes occurred
after the frozen starting snapshot. No policy, configuration, library, vector,
description or model drift invalidated the evaluation. The input snapshot is
valid for comparison but is not claimed to be the latest live state.

There were 255 generation calls, 713,801 prompt tokens and 3,762 output tokens.
Mean generation latency was 1,476.58 ms; this excludes fitting and snapshot reads
and is not an isolated performance benchmark. The aggregate JSON stays in
ignored `.tmp/inferred-purpose-benchmark-completed.json`; no private inventory,
prompts, responses or evaluation rows are committed.

Reproduce using the existing CLI from a healthy local Compose:

```sh
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false classifarr \
  node src/scripts/runInventoryDescriptionBenchmark.mjs --fresh-policy-evaluation \
  --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200,300,300 \
  --folds 5 --generate-cases 300 --context 32768 --max-minutes 120
```

The local run used an ignored wrapper around that CLI to print only changed
snapshot categories during refresh. It did not change prompts or candidate
selection. A final zero-threshold guard was added during the run; the final-build
preflight and isolated regression case are checked separately below.

### Final-build regression case

After the final rebuild, another read-only preparation of all 300 items retained
the same source/sample fingerprints, 255 ready cases, zero pool misses and one
shortlist miss. No item had a zero-score leader, so the added zero-threshold guard
does not affect this cohort's benchmark decisions.

The previously diagnosed excluded movie destination is now present in a
five-library policy pool and in the protected AI shortlist. One additional local
generation proposes its existing destination. The learned-review resolver still
retains review because the description neighbors disagree; no automatic routing
is claimed or performed. This verifies that the original admission failure is
fixed without hiding the remaining uncertainty. The isolated check is not added
to the 255-call benchmark denominators.

## Verification

- Final policy regression with targeted coverage: 116 suites / 793 tests passed.
- Seven affected services: 98.31% statements/lines, 90.57% branches and 100%
  functions. The new admission module and inventory evidence service have 100%
  coverage in all categories. Reports are isolated under
  `.tmp/coverage-inferred-purpose`, not substituted for global coverage reports.
- Database integration: four suites / 57 tests passed, covering policy replay,
  policy evaluation, live description retrieval and route/outcome acceptance.
- Routing/code-health regression: 26 suites / 24,284 checks passed on the final
  worktree. Markdown lint and whitespace checks passed.
- New synthetic tests cover missing and non-top genres, arbitrary library names,
  movie/TV scope, mixed and explicit rules, invalid authority, hard-limit failure
  and missing metadata, zero-score comparison, retrieval opt-out, and a
  description-supported candidate entering the bounded AI shortlist.
- Backend typecheck, final changed-file ESLint, static-import and ESM mock-shape
  checks passed. All seven affected service hashes match healthy rebuilt Compose.
- The existing production-naming gate still reports 26 references against its
  zero-reference baseline. This patch did not increase the count or relax the
  gate. These results do not claim a fully green CI or global coverage ratchet.

## Recommendation and next component

Keep explicit boundaries ahead of retrieval, but use learned library contents
to compare destinations rather than asking users to declare every library's
purpose. Admission and confidence are different questions.

After reviewing this replay, the next component should connect qualified
description/metadata/AI agreement to the existing fresh routing checks for
ordinary soft-evidence reviews. Keep explicit constraints and ambiguous cases
out of that automatic path. Do not increase a policy score merely to cross its
threshold or treat previous automatic placements as independent training truth.

## PR and release scope

GitHub MCP returned no open Classifarr PRs on 12 September 2026, so no random PR
could be selected. No unrelated or closed PR was substituted, and no PR was
merged. Only Unreleased is updated; no version bump, release or release tag.
