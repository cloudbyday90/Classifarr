# Policy Authoring User Mental Model

## Status

Current production contract. Updated on 2026-07-31 by the Phase 6R.5 setup-card
contract retirement.

## Purpose

`server/src/services/policyUserMentalModel.mjs` supplies the small shared
vocabulary needed by active policy services. It is not a setup wizard, UI
layout, persistence contract, or workflow engine.

The live destination-first workflow is owned by
`server/src/services/policyOperatorWorkflow.mjs`. Native intent, evidence,
readiness, routing, persistence, and migration retain their existing dedicated
server contracts.

## Retained Contract

| Primitive | Active use | Boundary |
| --- | --- | --- |
| `POLICY_UX_TERM_IDS` | Draft, evidence, workflow, and question/learning services share stable destination-first term IDs. | IDs only; they do not define UI copy, selection state, or authority. |
| `POLICY_SETUP_FIELD_CONTROL_KIND_IDS` | The operator-workflow service labels its five server-owned sections with their allowed control shape. | Control kinds do not authorize a browser action or a policy write. |
| `includesInternalPolicyLanguage()` | Accessibility, evidence, and workflow audits reject diagnostic wording on normal product surfaces. | Phrase detection is a guardrail, not authorization or input validation. |

## Retired Contract

The following unconsumed four-step setup model was removed:

- setup questions, steps, cards, surface roles, and journeys;
- setup copy, field-group, and answer-shape records;
- associated list/get/validation/audit functions and risk-ID enums;
- copy and broad-genre phrase audits that had no live service caller.

No active policy service imported those records. Keeping them would have left a
second, obsolete representation of a workflow that now comes directly from the
server-owned five-section operator projection.

## Security And Accessibility Boundaries

- Client state is never workflow authority. Policy writes and automation
  decisions remain server-validated.
- The workflow service owns current questions, editable state, readiness, and
  next action. Shared IDs cannot recreate card sequencing or local progress.
- Normal operator-facing text excludes internal scoring, provider, replay, and
  diagnostic terminology through the retained guard.

## Verification

`server/src/__tests__/services/policyUserMentalModel.test.mjs` protects the
three retained exports and proves obsolete setup-card exports do not return.
Focused workflow, evidence, draft-contract, learning-vocabulary, and
accessibility suites protect each active consumer.
