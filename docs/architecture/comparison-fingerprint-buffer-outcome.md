# Representative fingerprint buffer outcome

Date: 2026-10-07. See the separate
[design, official sources and tradeoffs](comparison-fingerprint-buffer-design.md).

## Change and measured benefit

The existing small ESM fingerprint service now borrows private, lazily allocated
byte storage and writes components by index. It keeps the v4 protocol, little-endian
float32 encoding and validation on every append. Missing vectors allocate nothing;
separate or nested calls cannot overwrite borrowed storage. Finish releases the
scratch reference. Maximum ordinary scratch size is 64,000 bytes, not a full
vector snapshot. No version change or backfill is needed.

The recovery-change skill kept admission, retries and ownership safeguards intact;
dependency-update enforced the runtime-major boundary; release-evidence separated
source checks, actual image results and remote CI. No forced GC, production heap
dump, new runtime observer, schema change or deployment-template change.

### Fixed synthetic image probe

Compared the actual old and rebuilt image modules, not source overlays. Each
network-disabled, read-only, non-root container had two CPUs, 2 GiB and 128 PIDs.
The fixture contained 5,776 vectors of 1,024 dimensions, alternating parsed and
structured-cloned inputs, with ten libraries. Construction and one warmup were
outside measurement. Each natural or sampled run measured twelve fingerprints;
three fresh containers per mode. Buffer-call counting ran separately once per
image, so its monkeypatch overhead is not a natural timing result.
Both images contain the same 58 installed Alpine package/version entries.

| Measurement | Old image | Rebuilt image |
| --- | ---: | ---: |
| Explicit vector buffers per fingerprint | 5,776 | 1 |
| Requested vector byte storage per fingerprint | 23,658,496 bytes | 4,096 bytes |
| Total sampled heap estimates per twelve fingerprints, three runs | 58.86–61.23 MiB | 38.81–44.78 MiB |
| Fingerprint-attributed sampled estimates, three runs | 30.72–40.23 MiB | 25.74–30.78 MiB |
| Natural run medians, three runs | 197.78 / 222.23 / 208.40 ms | 108.43 / 128.60 / 144.30 ms |

All runs produced the same independently observed old-image digest:
`916087f134efb31cd4afb5f845e977ec6724827e2cf20dc1e906553473d5df77`.
The deterministic saving is 23,654,400 requested buffer bytes per fingerprint
(99.98%). Requested cumulative allocation is not peak retained memory. Inspector
heap estimates do not count all backing-store/native allocations, and the
fingerprint-label ranges overlap. Timings are observations on a shared host, not
a controlled application throughput claim. These results support retaining the
small optimization, not declaring all memory pressure fixed.

Probe and receipts remain ignored intermediates in `.tmp/`. The probe generates
256 deterministic sine/cosine vector templates, alternates parse/clone when
materializing the fixed corpus, calls the image's real encoder and uses the
existing bounded `sampleColdBuild` summarizer. No database or provider is involved.
SHA-256 receipts:

- Probe: `908a64319bd36ff7ae2d2049c1ed6bbbb3cfc9aec1828b842446f6363a045d30`.
- `fingerprint-buffer-baseline.json`: `13e61023976e66b412ca0f7138c9e25451bd6aec0f1e0f92a910d191880304da`.
- `fingerprint-buffer-candidate.json`: `e5d2fef270598d7d0e066bd415b43f997097cb9fdcd7df16e75128a89a8b1e84`.

## Verification

- Focused representative/fingerprint checks: seven suites, 136 tests passed.
  New differential cases cover dimensions 1–16,000, rounding, signed zero,
  float32 boundaries, missing/sparse/inherited/malformed values, repeated writes,
  caller mutation, interleaved instances, nested appends and finalization.
- Backend unit run: 1,746 suites / 54,217 tests passed in 356.205 seconds.
  One Linux directory-fsync case was skipped on Windows; the rebuilt Linux image
  separately passed directory fsync, exclusive copy, existing-target refusal
  and unchanged-source assertions with networking disabled.
- Backend lint/typecheck, Markdown, static imports, copyright, both Knip modes
  and the ownership gate passed. No ownership baseline changed; the existing
  501 unresolved entries remain unresolved, not newly authorized.
- All 40 tooling/install-policy tests passed using the pinned Node 24.21.0 and
  npm 12.2.0 toolchain.
- No-cache Compose build passed. Schema dump and independent check passed in
  separate disposable containers and cleaned up. The tracked schema is unchanged,
  through `20261005_180000_ingestion_compatibility_fence.sql`, with 22 seed migrations.

The frontend build ran inside the image build. Client tests and the full database
integration suite were not rerun locally for this pure encoder change; remote
checks and the actual-image catalog rehearsal are reported separately.

## Random open PR trial

Two PRs were open. Random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact server manifest/lockfile diff
updates `@types/node` 24.19.1 to 26.6.4 and `undici-types` 7.24.6 to 8.9.0.
Registry dependencies and integrity matched. The runtime-major gate passed 8/8
before the trial, failed 1/8 with the diff, and passed 8/8 after its explicit revert.
No package installation, dependency retention, functional compatibility, PR merge
or weakened gate is claimed. Keep Node-24 declarations for the Node-24 runtime.

## Exact image and local replacement

Implementation source: `b08994b7c22b818fccb0b86570d48360fc83e243`, pushed on `main`.
No-cache local image/index:
`sha256:8f89417808cebaacbe1fedb21f5ed44b5a181ccf79b50f1c5248385823504ccc`.
The OCI revision matches. Native manifest:
`sha256:1c7ada2cca0d44b3bc0f57d3dad89d5ec64869e8a67a814e93f68cf6ca3e16d0`;
configuration:
`sha256:78052e14392046f6aec0f9b3c57cd7028083fe5a8c232a91526146f42f3fb1f8`.
These are local artifact identities, not a published release or signed provenance.
Later Markdown evidence commits do not become this image's source revision.

Baseline image:
`sha256:ac9876b98d81669a524fc6b309a0e647b71e2f73d2dc2435df2cb67e5314f9d9`.
Before overwriting the tag, pinned it for rollback and verified a 75,632,341-byte
database archive. Immediately before replacement, verified a fresh 75,631,986-byte
archive, `.tmp/pre-memory-fingerprint-7715c904-66bb-4c2e-8767-61a1743a09a0.dump`,
by checksum and archive listing; exact rollback tag:
`classifarr:pre-memory-7715c904-66bb-4c2e-8767-61a1743a09a0`.
These are database backups, not a full appdata backup or restore rehearsal.

Local Compose was recreated at 23:07:10.218 UTC. User `1000:1000`, read-only root,
no-new-privileges, capability restrictions, mounts, heap cap and 2 GiB limit remain.
The health endpoint reported a connected database. The running encoder's SHA-256
matches the checkout: `5eb84a3a856a692f13cb69969a52819bcc0525a0a84b65c69b4c3036c0b14beb`.

Nineteen observations from 23:07:54.341 through 23:12:49.845 UTC stayed healthy,
with zero OOMs, memory-limit hits or restarts. Raw container usage ranged from
312.96 to 650.92 MiB; its lifetime kernel peak was 736.95 MiB. These active-local
readings are not a matched workload benchmark. Read-only diagnostics found
backfill still running and no new error-log entries after replacement. The newest
comparison memory warning remained 18:04:45 UTC, before replacement; the new
process reported waiting for background work. The diagnostic helper's own memory
reading is not the web daemon's reading. Unraid was not inspected or changed.

## Catalog rehearsal and remote checks

The exact-image catalog/GC/residency rehearsal passed in owned project
`classifarr-resource-study-4038515f3b55f3340e3492d671896099`, with synthetic data,
internal networking, two CPUs, 2 GiB and 128 PIDs. It ran for 1,208,647 ms
(20.14 minutes); the workload finished in 1,006,275 ms. Twenty waves and 176 scans
completed all 5,776 imports/metadata jobs across ten libraries. All description
vectors were cached. Pending, failed, service-error, routing and handoff counts
were zero. Thirty-four refresh reads and six builds ran; all fourteen workers
exited. Both consumers stopped with zero pending work and zero retained groups,
after four committed batches each. Source changes correctly invalidated earlier
attempts rather than publishing stale results.

After workload drain at 625,736 ms, representatives published at 635,170 ms and
became up to date at 992,564 ms. Comparison became ready at 684,554 ms and
revalidated at 1,005,286 ms. Both warm intervals exceeded five minutes.

Peak process RSS was 799.93 MiB, main heap 630.87 MiB, raw container usage
1,141.69 MiB and kernel high-water mark 1,151.55 MiB. These are separate peaks,
not simultaneous values to add. No OOM kill or memory-limit hit occurred. Existing
admission deferred ingestion 34 times and queue work 67 times; discovery had no
memory refusal. Consequently `pressureRecoveryObserved: false` is correct: this
run did not prove comparison recovery after a memory refusal. Safeguards remain
necessary and unchanged.

At shutdown, seven sampled registrations remained and workers were already gone.
A natural main-thread major collection arrived after 81.907 seconds; those
registrations became collectible and sampled heap fell from 384.76 to 39.88 MiB.
During the following two-minute quiet window, RSS was initially 573.98 MiB and
ended at 136.82 MiB, while heap stayed near 40 MiB. The final interval's 435.78 MiB
RSS drop accompanied a memory-reducing collection reporting a zero local page
pool; an earlier collection in the quiet window reported 424 MiB. This is
consistent with the preceding delayed-page-reclamation finding, not evidence of
an enduring leak in the sampled objects or proof that every allocation is covered.
All 125 GC events parsed completely.

The prior image's study used the same catalog, limits and GC/residency protocol,
but timing and admission produced 24 reads, four builds and nine workers, versus
34, six and fourteen here. Its peak RSS was 876.55 MiB. The lower candidate peak
and shorter elapsed time are observations, not a controlled performance claim:
the operation counts differ, host load differs, and tracing/measurement itself
allocates. Schema checks and local replacement also overlapped the early phase.
The precise saving established by this change remains the isolated buffer count.

Cleanup passed; independent project-label checks found no remaining containers,
volumes or networks. Only disposable synthetic resources were removed. Receipt
SHA-256 values under this project's ignored `.tmp/resource-study/` directory:

- `result.json`: `278971f29e711d2f04f691d6994403b089fc585c02dde60b1337377329189014`.
- `comparison-trace.json`: `05b48b6ae1efd0f1267efc4277ef7549c1b600e639a7ecf8fecb1249a278a111`.
- `comparison-gc-trace.json`: `a56c9bcf78b1390d028a9ec533d5499b904304a42f9961d8f8c6418c7f138a5e`.

Source [CI run 37700282187](https://github.com/cloudbyday90/Classifarr/actions/runs/37700282187)
completed successfully, including build/test, database, fresh-install/upgrade,
shutdown/recovery and acceptance-readout checks. Resource-safety, OSV, Trivy,
CodeQL, Gitleaks and copyright workflows also passed for the exact implementation
commit. Release publication/promotion jobs were skipped as expected; no image was
promoted by this main-branch check. A later documentation-only commit starts its
own CI run and is not substituted for this source/image evidence.

## Recommendation stack

1. Retain private buffer reuse: deterministic allocation reduction and exact-byte
   regression coverage, with a bounded per-fingerprint lifetime. Cost: a small
   amount of lifecycle code and up to 64 KB until finish.
2. Keep memory/admission/GC policy unchanged. Reduced churn does not authorize
   lower reserves, forced collections or subtracting pooled pages from real usage.
3. Next isolate representative membership validation's remaining temporary
   allocations, then change only a measured hotspot. Earlier sampled windows
   attributed about 180 MiB there; cumulative samples are not retained bytes.
4. Review compatible dependency patches as a separate bounded batch. The Node-26
   PR is not a reason to migrate the runtime or weaken its gate.

No release, version bump, new branch, PR merge or Unraid mutation.
