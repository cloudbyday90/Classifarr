# Inventory-derived representative groups: design

Date: 2026-09-13

## Decision before evaluation

The preceding pair-grading pilot produced one placement-agreement gain and one
loss on unseen cases, with 22/27 cases lacking sufficient pair evidence. Keep
that experiment offline. The next hypothesis is that a library needs several
representative content groups, rather than one average profile or three nearly
matching storylines. This is unsupervised representation learning from inventory,
not language-model fine-tuning and not verified knowledge of intended placement.

Build a bounded ESM component using existing cached description vectors. Reuse
the current benchmark, snapshot verification and ranking contracts. No model
download, generation, new dependency, database schema, UI or settings are needed.

## Fixed first algorithm

1. Normalize cached vectors and group all copies by media type and description
   hash. Exclude the entire evaluation fold before fitting. Exclude shared-library
   descriptions from training rather than treating duplicates as independent votes.
   Use every remaining eligible description, not a hidden per-library sample.
2. Fit each library separately. Choose `min(8, max(1, floor(sqrt(n / 3))))` initial
   groups from its eligible count. This is a fixed capacity heuristic, not a learned
   optimum or a user setting. Start nearest the normalized mean, then choose
   farthest-first seeds with hash-ordered ties. Identical directions do not create
   artificial additional groups.
3. Run at most 12 normalized-centroid assignment/update passes. Yield between
   bounded chunks and check cancellation. Report convergence and iteration-limit
   hits; a capped fit is approximate, not guaranteed optimal. Drop groups with
   fewer than three distinct descriptions. Retain each group's centroid, support,
   mean similarity and three real representative description hashes privately.
4. Compare a held-out query with the nearest supported centroid in each same-media
   library. Require the full candidate pool and the exact fold exclusion set. Keep
   baseline behavior on sparse groups or tied/nonpositive representative leaders.
   Preserve existing description/metadata consensus and ambiguous leader cases.
5. Only for unique disagreements, replace the description channel with the group
   similarity and reuse existing rank fusion with unchanged learned metadata.
   Do not invent a confidence percentage, independent corroboration or permission
   to route. The entire first implementation remains a read-only comparison.

Memory and arithmetic budgets are explicit. Limit inventory to the existing
50,000-description/64-library boundary, the normalized index to 20 million components,
and estimated fitting work to 20 billion component operations per run. Oversized
work fails before fitting; it never silently samples or falls back to generation.
The existing benchmark also holds source vectors and uses temporary normalized
vectors during retrieval; the index budget is not a claim about total process memory.
Reuse the existing 1,000-codepoint synopsis projection, not a full-synopsis model.

## Evaluation

Use the known 300 + 300 + 100 cohorts as regression controls. Evaluate a separate
100-description cohort excluding all three, retaining same-media candidate scope
even when a small library has exhausted unseen queries. Source/model drift
invalidates results. Report per-media/per-library gains and losses, unchanged
consensus, sparse fallback, group/support counts, fit coverage, iteration limits
and elapsed time. No held-out placement labels influence clustering or capacity
selection; observed membership defines the training pools, not verified correctness.
No live adoption or threshold tuning is justified by agreement with existing
placements alone. Record actual results in a separate outcome document.

## Official research and tradeoffs

Sources were discovered through online search and read on 2026-09-13.

[Sentence Transformers' clustering guide](https://www.sbert.net/examples/sentence_transformer/applications/clustering/README.html)
describes grouping sentence embeddings, fixed-count clustering and threshold-based
communities. These are possible representations, not proof that semantic clusters
match a user's destination choices. Our implementation is bounded spherical
assignment/update with deterministic farthest-first seeds, not the guide's Python
implementation or a claim to discover an optimal number of topics.

The official [scikit-learn KMeans reference](https://scikit-learn.org/dev/modules/generated/sklearn.cluster.KMeans.html)
documents initialization, iteration limits and sensitivity to seed choice. Its
development documentation is used for algorithm considerations, not a production
dependency/version recommendation. Determinism is not evidence of stability
across different initializations; that limitation must be reported.

| Approach | Pros | Cons / choice |
| --- | --- | --- |
| One library average | Cheap | Can hide multiple content families |
| Nearest individual examples | Specific real evidence | May overemphasize one story or a local pocket |
| Multiple inventory-derived groups | Represents variety; cached vectors; no names or manual labels | Capacity/initialization choices and mixed membership need evaluation; selected |
| Density/community discovery | Avoids a fixed group count | Similarity thresholds, outliers and scaling introduce another tuning problem; defer |
| LLM-generated library descriptions | Human-readable themes | Inference cost and unsupported generalization; not required for this component |

## Security and accessible operation

[OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
emphasizes source integrity, scoped vector access, output validation and poisoning
risks. Keep source hashes and model checks, deduplicate copies, isolate media/library
membership and treat learned groups as fallible observations. Clustering does not
sanitize poisoned inventory. No raw descriptions, vectors, representatives or
per-item hashes may appear in public reports; expose aggregate measurements only.
Use existing read-only runtime and cancellation boundaries. No routing, labeling
or policy writes are permitted in the benchmark.

No additional user acknowledgement or dense screen is introduced. Existing SWR
and UI behavior remain unchanged. A later compact status display must preserve
user control over automatic updates under [W3C pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

Recommended stack: cached description embeddings, private multi-group learning,
complete-pool scoring, existing deterministic fusion/fallback, then measured
hold-out comparison. Only consider live integration after quality, stability and
runtime cost have supporting evidence. No release or version bump is included.
