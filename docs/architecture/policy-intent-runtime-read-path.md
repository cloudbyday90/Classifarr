# Policy Intent Runtime Read Path

Status: implemented as the durable policy intent runtime read-path contract.

## Problem

Converted policies need a runtime read boundary that makes native intent the
authority without breaking unconverted policies. The read path must expose one
product contract to clients while clearly tracing whether the data came from
native intent storage or the legacy compatibility bridge.

## Official Guidance Reviewed

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend common names for operations and data so traces, logs, and metrics
  can use a standardized naming scheme across a codebase. This contract applies
  this by emitting bounded `classifarr.policy.read.*` attributes for read
  source, status, policy id, and native intent version.
- [PostgreSQL materialized views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
  distinguish persisted table-like derived data from ordinary views. The read path
  keeps native runtime records conceptually separate from compatibility
  projection and does not pretend a projection is durable native storage.
- [PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html)
  describes views as query-backed relations that run when referenced rather
  than being physically materialized. This supports the design split between
  compatibility projection and native persisted intent.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  emphasizes secure development practices, provenance, security requirement
  tracking, and risk-based implementation. The read path records source provenance
  and rejects native reads that depend on legacy custom-signal behavior.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for verifying web application security controls. The read path
  keeps read-source selection and validation server-side instead of allowing
  client state to decide which policy authority applies.

## Recommendations

1. **Prefer active native intent when attached.**
   Converted policies should use attached active native intent contracts as the
   read authority. If an active native contract is invalid, the read path should
   report native-invalid status instead of silently falling back to legacy
   custom signals.

2. **Keep unconverted policies on the compatibility bridge.**
   Unconverted policies continue to use the existing `configuration_view` and
   `policy_intent_contract` compatibility projection until explicit conversion
   and rollback gates complete.

3. **Expose one product contract shape.**
   Both native and compatibility reads return `configuration_view`,
   `policy_intent_contract`, and `policy_intent_read_trace` so clients do not
   need separate rendering branches.

4. **Trace the read source with bounded metadata.**
   The read path records `native_intent` or `compatibility_bridge` plus status,
   policy id, and native intent version. It does not expose raw legacy JSON,
   provider payloads, prompts, embeddings, or replay diagnostics.

5. **Keep this slice side-effect-free.**
   This is a read-path contract. It does not create migrations, insert
   native rows, write migration events, delete legacy rows, or disable writes.

6. **Reject ambiguous native authority.**
   The native loader reads at most two active rows. Two rows prove an authority
   conflict and produce a native-sourced blocked result; the runtime path does
   not select one by sort order or fall back to legacy custom signals.

## Pros And Cons

Pros:

- Converted policies can be read from native intent without client branching.
- Invalid native contracts do not accidentally fall back to legacy behavior.
- Existing unconverted policies keep working through the compatibility bridge.
- Source trace metadata makes runtime behavior explainable during migration.
- The mapper stays small by delegating source selection to a focused service.

Cons:

- Native table SQL is still not introduced in this slice.
- The route can only use native intent when native data is attached to the
  policy read model by later storage work.
- Compatibility reads still depend on legacy preset/custom-signal projection
  until write shutdown and deletion gates finish.
- An anomalous native state blocks runtime policy use until it is repaired.

## Final Recommendation Stack

- Server read-path service:
  `server/src/services/policyIntentRuntimeReadPath.mjs`
- Existing mapper integration:
  `server/src/services/policyIntentMapper.mjs`
- Test coverage:
  `server/src/__tests__/services/policyIntentRuntimeReadPath.test.mjs`
  plus mapper/schema contract tests
- Documentation:
  `docs/architecture/policy-intent-runtime-read-path.md`

## Implemented Contract

The read-path service exports:

- native runtime read source IDs,
- native runtime read status IDs,
- bounded reason IDs,
- audit risk IDs,
- a native-aware read-path builder,
- a read-path validator,
- a read-path audit helper.

Runtime read results include:

```text
sourceId
statusId
configuration_view
policy_intent_contract
trace
dependsOnCustomSignals
sideEffects
reasons
validation
nextStep
```

Source behavior:

- `native_intent`: selected when an active native intent contract is attached.
- `compatibility_bridge`: selected when no active native intent is attached.

Status behavior:

- `native_intent_active`: active native intent validates successfully.
- `native_intent_invalid`: active native intent exists but fails server
  contract validation.
- `native_intent_authority_conflict`: two or more active native intents were
  detected, so no row is selected and legacy behavior remains suppressed.
- `compatibility_bridge_fallback`: unconverted policy uses compatibility
  projection.

## Security Outcome

- Native reads do not depend on `customSignals`.
- Invalid active native contracts are surfaced as native-invalid instead of
  falling back to legacy behavior.
- Read-source trace metadata is bounded and contains no raw payloads.
- The read path performs no policy storage mutation, native inserts, migration
  event writes, rollback snapshot writes, or legacy deletion.
- Server-side validation enforces stable contract shape for native and
  compatibility reads.
- Ambiguous native authority is traceable only through a bounded conflict state
  and a capped count; native IDs, rule data, and raw database errors are not
  exposed. The detailed design is [Policy Native Runtime Authority Selection
  Integrity](policy-native-runtime-authority-selection-integrity.md).

## Next Step

Proceed to **Rollback Snapshot And Reversion Window**. Now that the read path
can identify native versus compatibility authority, rollback needs a bounded
restore contract before converted policies can safely move through apply-mode
migration.
