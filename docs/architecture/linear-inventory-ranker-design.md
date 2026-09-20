# Deterministic inventory content ranker — design

## Decision and scope

Replace repeated generative judging in the next **evaluation**, not live routing,
with a small learned content ranker. Reuse the installed description embedding
model. Discover classes from active movie/TV libraries; never use library names,
genre names, or hard-coded destinations as content features. Movie and TV models
are separate compatibility domains, not hand-written semantic categories.

The previous independent-fit experiment reduced stable selections and increased
cost. See [its outcome](independent-inventory-fit-outcome.md). Determinism alone is
not accuracy: this experiment measures held-out **placement agreement**, not
verified routing correctness. It cannot persist models, change policies or move
media. No new UI, acknowledgement or remote AI request is introduced.

## Research and trade-offs

Sources discovered and read on September 19, 2026 (local date). These are living
documents, not a claim that a particular package version is pinned by this change.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Class-balanced, L2-regularized linear softmax over description vectors | Learns boundaries from contents; bounded memory; reproducible fitting | Cannot model every nonlinear boundary; inherits embedding and placement errors | Implement an ESM evaluation-only fitter |
| Nearest description | Simple, inspectable baseline without fitting | Sensitive to isolated misplaced examples and library size | Keep on the same admitted training population |
| Existing organic metadata profile | Uses genres/studio/rating learned from inventory | Missing metadata and broad overlaps can weaken evidence | Keep as a separate baseline |
| More generative judging or fine-tuning | Potentially richer reasoning | Previous experiment was unstable; higher cost and poisoning risk | Do not promote or tune further on the same cohort |

Regularization, multinomial loss and inverse-frequency class weighting are
established approaches documented by [scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html).
We use a deliberately bounded ESM gradient-descent implementation, **not** a port
of its solver or a new Python/runtime dependency. All fitted choices must exclude
held-out examples, consistent with its [data leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html).

[OWASP's RAG guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
motivates source integrity, provenance and treating content as untrusted data.
This is not a complete RAG security certification. Numeric embeddings do not
eliminate poisoned placement labels or adversarial content.

No markup changes are needed for this CLI experiment. Any later Command Center
status should be concise, non-focus-stealing and accessible per
[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
Detailed diagnostics belong behind disclosure, not another required setup flow.

## Training boundary

Capture retained classification-history identity matches in the same bounded,
repeatable-read, read-only transaction as the existing corpus/vector snapshot.
This opt-in query returns only media type and metadata ID. Method, reconciliation
reason and candidate-capture fields are used only inside the database predicate;
history payloads are never returned to the learner or report.
Existing benchmark modes retain their current query contract.

Group all copies of a description across media types before training. Exclude a
whole group when it is held out, shared across libraries/media types, has
conflicting normalized metadata, or any member has a retained Classifarr decision,
reconciliation or unrecognized candidate capture.
Missing metadata remains usable for vector learning but supplies no metadata
evidence. Duplicate descriptions count once. Require at least three admitted
descriptions per class and two trained classes per media type. Report sparse and
excluded populations instead of filling them with guessed labels.

History exclusion is conservative (including manual decisions), and **absence of
retained history does not prove independent provenance**. Expired or missing
history may conceal earlier automated placements. Inventory membership remains a
weak observational label. This limitation blocks automatic live promotion.

### Provenance correction found during local validation

The initial blanket history exclusion admitted no training data: the sync pipeline
also stores observations in `classification_history`, with `method=source_library`.
That is not a classifier decision. The final query permits those weak observations
only when capture is absent (legacy) or exactly matches the server-generated
non-classifier capture. It rejects all other methods, null/unknown methods,
nonmatching/malformed captures, and the existing reconciliation marker `Resolved
via library placement` (that path rewrites a pending decision's method). Any other
retained decision for the same media identity still excludes the whole group.

Legacy observation markers are not proof of independent placement; this correction
does not relabel them as ground truth. It separates known source observations from
known/unknown decisions using the actual writer contracts, not benchmark scores.

Normalize each vector independently, without fitting a global transform. Canonical
description-hash order fixes summation order. Fit each fold from scratch with zero
initial weights, 80 full-batch epochs, learning rate 0.5 and L2 coefficient 0.01.
Each class has equal total training weight. Use stable log-sum-exp; reject invalid
numbers and non-decreasing loss beyond roundoff. Report loss and remaining gradient
norm, not an unsupported convergence claim. Fixed settings are frozen before the
local comparison; no repeated tuning to its results.

Rank every admitted same-media class. A numerical tie abstains; a logit or cosine
margin is **not a calibrated confidence percentage**. Raw-neighbor and metadata
baselines use exactly the same filtered descriptions/classes. Add a separately
fitted, deterministic 10% label-noise stress arm; it changes only private training
labels and cannot create history or feed back predictions as labels.

## Bounds, cancellation and reporting

Use separate small modules for provenance reads, source preparation, numerical
fitting, worker ownership, benchmark metrics and orchestration. Fixed worker code
receives only numeric training arrays, no text, database/config or provider access.
Worker threads are isolation for responsiveness, **not a security sandbox**.
As the [Node worker documentation](https://github.com/nodejs/node/blob/main/doc/api/worker_threads.md)
explains, V8 resource limits do not cover external ArrayBuffers; explicit numeric
array bounds and container-wide memory admission are therefore retained.

Keep existing snapshot/memory admission. Cap vector components at eight million,
classes at 64, a fit at twelve billion multiply-accumulate components and total
benchmark fitting at 120 billion. Sequential workers have a five-minute deadline
and bounded V8 heaps; always await termination before releasing admission. Existing
live SWR, backfill and recovery are unchanged. Failed/cancelled experiments cannot
publish a successful result or cached model.

Publish aggregate anonymous movie/TV/library counts, exclusions, ties, placement
agreement, noise sensitivity, fit timing, loss and resource measurements. No
titles, descriptions, raw identities, vectors or fitted weights in the report.
Fingerprint all consumed source fields, including retained-history exclusions,
and re-read after evaluation. Drift invalidates the report.

## Validation and recommendation stack

1. Test analytical gradients, separable/imbalanced/tied synthetic data, finite
   bounds, class/row permutation invariance and real worker cancellation.
2. Test held-description exclusion across media, shared identities, conflicting
   metadata, history exclusion and source-drift invalidation. Verify the provenance
   SQL against real PostgreSQL using isolated test tables.
3. Run all three baselines and the stress arm on the prior exploratory 300-item
   cohort, then the next disjoint 300 with identical frozen settings. Reuse the
   existing sample seed, grouped folds and memory-admission boundary.
4. Record results and limitations in the separate outcome document. Keep routing
   unchanged until a useful signal is established with independent evidence.

Final stack: existing embeddings + conservative provenance filter + bounded ESM
linear learner + raw/metadata comparators + grouped evaluation + existing resource
admission. Next-stage automation must preserve provenance and unknown states; it
must not turn agreement with the library into self-certified correctness.
