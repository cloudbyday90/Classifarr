# Policy Constraint Decision Model

Status: implemented as the server-owned constraint decision projection for the
native policy workflow.

## Scope

This design establishes one small, versioned display model for the three
constraint outcomes that Classifarr supports before any constraint control is
shown in the native policy builder:

- `hard_limit` can block automatic application only after explicit operator
  action;
- `avoid` can lower confidence but cannot become a blocker; and
- `review_warning` requests review and is the only outcome that observed
  absence may produce automatically.

`policy.constraint_decision_model.v1` is emitted in the display-only operator
workflow read. It does not carry selected values, observed examples, candidate
metadata, raw profiles, browser-derived semantics, policy writes, routing,
runtime decisions, provider calls, or quota reads. Each control also carries a
bounded `draftCommandId` so a client adapter can forward the server-approved
typed command without deriving it from a visible label. A later task may add
controls that use the separate typed draft-command boundary.

## Official Guidance Reviewed

The following official sources were reviewed for this design, current through
June 2026:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side enforcement and a sequential workflow that cannot be
  altered by client request parameters.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit workflow state machines and server-owned acting identity
  for business decisions.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allowlists, canonicalization, and server-side validation before
  processing user-controlled data.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports explicit interfaces and verification for software components.
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
  distinguishes actionable interface details from implementation debugging
  information.

## Recommendations

1. Publish exactly three decision effects: block automatic application, reduce
   confidence, and request review.
2. Make every effect, certification semantic, explicit-action requirement, and
   observed-absence behavior server-owned and audited.
3. Never return constraint values, raw evidence, candidate details, or a client
   instruction to persist or execute a decision in this read projection.
4. Fail closed when a projection changes an advisory avoid into a blocker,
   lets observed absence declare a hard/avoid constraint, conflates rating
   semantics, or exposes unapproved fields.
5. Keep the model separate from both policy writes and runtime constraint
   evaluation. A display model cannot authorize either action.

## Pros And Cons

### Server-Owned Decision Effects

Pros:

- Stops the browser from recasting an avoid value as a hard block.
- Gives future controls one durable semantic contract instead of duplicated UI
  labels and hidden behavior.
- Keeps observed absence informative without silently turning it into policy.

Cons:

- Constraint UI must wait for a typed draft boundary rather than directly
  binding to the model.
- The projection adds a small contract audit to every workflow read.

### Display-Only Workflow Integration

Pros:

- Uses the same authenticated, bounded workflow response as destination
  evidence and custom intent signals.
- Ensures every consumer sees the same authoritative meanings.
- Adds no migration, provider cost, quota usage, or operational side effect.

Cons:

- The model intentionally does not yet tell an operator which values to choose.
- Runtime enforcement remains a separate deterministic concern.

## Final Recommendation Stack

- `server/src/services/policyAuthoringConstraints.mjs` remains the canonical
  vocabulary for controls, explicit-action requirements, sources, and
  certification semantics.
- `server/src/services/policyConstraintDecisionModel.mjs` derives and audits
  the immutable `policy.constraint_decision_model.v1` display projection and
  each control's approved typed draft-command identifier.
- `server/src/services/policyOperatorWorkflowReadService.mjs` publishes the
  audited projection with no write, automation, routing, or runtime authority.
- `server/src/__tests__/services/policyConstraintDecisionModel.test.mjs` pins
  the three decision outcomes and rejects advisory escalation, absence-based
  declaration, raw payload exposure, and unapproved fields.
- `server/src/__tests__/services/policyOperatorWorkflowReadService.test.mjs`
  verifies the model is present in the normal workflow read and detects
  projection tampering.

## Verification

- `node ./scripts/run-jest.mjs --testPathPatterns="policyConstraintDecisionModel|policyAuthoringConstraints|policyOperatorWorkflowReadService|policies-operator-workflow-read-routes|policies-operator-workflow-custom-intent-signal-routes" --runInBand --no-coverage`
- Full server unit and integration suites, client tests, type checking, lint,
  documentation lint, copyright verification, and ESM checks.

## Outcome

The native workflow now carries one auditable constraint model with no values
or execution authority. Hard limits, avoid values, and review warnings are no
longer merely similar-looking UI concepts: their permitted effect and
observed-absence behavior are explicit server-owned data.

## Next Step

Implement the minimal constraint control surface. It must consume the server
projection and [Policy Constraint Draft-Command
Adapter](policy-constraint-draft-command-adapter.md), preserve blocker versus
advisory meaning, and remain local-only until native constraint storage exists.
