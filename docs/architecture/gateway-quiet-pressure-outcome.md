# Quiet-window archiver qualification — outcome

2026-10-20: all four arms passed, with eight large real catalog restores,
unchanged history and verified cleanup. Five host endpoint fingerprints matched.
This closes the planned short qualification, not production capacity or sustained
latency acceptance. The [approved design](gateway-quiet-pressure-design.md)
records official research, alternatives, safeguards and limitations.

## Exact subject and reproduction

Clean tested source: `a487e13be32b51ccb5626741005f7ac7eb97a12b`.
Local image ID:
`sha256:ee0f382279fd67708b360c2bcc254dd76be1722b78a100be580e7ae7af6dcdfc`.
Built with Compose `--no-cache --require-provenance --protect-running-image`.
Linux/amd64, Node 24.21.0, PostgreSQL 18.6 and pgvector 0.8.7. These are local
image results, not published registry, multi-platform or signed provenance proof.
Subsequent documentation changes do not alter the tested executable sources.

After preparation/regressions, the quiet window began at 14:34:56 UTC. The final
log write was 14:53:39.998 UTC (about 19 minutes). No other owned builds/tests ran
during measurement; normal applications stayed running unchanged. No cache flush,
forced GC, resource increase or production deployment was performed.

```sh
node scripts/run-gateway-online-archive-rehearsal.mjs \
  sha256:ee0f382279fd67708b360c2bcc254dd76be1722b78a100be580e7ae7af6dcdfc \
  a487e13be32b51ccb5626741005f7ac7eb97a12b --archiver-quiet-study
```

Use the matching clean checkout. Sealed input-manifest digests stayed fixed within
each treatment:

- Unsampled: `d08d80b5e67ecdf9fce45081745c9a661619868d0e9c40a18b792e49ed101909`.
- Sampled: `255200749e679ecc9df8c068f12aa2dd8ccabc12e5f17d50c67e5d0beccb5836`.

The ignored `.tmp/quiet-pressure-study.log` has SHA-256
`0ab8945d4a9e82649508b1bd936b891f5f12c3181f8c42f8e91ce40c752ae0c7`.
It is a local observation, not independent attestation. Logs and generated source
bundles remain ignored intermediates; backups and rollback images are retained.

## Results and interpretation

Elapsed times measure packaged-worker spawn to close, excluding setup, endpoint
accounting and restore verification. Captures within an arm are not independent
repetitions: there are only two arms per treatment.

| Arm | Periodic sampling | Capture 1 (s) | Capture 2 (s) | Kernel peak, both | Large restores |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | No | 32.163 | 36.567 | 256 MiB | 2 passed |
| 2 | Yes | 30.955 | 40.932 | 256 MiB | 2 passed |
| 3 | Yes | 30.042 | 34.019 | 256 MiB | 2 passed |
| 4 | No | 31.094 | 36.545 | 256 MiB | 2 passed |

Ranges overlap closely; these observations do not establish a sampling speedup,
zero overhead or a precise causal cost. Unlike the earlier confounded study, no
persistent lifecycle change was detected at any boundary. All five observations
covered 18 containers, with digest
`9d8609017ce8d1386f2e37d15213dfc693f3929a57975064becfb4133c84c1c8`.
Endpoint agreement cannot exclude short-lived containers, exec work, host/VM
CPU or disk activity, cache evolution or pause/resume between observations.
No foreign container was deliberately restarted to test this policy.

All eight large captures reported zero OOM, OOM-kill, memory-limit-hit and PID-limit
events. Sampled captures had 60/78/58/66 samples, zero failed samples and maximum
gaps of 571–604 ms. Current-memory coverage was 100%; cgroup-detail coverage was
100% except for 77/78 samples (98.7%) in Arm 2's second capture. Missing/partial
observations remained explicit. Near sampled peaks, file cache was about 185.2–188.0 MiB and
anonymous cgroup memory about 57.8–60.8 MiB. This supports a cache-heavy charge,
not a heap-leak diagnosis or comfortable headroom claim. Unsampled captures still
reached the ceiling, so periodic sampling is not necessary for that observation.

The host exposed v1 memory and CPU-throttling accounting; PSI and all configured
device-I/O interfaces were unavailable. Memory charging/uncharging counters do
not establish physical disk traffic or reclaim stalls. Do not replace missing
metrics with zero or infer process ownership by summing RSS.

Every arm used 3,000 failed historical rows with varied 75,000-byte padding and
the same payload digest
`b9872c5cd649c86a2d1ff158ae23786e43a29bf766185ca9212daa83babf2253`.
Canonical history sizes were 233,849,321 / 233,849,356 / 233,849,370 / 233,849,352
bytes. Generated UUIDv7 IDs, timestamps and prerequisite receipts differ, so
these are matched shapes rather than cloned databases. Physical relation sizes
also varied slightly. No old compressible warm-up was added to either treatment.

Each arm additionally passed a prerequisite inference-archive restore: 12 real
restores in total across the four arms. Quiet unchanged-history behavior,
original attempt exhaustion, oversized-evidence refusal, preserved history and
zero cleanup-operation checks all passed. Fault drills changed only synthetic
fixture data and proved refusal without mutations or budget refunds. There were
zero provider calls and no live history purge.

Every arm returned only after exact-owned containers, volumes and disposable
source-data directories were verified absent. Independent final label checks
found no qualification containers or volumes. The native tooling container was
also absent. No global Docker cleanup or foreign resource removal was used.

## Verification and local evaluation

- New fixed-command/endpoint tests cover malformed/duplicate/raced inventories,
  changed lifecycle/daemon identity, deadline/output limits, privacy, initial
  refusal, stop after any completed arm, no retry and original cleanup failure.
  Rejection paths use injected command/runner failures; the real four-arm run
  exercised the successful Docker observation path, not an induced daemon outage.
- Windows gateway tooling: 140 passed, one platform symlink skip. Same committed
  tests inside the final Linux image: 141/141 passed, zero skips.
- Final CI preflight passed, including gateway tooling, copyright, ownership
  review and both dependency checks. ESLint's parser-version refusal was reviewed
  and corrected separately, without changing review entries or baseline revision;
  ownership/scanner regressions passed 57/57.
- Full lint/typechecks and static-import check passed; server lint/typecheck/knip
  were rerun after the separately reviewed [ESLint update](server-eslint-10-13-outcome.md).
  Dependency tooling passed 43/43; development-inclusive server audit reported zero
  advisories. Full application/integration tests were not rerun in this tooling-only batch.
- Default image archive regression passed before measurement: actual restricted
  restores, mixed-format rotation, corruption/tamper refusal, read guards,
  history/attempt preservation, zero provider calls and exhaustive cleanup.

Before replacing the local Compose container, created private backup
`data/backups/gateway-quiet-20261020-a487e13b.dump`: 76,208,007 bytes, mode 0600,
SHA-256 `3e5da97749f7dfc33ab88049c9ff0bd2bdbe5f294f6cfe15fd2f992b0a05fb35`.
`pg_restore --list` passed; this is not a full application-backup restore rehearsal.
The previous image remains under the exact rollback tag
`classifarr-local-rollback:5ced862feab49c773d917febc32ed95e79d37a5dbac779aa51e0a2ebf300f0f5`.

The initially evaluated local container was
`de6bb4424d6b555c1e88529b9d64755bdeab061a855c996ca73f324f1746bf2e`, started
14:54:39.220 UTC on the timing-study image. It was healthy, read-only-root, 2 GiB, zero
restarts and no OOM; `/health`, `/ready` and `/` returned HTTP 200. The existing
capture guard remained revision 2 with zero calls/tokens/reservations and its old
next-check timestamp unchanged. No gateway schemas were added to normal appdata.
Unraid, Plex and shared Ollama were unchanged. No new admin function, table,
release, Git tag, version bump or PR merge was created.

## Final image after parser review

The final preflight exposed the offline parser-version review described above.
After resolving it, rebuilt without cache from clean source
`6b7a6af4e3332b6601a54dc1aae50906d4135f43`, retaining provenance and rollback
protection. Final local image ID:
`sha256:b4fe24676e4b60ac75bf7042e4ac28a684393297f1c0eec3997666d1b5b4092a`.
Compared with the timing subject, the only non-document source change is the
offline `ownershipReview.json` parser-version field. Gateway runtime, worker,
fixture and study code are unchanged. Do not relabel the earlier timing numbers
as measurements of this new image: the four-arm study was not rerun.

Repeated final-image checks: native gateway tooling 141/141 with no skips, plus
the full default archive real-restore/corruption/rotation/read-guard regression
and exhaustive cleanup. Independent label checks found no study containers or
volumes. Final preflight, focused ownership tests and documentation checks passed.

Before the final local refresh, created another private mode-0600 backup,
`data/backups/gateway-quiet-20261020-6b7a6af4.dump`, 76,205,584 bytes, SHA-256
`bd777d438d74de4f3c720ca5089a5d60d02044aee1785c4943efdea2caf0a597`.
Its `pg_restore --list` check passed; no full application-backup restore is claimed.
Retained the timing image under rollback tag
`classifarr-local-rollback:de6bb4424d6b555c1e88529b9d64755bdeab061a855c996ca73f324f1746bf2e`.

Final container:
`3d79a440d0103d6f66cd5d5840b232b5e59e515d45330b1cde7a6ef02bc164d3`, started
15:11:49.225 UTC. Healthy, read-only-root, 2 GiB, zero restarts and no OOM;
all three HTTP checks returned 200. Node/PostgreSQL/pgvector versions, existing
capture-guard state and absence of gateway schemas remained as reported above.
Only local Classifarr was replaced. Later documentation commits change no image inputs.

## Recommendation and next item

Keep endpoint checks plus the coordinated window for local timing work: small,
bounded overhead with useful restart detection, but incomplete interference
coverage. A dedicated host would give stronger control at the cost of another
environment. A continuous lifecycle stream would narrow some gaps but still
would not establish CPU/disk idleness; do not add it without a measured need.

Keep production safeguards and limits unchanged. Next, design a sustained
inference/archive co-load comparison with predeclared latency and progress
criteria, matching workloads and the same restore/cleanup guarantees. The current
short study removes one known confound but cannot establish long-running latency,
reclaim headroom or the benefit of further reducing repeated archive reads.
