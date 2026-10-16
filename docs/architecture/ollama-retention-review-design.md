# Gateway retention review plans

Design, 2026-10-15. Offline implementation on main, synthetic local tests only.

## Decision

Implement the evidence prerequisite for reviewed cleanup: an exact, bounded
inventory in each new archive and a read-only comparison against the current
ledger. The previous archive only counted potentially eligible rows. Counts and
a valid dump checksum cannot identify the rows a future deletion may touch.
This step does **not** implement deletion, tombstones, capacity reclamation or
automatic cleanup. Immutable triggers and the 100,000-binding limit remain intact.

Version 2 archive manifests contain at most 100 oldest eligible bindings, ordered
by monotonic attempt number, with UUIDv7 binding/request references and a SHA-256
digest covering the complete binding, completion receipt and optional TLS peer
observation. The inventory and native dump share one read-only repeatable-read
snapshot. Hash the complete admission row too. Normalize SQL timestamp rendering
to UTC/ISO before hashing; no schema, tables or dependencies are added.

Only terminal `response_completed`, `provider_rejected` or `not_dispatched`
records older than the explicit retention cutoff qualify. Active, unknown,
recovery-linked and provider-stop-linked records never qualify. Use the same
classification expression for counts and selection. Missing legacy bindings and
counter inconsistencies block a usable review, not an invitation to repair them.

## Review contract and bounds

`review <archive-directory> <trusted-manifest-sha256>` verifies bounded private
files and the separately retained manifest hash **before** acquiring the database
snapshot. Version 1 archives remain verifiable, but cannot generate review plans;
create a new archive rather than inventing missing evidence. The expected hash
comes from the successful creation receipt kept in trusted storage, not from the
files being reviewed. This is integrity checking under an operator trust boundary,
not a digital signature, restore test or consent to delete.

A dedicated SELECT-only local socket connection acquires the existing offline
gateway lock. Running gateways and reentrant sessions are refused. Compare the
exact ledger/provider identity, configured retention horizon, admission digest,
all seven table counts and each inventoried row digest at the **archived** cutoff.
Any mismatch blocks the entire plan. New eligibility since the archive was made
does not expand its scope. Empty inventories are explicit no-work results; a
truncated inventory reports the remaining count and never claims full coverage.

Plans have a native PostgreSQL time-based UUIDv7, archive reference, trusted hash,
observation time, fixed reason codes and bounded entries. They always state
`purgeAuthorized: false` and `restoreVerified: false`. Print only operational
identifiers/digests, not row contents, credentials or raw SQL/provider errors.
Do not persist plans automatically or write to the source database. Treat output
as private. Plans are observations, not reusable execution capabilities.

Reuse the archive CLI's 90-second cancellation / 120-second hard deadline,
4-second SQL and 2-second lock deadlines, 64-KiB manifest and 256-MiB dump bounds.
One offline owner, no provider HTTP, retries, background scheduling or new defaults.
Cancellation and transient failures roll back reads; there is no ambiguous write
to replay. Restart or configuration/state changes require a new archive/review.
The database lock never proves that remote provider compute stopped.

Completion means a validated v2 archive and an accurate, bounded review result,
with source state unchanged. It does not mean cleanup occurred.

## Research and recommendation

Official sources discovered and opened through MCP on 2026-10-15:

- [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
  supports exporting a consistent snapshot for the native dump.
- [PostgreSQL consistency checks](https://www.postgresql.org/docs/18/applevel-consistency.html)
  distinguish a consistent historical view from current state. Our inference:
  a review must be repeated under execution-time locks before any future purge.
- [PostgreSQL binary hashes](https://www.postgresql.org/docs/18/functions-binarystring.html)
  provide native SHA-256; no pgcrypto extension is needed for these digests.
- [PostgreSQL UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html?trk=public_post_comment-text)
  provide native time-based UUIDv7 for archive and review identities.
- [PostgreSQL function security](https://www.postgresql.org/docs/18/sql-createfunction.html)
  describes privileged-function risks. No new privileged SQL function or deletion
  exception is introduced by this read-only stage.

| Option | Pros | Cons |
| --- | --- | --- |
| Delete by age and aggregate count | Small implementation | Cannot prove exact archived records; risks losing recovery evidence |
| Exact archive-bound review (selected) | Bounded, inspectable, no write privilege; detects drift | Requires offline window; does not reclaim capacity yet |
| Privileged purge now | Reclaims capacity | Needs tombstones, archive retrieval, execution-time fences and separate authorization |

Recommended stack: modular ESM, PostgreSQL 18 repeatable-read snapshots and native
UUIDv7/SHA-256, private v2 manifests with v1 verification compatibility, explicit
trusted hash and SELECT-only review. No change to normal Classifarr routing,
Unraid or shared Ollama.

Next: a separately reviewed transactional purge executor with UUIDv7 receipts,
bounded retained tombstones/archive lookup, explicit administrator consent,
execution-time revalidation and unchanged lifetime attempts/cooldowns. Prove crash
and rollback behavior before enabling that executor anywhere.
