# Candidate-local evidence: outcome

Date: 2026-09-19. Implements the next component from the
[independent-start evaluation](independent-candidate-stability-outcome.md).
The [separate design](candidate-local-evidence-design.md) records the fixed rule,
official sources, alternatives and tradeoffs.

## Decision

Keep the resolver offline for now. It supplies additional evidence for **6 of 160
ambiguous comparisons**, while the combined rule preserves all 440 stable baseline
choices. This is a limited improvement in diagnostic coverage, not proven accuracy
or a reduction in live user review. It is not a general replacement for the current
matcher, and the thresholds were not retuned after these results.

Two small ESM services index fold-local examples and apply separate description,
group-membership, metadata and correlation checks. The existing benchmark orchestrates
them through exclusive `--candidate-local-evidence`; the previous stability mode
retains its original protocol. No routing authority, confidence score, learned label,
schema, acknowledgement or UI control changes. Existing SWR refresh is untouched.

## Local Compose evaluation

Both accepted runs completed with source/model verification, five grouped folds,
6,652 cached 1,024-dimensional descriptions and all ten movie/TV candidate libraries.
Queries and every exact synopsis copy were excluded before group fitting and local
indexing. There were zero generation calls and database-enforced read-only sessions.
Normal application workers remained enabled. The first original-cohort attempt
detected metadata drift and was discarded; a fresh rerun passed. No freshness check
was bypassed and no media was moved.

| Cohort / rule | Compared | Placement agreements | Placement disagreements | Abstained |
| --- | ---: | ---: | ---: | ---: |
| Original 300 / independent baseline | 222 | 196 | 26 | 78 |
| Original 300 / local only | 47 | 45 | 2 | 253 |
| Original 300 / combined | 225 | 199 | 26 | 75 |
| Additional 300 / independent baseline | 218 | 197 | 21 | 82 |
| Additional 300 / local only | 47 | 46 | 1 | 253 |
| Additional 300 / combined | 221 | 200 | 21 | 79 |

All six newly compared cases agree with existing placement: four movies and two
TV shows. Existing placement remains a weak observation, **not ground truth**;
independent correctness labels are zero. The local-only rule changes three stable
choices in the additional cohort (two agreement gains and one loss). The combined
rule deliberately does not apply those changes. Preserving stable controls is a
property of this rule, not evidence that every stable baseline choice is correct.

The remaining 154 ambiguities break down into 101 with overlapping nearest examples,
37 whose supporting examples do not belong to one supported group, ten with metadata
that does not distinguish the destination, five with incomplete metadata and one
with highly correlated examples. These are first-failing checks in a fixed order,
not mutually independent diagnoses of semantic error. Missing metadata is not the
dominant measured bottleneck; simply increasing backfill or raising scores is not
supported as the next semantic fix.

The original cohort includes 150 movies and 150 TV queries from all ten libraries.
The additional cohort includes 172 movies and 128 TV queries from seven libraries,
excluding successive prior cohorts `300,300,100,100` with zero overlap. Three small
libraries are exhausted by those exclusions but remain candidates and training
sources. These are frozen regression cohorts, not untouched independent test data.

## Minority and unassigned-content diagnostics

The nearest exclusive training example identifies the diagnostic slice without
reading the query's placement. Across both cohorts, 37 cases are nearest a library's
smallest supported group, 561 another supported group and two an unassigned item.
The smallest-group slice has 25 baseline comparisons and 12 abstentions; neither
changes. Both unassigned-neighbor cases remain baseline comparisons; the local-only
rule abstains. All six recoveries are in the other-supported-group slice.

These slices describe the learned training geometry, not verified minority-content
labels. Two unassigned-neighbor cases cannot establish broad robustness. The existing
outside-observed-range diagnostic also remains available. Correlation vetoes and
exact-copy exclusions do not prove that paraphrases or related franchise items are
independent. Metadata from the same records is not independent corroboration.

## Verification

- Full backend: **1,301 suites / 37,817 tests passed**, with 90.18% statements/lines,
  82.75% branches and 92.28% functions. No coverage threshold was lowered.
- Full frontend: **368 suites / 5,121 tests passed**, with 85.61% statements,
  77.56% branches, 85.08% functions and 87.66% lines. The coverage ratchet passed
  using both fresh reports, including unchanged client accessibility/SWR tests.
- Focused evidence coverage: three suites / 33 tests passed; the index, resolver
  and paired benchmark reached 100% statements/functions/lines and 99.56% branches.
  Tests cover exact hold-outs, duplicates/conflicting metadata, shared vetoes,
  brute-force retrieval parity, cancellation, sparse/malformed input, stable
  preservation and candidate-ID mapping with reversed library order.
- CLI source-drift, incompatible-mode and zero-generation tests passed. The first
  broader focused run passed four suites / 55 tests; subsequent positive-proposal
  and request-log regressions also passed. A synthetic fixture was corrected to
  supply genuinely tied positive views rather than no-positive-match views;
  production safeguards were not relaxed to make that test pass.
- Runtime dependency transport/validation/logging selection: two suites / 31 tests
  passed, including stalled-body cancellation and escaped request-log fields.
- Real PostgreSQL recovery/backfill integration: two suites / 13 tests passed.
- Dependency/copyright preflight, backend/frontend type checks, test/security/client
  lint, ESM import/mock contracts, Markdown lint and whitespace checks passed.
  All five release/provenance contract validators passed; no release was dispatched.
- Updated Compose rebuilt and started healthy, retaining its read-only root. The
  local assessment ran inside that updated container, with the installed runtime
  dependencies. No production data was changed by the assessment.

The previous commit's CI/CD, CodeQL, OSV, Trivy, Gitleaks and copyright checks passed.
This is not a claim that the new push's hosted checks have completed; they run
separately after push. PR 536 was applied locally, not merged.

## Recommendation stack and next component

Retain source-verified cached descriptions → validated learned memberships → full
candidate scope → independent-start baseline → candidate-local diagnostic evidence →
unchanged live authorization. Benefit: bounded, reproducible evidence based on the
actual library, with no extra provider work or user prompts. Cost: only six more
comparisons, conservative metadata requirements, selected-partition sensitivity and
no proof of correct automatic routing. Recommend retaining the diagnostic service
and the separately documented [PR 536 updates](pr-536-local-runtime-validation.md),
not promoting the resolver to live routing yet.

**Next: contrastive evidence for overlapping learned content groups.** Concentrate
on the 101 unresolved nearest-example overlaps: determine which synopsis/metadata
features actually distinguish competing groups, using training inventory only and
without library-name rules. Compare those distinctions on these frozen cases plus
untouched movie/TV samples and the smallest-group slice. Reuse the current retrieval,
membership and evidence boundaries; do not add another broad metadata-weight recipe,
unbounded prompt reranker, declaration screen or confidence increase. The measured
overlap is the target; better semantic discrimination remains a hypothesis to test.

## Reproduction and rollback

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --candidate-local-evidence --max-minutes 15
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 300,300,100,100 --folds 5 --candidate-local-evidence --max-minutes 15
```

Private outputs remain ignored in `.tmp/`; committed reports contain no item titles,
IDs, synopsis text, metadata terms or vectors. Cancellation, work/component bounds,
full-scope validation and missing/corrupt cache rejection remain active. The mode
rejects generation and mixed experiment flags before loading configuration.

Revert through a new commit if needed; the two services and CLI mode are independent
of runtime profile persistence and require no database rollback. Dependency updates
can be reverted separately after compatibility/security review. Unreleased changelog
only: no product-version bump, release, tag or PR merge.
