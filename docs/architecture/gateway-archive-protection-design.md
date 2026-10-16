# Gateway archive recovery protection

## Approved contract — 2026-10-16

Protect two separately restore-verified files for each exact batch before future
history cleanup can be considered. Keep recovery possible for at least 30 days
**after confirmed deletion**, not after export. Protected historical copies may
coexist with two current rolling copies inside the existing 1 GiB budget.
Insufficient space pauses work; it never weakens recovery requirements.

This increment implements protection and readiness only. It does not delete live
history, activate the optional services, expire protection, or change Unraid or
shared Ollama. Without a durable deletion-completion record, protection is
indefinite. Every result continues to say `purgeAuthorized: false`.

## Evidence and alternatives

Official sources retrieved through search MCP on 2026-10-16:

- [pgBackRest retention](https://pgbackrest.org/user-guide.html): expiration follows
  successful replacement; time and count retention solve different requirements.
- [restic retention](https://restic.readthedocs.io/en/stable/060_forget.html?highlight=%22keep-tag%22):
  protected tags and latest-copy counts are separate controls. Merely accumulating
  newer snapshots is not proof that a required historical recovery point survives.
- [PostgreSQL 18 locks](https://www.postgresql.org/docs/18/explicit-locking.html):
  row locks and transaction-scoped advisory locks can serialize cooperating
  maintenance, with consistent ordering and bounded contention handling.

| Approach | Benefit | Cost / limitation |
| --- | --- | --- |
| Only keep the latest two archives | Small, simple | Eventually loses deleted records; rejected |
| Expire protection from archive age | Predictable storage | Wrong clock if deletion happens later; rejected |
| Durable holds plus private file markers | Restart-safe; prevents ordinary rotation and stale-metadata deletion | Extra storage; can pause at capacity |
| Delete history now | Relieves ledger pressure | Completion/expiry contract is not implemented; deferred |

Recommendation: retain existing bounded ESM workers, PostgreSQL 18 native UUIDv7,
v4 manifests/v2 independent restore receipts, and add durable protection. No new
dependency, public API, administrator button, or provider request is needed.

## Admission and completion

At the existing 80,000-binding pressure threshold, read the first at most 100
eligible terminal candidates in the same bounded read-only snapshot as the report.
Fresh, empty, inconsistent, and non-pressure histories do not request protection.
Two verified v4 archives must contain the same complete candidate-entry identities
and row hashes. Both receipt bindings and files are rechecked. A group is scoped to
the ledger, provider, and exact candidate batch; protection is idempotent.

When only one matching current archive exists, one second export may be requested
even if its source revision is unchanged. This uses the existing lifetime maximum
of three attempts for that revision, persisted cooldowns, one coordinator, 120-second
assessment deadline and 256 MiB dump bound. No revision alias or budget is reset.
Legacy archives can still rotate but cannot satisfy exact-candidate protection.

The optional archive schema gains a UUIDv7 protection group and a job protection
reference. A transaction locks both jobs in deterministic order, checks verified
evidence, inserts the hold and fences both jobs. Protected job evidence cannot be
changed or retired. A separate transaction lock bounds protection admission and
the 1,000-group ceiling. Retirement competing with protection either wins before
the hold (protection refuses), or loses to the durable job fence.

After SQL commits, the worker publishes a private, bounded `protection.json` beside
each archive using exclusive creation, fsync and atomic publication. Only then is
the group marked ready. A restart resumes an incomplete publication. An unexpected
marker or mismatched metadata blocks work. Old retirement code already rejects
extra files, so restored-old database metadata cannot silently discard marked
archives. There is no automatic marker removal.

## Rotation, resources and roles

The newest two verified archives remain the rolling set. Older protected copies
are extras; predecessor proofs remain bounded to two. Rotation keeps its existing
full immutable-prefix verification and can retire only an unprotected copy.
All files, markers, pending publications and receipts count toward 1 GiB, including
replacement headroom. No protection is released to make space.

Only the optional coordinator schema changes, with an explicit upgrade and an
equivalent fresh schema. The coordinator needs protection SELECT/INSERT and
UPDATE(ready_at), but no DELETE/TRUNCATE. The archive reader remains read-only on
inference data; the isolated verifier receives no live database or provider access.
The existing archive policy fingerprint and attempt history remain unchanged.

Cancelled exports retain normal cooldowns. Interrupted/unknown exports remain
blocked. Missing schema, malformed evidence, lost markers, changed identity,
exhausted attempts, unsafe filesystem state, or insufficient storage never confer
deletion authority. SQL holds remain protective even before readiness completes.

## Verification and next boundary

Test exact-pair matching, unchanged second-copy admission and attempt limits,
native UUIDv7, schema upgrade, protected mutation refusal, competing transactions,
crash publication, stale metadata, rolling rotation and storage refusal using real
PostgreSQL and isolated image fixtures. Record results separately in the outcome.

Next: a bounded cleanup transaction that revalidates live candidate rows, requires
both protected files, and atomically records actual deletion completion. Only after
that exists can a separately tested 30-day retention/expiry process be implemented.
