# Held-out semantic non-pending decision partition design

Status: implemented, unreleased. Research checked against the linked primary
sources on 8 September 2026.

## Problem

The private eligibility audit already established that all candidate assessments
were `not_pending_policy_decision`, with the aggregate diagnostic
`manual:none`. That proves semantic retrieval did not run, but it cannot say
at which fixed deterministic evaluator stage the broad-policy comparison
stopped. A consumer should not need candidate, policy, library, provider, or
configuration data to distinguish an absent policy set from a media-type
mismatch, a non-qualifying evaluation, or a non-pending ranked decision.

## Decision

The restricted held-out evaluator now records one ephemeral fixed stage for
each assessment. The evaluation state exists only during the assessment and is
reduced immediately into a count-only receipt.

| Stage | Meaning |
| --- | --- |
| `no_active_policies` | There was no active restricted policy. |
| `no_compatible_media_type_policies` | No restricted policy was compatible with the canonical media type. |
| `no_qualifying_policy_evaluations` | Compatible restricted policies yielded no qualifying evaluation. |
| `ranked_policy_decision` | A ranked restricted-policy decision was produced. |
| `authoritative_signal` | An authoritative signal ended evaluation. This is contradictory in the study because the scoped evaluator supplies none. |
| `unknown` | No trusted stage was recorded. |

`heldOutSemanticStudyNotPendingDecisionPartition.mjs` examines only valid
`not_pending_policy_decision` contracts and places each in exactly one fixed
reason:

| Reason | Accepted condition |
| --- | --- |
| `no_active_policies` | Matching no-candidate diagnostic at the active-policy stage. |
| `no_compatible_media_type_policies` | Matching no-candidate diagnostic at the compatible-type stage. |
| `no_qualifying_policy_evaluations` | Matching no-candidate diagnostic at the qualifying-evaluation stage. |
| `ranked_non_pending_decision` | A valid non-pending decision after ranking. |
| `unknown_evaluation_path` | A well-formed non-pending contract lacks a trusted stage. |
| `invalid_not_pending_observation` | The contract, stage, and fixed diagnostic contradict one another. |

The partition count must equal the existing
`comparisonEligibilityPartition.reasonCounts.not_pending_policy_decision`.
The enclosing audit advances to
`policy.held_out_semantic_study_eligibility_audit.v6`; lifecycle re-audit
recognizes the new receipt as current and refreshes an earlier receipt only
through its existing source and evidence gates.

```text
canonical candidates
  -> restricted broad-policy evaluation (ephemeral fixed stage)
  -> valid non-pending contract
  -> aggregate-only reason partition
  -> v6 receipt; stop before cohort capture and semantic retrieval
```

## Security and authority boundary

- The new stage state and partition are ES modules with fixed identifiers.
  They perform no I/O, logging, database write, HTTP request, provider call,
  policy mutation, cohort capture, label collection, semantic retrieval, or
  media routing.
- A malformed or contradictory observation is counted as invalid and cannot
  become a ready comparison.
- The audit checks count reconciliation and fails closed before returning a
  completed receipt when the two partitions disagree.
- The result contains aggregate counts only. It excludes candidate rows,
  titles, identifiers, policies, libraries, providers, configuration, scores,
  rules, semantic evidence, and human labels.
- No API surface is added. The existing private read-only audit boundary
  remains unchanged.

## Research basis

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
machine-processable metadata, provenance, version indicators, data-quality
information, and an explanation when data is unavailable. A versioned,
fixed aggregate partition gives future automation a stable explanation without
publishing the sensitive operational data that produced it.

[W3C PROV-O](https://www.w3.org/TR/prov-o/) provides a model for provenance
across heterogeneous systems. The receipt models the evaluation activity at a
safe aggregate level rather than treating a media-server observation,
configuration, or profile as policy authority.

[OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
recommends restricting management endpoints and returning generic errors
without technical details. Keeping this data inside the existing private,
aggregate-only audit avoids a new operational endpoint and limits disclosure.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep `manual:none` alone | No contract work | Still requires interpretation and cannot locate the deterministic stop stage | Reject |
| Return candidate or policy rows | Direct manual diagnosis | Exposes operational data and invites hand-selected cohorts | Reject |
| Infer policy authority from library/profile observations | May create more comparisons | Circular evidence and configuration coupling | Reject |
| Fixed, aggregate evaluator-stage partition | Deterministic, privacy-bounded, reconcilable, and usable by future automation | Adds a narrow transient state and a versioned receipt | Adopt |

## Recommendation stack

1. Consume the v6 aggregate partition to explain a zero-ready audit without
   manual inspection of the underlying library or configuration.
2. Keep policy authority restricted to separately governed declared purpose;
   retain profile observations as descriptive evidence only.
3. Let the existing passive lifecycle gate refresh the audit after qualifying
   source evidence changes; do not lower thresholds or hand-pick cases.
4. Capture a balanced 24–32 case cohort only when the policy-only comparator
   is available in every required stratum, then obtain independent labels and
   run readiness and frozen-study preflight.
5. Add semantic counter-evidence only after a good measured error profile;
   ambiguous items may enter review but must never be routed automatically.

## Non-goals

This change does not create policy evidence, choose a cohort, collect labels,
call an AI service, change policy, add automatic routing, expose an endpoint,
or create a release.
