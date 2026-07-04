# Policy Migration Verifier And Rollback Architecture Cutover

## Status

Implemented on July 4, 2026 as part of production architecture naming
stabilization. This document records the cutover from a roadmap-phase active
design record to the durable policy migration verifier and rollback contract.

## Goal

Migration verification compares a library-derived rebuild proposal against
sanitized legacy behavior samples, emits only migration-relevant differences,
binds the comparison to a stable sample-set fingerprint, and enforces operator
acceptance, rollback snapshot, and legacy deletion gates. The implementation
already used durable module names; this cutover removes the remaining active
design-record dependency on phase-coded naming and aligns the roadmap with the
product contract.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports verification and secure release practices before behavior changes.
  This cutover preserves deterministic verifier checks before replacement paths
  can apply generated proposals.
- [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
  provides contingency, backup, recovery, and system integrity control
  guidance. This cutover preserves rollback snapshot and restore-path
  requirements before replacement or deletion can advance.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for server-side verification and business-logic controls.
  This cutover preserves server-owned acceptance, rollback, deletion, and
  side-effect gates.
- [Microsoft Safe Deployment Practices](https://learn.microsoft.com/en-us/devops/operate/safe-deployment-practices)
  recommend using quality signals and rollback to reduce release risk. This
  cutover keeps the verifier report as a quality gate before replacement.
- [PostgreSQL Backup And Restore](https://www.postgresql.org/docs/current/backup.html)
  documents backup and restore approaches for PostgreSQL data. This cutover
  keeps rollback proof explicit rather than relying on operator memory.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous, lower-case namespacing. This cutover
  preserves `policy.migration_verifier.v1`,
  `policy.migration_verifier_sample_set_fingerprint.v1`, and bounded
  `classifarr.policy.migration_verifier.*` trace naming.

## Recommendations

1. **Use durable migration-verifier naming.** The active design record should be
   `policy-migration-verifier-rollback.md`; roadmap-phase names should remain
   only as historical sequencing labels.
2. **Keep verification side-effect-free.** The verifier should not apply
   replacements, create rollback snapshots, delete legacy paths, write learning,
   route media, or call providers.
3. **Bind reports to sample proof.** Reports should carry a stable sample-set
   fingerprint and bounded provenance derived from normalized samples, verifier
   options, and rebuild proposal evidence metadata.
4. **Recompute proposal validation.** Reports should not trust stale client or
   integration validation flags.
5. **Require rollback before replacement.** Operator acceptance, rollback
   snapshot, and restore-path proof should remain explicit preconditions.

## Pros And Cons

Pros:

- Removes active production architecture dependence on roadmap-phase wording.
- Keeps generated-policy replacement gated by bounded verifier evidence.
- Preserves sample-set fingerprinting, rollback proof, deletion criteria, and
  side-effect rejection.
- Keeps migration verifier output focused on migration-relevant behavior
  changes instead of noisy diagnostics.

Cons:

- This cutover does not make replacement or deletion executable.
- Historical roadmap and changelog records still contain phase-coded sequence
  labels by design.
- Downstream active architecture records need their own cutover passes before
  the runtime chain is fully product-named.

## Final Recommendation Stack

- Migration verifier service:
  `server/src/services/policyMigrationVerifierRollback.mjs`
- Focused tests:
  `server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Migration/deletion plan dependency:
  `server/src/services/policyMigrationDeletionPath.mjs`
- Active design record:
  `docs/architecture/policy-migration-verifier-rollback.md`
- Historical module cutover record:
  `docs/architecture/policy-migration-verifier-rollback-module-cutover.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Production naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active migration verifier and rollback design record to
  `policy-migration-verifier-rollback.md`.
- Updated the active design record to describe the durable migration verifier
  and rollback contract rather than a phase-local checkpoint.
- Updated roadmap implementation status and module-cutover references to point
  at the durable design record.
- Preserved the existing `policyMigrationVerifierRollback.mjs` behavior,
  contract versions, sample-set fingerprinting, deletion criteria, trace shape,
  and validation gates.

## Security Outcome

- Migration verification remains deterministic and side-effect-free.
- The verifier does not call providers, run live replay, expose raw provider
  payloads, prompts, or embeddings, activate, replace, delete, write learning,
  write routing, or create rollback snapshots.
- Replacement remains blocked without operator acceptance and rollback proof.
- Legacy deletion remains blocked without native intent storage stability,
  verifier pass, rollback, retention, approval, and replacement criteria.
- Trace output remains bounded to reason codes, counts, and fingerprints rather
  than raw evidence, provider payloads, prompts, AI text, replay diagnostics, or
  item titles.

## Next Step

Runtime Metrics And Decision Trace Architecture Cutover should rename the
active runtime metrics and trace design record to durable product-domain wording
and keep metrics correlated by bounded upstream fingerprints.
