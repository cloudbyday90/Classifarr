# Measured held-out study readiness blocker design

Status: implemented, unreleased. Research checked against the linked primary
sources on 8 September 2026.

## Problem

The administrator-only held-out readiness projection exposed only the two
source prerequisites. A source state of `eligibility_audit_available` did not
say whether the passive lifecycle audit had produced a current aggregate
receipt, whether that receipt found zero policy-only comparisons, or what
fixed prerequisite remained. Recovering that distinction required reading a
private audit result outside the normal, library- and configuration-agnostic
readiness path.

The solution must not use a library profile as policy authority, expose a
policy, library, media, provider, configuration, score, rule, or receipt, or
start any study activity.

## Decision

The existing no-store, administrator-only readiness endpoint advances from
`v2` to `v3`. It now reads the existing aggregate lifecycle audit state and
projects two fixed fields:

| Field | Meaning |
| --- | --- |
| `currentCompleteAuditAvailable` | `true` only when a stored v6 audit receipt is complete and its source fingerprint exactly matches the current aggregate lifecycle source. |
| `measuredBlockerId` | One fixed next prerequisite, derived from the source prerequisite or from the current aggregate audit. |

`heldOutSemanticStudyReadinessMeasuredBlocker.mjs` owns the bounded reduction.
A separate `heldOutSemanticStudyEligibilityAuditContract.mjs` now owns the
version and status identifiers used by both the audit and the readiness
projection, avoiding a dependency from this small read path to the audit
orchestrator.

| Measured blocker | Condition | Effect |
| --- | --- | --- |
| `normal_lifecycle_receipt_required` | No normal lifecycle receipt | Defer. |
| `complete_declared_purpose_evidence_required` | No complete declared-purpose evidence | Defer. |
| `await_passive_eligibility_audit` | Source is ready but no matching complete receipt exists | Wait for the existing passive scheduler. |
| `governed_declared_purpose_evidence_required` | A current audit found only `no_qualifying_policy_evaluations`, zero ready comparisons, and all purpose observations excluded as inferred profile evidence | Defer until a separately governed declaration changes the durable source. |
| `await_qualifying_policy_evaluations` | A current completed audit has zero ready comparisons for another reason | Defer. |
| `await_balanced_eligible_cohort` | A current completed audit has one or more ready comparisons | The existing planner must still prove a balanced 24–32-case cohort. |

The final state is deliberately a prerequisite, not a command. It does not
claim cohort eligibility, capture cases, collect labels, measure error,
perform semantic retrieval, call a provider, mutate policy, or route media.
The browser independently validates the v3 closed schema and discards any
projection with an unknown field, contradictory source/blocker pair, identity
field, or authority flag.

```text
aggregate lifecycle source + aggregate policy-purpose evidence
  -> fingerprint-match existing complete v6 audit receipt
  -> one fixed, aggregate-only measured blocker
  -> administrator readiness display / future automation
  -> no study execution
```

## Security and authority boundary

- The route remains administrator-only, rate-limited, parameter-free, and
  `Cache-Control: no-store`.
- The optional audit-state read may fail without hiding a safe source
  prerequisite. It falls back to `await_passive_eligibility_audit`; it never
  treats a missing, malformed, stale, failed, truncated, or
  configuration-changed receipt as evidence.
- A profile observation can explain the governed-declaration blocker but can
  never satisfy it. Only separately governed declared purpose can change the
  lifecycle source.
- The same source fingerprint is required for a receipt to be current.
  Historical measurement cannot authorize work after source evidence changes.
- The client and server preserve `false` for semantic cohort readiness,
  independent labels, semantic selection, and routing.

## Research basis

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
machine-processable metadata, provenance, version indicators, and an
explanation when data is unavailable. The versioned fixed blocker supplies
that explanation to people and automation without disclosing its sensitive
operational inputs.

[W3C PROV-O](https://www.w3.org/TR/prov-o/) supports provenance interchange
across different systems and contexts. Matching the aggregate receipt to an
aggregate source fingerprint preserves that causal boundary without treating a
profile observation as authority.

[OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
recommends protecting management endpoints. The existing administrator-only,
no-store, rate-limited route remains the sole delivery path for this bounded
status.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep source prerequisites only | No contract change | Conceals whether a current measurement exists and leaves future automation to inspect private artifacts | Reject |
| Return the stored audit receipt | More raw diagnostic detail | Expands management data and risks policy, library, or configuration coupling over time | Reject |
| Re-run the audit on every readiness read | Always current | Expensive, creates a timing side channel, and turns a read endpoint into orchestration | Reject |
| Project one fingerprint-bound aggregate blocker | Deterministic, private, explainable, and usable by automation | Adds a small versioned contract and a browser validator | Adopt |

## Recommendation stack

1. Use the v3 measured blocker as the machine-readable next prerequisite.
2. Keep declared purpose as the only authority and profile-derived values as
   descriptive review evidence.
3. Let the existing passive lifecycle scheduler re-audit only after qualifying
   source evidence changes.
4. Let the existing planner establish a balanced 24–32-case cohort before any
   capture and obtain independent labels before readiness and frozen-study
   preflight.
5. Add semantic counter-evidence only after a good measured error profile; an
   ambiguous item may enter review but never automatic routing.

## Non-goals

This change does not create declared purpose, select a cohort, collect labels,
perform semantic retrieval, call AI, change policy, or route media.
