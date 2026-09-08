# Policy Purpose Held-Out Source Readiness Design

Status: implemented on 2026-09-08.

## Problem

The administrator-only policy-purpose coverage review can show profile-only
purpose on individual, bounded rows. A real held-out semantic study, however,
must exclude inferred library-profile evidence from policy-only selection. An
operator previously had to reconcile the bounded review manually with the
private held-out eligibility audit to determine whether any retained declared
purpose existed across the complete active policy population.

That reconciliation should be automatic, but the result must not turn a
configuration observation into a cohort, a label, a semantic claim, or a
routing decision.

## Design

The existing administrator-only `GET
/api/policies/native-intent-reconciliation/purpose-coverage` response advances
additively from `policy_purpose_coverage_review.v3` to v4. It now includes a
`studySourceReadiness` object, derived by a small ESM service from one
full-population aggregate SQL projection:

```json
{
  "statusId": "no_retained_declared_purpose_source",
  "activePolicyCount": 10,
  "profileOnlyPurposePolicyCount": 10,
  "retainedPurposePolicyCount": 0,
  "heldOutAuditCandidateSourceAvailable": false,
  "semanticCohortReady": false,
  "semanticSelectionAffected": false,
  "routingAffected": false
}
```

The aggregate applies the same active, validated native-policy authority
predicate as the bounded review. For each policy, PostgreSQL counts
identity-purpose rules over `genres`, `keywords`, and `studios` and the subset
whose source is `media_server_library_profile` with inferred state.

| Status | Meaning |
| --- | --- |
| `no_active_validated_native_policy` | No active policy passes the existing native-policy authority predicate. |
| `no_retained_declared_purpose_source` | Active policies exist, but none retains specialized purpose outside inferred library-profile evidence. |
| `retained_declared_purpose_source_available` | At least one active policy retains specialized purpose outside inferred library-profile evidence. The private eligibility audit may measure candidate availability. |

The ordinary report remains bounded to 50 rows by default and 100 rows at most.
The source-readiness aggregate is intentionally separate so its counts cover
the complete eligible policy population even when the visible review truncates.
Both reads are current, advisory observations; neither freezes configuration.
The existing private eligibility audit and frozen cohort capture remain the
only mechanisms that can evaluate and bind a study frame.

The Vue utility accepts only the three fixed server status IDs, clamps count
fields, and resets every authority-related flag to `false`. The review panel
displays the aggregate source status and fixed counts, without adding an
action, a navigation flow, or an automated follow-up.

## Security And Privacy Boundaries

- The existing server-side administrator authorization still applies to every
  request. The client display is never an authorization control.
- SQL selects aggregate counts only. It does not select rule values, policy
  JSON, profile payloads, media metadata, historical classification data, RAG
  data, or provider output.
- The client fails closed for unknown status IDs and does not trust payload
  flags that purport to establish semantic cohort readiness or routing
  authority.
- The endpoint is additive and versioned. Existing bounded-row and truncation
  behavior is preserved.
- No route changes policy configuration, queues work, invokes AI, captures a
  cohort, or routes media.

## Research

W3C Data on the Web Best Practices identifies provenance, data quality,
coverage, and clear API documentation as information that lets consumers
interpret data correctly. The count-only state and its explicit limitations
make source provenance visible without publishing rule content. NIST AI RMF's
Measure function supports documenting and testing a measurement process rather
than treating an availability signal as model quality. OWASP API3 describes
property-level authorization risk; the route therefore continues its
administrator guard and returns only the properties needed for this aggregate
readiness view.

Sources verified on 2026-09-08:

- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
- [NIST AI RMF Core: Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep only per-row provenance | No new query or contract field. | Requires manual reconciliation and becomes wrong when the bounded review truncates. |
| Return terms or profile evidence | Easier diagnosis of individual policies. | Exposes unnecessary configuration and observed evidence. |
| Automatically run cohort capture whenever retained purpose exists | Removes one command. | Treats source availability as semantic validity and risks unnecessary work or misleading receipts. |
| Add a full-population fixed-count source signal | Removes manual reconciliation, preserves data minimization, and keeps the study gates intact. | Adds one small read-only aggregate query and is deliberately not a cohort result. |

## Recommendation Stack

1. Use the aggregate source status to determine whether the private held-out
   eligibility audit has a policy-only candidate source worth measuring.
2. Keep inferred library-profile evidence out of held-out selection and out of
   routing authority.
3. Treat an available source as a prerequisite only; retain the existing
   source-conflict exclusion, eligibility audit, frozen 24–32-case capture,
   independent labels, readiness report, and preflight.
4. Add semantic counter-evidence only after the measured error profile is
   acceptable. Send ambiguous cases to review and never use that evidence for
   automatic routing.

No migration or dependency is required: this is a read-only projection of
existing native-intent data.
