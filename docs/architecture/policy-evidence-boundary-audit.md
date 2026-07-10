# Policy Evidence Boundary Audit

## Status

Implemented as the Phase 6R.1 completion audit for the policy evidence handoff.

The audit validates the complete result returned by
`buildBoundedPolicyEvidenceProjection` before downstream engines treat the
handoff as safe. It does not add operator UI, replay preview behavior, live
provider calls, or storage writes.

## Problem

The evidence engine already validates input sections, projection entries,
projection summaries, evidence quality, and fingerprints. The missing layer was
a single handoff audit that verifies the assembled boundary result still makes
sense after those pieces are combined.

Without that layer, a future caller could accidentally pass a blocked result to
the intent engine, attach a `nextStep` to a failed input-gate response, claim an
incorrect issue count, or reintroduce live provider/storage side effects outside
the lower projection audits.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames AI work around mapping, measuring, and managing risk. For Classifarr,
  the boundary audit makes evidence readiness explicit before the intent engine
  can consume evidence.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  provides security and privacy controls, including audit and accountability
  practices. The boundary audit records status, issue IDs, and next-step state
  without exposing raw evidence values.
- [OWASP AI Exchange](https://owaspai.org/docs/ai_security_overview/)
  emphasizes AI/data security controls and risk analysis. The design keeps raw
  provider payloads, transient provider state, and UI diagnostic strings out of
  the trusted evidence handoff.
- [PostgreSQL JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html)
  documents structured JSON handling. The audit keeps the future persisted
  boundary shape structured and stable without requiring raw JSON provider
  payloads.

## Recommendations

1. Keep the boundary audit server-owned and deterministic.
2. Treat a ready handoff as valid only when input gate, projection audit,
   fingerprint audit, issue count, and `intent_inference` next step agree.
3. Treat blocked handoffs as valid only when they have no next step and stop at
   the correct boundary state.
4. Reject live provider lookup, provider quota reads, and policy storage
   mutation as evidence-boundary side effects.
5. Keep the audit output compact: status ID, readiness, issue IDs, and issues.

## Pros And Cons

Pros:

- Gives downstream intent/readiness engines one audit to verify before
  consuming evidence.
- Protects against accidental blocked-result handoffs.
- Keeps Phase 6R.1 evidence hardening server-side and non-UI.
- Preserves the offline/no-storage-write contract.

Cons:

- Adds one more defensive check layer around an already audited projection.
- Does not itself derive new evidence from media-server libraries; that remains
  the evidence reducer work.

## Final Recommendation Stack

- Service:
  `server/src/services/policyEvidenceBoundary.mjs`
- Tests:
  `server/src/__tests__/services/policyEvidenceBoundary.test.mjs`
- Primary design record:
  `docs/architecture/policy-evidence-engine.md`
- Component record:
  `docs/architecture/policy-evidence-boundary-audit.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

`buildPolicyEvidenceBoundaryAudit` now validates:

- known boundary status IDs,
- returned issue count consistency,
- ready handoffs with successful input gate, projection audit, fingerprint
  audit, and `intent_inference` next step,
- blocked handoffs without next steps,
- input-gate failures that do not build projections,
- projection/fingerprint blocked statuses that match failed audits,
- no live provider lookup, provider quota read, or policy storage mutation side
  effects.

## Next Step

Proceed to **Phase 6R.2 Intent Engine consumption hardening**. It should consume
the audited evidence handoff, trust generated quality/status only after this
boundary audit passes, and keep inferred evidence separate from
operator-declared constraints.
