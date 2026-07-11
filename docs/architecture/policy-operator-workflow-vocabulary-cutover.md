# Policy Operator Workflow Vocabulary Cutover

## Status

Implemented July 11, 2026.

## Decision

Replace the policy-operator workflow audit issue
`Workflow section must map to Phase 0R user terms.` with
`Workflow section must map to approved policy-authoring terms.`

The audit continues to require each workflow section to reference at least one
approved term ID. Only the explanatory message changed.

## Boundary Audit

The message belongs to a server-owned validation issue returned by
`validatePolicyOperatorWorkflow`. The stable contract is the
`missing_term` risk ID and its issue object. No database, route, client, or
versioned payload depends on the old phrase.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise and unambiguous operational names. Approved
  policy-authoring terms describe the actual validation rule.
- [NIST SP 800-228 Update 1](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  supports reviewable, risk-managed interface updates. The focused test asserts
  the retained risk ID and the updated bounded issue message.

## Options Considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Retain the old phase reference | No copy change | Ties a current validation error to retired project history | Rejected |
| Include both labels | Aids temporary search | Retains the obsolete term and makes the issue harder to read | Rejected |
| Refer to approved policy-authoring terms | Matches the term-ID rule and remains durable | Requires an exact message assertion | Selected |

## Verification

- Workflow sections with term IDs still pass the audit.
- Removing a section's term IDs returns the existing `missing_term` risk ID.
- The returned message uses durable policy-authoring terminology.
- The production naming inventory and regression audit are regenerated before
  lowering the baseline.

## Security Outcome

No policy behavior, access control, persistence, routing, or client-facing
workflow data changes. The audit remains side-effect-free and continues to
block missing vocabulary mappings before normal workflow projection.

## Next Step

Audit remaining production references that use dynamic phase-key compatibility
lookups in storage-closure services, determining whether their migration
read-boundary compatibility is still necessary or can be removed safely.
