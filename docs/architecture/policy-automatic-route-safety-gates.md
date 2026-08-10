# Policy Automatic-Route Safety Gates

Status: implemented. This document defines the server-owned explanation for a
policy candidate that has reached a numeric threshold but cannot yet route to
an Arr service automatically.

## Problem

A policy score is evidence, not an authority grant. Before this change, the
runtime correctly held several unsafe or incomplete outcomes for review, but
the operator card reduced every high-score block to "another safety gate".
That made a 90/100 candidate against an 85 automatic threshold look like a
threshold failure even when the real block was AI authority, weak evidence,
provider recovery, or stale route provenance.

## Research And Recommendations

NIST describes the AI Risk Management Framework as a voluntary framework for
incorporating trustworthiness into the design, development, use, and evaluation
of AI systems. Its Playbook organizes suggested actions under Govern, Map,
Measure, and Manage rather than prescribing a universal checklist. This supports
separating a model's advisory contribution from the deterministic authority that
causes an external side effect. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
and the [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/)
were reviewed on 2026-08-10.

Options considered:

1. Treat every score at or above the automatic threshold as routable.
   - Pros: fewer pending decisions and simple explanation.
   - Cons: allows an AI-derived or stale-provenance result to create an Arr
     side effect. Rejected.
2. Add UI-only wording for common review states.
   - Pros: small client-only change.
   - Cons: cannot prove which gate actually applied, drifts from the route
     decision, and cannot explain persisted history. Rejected.
3. Resolve ordered, server-owned gates once and expose a bounded projection.
   - Pros: one decision source for route prevention, persistence, API output,
     and UI; exact operator explanation; no prompts, provider output, or
     credentials are retained.
   - Cons: adds a small compatibility projection and requires a retry for old
     records to receive full persisted context. Selected.

## Final Stack

- `classificationRouteSafetyGate.mjs` owns the versioned gate vocabulary and
  ordering.
- `ensureDecisionQuestion` uses that same resolver to decide whether an item
  requires an operator question and to assign a concise pending reason.
- `classificationPersistenceService` stores only allow-listed gate IDs, labels,
  and messages under `metadata.classification_details.route_safety`.
- The existing decision-summary v1 contract gains additive `safety_gate` and
  `additional_safety_gates` fields. The version remains v1 because existing
  readers can safely ignore additive fields.
- The Command Center shows the primary safeguard directly and collapses any
  secondary safeguards.

## Gate Authority And Order

The resolver retains up to four gates, with the first as the primary operator
explanation. Order is intentional:

1. Provider recovery review.
2. Policy manual-evidence review, including weak primary evidence or weak
   overlap.
3. Policy confirmation or destination selection outcome.
4. Invalid `policy_auto` provenance.
5. AI advisory authority block.
6. Missing, invalid, or below-threshold candidate policy score.
7. Installation-wide confirmation setting.
8. Fallback result, low confidence, or an explicit clarification request.

Only a result with all of the following may route automatically:

- `method` is `policy_auto`.
- The current deterministic `policyResult.action` is `auto_classify`.
- The result library matches the policy-selected library.
- No other route-safety gate applies.

Therefore a 90/100 score with an 85 automatic threshold is intentionally held
when it arrived through `ai_verified`: the AI can align with the policy
candidate, but it cannot independently authorize an Arr write. The card now
states that exact reason instead of claiming missing evidence or an unnamed
safety gate.

## Security And Compatibility

The persistence projection is allow-listed and bounded. It rejects unrecognized
gate IDs and excludes pending-internal reasons, prompts, raw model output,
provider exceptions, endpoints, and credentials. Existing records receive a
best-effort explanation from their stored method and policy result. A high-score
historic record that lacks enough retained state now reports `historical_route_safety_details_unavailable` and requires a retry; it never invents an old gate or treats the score as authorization. A new retry persists the complete gate projection. No database migration is required because the projection is additive JSON metadata.

## Verification

- Server unit coverage verifies valid deterministic auto routing, 90/85 AI
  advisory blocking, weak-evidence precedence, provider recovery, projection
  sanitization, question generation, and decision presentation.
- Client component coverage verifies the routing-safeguard presentation and
  existing confirmation actions.
- Client tooling maintenance is applied locally from Dependabot PR #510 using
  the exact `globals` 17.9.0, `postcss` 8.5.26, and `vite` 8.2.1 package
  updates. GitHub's official [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
  was reviewed for the repository's grouped-update workflow.
