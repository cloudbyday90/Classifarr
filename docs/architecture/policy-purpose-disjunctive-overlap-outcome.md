# Policy Purpose Disjunctive-Overlap Review Outcome

Implemented: 2026-08-29.

## Delivered

Classifarr's policy purpose coverage review and policy-editor draft preflight
now carry rule-operator provenance only while computing server-side aggregates.
They report these new bounded fields:

- `sharedRequireAnyTermCount`
- `sharedRequireAnyDestinationCount`

If either review finds a shared `require_any` alternative, the policy receives
the existing `broad_overlap_review_required` status even when another term is
unshared. The UI calls this out as **Shared “any” alternatives** and gives
fixed maintenance guidance. It does not disclose the matching terms.

## Outcome for the Current Configuration Pattern

The earlier report could label a broad destination as distinct because a
single specialized sibling appeared beside a shared `require_any` fallback.
The new outcome instead tells the operator to review that fallback. This is the
right maintenance signal for the current movie/family/anime-style overlap: do
not lower the automatic-route threshold to compensate for a broad identity
rule. Narrow the shared alternative or introduce an explicit destination-
specific identity signal, then re-run the advisory review.

For a pending item such as the investigated 71/100 movie candidate, this
change does not retroactively reroute it. The deterministic score, thresholds,
and advisory AI result remain separate. The operator can safely confirm that
individual item while reviewing the policy configuration for future precision.

## Security and Behavior Guarantees

- The report remains administrator-only at the existing endpoint boundary.
- PostgreSQL compares terms internally and returns counts only.
- The draft preflight validates the draft, uses it transiently, and does not
  persist it.
- No AI call, prompt, model output, RAG lookup, classification lookup, policy
  write, learning update, threshold change, or routing operation occurs.
- Existing runtime authority and route-safety gates remain unchanged.

## Verification

Focused verification completed locally:

- Server unit contract, persistence, and service tests: 11 passed.
- Server PostgreSQL integration tests for review and preflight: 2 passed.
- Vue review and preflight component tests: 3 passed.

The integration case includes three active destinations sharing an `any`
alternative and a fourth policy with that shared alternative plus one unique
term. The mixed policy is correctly reported as broad-overlap review required,
and assertions verify that neither shared nor unique terms appear in the
returned JSON.

Full repository quality gates also passed:

- Server unit suite: 874 suites and 25,360 tests passed.
- Client suite: 248 files and 3,624 tests passed.
- Server and client lint, type checks, and the production client build passed.
- A complete security diff review found no reportable issues across the
  authorization boundary, SQL aggregation, browser rendering, tests, and
  documentation.

## Recommendation

Adopt this review result before changing automatic thresholds. The next
implementation should be an explicitly invoked, administrator-only cohort
simulator that uses the runtime policy evaluator against a bounded historic
sample and returns aggregate prediction deltas. It should stay read-only and
must not use AI or route media.
