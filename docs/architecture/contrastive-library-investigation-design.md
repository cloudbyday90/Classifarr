# Contrastive library investigation design

## Intent and previous implementation

Commit `6e02fb27` evaluated 300 additional titles with grouped holdouts.
Nine examples agreed with existing placement in 243 cases; 30 examples did no
better and 100 did slightly worse. The next component investigates the remaining
57 disagreements automatically, rather than requesting more library-purpose
declarations or increasing every prompt.

The existing investigation changes candidate order, includes observed libraries
and rechecks at most 25 cases. Keep it compatible. Add an explicit controlled
investigation mode to the existing local benchmark CLI, using the same frozen
cohort, fold-specific training data and original candidate pool/order.

## Research and alternatives

Sources were discovered through online search and opened on September 12, 2026.
The requested baseline is August 2026; these live pages are not represented as
archived August snapshots. The original rank-fusion research predates that date.

| Choice | Advantages | Disadvantages |
| --- | --- | --- |
| Repeat the original prompt | Cheap compatibility check | Does not isolate name bias or retrieval weaknesses |
| Increase all prompts to 30/100 examples | More context | Previous 300-case run showed no aggregate benefit |
| Controlled name and example ablations | Separates name influence from example selection; includes regression controls | Additional local calls; results are diagnostic, not verified accuracy |
| Promote model rechecks directly into labels | Apparent hands-off learning | Circular supervision can reinforce earlier mistakes; rejected |

Use rank fusion to combine query relevance and description distinctiveness,
following the ranking—not probability—approach of the original
[Reciprocal Rank Fusion paper](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf).
Reuse the platform's existing rank-fusion implementation. The distinctiveness
heuristic described below is our experimental feature, not a validated result
of that paper or a claim that positive margins establish correct placement.

Keep retrieved text untrusted and outputs bounded, following the
[OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html).
No new UI panel is needed. Any future summary should be concise and accessible,
consistent with [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages),
without repeated alerts or mandatory acknowledgement steps.

## Controlled experiment

1. Reproduce the nine-example baseline for the frozen cohort. Historical raw
   answers were not retained; regenerate rather than invent the 57 identities.
2. Select up to 100 valid placement disagreements/abstentions, in deterministic
   sample order. Select an equal number of distinct agreeing controls, matching
   observed library and media type where possible; disclose fallback matches.
3. For each selected case run three controls, rotating their call order:
   ordinary examples with anonymous library labels; contrastive examples with
   original labels; contrastive examples with anonymous labels.
4. Freeze query, candidate IDs/order, model representation and output schema.
   Do not reveal observed placement, baseline answer or control-group membership
   in any prompt. Label-based selection of diagnostic cases is not a deployable
   decision policy and cannot establish overall treatment accuracy.
5. Report recoveries relative to observed placement for flagged cases separately
   from lost agreement in controls, with failures/abstentions and denominators.
   Summarize the most confused library pairs using anonymous stratum numbers.

Maximum work is 300 baseline calls plus three calls for each of at most 200
selected cases: 900 local calls. Cancellation and technical failures remain
visible. No paid fallback, model download, live routing, training-label writes,
policy changes or user questions are authorized by this experiment.

## Contrastive examples

Use at most 30 query-nearest descriptions per candidate from its own fold's
training set. Exclude descriptions shared across the compared candidates;
never add the query or any held-out copy back to the training set. Require at
least four distinct examples in each pool so each example can be compared with
three other examples from its own library.

For each example, compute its mean similarity to its three closest other
examples in the same library, minus the strongest equivalent mean in an
alternative library. Fuse positive contrast margins with the original query
relevance rank, using existing equal-weight reciprocal rank fusion. Keep three
examples per candidate and the original candidate order. This is a bounded,
library-name-agnostic heuristic; sparse or incomplete vectors prevent the
contrastive arm from running rather than causing hidden evidence substitution.

All vectors and descriptions stay in the existing private in-memory snapshot.
Only aggregate counts, latency, token budgets and cohort fingerprints leave the
runner. Observed placement is not ground truth. No new model weights are trained.

## Recommendation stack and acceptance

Start with controlled disagreement analysis, then evaluate contrastive retrieval,
then validate any promising change on independently checked outcomes. Production
promotion requires evidence beyond self-agreement; no score or threshold change
is part of this component.

Tests cover grouping/self exclusion, name-blind prompt isolation, deterministic
selection, matched controls, bounded calls, cancellations, technical failures,
output privacy and unchanged legacy benchmark behavior. Verify on read-only local
Compose and record results in the separate outcome document before committing.
