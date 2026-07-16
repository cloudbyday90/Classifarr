# Policy Compatibility Removal Completion Audit Module Cutover

## Intent

Cut over compatibility removal completion audit modules from phase-coded
production names to durable policy-domain names while preserving the
side-effect-free completion and remaining-inventory audit behavior.

## Official-Source Research

- NIST SP 800-128 frames configuration management as controlled change with
  ongoing integrity monitoring. This cutover keeps compatibility cleanup
  completion tied to explicit evidence instead of narrative confidence.
- NIST SSDF emphasizes secure development practices and evidence across the
  software lifecycle. The renamed audit preserves machine-readable proof before
  storage cleanup can be treated as complete.
- OWASP Logging guidance recommends event records that carry enough context for
  operational and security review. The audit keeps inventory, validation,
  reference-scan, risk, and side-effect context in the payload.
- Git `mv` documents explicit tracked file movement. The implementation uses
  tracked renames so filenames, imports, runners, and documentation reflect the
  durable contract.

Sources:

- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Use Policy-Domain Names

Production modules, exports, tests, runners, docs, and payload versions should
describe the durable behavior:

- `policyCompatibilityRemovalCompletionAudit.mjs`
- `policyCompatibilityRemovalCompletionAuditArtifact.mjs`
- `policy.compatibility_removal_completion_audit.v2`
- `policy.compatibility_removal_completion_audit_artifact.v4`
- `npm run policy:compatibility-removal-completion-audit`

Pros:

- removes phase-coded names from production contracts,
- keeps the completion audit reusable after roadmap phases are obsolete,
- preserves existing removal completion semantics.

Cons:

- requires downstream checkpoint, evidence, and validation imports to update in
  the same commit.

### Replace Phase Handoffs With Semantic Steps

The audit payloads should emit
`nextStep.stepId = policy_storage_completion_checkpoint` and should not expose
`nextPhase.phaseId`.

Pros:

- prevents phase identifiers from leaking into runtime payloads,
- makes the next workflow action understandable after Phase 8R is historical,
- matches the previous Phase 6R cutover contracts.

Cons:

- consumers that still expect `nextPhase` need tests or import updates.

## Final Recommendation Stack

1. Rename modules, tests, docs, and CLI runner to policy-domain names.
2. Rename constants, builders, validators, and payload versions to semantic
   names.
3. Replace `nextPhase.phaseId` with `nextStep.stepId`.
4. Preserve remaining-inventory and completion-audit behavior.
5. Update downstream checkpoint, evidence, validation, and final-audit maps.
6. Run focused contract tests plus docs/name-inventory gates before commit.

## Implementation Outcome

Implemented:

- Renamed the core completion audit module and focused test.
- Renamed the wrapper artifact module and focused test.
- Renamed the CLI exporter to
  `scripts/generate-policy-compatibility-removal-completion-audit.mjs`.
- Renamed the root runner to
  `policy:compatibility-removal-completion-audit`.
- Updated version strings, constants, builders, validators, imports, and
  documentation references.
- Replaced production `nextPhase.phaseId` handoffs with semantic `nextStep`
  payloads.
- Added a bounded SHA-256 artifact fingerprint and retained the verified
  execution-plan wrapper, derived execution plan, and audit input so storage
  closure can replay the audit before consuming it. Raw nested plans are not
  accepted as authority.

Next:

- Add equivalent integrity protection to the current-state closure evidence
  artifact.
