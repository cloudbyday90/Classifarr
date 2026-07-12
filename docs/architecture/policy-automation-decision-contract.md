# Policy Automation Decision Contract

## Status

Implemented as the durable policy automation decision contract.

This contract turns runtime evidence into a single server-owned automation
decision. It does not route media, write classifications, create questions,
write learning records, call providers, or persist native intent.

Decision construction now separates the explicit runtime-input adapter from the
projection-only reducer. The reducer accepts a verified runtime evidence
projection and operational decision facts; it rejects raw evidence fields.

## Problem

The existing runtime path historically allowed several states to blur together:

```text
candidate looks classified
candidate is safe to classify
candidate has a mapped Arr route
candidate was actually routed
candidate should ask an operator
candidate should wait for profile refresh
```

That ambiguity is exactly why a successfully classified item could fail to
reach Radarr/Sonarr while still looking complete. The automation decision
contract introduces a
bounded state contract so classification, routing, review, skip, refresh, and
block outcomes are explicit before any runtime behavior is rewired.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure development practices, common vocabulary, and reducing
  vulnerability root causes. This supports durable product-domain module names
  and explicit validation instead of temporary roadmap contract names.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides verification requirements for secure development. This supports
  allow-listed automation states, bounded traces, and no side effects during
  decision construction.
- [OWASP ASVS Validation And Business Logic](https://asvs.dev/v5.0.0/V2-Validation-and-Business-Logic/)
  emphasizes validating business rules and preventing workflow bypass. This
  supports separating classify-only, route-ready, review, mapping, stale
  profile, and blocked states.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  and [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  support stable, consistent telemetry naming. This contract keeps bounded
  `classifarr.runtime.decision.*` attributes and moves the payload version to a
  durable `policy.*` namespace.
- [NIST AI Risk Management Framework 1.0](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)
  supports governed, measured, and managed AI system behavior. This slice maps
  automation risks into explicit states instead of letting implicit model or
  heuristic output decide routing.
- [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/)
  frames the AI RMF as suggested actions for governance, mapping, measuring,
  and management outcomes. The contract follows that shape by separating
  evidence mapping from runtime action selection.

## Recommendation

Use a deterministic decision contract between runtime evidence projection and
runtime side effects.

The contract must answer:

```text
Can Classifarr route this automatically?
Can Classifarr record a classification but not route?
Should Classifarr ask an operator?
Is automation blocked?
Does this need route mapping?
Does this need a profile refresh?
Is evidence insufficient?
```

The decision contract must also carry the sanitized runtime evidence projection
fingerprint. That fingerprint is the server-owned proof that an automation
state was computed from a specific bounded evidence projection, not from raw
provider payloads, UI labels, or stale diagnostics.

## Pros And Cons

Pros:

- Makes classification success and routing success different states.
- Prevents missing Arr mappings from looking like completed routes.
- Gives runtime question reduction a clean input state.
- Keeps runtime decisions side-effect-free until integration is deliberate.
- Emits bounded trace reasons and attributes for audit and future telemetry.
- Binds automation decisions to a sanitized evidence fingerprint so later route
  execution can prove which evidence snapshot authorized the action.

Cons:

- Adds one more runtime contract before behavior changes.
- Requires later integration work before users see changed classification
  behavior.
- Conservative decisions may initially send more items to refresh/review until
  routing and evidence inputs are wired into the new engine.
- Requires downstream runtime wiring to preserve the fingerprint instead of
  rebuilding decisions from partial evidence.

## Final Recommendation Stack

1. Keep runtime evidence projection as the only evidence input.
2. Compute one policy automation state from server-owned evidence.
3. Require `auto_route_ready` to satisfy all gates:
   - strong destination identity,
   - hard limits satisfied,
   - avoid rules not in conflict,
   - concrete Arr route mapping,
   - current profile,
   - no high-risk evidence conflict.
4. Treat successful classification without mapped routing as
   `classified_not_routed`.
5. Use bounded decision traces with stable `classifarr.runtime.decision.*`
   attributes.
6. Require the decision evidence block and trace attributes to carry the same
   sanitized runtime evidence projection fingerprint.
7. Reject decision objects with missing, malformed, mismatched, or raw-provenance
   fingerprints.
8. Require the decision evidence block to carry the runtime evidence validation
   result, and require the trace `evidence_valid` attribute to match it.
9. Bind each state to one action, fixed permissions, canonical reasons, and a
   complete bounded trace attribute map. Reject any output that drifts from
   that tuple before later execution can act.
10. Keep the contract side-effect-free until a later runtime integration slice
   explicitly wires it to classification and Arr routing.
11. Keep runtime evidence construction outside the decision reducer. Use
    `buildPolicyAutomationDecisionFromRuntimeInput` for raw runtime inputs and
    `buildPolicyAutomationDecisionFromEvidenceProjection` for an existing
    runtime projection plus operational facts.

## Implemented Files

- Automation decision contract:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Decision output contract:
  `server/src/services/policyAutomationDecisionOutputContract.mjs`
- Focused tests:
  `server/src/__tests__/services/policyAutomationDecisionContract.test.mjs`
- Runtime evidence dependency:
  `server/src/services/policyRuntimeEvidenceProjection.mjs`
- Decision input-boundary outcome:
  `docs/architecture/policy-automation-decision-input-boundary.md`
- Roadmap owner:
  Automation Decision Contract in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_AUTOMATION_DECISION_STATE_IDS`
- `POLICY_AUTOMATION_DECISION_ACTION_IDS`
- `POLICY_AUTOMATION_DECISION_REASON_IDS`
- `POLICY_AUTOMATION_DECISION_AUDIT_RISK_IDS`
- `buildPolicyAutomationDecisionFromEvidenceProjection`
- `buildPolicyAutomationDecisionFromRuntimeInput`
- `buildPolicyAutomationDecisionContractAudit`
- `getAutomationDecisionState`
- `listPolicyAutomationDecisionStates`
- `validatePolicyAutomationDecision`

## Runtime States

`auto_route_ready`
: Strong identity, no block, fresh profile, no high-risk conflict, and concrete
  route mapping exist. Later integration may route.

`classified_not_routed`
: Classification may be recorded, but Arr routing is not mapped. This is not a
  completed route.

`needs_operator_review`
: Avoid evidence, outlier evidence, high-risk RAG evidence, or invalid runtime
  evidence requires human review.

`blocked_by_hard_limit`
: A hard-limit evaluation blocks automation.

`needs_routing_mapping`
: Destination identity exists, but Classifarr does not have enough route
  mapping context to classify or route safely.

`stale_profile_retry`
: Media-server profile evidence is stale and should be refreshed before
  automation.

`insufficient_evidence`
: Destination identity is not strong enough for automation.

## Security And Data Handling

- The contract does not call providers.
- Projection-only decision construction rejects raw runtime evidence fields.
- The contract does not expose raw provider payloads.
- The contract does not use UI chip labels as authority.
- The contract does not write classification, routing, question, or learning
  state.
- Validation fails if a decision claims side effects.
- Validation fails if `auto_route_ready` lacks strong identity or route mapping.
- Validation fails if the decision does not carry a sanitized runtime evidence
  projection fingerprint.
- Validation fails if decision fingerprint provenance exposes raw label,
  provider payload, or raw evidence keys.
- Validation fails if the trace fingerprint differs from the decision evidence
  fingerprint.
- Validation fails if runtime evidence validation proof is missing or the trace
  `evidence_valid` attribute drifts from the decision evidence block.
- Validation fails if action, permissions, reason records, or trace attributes
  drift from the selected server-owned decision state.

## Trace Shape

Decision traces are intentionally bounded:

```text
classifarr.runtime.decision.version
classifarr.runtime.decision.state
classifarr.runtime.decision.reason_count
classifarr.runtime.decision.identity_count
classifarr.runtime.decision.routing_count
classifarr.runtime.decision.strong_identity
classifarr.runtime.decision.route_mapped
classifarr.runtime.decision.evidence_valid
classifarr.runtime.decision.evidence_projection_fingerprint
```

Trace reasons are capped to prevent payload-like evidence dumps from becoming
logs.

The selected decision state also fixes the allowed action, automation
permission, routing permission, classification permission, and bounded reason
set. Trace fields are rebuilt from that output tuple and reject added or
modified fields.

## Test Coverage

The focused test suite verifies:

- all seven runtime states are present,
- `auto_route_ready` requires identity, routing, freshness, and risk gates,
- completed classification without route mapping becomes `classified_not_routed`,
- missing route mapping cannot look routed,
- hard-limit failures block automation,
- stale profile evidence triggers refresh,
- avoid and high-risk evidence require review,
- weak broad-genre evidence remains insufficient,
- decisions carry the sanitized runtime evidence projection fingerprint,
- decisions carry the runtime evidence validation result,
- fingerprint provenance does not expose raw labels,
- missing, malformed, raw-provenance, or trace-mismatched fingerprints fail
  validation,
- missing validation proof or mismatched trace evidence-valid attributes fail
  validation,
- unsafe route and side-effect claims fail validation,
- the component audit points to the runtime question reduction step.

## Outcome

The policy automation decision contract is now a deterministic runtime gate. It
gives the next runtime components a stable contract:

```text
runtime evidence projection
  -> automation decision state
  -> question reduction or runtime integration
```

The important behavior is not yet wired into live classification. That is
intentional. The contract first proves the decision boundary before any
classification or Arr-routing side effects move to the re-imagined engine.

## Next Step

Runtime question reduction should consume these decision states and
ensure questions are created only for review-worthy states, not for generic
genre conflicts or stale legacy diagnostic paths.
