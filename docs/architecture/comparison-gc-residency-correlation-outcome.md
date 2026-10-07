# Comparison GC and residency correlation outcome

Date: 2026-10-07. See the separate
[design, official sources and tradeoffs](comparison-gc-residency-correlation-design.md).

## Change and validation

Added a small ESM host-side analyzer and the opt-in
`--comparison-catalog-gc-residency` study mode. It combines the existing natural-GC
and quiet-mapping observers, without adding another runtime observer. Four
adjacent quiet intervals report memory/mapping deltas alongside major-collection
counts and rounded local page-pool readings. Missing evidence, ambiguous sources
or mismatched output brackets cannot become a successful attribution. No event
means an unknown pool reading, not an empty pool.

Production services, memory admission, worker/cache policies, schema and deployment
templates are unchanged. No forced GC, allocator flags, artificial pressure, live
heap dump or remote inspector was added. The recovery-change skill kept the work
diagnostic-first; dependency-update preserved the runtime-major boundary; release
evidence kept source, local-image and remote checks distinct.

- Focused validation: 119 tests across four suites passed. Cases cover privacy,
  unavailable/invalid evidence, timing/source ambiguity, interval deltas and the
  combined launcher/save path.
- Full backend unit run: 1,745 suites / 54,188 tests passed in 325.677 seconds.
  One Linux-specific case was skipped on Windows. The actual rebuilt Linux image
  separately passed directory-fsync, exclusive-copy, existing-target refusal and
  unchanged-source assertions in a non-root, read-only, network-disabled container.
- Backend lint/typecheck, copyright, static imports, both Knip modes, ownership
  gate and Markdown checks passed. Only the two changed diagnostic launchers'
  reviewed source digests/rationale changed; 501 unresolved ownership entries
  remain unresolved.
- All 40 tooling/install-policy tests passed through the canonical npm script.
  An initial direct Node invocation lacked npm's required execution context and
  failed three installer-policy cases; the correct npm invocation passed.
- No-cache Compose build passed. Schema dump and independent verification passed
  in separate disposable image containers and cleaned up. The tracked schema is
  unchanged, through `20261005_180000_ingestion_compatibility_fence.sql`, including
  22 seed migrations. No local application database generated the snapshot.

The client test suite and full PostgreSQL integration suite were not rerun locally
for this host-side diagnostic change. The image build compiled the frontend;
remote checks are reported separately below.

## Random open PR trial

Fresh enumeration found two open PRs. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest/lockfile
diff locally: Node declarations 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0.
Registry version/dependency/integrity metadata matched. The existing runtime-major
gate passed 8/8 before, failed 1/8 during the trial, then passed 8/8 after reverting.

Newer declarations are useful only when they match the shipped runtime. Here they
permit Node-26 APIs against Node 24, so the recommendation is to retain Node-24
types. No installation, retained dependency change, merge or gate weakening is
claimed. Fresh outdated checks also identified PostCSS 8.5.29, Vite 8.3.3,
Playwright 1.64 and Vue Router 5.4 candidates; review these separately. Outdated
does not establish a vulnerability.

## Exact artifact and observation

Implementation source: `ccf5fd7c9115361e3aa4c69ff4b8e644f32adf03`, pushed on `main`.
The clean no-cache build produced local image/index ID
`sha256:ac9876b98d81669a524fc6b309a0e647b71e2f73d2dc2435df2cb67e5314f9d9`.
Its OCI revision matches. Native manifest:
`sha256:fce7ac04a24f9e7b8d2388840a817c77a230407d10d6a0ee0a48e5af8d8d283a`;
configuration:
`sha256:3a50d088073d900c682205c615ed06e8323990f524dbbdd16d459f3365b1b728`.
These are local build identities, not a published release. Later Markdown-only
evidence updates do not relabel this image as their commit.

The combined observation uses owned project
`classifarr-resource-study-56f2de5ca85975a7a9c0345fb5708295`, synthetic catalog/data,
internal networking, two CPUs, 2 GiB and 128 PIDs. No allocation sampling or
production-provider credentials. Schema checks ran separately during its early
load phase; no matched performance-improvement claim is intended.

The run completed in 1,481,523 ms (24.69 minutes); workload completion took
1,275,163 ms. Twenty waves and 201 scans completed all 5,776 items across ten
libraries, with every description vector cached. Pending, failed, service-error,
routing and handoff counts were zero. Twenty-four refresh reads and four builds
ran; all nine workers exited. Both consumers stopped with zero pending work and
zero retained groups, after six committed batches each.

Existing admission deferred ingestion nine times, queue work 54 times and
discovery three times. The discovery refusals were representative work, not
comparison attempts, so `pressureRecoveryObserved: false` remains correct for
the comparison-recovery contract. Comparison became ready at 788,284 ms and
revalidated at 1,107,912 ms. Representatives published at 915,778 ms and became
up to date at 1,275,031 ms. Both warm intervals exceeded five minutes.

Peak process RSS was 876.55 MiB, main heap 686.12 MiB and raw container usage
1,261.01 MiB; the kernel high-water mark was 1,269.71 MiB. These are separate
peaks, not simultaneous components to add. No OOM kill, memory-limit or PID-limit
hit occurred. Cleanup passed; independent project-label inventories confirmed
no remaining containers, networks or volumes. Only disposable synthetic data
was removed, not live appdata.

### Finding: V8 local page-pool release accompanies the late RSS drop

A natural main-thread major GC occurred 85.829 seconds into post-stop observation.
All eight remaining sampled weak-reference registrations became collectible;
workers were already gone. Sampled heap fell from 243.18 to 39.58 MiB. This first
collection was not memory-reducing: its text trace still reported a **426 MiB
local page pool** after collection.

The five quiet samples below span 120,204 ms. Offsets are rounded from the first
sample; sizes are MiB. No workers restarted or admissions resumed.

| Quiet offset (seconds) | Process RSS | Main heap used | Writable anonymous RSS | Small writable mapping count |
| --- | ---: | ---: | ---: | ---: |
| 0 | 591.00 | 41.00 | 521.85 | 2,030 |
| 30 | 591.19 | 40.15 | 521.92 | 2,030 |
| 60 | 591.48 | 40.39 | 521.93 | 2,030 |
| 90 | 591.36 | 40.46 | 522.04 | 2,029 |
| 120 | 143.86 | 40.02 | 74.47 | 255 |

The first three intervals contain no major-GC record; their pool readings remain
null, not zero. The last interval contains one natural **memory-reducing** major
collection. In the same GC source's own clock it followed the first collection
by 104.111 seconds, emptied the reported pool to zero, and reduced live objects
only from 40.1 to 39.5 MiB. Its reported pause was 52.17 ms. It is bracketed by
the 90- and 120-second observations, where RSS fell 447.50 MiB and writable
anonymous RSS fell 447.57 MiB. Small writable mappings (virtual size greater than
64 KiB and at most 1 MiB) lost 1,774 mappings and 443.70 MiB resident memory.

This strongly supports delayed V8 page-pool reclamation as a substantial cause
of this run's post-stop RSS, rather than continued retention of the sampled
application objects. The pinned
[major-GC implementation](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/heap.cc)
explicitly releases pooled chunks for memory-reducing collections. That mechanism
and the observed 426-to-zero pool transition support the attribution; mapping
sizes alone do not identify an allocator. Timing similarity to the reducer's
watchdog does not prove which condition triggered this event.

All 132 GC events parsed successfully, with ten anonymized source tokens, no
rejected/truncated events and no clock resets. Correlation uses output-order
brackets, not subtraction of unrelated study/isolate clocks. Pool readings are
rounded and local to one isolate, not all process pools. Mapping/cgroup reads
are non-atomic, tracing affects timing, and the observer allocates bounded data.
This does not attribute every byte, rule out every leak, diagnose Unraid, or
establish a production memory improvement. Pooled pages consume real memory;
never subtract them from admission accounting.

Sanitized receipts remain ignored under this project's `.tmp/resource-study/`
directory. SHA-256 values:

- `result.json`: `cb1da166452f9be2d18cfef3de816ff3b9bee4e7799cd64608c56c32bab88d13`.
- `comparison-trace.json` (170 rows): `96266f7aeaf9040fb60482347a891aac8aaea5c01d23d5f4a0a553060f1aa5ff`.
- `comparison-gc-trace.json`: `0b274d9918bad53a44f6bfb88367883646a2f7a534783ed6954e37d7657b3d36`.

## Local Compose and remote evidence

Before overwriting the build tag, pinned the exact old running image
`sha256:7d3e1a8e1331eeadba5290dc577f0d367de6c7579f2644b362bb91fe2662d8b6`
as `classifarr:pre-memory-7eacebc5-3d80-42b8-84b6-b00ef790dc71`.
The 75,626,770-byte database archive
`.tmp/pre-memory-fingerprint-7eacebc5-3d80-42b8-84b6-b00ef790dc71.dump`
passed checksum and archive-list verification. Immediately before replacement, a
fresh 75,621,750-byte backup passed the same checks:
`.tmp/pre-memory-fingerprint-dd251cd1-6f38-4ea8-8d91-2f3ac144b220.dump`, with exact
rollback tag `classifarr:pre-memory-dd251cd1-6f38-4ea8-8d91-2f3ac144b220`.
These are not full app-data backups or restore rehearsals.

Only local Classifarr was recreated from the measured image at 22:14:22.939 UTC.
User `1000:1000`, read-only root, no-new-privileges, capability restrictions,
existing appdata/media mounts, heap cap and 2 GiB limit remain. Its health endpoint
reported a connected database. Nineteen observations from 22:14:53.991 through
22:19:48.911 UTC stayed healthy, with zero OOMs or limit hits; final restart count
was zero. Raw container usage ranged from 309.58 to 665.49 MiB; the lifetime
kernel peak was 772.62 MiB. This active installation is separate from the stopped
synthetic workload and is not a matched performance benchmark.

Read-only diagnostics changed from `ready` to `backfilling` as background work
resumed. The newest stored comparison warning remained 18:04:45 UTC, before
replacement. A post-restart log reported waiting for other background work,
not a new memory warning. Do not claim that all backfill finished or that this
short check diagnoses Unraid. The diagnostic helper's own memory-admission
reading is not the web daemon's memory measurement.

Source [CI run 37694384327](https://github.com/cloudbyday90/Classifarr/actions/runs/37694384327)
completed successfully, including build/test, database, fresh-install/upgrade
and acceptance-readout jobs. OSV, Trivy, CodeQL, Gitleaks, copyright and resource-capacity
workflows passed for the exact implementation source. The preceding
[documentation run](https://github.com/cloudbyday90/Classifarr/actions/runs/37691287007)
also completed successfully; it is not substituted for the current run.
No release, version bump, PR merge, new branch or Unraid mutation.

## Recommendation stack

Follow-up: the [fingerprint-buffer outcome](comparison-fingerprint-buffer-outcome.md)
records the implemented prototype, exact-hash checks and separate image measurements.

1. Keep memory admission and runtime GC policy unchanged. The benefit is genuine
   protection while pooled pages still occupy RAM; the tradeoff is that optional
   work can defer until natural reclamation. Forced GC or discounting pools would
   change latency/safety without a demonstrated need.
2. Next prototype a reusable per-fingerprint scratch buffer and indexed writes in
   `inventoryRepresentativeFingerprint.mjs`. The current implementation allocates
   one buffer per vector. Preserve the exact v4 byte format, validation, partial
   coverage, cancellation and independent freshness reads. Benefit: targets an
   existing temporary-allocation source; risk: altered hashes or lifecycle errors.
   Require differential exact-hash tests and matched allocation/whole-refresh
   measurements before retaining it. Do not promise a peak-RSS improvement from
   allocation counts alone.
3. Then isolate remaining representative membership allocation if it remains
   material. The prior [validator outcome](vector-validation-engine-outcome.md)
   attributed about 180 MiB to membership and 94–99 MiB to fingerprint windows;
   those cumulative sampled labels are not retained-byte measurements or proof
   of an individual instruction's cost.
4. Review compatible dependency patches separately. Keep Node-24 typings; the
   incompatible PR trial is not a reason to migrate the runtime or weaken checks.
