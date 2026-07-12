# Policy Automation Decision Output Contract

## Status

Implemented as the server-owned state, permission, and trace contract for
policy automation decisions.

This component does not classify, route, call providers, create questions,
write learning, or persist policy state. It defines what a decision may claim
after the automation reducer has evaluated validated runtime evidence.

## Problem

The automation reducer already selected an allow-listed state, but validation
did not require every outward-facing field to agree with that state. A mutated
decision could claim `needs_operator_review` and still request `route_to_arr`,
or retain altered trace summaries and injected trace attributes.

The output contract binds these fields together:

```text
decision state
  -> required action
  -> automation, routing, and classification permissions
  -> permitted canonical reason set
  -> bounded trace attributes
```

## Official Guidance Reviewed

- [NIST AI Risk Management Framework Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, repeatable risk treatment and measurement. Decision
  states make automation outcomes explicit and auditable.
- [NIST AI RMF Manage Playbook](https://airc.nist.gov/airmf-resources/playbook/manage/)
  recommends using assessment outputs to decide whether deployment or action
  should proceed. `auto_route_ready` is therefore an explicit gate, not a
  default action.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verified controls before behavior changes. The state/output matrix is
  deterministic and covered by focused tests.
- [OpenTelemetry Semantic Convention Guidance](https://opentelemetry.io/docs/specs/semconv/how-to-write-conventions/)
  recommends stable, bounded attributes. Decision traces use a fixed,
  server-owned attribute map and canonical reason records.

## Recommendations

1. **Treat the state as the sole action authority.** Each state has exactly
   one action and fixed automation, routing, and classification permissions.

2. **Require route readiness before Arr action.** Only `auto_route_ready` may
   request `route_to_arr`; every other state is denied route authority.

3. **Keep classification success separate from routing success.**
   `classified_not_routed` has the only classification-only action and cannot
   claim route permission.

4. **Canonicalize decision explanations.** Each state accepts only its bounded
   reason IDs and fixed reason details. Trace summaries and attributes are
   generated from decision fields, not accepted as mutable diagnostics.

5. **Reject drift before execution.** A changed action, permission, trace
   reason, reason count, or extra trace attribute invalidates the decision
   before a later execution component can act on it.

## Pros And Cons

Pros:

- Prevents review, retry, or blocked states from being relabeled as routing
  actions.
- Prevents altered trace text from becoming an unbounded logging surface.
- Makes downstream execution and question-reduction consumers simpler because
  each state has one authoritative output tuple.
- Preserves the existing public decision service through a focused modular
  extraction.

Cons:

- Adding a state or reason requires updating the state matrix and focused
  tests.
- Manually constructed debug decisions must use canonical builders rather than
  editing actions or trace details in place.

## Final Recommendation Stack

- Decision output contract:
  `server/src/services/policyAutomationDecisionOutputContract.mjs`
- Automation reducer and validation:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Output-contract tests:
  `server/src/__tests__/services/policyAutomationDecisionOutputContract.test.mjs`
- Reducer regression tests:
  `server/src/__tests__/services/policyAutomationDecisionContract.test.mjs`
- Runtime evidence dependency:
  `server/src/services/policyRuntimeEvidenceProjection.mjs`

## Implemented Contract

The output module exports state, action, reason, trace-attribute, and audit
risk identifiers plus canonical reason, trace, state lookup, and output-audit
builders.

The audit rejects:

- action/state disagreement;
- permission/state disagreement;
- a reason set not permitted for the selected state;
- altered reason details or reason counts;
- missing, altered, or additional trace attributes.

## Security Outcome

- `needs_operator_review`, `blocked_by_hard_limit`, `needs_routing_mapping`,
  `stale_profile_retry`, and `insufficient_evidence` cannot request Arr route
  execution.
- `classified_not_routed` cannot claim route success.
- Decision traces remain bounded, canonical, and free of caller-supplied raw
  diagnostic text.
- No provider call, classification write, route write, question write,
  learning write, or persistence behavior changes.

## Next Step

Continue with **Runtime Question Reduction** so only the appropriate decision
states can create operator-facing questions or configuration actions.
