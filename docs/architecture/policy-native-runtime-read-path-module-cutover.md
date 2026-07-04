# Policy Native Runtime Read Path Module Cutover

Status: implemented.

## Intent

Cut the native policy runtime read-path module away from implementation-phase
names so production code describes the durable policy authority boundary. The
component still chooses between active native intent and compatibility bridge
projection, but service names, exports, payload version, trace attributes, tests,
and documentation now use stable policy-domain terminology.

## Official Guidance Reviewed

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend common operation and data names so telemetry uses a consistent
  naming scheme across a codebase. The cutover replaces
  `classifarr.phase8r.read.*` attributes with `classifarr.policy.read.*`.
- [PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html)
  defines ordinary views as query-backed relations that are not physically
  materialized. The read-path cutover preserves the distinction between
  compatibility projection and durable native intent storage.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends protecting log data and avoiding unnecessary sensitive data
  exposure. The trace remains bounded to source, status, policy id, and native
  intent version.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  emphasizes secure, risk-based implementation and provenance. The read path
  keeps server-side provenance and validation while removing temporary phase
  vocabulary from production-facing contracts.

## Recommendations

1. **Rename the module and focused test to durable policy-domain names.**
   Use `policyNativeRuntimeReadPath.mjs` and
   `policyNativeRuntimeReadPath.test.mjs` so future maintainers see the runtime
   responsibility directly.

2. **Rename exported constants and helpers without changing values.**
   Keep source/status/reason/risk vocabularies stable, but expose them as
   `POLICY_RUNTIME_READ_*` and `buildPolicyNativeRuntimeReadPath`.

3. **Move trace attributes to stable policy names.**
   Replace implementation-phase trace keys with `classifarr.policy.read.*` so
   downstream diagnostics survive beyond the migration project.

4. **Replace production `nextPhase` with semantic `nextStep`.**
   Runtime payloads should point to the next operational concern, not a
   temporary roadmap index.

5. **Preserve read-path behavior exactly.**
   Converted policies still prefer active native intent, invalid native intent
   remains native-invalid, and unconverted policies still use compatibility
   bridge fallback.

## Pros And Cons

Pros:

- Production names now describe the lasting domain responsibility.
- Trace attributes no longer encode temporary migration phase names.
- Read-source diagnostics remain bounded and safe.
- Existing converted and unconverted policy behavior is preserved.
- Downstream cutover verification can import stable runtime read symbols.

Cons:

- Historical docs and changelog still contain phase terminology for audit
  history.
- Downstream compatibility-removal components still need their own naming
  cutovers.
- External consumers that inspect raw trace attribute names must adapt to the
  stable `classifarr.policy.read.*` keys.

## Final Recommendation Stack

- Runtime read-path service:
  `server/src/services/policyNativeRuntimeReadPath.mjs`
- Runtime read-path tests:
  `server/src/__tests__/services/policyNativeRuntimeReadPath.test.mjs`
- Mapper integration:
  `server/src/services/policyIntentMapper.mjs`
- Cutover verifier integration:
  `server/src/services/policyNativeRuntimeCutoverVerification.mjs`
- Architecture records:
  `docs/architecture/policy-native-runtime-read-path.md` and this document

## Implementation Outcome

- Renamed the service, focused test, and architecture record.
- Updated mapper, cutover verifier, native storage reset, completion evidence,
  roadmap, and changelog references.
- Replaced phase-coded version/export names with durable runtime read names.
- Replaced `classifarr.phase8r.read.*` trace attributes with
  `classifarr.policy.read.*`.
- Replaced production `nextPhase.phaseId` handoff with
  `nextStep.stepId = rollback_snapshot_and_reversion_window`.
- Preserved compatibility fallback, active native intent selection, invalid
  native intent surfacing, contract-shape validation, and no-side-effect
  validation.

## Next High-Value Item

Continue with **Rollback Snapshot And Reversion Window module naming cutover**.
That component is the next production runtime-adjacent service still carrying
temporary phase vocabulary and should be renamed without changing rollback
snapshot semantics.
