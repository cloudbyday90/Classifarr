# Comparison streaming verification design

Date: 2026-10-06. Follows the
[refresh-cycle findings](representative-resource-retry-outcome.md).

## Evidence and decision

The complete-catalog trace rose from 475.52 MiB main heap at comparison build end
to 692.18 MiB at the independent verification read. Old snapshots were collectible
later, and all workers exited; this is an allocation/lifetime target, not evidence
of a permanent leak. The verifier currently materializes a complete decoded vector
map solely to recompute an exact source fingerprint. Publication retains only
membership metadata and the fitted handle.

Add a dedicated repository verification read. Capture fresh state, libraries,
corpus and novelty identities, and validate/fingerprint vectors in bounded batches
inside one independent repeatable-read, read-only transaction. Do not return
decoded vectors. Share canonical source metadata and exact float64 fingerprint
encoding with fitting so the new path cannot silently use a weaker key.

Retain complete-cache preflight, every actual vector value, hash/membership/model
identity, scope validation, component/row limits and cancellation. Batch storage
is capped at the existing 256 rows / 262144 components, plus one dimension-bounded
hash buffer. Validate all transported vectors, including any not used by training.
Missing, malformed, duplicate, foreign or changed rows must never publish a model.
The initial fitting read still owns full vectors; no transfer or caller mutation.

After the verification transaction ends, check provider identity, final state,
configuration and revision, then the existing publication admission checkpoint.
Do not reuse the initial database snapshot or hold a transaction during fitting
or provider calls. Fresh/disabled setups start no extra work. Preserve single
flight, six-minute run deadline, retries/jitter, cache capacity/expiry, memory
admission and hysteresis. Restarts discard unpublished process-local state.
No schema, configuration, Compose/template, HTTP or diagnostic-message change.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Stream exact verification values | Avoids retaining a second full decoded map | Requires canonical-key parity and real transaction tests; selected |
| Verify only timestamps/counts | Less I/O | Can miss changed values or membership; reject |
| Reuse the fitting snapshot | Avoids another read | Cannot prove freshness after fitting; reject |
| Transfer worker buffers or change fitting algorithms | May reduce other peaks | Separate ownership/numerical changes; defer |
| Raise memory limits or force GC | May delay symptoms | Does not fix allocations; reject |

Hashing now runs inside the existing bounded read-only transaction instead of
after decoding a full map. This modest CPU cost extends the snapshot lifetime;
statement, lock, idle and total transaction timeouts remain unchanged. Validate
the full workload before assuming this tradeoff is acceptable on slower storage.

First establish exact fingerprint parity and before/after failure evidence. Next
exercise concurrent writes in isolated PostgreSQL and the unchanged shared-catalog
image study. Only then select another allocation optimization from the trace.

## Verification and limits

Cover empty/shared/orphan descriptions, canonical ordering, last-component changes,
negative zero, missing/expired/corrupt/foreign vectors, cancellation across batches,
read-only repeatable-read visibility, source/config/provider/revision changes,
cache hits and publication pressure. Prove completed batches are not retained by
the verifier; diagnostic collection belongs only in an isolated test process.
Do not assert an exact RSS reduction or mistake sampled allocation for retention.

Rebuild local Compose without cache, preserve appdata and rollback backup, run an
isolated schema dump followed by an independent schema check, and observe health.
Leave Unraid untouched. Preserve failed receipts and unchanged study acceptance.

## Official research and PR trial

Sources discovered and opened with web tools on October 6, 2026:

- [Node memory accounting](https://nodejs.org/api/process.html): process RSS,
  per-thread heap and external memory differ; array buffers are already included
  in external memory. Only APIs supported by pinned Node 24.21.0 are used.
- [Node heap-snapshot warning](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots pause execution and can substantially increase memory; do not capture
  a live production heap for this change.
- [PostgreSQL transaction snapshots](https://www.postgresql.org/docs/current/sql-set-transaction.html):
  repeatable-read preserves a transaction snapshot across statements. Our separate
  verification transaction must observe changes committed since fitting began.
- [DefinitelyTyped version policy](https://github.com/Definitelytyped/DefinitelyTyped):
  declarations describe the corresponding library/runtime major and minor version;
  their patch version need not match the runtime patch.

Fresh open-PR enumeration found #555 and #556. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Trial its exact manifest/lockfile update
from Node 24 declarations to 26.6.4 and undici-types 8.9.0. Reject/revert if the
existing runtime-major gate fails; do not expand this work into a Node upgrade,
install incompatible declarations, or merge the PR. Results are recorded separately.
