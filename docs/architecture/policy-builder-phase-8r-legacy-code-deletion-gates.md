# Policy Builder Phase 8R Legacy Code Deletion Gates

Status: implemented as the seventh Phase 8R storage-migration component.

## Problem

Phase 8R has begun defining native policy intent storage, conversion planning,
runtime reads, rollback windows, and legacy write shutdown. The next risk is
allowing replaced compatibility code to remain indefinitely. That would leave
Classifarr with two policy models: native intent for converted policies and
legacy preset/custom-signal behavior for everything else.

Phase 8R.7 does not delete files yet. It creates a side-effect-free deletion
gate contract that answers:

```text
Which legacy compatibility surfaces can be removed, what replacement coverage
must prove safety, and what still blocks deletion?
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends risk-based secure software practices and gap-driven action plans.
  Phase 8R.7 applies this by turning compatibility removal into explicit gates
  rather than an informal cleanup task.
- [OWASP API Security: Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that deprecated versions and stale endpoints can be exploited. The same
  principle applies to stale policy behavior paths: keep an inventory, then
  decommission replaced surfaces after coverage and migration gates pass.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign) and its secure
  by design guidance discourage unsafe legacy features and prioritize clear
  upgrade paths over indefinite backwards compatibility. Phase 8R.7 therefore
  rejects hiding or preserving replaced compatibility code permanently.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  provides contingency-planning and recovery guidance. Phase 8R.7 requires
  backup/restore and rollback coverage before deletion readiness.

## Recommendations

1. **Delete only after explicit gates.**
   Replaced compatibility code should be deleted after native schema,
   conversion, rollback, read/write parity, write shutdown, backup/restore, and
   regression gates pass.

2. **Classify deletion surfaces by category.**
   Deletion readiness must name the affected categories: client bridge-only UI,
   legacy serializer/deserializer paths, custom-signal mutation helpers,
   preset-as-policy runtime behavior, old preview/replay diagnostics, and stale
   compatibility tests.

3. **Require replacement coverage.**
   Deletion requires native read/write tests, runtime native decision tests,
   conversion/reversion tests, backup/restore tests, post-upgrade dry-run/apply
   tests, and deletion-gate tests.

4. **Block on unconverted policies.**
   Compatibility code cannot be removed while converted-policy count is
   unknown or unconverted policies remain.

5. **Require an explicit support stance.**
   Remaining compatibility must be intentionally supported until converted,
   time-bounded, or unsupported after a defined window. The default is to block
   deletion.

6. **Plan only in this slice.**
   Phase 8R.7 performs no file deletion, archive moves, route removal, test
   removal, or storage mutation. Deletion execution is a later controlled step.

## Pros And Cons

Pros:

- Prevents permanent dual policy models.
- Gives future cleanup work a testable deletion-readiness contract.
- Makes remaining compatibility intentional and time-bounded.
- Keeps backup, restore, rollback, and post-upgrade proof ahead of deletion.
- Avoids accidental file or storage mutation during planning.

Cons:

- Does not remove legacy code in this component.
- Requires later components to supply real coverage evidence.
- Keeps compatibility code present until unconverted policies and support
  stance are known.

## Final Recommendation Stack

- Server module:
  `server/src/services/policyBuilderPhase8LegacyCodeDeletionGates.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase8LegacyCodeDeletionGates.test.mjs`
- Compatibility inventory input:
  `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-8r-legacy-code-deletion-gates.md`
- Roadmap owner:
  Phase 8R.7 in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- deletion category IDs,
- required replacement coverage IDs,
- support stance IDs,
- deletion readiness status IDs,
- validation risk IDs,
- a deletion-gate plan builder,
- a deletion-gate validator,
- an audit summary builder.

Default status is `blocked_by_unconverted_policies` because deletion cannot
proceed until the remaining unconverted-policy count is measured. A plan becomes
`ready_to_delete` only when:

- unconverted policy count is exactly zero,
- support stance is explicit,
- all replacement coverage gates are provided,
- compatibility deletion inventory is present,
- deletion policy deletes replaced code instead of hiding it,
- no planning side effects are marked true.

## Security Outcome

- Deleted-code readiness is fail-closed.
- Deprecated compatibility surfaces are inventoried before removal.
- Unconverted policies block deletion.
- Support stance must be explicit.
- Replacement coverage is allow-listed and auditable.
- The service validates that Phase 8R.7 performs no deletion, archive, route,
  test, or storage side effects.

## Next Step

Proceed to **Phase 8R.8 Backup, Restore, And Post-Upgrade Safety**. That
component should provide the operational proof required by the deletion gates:
backup coverage, restore validation, post-upgrade dry-run reporting, apply-mode
safety, and mixed-write failure protection.
