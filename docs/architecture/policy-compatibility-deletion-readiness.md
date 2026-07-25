# Policy Compatibility Deletion Readiness

## Intent

Policy compatibility deletion readiness proves whether compatibility paths are ready for a deletion execution plan. It does not delete files, remove routes, drop tests, archive
code, or mutate storage.

This component composes existing policy migration evidence:

- a current read-only inventory of every enabled policy and its active intent authority,
- compatibility deletion gates,
- native runtime cutover verification,
- residual compatibility-reference review,
- backup, restore, rollback, support diagnostics, and deletion-manifest
  confirmations.

The output is a deletion-readiness report. Actual deletion remains blocked until
a later execution manifest explicitly names the files and replacement evidence.

## Official-Source Research

- OWASP API Security API9:2023 highlights improper inventory management and the
  risk of deprecated endpoints or stale versions being exploitable. This contract applies that principle by requiring compatibility-path inventory before
  deletion planning.
- CISA Secure by Design guidance prioritizes secure upgrade paths over unsafe
  legacy feature retention. This contract therefore does not allow replaced
  compatibility paths to become a permanent hidden model.
- NIST SSDF defines secure software development practices that must be
  integrated into the SDLC. This contract treats deletion as a gated software
  lifecycle step with validation evidence.
- NIST SP 800-34 provides contingency-planning and recovery guidance. This contract requires backup/restore and rollback verification before deletion can
  move to execution planning.

Sources:

- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- CISA Secure by Design:
  <https://www.cisa.gov/securebydesign>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>

## Recommendations

### Compose Existing Gates

Compatibility deletion readiness should not maintain a second deletion model.
It should consume the compatibility deletion-gate plan and native runtime cutover verification.

Pros:

- keeps deletion readiness aligned with existing contracts,
- avoids duplicating migration rules,
- makes failures traceable to the gate that still blocks deletion.

Cons:

- readiness cannot pass until prior gates are complete,
- the report remains conservative while unconverted support still exists.

### Measure Current Enabled-Policy Authority

The report must include a newly collected inventory of every enabled policy.
For each policy, the inventory accepts only one active `native_intent` whose
latest validation state is `valid` or `warning` without errors. Missing,
ambiguous, legacy-sourced, pending, invalid, or error-bearing active intents
block readiness. The inventory reports bounded policy-ID samples and counts,
never policy intent payloads or library names.

Pros:

- prevents a caller-provided zero conversion count from manufacturing a ready report,
- detects the real enabled-policy migration state immediately before planning,
- keeps payloads and collection metadata out of deletion diagnostics.

Cons:

- conversion evidence must be collected again for each deletion-planning attempt,
- an otherwise complete deletion plan remains blocked while any enabled policy is not native-authoritative.

### Block On Residual Compatibility References

Even when gates pass, explicit residual references should block readiness until
each reference is replaced, moved outside normal flow, or intentionally retained
by a later manifest.

Pros:

- prevents partial deletion,
- gives maintainers a concrete cleanup queue,
- avoids hidden fallback paths after cutover.

Cons:

- requires one more inventory pass before execution planning.

### Require Recovery And Support Confirmations

Deletion readiness requires:

- backup/restore verification,
- rollback support or an approved post-window stance,
- bounded support diagnostics,
- deletion manifest approval.

This remains a deletion-specific control. Native runtime cutover separately
derives each converted policy's rollback availability from its current linked
rollback snapshot in the database. That automated runtime evidence does not
replace the backup/restore, release-support, or manifest evidence required
before compatibility code could be removed. See
[Policy Native Runtime Recovery Evidence](policy-native-runtime-recovery-evidence.md).

Pros:

- keeps recovery proof ahead of deletion,
- protects operators after compatibility paths are removed,
- prevents one-click deletion from a readiness report.

Cons:

- actual deletion is intentionally delayed until the execution plan.

### Revalidate Serialized Readiness Semantics

Consumers must not trust a stored or caller-supplied `ready` claim. The
readiness validator recomputes whether the retained summaries still prove
native authority for every enabled policy, zero unresolved maintenance states,
valid native runtime cutover and deletion gates, no residual references, all
recovery/support confirmations, and the non-destructive execution-plan
handoff. It rejects a mismatched contract version, status, ready flag, or
execution policy.

Pros:

- prevents a changed JSON summary from becoming a deletion-planning authority,
- keeps readiness reports safe when they cross command or artifact boundaries,
- retains the separation between evaluation, planning, approval, and removal.

Cons:

- older serialized reports must be regenerated rather than interpreted as
  current evidence,
- a validator can prove only the bounded summaries it retains; Phase 8R.15
  continues to own current evidence freshness and collection-window coherence.

## Final Recommendation Stack

Use this stack:

1. `policyCompatibilityDeletionGates.mjs` proves compatibility
   deletion gates and coverage.
2. `policyCompatibilityDeletionCurrentInventory.mjs` measures whether every
   enabled policy has one valid active native intent.
3. `policyNativeRuntimeRecoveryEvidence.mjs` proves that each active native
   policy has a currently usable, bounded rollback record without exposing the
   snapshot payload.
4. `policyNativeRuntimeCutoverVerification.mjs` proves converted
   and unconverted runtime read behavior using that recovery result.
5. `policyCompatibilityDeletionReadiness.mjs` composes the prior evidence
   outputs with residual-reference and safety confirmations, then revalidates
   serialized summaries before they can claim readiness.
6. A later component should create an execution manifest from a fresh,
   coherent evidence bundle before any
   compatibility path is removed.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionReadiness.mjs`.
- Added a readiness status vocabulary:
  - ready for deletion execution plan,
  - blocked by runtime cutover,
  - blocked by deletion gates,
  - blocked by residual compatibility references,
  - blocked by safety confirmation.
- Added risk IDs for cutover, deletion gates, residual references, recovery
  confirmations, support diagnostics, deletion manifest approval, and forbidden
  side effects.
- Added focused tests for the ready path, cutover blocker, deletion-gate
  blocker, residual-reference blocker, safety-confirmation blocker, and
  side-effect validation.
- Added a mandatory current-policy-inventory gate. Compatibility deletion
  readiness and the execution-plan contract both reject absent, stale-contract,
  invalid, or non-native-authoritative current inventory evidence.
- Added `npm run policy:compatibility-deletion-current-inventory` to collect a
  read-only current inventory. Use
  `--require-all-enabled-policies-native` when the inventory is an explicit
  release gate.
- Hardened serialized readiness validation. Ready reports now carry the
  upstream cutover and deletion-gate contract versions and are rejected when
  their retained source summaries, derived status, ready flag, recovery
  confirmations, non-destructive policy, or execution-plan handoff disagree.
  Freshness remains intentionally owned by the later execution-plan evidence
  bundle, which collects the source evidence in one bounded observation window.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no storage mutation,
- no deletion-manifest write.

## Next Step

Proceed with **Compatibility Path Deletion Execution Plan**. That
task should create an explicit, reviewable manifest of exact compatibility files
or code paths to remove, their replacement evidence, rollback/support stance,
and execution prerequisites before any deletion occurs.
