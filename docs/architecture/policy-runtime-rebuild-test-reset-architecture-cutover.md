# Policy Runtime And Rebuild Test Reset Architecture Cutover

## Status

Implemented on July 4, 2026 as the durable architecture-name cutover for the
runtime and rebuild test reset contract.

This cutover does not rewrite or delete tests. It renames the active
architecture record, updates roadmap references, and preserves the existing
side-effect-free reset manifest implemented by
`policyRuntimeRebuildTestReset.mjs`.

## Goal

Remove temporary roadmap naming from the active runtime/rebuild test reset
design record while keeping the reset focused on server-owned verification:

```text
runtime metrics and decision trace
  -> runtime and rebuild test reset
  -> runtime contract completion audit
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure software practices into the SDLC and treating
  them as risk-based, continuously improved practices. Classifarr keeps this
  reset as durable verification evidence rather than a temporary roadmap
  artifact.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure development practices that reduce vulnerabilities and
  address root causes. The reset validates authority boundaries, artifact
  availability, and required coverage before storage migration work depends on
  the runtime contracts.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides verification-oriented security requirements for applications. The
  reset treats tests as authority-boundary evidence instead of UI preview
  snapshots.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, descriptive, lower-case names. The durable reset payload
  remains `policy.runtime_rebuild_test_reset.v1`.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes lifecycle risk management for generative AI systems. The reset
  keeps automation, learning, rebuild, verifier, rollback, and metrics coverage
  explicit before native intent storage can proceed.

## Recommendations

1. Keep the active architecture document named by the product contract:
   `policy-runtime-rebuild-test-reset.md`.
2. Keep reset output side-effect-free: classify test intent, required coverage,
   artifact proof, and deletion gates without rewriting or deleting tests.
3. Keep authority-boundary language explicit so old preview UI cannot become
   the durable migration contract.
4. Keep artifact paths repository-relative, inside the repository, and present
   on disk.
5. Keep classification success separate from routing success in required
   coverage.
6. Keep rollback snapshot coverage mandatory before replacement paths are
   treated as safe.

## Pros And Cons

Pros:

- Removes temporary phase-coded naming from the active architecture record.
- Keeps the durable `policy.runtime_rebuild_test_reset.v1` payload version
  visible.
- Preserves authority-boundary, missing-routing, artifact-availability, and
  rollback-safety validation.
- Gives completion-audit and native storage readiness a durable test-reset
  handoff.

Cons:

- Does not remove legacy preview/replay tests; deletion remains gated by parity
  and replacement coverage.
- Requires the reset manifest to stay current when test files move.
- Leaves runtime completion audit as the next active architecture cutover.

## Final Recommendation Stack

- Active architecture:
  `docs/architecture/policy-runtime-rebuild-test-reset.md`
- Architecture cutover record:
  `docs/architecture/policy-runtime-rebuild-test-reset-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-runtime-rebuild-test-reset-module-cutover.md`
- Runtime contract:
  `server/src/services/policyRuntimeRebuildTestReset.mjs`
- Focused validation:
  `server/src/__tests__/services/policyRuntimeRebuildTestReset.test.mjs`
- Production naming guard:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active design record from
  `policy-builder-phase-7r-runtime-rebuild-test-reset.md` to
  `policy-runtime-rebuild-test-reset.md`.
- Updated the roadmap implementation status to point at the durable active
  architecture document.
- Updated the module-cutover note to point at this architecture cutover record.
- Updated the preceding metrics-trace records now that runtime/rebuild test
  reset no longer has a phase-coded active architecture filename.
- Preserved the existing runtime/rebuild test reset service, tests, payload
  version, manifest shape, artifact validation, and authority-boundary checks.

## Security Outcome

- No tests were rewritten or deleted.
- No workflows were modified.
- No providers, routing, learning, rebuild, rollback, or policy writes were
  added.
- Artifact paths remain repository-relative, inside the repository, and present
  on disk.
- Old impact/replay preview UI remains migration-only until replacement
  coverage and parity gates prove deletion is safe.

## Next Step

Runtime Completion Audit should receive the next architecture cutover so its
active design record uses the durable completion-audit contract name and points
at the already-renamed `policyRuntimeCompletionAudit.mjs` service.
