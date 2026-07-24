# Policy Constraint Draft-Command Adapter

Status: implemented as the transient client boundary between the server-owned
constraint decision model and future constraint controls.

## Scope

The constraint draft-command adapter turns one explicit operator choice into
one bounded local command only after resolving that choice against
`policy.constraint_decision_model.v1`.

It deliberately does not add a policy-builder control, select a value from the
library, write policy storage, invoke a provider, consume quota, create a
learning record, route media, call an API, or serialize a legacy compatibility
payload. This is a local preparation boundary for a later, separately
authorized policy-write flow.

The server decision projection now carries each control's approved
`draftCommandId`. The browser carries that typed identifier forward; it does not
map a label such as `Avoid` to behavior on its own.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant values and explicit workflow
  state instead of treating client state as truth.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side enforcement and sequential workflow checks for sensitive
  actions.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends canonicalization, allowlists, bounded values, and server-side
  validation before input affects application behavior.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf/publications)
  supports explicit component interfaces and verification activities.

## Recommendations

1. Let the server decision model publish the typed draft-command identifier;
   do not derive commands from visible labels or browser-only mappings.
2. Accept only a plain, explicit `{ controlId, value, explicitOperatorAction }`
   selection. Reject unknown fields, absent confirmation, control characters,
   empty text, and oversize values.
3. Validate the received decision projection's version, display-only authority,
   raw-payload boundary, exact control vocabulary, and typed command vocabulary
   before producing a local command.
4. Keep command plans immutable, bounded to one command per explicit choice,
   and deduplicated in transient client state.
5. Treat client validation as UX and containment only. A future persistence
   endpoint must rederive control semantics and validate the command again on
   the server.
6. Keep the adapter separate from the compatibility bridge until native
   constraint storage and its policy-write authorization are implemented.

## Pros And Cons

### Server-Derived Command Identifier

Pros:

- The browser cannot reinterpret a visible control into a different constraint
  command.
- A hard limit, avoid value, and review warning retain the semantics already
  audited by the workflow read service.
- Later controls can consume one stable typed contract.

Cons:

- The decision projection has one additional bounded field to audit.
- A future version must update the adapter intentionally when new controls are
  introduced.

### Transient Local Draft State

Pros:

- Future UI controls can stage selections without coupling to policy writes or
  legacy serialization.
- Changing libraries clears selections, preventing a command from following an
  operator into a different destination.
- The boundary is testable without network, media-server, provider, or database
  setup.

Cons:

- The command cannot yet change a policy; native constraint persistence remains
  a later server-authorized component.
- Constraint UI intentionally waits for the next focused task.

## Final Recommendation Stack

- `server/src/services/policyAuthoringConstraints.mjs` remains the canonical
  vocabulary for constraint controls and server-side validation.
- `server/src/services/policyConstraintDecisionModel.mjs` exposes the audited
  `draftCommandId` with each display-only control.
- `client/src/utils/policyIntentConstraintDraft.js` validates the bounded
  projection and explicit selection, then creates immutable typed local plans.
- `client/src/composables/usePolicyIntentConstraintDraft.js` owns transient
  command state and clears it when the selected library changes.
- The adapter cannot call APIs or emit persistence, routing, learning, provider,
  or quota side effects. Future server writes must revalidate the command.

## Verification

- `client/src/__tests__/utils/policyIntentConstraintDraft.test.js`
- `client/src/__tests__/composables/usePolicyIntentConstraintDraft.test.js`
- `server/src/__tests__/services/policyConstraintDecisionModel.test.mjs`
- Inventory and policy-authoring completion-audit tests

## Outcome

The native workflow now has a small, typed, local-only constraint command
boundary. [Policy Constraint Control Surface](policy-constraint-control-surface.md)
uses it to stage explicit selections without persistence.

## Next Step

Implement **3R.5 Task 3R.5.4, Constraint Value Eligibility Projection**:
publish server-owned, bounded values before any constraint draft can become a
native policy write.
