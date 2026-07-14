# Policy Active Intent Integrity Correction

## Status

Implemented for Phase 8R Task 8R.1.1.

## Problem

Native intent is becoming the durable policy authority, but the original
partial unique index included `intent_version`. A policy could therefore have
two active native intent rows as long as their versions differed. Runtime
reads, conversion retries, and restores would then have no unambiguous active
authority.

## Official Guidance Reviewed

- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
  documents that a unique partial index enforces uniqueness only for rows that
  satisfy its predicate. That supports one active row per `policy_id`.
- [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
  notes that a unique index checks existing and future rows, and that `IF NOT
  EXISTS` does not prove an existing index has the intended definition.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents the conflict behavior used to keep concurrent writers from
  reintroducing ambiguity during the repair.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  documents the default Read Committed behavior and concurrent-update waiting
  semantics relied on by the writer boundary.

## Recommendations

1. Enforce `UNIQUE (policy_id) WHERE active = TRUE`, not unique active
   `(policy_id, intent_version)`.
2. Repair historical duplicates inside the migration transaction under a short
   `SHARE ROW EXCLUSIVE` lock on `policy_intents`.
3. Select a canonical row only from `valid` or `warning` candidates. Prefer
   `valid`, then the highest intent version, acceptance timestamp, update
   timestamp, creation timestamp, and ID.
4. Preserve noncanonical rows by deactivating them and setting
   `replaced_by_intent_id`; never delete payload or child data.
5. Fail the migration before mutation when a duplicate group has no safe
   candidate. An operator must resolve that historical ambiguity explicitly.
6. Record a metadata-only migration event per repaired policy. Do not copy
   native intent, provider, or UI payloads into audit metadata.
7. Serialize native-authority writers on the owning `library_policies` row and
   make backup restore fail closed if an active intent cannot be mapped exactly.

## Options

### Keep the existing index

Pros: no deployment lock or migration work.

Cons: permits multiple active authorities and leaves every reader to make a
heuristic choice. Rejected.

### Keep multiple active rows and choose newest at read time

Pros: avoids modifying historical rows.

Cons: makes state interpretation non-deterministic, hides data quality issues,
and allows concurrent writers to diverge. Rejected.

### Repair safe duplicates, block unsafe groups, then enforce one authority

Pros: deterministic authority, preserves history, transaction rollback protects
unsafe data, and a database constraint protects all current and future writers.

Cons: a deployment can intentionally stop for manual resolution of invalid-only
duplicates, and the migration briefly blocks writes to a small policy metadata
table. Recommended.

## Final Recommendation Stack

- Migration: `20260713_150000_enforce_single_active_policy_intent.sql`.
- Database authority: `idx_policy_intents_one_active_policy` on `policy_id`
  where `active = TRUE`.
- Historical repair: deactivate only noncanonical duplicates and link them to
  the chosen canonical intent.
- Safety cutline: reject duplicate groups without a `valid` or `warning`
  candidate before any repair or schema mutation commits.
- Operational audit: one `active_intent_integrity_repaired` event per repaired
  policy, with bounded IDs and counts only.
- Runtime protection: policy-row locks for native-authority writes and exact
  mapping requirements for restore.

## Verification

The focused tests cover the contract, repair report, migration SQL coverage,
restore conflict behavior, serialized writers, and database uniqueness. Fresh
schema dump/check verification regenerates `database/schema/current.sql` from
the migration set.
