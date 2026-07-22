# Policy Native Runtime Authority Selection Integrity

Status: implemented runtime safety refinement for the native policy read path.

## Problem

The database now enforces at most one active `policy_intents` row per policy.
However, a restored database, an interrupted upgrade, or a pre-constraint
installation can still contain more than one active row. The previous native
read loader sorted those rows and used `LIMIT 1`, silently making a selection.
That would make runtime behavior dependent on a migration anomaly rather than
on a verified policy authority.

## Official Guidance Reviewed

- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  state that cross-row restrictions should use `UNIQUE`, `EXCLUDE`, or foreign
  key constraints rather than a `CHECK` constraint. The partial unique index
  remains the primary invariant for one active intent per policy.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  explains that row locks block writers and lockers, not ordinary readers, and
  should be held only for a transaction. This read path does not add locks to a
  detail request; authority writes already use the database invariant and
  writer-side locking.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends event data that supports operational investigation without
  excessive disclosure. Conflict output therefore contains a bounded state and
  a capped active-row count, never native row identifiers or policy payloads.

## Recommendations

1. **Keep the partial unique index as the source-of-truth invariant.** Runtime
   detection is defense in depth, not a replacement for database enforcement.
2. **Inspect at most two active rows in a runtime read.** Zero rows remain on
   the compatibility path, one row is authoritative, and two rows are enough
   to prove ambiguity without reading or exposing an unbounded set.
3. **Fail closed for ambiguous native authority.** Do not select by version,
   timestamp, or ID, and do not fall back to legacy custom signals.
4. **Recover only from a single non-authoritative row.** When exactly one
   active row fails the semantic-authority check, use the compatibility read
   path and load its retained presets. An authority-status object alone must
   not suppress the compatibility data that this recovery path requires.
5. **Preserve the existing product contract shape.** Return a native-sourced,
   invalid contract with an explicit `native_intent_authority_conflict` status,
   so clients and runtime cutover checks need no hidden alternate branch.
6. **Expose only bounded diagnostics.** The trace contains the conflict state
   and the capped count `2`; it excludes native row IDs, contracts, rules, and
   raw database errors.

## Pros And Cons

Pros:

- Prevents arbitrary runtime policy selection from anomalous persisted data.
- Avoids reintroducing legacy behavior for a converted policy.
- Gives cutover verification a deterministic blocker and preserves API shape.
- Avoids unnecessary read-request locks and child-row queries after ambiguity
  is detected.
- Allows a pre-constraint or interrupted-migration row to use the documented
  compatibility recovery path without weakening duplicate-authority handling.

Cons:

- A policy with inconsistent native rows cannot classify until repaired.
- The detail response reports a blocked native state rather than a usable
  compatibility projection, which is intentionally less convenient.
- The capped count identifies "two or more," not the exact number of corrupt
  rows; maintenance reporting remains the correct place for that detail.
- A single non-authoritative row retains compatibility behavior temporarily;
  it is a recovery state, not proof that legacy storage can remain indefinitely.

## Final Recommendation Stack

- Database invariant: the existing single-active-intent partial unique index.
- Loader defense: `policyNativePolicyReadService.mjs` reads no more than two
  active rows and refuses to select one when they are ambiguous.
- Runtime authority boundary: `policyNativeIntentAuthority.mjs` owns bounded
  state normalization and does not carry row identifiers.
- Compatibility recovery boundary:
  `requiresLegacyPolicyPresetsForRuntime()` derives preset loading from the
  same runtime-read decision used for evaluation. It permits the single
  non-authoritative fallback and rejects duplicate authority.
- Projection behavior: `policyIntentRuntimeReadPath.mjs` emits a native
  authority-conflict result that suppresses legacy custom signals.
- Verification: focused loader, authority, read-path, and cutover tests prove
  no arbitrary selection, no compatibility fallback, bounded diagnostics, and
  cutover blocking.

## Implemented Outcome

The native loader now queries `LIMIT 2`, derives one of three authority states,
and only loads rules, template links, and validation when exactly one active
intent exists. For two or more rows it attaches this bounded state:

```text
ambiguous_active_native_intents
activeIntentCount: 2
authoritative: false
```

The runtime read path maps that state to:

```text
sourceId: native_intent
statusId: native_intent_authority_conflict
dependsOnCustomSignals: false
policy_intent_contract.validation.valid: false
```

It does not attach a selected native intent, use the compatibility projection,
or disclose row IDs or raw policy data. Runtime cutover verification treats
this state as a native-read blocker. Read-path validation also rejects a
conflict that is relabeled as compatibility-sourced or marked as dependent on
legacy custom signals.

## Recovery Boundary Audit

The July 2026 audit found that the query layer previously used the presence of
any `native_intent_authority` object to suppress legacy preset loading. That
was too broad: a single non-authoritative active row correctly selected the
compatibility read path, but then received no presets to evaluate.

Options considered:

1. **Suppress legacy presets for every native authority state.** This keeps a
   simple query predicate but makes the declared single-row compatibility
   recovery path empty. Rejected.
2. **Load legacy presets whenever an active native row is not fully valid.**
   This would also let a duplicate native-authority conflict return to legacy
   evaluation. Rejected because it defeats the fail-closed authority boundary.
3. **Use the runtime read-source decision as the sole preset-loading
   predicate.** Chosen. Valid native authority and duplicate conflicts do not
   load legacy presets; exactly one non-authoritative row does.

This implementation follows OWASP's deny-by-default and server-side decision
guidance: ambiguous authority remains blocked, while the explicitly approved
compatibility branch receives only the data it is allowed to use. PostgreSQL's
partial unique active-intent index remains the primary invariant; this runtime
check is defense in depth. The bounded conflict trace continues to support
operational investigation without exposing policy payloads, consistent with
NIST log-management guidance.

## Verification

- `policyNativeIntentAuthority.test.mjs`
- `policyNativePolicyReadService.test.mjs`
- `policyIntentRuntimeReadPath.test.mjs`
- `policyNativeRuntimeCutoverVerification.test.mjs`
- `policyEngineRuntimeAuthority.test.mjs`
- `policyEngineQueries.test.mjs`

## Next Step

Authority selection and its compatibility-recovery boundary are complete. The
next Phase 8R work should use the current roadmap rather than reopening
legacy-authority behavior.
