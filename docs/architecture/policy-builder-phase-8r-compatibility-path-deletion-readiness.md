# Policy Builder Phase 8R Compatibility Path Deletion Readiness

## Intent

Phase 8R.14 proves whether compatibility paths are ready for a deletion
execution plan. It does not delete files, remove routes, drop tests, archive
code, or mutate storage.

This component composes earlier Phase 8R evidence:

- Phase 8R.7 legacy code deletion gates,
- Phase 8R.13 native runtime cutover verification,
- residual compatibility-reference review,
- backup, restore, rollback, support diagnostics, and deletion-manifest
  confirmations.

The output is a deletion-readiness report. Actual deletion remains blocked until
a later execution manifest explicitly names the files and replacement evidence.

## Official-Source Research

- OWASP API Security API9:2023 highlights improper inventory management and the
  risk of deprecated endpoints or stale versions being exploitable. Phase 8R.14
  applies that principle by requiring compatibility-path inventory before
  deletion planning.
- CISA Secure by Design guidance prioritizes secure upgrade paths over unsafe
  legacy feature retention. Phase 8R.14 therefore does not allow replaced
  compatibility paths to become a permanent hidden model.
- NIST SSDF defines secure software development practices that must be
  integrated into the SDLC. Phase 8R.14 treats deletion as a gated software
  lifecycle step with validation evidence.
- NIST SP 800-34 provides contingency-planning and recovery guidance. Phase
  8R.14 requires backup/restore and rollback verification before deletion can
  move to execution planning.

Sources:

- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- CISA Secure by Design:
  <https://www.cisa.gov/securebydesign>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>

## Recommendations

### Compose Existing Phase 8R Gates

Compatibility deletion readiness should not maintain a second deletion model.
It should consume the Phase 8R.7 deletion-gate plan and Phase 8R.13 cutover
verification.

Pros:

- keeps deletion readiness aligned with existing contracts,
- avoids duplicating migration rules,
- makes failures traceable to the gate that still blocks deletion.

Cons:

- readiness cannot pass until prior gates are complete,
- the report remains conservative while unconverted support still exists.

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

Pros:

- keeps recovery proof ahead of deletion,
- protects operators after compatibility paths are removed,
- prevents one-click deletion from a readiness report.

Cons:

- actual deletion is intentionally delayed until the execution plan.

## Final Recommendation Stack

Use this stack for Phase 8R.14:

1. `policyBuilderPhase8LegacyCodeDeletionGates.mjs` proves compatibility
   deletion gates and coverage.
2. `policyBuilderPhase8NativeRuntimeCutoverVerification.mjs` proves converted
   and unconverted runtime read behavior.
3. `policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs` composes both
   outputs with residual-reference and safety confirmations.
4. A later Phase 8R component should create an execution manifest before any
   compatibility path is removed.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8CompatibilityPathDeletionReadiness.mjs`.
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

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no storage mutation,
- no deletion-manifest write.

## Next Step

Proceed with **Phase 8R.15 Compatibility Path Deletion Execution Plan**. That
task should create an explicit, reviewable manifest of exact compatibility files
or code paths to remove, their replacement evidence, rollback/support stance,
and execution prerequisites before any deletion occurs.
