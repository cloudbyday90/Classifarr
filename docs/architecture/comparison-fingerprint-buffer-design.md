# Reusable representative fingerprint buffer

Date: 2026-10-07. Allocation follow-up; no release or deployment-policy change.

## Evidence and decision

The preceding GC/residency study observed temporary allocations being collected
and pages later returned; it did not establish an enduring worker or cache leak.
The fingerprint encoder currently creates a buffer for every present vector.
Prototype one private, lazily allocated scratch buffer per fingerprint, retaining
the v4 byte protocol. Measure it before claiming an application-memory benefit.

## Contract

- Validate every vector with the existing validator before acquiring storage.
  Keep metadata, dimensions, float32, nonzero and sparse-array checks unchanged.
- Keep JSON metadata, ordering, missing markers, SHA-256, little-endian float32
  encoding and the v4 version unchanged. No persisted-key invalidation or backfill.
- Allocate zero-filled storage only for a present, valid vector. The existing
  dimension limit bounds a buffer to 64,000 bytes. Reuse only an exact-size buffer;
  fully overwrite it on every successful encoding. Use indexed writes, with the
  validated length captured for the operation.
- Borrow storage during synchronous encoding rather than expose it or share it
  globally. A reentrant append must receive different storage. Release the scratch
  reference on finish, including failure; do not retain vectors or snapshots in it.
- Missing vectors allocate nothing. Invalid input remains a permanent validation
  error, not a retryable success. Cancellation, worker lifetime, source revision,
  ownership fencing, transactions, admission and retry behavior stay unchanged.
  No fresh-install work, network calls, new jobs or production diagnostics.
- Test exact-byte differential cases, independent/interleaved instances, mutation,
  invalid input and bounded allocation. Run a fixed synthetic probe against both
  immutable images and a complete isolated catalog refresh study on the candidate.
  Never use a production heap snapshot or provider data.

## Official research and alternatives

Sources discovered through web search and read on 2026-10-07:

- [Node 24.21 Buffer documentation](https://nodejs.org/download/release/v24.21.0/docs/api/buffer.html)
  recommends an explicit import. `Buffer.alloc` initializes storage and avoids
  unsafe pooled contents; `writeFloatLE` provides explicit byte order. A private
  buffer prevents a small retained slice from holding an allocation pool.
- [Node 24.21 crypto documentation](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html)
  supports repeated Buffer updates and finalization through `digest`. Regression
  tests must verify that later scratch writes cannot change already-hashed data.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Per-fingerprint scratch | Eliminates repeated byte-storage allocation; small isolated change | Retains up to 64 KB until finish; needs exact-byte tests | Prototype and measure first |
| Global buffer or skipped validation | Less setup work | Cross-instance coupling or weaker validation | Reject |
| Typed-array raw bytes | Short encoder | Host byte order and coercion can change the protocol | Reject |
| Membership allocation refactor | Could reduce remaining short-lived objects | Different hot path; needs separate attribution | Next, only after measurement |

The scope is backend-only; it does not change a web interaction or accessibility
contract. Do not add UI changes merely to accompany this optimization.

## Verification and handoff

Keep the existing memory safeguards. A microbenchmark establishes local allocation
behavior, not whole-system peak RSS or a fix for Unraid. Separate sampled allocation
estimates, explicit buffer-byte counts, natural timings and full-catalog receipts.
Preserve a local database backup and rollback image before the no-cache rebuild;
dump/check schema only in disposable containers. Leave Unraid untouched.

Two PRs were open at enumeration; the random choice was
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial its exact Node-26 typings diff
locally against the Node-24 runtime gate; do not retain an incompatible change or
merge the PR. Record the outcome separately.
