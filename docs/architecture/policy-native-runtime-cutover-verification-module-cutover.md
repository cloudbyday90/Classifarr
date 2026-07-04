# Policy Native Runtime Cutover Verification Module Cutover

## Intent

Cut the native runtime cutover verifier and native policy read service over from
phase-coded production names to durable policy-domain names without changing
read-path behavior. Converted policies still read from native intent,
unconverted policies still use the compatibility bridge, rollback availability
is still required, and compatibility deletion remains blocked until later
readiness gates pass.

## Official-Source Research

- PostgreSQL join and table-expression guidance supports explicit multi-table
  reads for assembling policy read models.
- PostgreSQL JSON/JSONB support is appropriate for structured native intent
  contract and validation payloads.
- OWASP logging guidance recommends bounded event attributes instead of raw
  payload exposure.
- NIST SSDF recommends verification evidence for software changes before
  release or removal of compatibility paths.

Sources:

- PostgreSQL joins:
  <https://www.postgresql.org/docs/current/tutorial-join.html>
- PostgreSQL table expressions:
  <https://www.postgresql.org/docs/current/queries-table-expressions.html>
- PostgreSQL JSON types:
  <https://www.postgresql.org/docs/current/datatype-json.html>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Recommendations

### Keep Runtime Read Attachment Product-Named

The route-facing native policy read attachment service should be named
`policyNativePolicyReadService.mjs`.

Pros:

- removes roadmap numbering from a production route dependency,
- makes the service purpose clear to future maintainers,
- keeps detailed policy reads independent from implementation-phase language.

Cons:

- downstream route and focused tests must be updated together.

### Keep Cutover Verification Product-Named

The verifier payload version, exports, tests, and design record should use
`policy.native_runtime_cutover_verification.v1` and
`policyNativeRuntimeCutoverVerification*` names.

Pros:

- makes verification reusable beyond the current roadmap,
- keeps deletion-readiness consumers aligned to a durable contract,
- removes phase-coded runtime handoffs from the verifier payload.

Cons:

- the lower-level runtime read-path module still needs its own component-level
  cutover.

### Preserve Mixed-Mode Read Semantics

Converted policies must read native intent, while unconverted policies remain on
compatibility fallback until conversion and rollback gates are complete.

Pros:

- avoids forced conversion,
- keeps rollback/support behavior available,
- gives deletion-readiness gates explicit source evidence.

Cons:

- the system remains dual-path until later compatibility deletion work is done.

## Final Recommendation Stack

1. Rename the route-facing read service and test to
   `policyNativePolicyReadService.mjs` and
   `policyNativePolicyReadService.test.mjs`.
2. Rename the cutover verifier and test to
   `policyNativeRuntimeCutoverVerification.mjs` and
   `policyNativeRuntimeCutoverVerification.test.mjs`.
3. Move the verifier payload version to
   `policy.native_runtime_cutover_verification.v1`.
4. Export durable verifier constants and helpers:
   - `POLICY_NATIVE_RUNTIME_CUTOVER_STATUS_IDS`
   - `POLICY_NATIVE_RUNTIME_CUTOVER_RISK_IDS`
   - `buildPolicyNativeRuntimeCutoverVerification`
   - `validatePolicyNativeRuntimeCutoverVerification`
5. Replace the verifier handoff with
   `nextStep.stepId = compatibility_path_deletion_readiness`.
6. Update route, deletion-readiness, evidence-map, roadmap, and focused-test
   references to the durable service paths.

## Implementation Outcome

Implemented:

- Renamed the native policy read service, runtime cutover verifier, focused
  tests, and architecture record.
- Updated detailed policy read routes to import `policyNativePolicyReadService`.
- Updated compatibility deletion-readiness consumers to import
  `policyNativeRuntimeCutoverVerification`.
- Replaced verifier constants, payload version, and builder/validator exports
  with durable policy-domain names.
- Replaced the verifier handoff with
  `nextStep.stepId = compatibility_path_deletion_readiness`.
- Preserved converted/native and unconverted/compatibility read-source
  verification, rollback/deletion/support-diagnostic blockers, and no-side-effect
  validation.

Not implemented in this component:

- no runtime read-path module rename,
- no compatibility deletion readiness rename,
- no native list-read expansion,
- no compatibility path deletion.

## Next Step

Cut over the **Native Runtime Read Path** module naming while preserving
converted/native source selection, compatibility fallback, projection shape, and
semantic read traces.
