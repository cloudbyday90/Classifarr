# Gateway cleanup evidence

2026-10-16. Local implementation on main; no release or production activation.

## Decision and scope

The recommended cleanup policy is pressure-driven work at 80,000 of 100,000
resident bindings, retaining at least 90 days of recent terminal history and
protecting active, uncertain and lifecycle-linked work. Deleted history would
remain recoverable for at least 30 days, within the existing 1 GiB budget, with
compact audit summaries. Insufficient capacity must stop cleanup rather than
shorten that recovery promise. These are project policy choices, not industry
mandated durations. The user's instruction to proceed with the preceding
recommendations is treated as agreement with that direction, not permission to
delete production data.

This increment implements the first prerequisite: exact, restore-verified
candidate evidence in automatic archives. It does **not** implement deletion,
archive pins, expiry, or the cleanup audit table. Current full-snapshot rotation
cannot preserve deleted history in subsequent live-only snapshots. That storage
lifecycle must be solved before enabling cleanup. No new administration controls,
source write privileges, database objects or provider calls are introduced.

## Research and tradeoffs

Official sources discovered through MCP search and opened on 2026-10-16:

- PostgreSQL's [snapshot synchronization](https://www.postgresql.org/docs/18/functions-admin.html)
  lets independent readers see the same committed data while the exporting
  transaction remains open. Capture the report, exact candidates, full-table
  digests and native dump from that one read-only snapshot.
- [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) warns that
  source-controlled SQL can execute during restoration. Keep the existing
  network-isolated container, packaged schema and restricted data-only restore;
  an integrity checksum alone is not a restore test.
- PostgreSQL [locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes row locks and deadlocks. Snapshot eligibility is historical evidence,
  not future write authority: eventual cleanup needs fresh transactional checks
  and consistent bounded locking, not a long-lived snapshot lock.
- The [pgBackRest retention guide](https://pgbackrest.org/user-guide.html) completes
  replacement backups before expiring older copies. Keep that ordering; do not
  relax today's preservation test merely to allow pruning. No pgBackRest
  dependency is added.

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Full-table hashes alone | Existing bounded integrity and rotation checks | No explicit record-level cleanup batch proof |
| Exact candidates plus actual restore (selected) | Binds specific records and dependencies to restored content | Additional bounded SQL and manifest data; not deletion authority |
| Immediate automatic deletion | Would relieve resident-row capacity | Unsafe before archive retention, pins and transactional deletion are connected |
| Re-export every old archive on upgrade | Could add new evidence sooner | Bypasses unchanged-history scheduling and risks resetting retry budgets; rejected |

Recommended stack: existing Node 24 ESM modules, PostgreSQL 18 exported snapshots
and native UUIDv7 references, existing least-privilege coordinator and isolated
verifier. Keep schema version 7, existing dependencies and the normal application's
disabled optional-service boundary unchanged.

## Versioned evidence contract

New online archives use manifest version 4: version 3's complete content proof
plus the existing bounded retention inventory. Select at most 100 oldest eligible
attempts, preserving decimal-string bigint ordinals and native UUIDv7 binding and
request references. Each fingerprint covers the complete binding, completion and
optional TLS peer record; the inventory also binds the admission-row digest.
No titles, prompts, credentials or raw record bodies are added to the manifest.

After native restore, recompute the full report using the archived cutoff and
capture time, not the verifier's wall clock. Independently check all category
counts and admission identity/counters, then recompute the ordered candidate
inventory. Exact equality is required, including the total beyond the 100-record
page. A malformed, omitted, substituted, newly protected or changed entry fails
verification. There is no partial-success receipt.

New reports use one millisecond-precision capture timestamp and derive the cutoff
from it. Version 4 rejects a cutoff inconsistent with the declared retention
duration; old formats retain their original validation rules.

Successful version-2 receipts bind the exact manifest and dump and include a
canonical retention-inventory SHA-256. Canonical field ordering makes the digest
stable across PostgreSQL JSONB key reordering. Failed receipts have no retention
digest. The coordinator rejects a legacy receipt for a version-4 manifest and
checks the retention digest before accepting success. Every receipt still says
`purgeAuthorized: false`; hashes are integrity evidence, not signatures or consent.

Legacy version-3 online archives and version-1 receipts remain valid for their
original restore/rotation purpose, never as exact-candidate proof. Offline
version-1/2 archives and stop-required review remain unchanged. Do not rewrite
jobs or bump the scheduling policy fingerprint: unchanged old archives remain
unchanged; normally due jobs use version 4. Upgrade coordinator and verifier
together. An old reader safely refuses the new format.

## Bounds, failures and completion

Preserve one coordinator and one pending job, three attempts per source revision,
persisted five-minute/30-minute cooldowns, no refund on upgrade/cancellation, and
blocked uncertain export termination. No history means no work. Read-only status
must not trigger network or export work. Existing configuration/identity fences,
256 MiB dump/content bounds, 64 KiB manifest bound, 1 GiB managed storage and
worker CPU/memory/PID/time limits remain in force. Candidate SQL uses the existing
four-second statement timeout and fixed identifiers with parameterized values.

Cancellation or interrupted verification cannot publish successful evidence.
Publication and restart reuse the existing exact manifest-bound receipt protocol.
Source privileges and immutable-table triggers remain untouched. The 30-day
archive-only recovery window is not claimed as implemented by this increment.

Completion requires contract tests, real PostgreSQL tests for historical cutoff,
category protection, counter mismatch, concurrent admission and candidate
substitution; then a no-cache packaged build and isolated native restore tests
covering mixed old/new formats, a full candidate page, tampering, restart and
unchanged live history. Record actual checks and omissions in a separate outcome.
Next: retention-aware archive generations and durable pins, followed by bounded
transactional cleanup with a separately bounded audit-summary lifecycle.
