# Item-to-item semantic reranking: outcome

Date: 2026-09-13

## Decision

Keep this component available as a read-only benchmark, not live routing.
The local model completed the protocol reliably, but the unseen pilot gained one
movie placement agreement and lost one TV agreement. It showed no net improvement.
Do not lower the evidence rule or increase displayed confidence to conceal that
result. Existing placement agreement is not independently verified accuracy.

The [design](semantic-pair-reranking-design.md) was recorded before inference.
This change adds three small ESM services for the response contract, anonymous
pair construction and batch comparison. It extends the existing local transport
and benchmark CLI instead of creating another provider or singleton.

## What actually ran

Both known 300-description cohorts passed zero-generation preflight. The original
cohort had 94 eligible disagreements and 206 preserved consensus cases; the next
300 had 85 disagreements and 215 consensus cases. All candidate pools were complete.
No AI quality claim is made for those 600 preflight cases.

The first inference pilot selected ten eligible cases from the original cohort.
The second selected a new 100-description cohort, excluding both prior cohorts.
That cohort contained 56 movies and 44 TV descriptions with zero prior-sample
overlap. Eight libraries supplied new samples; two smaller libraries had exhausted
their eligible unseen descriptions. All ten libraries remained in same-media
candidate/training scope. Prior samples could supply training examples, but every
current held-out description and all its copies were excluded from its fold.

| Measurement | Original pilot | Previously unseen cohort |
| --- | ---: | ---: |
| Sampled descriptions | 300 | 100 |
| Eligible disagreements | 94 | 17 |
| Requested inference cases | 10 | 20 |
| Actually evaluated cases | 10 | 17 |
| Planned / actual model calls | 20 / 20 | 34 / 34 |
| Valid responses | 20 | 34 |
| Supported in both orders | 0 | 5 |
| Insufficient pair evidence; baseline retained | 10 | 12 |
| Placement agreement before / after | 8 / 8 | 14 / 14 |
| Gained / lost agreement | 0 / 0 | 1 / 1 |
| Changed destinations in the experiment | 0 | 2 |
| Model-request latency, cumulative | 31.984 s | 39.698 s |
| Prompt / output tokens | 24,236 / 980 | 41,640 / 1,666 |

The unseen movie subset moved from 7/10 to 8/10 agreement; TV moved from 7/7 to
6/7. Its 83 consensus cases were unchanged without inference. No order-sensitive,
invalid, truncated-output, context-limit or provider-failure status was reported.
Three of the five supported choices retained the baseline destination.

In total, this was **27 AI-evaluated cases and 54 calls**, not 700 AI evaluations.
The two runs used 65,876 prompt tokens and 2,646 output tokens, with 71.682 seconds
of cumulative model-request latency. This excludes retrieval, model identity
checks and snapshot verification. No paid provider, model download or repair
retry was used. Small sample size and existing-placement labels limit conclusions.

Both pilots passed post-run source and embedding verification. They used installed
`gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`,
with context 32,768, temperature 0, seed 42 and output budget 512 tokens per call.
Retrieval reused cached `mxbai-embed-large:latest` vectors with 1,024 dimensions.
Descriptions used `synopsis_only_1000_codepoints.v1`; two inventory identities
had shortened text. The provider does not prove absence of input truncation, so
the report explicitly retains `inputTruncation: unknown`.

## Recommendations, pros and cons

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Enable this pair rule live | Direct description comparison; no new provider | No net pilot gain and a TV agreement loss; do not enable |
| Lower the rule after seeing these results | More accepted judgments | Would tune against evaluation outcomes without establishing correctness; reject |
| Add a dedicated cross-encoder now | Purpose-built pair scoring | New runtime/model and domain-validation cost; defer until the relevance target is clearer |
| Learn multiple semantic representatives per library | Can reflect different recurring kinds of content without library-name rules; reuse cached vectors | Must test coverage, mixed libraries and cluster instability; recommended next component |

The current learned-profile scorer uses genre, studio and rating distributions.
This pilot instead asks for similar central content and treatment between individual
synopses. **Our hypothesis**, not a proven cause, is that three nearest examples
and close-story relevance do not adequately describe the varied content a library
can legitimately contain. Twenty-two of 27 cases lacked sufficient pair evidence.
A different question is whether a title fits one of the recurring content groups
already present in the library.

Next, build an **inventory-derived semantic representative set**: reuse cached
description vectors to discover multiple groups per movie/TV library, select real
representative examples, and compare held-out items with those groups and competing
libraries. Start by extending existing retrieval/profile boundaries, not adding
another settings panel. Keep query exclusions, ambiguous/shared memberships,
small-library fallback and source-versioned refresh. Do not convert an inferred
group into a verified label or automatically move existing media.

[Sentence Transformers' clustering guide](https://www.sbert.net/examples/sentence_transformer/applications/clustering/README.html)
describes embedding-based grouping and threshold-based local communities, including
their tuning and scaling tradeoffs. This supports the proposed representation
experiment, not a claim of better Classifarr classification or a requirement to
install its Python package. Measure held-out coverage, gains/losses and stability;
do not use cluster compactness as a correctness score. The official
[silhouette reference](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html)
measures relative within/between-cluster distances, not destination correctness.
Both sources were discovered through search and read on 2026-09-13.

Final stack: existing cached retrieval and learned metadata remain live; anonymous
pair grading stays an offline comparison tool; next evaluate diverse inventory
representatives before deciding on further local-model inference or a cross-encoder.
No new acknowledgements, manual labels or user-facing controls are introduced.

## Security, accessibility and reproduction

All reads used the existing local runtime with PostgreSQL read-only enforcement.
No prompts, responses, private titles, item IDs or descriptions are in committed
reports. The model sees no library names, destination IDs, tools or credentials.
Strict grade validation, complete same-media pools, duplicate exclusion, bounded
input/output, model identity checks, cancellation and baseline fallback remain
mandatory. A schema-valid answer is not treated as proof of semantic correctness.

No client or UI changed; existing SWR behavior remains intact. The design records
the applicable W3C update-control guidance for any later status presentation.
No routing permissions, policy scores, captured learning labels or database rows
were changed by these runs.

```powershell
# Preflight only: no model generation
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --semantic-pairs --generate-cases 0 --context 32768 --max-minutes 5
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --exclude-prior-size 300 --folds 5 --semantic-pairs --generate-cases 0 --context 32768 --max-minutes 5
# Explicit local inference; two planned calls per eligible case
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --semantic-pairs --generate-cases 10 --context 32768 --max-minutes 20
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 100 --exclude-prior-sizes '300,300' --folds 5 --semantic-pairs --generate-cases 20 --context 32768 --max-minutes 20
```

The mode requires grouped hold-outs and rejects incompatible experiment flags
before loading configuration. Missing coverage does not trigger substitute model
calls. Reports distinguish requested counts, actual calls, source invalidation and
interruption. Reproduction on changed inventory is a new evaluation, not an exact
replay of these results.

## Validation and delivery

Focused validation passed four suites / 52 tests. The three new service modules
reached 100% statements, functions and lines, with 98.91% branches. Tests cover
strict wire grammar, duplicate keys, response coercion, complete pools, held-out
copies, shared membership, rename invariance, reversed-order mapping, weak/order
fallback, context bounds, cancellation, provider errors, redaction and source drift.
Backend typecheck, test/security lint, Markdown lint, dependency/copyright preflight
and ESM checks passed. Grade parsing uses a bounded literal grammar with no lint
suppression; its final focused rerun passed after the parser cleanup.

Full backend regression passed **1,276 suites / 36,871 tests** in 693 seconds.
Coverage reached 90.11% statements/lines, 82.32% branches and 92.16% functions.
The repository coverage ratchet passed using fresh backend coverage and the
existing unchanged-client report. No coverage threshold was weakened.

The preceding commit's CI/CD, CodeQL, copyright, OSV, Gitleaks and Trivy checks all
passed. GitHub MCP returned no open Classifarr PR for random selection; no PR was
merged or substituted from another repository.

No API/schema/dependency/version change or release is included. No new frontend
test run or dedicated PostgreSQL integration suite is claimed; actual read-only
benchmark execution was verified against the local Compose runtime.
