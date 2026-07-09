# Policy Storage Final Closure Readout Module Cutover

## Intent

Remove temporary roadmap-phase naming from the policy storage final closure
readout production surface after the checkpoint handoff was renamed to durable
storage-domain terms.

This cutover covers:

- `policyStorageFinalClosureReadout.mjs`
- `policy.storage_final_closure_readout.v1`
- `generate-policy-storage-final-closure-readout.mjs`
- `npm run policy:storage-final-closure-readout`
- `nextStep.stepId = policy_storage_closure_complete`

The broader current repository closure audit remains a separate component. This
document only covers the final readout module, runner, tests, and downstream
references needed for that readout.

## Official-Source Research

- NIST SSDF supports traceable, maintainable secure software changes. The
  rename uses explicit moves, focused tests, and validation gates instead of
  mixing behavior changes into the cutover.
- NIST SP 800-128 supports controlled configuration change. The cutover keeps
  status IDs and risk IDs stable while changing temporary phase names to durable
  policy storage names.
- OWASP Logging guidance supports bounded, actionable event data. Operator
  summaries remain bounded and do not expose command logs, secrets, or raw
  evidence dumps.
- Git `mv` supports explicit repository file movement so history remains
  inspectable during large rename batches.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Rename The Product Surface

Use policy storage closure terminology for module names, exported builders,
constants, version strings, runner names, and operator-facing messages.

Pros:

- production code no longer depends on temporary roadmap labels,
- future storage closure work can reuse the same product-domain vocabulary,
- downstream imports are easier to understand without reading the roadmap.

Cons:

- downstream tests and scripts must be updated in the same commit.

### Keep Compatibility Evidence In Tests And Docs

Roadmap phase IDs remain valid in roadmap sequencing, historical docs, and
compatibility evidence, but not as the final readout production API.

Pros:

- preserves migration traceability,
- avoids breaking evidence tests that prove old-to-new handoff behavior,
- keeps product code aligned with durable domain language.

Cons:

- scans must distinguish docs/history references from production imports.

### Preserve Behavior

The cutover should not change closure rules. It should only rename the readout
surface and replace the completion handoff with semantic `nextStep` evidence.

Pros:

- narrows blast radius,
- keeps checkpoint and current-closure behavior testable,
- avoids hiding behavior changes inside a rename.

Cons:

- deeper current-closure audit naming remains a follow-up task.

## Final Recommendation Stack

Use this stack for the policy storage final closure readout cutover:

1. Move service, focused test, script, and documentation files with `git mv`.
2. Rename exports, constants, version strings, package runner, and imports.
3. Replace production `nextPhase.phaseId` output with semantic `nextStep`.
4. Update operator messages to policy storage closure language.
5. Update validation command maps and downstream current-closure consumers.
6. Run focused tests, stale-reference scans, docs lint, and inventory validation.

## Implementation Outcome

Implemented:

- Renamed the readout service to `policyStorageFinalClosureReadout.mjs`.
- Renamed the focused test suite to
  `policyStorageFinalClosureReadout.test.mjs`.
- Renamed the CLI script to `generate-policy-storage-final-closure-readout.mjs`.
- Renamed the root runner to `policy:storage-final-closure-readout`.
- Renamed the design document to `policy-storage-final-closure-readout.md`.
- Replaced the production readout version with
  `policy.storage_final_closure_readout.v1`.
- Replaced production `nextPhase.phaseId` completion output with
  `nextStep.stepId = policy_storage_closure_complete`.
- Updated current repository closure audit imports and messages to consume the
  durable readout names.
- Updated the roadmap, validation evidence command set, and changelog to point
  at the durable readout surface.

## Next Step

Proceed with **Current Repository Closure Audit module naming cutover** so the
next consumer of the storage final closure readout no longer uses temporary
roadmap-phase production names.
