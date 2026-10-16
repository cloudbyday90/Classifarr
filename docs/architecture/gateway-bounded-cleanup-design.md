# Bounded gateway history cleanup

## Approved scope — 2026-10-16

Implement automatic cleanup for the optional standalone gateway, not the normal
application database. At 80,000 resident bindings, assess every five minutes and
delete at most 100 exact, previously archived terminal records. Retain at least
90 days of admission/completion history. Never delete active, uncertain or
lifecycle-linked work, change provider state, or reset lifetime attempts.

Two separately restore-verified archives must retain each batch. Keep those files
protected for at least 30 days after confirmed deletion. This increment records
that clock but implements **no protection expiry**. The 1 GiB archive budget is
unchanged; missing evidence or space pauses work. No new administration buttons,
production activation, shared Ollama changes, or release are included.

## Research and recommendation

Official sources discovered through search MCP and opened on 2026-10-16:

- [PostgreSQL function security](https://www.postgresql.org/docs/18/sql-createfunction.html):
  a privileged routine needs a trusted search path and narrowly granted execution,
  with PUBLIC execution revoked in its creation transaction.
- [PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  keep row locks short, acquire locks consistently, and handle contention rather
  than blocking inference behind file verification.
- [PostgreSQL vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html):
  deletion frees logical capacity, not necessarily operating-system disk space.
  Leave normal autovacuum enabled; do not add disruptive VACUUM FULL operations.
- [pgBackRest retention](https://pgbackrest.org/user-guide.html): successful
  replacement precedes expiration. Copy counts do not replace time-based recovery
  protection. No pgBackRest dependency is introduced.

| Approach | Benefit | Cost / limitation |
| --- | --- | --- |
| Grant ordinary archive roles DELETE | Few components | Violates read-only archive boundary; rejected |
| Separate constrained cleanup worker | Small write authority; independently optional | Another restricted service/configuration |
| Relax predecessor verification after deletion | Simple rotation | Could discard unexplained missing history; rejected |
| Require the current pair protected before deletion | Existing exact-prefix proofs remain valid | Rotation and protection must finish first |

Recommended stack: existing Node ESM modules, PostgreSQL 18 native UUIDv7,
restricted SQL routines, current v4 manifests/v2 independent restore receipts,
and existing network-isolated Docker workers. No dependency changes are needed.

## Transaction and authority

An explicit optional cleanup schema installs a non-login, non-superuser routine
owner. The runtime worker receives only execution and diagnostic SELECT grants,
not direct history mutation or schema ownership. Existing archive credentials and
the verifier remain unchanged. The seven-table inference data contract stays at
version 7: no data columns change. The extension installs narrowly fenced DELETE
triggers; UPDATE/TRUNCATE remain forbidden. It is never an application migration.

The coordinator and cleanup worker share a maintenance exclusion lock, distinct
from the inference session lock. Database guards reject archive writes outside
that boundary once cleanup is installed. Installation requires stopped optional
workers; runtime cleanup does not stop inference. Filesystem hashing happens
before the short deletion transaction, with archive directories mounted read-only.

Require no pending/interrupted/retiring archive job, no unprotected verified copy,
and the exact newest pair belonging to the target ready protection group. Recheck
all retained protected files, receipts and markers, budget headroom, configuration,
ledger and provider identity. SQL independently rechecks the pair and exact live
candidate hashes. Lock the admission row without waiting, fence lifecycle races,
delete children before bindings, decrement only the exact binding count, and write
the completion receipt in the same transaction. Any mismatch rolls everything back.

An operation is unique per ledger/provider/exact candidate batch, uses UUIDv7, and has at most three
durable attempts with five-minute then thirty-minute cooldowns. One worker owns
the cleanup session lock; one batch can be admitted per five minutes. A restart
first resolves an admitted operation under that lock. Unknown connection outcomes
are not blindly replayed. Committed completion is observed in a later transaction
before recording confirmation; only that later timestamp can anchor a future
30-day expiry. Cancellation preserves consumed attempts. Existing archive attempt
accounting and policy fingerprints are not changed.

If archiving advanced while cleanup was offline, a newer pair may protect the
same batch. Only the explicitly installed cleanup extension permits these extra
holds. The operation is rebound only on a failed retry and retains its UUID and
consumed attempts; completed/exhausted batches do not request replacement holds.
Old holds remain intact. This avoids a stale-pair dead end without a budget reset.

## Continuing archives without weakening proof

Let A/B be the protected newest pair. There must be no unprotected pre-deletion
copy or pending export. After deletion, C may verify its own restored contents
without preserving A/B. D can preserve C; E can preserve C/D, permitting ordinary
rotation of C. A/B are never retirement targets. This uses the verifier's existing
meaning of `verified` versus `preserves`, not an exception to the prefix proof.
The same gate applies before every subsequent batch.

Receipts live in the separate cleanup schema, not the seven-table inference dump.
No expiry is implemented, so restoring old metadata cannot age out a hold: private
markers and SQL protection remain mandatory. Backing up the complete maintenance
catalog and safely expiring holds are separate future work. Full-copy protection
can fill 1 GiB after only a few batches; this is bounded recovery, not sustained
high-throughput compaction or off-host disaster recovery.

## Verification and completion

Add real PostgreSQL regression tests for exact deletion/counts, UUIDv7, roles,
recent/active/lifecycle/changed rows, competing inference and maintenance,
rollback, committed-but-unconfirmed restart, cooldown and attempt preservation.
Exercise post-deletion native restores and normal rotation with the existing
immutable-image rehearsal. Test missing/tampered files and cancellation refusal.
Keep source/dump/time/memory limits and labelled-resource cleanup verification.

Run focused tests and affected quality gates, then a no-cache local Compose build
and isolated image rehearsal before replacing only the local application. Record
actual evidence and omissions separately; no live cleanup is activated. Next:
maintenance-catalog recovery and verified protection expiry, with the confirmed
deletion clock and retained minimum window enforced end to end.
