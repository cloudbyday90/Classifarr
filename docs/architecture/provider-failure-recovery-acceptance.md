# Provider Failure And Recovery Acceptance

## Status

Phase 10R, Task 10R.1.3 is complete as of 2026-08-08. This document records
the provider-failure recovery decision, its security constraints, and the
isolated acceptance evidence.

## Problem

Native policy evaluation can produce strong deterministic evidence before a
provider is consulted. The former provider-failure fallback retained that
evidence, but a non-transient failure could produce a high-confidence
`signal_calculation` result that met the policy route threshold. That made a
provider failure capable of changing a review-safe outcome into an automatic
route.

The platform must distinguish two independent cases:

1. A current deterministic `policy_auto` result must bypass AI entirely and
   retain its route authority.
2. A path that actually experiences a provider failure may retain policy
   evidence, but must enter bounded retry or review recovery and receive no
   route authority from that recovery.

## Research Basis

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for systems to fail safely and for incident response, recovery, and
  change management to be monitored as operating controls. This supports an
  explicit, testable recovery state instead of an implicit fallback route.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  identifies third-party provider failure, monitoring, and fallback behavior
  as generative-AI risks. The recovery outcome therefore does not contain a
  provider exception, credential, endpoint, or generated text.
- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  recommends complete mediation for downstream actions. The route boundary
  independently rejects provider recovery even if an upstream caller skips
  question normalization.

## Options Considered

### Route strong deterministic signals after a permanent provider failure

Pros:

- Preserves the highest possible automation rate.
- Requires no additional result state.

Cons:

- A provider failure changes route eligibility.
- A later caller could skip question normalization and still route.
- Makes operational failure indistinguishable from a completed decision.

Decision: rejected.

### Retry every provider failure indefinitely

Pros:

- Avoids a route after failure.

Cons:

- Permanent configuration, authorization, and malformed-output failures do
  not recover through repeated retries.
- Conceals retained deterministic policy evidence from review.

Decision: rejected.

### Use a bounded recovery projection with independent route mediation

Pros:

- Retry outcomes, including transient or disabled availability failures and
  low-confidence fallback, queue a bounded retry.
- Permanent failures with preserved deterministic policy evidence require a
  server-owned review question.
- The route boundary rejects every recognized recovery projection as defense
  in depth.
- Only a version and mode are retained; exception text and credentials cannot
  cross into classification state.

Cons:

- Some previously auto-routable high-confidence fallback candidates now wait
  for review after a provider failure.

Decision: selected.

## Recommendation Stack

1. Evaluate current deterministic policy before provider invocation and route
   only a provenance-valid `policy_auto` result.
2. Attach `provider_recovery.v1` only to results produced after a provider
   failure. Use `retry_queued` for transient or disabled availability and
   `review_required` for permanent fallback.
3. Preserve the policy result and suggested destination for review, but do not
   treat recovery as policy route authority.
4. Require a server-owned question for `review_required` and deny all known
   recovery projections at the route boundary.
5. Keep aggregate provider telemetry to fixed counters. Do not persist raw
   exception text, credentials, endpoint details, model output, or item
   metadata.

## Implemented Outcome

`classificationProviderRecovery.mjs` owns the versioned, two-mode recovery
projection. A malformed or unrecognized recovery projection fails closed to
review and no-route rather than becoming an authority bypass.
`classificationPathServiceShared.mjs` attaches that projection to every
provider-failure result:

- `retry_queued` for disabled or transient availability failures; and
- `review_required` for permanent failures, including a high-confidence signal
  fallback.

`classificationRoutingServiceShared.mjs` sends review-required recovery
results through the existing server-owned question boundary.
`ClassificationService.buildAutoRouteDecision` independently returns
`provider_recovery_required` for any valid recovery projection before AI,
policy-provenance, or threshold route evaluation.

Malformed provider output remains an AI-advisory, question-required result;
it cannot receive route authority. Existing provider capability metrics remain
fixed counter deltas, and the acceptance suite asserts that exception text is
not retained.

## Acceptance Evidence

`server/src/__tests__/integration/provider-failure-recovery-acceptance.test.mjs`
uses the disposable integration database, real policy-path service, real
question boundary, and an in-process provider double. It verifies:

- a deterministic policy-auto decision does not call a disabled provider and
  remains route-eligible;
- disabled and transient provider failures return a no-candidate bounded
  retry state;
- a permanent provider failure preserves policy evidence but requires review
  and cannot route;
- malformed provider output remains question-required and non-routable; and
- aggregate metrics exclude the provider exception text.

The suite has no provider credentials, provider connections, media-server
connections, classification writes, policy writes, learning action, or
notification action.

## Next Task

Proceed with **10R.2 Existing-Installation Lifecycle Acceptance**. Build the
installation-agnostic conversion matrix and prove automatic, idempotent native
policy reconciliation across valid existing configurations.
