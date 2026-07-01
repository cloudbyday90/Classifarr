# Policy Builder Phase 8R Native Runtime Cutover Verification

## Intent

Prove converted policies can read from native intent in real policy read paths
before deleting compatibility code. Phase 8R.13 is a cutover verification step,
not a deletion step: native reads are enabled for converted policies, unconverted
policies stay on the compatibility bridge, rollback remains available, and
support diagnostics stay bounded.

## Official-Source Research

- PostgreSQL table expressions support `LATERAL` items that can reference rows
  from the left side of a join. That pattern is appropriate for bounded,
  per-policy native-intent lookup because it can attach the active native row
  without dropping policies that are not converted.
- PostgreSQL aggregate and JSON functions support structured row aggregation for
  API-ready read models. Native read services should build explicit contract
  objects from native rows instead of exposing raw table payloads.
- OWASP logging guidance recommends event attributes that identify what
  happened without logging excessive payloads. Native read traces therefore use
  source/status/policy/version attributes, not full policy data.
- NIST SSDF emphasizes verifying and preserving evidence for software changes.
  Runtime cutover verification provides that evidence before compatibility path
  deletion is considered.

Sources:

- PostgreSQL table expressions and `LATERAL`:
  <https://www.postgresql.org/docs/current/queries-table-expressions.html>
- PostgreSQL aggregate functions:
  <https://www.postgresql.org/docs/current/functions-aggregate.html>
- PostgreSQL JSON functions:
  <https://www.postgresql.org/docs/current/functions-json.html>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>

## Recommendations

### Attach Native Intent Before Projection

Detailed policy reads should attach active native intent storage before calling
the existing projection mapper. The mapper can then choose native intent or
compatibility bridge through the Phase 8R runtime read path.

Pros:

- keeps route code thin,
- reuses existing runtime read validation,
- avoids a second API response shape for converted policies.

Cons:

- detailed policy reads add bounded native lookup queries,
- list reads remain compatibility-light until a later paged/native list strategy
  is needed.

### Keep Converted And Unconverted Paths Explicit

Converted policies should read from native intent. Unconverted policies should
continue using the compatibility bridge until conversion and rollback gates are
complete.

Pros:

- avoids forced conversion,
- preserves rollback and support diagnostics,
- gives clear source tracing for mixed installs.

Cons:

- the system remains dual-path during the rollback window,
- deletion readiness still requires a separate gate.

### Verify Cutover Before Deletion

Native runtime cutover verification should require:

- converted policy reads from native intent,
- unconverted policy reads from compatibility bridge,
- rollback availability,
- legacy deletion remains blocked,
- support diagnostics are safe and bounded.

Pros:

- prevents premature compatibility deletion,
- gives maintainers a concrete readiness report,
- keeps rollback available while native reads are proven.

Cons:

- deletion is intentionally delayed,
- support surfaces still need a later user-facing diagnostic shape.

## Final Recommendation Stack

Use this stack for Phase 8R.13:

1. `policyBuilderPhase8NativePolicyReadService.mjs` attaches active native
   intent rows to detailed policy read models.
2. `policyIntentMapper.mjs` continues to produce the public projection shape.
3. `policyBuilderPhase8NativeRuntimeReadPath.mjs` selects native intent for
   converted policies and compatibility fallback for unconverted policies.
4. `policyBuilderPhase8NativeRuntimeCutoverVerification.mjs` audits cutover
   readiness and keeps deletion blocked until the next phase.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8NativePolicyReadService.mjs`.
- Detailed `GET /api/policies/:id` now attaches active native intent before
  building `configuration_view`, `policy_intent_contract`, and
  `policy_intent_read_trace`.
- Added `policyBuilderPhase8NativeRuntimeCutoverVerification.mjs`.
- Added tests for native row contract building, route-level native policy
  projection, converted/unconverted cutover verification, rollback blocking, and
  deletion blocking.

Not implemented in this component:

- no native intent list-read expansion,
- no compatibility path deletion,
- no rollback-window cleanup,
- no operator UI for cutover verification.

## Next Step

Proceed with **Phase 8R.14 Compatibility Path Deletion Readiness**. That task
should prove every replaced compatibility path has native/runtime parity,
rollback coverage, support diagnostics, and explicit deletion criteria before
any code is removed.
