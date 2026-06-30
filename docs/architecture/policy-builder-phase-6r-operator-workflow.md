# Policy Builder Phase 6R Operator Workflow Rebuild

## Status

Implemented as the fifth Phase 6R engine contract.

This slice defines the server-owned product workflow projection that the policy
builder should render. It does not replace the Vue modal yet, persist policy,
execute routing, run provider checks, run replay, or expose migration verifier
diagnostics in the normal operator flow.

## Problem

The prior builder accumulated panels that asked operators to reason about
implementation mechanics:

```text
impact preview
replay preview
provider readiness
TMDB coverage
raw scoring
```

That conflicts with the re-imagined goal. Policy setup should start from the
media-server library and ask only the small set of questions needed to confirm
destination intent.

Phase 6R.5 turns the engine contracts into a simple workflow target:

```text
What belongs here?
What should not go here?
What helps but should not decide alone?
When should Classifarr ask?
Can this route?
```

## Official Guidance Reviewed

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) includes guidance for labels,
  instructions, error identification, and status messages. The workflow uses one
  plain question, helper text, status, and next action per section.
- [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/)
  emphasizes clear grouping, labels, instructions, and accessible form controls.
  The workflow groups destination setup into five sections with explicit control
  kinds.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. The workflow
  keeps readiness and learning server-owned, reason-coded, and auditable.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  supports server-side validation and business-logic controls. The workflow
  explicitly prevents client-side direct persistence, routing execution, and
  diagnostic-panel authority.

## Recommendations

1. **Render destination sections, not diagnostic panels.**
   The normal policy-builder path should render:
   - `what_belongs_here`,
   - `what_should_not_go_here`,
   - `what_helps_but_should_not_decide_alone`,
   - `when_should_classifarr_ask`,
   - `can_this_route`.

2. **Keep one primary action per section.**
   The UI should not ask operators to compare multiple internal mechanics. Each
   section has one primary action and one target.

3. **Use server-owned readiness.**
   The route/readiness section is read-only. It reports the Phase 6R readiness
   state and next action; it does not execute routing.

4. **Treat old diagnostics as exclusions from the normal flow.**
   Impact preview, replay preview, replay parity, provider gates, provider
   readiness, TMDB coverage, raw scoring, and diagnostic panels are explicitly
   excluded from the normal workflow.

5. **Keep client behavior subordinate to server contracts.**
   The workflow projection can be rendered by Vue, but the client does not own
   readiness, policy persistence, learning, or routing execution.

## Pros And Cons

Pros:

- Gives the UI a simple destination-first contract before changing components.
- Prevents old diagnostic panels from being treated as workflow requirements.
- Aligns section copy with Phase 0R user terms and Phase 6R engine fields.
- Uses the readiness engine directly instead of duplicating routing logic in the
  client.
- Creates an audit target for later deletion/migration work.

Cons:

- This slice does not yet remove existing Vue panels.
- It does not add a new endpoint for the projection.
- It does not persist native policy intent.
- It does not decide which old replay/provider services are migration verifiers
  versus deletion targets.

## Final Recommendation Stack

- Evidence input:
  `server/src/services/policyBuilderPhase6EvidenceEngine.mjs`
- Intent input:
  `server/src/services/policyBuilderPhase6IntentEngine.mjs`
- Readiness input:
  `server/src/services/policyBuilderPhase6ReadinessEngine.mjs`
- Operator workflow projection:
  `server/src/services/policyBuilderPhase6OperatorWorkflow.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6OperatorWorkflow.test.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-6r-operator-workflow.md`
- Roadmap owner:
  Phase 6R.5 Operator Workflow Rebuild in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The workflow shape is:

```text
version
workflowId
title
summary
sectionOrder
sections[]
readiness
normalWorkflowExclusions[]
decisionModel
```

Each section contains:

```text
sectionId
heading
plainQuestion
helperText
termIds
intentFieldIds
controlKindId
editable
statusId
primaryAction
entries[]
readiness
executesRouting = false
persistsPolicy = false
exposesRawPayload = false
```

## Security Outcome

- The workflow does not execute routing.
- The workflow does not persist policy intent.
- The workflow does not expose raw provider or diagnostic payloads.
- The readiness section is read-only.
- The audit rejects internal diagnostic language, missing sections, missing
  questions, missing primary actions, diagnostic surfaces in the normal flow,
  direct execution, direct persistence, and raw payload exposure.

## Next Step

Proceed to **Phase 6R.6 Migration And Deletion Path**. That component should
classify replaced policy-builder diagnostics as migration verifier machinery or
delete targets, with explicit rollback and removal criteria.
