# Policy Authorized Outcome Idempotency Ledger

## Status

Implemented as Phase 6R.3.3b. This is an inactive persistence foundation: no
live route claims a receipt until the Phase 6R.3.3c transaction executor is
implemented.

## Problem

Canonical learning intake and an authorized persistence command identify a
bounded source event, but neither prevents retries, duplicate Discord delivery,
or competing requests from applying different writes for that event. An
in-memory cache is not durable or concurrency safe, and storing source payloads
would retain unnecessary operator, provider, AI, and media details.

## Official Guidance Reviewed

Official sources reviewed July 26, 2026 against the requested June 2026
baseline:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side execution controls and unique authorization material per
  operation to resist replay.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports audit records for security-relevant business events while avoiding
  unnecessary sensitive operational data.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
  documents `ON CONFLICT` as the database primitive for a unique-key collision.
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains that `ON CONFLICT DO NOTHING` may observe a concurrent conflict not
  visible to the statement snapshot, so the repository performs a follow-up
  read in the same caller-owned transaction.
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents that row locks remain until transaction end; the following executor
  task will lock current classification state before claiming this receipt.

## Design

```text
canonical intake + guard + locked state + authorization
  -> authorized persistence command
  -> SHA-256 fingerprint of compact command semantics
  -> unique (source_id, source_event_id) receipt
  -> claimed | replayed | source_event_mismatch
```

The database table is append-only and has a unique `(source_id, source_event_id)`
constraint. The repository uses `INSERT ... ON CONFLICT DO NOTHING`, then reads
the original receipt when it did not insert one:

- matching fingerprint: return `replayed` and the original compact receipt;
- different fingerprint: return `source_event_mismatch` and do not permit a
  second operation;
- inserted receipt: return `claimed`.

The fingerprint binds only mutating command semantics: source/event,
classification, final-outcome state, allowed learning operation/candidate, and
profile-refresh operation. It excludes actor identity, reason text, library
display names, raw intake, AI/provider data, title/path metadata, and any
payload that would enlarge retention or reveal an answer outside the execution
boundary.

## Options Considered

### In-Memory Replay Cache

Pros: simple and no schema change.

Cons: lost on restart, not shared across replicas, and cannot survive a
transaction rollback boundary.

### Source Event Without a Fingerprint

Pros: smallest table.

Cons: cannot distinguish an exact retry from a changed payload reusing the
same event identifier.

### Upsert That Overwrites the Existing Receipt

Pros: single statement with a returned row.

Cons: permits source-event semantics to change and destroys audit evidence.

### Append-Only Unique Receipt With a Deterministic Fingerprint

Pros: durable replay protection, explicit mismatch rejection, compact audit
state, and a clear transaction handoff.

Cons: requires one small table and a later transaction executor to use it.

## Final Recommendation Stack

1. Keep canonical intake and the learning guard pure.
2. Build an authorized command from server-locked state and revalidated
   authority.
3. Fingerprint only compact command semantics.
4. Claim the unique receipt inside the same transaction that will perform
   allowed writes.
5. Treat a mismatch as a failed execution gate, never as a retry.
6. Persist the final outcome, approved learning, refresh command, and receipt
   together in Phase 6R.3.3c.

## Security And Lifecycle Boundaries

- Receipt creation requires a caller-owned transaction client. The repository
  cannot silently open an independent transaction.
- The schema allowlists sources, final-outcome states, persistence states, and
  writable learning tiers; it rejects malformed fingerprints and identifiers.
- Rows are database append-only. A replace restore uses one transaction-local
  maintenance setting to discard runtime receipts, so restored configuration
  cannot inherit stale replay state. Receipts are intentionally not part of
  configuration backup payloads.
- The ledger is not presented as cryptographic non-repudiation against a
  database administrator. Database access remains privileged infrastructure.
- This task does not persist outcomes or learning, call a provider, consume
  quota, route media, or refresh a library profile.

## Verification

Focused tests prove deterministic compact records, transaction-client
enforcement, parameterized claim insertion, exact replay, source-event
mismatch rejection, and replace-restore cleanup through the guarded setting.
Migration coverage checks the table, constraints, unique key, index, and
append-only trigger in the schema snapshot.

## Next Step

Proceed to **Phase 6R.3.3c: Transaction Executor**. It must lock current
classification state, revalidate authority and destination, claim this receipt,
and execute all approved writes in one rollback-safe transaction before any
active route is adopted.
