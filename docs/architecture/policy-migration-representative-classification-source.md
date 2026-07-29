# Policy Migration Representative Classification Source

## Status

Implemented for Phase 6R.6 Task 6R.6.2.

This record defines the server-only source for bounded migration-preview
classifications. It selects recent finalized outcomes already persisted for the
active destination library of a policy, then pairs each sanitized legacy
outcome with the generated outcome from the validated native-intent rebuild
proposal.

It does not claim that a historical classification was produced by the same
policy. The current `classification_history` schema has a destination library,
media type, status, and confidence, but no durable `policy_id`. Treating an
unrelated JSON field or current routing configuration as policy provenance
would manufacture authority that the system does not have.

## Problem

The migration preview needs real, bounded historical outcomes before it can
compare legacy behavior with generated native intent. Supplying browser samples
or replay data makes the preview operator-dependent; scanning provider data or
calling a media server makes the check nondeterministic and unnecessarily
expensive.

The source must therefore answer a narrower, honest question:

```text
For this active policy's destination library and media type,
what recently finalized, persisted destination outcomes can safely act as
representative coverage for a migration comparison?
```

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default behavior, and authorization at
  each request/resource boundary. The adapter verifies the persisted policy and
  its active destination library before it reads classifications; caller values
  are never accepted as authority.
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
  recommends restricting database privileges and data exposure. The adapter has
  two read-only queries, selects only needed fields, and omits titles,
  metadata, prompts, embeddings, and provider payloads from its result.
- [OWASP Query Parameterization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html)
  recommends bound query parameters. Policy ID, library ID, media type,
  finalized-status allowlist, and read limit are supplied as query parameters;
  SQL structure and sort order are fixed.
- [Microsoft Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends explicit quality gates and rollback rather than broad deployment.
  The adapter returns insufficient coverage instead of asserting parity; the
  existing preview, acceptance, rollback, and deletion gates remain separate.

## Options Considered

### 1. Use browser-selected replay or diagnostic samples

Pros:

- Existing panels can expose rich examples.
- An operator can inspect a chosen item.

Cons:

- Makes migration proof depend on UI state and operator intervention.
- Reintroduces diagnostic UX the destination-first design is removing.
- Risks exposing titles, provider data, prompts, or replay payloads.

### 2. Infer policy ownership from history metadata or current routing

Pros:

- Could appear more policy-specific without a schema change.

Cons:

- The metadata is not a stable authorization or provenance contract.
- Current routing cannot establish how a historical decision was made.
- A heuristic could falsely report safe parity for unrelated outcomes.

### 3. Add a policy foreign key to every historical classification now

Pros:

- Would support exact future policy-level replay selection.
- Makes future provenance richer.

Cons:

- Requires a storage migration before the Phase 6R engine contracts are
  stable, contrary to the roadmap's Phase 8R storage sequencing.
- Does not recover ownership for pre-existing rows without another unsafe
  inference or backfill process.

### 4. Read recent finalized outcomes scoped to the active persisted policy library

Pros:

- Uses only existing durable fields and makes no false policy-ownership claim.
- Is deterministic, bounded, parameterized, server-owned, and testable.
- Keeps missing or invalid coverage as an explicit no-preview state.
- Requires no provider call, media-server action, routing action, browser
  control, or state write.

Cons:

- Provides destination-library evidence, not exact historical policy replay.
- Cannot generate coverage where a library has no final historical outcomes.

## Final Recommendation Stack

1. Resolve the policy and active library from persisted `library_policies` and
   `libraries` rows before any classification read.
2. Require the validated rebuild proposal to match the persisted library ID,
   name, and media type exactly.
3. Select only the allowed finalized classifications for that library and media
   type, sorted by `created_at DESC, id DESC` with a fixed `N + 1` query cap.
4. Project only classification ID, media type, destination identity, final
   status, normalized confidence, and the generated proposal outcome.
5. Return `insufficient_representative_coverage` when no usable row remains;
   do not substitute browser, provider, or inferred samples.
6. Carry compact source provenance and audit it against the persisted policy
   context, bounded counts, raw-data suppression, and all-false side effects.
7. Keep exact policy-attribution selection deferred until a native storage
   contract can record it prospectively in Phase 8R.

## Implementation Outcome

`server/src/services/policyMigrationRepresentativeClassificationSource.mjs`
now provides a factory with one operation:

```js
collectRepresentativeClassifications({
  policyContext: { policyId, libraryId },
  proposal,
  maxClassifications,
});
```

It performs at most two parameterized `SELECT` queries:

1. Resolve and validate the active persisted policy/library context.
2. Read at most `maxClassifications + 1` eligible, finalized outcomes scoped to
   that library and media type.

The default cap is 25, the hard cap is 100, and the deterministic order is
`created_at DESC, id DESC`. A generated native-intent outcome is built from the
validated proposal through the shared
`policyMigrationGeneratedIntentOutcome.mjs` projector. That same projector is
used by the migration verifier, so the source and verifier cannot drift in
their default generated outcome fields.

The source result is deliberately minimal. It has no title, year, metadata,
raw payload, provider payload, prompt, embedding, provider quota data, or
routing action. A separate audit verifies source provenance, count bounds,
context scope, raw-data absence, result status, and no side effects other than
the declared database read.

`policyMigrationPreviewContract.mjs` now compares confidence labels only when
both legacy and generated outcomes provide labels. Persisted classification
history stores numeric confidence but not an equivalent label, so treating an
absent historical label as a difference would create false migration drift.

## Security Outcome

- Caller-supplied context is insufficient without matching persisted policy and
  active-library records.
- SQL values are parameterized; query shape, allowed statuses, and sort order
  are fixed in code.
- The only permitted side effect is a database read. No provider, media server,
  quota, policy storage, classification storage, or routing operation is
  available from the adapter.
- Database errors are reduced to a stable failure result and do not expose error
  details.
- No historical field is interpreted as policy ownership unless the schema
  records that relationship durably.

## Verification

Focused server tests cover:

- persisted-context authority and proposal matching;
- parameterized two-query selection and `N + 1` truncation;
- finalized-status filtering and destination/media-type scope;
- missing history as explicit insufficient coverage;
- invalid context, inactive library, mismatch, and database-failure handling;
- raw-data suppression and audit detection of tampered provenance, summaries,
  or side effects;
- preview behavior when legacy history has numeric confidence without a label.

## Next Task

Phase 6R.6 Task 6R.6.4 should add a persisted, replay-protected verification
run handoff. It must record only bounded source/verifier provenance after the
coordinator succeeds, never raw samples, and must remain unable to create a
snapshot, replace policy state, route media, or expose browser controls.
