# Durable offline migration source and copy

Date: 2026-10-05. Follows [candidate verification](selected-migration-verifier-design.md).

## Decision

Replace the rehearsal-only source binding and copy phase with reusable ESM code.
Register the original, cleanly stopped PostgreSQL 18 cluster in a separate
root-protected journal record before any candidate mutation. Bind source content,
cluster identifier, layout and actual target OS identity. Re-read that record on
every attempt; never derive trusted identity from the converted candidate.

The trusted caller must already own offline isolation and the journal lease.
An advisory lock and absent PID do not prove that arbitrary old writers cannot
restart. This increment does not provision accounts, change the normal entrypoint,
automatically convert deployed installations, or reset ingestion ownership.
Fresh and unchanged-template installations gain no new background work.

## Contract

- One operation under the existing kernel-held journal lock. Linux/root and
  protected source/candidate parents are required. Application and database OS
  identities must be separated; the source belongs to the application identity.
- Require PG18, no PID file, clean control state, a bounded regular-file tree and
  no recovery/standby signals, links, hard links or mount crossings. Source reads
  and hashing have cooperative cancellation (five minutes by default); the caller
  must join in-flight filesystem work or fail its process, never continue after
  an uncertain timeout. A native copy/fsync cannot be forcibly cancelled by an
  AbortSignal. This is not a host-filesystem responsiveness guarantee.
- Persist a versioned, exact-shape source record with fsync/rename/directory fsync.
  Missing provenance alongside conversion/selection receipts or a candidate is a
  refusal, not permission to recreate provenance. Changed source or identity is
  a refusal. No credentials or plaintext configuration are stored in the record.
- Copy only when the phase journal durably names a pending copy for this binding
  and no selection exists. A retry may replace only the registered, unpublished
  candidate under its protected parent, after checking its tree and absent PID.
  Never delete or modify the original. Never recopy a selected database.
- Check available space before removal; require 110% of source bytes. Copy whole
  files exclusively and sync contents/directories; verify destination digest and
  unchanged source before completion. Existing limits remain 50,000 entries,
  8 GiB and depth 64, with a 1 MiB hashing buffer and sequential I/O.
- Interrupted work leaves its pending phase. A later explicitly admitted attempt
  revalidates the original before retrying. Cancellation, I/O failure, malformed
  state and unknown shutdown never report completion or initiate a retry loop.
- No automatic role/configuration repair, tuning changes, key rotation or fallback
  to the old source after selection. Existing fixture provisioning/role phases
  remain explicit until their production replacement is reviewed.

## Official research

Discovered through MCP search and opened on 2026-10-05:

- [PostgreSQL filesystem backups](https://www.postgresql.org/docs/current/backup-file.html):
  physical copies need the complete stopped cluster or a consistent snapshot;
  refusing connections alone is insufficient.
- [PostgreSQL upgrade procedure](https://www.postgresql.org/docs/18/pgupgrade.html):
  major-version upgrades and configuration preservation need separate handling.
  This is same-major identity conversion, not another major-version upgrade.
- [Node 24 filesystem APIs](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html):
  exclusive copy avoids overwriting files; copy itself is not atomic. Persist
  intent first and verify copied contents before advancing the receipt.
- [Linux flock](https://www.man7.org/linux/man-pages/man2/flock.2.html):
  locks follow open file descriptions and are advisory. They coordinate this
  component, not every possible writer.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Recompute binding without a source record | Less persistent state | Missing state cannot reliably distinguish first use from lost provenance |
| Durable original binding plus copy — chosen | Preserves original; rejects changed source and unregistered retries | Extra disk, hashing and downtime; requires trusted offline isolation |
| In-place conversion | Saves disk space | Mutates the only copy across filesystem/SQL boundaries |

Next: production account/layout and policy/role provisioning that preserves
supported database/vector tuning; integrate the trusted root handoff; rehearse
published-image upgrades; then enable database-fenced unattended ingestion
recovery. No UI/API change or accessibility conformance claim is involved.
