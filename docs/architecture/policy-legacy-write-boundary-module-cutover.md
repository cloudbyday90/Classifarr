# Policy Legacy Write Boundary Module Cutover

Status: implemented.

## Intent

Rename the legacy write shutdown component from phase-coded names to durable
policy-domain names while preserving the side-effect-free write-boundary
behavior that prevents converted policies from drifting back to legacy
preset/custom-signal storage.

## Official Guidance Reviewed

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  defines verifiable application security controls and supports enforcing
  sensitive decisions on trusted service layers.
- [OWASP API Security API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  identifies APIs that allow clients to change sensitive object properties as a
  risk. The boundary treats legacy behavior fields on converted policies as
  blocked properties.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends security-relevant application logging. The boundary keeps a
  deterministic audit helper with bounded operation, status, issue, warning,
  and next-step fields.
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
  recommends approval boundaries, action previews, rollback, and audit trails
  for high-impact actions. The boundary remains a previewable decision contract
  and performs no writes.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating security practices and retaining evidence of secure
  design decisions throughout the SDLC.
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  documents database constraints as data integrity enforcement. This cutover
  keeps the application boundary deterministic while later storage work can
  enforce the same authority at the schema layer.

## Recommendations

1. **Use durable module names.**
   Rename the service, test, and architecture record to
   `policyLegacyWriteBoundary.mjs`, `policyLegacyWriteBoundary.test.mjs`, and
   `policy-legacy-write-boundary.md`.

2. **Use durable exported contracts.**
   Rename phase-coded constants and helpers to
   `POLICY_LEGACY_WRITE_*`, `buildPolicyLegacyWriteBoundary`,
   `validatePolicyLegacyWriteBoundary`, and
   `buildPolicyLegacyWriteBoundaryAudit`.

3. **Replace phase handoffs with next-step handoffs.**
   Runtime output should expose `nextStep.stepId =
   legacy_code_deletion_gates` instead of `nextPhase.phaseId`.

4. **Preserve fail-closed converted-policy behavior.**
   Converted policies must continue blocking legacy behavior writes while
   allowing metadata-only maintenance and explicit native writes only when
   native write persistence is marked ready.

5. **Keep route and storage mutation out of this boundary.**
   The module should classify and audit writes, not perform route writes,
   native inserts, legacy writes, legacy deletes, or draft sidecar persistence.

## Pros And Cons

Pros:

- Removes phase-coded production names without weakening the converted-policy
  write guard.
- Keeps write-authority decisions server-side and deterministic.
- Makes downstream deletion gates consume a semantic next-step contract.
- Keeps audit output bounded and useful for later route integration.
- Preserves compatibility warnings for unconverted policies.

Cons:

- Live policy routes still need a later integration pass before this boundary
  actively enforces production writes.
- Native write persistence remains a separate storage component.
- Existing Phase 8R evidence tooling still uses historical phase inventory
  labels until its own cutover component is reached.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyLegacyWriteBoundary.mjs`
- Durable focused test:
  `server/src/__tests__/services/policyLegacyWriteBoundary.test.mjs`
- Durable design record:
  `docs/architecture/policy-legacy-write-boundary.md`
- Evidence-map references:
  `server/src/services/policyBuilderPhase8CompletionEvidenceRun.mjs`
- Storage reset inventory:
  `server/src/services/policyNativeStorageTestReset.mjs`

## Implementation Outcome

- Renamed the service, test, and architecture record to durable
  policy-domain names.
- Renamed exported constants, builder, validator, audit helper, and payload
  version to durable policy-domain names.
- Replaced `nextPhase.phaseId = 8r_7` with
  `nextStep.stepId = legacy_code_deletion_gates`.
- Updated evidence-map and storage-reset references to the durable paths.
- Preserved converted-policy blocking, unconverted compatibility warnings,
  native write readiness gating, native default gating, removal checklist
  validation, and no-side-effect guarantees.

## Next High-Value Item

Proceed to **Legacy Code Deletion Gates module naming cutover**. That component
is the next downstream consumer of the legacy write boundary and still carries
phase-coded production service/test names.
