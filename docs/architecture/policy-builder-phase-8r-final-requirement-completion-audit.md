# Policy Builder Phase 8R Final Requirement Completion Audit

## Intent

Phase 8R.35 adds the final requirement-by-requirement audit before Phase 8R can
be treated as complete. It verifies the full current Phase 8R sequence from
8R.1 through 8R.34, not only the original 8R.1 through 8R.22 completion
checkpoint.

The audit consumes the policy storage current closure audit, then
independently checks the current checkout for each required component's
design/outcome document, service/script/route/migration/wiring evidence, focused
test evidence, roadmap component section, work-sequence entry, and changelog
coverage.

## Research Sources

- NIST SSDF SP 800-218: <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST SP 800-128 security-focused configuration management:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- SLSA v1.0 provenance requirements:
  <https://slsa.dev/spec/v1.0/requirements>

## Recommendations

- Use current-state evidence, not narrative status, for completion decisions.
- Keep the audit side-effect-free so it can be safely run during release,
  upgrade, and local verification workflows.
- Treat roadmap, changelog, docs, contracts, and tests as separate evidence
  classes; one cannot substitute for another.
- Keep the machine-readable audit bounded to status, risks, path lists, and
  summaries instead of embedding command logs or raw payloads.

## Pros And Cons

Pros:

- Prevents the later 8R artifact/exporter work from being omitted by the older
  8R.22 checkpoint range.
- Makes Phase 8R completion auditable from the repository state and generated
  closure artifact.
- Keeps command execution in scripts and validation generators, not in the pure
  completion decision service.

Cons:

- Maintains one more explicit artifact map that must be updated if Phase 8R
  gains additional components.
- Blocks completion on documentation or changelog drift even when code tests
  pass.
- Requires the policy storage current closure audit artifact to exist before the final
  audit can pass.

## Final Recommendation Stack

- `policyBuilderPhase8FinalRequirementCompletionAudit.mjs` as the pure audit
  service.
- `run-policy-builder-phase-8r-final-requirement-audit.mjs` as the CLI wrapper.
- `policy:phase8r:final-requirement-audit` as the root npm command.
- Focused Jest coverage for complete evidence, late-component gaps, roadmap
  gaps, changelog gaps, incomplete current closure, side effects, and validation
  invariants.
- Include the new audit in Phase 8R validation evidence so future closure
  evidence proves the final audit itself.

## Implementation Outcome

The implementation adds a final audit that:

- requires a complete and valid policy storage current closure audit,
- inventories mapped current checkout artifacts for 8R.1 through 8R.34,
- verifies every mapped component has design, contract/script/wiring, and test
  evidence,
- verifies the roadmap component map and work sequence include every phase,
- verifies changelog coverage for every phase label,
- rejects file writes, storage mutation, Git commands, command execution, and
  manifest writes inside the service, and
- emits a stable `complete` or blocked status with exact missing evidence.

## Next Step

Run the final audit against a generated policy storage current closure artifact.
If it passes against current repository evidence and validation evidence, Phase
8R can move to the final goal completion audit.
