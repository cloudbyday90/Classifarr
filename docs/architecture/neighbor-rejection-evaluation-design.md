# Neighbor rejection evaluation design

## Scope and finding

The exact-neighbor experiment improved held-out placement agreement, but did not
test unfamiliar-content behavior. Inspection also found that its acceptance
contract checked result versions and snapshot-ID shapes without binding results
to the evaluated item. A valid-shaped result from another query could therefore
be accidentally reused in this offline evaluation. This is not evidence of a
live routing vulnerability: these services have no live routing consumer.

## Selected design

1. Bind familiarity and exact-neighbor results to an opaque context digest covering
   the validated corpus/representation, item identity, description hash, full
   exclusion set and omitted-library scope. Require the expected context from the
   trusted evaluator during exact acceptance. Digests are consistency checks, not
   signatures or authorization credentials.
2. Automatically exercise invalid queries and mutated acceptance evidence on the
   nominated cases. Count only expected validation failures as successful rejection;
   unexpected exceptions, cancellation and budget failures are never passing tests.
3. Select up to three exclusive description groups per library, at most thirty
   overall, before observing outcomes. Use one existing outer fold per library.
   Withhold that library from both references and candidate comparisons, refit the
   exact margins, and measure support among remaining libraries. Reuse bounded
   immutable pair scores, not fitted decisions, across these scopes.
4. Keep integrity rejection separate from semantic novelty. Removing a library
   does not prove its content is unsuitable for other libraries. Report familiarity,
   distinction and combined support; do not label these probes as known errors or
   claim unknown-content accuracy. Preserve ordinary paired placement results.
5. Keep discovery locks, memory/time/work/cache/model caps, whole-group and retained
   decision exclusions, end-of-run source verification and all policy vetoes.
   No provider generation, synthetic embedding substitution, data writes, new UI,
   operator acknowledgement, dependency or release is needed.

## Tradeoffs and final recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Schema checks alone | Cheap | Do not bind evidence to the item; insufficient |
| Context-bound results plus corruption controls | Detects accidental stale/mixed evidence, little extra compute | Not authentication; implement |
| Library-withheld content probes | Organic, library-name agnostic, no new labels or provider cost | Membership is not semantic ground truth; implement as stress diagnostics |
| Random synthetic embedding noise | Cheap numeric stress | Not realistic media semantics; do not claim novelty from it |
| Immediate live promotion | Could reduce reviews | Rejection/correctness not established; defer |

Recommended stack: validated snapshot → strict query/context binding → grouped
exact retrieval → familiarity and distinctness → automatic corruption/withheld
library evaluation → existing policy safeguards. Independent semantic evaluation
remains necessary before claiming accuracy or loosening routing gates.

## Official sources checked on 2026-09-20

URLs were discovered by search and opened through the web tool. This is current
September guidance, not a historical snapshot certification.

- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends integrity verification, cache isolation/invalidation, downstream
  policy enforcement and fail-closed behavior. The context binding applies those
  principles within this offline evaluator without granting new authority.
- [scikit-learn novelty detection example](https://scikit-learn.org/stable/auto_examples/neighbors/plot_lof_novelty_detection.html)
  distinguishes unseen-data evaluation from scoring the training data. We retain
  whole-description held-out groups; no LOF dependency or model change is proposed.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  explains accessible status feedback and cautions against excessive announcements.
  This change adds no user-facing alerts or approval tasks. Future summaries should
  present actionable outcomes rather than announce each internal control.

See the [outcome](neighbor-rejection-evaluation-outcome.md) for measured results.
