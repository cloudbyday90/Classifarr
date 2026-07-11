# Policy Migration Native Intent Criterion Cutover

## Status

Implemented on July 11, 2026. The migration verifier now accepts only the
durable `nativeIntentStorageStable` deletion-readiness input.

The retired `phase8NativeIntentStable` alias was an internal fallback. A
repository audit found no route, client, database migration, persisted record,
or downstream service that produced or consumed it. No compatibility adapter
or database migration is required.

## Problem

A roadmap-shaped input made a permanent safety criterion depend on a delivery
sequence. Keeping the alias without a real caller would let obsolete input
silently satisfy a legacy-deletion gate and preserve avoidable contract debt.

## Official Guidance Reviewed

- [NIST SP 800-228](https://csrc.nist.gov/pubs/sp/800/228/upd1/final)
  recommends lifecycle-specific, risk-based API controls. The verifier keeps a
  narrowly scoped, server-owned criterion and rejects unneeded compatibility
  input rather than expanding its accepted contract.
- [Semantic Versioning 2.0.0](https://semver.org/) distinguishes a declared
  public API from internal implementation. The retired key was neither a public
  API nor persisted data, so an alias-free internal cutover is appropriate.
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
  documents schema changes and their locking implications. No schema change is
  warranted because the criterion is not a database column or stored payload.

## Recommendation

Use one durable deletion-readiness input:

```text
deletionCriteria.nativeIntentStorageStable === true
```

Reject the retired alias by omission. The verifier remains deterministic and
cannot report deletion readiness until every explicit criterion is met.

## Pros And Cons

Pros:

- Removes a roadmap term from a permanent safety contract.
- Prevents a silent fallback from satisfying the legacy-deletion gate.
- Avoids a compatibility adapter, schema migration, and future deletion task.
- Keeps the verifier's accepted input contract small and auditable.

Cons:

- An out-of-repository integration that incorrectly sends only the retired key
  will remain blocked until it sends the durable key.

## Final Implementation Stack

1. Accept only `nativeIntentStorageStable` in the server-owned verifier.
2. Preserve the output criterion ID `native_intent_storage_stable`.
3. Add focused coverage proving the retired key cannot unlock deletion.
4. Keep replacement, deletion, rollback creation, learning, and routing writes
   disabled in this verifier.
5. Do not add a migration or alias unless a future persisted or public contract
   is explicitly introduced and versioned.

## Validation

- Focused verifier tests validate both the durable criterion and rejection of
  the retired alias.
- Production naming inventory and regression audit ratchet only after the
  obsolete production reference is absent.
- Server lint and documentation lint verify ESM and documentation quality.

## Outcome

The migration verifier now has one durable native-intent storage criterion. No
behavioral or database compatibility layer remains for the retired phase-named
field.
