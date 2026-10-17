# Gateway catalog resource and interruption qualification

Approved scope: qualify the optional automatic catalog worker without enabling it
on Unraid or contacting shared Ollama. This is not a release or purge facility.

## Contract and weak points

Reuse the immutable-image rehearsal and its synthetic, labeled resources. Run the
packaged worker in its own 256 MiB, no-swap, 0.5 CPU, 32-PID container. Keep the
restore verifier separate at 1.5 GiB, with no source socket, credentials, network,
Docker socket or writable archive mounts. Fresh/empty history performs no export.

Measure large maintenance histories and nested documents before changing runtime
code. In particular, repeated full archive-job lists can materialize much more
than the streaming catalog scanner's 16-row batches. Any fix must bound reads
before JSON reaches Node, retain identity/attempt history and fail explicitly
when a safe resource envelope cannot be met. Do not increase memory or timeouts
to make tests pass. No new durable tables are planned; new durable IDs, if needed,
must remain UUIDv7.

Preserve the shared three-attempt limit, persisted five/thirty-minute cooldowns,
single coordinator, 120-second assessment deadline, 256 MiB dump/content limit,
1 GiB combined file budget and permanent recovery protection. Failure before
admission must not consume an attempt. A confirmed failed/cancelled capture keeps
its attempt and cooldown. Unknown export/publication remains interrupted, not
retryable merely because it is old. Registered-but-unacknowledged verification
must reuse the same catalog job and dependency records after restart.

## Verification

- Use large narrow histories and wide nested documents; report exact shape,
  canonical byte count, cgroup peak, OOM/PID events and elapsed time.
- Observe real dump progress and durable admission before SIGKILL. At publication
  and acknowledgment, fixture-only row locks expose the database boundary; verify
  the actual blocked session and committed state before terminating the worker.
  No production pause hooks or arbitrary sleeps stand in for observation.
  Killing the client does not prove a queued SQL statement rolled back. Observe
  durable state after termination: a confirmed publication may continue using its
  original job; an unconfirmed export stays interrupted. The fixture-held lock
  is released when its container dies, so either result is legitimate.
- Exercise concurrent synthetic inference, competing workers, verifier restart,
  storage refusal and unchanged attempts, files and protected evidence.
- Kill/remove only exact owned resources, verify cleanup after failure as well as
  success, and distinguish actual process death from power-loss durability.
- Run focused unit/SQL tests and applicable quality gates; build local Compose
  without cache, rehearse the exact image, then evaluate only local Classifarr.

## Research and recommendation

Official sources discovered through MCP search and read on 2026-10-17:

- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  equal memory and memory-swap bounds prevent swap; keep OOM safeguards enabled.
- [Docker statistics](https://docs.docker.com/reference/cli/docker/container/stats/):
  CLI memory subtracts cache. Use cgroup peak/events as well as process diagnostics.
- [PostgreSQL 18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html):
  exported snapshots align the dump with the independent read-only capture.
- [Node 24 process memory](https://nodejs.org/download/release/v24.20.0/docs/api/process.html):
  RSS includes native allocations, not only JavaScript heap.
- [PostgreSQL statistics consistency](https://www.postgresql.org/docs/18/runtime-config-statistics.html):
  clear the fixture transaction's statistics snapshot when polling a live blocked
  statement, rather than mistaking cached activity for its current state.

Recommended stack: existing ESM workers, bounded PostgreSQL reads, synchronized
snapshots, isolated restore verification and exact-image Docker fault tests.
This preserves the deployed architecture and gives repeatable evidence, at the
cost of longer tests and conservative refusal when resource safety is unknown.
Increasing limits hides scaling weaknesses; automatically replaying ambiguous
work risks duplicate side effects. Neither is part of this change.

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Bound the existing SQL result before transfer | Small change, preserves complete accepted evidence, prevents the reproduced Node allocation failure | Large legitimate evidence sets can pause maintenance | Implement now |
| Validate protected evidence incrementally | Could support larger histories with bounded working memory | Must preserve a consistent snapshot, ordering, identity and complete dependency checks across pages | Next item |
| Increase memory or retry interrupted work automatically | May postpone capacity failures or resume work sooner | Does not bound growth; uncertain writes can be repeated and budgets undermined | Not selected |

Completion means recorded results for the tested envelope, not a claim that all
possible histories fit or that local copies protect against host/disk loss.
Publish results and remaining limits in a separate outcome document.

Run against an immutable locally built image and its exact 40-character source
revision, using the existing runner's `--catalog-qualification` mode:

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <sha256:image-id> <revision> --catalog-qualification
```

The command accepts no live endpoint or volume override. It creates and removes
only its own synthetic resources; a nonzero exit means qualification failed.

## Implementation choice

The regression test demonstrated that a 200-row, approximately 12 MB nested
evidence result was returned in full. The new archive-history reader uses one
SQL statement to select at most 10,001 rows and measure the projected uncompressed
JSON bytes. Above 10,000 rows or 8 MiB it returns only a refusal sentinel, not the
payload. Native timestamps, ordering and full evidence remain unchanged below
the bound. Failed/retired payloads remain in SQL and in catalog captures, but are
not loaded by the scheduling list. No attempt or record is removed.

The 8 MiB operational read envelope leaves room for repeated coordinator results,
Node/native allocations and dump processes inside the existing 256 MiB limit.
This is intentionally conservative: a legitimate unusually large set of active
protected manifests can also stop maintenance with
`gateway_archive_history_size_limit`. It does not stop inference. A future
sequential evidence reader could improve that case; this change does not claim
unbounded history support or change retention-policy fingerprints.
