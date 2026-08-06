# Policy Preview/Replay Verifier Cutline

## Status

Implemented as Phase 5R.8 Task 5R.8.1 on August 4, 2026.

## Decision

Preview and replay are not policy-authoring features. The browser preview
cards, client composables, client utilities, migration-verifier HTTP route, and
the original impact/replay service family are already retired and must remain
absent. They cannot return as a convenience troubleshooting path.

The only retained work is an internal migration verifier used to compare an
accepted library rebuild against a deterministic, bounded representative source
before rollback evidence and cutover proceed. It does not create, modify, or
route policy state. A persisted verification receipt records only the audited
result required to bind later rollback evidence.

## Source Inventory

The new server-only cutline inventory classifies the current artifacts:

| Disposition | Current role | Boundary |
| --- | --- | --- |
| Server contract verifier | `policyMigrationPreviewContract.mjs` | Pure, bounded comparison contract; no reads or writes. |
| Migration parity verifier | Representative source, verifier, coordinator, receipt contract/handoff/repository, and rebuild binding | Internal rebuild/cutover guard; only bounded reads and verification-receipt persistence are allowed. |
| Evidence reducer candidate | `policyMigrationGeneratedIntentOutcome.mjs` | Pure projection of an accepted rebuild proposal. Resolved 5R.8.3: retained as migration-only, not promoted into the runtime-evidence contract. Deleted with the verifier chain after Phase 8R parity. |
| Delete with old UI surface | Former endpoint, server impact/replay services, browser cards, composables, and utilities | Must remain absent. Historical retirement records remain as evidence, not executable paths. |

Every active artifact must have a bounded purpose, prohibit normal authoring,
browser reachability, dedicated HTTP exposure, raw payload output, and
unbounded result output. The inventory also requires an exit criterion for each
active artifact and a retirement record for each deleted artifact.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default, server-side authorization, and
  authorization regression tests. Migration verification has no client
  capability and no new endpoint to authorize.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires access control at non-public endpoints and warns against relying on
  client-provided state. The verifier derives its source and accepted transition
  on the server, rather than accepting browser preview data.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends purposeful, appropriately scoped application audit trails. The
  retained receipt stores audit status and fingerprints, not raw samples,
  provider payloads, prompts, embeddings, or question text.
- [OWASP API9:2023](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  calls for endpoint inventory and retirement plans. The inventory checks that
  retired diagnostic paths remain absent and that remaining code has a named
  deletion or promotion gate.

## Options Considered

### Keep preview/replay as normal policy UI or API

Pros:

- Easy manual access to comparison details.

Cons:

- Restores a product workflow that contradicts intent-first, hands-off
  authoring.
- Creates another capability and data-exposure boundary to secure.
- Invites operators to interpret migration diagnostics as policy authority.

### Delete every comparison immediately

Pros:

- Smallest attack surface and least maintenance.
- Removes all preview/replay terminology from live code.

Cons:

- Removes the parity gate that currently protects rollback evidence and
  cutover.
- Weakens the evidence chain needed while native migration parity is still
  being proven.

### Retain a bounded internal verifier and enforce a cutline

Pros:

- Preserves the single safety decision required by rebuild cutover.
- Keeps product UI and HTTP diagnostic surfaces removed.
- Limits outputs, reads, and persistence while recording an explicit removal
  plan.

Cons:

- Maintains a small amount of migration-only code until Phase 8R completes.
- Requires discipline to keep the verifier internal and prevent it becoming a
  general diagnostics feature.

## Final Recommendation Stack

1. Retain the server-only migration verifier only as a cutover and rollback
   safety contract.
2. Allow no browser panel, client API, dedicated HTTP route, raw payload, or
   unbounded output for preview/replay work.
3. Permit only pure comparison, bounded database reads, and idempotent
   verification-receipt persistence; direct policy, routing, learning, and
   provider side effects remain forbidden.
4. Treat the generated-intent outcome mapper as a temporary evidence-reducer
   candidate, not a runtime dependency.
5. Delete or promote retained artifacts only after all of the following are
   proven: Phase 8R migration parity, native-storage cutover completion,
   rollback retention expiry, and no active rebuild binding. Promotion also
   requires an accepted runtime-evidence replacement contract.

## Implementation Outcome

- Added `policyPreviewReplayVerifierCutline.mjs`, a pure ESM inventory and
  audit service with no route, database, provider, scheduler, or client
  dependency.
- The audit verifies source state, allowed side-effect profile, output bounds,
  absent product surfaces, future exit criteria, and historical retirement
  evidence.
- Added focused tests for the complete inventory, pure reducer boundary,
  browser/HTTP/raw-output rejection, retired source reintroduction, and missing
  exit criteria.

## Security Outcome

- No former preview/replay browser or HTTP diagnostic can be reintroduced
  without failing the cutline audit.
- The retained verifier cannot be classified as normal authoring, browser
  reachable, or HTTP exposed.
- The receipt chain remains data-minimizing: only bounded summaries and
  fingerprints are retained for later cutover binding.

## Next Task

Phase 5R.8 Task 5R.8.3 **Runtime Evidence Reducer Resolution** is complete.
The generated-intent outcome reducer is retained as migration-only and is not
promoted into the runtime-evidence contract. See
[Policy Runtime Evidence Reducer Resolution](policy-runtime-evidence-reducer-resolution.md).
Phase 5R.8 Task 5R.8.4 is **Final Verifier Deletion Or Promotion Gate**.
