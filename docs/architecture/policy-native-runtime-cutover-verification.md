# Policy Native Runtime Cutover Verification

## Intent

Prove converted policies can read from native intent in real policy read paths
before deleting compatibility code. This is a cutover verification component,
not a deletion step: native reads are enabled for converted policies, unconverted
policies stay on the compatibility bridge, rollback remains available, and
support diagnostics stay bounded.

## Official-Source Research

- PostgreSQL Repeatable Read gives successive reads in one transaction a stable
  snapshot. The execution-plan evidence collector uses a read-only
  repeatable-read transaction so the inventory, reconciliation state, and
  runtime-read result describe the same installation state.
- PostgreSQL table expressions support joins and derived tables for a bounded
  enabled-policy read model. The runtime collector loads enabled policies once,
  then uses the existing batched native-intent reader rather than performing a
  caller-selected sample check.
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

- PostgreSQL transaction isolation:
  <https://www.postgresql.org/docs/current/transaction-iso.html>
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
compatibility bridge through the runtime read path.

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
- the immediate conversion outcome is not a replacement for later
  current-state deletion-readiness evidence.

### Derive Runtime Evidence From The Installation

The execution-plan evidence collector must not accept `convertedPolicy` or
`unconvertedPolicy` samples from an operator-maintained input file. It must
load every enabled policy in its database snapshot, attach active native intent
rows, and assess all converted and unconverted paths. Empty sets are reported
as not assessed rather than manufacturing a synthetic compatibility result.

Pros:

- prevents a false native-read blocker caused by an empty maintenance input;
- covers every enabled policy across arbitrary library and policy names;
- keeps the report repeatable, bounded, and side-effect-free.

Cons:

- collection performs the bounded policy and native-intent reads on each
  report;
- a large installation takes proportionally longer than a sample check.

## Final Recommendation Stack

Use this stack for native runtime cutover verification:

1. `policyNativePolicyReadService.mjs` attaches active native
   intent rows to detailed policy read models.
2. `policyIntentMapper.mjs` continues to produce the public projection shape.
3. `policyIntentRuntimeReadPath.mjs` selects native intent for
   converted policies and compatibility fallback for unconverted policies.
4. `policyNativeRuntimeCutoverEvidence.mjs` loads every enabled runtime read
   model in the transaction snapshot and supplies complete, bounded evidence to
   `policyNativeRuntimeCutoverVerification.mjs`.
5. `policyNativeRuntimeCutoverVerification.mjs` audits every supplied path and
   keeps deletion blocked until the next readiness gate.
6. The approved conversion response performs the bounded, read-only
   post-conversion observation described in
   [Policy Native Intent Post-Conversion Runtime Observation](policy-native-intent-post-conversion-runtime-observation.md).

## Implementation Outcome

Implemented:

- Added `policyNativePolicyReadService.mjs`.
- Detailed `GET /api/policies/:id` now attaches active native intent before
  building `configuration_view`, `policy_intent_contract`, and
  `policy_intent_read_trace`.
- Added `policyNativeRuntimeCutoverVerification.mjs`.
- Added `policyNativeRuntimeCutoverEvidence.mjs`, which collects all enabled
  runtime read models inside the existing read-only repeatable-read evidence
  snapshot. Maintenance input cannot override converted or unconverted runtime
  samples.
- Added tests for native row contract building, route-level native policy
  projection, converted/unconverted cutover verification, rollback blocking, and
  deletion blocking.
- The existing administrator conversion screen now renders an automatic,
  bounded post-conversion runtime observation for the policies selected in that
  one confirmed action. It is outcome feedback, not a separate approval or
  verification workflow.

Not implemented in this component:

- no native intent list-read expansion,
- no compatibility path deletion,
- no rollback-window cleanup,
- no standalone historical monitoring or deletion-readiness UI for cutover
  verification.

## Next Step

Proceed with **Compatibility Path Deletion Readiness**. That task should prove
every replaced compatibility path has native/runtime parity, rollback coverage,
support diagnostics, and explicit deletion criteria before any code is removed.
