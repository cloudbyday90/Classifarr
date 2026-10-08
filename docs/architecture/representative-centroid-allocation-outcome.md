# Representative centroid allocation outcome

Date: 2026-10-07. See the separate
[design, official sources and tradeoffs](representative-centroid-allocation-design.md).

## Finding and change

The large temporary allocation attributed to membership validation was primarily
the default normalization path's throwaway vector arrays, not partition checking.
An addition-loop-only prototype did not reduce allocation. The retained change
uses a small ESM accumulator to validate each raw vector, compute the existing
norm, and add each divided component directly to the private centroid sum.

Division, accumulation order and double precision are unchanged. Custom injected
normalizers still run and their returned vectors remain authoritative. No shared
scratch state, new cache, profile-version change or backfill. Membership, centroid
tolerance, batch bounds, cancellation and publication checks remain. The existing
profiler attributes the extracted helper to the same membership category.

The recovery-change skill kept safety boundaries fixed; dependency-update stopped
an incompatible PR trial; release-evidence kept source, image and CI claims
separate. Production memory limits, admission reserves and GC policy did not change.

## Controlled synthetic probe

Fixed corpus: 5,776 vectors, 1,024 dimensions, ten groups, 256 deterministic
sine/cosine templates, alternating parsed and structured-cloned arrays. Fixtures
and reference centroids were prepared outside measurement, followed by one warmup.
Each fresh container measured six cycles; three containers per operation/mode.
Natural and allocation-sampled runs were separate. Containers were network-disabled,
read-only, non-root, capability-free, limited to two CPUs, 2 GiB and 128 PIDs.
No providers, database, production data, remote inspector or forced GC.

Both image runs imported their actual runtime modules, not source overlays.
Every validation cycle asserted membership equality against the fixture. The
probe used the existing bounded, fixed-label heap summarizer, including collected
allocations; no raw profile was saved. Both images contained the same 58 installed
Alpine package/version entries.

| Six-cycle sampled heap estimate | Baseline image | Rebuilt image |
| --- | ---: | ---: |
| Partition checks only | 6.25–8.20 MiB | 4.19–7.66 MiB |
| Normalization only, unchanged control | 249.43–276.13 MiB | 271.09–282.20 MiB |
| Full-map centroid validation | 276.59–293.23 MiB | 7.02–13.02 MiB |
| Streamed centroid validation | 275.57–294.23 MiB | 8.51–11.52 MiB |
| Addition-loop-only prototype, unchanged control | 273.10–303.81 MiB | 284.18–290.72 MiB |

The default path no longer constructs 5,776 normalized arrays per fixture pass.
That avoids 5,914,624 temporary numeric slots; their exact V8 allocation layout is
not asserted. Sampling supports the allocation reduction, but is not an exact byte
counter or proof of a whole-application RSS reduction. Natural timings overlapped
and varied with shared-host load; no speedup claim. The candidate probe overlapped
early catalog/schema work, so timing comparisons are particularly unsuitable.

Ignored receipts and probe are under `.tmp/`. SHA-256:

- `membership-allocation-baseline.json`: `51dd7188de2f3f506e4b3ca5c96b9ca5bf501384e7079689dcfc2ef5aad34d72`.
- `membership-allocation-fused.json` (pre-implementation prototype): `0676d42176fe0696ba194f4f229274613f8a8f6b27adf12fc786f40c4a4f0e85`.
- `membership-allocation-candidate.json`: `d11db37d587291a9f6d4757d49eaa3783e6c957e899ba3d6744a21d97bd06db4`.
- `profile-representative-membership.mjs` (final probe, adds the separate fused
  experiment without changing baseline operations): `bad88129a8923d107f166e8c5eda674d707fd9fbfc0a69b7e757c8defa33d0ff`.

## Verification

- Four focused suites / 109 tests passed, including the profiler mapping.
- Full backend run: 1,747 suites / 54,270 tests passed in 358.495 seconds.
  One Linux filesystem test was skipped on Windows; the actual Linux image
  separately passed directory fsync, exclusive copy, existing-target refusal
  and unchanged-source checks.
- Exact arithmetic regression coverage includes dimensions 1–16,000, extreme
  float32-valid scales, signed zero, cancellation, malformed/inherited input,
  caller mutation, custom normalizers and centroid tolerance boundaries.
- Backend lint/typecheck, both Knip modes, copyright, ownership, Markdown and
  static imports passed. All 40 tooling tests passed. The existing 501 unresolved
  ownership entries remain unresolved; no baseline was changed or broadened.
- No-cache Compose build passed. Disposable schema dump and independent check
  passed and cleaned up; tracked schema unchanged, through
  `20261005_180000_ingestion_compatibility_fence.sql`, with 22 seed migrations.

Client build ran inside Docker. Client tests and the database integration suite
were not separately rerun locally for this arithmetic-only change; exact-source
remote CI and actual-image catalog results are recorded separately below.

## Random open PR trial

Fresh enumeration found two open PRs; random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest/lockfile
change locally: `@types/node` 24.19.1 to 26.6.4, `undici-types` 7.24.6 to 8.9.0.
The npm registry confirmed the new Node declarations' dependency and integrity.

The runtime-major gate passed 8/8 before application, failed 1/8 with the PR,
and passed 8/8 after the explicit revert. Node 26 declarations are not the chosen
Node 24 runtime contract. No package installation or functional compatibility
claim; no retained dependency change, weakened gate, PR merge or PR closure.

## Exact image and local replacement

Implementation: `c29a1fe1f355a01272ac1bde70c447a161959909`, pushed on `main`.
Local no-cache image/index:
`sha256:4fdcebdbcfff7918f7e13590075081e3bf610076d5866f1dd5a40e4e977d8cbc`.
OCI revision matches; native manifest:
`sha256:cfd05b387221f557fda8763895e241206cdc39a6546d808392c4e5a9070b07a4`;
configuration:
`sha256:d0cad70aac2b5060858e030dbd9f61154d32b620d08ea7c1f578764d716e52f9`.
These are local identities, not a published release or signed provenance. Later
documentation commits are not substituted for the implementation's image source.

Baseline image:
`sha256:8f89417808cebaacbe1fedb21f5ed44b5a181ccf79b50f1c5248385823504ccc`.
Pinned it before replacing its tag and verified a database archive. Immediately
before local recreation, verified a fresh 75,649,611-byte archive by checksum and
archive listing: `.tmp/pre-memory-fingerprint-ff527bef-3dce-4003-ab32-94886f95021e.dump`.
Exact rollback tag: `classifarr:pre-memory-ff527bef-3dce-4003-ab32-94886f95021e`.
This is a database backup, not full appdata backup or restore rehearsal.

Local Compose was recreated at 23:54:08.495 UTC. Its health endpoint reported a
connected database. User `1000:1000`, read-only root, no-new-privileges, capability
restrictions, mounts, 1,536 MiB old-space cap and 2 GiB container limit remain.
The running accumulator matches the source SHA-256:
`f5693def8022af91c13ee63d4f2371d77520deca30dc0d270d40a7bd3422c4ee`.
Read-only diagnostics showed inventory background readiness `ready`; the latest
stored comparison memory warning was still 18:04:45 UTC, before replacement.
The diagnostic helper's own memory admission is not the web daemon's reading.

Nineteen local observations from 23:55:22.743 through 00:00:20.331 UTC remained
healthy, with no OOMs, memory-limit hits or restarts. Raw container usage ranged
from 842.65 to 893.95 MiB; lifetime kernel peak was 950.94 MiB. This active-local
window is not a matched benchmark or long-term leak test. A read-only count found
no new error-log entries after recreation. Unraid remains untouched. No release,
version bump, new branch or PR merge.

## Complete catalog rehearsal

The exact-image allocation-window rehearsal passed in isolated project
`classifarr-resource-study-87d5b449b22713cab0b215cb9aaf312a`, using synthetic data,
internal networking, two CPUs, 2 GiB and 128 PIDs. It ran for 1,158,954 ms
(19.32 minutes). Twenty waves and 177 scans completed all 5,776 import/metadata
jobs across ten libraries. All description vectors were cached; pending, failed,
service-error, routing and handoff counts were zero. Thirty-two refresh reads and
six builds ran. All thirteen workers exited. Each consumer committed three
batches and stopped with zero pending work or retained membership groups. Source
changes correctly invalidated earlier attempts rather than publishing stale data.

Workload drained at 621,457 ms. Representatives published at 785,478 ms and became
up to date at 1,145,715 ms; comparison became ready at 841,313 ms and revalidated
at 1,158,582 ms. Both warm intervals exceeded five minutes. The unchanged admission
system deferred ingestion 33 times, queue work 53 times and discovery three times.
Unlike the preceding run, this run observed comparison memory refusal followed
by successful publication and warm revalidation: `pressureRecoveryObserved: true`.

Peak process RSS was 781.31 MiB, main heap 608.36 MiB, raw container usage
1,163.03 MiB and kernel high-water mark 1,176.98 MiB. These peaks need not occur
together and must not be added. No OOM kill or memory-limit hit. This sampled run
is not a matched performance comparison with the prior unsampled catalog run;
admission, timing, work counts and observer overhead differ.

Allocation windows show the remaining work rather than proving all memory issues
fixed. Post-drain representative preparation read/decoded 11,552 rows (two passes)
and sampled 475.85 MiB total: database transport 126.28 MiB, shared vector validation
109.82 MiB, and membership 34.09 MiB. A separate build-control window still sampled
133.51 MiB under membership while using the preserved cached/custom normalizer.
The full community-build window sampled 1,033.93 MiB spread across graph, partition,
centroid and normalization work. These are cumulative statistical estimates,
not simultaneously retained data. The small isolated default-path result must not
be extrapolated to these different paths.

This run did not repeat the natural post-stop GC/residency experiment: allocation
sampling and that observation are deliberately separate modes. The earlier
retention findings remain separate evidence. All owned study containers, volumes
and networks were removed; independent project-label checks found none remaining.
No local appdata or Unraid resources were removed. Ignored receipt SHA-256 values:

- `result.json`: `4aab90b8cd0921bf7e78c60462257672767b5ab0f46e57c028759224ace0fab7`.
- `comparison-trace.json`: `f3421557e73fcc72a0659e1dd5becc153dd990e45f6e4cd258ea5e17ff3a996d`.

## Remote verification

For implementation source `c29a1fe1`, OSV, Trivy, CodeQL, Gitleaks, copyright and
resource-capacity workflows passed. In
[CI run 37704696427](https://github.com/cloudbyday90/Classifarr/actions/runs/37704696427),
database integration and fresh-install/published-upgrade jobs passed. Build/test
and its downstream acceptance checks are still in progress at this checkpoint;
local image success is not substituted for those remote results. The later
documentation-only commit starts separate CI and does not change the image source.

## Recommendation stack

1. Retain the fused default accumulator: removes measured temporary arrays with
   exact numerical regression coverage. Cost: one small arithmetic module and a
   branch preserving the existing injected-normalizer contract.
2. Keep validation, memory admission and GC policy unchanged. Allocation reduction
   does not prove that reserves can be reduced or every retained object is gone.
3. Next isolate the shared validator and cached-normalizer path, using the new
   warm-preparation/build-control measurements as the baseline. Measure optimizer
   input history and required arrays separately before another refactor. This can
   target frequent refresh work, but costs another controlled investigation. Do
   not remove exact revalidation or blindly fuse cached/custom normalization;
   those consumers use the normalized arrays themselves.
4. Resume compatible dependency updates as a separate bounded batch. Fresh npm
   registry inventory found dotenv 18.0.5 to 18.0.6, express-rate-limit 8.7.0 to
   8.7.1, js-yaml 5.4.2 to 5.4.3, and Knip 6.39.0 to 6.40.0. These are candidates,
   not installed or compatibility-tested updates. Review upstream changes and
   validate individually. Rejecting Node-26 declarations does not justify changing
   the runtime major in this fix.
