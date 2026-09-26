# Gap-directed capture admission: outcome

## Implemented

September 25, 2026. The [design](gap-directed-capture-design.md) follows the
independent diagnostic sweep in `afbbf4f5`. That commit exposed gaps throughout
the frozen cohort; this change improves spending within the current capture
window rather than adding another report or raising the allowance.

- Add a small, pure ESM admission service. Prefer a repairable pair needing one
  distinct response over one needing two; break ties using served movie/TV and
  observed-membership strata, then stable hashed case order. Membership is not a
  target label. Library names, genres, labels and confidence do not pick priority.
- Carry bounded, hashed admission metadata only in the explicitly requested
  private worker result. Reject unknown fields, unsupported media, missing keys,
  oversized batches and unexpected metadata on ordinary diagnostic responses.
- Keep canonical request order unchanged for durable checkpoint identity and
  publication. When retained responses differ from the original snapshot, replay
  them once through existing isolated evaluation before selecting missing work.
  Do not regenerate saved successes or rejected outputs. A changed exact request
  or model still follows existing provenance rules, not priority-based reuse.
- Keep known prerequisite failures and invalid responses out of generation
  admission. Preserve their records and diagnostic gaps. Shared requests are
  generated once when another repairable pair independently needs them.
- Check input freshness before generation and again before publication. Preserve
  durable reservations, charged unknown attempts, expiry, default-disabled
  inference and the recurring five-call ceiling. No new routing capability.
- Preserve the completion/replay acknowledgement handshake. Private capture
  `missing` now counts actionable admitted requests, not every uncached plan key.
  Zero means this admission batch is accounted for, **not** that every pair passed.
  Existing evaluation reports remain the source of blocked/invalid gap counts.

## Equal-budget experiment

Use 300 synthetic movie/TV cases, four anonymous library memberships and the same
12 windows of 25 cases. Each window contains ten two-response opportunities, ten
one-response opportunities, three blocked prerequisites and two seeded invalid
responses. Every generated response in this scheduling experiment is synthetic;
the controlled reducer accepts the same responses under either strategy.

| Strategy | New responses | Completed pairs |
| --- | ---: | ---: |
| Previous encounter order | 60 | 24 |
| Gap-directed admission | 60 | 60 |

Each strategy receives five calls per window. No labels select admission. Names
and supplied labels can change without changing these priorities. Repeated
five-call ticks complete all 20 repairable pairs in every stable window, including
the two-response cases; the five blocked/invalid pairs remain explicit. Shared
keys are unique and canonical plans are unchanged.

These numbers measure scheduling efficiency on a constructed fixture, **not**
live-library accuracy, model quality, token savings or a guaranteed production
improvement. Cost is measured here in calls; actual token use depends on prompts
and output, with the existing token reservation limit still enforced.

## Recovery and safety verification

- Real PostgreSQL: open a checkpoint in the old canonical order and seed three
  responses, including two rejected responses. Interrupt a later generation after
  reservation, restart repository ownership, and finish within five-call ticks.
  Exact checkpoint identity, creation time and expiry survive. Publication keeps
  canonical record order and the rejected evidence. One unknown attempt remains
  charged: 33 reservations for 32 retained responses, not an uncharged retry.
- Revisit the completed admission without further generation or renewed expiry.
  The independent diagnostic cursor remains untouched by capture.
- Exhausted, disabled or changed allowances reject before generation. Expiry
  during response handling rejects publication; the sent call remains charged.
- Reject invalid admission, changed canonical plans during retained replay,
  cancellation, source drift and changed model provenance. Ordinary worker
  results contain no admission metadata; production worker tests exercise the
  existing response reducer and privacy boundary separately from the synthetic
  scheduling reducer.

Focused verification passed: eight backend suites / 138 tests, plus four
PostgreSQL suites / 37 tests.

Full verification:

- Backend: 1,443 suites / 42,795 tests passed. Statements/lines 90.35%, branches
  84.26%, functions 92.23%. The new admission service has 100% statement, line,
  branch and function coverage.
- PostgreSQL: 165 suites / 1,907 tests passed, with one existing suite/test skipped.
- Frontend: 383 files / 5,338 tests passed. Statements 85.73%, branches 77.84%,
  functions 85.30%, lines 87.79%. The combined coverage ratchet passed.
- Chromium: the existing keyboard-pause, mobile-disclosure and access-loss
  clearing scenario passed. Production client build and type checks passed.
- Development/production dependency checks, static ESM imports, test mock shapes,
  copyright, migration/schema snapshot integrity and documentation lint passed.
- Lint passed with the pre-existing nonliteral-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.

## Recommendation stack and tradeoffs

Keep **pure ESM admission → isolated production replay → reserved exact-key
capture → PostgreSQL checkpoint/publication → protected aggregate reads →
pausable Vue SWR**. The official AWS, PostgreSQL, W3C and NIST sources and alternatives
are linked in the [design](gap-directed-capture-design.md).

Benefits: more completed comparisons under the same allowance, reusable crash
progress, bounded private metadata, no additional user acknowledgement and no
additional infrastructure. Costs: an extra bounded cached replay when retained
evidence differs; greedy, window-local ordering rather than a global optimum.
Freshly rejected output may make an already admitted partner unproductive within
that tick; the next tick incorporates that failure. Continuous source/model churn
can interrupt progress. Do not promise starvation freedom under changing inputs.

No UI or API contract change is needed. Existing SWR pause and accessibility
behavior is preserved; this is not a claim of full accessibility certification.

## Next component: independently labeled paired quality experiment

Implementation follow-through: [quality experiment design](source-pair-quality-experiment-design.md)
and [outcome and usage](source-pair-quality-experiment-outcome.md). Independent
labels are not supplied yet; no live quality improvement has been established.

The next milestone should answer **whether the decisions improve**, not add more
scheduling infrastructure. Build on the existing reference-set and evaluation
tools with one predeclared paired movie/TV experiment:

1. Freeze the evidence/model/policy revision and join independently verified
   reference labels by exact supported identity. Reuse genuine retained explicit
   feedback where eligible; do not treat silence, current placement, AI agreement
   or a model judging itself as ground truth. Report missing/conflicting labels.
   Correction-only labels are a selected error subset, not representative
   accuracy; keep that slice distinct from independently sampled reference cases.
2. Predeclare the cohort, reference eligibility, metrics and call/token ceiling.
   Compare both arms on identical eligible cases. Report correct and wrong
   proposals, abstentions, regressions and coverage separately for movie and TV;
   preserve the unpaired and unlabeled denominator instead of hiding failures.
3. Run cache-only evaluation first. Only perform additional local inference under
   the already configured allowance, and do not raise it automatically. Produce
   one reproducible outcome report, including uncertainty and cost, rather than
   another Command Center panel.
4. Stop at a measured recommendation. Inadequate independent labels mean
   insufficient evidence, not permission to promote routing automatically.

## PR and release scope

GitHub MCP queries found no open PR in `cloudbyday90/Classifarr`, including the
final availability check on September 25, 2026; therefore no random PR could be
selected or implemented. No PR was merged or closed.

No migration, dependency, version bump, release, tag, live deployment or real
model/provider request is part of this work. Local database tests use disposable
test databases, not the installed library. The existing persisted format is
unchanged; reverting this scheduling code can reuse its exact checkpoints.
