# Policy Compatibility Deletion Gates

Status: implemented as the durable policy compatibility deletion-gate contract.

## Problem

Classifarr is moving from legacy preset/custom-signal compatibility behavior to
native policy intent. The next risk is allowing replaced compatibility code to
remain indefinitely. That would leave Classifarr with two policy models: native
intent for converted policies and legacy preset/custom-signal behavior for
everything else.

This service does not delete files. It creates a side-effect-free deletion-gate
contract that answers:

```text
Which legacy compatibility surfaces can be removed, what replacement coverage
must prove safety, and what still blocks deletion?
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends risk-based secure software practices and gap-driven action plans.
  This contract applies that guidance by turning compatibility removal into
  explicit gates rather than an informal cleanup task.
- [OWASP API Security: Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that deprecated versions and stale endpoints can be exploited. The same
  principle applies to stale policy behavior paths: keep an inventory, then
  decommission replaced surfaces after coverage and migration gates pass.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign) and its secure
  by design guidance discourage unsafe legacy features and prioritize clear
  upgrade paths over indefinite backwards compatibility. This contract therefore
  rejects hiding or preserving replaced compatibility code permanently.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  provides contingency-planning and recovery guidance. This contract requires
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

6. **Plan only in this contract.**
   The service performs no file deletion, archive moves, route removal, test
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
  `server/src/services/policyCompatibilityDeletionGates.mjs`
- Test module:
  `server/src/__tests__/services/policyCompatibilityDeletionGates.test.mjs`
- Compatibility inventory input:
  `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`
- Documentation:
  `docs/architecture/policy-compatibility-deletion-gates.md`
- Roadmap owner:
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
- The service validates that this contract performs no deletion, archive, route,
  test, or storage side effects.

## Next Step

Proceed to **Backup, Restore, And Post-Upgrade Safety**. That component should
provide the operational proof required by the deletion gates: backup coverage,
restore validation, post-upgrade dry-run reporting, apply-mode safety, and
mixed-write failure protection.
