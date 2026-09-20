# Content-supported provisional-leader challenge

## Purpose and boundary

Design reviewed on 2026-09-20. Evaluate whether existing library-content evidence
can challenge the first policy candidate, including two- and three-library pools.
This is a read-only paired experiment, not a new classifier or routing permission.
The previous linear-ranker experiment was weaker than organic metadata matching;
reuse the existing metadata profiles and synopsis retrieval instead.

The live shortlist pins the policy leader and skips learning for pools of at most
three. Simply unpinning it is unsafe: adjudication fallback and contrastive evidence
use the first candidate as the leader. This experiment therefore does not change
the live contract, fallback, policy scores, thresholds, pending decisions or UI.

## Decision design

1. Re-evaluate current policies using fold-local inventory observations and the
   production policy formulas. Do not supply history, source-library shortcuts,
   exact item membership or the held-out placement as query evidence.
2. Build the existing server-owned eligible pool. Never add a destination. Skip
   automatic actions. Explicit manual-review vetoes always retain the baseline;
   separately diagnose what content would nominate without applying it.
3. Require a complete same-snapshot learned-profile comparison with a unique
   positive leader. Require the same destination to lead complete description
   retrieval, with three nonshared examples and a positive, untied mean similarity.
4. If that destination differs from the policy leader, nominate a hypothetical
   challenger. Keep the original leader second and all remaining eligible IDs.
   Disagreement, unavailable evidence, ties and insufficient examples keep baseline.
5. Report paired placement agreement, gains, losses, abstention reasons and actual
   pool sizes by media and anonymous library stratum. These are weak-label metrics,
   not accuracy, calibrated confidence or proof of safe automatic routing.

The report separately counts allowlisted review reasons and hypothetical gains and
losses behind a veto. This diagnostic distinction does not remove the veto or
count blocked nominations as applied challenges.

Metadata and descriptions share inventory provenance: their agreement is a
conservative consistency check, **not two independent votes**. Names, library-purpose
keywords and hardcoded genres play no role in challenge selection.

## Provenance, isolation and recovery

Reuse the preceding experiment's validated whole-description admission: exclude
retained decisions, reconciliations, unknown origins, shared memberships and
conflicting metadata. Legacy source observations remain weak labels. Canonicalize
duplicate descriptions and remove each entire held-out fold before learning or
retrieval. Read provenance, policy, configuration and vectors in one read-only
snapshot; verify every component again before reporting a valid result.

Use the existing cross-process discovery lease, memory admission, cancellation,
bounded SQL and aggregate-only output. Do not write routing receipts, training
records, settings or raw media data. Busy/pressure conditions defer safely; a
rerun re-reads the source. No cloud generation or embedding generation is needed.
Existing live stale-while-revalidate behavior is unchanged by this offline mode.

## Options and recommendation stack

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Keep leader pinned | No fallback regression | Ignores contrary content evidence | Live baseline for now |
| Unpin with rank fusion alone | Small change; broad coverage | Relative ranks are not confidence; can move a weak leader | Not selected |
| Require metadata/description agreement | Library-agnostic and inspectable | Lower coverage; correlated evidence can still be wrong | Evaluate now |
| Train another ranker | Potentially learn complex boundaries | Prior experiment lost agreement; more cost | Defer |

Recommended order: provenance-clean paired evaluation, examine gained/lost cases,
then validate any live advisory challenge through the existing response parser and
route-safety gate. Separate comparison order from fallback identity before live
adoption. Do not weaken safety or add user acknowledgements to improve coverage.

## Official research

URLs were discovered through web search and opened on 2026-09-20; these are live
documents, not archived proof of their exact contents throughout September.

- [Elastic reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
  explains combining ranks from different relevance measures. Application here:
  keep relative ranking separate from calibrated confidence or authorization.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance, bounded untrusted retrieval and independent output/action
  validation. Application here: reject known decision feedback and expose no writers.
- [Scikit-learn leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html)
  recommends splitting before learning. Application here: description-group folds
  and identical training boundaries for both policy observations and challengers.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  explains accessible, noninterrupting status updates and warns against chatty
  announcements. No UI is added here. A later live integration should reuse concise
  existing status/disclosure surfaces, not another evidence panel or modal.

The measured outcome and next implementation decision are recorded separately in
[the outcome document](inventory-leader-challenge-outcome.md).
