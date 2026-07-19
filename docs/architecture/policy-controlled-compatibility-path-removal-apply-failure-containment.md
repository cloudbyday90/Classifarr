# Policy Controlled Compatibility Path Removal Apply Failure Containment

## Intent

Contain a controlled compatibility-removal apply batch at its first
adapter-level anomaly. A reviewed batch may apply a narrow prefix, but it must
not continue into later paths after the adapter throws, rejects an entry, or
reports a prohibited effect.

## Research Baseline

This design uses official guidance current as of June 2026:

- [OWASP Top 10:2025 A10: Mishandling of Exceptional Conditions](https://owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions/)
  recommends fail-closed behavior for exceptional conditions rather than
  attempting unsafe partial continuation.
- [OWASP CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)
  calls for explicit flow control, artifact integrity validation, least
  privilege, and visibility around automated execution.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats controlled modification and ongoing monitoring as configuration
  management responsibilities.
- [SLSA artifact verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts)
  requires consumers to verify provenance against their expectations before
  using an artifact.

## Options Considered

### Continue After An Adapter Error

Pros:

- can complete unaffected later paths.

Cons:

- broadens the executed prefix after the destructive boundary is no longer
  trustworthy,
- obscures partial state and makes recovery harder,
- conflicts with fail-closed exception handling.

### Stop Only After A Thrown Error

Pros:

- limits one class of adapter failure.

Cons:

- still continues after an `applied=false`, mismatched path/action, or a
  reported archive, storage, or Git mutation effect,
- leaves malformed adapter behavior able to broaden the batch.

### Stop After Any Adapter-Level Anomaly

Pros:

- bounds the affected work to the reviewed prefix already attempted,
- preserves a precise halted entry and reason for diagnostics,
- preserves partial-success evidence for the dedicated verification task and
  routes zero-success to explicit blocker resolution.

Cons:

- requires remediation and a fresh reviewed batch rather than automatic
  continuation,
- does not undo a path that an adapter reports as successfully applied before a
  later anomaly.

## Final Recommendation Stack

1. Keep review-artifact and pre-apply checkout validation before every adapter
   invocation.
2. Stop the loop after the first adapter exception.
3. Stop the loop after a result is not applied, does not match the reviewed
   path/action, or reports an archive, storage, or Git mutation effect.
4. Return a fixed halt reason and bounded stopped entry.
5. Preserve only the actual applied prefix as evidence.
6. Add a dedicated partial-apply verifier before permitting runtime
   verification for partial success; use blocker resolution when no path
   applied.

## Implementation Outcome

`policyControlledCompatibilityPathRemovalApply.mjs` now exposes contract
version `policy.controlled_compatibility_path_removal_apply.v4` and the fixed
`POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS`
vocabulary:

- `pre_apply_recheck_failed`
- `adapter_failure`
- `adapter_result_rejected`

The service records `applyBatch.blockedEntry` and
`applyBatch.haltReasonId`, halts before later entries are checked or submitted,
and validates that a reported halt reason is known and tied to a bounded entry.
The apply-artifact wrapper carries the halt reason and the exact semantic next
step from the apply outcome.

Focused tests prove that a mid-batch adapter exception prevents a third entry
from reaching the adapter, malformed results stop immediately, and forbidden
reported effects stop immediately.

## Boundaries

This component does not add rollback of an already applied path, filesystem
deletion mechanics, Git mutation, database mutation, or automatic retry. A
later component may decide whether a verified, fresh reviewed batch can be
created after a blocker is resolved; it must not reuse a failed apply batch.
Task 8R.19.2 owns verification eligibility for a partial applied prefix and
must not allow it to authorize another removal batch or completion audit.
