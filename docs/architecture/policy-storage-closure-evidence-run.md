# Policy Storage Closure Evidence Run

## Intent

Policy storage closure needs a durable evidence runner that distinguishes two
bounded decisions. `implementationReadiness` proves that the current repository
has the required source evidence. `instanceCutover` reports whether the active
installation has completed its fingerprint-valid compatibility-removal audit.
The runner composes both only for final storage closure; a blocked local
cutover must not be reported as incomplete repository implementation.

This component is a local and CI tooling boundary. It is not runtime
classification logic, does not mutate policy storage, and does not execute
validation commands itself. Validation command execution stays in the separate
policy storage closure validation evidence generator.

## Official-Source Research

- NIST SSDF recommends repeatable secure development practices with verification
  evidence across the software lifecycle. This runner makes closure proof
  explicit and machine-readable instead of relying on a narrative completion
  claim.
- NIST SP 800-128 frames configuration changes as controlled, traceable changes.
  The runner maps every closure component to reviewed docs, contracts, and
  focused tests before allowing the checkpoint to pass.
- OWASP Logging Cheat Sheet recommends consistent, bounded event data. The
  runner emits bounded status, counts, risks, missing paths, and side-effect
  flags rather than full command logs or raw repository content.
- Node.js file-system documentation supports file reads through the `fs` module.
  The current evidence collector uses bounded repository file reads in a
  short-lived local/CI script; the pure evidence-run service accepts evidence as
  input and does not read files directly.
- Node.js documents that `path.resolve(base, relativePath)` produces a
  normalized absolute path from the supplied base. The public command therefore
  uses its selected checkout as the only base for relative evidence artifacts.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>
- Node.js path API:
  <https://nodejs.org/api/path.html>

## Recommendations

### Use Durable Storage-Closure Names

The service, current-state collector, tests, CLI, npm runner, payload version,
and operator-facing messages should use storage-closure names rather than
temporary phase names.

Pros:

- keeps production contracts meaningful after the project phase is over,
- makes downstream closure audits easier to read,
- prevents future work phases from leaking into long-lived service names.

Cons:

- callers of the old runner must switch to the new npm script.

### Keep Collection Separate From Evaluation

The current-state collector may read repository files and build artifact,
roadmap, and changelog evidence. The evidence-run evaluator should stay pure
and consume evidence as input.

Pros:

- keeps closure rules deterministic and unit-testable,
- makes file-read side effects explicit,
- lets CI or release scripts evolve collection behavior without changing
  checkpoint semantics.

Cons:

- introduces one extra orchestration boundary.

### Emit Component-Oriented Evidence

The artifact map uses durable component identifiers. Generated evidence emits
`componentId` and semantic `nextStep` fields; roadmap label matching is an
internal collection detail and not part of the evidence contract.

Pros:

- removes public `phaseId` and `nextPhase` output,
- keeps the evidence schema independent of roadmap delivery notation,
- aligns with the storage checkpoint contract.

Cons:

- older ad hoc evidence JSON must be regenerated with durable component IDs.

### Separate Repository And Installation Scopes

The closure output must expose repository implementation readiness separately
from active-installation cutover readiness. Only the latter may depend on
database state, and only the combined final-closure result may require both.

Pros:

- CI and release readiness remain environment-agnostic,
- local deletion safety remains fail-closed,
- blocked output identifies the scope that needs attention.

Cons:

- consumers need to read two explicit readiness fields.

### Bind Relative Artifact Paths To The Selected Checkout

The public evidence command must resolve relative completion-audit and
validation-evidence paths from its explicit `--cwd` checkout, rather than from
the shell that launched it.

Pros:

- prevents source files from one checkout being evaluated with artifacts from
  another,
- keeps portable CI and local invocations deterministic,
- preserves absolute artifact paths as explicit operator input.

Cons:

- callers must use absolute paths when artifacts intentionally live outside
  the selected checkout.

### Reject Side Effects

The evidence run should not write files, mutate storage, run commands, execute
Git, edit the changelog, or delete source code.

Pros:

- makes closure checks safe to run locally and in CI,
- prevents the checker from changing the evidence it evaluates,
- keeps command execution in the validation evidence generator.

Cons:

- fresh validation evidence must be supplied separately.

## Final Recommendation Stack

1. Use `policyStorageClosureEvidenceRun.mjs` for the pure closure evidence
   evaluator.
2. Use `policyStorageClosureCurrentEvidenceCollector.mjs` for bounded repository
   file reads and current-state evidence collection.
3. Use `run-policy-storage-closure-evidence.mjs` as the CLI wrapper.
4. Expose `npm run policy:storage-closure-evidence`.
5. Emit `policy.storage_closure_evidence_run.v3` and
   `policy.storage_closure_current_evidence_collector.v3` so consumers can
   distinguish repository implementation readiness from active-installation
   cutover readiness.
6. Emit `componentId` and semantic `nextStep` output rather than delivery
   identifiers.
7. Require durable component IDs at every evidence input boundary.
8. Keep validation command execution outside this runner.
9. Keep repository implementation readiness separate from active-installation
   cutover readiness.
10. Resolve each relative input artifact from the selected `--cwd` checkout.

## Implementation Outcome

Implemented:

- Renamed the completion evidence run service to
  `policyStorageClosureEvidenceRun.mjs`.
- Renamed the current-state collector to
  `policyStorageClosureCurrentEvidenceCollector.mjs`.
- Renamed the CLI to `run-policy-storage-closure-evidence.mjs`.
- Added root npm script `policy:storage-closure-evidence`.
- Replaced public payload versions with storage-closure versions.
- Replaced public `phaseId` component evidence with `componentId`.
- Replaced public `nextPhase` output with semantic `nextStep` output.
- Preserved Windows/POSIX path normalization.
- Replaced dynamic roadmap-label regular expression construction with a bounded
  line parser. It accepts only known sequence and implementation-status entry
  shapes, matches complete labels case-insensitively, and rejects longer label
  prefixes instead of interpreting label text as executable pattern syntax.
- Preserved artifact inventory, roadmap, changelog, completion-audit artifact,
  validation evidence, checkpoint composition, side-effect rejection, and
  complete/blocked status behavior.
- Added a repository-scoped `implementationReadiness` projection that does not
  consume completion-audit or database evidence.
- Added an active-installation `instanceCutover` projection for the existing
  compatibility-removal completion-audit state. It remains required for final
  storage closure and cannot authorize a deletion by itself.
- Added an exact component scope map. The repository artifact catalog filters
  installation-only compatibility workflow entries even when callers provide a
  custom map; checkpoint and runner validators reject missing, relabeled, or
  count-mismatched scope entries. See [Policy Closure-Map
  Reconciliation](policy-closure-map-reconciliation.md).
- The public command now resolves relative completion-audit and validation
  artifacts from `--cwd`, so a caller directory cannot mix another checkout's
  evidence with the selected repository inventory.

Example:

```bash
node scripts/run-policy-storage-closure-evidence.mjs \
  --completion-audit-artifact .tmp/policy-storage/completion-audit-artifact.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --require-complete
```

## Next Step

Proceed with a stale phase-coded verifier audit for the policy builder impact
and replay migration verifier services.
