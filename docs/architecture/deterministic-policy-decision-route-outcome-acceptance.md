# Deterministic Policy Decision And Route Outcome Acceptance

## Status

Phase 10R, Task 10R.1.2 is complete as of 2026-08-08. This document records
the security decision, the isolated acceptance boundary, and the implemented
route-provenance hardening.

## Problem

The native policy path already evaluates current policy before asking an AI
provider. When the policy returns `auto_classify`, it returns a `policy_auto`
classification without calling AI. The routing boundary nevertheless trusted
the `policy_auto` method label by itself.

That was too weak a provenance contract. A malformed intermediate result, or an
AI-derived candidate incorrectly relabeled as `policy_auto`, could inherit the
policy route allowance. It must instead prove a current deterministic policy
result with the same selected library. A successful classification and a
successful route must also remain separately observable: a routing mapping can
be absent even when a policy decision is valid.

## Research Basis

- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  recommends downstream complete mediation: an LLM must not decide whether a
  downstream action is permitted. The route boundary therefore verifies policy
  provenance instead of trusting an upstream label.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  frames AI risk management as continuous governance, mapping, measurement,
  and management. Its testing guidance supports explicit acceptance evidence
  for each observable decision outcome rather than a single generic success
  assertion.

## Options Considered

### Trust the classification method label

Pros:

- Minimal routing code.

Cons:

- A label is not proof of deterministic policy authority.
- AI authority metadata could be bypassed by a mislabeled candidate.
- Cannot distinguish a valid policy result from a malformed intermediate one.

Decision: rejected.

### Route all high-confidence classifications

Pros:

- More automatic routes.

Cons:

- Reintroduces AI and non-final candidates into a side-effecting decision.
- Conflicts with the server-owned authority model and complete mediation.

Decision: rejected.

### Verify deterministic provenance at the routing boundary

Pros:

- Requires `policy_auto`, a current `auto_classify` policy result, and a
  matching library before the policy route allowance is granted.
- AI-derived and advisory results remain blocked even if they retain policy
  context or lose their authority projection.
- Leaves normal deterministic policy routing and routing-mapping diagnostics
  intact.

Cons:

- Historical or malformed callers that emit a bare `policy_auto` label now
  receive a review-safe no-route outcome.

Decision: selected.

## Recommendation Stack

1. Treat the current deterministic policy result, not a classification method
   string, as the only source of `policy_auto` route authority.
2. Require the policy action to be `auto_classify` and its selected library to
   match the classification result.
3. Deny any AI-derived or advisory candidate before threshold evaluation,
   including one that is incorrectly labeled `policy_auto`.
4. Convert missing policy-auto provenance into a server-owned question-required
   result and an explicit `invalid_policy_auto_provenance` routing reason.
5. Test routed, classified-not-routed, blocked, and question-required results
   through real policy and route service boundaries without external systems.

## Implemented Outcome

`classificationRoutingServiceShared.mjs` now owns
`isCurrentDeterministicPolicyAuto`. It validates the method, current policy
action, and selected-library identity. The routing service exports that helper
for callers that need the same authority rule.

`ClassificationService.buildAutoRouteDecision` now first blocks AI authority,
then grants `policy_auto` routing only when the provenance check succeeds. A
bare or mismatched `policy_auto` result returns the explicit safe reason
`invalid_policy_auto_provenance`. The runtime-question boundary also requires
review when that malformed state appears before routing.

The isolated integration fixture uses the real policy engine and disposable
PostgreSQL database to produce an `auto_classify` decision. It verifies:

- the native policy result reaches a routed outcome without an AI call;
- a missing Arr mapping remains a classified-but-not-routed outcome;
- AI-derived and AI-authority-mislabeled candidates cannot inherit the policy
  route decision;
- a question-required result cannot route; and
- a `policy_auto` label without current policy provenance cannot route.

The fixture never connects to an Arr server, accesses a provider credential, or
makes an outbound request.

## Evidence

- Route provenance and review boundary:
  `server/src/services/classificationRoutingServiceShared.mjs`.
- Automatic route decision:
  `server/src/services/classificationServiceCore.mjs`.
- Isolated acceptance suite:
  `server/src/__tests__/integration/deterministic-policy-route-outcome-acceptance.test.mjs`.

## Next Task

Proceed with **10R.1.3 Provider Failure And Recovery Acceptance**. It must
prove that disabled, unavailable, malformed, and transient provider outcomes
cannot create an automatic route, hide a deterministic policy outcome, or
expose non-bounded diagnostics.
