# Build-local normalized vector reuse

Date: 2026-10-06. Follows [bounded decoding](comparison-vector-batches-outcome.md).

## Contract

Broad control, retained-mean validation and community discovery independently
allocate the same first-normalized vector. Reuse that result within one admitted
comparison build. Keep a small ESM factory with a private WeakMap keyed by the
source array, not a process-wide cache or a persisted hash. Every lookup still
validates the current input and recomputes its norm. Reuse a result only when
every component is exactly the freshly calculated value, including signed zero.
Changed input or changed cached output causes replacement, not a stale hit.
This saves arrays, not arithmetic, and introduces no skip-validation flag.

The build receives owned source copies before asynchronous fitting, as today.
Consumers borrow normalized arrays read-only; they do not mutate them. Returned
profile handles expose neither source nor normalized arrays. Do not freeze the
caller's arrays, normalize them in place, or alter their fingerprints. Sharing
does not cross builds or the worker boundary. WeakMap values cannot keep their
otherwise unreachable source keys alive; the factory leaves scope after fitting.

Keep graph normalization of first-normalized values unchanged: floating-point
normalization is not generally idempotent. Centroids, group order, validation,
scores and retrieval results must remain exact, not merely close. Standalone
control/community callers retain their default fresh-normalization behavior.

There is no new background work on empty/disabled installations, no migration,
provider request, deployment-template requirement or database write. Existing
admission, component/worker/cache bounds, timeouts, retry/backoff, model revision,
fresh verification and completion conditions stay unchanged. Invalid mandatory
data fails closed; optional discovery still degrades with sanitized categories.
Cancellation and crashes discard this build-local state; retries start fresh.

## Options and verification

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Validated build-local reuse | Avoid duplicate arrays; preserve exact results | Retains validation/arithmetic and a small WeakMap; implement and measure |
| Trust a normalized flag | Avoid more CPU work | Can accept stale/corrupt data and change graph rounding; reject |
| Freeze all source/output arrays | Runtime mutation refusal | Alters array representation and caller contracts; not needed for private read-only consumers |
| Packed transferable worker input | May reduce structured-clone cost | New buffer ownership protocol; separate follow-up |

Test exact components, signed zero, mutation, malformed/sparse/nonfinite/zero
vectors, dimensions, separate factory lifetimes and unchanged caller data.
Compare shared versus independent control/community results and retrieval with
non-unit vectors, plus cancellation and optional failure. Repeat isolated image
profiling with the existing synthetic corpus and resource bounds; distinguish
collected controls from natural elapsed cycles. Do not claim lower overall peaks
or solved memory pressure solely from fewer arrays. Rebuild local Compose without
cache after a private backup, and dump/check schema in isolated databases only.

## Official research

Discovered and opened through MCP on October 6, 2026:

- [Node memory usage](https://nodejs.org/api/process.html): RSS covers the process;
  worker heap readings are thread-local. Stable heap does not promise low RSS.
- [Node worker threads](https://github.com/nodejs/node/blob/main/doc/api/worker_threads.md):
  worker data is structured-cloned; engine limits are not a global OOM guarantee.
- [ECMA-262](https://ecma-international.org/publications-and-standards/standards/ecma-262/):
  language-standard reference; use exact JavaScript numerical/identity behavior,
  not an assumed mathematical idempotence. Linked full-spec retrieval was
  unavailable in this session; regression tests must establish our exact contract.

Record measured results and the next recommendation in a separate outcome.
