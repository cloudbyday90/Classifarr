# Declared Policy-Purpose Provenance Outcome

Status: implemented on 2026-09-08. See the separate
[design](policy-declared-purpose-provenance-design.md) for the decision,
research, alternatives, and recommendation stack.

## Outcome

Classifarr now treats only `native_intent` and `operator_declared_intent` rule
records as native declared-purpose evidence. An explicit inferred
library-profile observation remains profile-derived. Every other source/state
combination is reported only as `unverified_purpose_source` and fails closed.

The new modular provenance service is used by all existing count-only policy
purpose paths. Its static SQL predicates replace the earlier "not profile"
arithmetic, so an unknown source can no longer qualify a current-policy
inventory, lifecycle receipt, library aggregate, coverage result, re-audit, or
held-out source screen. The administrator review displays unverified counts
without exposing rule values.

The receipt versions now make this semantic change explicit: policy source
screen v4, eligibility audit v5, evidence inventory v2, lifecycle-purpose
evidence v2, readiness v2, coverage review v9, and lifecycle receipt v3.
No policy was edited and no evidence was created.

## Live read-only result

The local Compose audit reports 6,641 canonical candidates, fifteen
profile-derived purpose rules across ten active policies, zero native
declared-purpose rules, and zero unverified purpose rules. It therefore still
has zero complete purpose-evidence policies. The 28-case cohort attempt remains stopped at
`insufficient_eligible_cases`; no labels, readiness, frozen-study preflight,
semantic selection, or routing ran.

This confirms that the correction improves future evidence safety without
inventing a current-data success state or requiring operational inspection.

## Validation

Focused server contracts cover exact native/profile classification, unknown
source rejection, safe SQL aliases, source-screen partitions, coverage, receipt
aggregation, audit receipt refresh, and re-audit behavior. Client validation
covers the new exact lifecycle partition. The final change is also checked by
the complete quality suite, a security diff scan, and a no-cache local Compose
rebuild with a read-only audit.

The official repository has no open pull requests, so there was no random PR
to implement locally. [Open pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

## Next item

Add a fixed, aggregate-only explanation for which deterministic
policy-comparison precondition produced `not_pending_policy_decision`. It must
not return candidate, policy, library, provider, or configuration data, and it
  must remain a passive diagnostic rather than a cohort, label, semantic, or
  routing workflow.
