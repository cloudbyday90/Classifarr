# Policy Next Compatibility Removal Batch Authorization Module Cutover

## Intent

Cut over the next compatibility removal batch authorization modules from
phase-coded production names to durable policy-domain names while preserving the
side-effect-free authorization behavior.

## Official-Source Research

- NIST SP 800-128 treats configuration management as a controlled process for
  managing and monitoring system configurations. The cutover keeps compatibility
  removal authorization explicit, bounded, and reviewable.
- NIST SSDF emphasizes evidence-producing secure development practices. The
  renamed contract keeps authorization and artifact output machine-readable
  without performing destructive side effects.
- OWASP Logging guidance recommends event records with enough context for
  operational and security review. The payload retains authorizer, reason,
  selected paths, remaining inventory, risk count, and side-effect summary.
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

- `policyNextCompatibilityRemovalBatchAuthorization.mjs`
- `policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs`
- `policy.next_compatibility_removal_batch_authorization.v1`
- `policy.next_compatibility_removal_batch_authorization_artifact.v1`
- `npm run policy:next-batch-authorization`

Pros:

- removes phase-coded names from production contracts,
- makes downstream consumers easier to reason about,
- preserves the existing authorization semantics.

Cons:

- requires downstream import and documentation updates in the same commit.

### Replace Phase Handoffs With Semantic Steps

The authorization payloads should emit
`nextStep.stepId = compatibility_removal_completion_audit` and should not expose
`nextPhase.phaseId`.

Pros:

- avoids phase identifiers leaking into runtime payloads,
- keeps workflow handoff intent clear,
- matches prior Phase 6R semantic cutovers.

Cons:

- consumers that still expect `nextPhase` must be updated or covered by tests.

## Final Recommendation Stack

1. Rename modules, tests, docs, and CLI runner to policy-domain names.
2. Rename constants, builders, validators, and payload versions to semantic
   names.
3. Replace `nextPhase.phaseId` with `nextStep.stepId`.
4. Keep side-effect guards unchanged.
5. Update downstream evidence maps and validation command specs.
6. Run focused contract tests plus docs/name-inventory gates before commit.

## Implementation Outcome

Implemented:

- Renamed the core authorization module and focused test.
- Renamed the wrapper artifact module and focused test.
- Renamed the CLI exporter to
  `scripts/generate-policy-next-batch-authorization.mjs`.
- Renamed the root runner to `policy:next-batch-authorization`.
- Updated version strings, constants, builders, validators, imports, and
  documentation references.
- Replaced production `nextPhase.phaseId` handoffs with semantic `nextStep`
  payloads.

Next:

- Cut over completion checkpoint modules, docs, and runners to durable
  policy-domain names.
