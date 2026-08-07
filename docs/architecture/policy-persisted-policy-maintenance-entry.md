# Policy Persisted Policy Maintenance Entry

## Status

Implemented as Phase 4R Task 4R.7 on August 7, 2026.

## Decision

A persisted policy has one server-owned maintenance-entry classification
that determines which inspection and editing surface is admitted. The
classification consumes the policy source (native vs compatibility), native
authority state, readiness state, and change-admission eligibility to
produce a bounded entry disposition.

```text
persisted policy + authority state + readiness + change eligibility
  -> one maintenance-entry disposition
  -> one next admitted action (if any)
```

The classification is pure and side-effect-free. It performs no database
query, route mutation, policy persistence, routing execution, learning
write, or provider call. It defers to the existing readiness summary for
display values and to the 5R.10 change admission for maintenance
authorization.

## Entry Dispositions

| Disposition | When | What the operator sees |
| --- | --- | --- |
| `inspect_only` | Native authority is active and ready; no change requested | Compact summary with readiness; no edit action |
| `native_change_eligible` | Native authority is active, valid, and change admission is available | Summary plus an intentional "Adjust policy" maintenance entry |
| `recovery_required` | Authority is ambiguous, non-authoritative, or missing purpose | Recovery status; no edit action until resolved |
| `compatibility_maintenance_only` | Policy source is compatibility (legacy presets/customSignals) | Isolated compatibility editor; labeled as maintenance |
| `create_path` | No active native intent and no compatibility policy | Create flow entry |

The classification prevents create, edit, and compatibility maintenance
from accidentally selecting the wrong payload or workflow contract. A
persisted native policy cannot enter the create flow. A compatibility policy
cannot enter the native change path. A policy in recovery cannot enter any
editing flow.

## Next Admitted Action

When the disposition is `native_change_eligible`, the classification
exposes the next admitted action bound to the 5R.10 change-command IDs:

```text
{
  actionId: 'enter_native_maintenance',
  changeAdmissionVersion: 'policy.native_intent_change_admission.v1',
  allowedChangeCommands: [
    'update_purpose',
    'update_hard_limits',
    'update_avoid_rules',
    'update_helpful_matches',
    'update_routing_target',
    'update_review_triggers',
  ],
  requiresRevisionCheck: true,
  requiresAdministrator: true,
}
```

The classification does not itself authorize the change — it exposes that
the 5R.10 admission is available. The actual admission runs inside the
transactional persistence boundary.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization and least privilege. The
  classification defaults to `inspect_only`; maintenance editing is only
  admitted when authority, readiness, and change eligibility all agree.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires access control at non-public endpoints. The classification
  ensures a persisted policy cannot accidentally enter the wrong workflow.
- [NIST SSDF](https://csrc.nist.gov/projects/ssdf) requires traceable,
  auditable software changes. The classification records the policy source,
  authority state, and readiness state that drove the disposition.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
  recommends showing only what the user needs now. The classification
  surfaces the maintenance entry only when the operator has an explicit
  maintenance intent; otherwise the summary remains read-only.

## Options Considered

### 1. Reuse the readiness summary as the sole classification

Pros:

- No new contract.

Cons:

- The readiness summary tells the operator *readiness*; it does not
  classify *which workflow* to enter. A ready native policy and a ready
  compatibility policy have the same readiness state but different
  maintenance paths.
- Cannot distinguish `native_change_eligible` from `inspect_only`.

### 2. Add maintenance disposition to the readiness summary contract

Pros:

- Single contract for all persisted-policy state.

Cons:

- Conflates readiness (automation state) with maintenance entry (workflow
  routing). These are separate concerns with different inputs.
- Would require widening the readiness summary with workflow-specific fields
  (change-command IDs, revision references) that don't belong in a readiness
  projection.

### 3. Build a dedicated, pure maintenance-entry classification contract

Pros:

- Separates inspection (readiness) from workflow routing (maintenance entry).
- Produces one bounded disposition from existing server-owned state.
- Is testable without a database or route.
- Follows the same proven pattern as the 4R.2 presentation adapter and 4R.6
  material exception presentation.

Cons:

- Adds one more projection to the persisted-policy read response.

### 4. Hardcode the disposition in the Vue component

Pros:

- No server contract needed.

Cons:

- The browser would derive workflow authority from client state, violating
  the roadmap rule: "No persisted-policy page renders a browser-derived
  automation conclusion."
- Cannot be regression-tested server-side.

## Final Recommendation Stack

1. Build a pure, side-effect-free classification contract that consumes
   policy source, authority state, readiness state, and change-admission
   eligibility.
2. Produce one bounded disposition per persisted policy.
3. Expose the next admitted action (with 5R.10 change-command binding) only
   when disposition is `native_change_eligible`.
4. Default to `inspect_only` for a ready native policy with no maintenance
   intent.
5. Keep compatibility maintenance isolated and labeled as maintenance.
6. Block create, edit, and compatibility from selecting the wrong workflow.
7. Self-validate like the existing contracts: reject side effects, version
   mismatch, and disposition-state inconsistency.

## Implementation Outcome

`server/src/services/policyPersistedPolicyMaintenanceEntry.mjs` owns the
classification. It defines five disposition IDs, the next-admitted-action
shape, a pure classifier that consumes existing server-owned state, and a
self-validating result envelope.

Focused regression tests cover:
- `inspect_only` for a ready native policy
- `native_change_eligible` when change admission is available
- `recovery_required` for ambiguous or non-authoritative authority
- `compatibility_maintenance_only` for a legacy policy
- `create_path` when no policy exists
- next admitted action binding to 5R.10 change-command IDs
- side-effect rejection and self-validation

## Security Outcome

- A saved policy has one unambiguous inspection surface.
- Creating, editing, and compatibility maintenance cannot accidentally
  select the wrong payload or workflow contract.
- No persisted-policy page renders a browser-derived automation conclusion.
- Maintenance editing requires administrator authorization and revision
  checking through the 5R.10 admission.

## Next Task

The next task is **4R.8 Legacy Builder Cutover And Removal**, which makes
the new authoring flow the only normal product path by removing obsolete
parallel surfaces.
