# Policy Compatibility Evidence Writer

## Status

Implemented as Phase 6R.3.3e.2. This module compiles and persists a bounded
compatibility-evidence record only from an authorized outcome command and its
transaction-locked state. It is not yet invoked by the generic transaction
executor: Phase 6R.3.3e.4 must create an outbox row in the same transaction
before compatibility outcomes can commit end to end.

## Problem

The learning guard can admit a compatibility-evidence candidate, but a final
outcome is not itself safe to turn into an unrestricted policy rule. The
durable writer needs to preserve that distinction:

- support a plausible destination without defining its identity;
- use no AI text, provider data, UI labels, or client-supplied SQL shape;
- keep per-source idempotency in the authorized-outcome receipt; and
- avoid a database-to-profile-generator dual write.

The existing `classification_evidence` table is the backed-up canonical store
for related evidence. Its related-evidence unique index already covers the
only safe scopes for this writer: `genre`, `studio`, `franchise`, and
`certification`. Creating a parallel compatibility table would split the
evidence model and backup behavior without providing a new authority boundary.

## Official Guidance Reviewed

Official sources reviewed July 26, 2026 against the requested June 2026
baseline:

- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
  documents `ON CONFLICT` as the database-owned alternative for a violated
  unique constraint or index.
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  recommends parameterized queries so data cannot alter query semantics.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating authorization on every request and failing safely.
- [AWS Transactional Outbox Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
  recommends committing the database mutation and durable work notification
  together, then using an idempotent consumer.

## Design

```text
canonical intake + learning guard + locked state + revalidated authority
  -> authorized outcome command + receipt claim
  -> compatibility record compiler
  -> parameterized classification_evidence upsert
  -> later: same-transaction profile-refresh outbox row
  -> later: idempotent profile-refresh worker
```

The implementation is split deliberately:

- `policyCompatibilityEvidenceRecord.mjs` is pure. It reruns the authorized
  command audit and permits only the `write_compatibility_evidence` operation,
  `compatibility_evidence` tier, matching locked classification/destination,
  a guard reason, supported learning source, canonical candidate key, and a
  `movie` or `tv` media type.
- `policyCompatibilityEvidenceRepository.mjs` contains the one parameterized
  SQL upsert. Repeated approved evidence increments support count but never
  increments confidence on conflict; new rows use a fixed supporting value and
  existing higher-confidence rows are preserved.
- `policyCompatibilityEvidenceWriter.mjs` composes the compiler and repository
  through a caller-owned transaction client.

The stored record has fixed `50` confidence, `policy_confirmed` provenance,
and `policy_authorized_compatibility` source system. It contains a bounded
revalidated actor ID for audit attribution, but does not retain a destination
label, answer text, AI explanation, provider payload, route diagnostics, or
quota state. The source-event receipt remains the immutable correlation record.

## Authority Boundary

Manual outcomes may provide supporting compatibility evidence only. The writer
cannot persist `identity_evidence`, `hard_limit_evidence`, avoid evidence, or
an arbitrary signal type. Identity evidence remains reserved for Phase
6R.3.3e.3 and requires the stricter observed or operator-declared authority
path.

## Options Considered

### Create a New Compatibility Table

Pros: explicit event-shaped rows.

Cons: duplicates the existing canonical evidence store and its backup/restore
surface, while the authorized receipt already supplies immutable source-event
idempotency. Rejected.

### Reuse Generic Evidence Upsert Behavior

Pros: smallest implementation.

Cons: generic related-evidence updates can increase confidence on every
conflict and accept broader input shapes. That would weaken the supporting-only
policy boundary. Rejected.

### Use a Dedicated Writer Over Existing Canonical Evidence Storage

Pros: retains one evidence store, enforces a fixed supporting confidence,
uses parameterized SQL and the existing unique index, and provides a clean
outbox composition point.

Cons: execution remains intentionally deferred until evidence and refresh work
can be committed atomically. Selected.

## Final Recommendation Stack

1. Rebuild and audit the authorized command from locked server state.
2. Admit only canonical related-evidence scopes and a guard-approved
   compatibility operation.
3. Write bounded supporting evidence through a parameterized, caller-owned
   transaction.
4. Keep identity, declared intent, hard limits, and avoid rules outside this
   writer.
5. Add identity authority separately.
6. Add the profile-refresh outbox in the same transaction as an admitted
   evidence mutation.
7. Process only committed rows with an idempotent worker.

## Verification

Focused tests cover a valid studio record, noncanonical keys, unsupported
scopes, identity-operation rejection, locked destination drift, blocked writer
admission, parameterized upsert shape, and transaction-client enforcement.

## Next Step

Phase 6R.3.3e.3 is implemented in
[Policy Identity Evidence Authority Writer](policy-identity-evidence-authority-writer.md).
Proceed to **Phase 6R.3.3e.4: Refresh Outbox Persistence**. It must commit an
admitted compatibility or identity change with the validated refresh command
in one transaction.
