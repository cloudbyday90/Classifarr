# Streamed representative-profile verification

## Decision — 2026-10-07

Replace only the second full vector read with a bounded exact fingerprint read.
The preceding [catalog study](comparison-cache-hit-outcome.md) sampled roughly
307 MiB of main heap at each of two unchanged representative reads. Source review
confirms both materialize the complete vector map. This is avoidable allocation,
not proof of a leak or a promised RSS reduction.

The first read remains: fitting, pending shadow comparisons and neighborhood
membership validation consume actual vectors. Their staged commits need only
fresh corpus, novelty identities and observation-readiness metadata. Removing
the second map therefore needs no changes to their contracts or backfill policy.

## Contract

- Add a distinct repository `readRepresentativeVerification` method; do not reuse
  comparison verification, which requires complete vector coverage and uses a
  different fingerprint format.
- Preserve the existing representative v4 digest byte-for-byte: configuration,
  representation, sorted libraries/documents, sorted hashes, presence bits and
  every present vector's validated float32 values. Missing vectors are evidence,
  not an error; corrupt present vectors still fail, including unused ones.
- Read metadata and batches in one bounded read-only repeatable-read transaction.
  At most 256 vectors or 262,144 components per batch; release encoded/decoded
  batches before yielding and the next query. Return no vectors or vector map.
- The second transaction remains independent of the fitting read. Check its
  digest, provider identity, configuration/busy/revision state, cancellation and
  final admission before publishing or committing either optional sidecar.
- Retain fresh novelty and observation-readiness metadata even when the vector
  digest is unchanged. Do not infer current metadata from the cached model.
- Preserve single-flight, 120-second attempt deadline, transaction/statement/lock
  limits, cache budget/TTL, partial-coverage threshold, retry/backoff and shutdown
  behavior. No additional attempts, fallback reads or durable state.

Disabled, unsupported, busy, empty and insufficient-coverage paths remain no-ops
for fitting/publication as before. Source drift returns `invalidated`; failures
retain sanitized diagnostics/backoff; cancellation cannot publish. Restart starts
cold. No schema, provider-write, API, UI, deployment or memory-safeguard changes.

## Official research

Retrieved through search and opened on 2026-10-07:

- PostgreSQL repeatable read keeps successive queries on one snapshot. A separate
  transaction is necessary to observe intervening committed changes; streamed
  batches must not each get a different snapshot.
  [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
- Node's diagnostics guide recommends understanding collection and bounding
  accumulated data. Apply bounded processing here and measure complete cycles;
  do not force production GC or interpret RSS alone as retained JavaScript.
  [GC tracing](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-gc-traces.md).

## Options and recommendation stack

1. **Stream the second read — selected.** Removes one full map on cold and warm
   refreshes without changing sidecar preparation. Still decodes every vector and
   retains bounded corpus metadata; the first full map remains.
2. **Stream both warm reads — defer.** Potentially saves more allocation, but needs
   a separate vector-dependent shadow/membership contract. Avoid broadening this
   change before measuring the narrower result.
3. **Keep two full reads.** Simple, but repeats known unnecessary allocation.
4. **Skip freshness checks or relax admission — reject.** Reduces work at the cost
   of correctness or memory safety.

## Verification plan

Regressions first: exact full/stream digest equivalence, partial/empty coverage,
invalid vectors, bounds, cancellation and sidecar metadata. Retain race, provider,
revision, TTL and admission tests. Use real PostgreSQL for batch consistency and
committed changes between reads. Run the same bounded catalog cycle with natural
GC, rebuild local Compose without cache, and dump/check the isolated schema.
Document measurements and limitations separately. Unraid remains untouched.

The ownership gate's repository-source digest requires a reviewed update: this
patch adds a read-only verification mode, with no SQL mutation, relation-scope,
transaction-isolation or ownership change. Keep its analysis digest and existing
`comparison_cache_readiness` classification unchanged; do not regenerate other
entries or claim unresolved legacy writers are now compatible.

## Separate PR trial

Fresh enumeration found #555 and #556. Random selection chose
[client declarations #555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. Apply the exact manifest/lock diff
locally and test the existing runtime-major gate. Do not retain Node 26 types on
Node 24 if incompatible, weaken the gate, or merge the PR.
