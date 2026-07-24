# Policy Constraint Control Surface

Status: implemented as the accessible, local-only control surface for native
policy setup.

## Scope

This component exposes the three server-owned constraint concepts in the native
destination flow:

- `hard_limit` is visibly marked as a blocker and requires an explicit value
  confirmation before Classifarr stages it;
- `avoid` is visibly marked as advisory and also requires an explicit value
  confirmation; and
- `review_warning` stages a non-blocking condition for later review behavior.

`PolicyIntentConstraintControlSurface.vue` receives only the audited
`policy.constraint_decision_model.v1` display projection and existing local
constraint commands. It calls the typed draft-command adapter for each operator
action, then the parent retains the resulting command in memory for the active
library.

The component is available only in native destination setup. Its state is
explicitly labelled as local and unsaved. It does not add a field to the policy
create payload, mutate the legacy editor, persist a policy, execute routing,
change automation, learn from an observed absence, call a provider, consume
quota, or request media-server data.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/) recommends
  native form controls, visible labels, instructions, and `fieldset`/`legend`
  grouping for related choices.
- [W3C WAI APG: Naming Controls](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  recommends explicit native labels because they provide reliable accessible
  names and larger click targets.
- [W3C WAI APG: Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  documents labelled, keyboard-operable checkbox controls for boolean
  confirmations.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends canonicalization, bounds, allowlists, and independent server-side
  validation before user input affects behavior.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends displaying significant action data before confirmation and
  enforcing sensitive state transitions on the server.

## Recommendations

1. Use native `fieldset`, `legend`, `label`, `input`, checkbox, and button
   elements instead of custom ARIA widgets for these form controls.
2. State the consequence beside each control: a hard limit can block automatic
   application, while avoid and review warning remain advisory.
3. Reset an explicit-confirmation checkbox whenever its associated value
   changes. Confirmation must apply to the value currently shown to the
   operator.
4. Stage only one typed command through the existing adapter after an explicit
   action. Do not build command semantics from visible UI copy.
5. Announce draft status with a polite live region and make local-only state
   clear before an operator creates a policy.
6. Do not authorize persistence from this UI. A later write endpoint must
   independently validate the command, its server-owned semantics, and an
   allowlisted value source.

## Pros And Cons

### Native Form Controls And Explicit Confirmation

Pros:

- Keyboard and assistive-technology behavior use established browser semantics.
- The operator sees whether a value is a blocker or advisory before staging it.
- Changing a hard-limit or avoid value invalidates the prior confirmation.

Cons:

- Blocking and avoid controls take one extra confirmation step.
- The current draft-only stage cannot claim a policy was changed.

### Local-Only Draft Boundary

Pros:

- The UI cannot accidentally create a second policy-write path beside native
  policy establishment.
- Each active library starts with isolated transient constraint state.
- The save payload remains independently auditable while the native constraint
  write contract is designed.

Cons:

- An operator must wait for the next authorized storage task before a staged
  constraint can become policy state.
- Free-form draft values are intentionally not eligible for runtime use.

## Final Recommendation Stack

- `server/src/services/policyConstraintDecisionModel.mjs` remains the source of
  the three approved control meanings and command IDs.
- `client/src/utils/policyIntentConstraintDraft.js` validates the projection
  and produces immutable local typed plans.
- `client/src/utils/policyIntentConstraintControlSurface.js` derives only UI
  presentation and staged-value state from validated commands.
- `client/src/components/policies/PolicyIntentConstraintControlSurface.vue`
  provides labelled native controls, visible blocking/advisory copy,
  confirmation, live status, and a local-draft clear action.
- `client/src/components/policies/PolicyBuilderWorkflowShell.vue` exposes the
  component only on the native creation path.
- `client/src/components/policies/PolicyBuilderModal.vue` owns the transient
  command list and deliberately excludes it from the create payload.
- A future server write must accept a separately versioned command contract,
  rederive semantics, validate bounded allowlisted values, and atomically bind
  valid constraints to the native policy intent.

## Verification

- `client/src/__tests__/utils/policyIntentConstraintControlSurface.test.js`
- `client/src/__tests__/PolicyIntentConstraintControlSurface.test.js`
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`

## Outcome

Native setup now has a small, accessible constraint surface that distinguishes
blockers from advisory controls and keeps explicit choices local. The user can
stage and clear draft constraints, but cannot mistake them for saved policy
state or create a bypass around server authorization.

## Next Step

Implement **3R.5 Task 3R.5.4, Constraint Value Eligibility Projection**.
The server must publish the bounded, destination-appropriate values that a
future native write may accept for rating and review-warning controls. The
projection must fail closed when it cannot source a value safely, and the UI
must replace free-form staging with those approved options before persistence
is introduced.
