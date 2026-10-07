# Representative consumer memory profiling

Design date: 2026-10-07. This follows the measurement gap in the
[representative verification outcome](representative-verification-outcome.md).

## Scope and contract

The isolated catalog study currently omits the real shadow-comparison and
neighborhood-recovery consumers. Add those production factories to this study,
not a new runtime feature. Keep production admission, retry, cache, cancellation,
revision, publication checks and garbage collection unchanged. No migration,
live recovery, external provider call or routing decision is authorized by this
measurement. Ordinary installations do no new work.

Use a small ESM study adapter. For each admitted representative preparation,
enqueue at most two synthetic unseen queries, one per supported media type,
against the actual model and snapshot. Generate them only after admission so
pending observations cannot force earlier refreshes. Production projection,
decision binding, scoring, geometry validation and readiness publication run
unchanged. These are diagnostic fixture decisions, never routed media.

Wrap preparation and commit separately. Preserve synchronous shadow preparation
and both synchronous commit contracts; never await a profiler filesystem walk
while holding the snapshot just to obtain a boundary sample. Record synchronous
main-thread heap/RSS measurements at these boundaries, explicitly distinguished
from full asynchronous worker/container/resident observations. Commit wrappers
must be created outside preparation scope and retain only the staged callback,
not its input snapshot/model. Weak references observe batches/model lifetimes.

The catalog receipt becomes v2 and requires actual preparation, successful
shadow processing and neighborhood-readiness publication, plus cleared consumers
after stop. Missing evidence, invalid fixture input, swallowed optional failures,
or unjoined workers must fail the study, not masquerade as a pass. Existing v1
receipts remain historical evidence, not evidence of this expanded workload.

## Bounds and failure behavior

Retain the 25-minute work deadline and 30-minute receipt ceiling, real
schedules/cooldowns, two independent reads,
2 GiB container, 128 PIDs, CPU limits, internal network, no published ports and
random owned volume. Retain production capsule/vector/TTL and hash-reference
bounds; cap synthetic preparation batches at 60. Keep existing numeric trace,
weak-reference and phase budgets. No provider bodies, text, vectors, source keys
or credentials enter emitted evidence. Failure/cancellation stops both refreshers,
clears consumers and removes only verified owned disposable resources. A restart
starts a fresh isolated experiment; there is no durable recovery state to replay.

Completion requires catalog drain and later scheduled comparison and representative
revalidations at least five minutes after each post-drain publication, plus
verified consumer evidence. Do not call
natural memory-pressure recovery proven unless it actually occurs. This measures
preparation/publication retention, not a full metadata-priority queue workload or
production semantic accuracy. The catalog's real queue remains unchanged.

## Research and options

Official sources discovered through web search and opened on 2026-10-07:

- [Node 24 process memory documentation](https://nodejs.org/docs/latest-v24.x/api/process.html): RSS
  covers the whole process; other memory fields describe the calling thread.
  Do not add worker RSS to process RSS, or arrayBuffers to external memory.
- [Node V8 statistics](https://nodejs.org/api/v8.html): physical heap and used
  heap are different measurements. Record both; do not subtract reusable memory
  from admission accounting.
- [Node heap-snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  heap snapshots pause execution and can double heap demand. Keep this bounded
  study aggregate-only; do not take an unsolicited live-production heap dump.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Real consumers with bounded aggregate profiling | Closes known workload gap without changing production | Synthetic queries and sampling overhead; recommended |
| Heap snapshots on the live service | Detailed retainer paths | Pause, memory and private-data risk; defer |
| Remove the first representative read now | Potentially saves more allocation | Consumer validation contract not yet established; defer |

Recommendation stack: complete the workload first; compare preparation/publication
and natural collection within complete cycles; then choose a narrowly tested
optimization from evidence. Do not tune memory safeguards to make the study pass.

## Parallel PR trial

Fresh open-PR enumeration found #555 and #556. Random selection chose server
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial its exact manifest/lock diff
locally and run the existing runtime compatibility gate first. Node 26 types
conflict with the deployed Node 24 contract; if rejected, restore the diff before
installation rather than broadening this round into a Node major upgrade.
