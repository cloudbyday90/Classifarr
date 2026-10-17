# Gateway catalog qualification outcome

## Change and findings

The optional gateway worker now refuses archive-history results above an 8 MiB
projected JSON envelope before the payload crosses from PostgreSQL into Node.
The existing 10,000-row bound, full below-limit evidence, native timestamps,
attempts, cooldowns and protection rules remain intact. The same diagnostic is
available to the archive and cleanup workers. No schema or release change.

See the separate [design and official research](gateway-catalog-qualification-design.md).
The repository recovery-change workflow shaped the isolated fault tests and
required explicit distinction between process death and database completion.

The old image, source `b377e99bb939996bec986ce952f6c757a8520672`,
`sha256:b72babb708a200dfe0d409fb7f69d0d7c9dd21a71eb6b6b1db4cdd64b039d4bd`,
was killed by the container OOM safeguard after a fixture exposed approximately
234 MB of nested, deliberately inconsistent SQL evidence as verified rows.
The runner observed `OOMKilled=true`; the child did not exit normally. This is
fault-injection evidence, not a claim that this history exists on Unraid or that
it caused a previously reported production crash. Exact fixture cleanup passed.

Other lessons from developing the rehearsal:

- Fixture history writes must acquire the existing maintenance lock; no safeguard
  was bypassed to seed data.
- Activity polling inside the fixture's row-lock transaction needed
  `pg_stat_clear_snapshot()`; cached activity initially hid the blocked update.
- Killing a client did not guarantee rollback: a queued publication committed
  when the fixture blocker died. Restart correctly used that confirmed job and
  original attempt instead of exporting again. Unconfirmed in-progress exports
  stayed interrupted. Tests now distinguish these observed durable outcomes.
- The final oversized-evidence injection initially included a new failed row
  without a manifest, correctly hitting the existing SQL constraint. The fixture
  now corrupts only its padded, non-null manifests. This was a test-input error,
  not a worker failure; the large-history scenario was rerun from fresh resources.

## Source validation

- Gateway unit tests: 491 passed in 24 suites.
- Gateway PostgreSQL tests: 311 passed in 18 suites on the final full rerun.
  An earlier run had two `ECONNRESET` failures (309 passed); both affected suites
  passed separately (90 tests), then the full suite passed. No cause is claimed
  for those transient test-connection failures.
- Server/client typechecks, server test/security lint, Knip and production
  dependency analysis, inventory ownership check, static imports, ESM mock-shape
  check, copyright, Markdown and staged secret scan passed.
- The focused history regression failed before the fix, then passed. It proves
  oversized projected payloads do not reach Node, not merely that an exception is
  thrown after allocation. Boundary tests retain native timestamps and counters.

## Candidate image

Built local Compose without cache from clean source
`3559e0b91b04cf16fbbe129dd63629779ad53422`:
`sha256:983a44e0940a659c470536714d3c40bad1e7fddbc16cc7d2c2d4c13a68558ccd`.
The subsequent fixture correction and outcome documentation do not change the
packaged runtime. The image's source label remains the revision above.

The ordinary archive/catalog/retention image rehearsal passed on this candidate:
online SELECT-only capture, restricted restore, receipt publication restart,
tamper and missing-file refusals, protected copies, interrupted fixed-file
retirement, shared pins and exact cleanup. It made zero provider calls.

## Deployed-limit qualification

The first four cases passed in the full catalog run. The corrected wide-history
case passed separately against the same immutable image; it does not replace
the other cases or claim a fresh full-run receipt.

| Case | Observed result |
| --- | --- |
| 10,000 archive jobs | Catalog capture completed; concurrent synthetic inference continued, while a second maintenance worker was refused. The snapshot excluded the later inference admission. Worker peak 86,675,456 bytes. |
| Restore interruption | Killed the isolated verifier during real COPY progress at 255 rows; restart verified the same catalog. Restart peak 169,865,216 bytes. |
| Publication interruption | Killed after the manifest existed and while publication SQL was blocked. SQL committed after the blocker died; restart continued the same job and attempt 2, without another export. |
| Acknowledgment interruption | Registration survived the kill; restart reused its roots/pins, preserved attempt 2, then made copy two on attempt 3. Unchanged history did not create more work. |
| Active export interruption | Killed after 3,518,870 dump bytes. Repeated restarts kept one interrupted job on attempt 2; no replacement export or attempt refund. |
| Combined storage accounting | The shared 1 GiB file-budget boundary included inference archives, catalogs and receipts. One additional receipt byte refused another capture. This used sparse files, not physical disk exhaustion. |

Each completed case verified removal of its exact owned fixture resources and
made zero provider calls. These are real process/container kills, not power-loss
tests. Worker limits stayed at 256 MiB, no swap, 0.5 CPU and 32 PIDs; the separate
verifier stayed at 1.5 GiB, one CPU and 64 PIDs. No resource limit was raised.

The final wide-history run contained 3,001 archive-job rows, 233,852,653 canonical
bytes and a largest row of 77,949 bytes. The padded history represented failed
captures, not valid restore evidence. Both actual catalog captures and isolated
restores succeeded:

| Operation | Cgroup peak bytes | Elapsed |
| --- | ---: | ---: |
| First capture | 268,435,456 | 20.046 seconds |
| First restore verifier | 560,988,160 | 13.750 seconds |
| Second capture | 268,435,456 | 25.185 seconds |
| Second restore verifier | 547,545,088 | 13.300 seconds |
| Oversized active-evidence refusal | 34,476,032 | 1.876 seconds |

The capture peak reached the 256 MiB cgroup ceiling, including file cache; these
results do **not** establish spare memory capacity. All completed processes in
this run reported zero OOM kills, zero reported limit hits and zero PID-limit
events. Unchanged history remained quiet, and changed history after attempt 3
was refused without refunding attempts. The deliberately inconsistent active
evidence was refused with `gateway_archive_history_size_limit`; inference content
and catalog jobs/files stayed unchanged. No provider calls or binding deletions.

## Local replacement safeguards

A fresh local backup was captured before replacement:
`data/backups/catalog-qualification-before-20261017-2253.dump`, 76,233,425 bytes,
mode 0600, UID 1000, SHA-256
`0b27175379a45ca1b83cccb10c3e43f2d0a9a6db1f3ce7a65dc5a8a163c471c4`.
Its `pg_restore --list` check returned 1,933 lines. It was not restored. The old
image remains available under
`classifarr-local-rollback:4c76f4ffadea2cda020ac84f142749f33140ad5e757deddddc33a2e1a147ce7e`.

Only the local Compose `classifarr` service was recreated, with no dependency
replacement or image pull. Its new container
`e5c763fdd9d5fd3b6d81e3abe5151ab175752982f640806da3bf54694c3c3f44`
started at `2026-10-17T23:07:29.684725016Z` using the exact candidate image. Docker
reported healthy; `/health` returned HTTP 200 with database connected and `/`
returned HTTP 200. Harmoniarr and Duskcue container IDs/start times were unchanged.

The normal application database still has none of the optional gateway,
archive, cleanup or catalog schemas. Its saved capture budget remained revision
2, `when_idle`, with zero daily/reserved calls and tokens and the same next-check
timestamp. No optional worker was enabled. Unraid, Plex and shared Ollama were
not changed. No release or tag was created.

## Limits and next recommendation

The 8 MiB bound can conservatively refuse a legitimate large active/protected
evidence set. It preserves the records and inference availability; it is not a
replacement for sequential evidence validation. The next improvement is to read
active protected manifests in bounded pages and validate them one at a time,
while retaining complete identity, retry and dependency checks.

Synthetic failed-history payloads test large nested storage and hashing. The
deliberately inconsistent verified payloads test safe refusal, not successful
recovery. No live provider requests, live history purge, production activation,
ARM64, power-loss durability or off-host recovery are implied. Two local copies
still share a host/disk failure domain. Full application coverage was not run.

No open PR existed when enumerated through GitHub MCP on 2026-10-17; none was
invented, merged or closed as part of this work.
