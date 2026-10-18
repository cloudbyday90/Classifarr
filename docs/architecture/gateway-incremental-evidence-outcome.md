# Incremental gateway archive evidence outcome

Work date: 2026-10-18. Scope and alternatives are in the separate
[design](gateway-incremental-evidence-design.md).

## Implementation

The optional coordinator now keeps ordered job summaries and fetches full
manifest/receipt evidence by exact ID. PostgreSQL rejects an individual projected
record above 128 KiB before sending its body. Each read compares all captured
headers plus a complete stored-job digest, refusing changed or missing evidence.
The 10,000-job ceiling remains. The 8 MiB list limit now applies to metadata,
with the separate 128 KiB guard on each full-evidence read; large aggregate bodies
no longer have to fit in one list result.

Protection reconciliation retains small membership records, validates all groups
before readiness writes, and repeats the scan after cancellation/restart.
Protection selection retains only its newest matching pair. Cleanup still checks
every required archive, receipt and marker before admission; rotation still
requires preservation evidence and checks catalog pins. No persisted validation
cache, schema migration, new admin action or production activation was added.

The recovery-change workflow guided the cancellation, late-corruption and
exact-image checks. The implementation follows the approved grill-me agreement;
it does not extend consent to live cleanup or shared-provider operations.

## Code verification

- Regression first: six of the seven initial SQL tests failed against the old
  eager reader. All seven passed after the change.
- Final targeted gateway checks: 495 unit tests in 25 suites and 321 SQL tests in
  18 suites passed. SQL checks include 12,000,000 aggregate payload bytes,
  exact 128 KiB / next-byte boundaries, changed/deleted records, unchanged stored
  manifest hash with changed receipt, native timestamps, tied-time ordering and
  preserved capacity/attempts. Unit checks cover interleaved groups, a late bad
  member, incomplete groups and cancellation with a fresh full rescan.
- Repository lint, server/client typechecks, Knip, strict ESM mock shapes, static
  imports, copyright, Markdown and inventory-writer ownership checks passed.
  Staged secret scanning passed. Full application coverage was not rerun.
- The first unit invocation lacked the local OpenSSL executable path and had
  environment-only `ENOENT` failures; the correctly configured invocation passed.
- Review found a timestamp-only comparison gap caused by JavaScript Date rounding.
  A microsecond-change regression failed first; the digest now includes exact
  stored job fields, not just manifest/receipt bodies. All 321 SQL tests passed
  after this correction, including the new regression.

No open PR existed when enumerated through GitHub MCP on 2026-10-18. No PR was
invented, merged or closed. Official locking and cursor guidance was rechecked
through MCP; see the design for verified links and tradeoffs.

## Container evaluation

Final candidate runtime source: `6709726e67c6749a198835ed124bb3101d4692f0`.
The no-cache local Compose build used a clean checkout and produced local image ID
`sha256:ffb0204ccceb96c3091cd215d7dbb806525ed9843c9a2a5e9ff39fc173f3723a`.
Its revision label matches the source. This is a local image identity, not a
published registry digest or signed provenance claim. Release-evidence guidance
kept all passing results tied to this exact candidate; no release was created.

The ordinary archive/catalog/retention rehearsal passed: online capture,
independent restore, inventory/receipt tamper refusal, protected copies,
interrupted retirement and preserved shared catalog pins. Its owned fixture
resources were removed and cleanup verified. All six catalog qualification cases
then passed in one run on this same image. Local replacement checks follow below.

The deployed-limit cleanup qualification also passed: damaged marker refusal,
two 100-record synthetic cleanup batches, preserved 80,100 inference attempts,
continued rotation, four retained archives and recovery of an unacknowledged
commit without a duplicate deletion. Cooldown was made due only in the isolated
fixture, not by resetting attempts; this does not prove elapsed wall-clock cadence.
Its exact owned resources were removed. Zero provider calls were made.

The first five catalog cases passed together on the final image:

| Case | Result |
| --- | --- |
| 10,000 archive jobs | Capture succeeded while synthetic inference continued; competing maintenance refused. Capture peak 87,621,632 bytes. |
| Restore interruption | Stopped during real COPY progress at 418 rows; restart verified the original snapshot. |
| Publication interruption | SQL committed after the test blocker died; restart reused the original job on attempt 2. |
| Acknowledgment interruption | Existing roots/pins survived; restart kept attempt 2 and made the second copy on attempt 3. |
| Export interruption | Stopped after 2,724,679 dump bytes; repeated restarts preserved one interrupted job and its attempt. |
| Wide failed history | 3,001 jobs / 233,852,612 canonical bytes; both captures/restores passed. Changed history after attempt 3 did not refund work. |
| Oversized active record | Deliberately inconsistent 150,000-byte payloads refused before full-record transfer; no new work or history loss. |

Wide-history capture peaks were 268,435,456 bytes (19.093 / 23.628 seconds);
verifier peaks were 548,605,952 / 554,319,872 bytes (12.892 / 14.437 seconds).
The captures reached their cgroup ceiling, including file cache. This is not
evidence of spare memory headroom. No completed case reported OOM kills,
reported memory-limit hits or PID-limit events. Exact fixture cleanup passed.

An initial image pilot was intentionally stopped after 40 verified archives to
include the timestamp-fence correction. Its verifier received SIGTERM and the
harness failed as expected; exact owned container/volume cleanup passed. This
pilot is not counted as a passed large-history qualification.

The large protected-history fixture constructs actual dumps and independent
restore receipts, in bounded batches. It uses synthetic historical job insertion
to avoid waiting through production scheduling intervals; this is not evidence
of elapsed daily cadence. Each pair uses a distinct real inference revision and
attempts 1/2, without refunding attempts. Only the fixture verifier loops through
20 restores per invocation; the production verifier cadence is unchanged.

The final large-history run contained 400 valid protected archives in 200 pairs:
9,575,637 canonical job bytes, including **9,296,502 manifest/receipt bytes**.
All 400 dumps were independently restored. Late-marker corruption blocked both
maintenance and cleanup without changing source history or admitting work.
After restoring only the fixture's original marker, cleanup completed all file
checks and independently refused the low-pressure source at its SQL gate, with
zero cleanup operations. Catalog capture and restore then succeeded. For the final
inference revision, its two archives plus catalog capture used attempts 1/2/3. Repeated
assessments refused another copy without resetting that shared budget.

| Large protected-history operation | Cgroup peak bytes | Elapsed |
| --- | ---: | ---: |
| Late corrupt marker: maintenance refusal | 48,898,048 | 5.517 s |
| Late corrupt marker: cleanup refusal | 47,521,792 | 5.653 s |
| Clean evidence, low-pressure cleanup refusal | 47,763,456 | 6.168 s |
| Full catalog capture | 67,710,976 | 17.968 s |
| Isolated catalog restore | 163,557,376 | 7.282 s |
| Acknowledgment and exhausted-budget check | 53,637,120 | 13.266 s |
| Repeated exhausted-budget assessment | 52,596,736 | 6.520 s |

Workers retained 256 MiB, no swap, 0.5 CPU and 32 PIDs; verifiers retained 1.5 GiB,
one CPU and 64 PIDs. All completed runs reported zero OOM kills, zero reported
memory-limit hits and zero PID-limit events. Some earlier independent rehearsals overlapped; these
are observed timings, not isolated performance benchmarks. Fixture cleanup was
verified, with zero provider calls and no binding deletion in catalog cases.

Repeat the catalog cases with
`node scripts/run-gateway-online-archive-rehearsal.mjs <local-image-id> <source-commit> --catalog-qualification`.
The real 400-restore case intentionally takes several minutes. Fixtures are
mounted separately; application source and dependencies are not overlaid.

## Local replacement

Final backup: `data/backups/incremental-evidence-final-before-20261018.dump`,
76,243,846 bytes, mode 0600 / UID 1000, SHA-256
`9e5e4fcc9cfff36d3ef792299a83d7d73f358f22a8fa166d839cc4d74cb00267`.
`pg_restore --list` succeeded with 1,933 entries; this backup was not restored.
The earlier preliminary backup was also retained. Original image
`sha256:983a44e0940a659c470536714d3c40bad1e7fddbc16cc7d2c2d4c13a68558ccd`
remains available under verified rollback tag
`classifarr-local-rollback:e5c763fdd9d5fd3b6d81e3abe5151ab175752982f640806da3bf54694c3c3f44`.

Only local Compose service `classifarr` was recreated, with no dependency
replacement, build or pull during startup. New container
`78ada8ef6a8c3055714256069ae657331298d45fb812ae0dd46f150b4d53d007`
started at `2026-10-18T10:24:31.90147681Z` on the exact tested image. Docker reports
healthy, `/health` returned HTTP 200 with the database connected, and `/` returned
HTTP 200. The container remains UID/GID 1000 with its unchanged 2 GiB limit.

The normal application database still has zero optional gateway/archive/cleanup/
catalog schemas. Its saved capture budget remains revision 2, `when_idle`, zero
daily/reserved calls and tokens, and next-check time
`2026-10-09T20:50:11.617278Z`. No optional worker was enabled.
Harmoniarr's container ID/start time were unchanged. Duskcue changed state before
the Classifarr replacement and was running afterward; this task did not target
it, so no claim is made that it stayed unchanged throughout the work.
Unraid, Plex and shared Ollama were not changed.

## Limitations and next recommendation

This removes aggregate evidence allocation, not the cost of hashing every file.
More SQL round trips are the deliberate tradeoff. Next, add bounded phase-level
resource measurements to distinguish process/anonymous memory, file cache and
repeated SQL/file verification during catalog capture. Measure before considering
less duplicate work within one locked assessment; preserve file-race checks.
Do not introduce cross-run trust or raise deadlines as a shortcut.

Keep the optional feature disabled in ordinary installations until separately
approved. Unraid, Plex and shared Ollama are outside this local change. These
checks do not establish ARM64, power-loss durability or off-host recovery, and two
local copies still share a host/disk failure domain. No release or tag is planned.
