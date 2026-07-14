# Policy Storage Closure Evidence Run

## Intent

Policy storage closure needs a durable evidence runner that proves the current
repository still satisfies the storage-closure checkpoint. The runner consumes
bounded repository evidence, a fingerprint-valid compatibility-removal
completion-audit artifact,
validation evidence, roadmap coverage, and changelog coverage, then delegates
the completion decision to the policy storage completion checkpoint.

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

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

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
5. Emit `policy.storage_closure_evidence_run.v1` and
   `policy.storage_closure_current_evidence_collector.v1`.
6. Emit `componentId` and semantic `nextStep` output rather than delivery
   identifiers.
7. Require durable component IDs at every evidence input boundary.
8. Keep validation command execution outside this runner.

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
