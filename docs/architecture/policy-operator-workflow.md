# Policy Operator Workflow

## Status

Implemented as the durable server-owned policy operator workflow projection.

This document defines the product workflow projection that the policy builder
should render. It does not replace the Vue modal yet, persist policy, execute
routing, run provider checks, run replay, or expose migration verifier
diagnostics in the normal operator flow.

The pure projection remains available for focused tests and internal
composition, but runtime and rebuild callers should use the bounded workflow
entry point. That entry point requires successful bounded intent and readiness
results before a workflow projection is returned. It also requires the upstream
intent, evidence-fingerprint, and readiness audits to still be passing so stale
or tampered bounded contracts cannot render as an operator workflow. The
boundary requires matching, usable, sanitized evidence-quality snapshots from
bounded intent, readiness boundary context, and embedded readiness input context
before returning the workflow. It also requires the approved decision-source
admission from bounded readiness to match the sanitized source summaries in
both readiness contexts before returning the workflow.

Intent entries are projected through
[Policy Operator Workflow Entry Normalizer](policy-operator-workflow-entry-normalizer.md)
before they reach a section. The normal workflow receives bounded display fields
only, never raw evidence or configuration objects.

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

The operator workflow turns server-owned policy contracts into a simple product
surface:

```text
What belongs here?
What should not go here?
What helps but should not decide alone?
When should Classifarr ask?
Can this route?
```

## Official Guidance Reviewed

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) includes guidance for labels,
  instructions, error identification, and status messages. The workflow uses
  one plain question, helper text, status, and next action per section.
- [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/)
  emphasizes clear grouping, labels, instructions, and accessible form
  controls. The workflow groups destination setup into five sections with
  explicit control kinds.
- [W3C WAI Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  explains that grouping related controls makes forms easier to understand and
  navigate. The workflow keeps destination questions in small, related groups.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. The workflow
  keeps readiness and learning server-owned, reason-coded, and auditable.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  supports server-side validation and business-logic controls. The workflow
  explicitly prevents client-side direct persistence, routing execution, and
  diagnostic-panel authority.
- [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
  describes propagating causal context across boundaries. The workflow carries
  only sanitized evidence projection fingerprints and audit booleans to
  correlate handoffs without exposing raw evidence labels.

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
   The route/readiness section is read-only. It reports the policy automation
   readiness state and next action; it does not execute routing.

4. **Treat old diagnostics as exclusions from the normal flow.**
   Impact preview, replay preview, replay parity, provider gates, provider
   readiness, TMDB coverage, raw scoring, and diagnostic panels are explicitly
   excluded from the normal workflow.

5. **Keep client behavior subordinate to server contracts.**
   The workflow projection can be rendered by Vue, but the client does not own
   readiness, policy persistence, learning, or routing execution.

6. **Require bounded readiness before workflow projection.**
   Runtime and rebuild flows should call the bounded workflow wrapper. It
   blocks failed bounded intent/readiness handoffs and rejects missing or
   mismatched evidence projection fingerprints.

7. **Require quality continuity before workflow projection.**
   The bounded workflow wrapper should block missing, insufficient, or
   mismatched evidence-quality snapshots so the normal operator workflow cannot
   render from incomplete evidence state.

8. **Keep labels stable and accessible.**
   Workflow headings, questions, helper text, status, and actions should stay
   plain-language and durable so UI and telemetry can reuse the same server
   contract without roadmap-specific labels.

9. **Retain verified decision-source provenance.**
   The bounded workflow wrapper should require matching, approved source
   summaries from the readiness admission result, readiness boundary context,
   and embedded readiness input context. It carries only the verified source
   ID, decision version, and admission state into workflow context.

## Pros And Cons

Pros:

- Gives the UI a simple destination-first contract before changing components.
- Prevents old diagnostic panels from being treated as workflow requirements.
- Aligns section copy with durable user terms and policy engine fields.
- Uses the readiness engine directly instead of duplicating routing logic in the
  client.
- Creates an audit target for later deletion/migration work.
- Prevents the UI workflow from stitching together intent and readiness results
  from different evidence projections.
- Prevents the UI workflow from rendering when the underlying evidence quality
  is missing, insufficient, or drifted across bounded contracts.
- Prevents a reconstructed readiness handoff from concealing an unapproved or
  mismatched upstream decision source.

Cons:

- This contract does not yet remove existing Vue panels.
- It does not add a new endpoint for the projection.
- It does not persist native policy intent.
- It does not decide which old replay/provider services are migration verifiers
  versus deletion targets.
- Existing pure projection callers still exist for compatibility until runtime
  paths move onto the bounded wrapper.
- Quality checks add another fixture invariant for bounded workflow tests.
- Bounded readiness fixtures must retain their admitted source summaries.

## Final Recommendation Stack

- Evidence input:
  `server/src/services/policyEvidenceEngine.mjs`
- Intent input:
  `server/src/services/policyIntentEngine.mjs`
- Readiness input:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Operator workflow projection:
  `server/src/services/policyOperatorWorkflow.mjs`
- Bounded workflow wrapper:
  `buildPolicyOperatorWorkflowFromBoundedReadiness`
- Test module:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`
- Documentation:
  `docs/architecture/policy-operator-workflow.md`
- Quality gate documentation:
  `docs/architecture/policy-operator-workflow-quality-gate.md`
- Decision-source provenance documentation:
  `docs/architecture/policy-operator-workflow-decision-source-provenance.md`
- Roadmap owner:
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
boundaryContext
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

The bounded wrapper returns:

```text
ok
statusId
boundaryContext
workflow
workflowAudit
issueCount
issues[]
nextStep
```

Supported bounded wrapper status IDs:

```text
ready
blocked_by_bounded_input
blocked_by_workflow_audit
```

The boundary context carries only sanitized contract metadata:

```text
intentBoundary.statusId
intentBoundary.intentVersion
intentBoundary.intentAuditOk
intentBoundary.projectionFingerprint
readinessBoundary.statusId
readinessBoundary.readinessStateId
readinessBoundary.readinessAuditOk
readinessBoundary.decisionSource.sourceId
readinessBoundary.decisionSource.decisionVersion
readinessBoundary.decisionSource.admitted
readinessBoundary.evidenceQuality
readinessBoundary.intentQuality
readinessBoundary.learningQuality
readinessBoundary.projectionFingerprint
readinessBoundary.projectionFingerprintMatch
projectionFingerprintMatch
qualityMatch
```

## Security Outcome

- The workflow does not execute routing.
- The workflow does not persist policy intent.
- The workflow does not expose raw provider or diagnostic payloads.
- The readiness section is read-only.
- The audit rejects internal diagnostic language, missing sections, missing
  questions, missing primary actions, diagnostic surfaces in the normal flow,
  direct execution, direct persistence, and raw payload exposure.
- The bounded wrapper rejects failed bounded intent/readiness contracts, missing
  bounded provenance, mismatched projection fingerprints, and non-passing
  upstream bounded intent/evidence-fingerprint/readiness audits before the
  workflow is returned.
- The bounded wrapper rejects missing, insufficient, or mismatched sanitized
  evidence-quality snapshots before the workflow is returned.
- The bounded wrapper rejects a missing, unapproved, incompatible, or
  mismatched decision-source admission before the workflow is returned.

## Next Step

Continue with **Policy Migration Deletion Path Architecture Cutover**. That
component should consume only quality-gated bounded workflow results before
classifying old diagnostic surfaces as verifier machinery or deletion targets.
