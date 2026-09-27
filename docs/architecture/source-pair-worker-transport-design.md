# Lossless source-pair worker transport

## Diagnosis and scope

The reported `automatic-source-pair-evaluation` failure on 2026-09-27 had durable
reason `evidence_budget`, which the scheduler hid behind a generic error. A
read-only capture reproduced a 71,783,683-byte serialized worker payload against
the existing 67,108,864-byte limit. Its 6,658 cached 1,024-dimensional vectors
accounted for 61,846,168 bytes. Snapshot reading itself succeeded. This is a
transport-size failure, not a provider outage or proof of evaluation correctness.

## Selected change

Transfer numeric vector arrays in newly owned Float64Array **chunks**, with one
frame in flight and an acknowledgement before sending the next. Reconstruct
ordinary arrays inside the offline worker. Both automatic replay
and quality-study workers receive this representation; quality collection may run
before automatic replay and shares the same input limit. Keep all documents,
vectors, identities, cohort selection, fingerprints, and model values unchanged.

Do not use Float32Array: that could round values and change evaluation. Do not
raise worker heap limits. Replace the accidental whole-corpus wire-size ceiling
with separate limits: 64 MiB for the non-vector envelope, 1 MiB per vector frame,
one unacknowledged frame, and the existing 20-million-value corpus budget (up to
10,000 cached vectors, dimensions 1–16,000). This deliberately changes what the
64 MiB admission check measures; it does not claim the assembled snapshot is below
64 MiB or that worker heap limits cover total RSS. Preflight vector dimensions,
finite numeric values, entry count and total values before allocation. Transfer only newly allocated
buffers, never caller-owned memory. Retain timeout, cancellation, worker joining,
database prohibition, admission locks, retry backoff, and zero routing authority.
Validate sequence numbers, cumulative acknowledgements, exact manifest membership,
duplicate/missing vectors, and completion before accepting any evaluation result.
The producer follows receiver capacity without changing the experiment. The
current caller still holds a bounded complete snapshot; this is not unbounded
database streaming or a claim to support arbitrarily large libraries.

Preserve only allowlisted failure reasons in scheduler errors. Never report raw
worker exceptions, vector values, provider responses, credentials, or titles.

## Official guidance and tradeoffs

Research checked 2026-09-27:

- [Node 24 worker threads](https://nodejs.org/download/release/v24.20.0/docs/api/worker_threads.html) describes
  structured cloning, typed-array backing buffers, transfer detachment and worker
  resource limits. New owned buffers avoid detaching caller state. Application
  byte limits remain necessary; worker heap limits are not total-process limits.
- [Node stream backpressure](https://nodejs.org/api/stream.html) explains stopping
  production until the consumer is ready. Apply the same mechanism through
  explicit MessagePort credits; no unbounded pending-write queue, dropped frames,
  or newer Node iterable-stream dependency is needed on the pinned Node 24.18.1.
- [AWS retry/backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  distinguishes transient failures from non-transient failures and requires
  idempotency. Keep safe scheduled rechecks, but do not treat retrying unchanged
  oversized evidence or a missing provider identity as a repair. Persistent
  diagnostic/checkpoint improvements are a follow-up, not a new routing authority.
- [Node V8 serialization](https://nodejs.org/download/release/v24.12.0/docs/api/v8.html)
  supports structured-clone-compatible values; serialized size is a conservative
  application admission measure, not an exact resident-memory estimate.

| Approach | Benefit | Drawback |
| --- | --- | --- |
| Raise the limit | Smallest code change | Increases memory exposure; does not remove avoidable serialization overhead |
| Reduce sample/corpus | Smaller input | Changes the experiment and can bias library coverage |
| Single packed Float64 payload | Same values; smaller payload | Only about 2.2 MB headroom for this incident; rejected as the final design |
| Acknowledged Float64 chunks (selected) | Same full evidence; bounded transfer allocation; grows by adding frames | Protocol complexity; full scoring snapshot remains bounded in memory |
| Stream database/training partitions | Scales beyond the current corpus budget | Requires a separate consistent-snapshot and training/evaluation design |

Recommendation stack: current admission control + lossless ESM transport +
acknowledged owned-buffer frames + explicit envelope/corpus/heap limits + existing
offline evaluators + bounded reason codes. Follow up with checkpointed,
consistent-snapshot partitioning, not repeated limit increases, when growth
approaches the existing corpus budget.

## Validation

Require exact numeric round-trip (including signed zero), unchanged caller data,
unchanged fingerprints/results, true worker transfer tests, malformed/oversized
input rejection, quality-worker regression tests, and secret-free scheduler errors.
Measure the reported installation's payload through read-only diagnostics; no
automatic inference, routing, identity rematching, or live database writes.
