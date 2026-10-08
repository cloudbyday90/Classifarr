# Exact normalized-cache comparison outcome

Date: 2026-10-07. See the separate
[design, sources and alternatives](vector-cache-allocation-design.md).

## Finding and change

Exact comparison of borrowed normalized arrays caused substantial temporary
allocation in the pinned runtime. Replacing the hot Object.is call with numeric
SameValue logic reduced that cost without weakening equality: signed zeros stay
distinct, NaN handling is preserved, and nonnumeric borrowed values never coerce.
Length and own-slot checks still precede comparison. The normalizer continues to
validate every input and detect mutation of both input and borrowed output.

The change stays in the existing small ESM arithmetic module. No validator,
WeakMap lifetime, cache key, division order, dimension limit, persistence format,
admission reserve, retry, ownership or GC change. No migration or backfill needed.
The shared-validator-only probe did not reproduce the large whole-refresh cost;
different callers and optimization histories remain an open question. That is
not proof that shared validation has no cost in production, nor a reason to
change it speculatively.

The recovery-change skill kept integrity and resource safeguards fixed; the
dependency skill stopped the incompatible PR trial; the release-evidence skill
kept source tests, image tests and remote CI distinct.

## Controlled image measurements

Each fresh non-root, read-only, network-disabled container had two CPUs, 2 GiB
and 128 PIDs. Fixed synthetic fixture: 5,776 vectors, 1,024 dimensions, 256
deterministic templates. Conditioning used 512 parsed or structured-cloned
vectors; measured inputs were identical parsed arrays. One warmup preceded six
measured passes. Three fresh processes per operation/history; all numerical
checks passed. No database, provider, live data, forced GC or raw heap profile.

Both runs imported actual image modules; only the synthetic probe was mounted.
The same fixed-label inspector summarizer included collected allocations.

| Six-pass cumulative sampled allocation | Previous image | Rebuilt image |
| --- | ---: | ---: |
| Exact matching only | 1,061.52–1,092.02 MiB | 0–1.00 MiB |
| Normalizer cache hits | 1,046.52–1,125.02 MiB | 0–33.50 MiB |
| Cache misses, unchanged control | 256.77–292.16 MiB | 265.71–279.21 MiB |

One clone-conditioned candidate hit run sampled 33.5 MiB; other hit runs sampled
at most 1 MiB. Do not round that variation away. Initial isolated shared-validator,
inventory-validator and norm probes sampled at most about 2 MiB. Matching and hit
baselines were repeated after finalizing the probe; the exploratory prototype is
not substituted for the actual rebuilt-image results.

These are statistical allocation estimates, not retained heap, peak RSS or an
application-wide RAM reduction. Zero samples does not mean zero allocation.
Inlining can attribute costs to the caller's `other` label; totals are the primary
comparison. Separate natural runs also passed, but timings varied with host and
schema-check load, so there is no controlled throughput or latency claim. Both
images contained the same 58 installed Alpine package/version entries.

Ignored receipt/probe SHA-256 values under `.tmp/`:

- `profile-vector-cache.mjs`: `4de99a0e7ba63ee87c7e35a28781cb565819edaa40502f091811a5fd43a94c2f`.
- `vector-cache-baseline-final.json`: `b815e6497108d47ff513c1663ccde044ecaf4d80e2208451e973f0b0b0763cfe`.
- `vector-cache-candidate.json`: `b7128a2cf797f8958f5557bdf352feec2d28637c461ea3cdd8d7fb6d8e000a4b`.
- `vector-cache-baseline-natural.json`: `cb5f3bbd706e0ccca9fc0067ee1e634234ad9aad2ef9e4eceb91dd66415eed7e`.
- `vector-cache-candidate-natural.json`: `9e61269880ed3d31fec303de57658a3c42c37677c8c2b105b46bbcc4d89d5196`.

## Source and schema verification

- Five focused suites / 102 tests passed. Differential coverage includes arbitrary
  numeric bit patterns, signed zeros, NaN, infinities, underflow/overflow results,
  malformed borrowed values, inherited holes, input mutation and repeated hits.
- Full backend: 1,747 suites / 54,273 tests passed in 370.683 seconds. One Linux
  filesystem test was skipped on Windows; the actual Linux image separately
  passed directory fsync, exclusive copy, existing-target refusal and unchanged
  source checks.
- Backend lint/typecheck, both Knip modes, copyright, static imports, Markdown
  and all 40 tooling tests passed. Ownership checks passed without changing the
  baseline; the existing 501 unresolved entries remain unresolved.
- No-cache Compose build passed, including the frontend production build.
  Isolated schema dump and independent check passed and cleaned up. Tracked schema
  unchanged, through `20261005_180000_ingestion_compatibility_fence.sql`, including
  22 seed migrations. No live database schema dump.

Frontend tests and the full database integration suite were not separately rerun
locally for this arithmetic-only change. Remote CI and the actual-image full
catalog rehearsal are separate evidence, not substitutes for those local claims.

## Random open PR trial

Fresh enumeration found two open PRs. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest and
lock changes locally: `@types/node` 24.19.1 to 26.6.4 and `undici-types` 7.24.6 to
8.9.0. MCP retrieved the patch; npm registry metadata verified dependency/integrity.

The runtime-major gate passed 8/8 before the trial, failed 1/8 with it, and passed
8/8 after explicit reversal. Node 26 declarations do not match the deployed Node
24 contract. No installation, retained dependency change, compatibility claim,
PR merge or closure. The user-requested trial was performed, not silently skipped.

## Image identity and rollback

Implementation source: `06ee48d1b23ceb7e2713b722f385c1024ebcada1`, pushed on `main`.
No-cache local image/index:
`sha256:d22706999bf1941f608b67329cb5272f8c3436dd403bae0d5954f9130de36512`.
OCI revision matches. Native manifest:
`sha256:cdb66161eee6dea9c076a2f84882160cc7f66ad7691e5e8f7c58eadf8ec9ee36`;
configuration: `sha256:d8387d152e126fe9ff300a76162913eb3a30e4ca434a2e791d5404c03e893cab`.
These are local image identities, not signed published-release provenance.
Later documentation commits do not replace this implementation identity.

Baseline image: `sha256:4fdcebdbcfff7918f7e13590075081e3bf610076d5866f1dd5a40e4e977d8cbc`.
Pinned before rebuilding. Immediately before local replacement, verified another
75,668,544-byte database archive by checksum and archive listing:
`.tmp/pre-memory-fingerprint-c2abc138-156c-493d-b43e-aa23d316c709.dump`.
Rollback tag: `classifarr:pre-memory-c2abc138-156c-493d-b43e-aa23d316c709`.
This is a database backup, not a complete appdata backup or restore rehearsal.

Local Compose was recreated at 00:48:50.003 UTC on October 8 (October 7 locally).
The running arithmetic module matches source SHA-256
`c513236cd34edaa82a3fb0bd1635395e744ae20e639f43b8f03ff9b3e39accde`.
User `1000:1000`, read-only root, no-new-privileges, capabilities, mounts,
1,536 MiB old-space cap and 2 GiB container limit remain unchanged. Nineteen
observations from 00:49:48.625 through 00:54:47.127 UTC were healthy, with no OOMs,
memory-limit hits or restarts. Raw usage ranged from 747.09 to 887.96 MiB; kernel
lifetime peak was 935.52 MiB. This active-local window is not a matched benchmark
or long-term leak test. Read-only diagnostics found metadata backfill active,
zero new error-log entries and no comparison memory warning since 18:04:45 UTC
before replacement. The diagnostic helper's own admission is not the daemon's
memory reading. Local workload completion is not claimed.

## Complete catalog rehearsal

Actual-image project `classifarr-resource-study-d2836132c2c98a3aa4c6b885c1fbdcc3`
passed in 1,044,833 ms (17.41 minutes), with the unchanged two-CPU, 2 GiB,
128-PID limits and synthetic/internal-network topology. Twenty waves and 210
scans completed all 5,776 import/metadata jobs across ten libraries. All vectors
were cached; pending, failed, service-error, routing and handoff counts were zero.
Twenty-nine refresh reads and one comparison build ran. All nine workers exited;
both consumers committed nine batches, stopped with zero pending work and dropped
their retained membership groups from 80 to zero.

Work drained at 621,518 ms. Comparison became ready at 663,489 ms and revalidated
at 997,522 ms. Representatives published at 686,841 ms and became up to date at
1,043,907 ms. Both elapsed warm intervals exceeded five minutes. Admission
deferred queue work for memory 33 times, then the workload completed. No discovery
memory refusal occurred, so `pressureRecoveryObserved` is correctly false: this
run does not demonstrate comparison recovery from a memory refusal.

Peak process RSS was 732.58 MiB, main heap 461.80 MiB, raw container usage
1,126.29 MiB and kernel high-water mark 1,130.91 MiB. These peaks need not occur
together and must not be added. No OOM kill or memory-limit hit.
This run is not a matched performance comparison
with the previous catalog: scheduling, overlap and build counts differ. Its 23
allocation windows still show other costs. Full build-control sampled 233.45 MiB,
including 138.36 MiB validation and 9.53 MiB normalization arithmetic. Community
building sampled 635.21 MiB. Warm representative preparation sampled 451.09 MiB,
including 115.81 MiB validation, reading/decoding 11,552 rows across two passes.
These estimates must not be treated as simultaneously retained memory.

This allocation-mode run did not repeat post-stop natural GC/residency profiling;
the earlier retention investigation remains separate evidence. All owned test
containers, volumes and networks were removed, independently confirmed by project
labels. No local appdata or Unraid resources were removed. Receipt SHA-256 values:

- `result.json`: `93a83d2545a8044b7a99177b069b8e9ece7c60ebcb3fd612a0127a14831c47b3`.
- `comparison-trace.json`: `ed7521c1862f951059982f83577c10c0c90d2fc2a3517e862ca44f244f5699ed`.

## Remote verification

For implementation `06ee48d1`, OSV, Trivy, CodeQL, Gitleaks, copyright and resource
capacity workflows passed. In
[CI run 37709190333](https://github.com/cloudbyday90/Classifarr/actions/runs/37709190333),
database integration and fresh-install/published-upgrade jobs passed. Build/test
and the acceptance readout also passed; the overall workflow completed
successfully. Release/published-image-only jobs were skipped, as expected for
this non-release commit; no published multi-platform image claim is made.
The later documentation commit triggers separate CI, without changing image
source. No release, version bump, new branch, PR merge or Unraid change.

## Recommendation stack

1. Retain the narrow numeric comparison: large measured allocation reduction,
   with exact semantic tests. Cost: a few explicit comparison branches that must
   remain covered when the runtime changes.
2. Keep validators, cache lifetime and memory admission unchanged. Preserving
   corruption detection is worth the remaining checks; sampling does not justify
   lower reserves or prove all retained memory is gone.
3. Resume compatible server dependency updates next, starting with dotenv
   18.0.5 to 18.0.6, then express-rate-limit 8.7.0 to 8.7.1 and js-yaml 5.4.2 to
   5.4.3 with individually reviewed release notes and regression tests. Fresh
   registry inventory confirms these candidates, not their compatibility. Keep
   Knip 6.40.0 and client bundler/test updates as separate tooling batches.
4. If pressure remains, reproduce shared-validator allocation in its actual
   representative/preparation caller history. The isolated caller did not show
   the same large cost; another validator rewrite needs stronger evidence. Full
   catalog sampling remains the integration diagnostic, not a controlled speed
   comparison or reason to change GC policy.
