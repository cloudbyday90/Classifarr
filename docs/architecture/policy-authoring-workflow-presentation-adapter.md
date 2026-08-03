# Policy Authoring Workflow Presentation Adapter

Date: 2026-08-02

## Outcome

Phase 4R.2 is complete. The policy-authoring read response now includes the
versioned `policy.authoring_workflow_presentation.v1` display projection. It is
the bounded page-level model for a destination proposal, one next action,
adjustment availability, and automated recovery status.

The server builds a revision-bearing projection from the existing workflow and
audits it before the response is accepted. The Vue client validates the exact
schema, selected library, authority flags, action type, recovery consistency,
and raw-data flags. It then deep-freezes a smaller view model. Invalid input
returns one unavailable, non-actionable model; the detailed shell is not
rendered.

This change deliberately did not bind create, save, adjustment, or recovery
actions. Phase 4R.3 now supplies that action boundary; see [Policy Authoring
Action Binding And Feedback](policy-authoring-action-binding-and-feedback.md).

## Guidance Reviewed

- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires programmatically determinable updates without unnecessary focus
  movement. The shell has one status priority: returned error, save, load,
  local navigation, automatic recovery, then no message.
- [Vue composables](https://vuejs.org/guide/reusability/composables) describes
  composables as the place for reusable stateful logic. The request identity
  check remains in `usePolicyOperatorWorkflow`; a stale response cannot replace
  the selected library.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends validating untrusted input and rejecting unexpected data. Both
  server audit and client adapter use an allowlist schema and fail closed.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  supports type, length, format, and range validation. Identifiers, labels,
  counts, revisions, authority, and action kinds are therefore bounded before
  the view model is usable.

## Options

### Render The Broad Workflow Response

Pros: no additional contract.

Cons: the component can retain more server data than it needs, browser code can
start deriving page state again, and malformed read data can be rendered.

Decision: rejected.

### Let The Browser Rebuild The Page Model

Pros: fewer server response fields.

Cons: duplicates readiness, evidence, recovery, and policy semantics in the
browser. It conflicts with the server-authoritative policy model.

Decision: rejected.

### Server Projection With Strict Client Adapter

Pros: a small versioned contract, server-owned decisions, library identity
binding, immutable display values, bounded status semantics, and no provider or
compatibility payload in the page view model.

Cons: requires schema tests on both sides and an explicit contract update when
the page needs a new field.

Decision: selected.

## Final Recommendation Stack

1. Keep `policy.authoring_workflow_presentation.v1` server-owned and
   display-only.
2. Keep `adaptPolicyAuthoringWorkflowPresentation` as the only client path
   from a workflow read to page-level authoring state.
3. Preserve named API leaf functions and request identity checks. Do not add
   cancellation until the Axios retry boundary distinguishes cancellation from
   retryable network failure.
4. Treat unavailable or malformed presentation data as non-actionable. Do not
   fall back to browser-derived readiness, recovery, or policy meaning.
5. 4R.3 and 5R.2a are complete. The existing display-safe proposal remains a
   read model; 4R.4a must consume the server lifecycle state and opaque,
   revision-bound admission reference without widening either model.

## Security And Verification

- The projection declares false automation, persistence, and routing authority
  and false raw-data exposure.
- The server audit detects stale revisions, altered content, unsafe authority,
  and unexpected fields.
- The client validates exact keys and does not retain broad workflow, provider,
  or compatibility payloads in its presentation state.
- `server/src/__tests__/services/policyAuthoringWorkflowPresentation.test.mjs`
  exercises deterministic construction and tamper detection.
- `client/src/__tests__/utils/policyAuthoringWorkflowPresentation.test.js`
  exercises immutable valid output and malformed, mismatched, unsafe, and
  unsupported input.
