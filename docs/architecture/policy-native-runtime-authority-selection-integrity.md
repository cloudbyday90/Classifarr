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
4. **Preserve the existing product contract shape.** Return a native-sourced,
   invalid contract with an explicit `native_intent_authority_conflict` status,
   so clients and runtime cutover checks need no hidden alternate branch.
5. **Expose only bounded diagnostics.** The trace contains the conflict state
   and the capped count `2`; it excludes native row IDs, contracts, rules, and
   raw database errors.

## Pros And Cons

Pros:

- Prevents arbitrary runtime policy selection from anomalous persisted data.
- Avoids reintroducing legacy behavior for a converted policy.
- Gives cutover verification a deterministic blocker and preserves API shape.
- Avoids unnecessary read-request locks and child-row queries after ambiguity
  is detected.

Cons:

- A policy with inconsistent native rows cannot classify until repaired.
- The detail response reports a blocked native state rather than a usable
  compatibility projection, which is intentionally less convenient.
- The capped count identifies "two or more," not the exact number of corrupt
  rows; maintenance reporting remains the correct place for that detail.

## Final Recommendation Stack

- Database invariant: the existing single-active-intent partial unique index.
- Loader defense: `policyNativePolicyReadService.mjs` reads no more than two
  active rows and refuses to select one when they are ambiguous.
- Runtime authority boundary: `policyNativeIntentAuthority.mjs` owns bounded
  state normalization and does not carry row identifiers.
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

## Verification

- `policyNativeIntentAuthority.test.mjs`
- `policyNativePolicyReadService.test.mjs`
- `policyIntentRuntimeReadPath.test.mjs`
- `policyNativeRuntimeCutoverVerification.test.mjs`

## Next Step

Proceed to **8R.5 Rollback Snapshot And Reversion Window**. Native authority
selection now fails safely in anomalous states; conversion still needs a
bounded snapshot and expiry contract before reversible cutover work can rely
on it.
