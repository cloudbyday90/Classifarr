# Comparison fingerprint allocation design

Reviewed: 2026-10-06. Scope: optional inventory comparison refresh, not a release.

## Evidence and goal

The reported `memory_pressure` warning followed representative-profile publication.
Read-only observation showed temporary heap growth during comparison refresh and
later natural reclamation, not proof of a leak. The 2 GiB container limit matters;
host free memory is not the container's available budget. Preserve admission,
headroom, retries, ownership and fresh-snapshot verification.

An isolated Node 24.21.0 allocation study used 5,771 synthetic descriptions,
10 libraries and 1,024-dimensional vectors. PostgreSQL supplied real vector text
through node-postgres; catalog/state metadata was synthetic. Two repository reads
and fingerprints reproduced approximately 127 MiB of sampled allocations in
`prepareSource`, whose vector loop calls `JSON.stringify` for every vector.
This is cumulative allocation, including collected objects, **not retained memory**.
The study excluded fitting workers, production data and provider requests.

## Decision

Replace vector JSON strings with one reusable, dimension-bounded binary buffer in
a small ESM module. Write each validated JavaScript number as little-endian
float64, then synchronously feed its bytes to SHA-256. Retain sorted description
hashes and all existing representation, membership, scope and holdout metadata.
Use a private encoding-version prefix to separate this format from the old key.

Float64 preserves distinctions between valid JavaScript values that float32 would
round together. Canonicalize negative zero to positive zero, matching JSON's old
equivalence. Reject invalid vectors before publishing a key. At 1,024 dimensions,
the scratch buffer is 8 KiB; the 16,000-dimension validation ceiling bounds it to
128,000 bytes. No vector copy or string is created per row. Existing ownership
copies remain mandatory before asynchronous fitting.

The fingerprint is a process-local cache identity, not a stored model format or
API contract. Restarting naturally rebuilds it; no schema migration, Compose
change, new dependency or public model-version change is required.

## Options and recommendation order

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Reusable binary fingerprint | Removes measured string churn; exact identity preserved | New internal encoding; requires equivalence tests | Implement first |
| Stream/decode vector rows in bounded batches | Could reduce remaining text and parsed-array overlap | Repository/transaction lifetime redesign; fresh-state checks must survive | Profile next |
| Move reads/fingerprinting to workers | Isolates main-thread heap churn | Structured cloning and external memory still count toward container usage | Defer pending evidence |
| Increase memory or weaken admission | May delay warnings | Does not remove allocations; can exhaust constrained NAS systems | Do not use as the fix |

## Verification and safety

- Test canonical order, exact-number changes, negative zero, last-component
  changes, malformed vectors, held-out exclusion and input non-mutation.
- Run existing cache, snapshot revalidation, refresh/backoff and ownership tests.
- Repeat the isolated study on the same image and limits. Compare sampled
  allocations separately from peak RSS; neither predicts whole-container peak.
- Rebuild local Compose without cache, preserve app-data and evaluate health,
  memory and refresh logs. Do not touch the separate Unraid installation.
- Export the authoritative schema from an isolated candidate-image database.
- Keep raw profiles out of Git; record aggregate results in the outcome document.

## Official research

- [Node Buffer](https://nodejs.org/api/buffer.html): explicit endian float64 writes
  avoid architecture-dependent byte order.
- [Node crypto](https://nodejs.org/api/crypto.html): incremental hash updates accept
  buffers, avoiding conversion to text.
- [DevTools protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json):
  sampling can include objects collected by minor and major GC. This distinction
  is essential when interpreting allocation totals.
- [node-postgres cursor](https://node-postgres.com/apis/cursor): bounded reads are
  an alternative to loading an entire result, but do not alone remove application
  retention or preserve this repository's transaction contract.
- [Node worker resource limits](https://nodejs.org/download/release/v24.20.0/docs/api/worker_threads.html):
  limits constrain the JS engine, not all external allocations.

The current documentation may describe newer Node releases. Only APIs available
and tested on the project's pinned Node 24.21.0 are used.
