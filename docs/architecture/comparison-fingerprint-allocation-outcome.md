# Comparison fingerprint allocation outcome

Date: 2026-10-06. Status: implementation validated in isolation; image evaluation
will be appended after the no-cache rebuild. No release is created.

## Measured result

The [design](comparison-fingerprint-allocation-design.md) addresses one confirmed
allocation hot spot, not every cause of container memory pressure. A new ESM
fingerprint helper replaces per-vector JSON serialization with one reusable
float64 little-endian buffer. Existing input, ownership and refresh safeguards
remain in place.

Two baseline and two candidate runs used the same published Linux image
`sha256:bdb21b21de8b4cdbac94d983094defbfb91c0d6d83bdf0a45db41a3ccc342d44`,
Node 24.21.0, a 2 GiB container limit, two CPUs, 64 PIDs, 1,536 MiB V8 old-space
limit and a private PostgreSQL cluster in 512 MiB tmpfs. Each ran two real vector
reads plus two fingerprints over 5,771 synthetic 1,024-dimensional vectors.

| Measurement | Baseline runs | Candidate runs |
| --- | --- | --- |
| `prepareSource` sampled self-allocation | 127.36 / 129.11 MiB | Below top-20 allocation sites |
| New binary helper sampled self-allocation | Not applicable | 6.78 / 7.73 MiB |
| Binary-write helper sampled allocation | Not applicable | 2.00 / 2.00 MiB |
| Node peak RSS, including stage observations | 319.37 / 321.80 MiB | 314.97 / 316.85 MiB |
| Final stage heap used | 197.37 / 199.15 MiB | 193.03 / 192.73 MiB |

Allocation sampling included objects collected by minor and major GC. These are
statistical cumulative allocations, **not retained heap or a leak measurement**.
Sorting and metadata processing still allocate. The limited peak RSS improvement
does not justify claiming that the warning is eliminated.

The study deliberately used read-only source mounts over the fixed image; it is
an allocation experiment, **not** candidate-image or release evidence. Metadata
queries returned synthetic catalog/state rows while vector reads used PostgreSQL
and node-postgres. No fit workers, provider calls, live data, credentials or open
debugger ports were involved. Containers were disposable and network-disabled;
only aggregate stage/profile summaries were exported to ignored `.tmp` files.

## Verification so far

- 13 focused backend suites / 145 tests passed, including exact identity, signed
  zero, sub-float32 differences, byte order, buffer reuse, invalid inputs,
  snapshot revalidation, holdouts and refresh behavior.
- Both repository snapshots generated the same key in all four isolated runs.
- The randomly selected [PR #555 trial](node-types-pr555-outcome.md) failed the
  existing Node-major compatibility gate. Its changes were restored, not merged
  or retained. Dependency manifests and lockfiles remain unchanged.

## Recommendation stack

1. Retain the bounded fingerprint change and unchanged admission safeguards.
2. Profile vector transport/decoding next: JSON decoding still accounted for
   roughly 89–93 MiB of sampled allocation, with additional PostgreSQL protocol
   and buffer-to-string allocations. Consider bounded batch decoding without
   extending the transaction's CPU lifetime or dropping fresh-snapshot checks.
3. Re-evaluate whole-refresh workers and scheduling only after that measurement.
   Do not increase memory limits or suppress warnings to hide the remaining work.
