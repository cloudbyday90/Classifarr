# Learned-group semantic comparison: outcome

Date: 2026-09-19

## Decision

Keep the local comparator available for evaluation, **not live routing**. Across
three source-verified 300-description cohorts, it made nine additional choices:
two agreed with existing placement and seven disagreed. Existing placement is not
independent ground truth, but these results do not justify automatic adoption or
higher displayed confidence. No threshold or prompt was tuned after measurement.

The separate [design and official research](group-semantic-comparison-design.md)
was recorded before inference. Three small ESM services provide private group
evidence selection, a strict response contract and bounded comparison. They reuse
the existing CLI, local transport, grouped folds, profiles and source verification.
No new provider, dependency, database schema, UI control, acknowledgement or
routing authority was introduced. Existing quiet SWR refresh is unchanged.

The same change improves real fitting efficiency by avoiding per-item async
no-ops. Its separate [optimization record](representative-fit-checkpoint-optimization.md)
documents identical-output checks and cancellation behavior. The CLI also reports
which source component changed when an evaluation is invalidated, without exposing
individual content or metadata.

## Verified comparison

These are the same three previously sampled, mutually disjoint query cohorts,
not 900 new items. All ten libraries stayed in candidate/training scope, with
all current-fold description copies excluded. The original cohort covers all ten
libraries / 150 movies and 150 TV descriptions. Each later cohort covers the seven
libraries with remaining unseen descriptions / 172 movies and 128 TV descriptions.

| Measurement | Original 300 | Additional 300 | Fresh 300 | Total |
| --- | ---: | ---: | ---: | ---: |
| Eligible / AI-evaluated cases | 46 | 52 | 45 | 143 |
| Actual model calls / valid responses | 92 | 104 | 90 | 286 |
| Weak or tied evidence | 36 | 44 | 36 | 116 |
| Order-sensitive choices | 7 | 5 | 6 | 18 |
| Supported in both orders | 3 | 3 | 3 | 9 |
| Unavailable selected-group evidence | 3 | 0 | 0 | 3 |
| Preserved baseline cases without inference | 251 | 248 | 255 | 754 |
| Baseline comparisons | 225 | 221 | 230 | 676 |
| Semantic-arm comparisons | 228 | 224 | 233 | 685 |
| Newly selected placement agreements | 2 | 0 | 0 | 2 |
| Newly selected placement disagreements | 1 | 3 | 3 | 7 |

All 676 existing combined-arm selections remain unchanged; the other 78 preserved
cases were already unresolved for reasons outside this experiment. Abstentions
fell from 224 to 215. Total historical-placement agreements changed from 608 to
610, disagreements from 68 to 75. Independent labels remain zero and accuracy is
null. These additional comparisons are not verified corrections or routing wins.

Movie cases account for six additional choices: one agreement and five
disagreements. TV cases account for three: one agreement and two disagreements.
The private reports retain anonymous per-library, observed-support-range and
nearest-example group-size slices. No private titles, IDs, descriptions, vectors,
terms, prompts or model responses are committed.

Verified runs used installed `gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`,
context 32,768, temperature zero, seed 42 and a 256-token output cap. Retrieval
reused cached 1,024-dimensional `mxbai-embed-large:latest` vectors. Provider input
truncation remains explicitly unknown. Cumulative model-request latency was
240.974 seconds, with 414,283 prompt tokens and 5,434 output tokens; this excludes
fitting, retrieval, source checks and other work and is not a throughput benchmark.

## Invalidated runs and recovery

The first zero-generation preflight and the first 46-case inference run were
invalidated because metadata changed during startup library syncs. Descriptions,
vectors and library membership stayed unchanged. Sync completion logs confirmed
that the background sync overlapped the larger run. No automatic recovery or sync
was disabled. A fresh run after startup sync completed passed source verification.
The sequence stopped immediately on invalidation rather than proceeding silently
to later cohorts. Invalidated apparent gains are excluded from the table above.

A separate ten-case pilot passed source verification: 20 valid responses, nine
weak/tied cases and one order-sensitive case, with no additional selection. Across
the pilot, invalidated inference and three verified runs, **398 calls** actually
occurred, using 578,833 prompt tokens and 7,562 output tokens. The extra calls
revisited cases; they are not additional independent samples. No paid provider,
model download, automatic repair prompt or cloud fallback was used.

Rebuilds can start background synchronization. For reproduction, allow startup
sync to finish first; never bypass the post-run source check to obtain a green
report. The new `changedSourceComponents` field identifies the changed collection,
not the exact fields/items or a claim that the data was malformed.

## Recommendations, pros and cons

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Enable this comparator live | Fewer abstentions | Only two added placement agreements versus seven disagreements; reject |
| Retune grades or prompts using these cases | Could raise acceptance | Evaluation leakage and no proven correctness gain; reject |
| Add a dedicated cross-encoder now | Purpose-built joint scoring | New runtime/model and still an uncertain group-fit target; defer |
| Evaluate adaptive, coherent content groups next | Learns inventory structure without library-name rules; reuses vectors | More fitting work and risk of losing small themes; recommended next component |

**Next: adaptive content-group discovery with cohesion and rare-group coverage.**
The current fitter caps each library at eight groups, regardless of inventory
diversity. Our hypothesis is that some groups remain too broad or overlapping for
three examples to establish a recurring pattern. This is not a proven explanation
for the model's weak grades; model capacity and the grading task are alternatives.
Measure cohesion, overlap and representative coverage first, then compare bounded
local communities or hierarchical splits against the unchanged current groups.
Preserve outliers, small libraries, exact-copy exclusion and held-out comparisons.
Do not simply increase a global cluster count or turn inferred groups into labels.

The official [Sentence Transformers clustering guide](https://sbert.net/examples/sentence_transformer/applications/clustering/README.html)
contrasts fixed-count clustering with threshold-based communities. The
[scikit-learn HDBSCAN example](https://scikit-learn.org/1.8/auto_examples/cluster/plot_hdbscan.html)
illustrates variable-density grouping and the risk that noise controls discard
small valid groups. Both were discovered through search and read on September 19,
2026. They support evaluating alternatives, not a claim that one will improve
Classifarr or a decision to add Python/model dependencies now.

Final recommendation stack: validated inventory → existing automatic recovery →
efficient cached-vector grouping → adaptive group-quality evaluation → existing
retrieval/routing safeguards. Keep group-fit LLM grading offline. Improve the
learned representation before adding another inference layer or user-facing panel.

## Reproduction

```powershell
# Read-only preflight; append --generate-cases 100 for explicit bounded inference.
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --group-semantics --max-minutes 30
```

For the later cohorts, add `--exclude-prior-sizes 300,300,100,100` and
`--exclude-prior-sizes 300,300,100,100,300`. Fingerprint prefixes are
`7f40e9ebf6f3`, `58ec647b494f` and `d8d72ac31cb2`. The 100-case request is a ceiling,
not a promise to generate on 100 items or a reason to include stable cases.

## Validation and delivery

- Final backend coverage: **1,306 suites / 38,007 tests passed**. Coverage ratchet
  passed with no baseline change. Server coverage: 90.19% statements/lines,
  82.86% branches and 92.28% functions.
- Client coverage: **369 files / 5,128 tests passed**. All 24 development browser
  checks and seven production-build/route checks passed.
- Real PostgreSQL integration: three suites / 26 tests passed, covering corpus
  projection, automatic description refresh and guarded metadata enrichment.
- Final focused semantic/CLI/provider tests: 87 passed. New service coverage:
  100% statements, lines and functions; 97.79% branches across 32 tests.
- Fitting/profile regression: 108 tests passed; the previously timing-out geometry
  suite also passed under coverage without extending its timeout. The earlier
  superseded run is not counted as a pass.
- Eight-worker browser execution hit three wait/time-limit failures while heavy
  jobs ran. A complete one-worker rerun passed unchanged assertions and timeouts:
  `node scripts/run-playwright.mjs test --workers=1` from `client/`.
- Lint, typechecks, dependency/copyright preflight, ESM checks, product-language,
  delivery-term and maintenance checks passed. No client source was changed.

The separate production naming audit still reports 43 existing references against
its zero-debt baseline, down from 44 after replacing this benchmark's progress
field with `stage`. It remains blocked; no audit or baseline was weakened.

Previous commit `6a4e3772` passed hosted CI/CD, CodeQL, Trivy, OSV, Gitleaks and
copyright checks. GitHub MCP returned no open PR on this iteration's checks, so no
random PR could be selected or applied. None was merged or invented.

The local Compose benchmark ran with read-only database defaults. Final delivery
uses a clean-source provenance rebuild and healthy read-only-root container check.
No release, tag, product-version bump, policy edit, media move or verified-label
write is included. The three verified inference runs precede the scheduling-only
fit optimization; identical arithmetic/output checks and final-code regression
cover that change, not an additional claim of 900 post-optimization AI evaluations.
