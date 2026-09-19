# Learned content-group contrast: design

Date: 2026-09-19. Follows [candidate-local evidence](candidate-local-evidence-outcome.md).

## Decision and fixed experiment

The remaining 101 nearest-example overlaps need content distinctions, not a higher
confidence number or another declaration screen. Add a private, deterministic ESM
term learner over the existing validated content groups. Keep it offline until
measured; neither learned terms nor model proposals become verified labels.

Remove held-out description copies before learning vocabulary, frequencies or
groups. Use synopsis-only Unicode word presence, never library names, titles,
identifiers or audience ratings. Repeated words count once per description.
Retain terms present in at least three distinct group descriptions and no more
than half the same-media training descriptions. Weight group prevalence by its
positive log ratio against the strongest other-library group, with Laplace
smoothing, and document IDF. Normalize weights for cosine comparison. This is a
custom binary contrastive representation, not a BERTopic implementation.

A proposal requires a unique positive lexical winner, at least two supported query
terms, and three nearest examples in that winning group. Preserve shared-example,
correlation, complete candidate-scope and metadata-dominance safeguards. Only the
vector separation requirement is replaced. Missing rival terms abstain. Stable
baseline decisions, prior local recoveries and non-overlap failures stay unchanged.
Keep a standalone contrast arm to expose disagreements on stable controls.

Freeze these rules before reading results. Replay the original 300 and the later
300 excluding `300,300,100,100`, then 300 untouched descriptions excluding
`300,300,100,100,300`. Report placement agreement, abstentions, movie/TV and smallest
group slices; inventory placement is not verified correctness. Do not retune using
these results. A fresh cohort tests transport beyond repeatedly inspected cases,
not independent correctness or an untouched training corpus.

## Research and recommendations

Official sources discovered with search and GitHub MCP and read on this date:

- [BERTopic class-based representation](https://maartengr.github.io/BERTopic/getting_started/ctfidf/ctfidf.html)
  separates group representation from clustering. Reuse validated groups rather
  than re-cluster or add a Python dependency.
- [scikit-learn feature extraction](https://sklearn.org/stable/modules/feature_extraction.html)
  describes document-frequency weighting and binary occurrence. Our contrast ratio
  and support thresholds are experimental choices, not endorsed defaults.
- [Leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html) requires
  learning transforms on training data only. Exclude copies before every fit.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports bounded diagnostics without sensitive payloads. Reports contain aggregate
  counts, slices and component digests; terms and private item references stay in memory.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  informs future compact status updates. No new screen, acknowledgement, live-region
  chatter or change to existing SWR is needed for this experiment.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Group-local recurring terms | Cheap, explainable, learned from inventory | Lexical overlap misses synonyms and negation; evaluate now |
| Another broad metadata fusion | Already available | Previous regressions; do not repeat |
| More generation prompts | Potentially richer reasoning | Cost and prior unstable gains; defer |
| Immediate routing promotion | Fewer reviews | No independently validated improvement; reject |

Recommended stack: verified descriptions and cached vectors → copy-grouped hold-outs
→ validated memberships → bounded contrastive terms → existing metadata/correlation
checks → paired diagnostics → unchanged routing authority.

## Boundaries and validation

Use the existing exclusive benchmark CLI, read-only source transactions, isolated
fitter, cancellation and post-run source/model verification. Bound text length,
unique terms, vocabulary and postings, yielding between batches. The limits are
20,000 index items, 10,000 descriptions, 2,000 UTF-16 units per description, 256
unique terms per description, 100,000 vocabulary entries per media type, two million
term memberships and 40 million estimated cross-group operations. These are work
budgets, not semantic thresholds. Tokenization is lexical: Unicode support does not
provide language-aware segmentation, synonyms or negation understanding. No external model
calls, cache writes, content moves, policy edits or database migrations.

Test training-only vocabulary, repeated words, order/name invariance, same-media
scope, unavailable rivals, ties, correlation, cancellation, bounded resources and
redacted reports. Run backend/client coverage, integration and local Compose replay.
PR #532 is independently documented and validated; no PR merge or release.

See the [measured outcome](learned-group-contrast-outcome.md) before using the model.
