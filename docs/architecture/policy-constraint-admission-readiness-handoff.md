# Policy Constraint Admission Readiness Handoff

Status: implemented as an explicit no-handoff boundary.

## Scope

Native constraint admission validates one typed, operator-declared command
against current server-owned control semantics and library value eligibility. It
does not persist the command. Therefore, it cannot alter the policy-authoring
readiness projection or create an action in the normal operator workflow.

This task corrects the former admission response shape, which exposed an
internal-looking `nextStep` for future native storage. That field risked making
a security preflight look like an operator instruction or an approved write.
It is removed. The admission audit now rejects any result that adds it.

The existing six readiness states remain the complete normal workflow:

- `Ready`
- `Needs examples`
- `Needs review`
- `Needs routing`
- `Blocked by hard limit`
- `Stale profile`

No seventh `constraint admitted`, `ready to persist`, or equivalent state is
added.

## Official Guidance Reviewed

Sources reviewed through June 2026:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires authorization at the server-side execution boundary, not from an
  earlier client-visible preflight result.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports centralized, server-enforced authorization decisions.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires testable accessible
  interactions; its status-message guidance supports concise, meaningful
  status changes rather than implementation-only updates.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports small, testable boundaries with explicit responsibility separation.

## Recommendations

1. Keep admission and persistence separate. A future storage transaction must
   rederive current eligibility and authorization before it writes.
2. Keep the six-state readiness contract closed. Admission is neither durable
   intent nor an automation condition, so it cannot supply a state, issue, or
   operator action.
3. Reject response shapes that expose `nextStep` from admission. This blocks a
   later client or caller from treating admission as execution authority.
4. Recompute readiness only after a successful native storage transaction has
   changed durable intent. Do not patch readiness from an admission response.

## Pros And Cons

### No Normal-Workflow Handoff

Pros:

- Preserves one operator-facing readiness model and prevents an extra setup
  step.
- Prevents a preflight response from being mistaken for write authorization.
- Keeps future storage and current UI work independently testable.

Cons:

- Admission has no user-visible result until native storage is implemented.
- The future persistence service must explicitly trigger a fresh readiness
  computation after its transaction commits.

## Final Recommendation Stack

- `server/src/services/policyConstraintWriteAdmissionContract.mjs`
  - returns no normal-workflow next action.
- `server/src/services/policyConstraintWriteAdmission.mjs`
  - audits and rejects a result that exposes a `nextStep` handoff.
- `server/src/services/policyAuthoringReadiness.mjs`
  - remains the sole owner of the six normal readiness states and their one
    action each.
- A future transactional native constraint storage service
  - must repeat admission, persist atomically, then request a fresh readiness
    projection from durable state.

## Verification

- `server/src/__tests__/services/policyConstraintWriteAdmission.test.mjs`
  verifies admitted and rejected results omit `nextStep`, and an added handoff
  fails the admission audit.
- `server/src/__tests__/policies-constraint-admission-routes.test.mjs`
  verifies the public admission response omits `nextStep`.
- `server/src/__tests__/services/policyAuthoringReadiness.test.mjs` continues
  to pin exactly six visible readiness states.

## Outcome

Constraint admission is now correctly a private server validation result with
no normal-workflow handoff. The operator still sees one readiness state and one
action from durable policy and observed-library conditions only.
