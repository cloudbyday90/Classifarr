# Gateway cleanup evidence outcome

2026-10-16. Local implementation on main; no release or production activation.

## Delivered

Automatic gateway archives now bind a bounded set of exact cleanup candidates
to a real isolated restore. New version-4 manifests include at most 100 oldest
eligible records and their dependency fingerprints. Version-2 receipts bind
the independently recomputed candidate inventory. Old online archives retain
their original restore/rotation behavior; old receipts cannot substitute for
the new evidence. No existing retry budget is reset to force a new export.

The grill-me planning and recovery-change workflows kept this increment at the
evidence prerequisite. Automatic live-history deletion, archive retention pins,
expiry and audit-summary storage are **not implemented** here. There are no new
admin controls, database objects, dependencies or source write privileges.
Existing UUIDv7 identities and ESM service boundaries remain in use.

See the separate [design, official research and tradeoffs](gateway-cleanup-evidence-design.md)
and [operations guide](gateway-online-archive-operations.md). The recommended
stack remains Node ESM, PostgreSQL 18 read-only exported snapshots and an
isolated least-privilege restore verifier. The benefit is specific, testable
recovery evidence; the cost is bounded extra SQL and manifest data. It does not
yet relieve the live ledger's capacity limit.

## Defect found and fixed during qualification

The first candidate, source `462ed656be59a69a21e6f492251bd82f8562a7d8`, passed
the small image rehearsal but failed the large-history export before reaching
`pg_dump`. A second diagnostic run identified SQLSTATE `57014` during retention
inventory capture: PostgreSQL's four-second statement timeout. Full-content
scanning had completed. Both failed fixtures verified cleanup.

Candidate selection previously joined and fingerprinted wide rows in a query
whose final row limit did not sufficiently bound its work. It now selects at
most 100 eligible IDs using the existing ledger/attempt index, then fetches
only those full fingerprints in the same read-only snapshot. A real PostgreSQL
100,000-binding regression checks the unchanged four-second limit and exact
first/last attempts. No timeout, memory, PID or storage limit was increased.

## Host checks

- Gateway unit tests: 388 passed in 17 suites.
- Real PostgreSQL gateway integration tests: 253 passed in 12 suites.
- Backend typecheck, test/security lint, both knip modes, inventory ownership,
  static-import, ESM mock-shape, copyright, npm CLI flag, Markdown, syntax,
  whitespace and staged secret checks passed.

Coverage includes empty history, the full candidate page, honest totals beyond
that page, historical cutoff, identity/counter/dependency substitution, concurrent
admission, protected categories, cancellation, canonical JSONB ordering and
receipt downgrade refusal. The integration comparison uses a synthetic database;
actual native restore is exercised separately below. TLS tests initially lacked
the host OpenSSL path; rerunning with the existing `OPENSSL_BIN` passed.

The ownership gate required explicit review of the changed verifier module. Its
restored-database work remains isolated; the new helper issues SELECTs only.
Only that reviewed file digest changed, not its ownership classification or
the analysis baseline. No security gate was weakened.

## Packaged evidence

Built local Compose with `--no-cache --require-provenance` from clean source
`8c36fffcb90f3936af5cd698e727a4b154762eda`. Image:
`sha256:d84f7804f6019062f506a83e6fc3f0fb788424b3d538a0e1f3bd26bb4b47e4eb`.
Its revision label matched. The frontend production build passed (1,085 modules).
One rebuild attempt failed because Docker could not resolve GitHub's download
host; after resolution recovered, the same no-cache command passed without
changing dependency pins or checksum enforcement. Later documentation does not
change the packaged runtime.

The basic online archive rehearsal passed against this image:

- SELECT-only source roles and isolated restricted native restore.
- Full 100-candidate inventory, with 101 eligible records remaining explicit.
- Validly checksummed but substituted candidate fingerprint rejected after
  restore; failed receipt contained no retention digest or preservation claims.
- A legacy receipt with otherwise matching IDs and hashes rejected for v4.
- Constructed legacy v3 artifact and new v4 artifacts restored and rotated from
  three verified copies to two; this is format compatibility, not an old-image
  upgrade test.
- Recovery/stop-linked records excluded on the next archive, while all seven
  source tables and cyclic references were restored correctly.
- Reconstructed receipt-publication interruption, worker restart, corrupt-copy
  refusal, unchanged live fixture history and zero provider calls.
- Exact owned temporary resources removed and cleanup verified.

The tamper case changes only its synthetic manifest and corresponding fixture
job checksum. After observing the failed verifier receipt, it restores that
fixture manifest and removes only its failed receipt to test the valid case.
No SQL failed-job state or attempt counter is reset. Synthetic history dates and
scheduling timestamps are advanced explicitly; elapsed retention/cooldown time
is not claimed.

The extended capacity case passed with 99,998 initial bindings and real fixture
admissions advancing to 100,000. Initial snapshot content stayed at 99,998 while
the live fixture advanced to 99,999. Three dumps (67,587,403, 67,587,876 and
67,588,350 bytes) restored successfully and rotated to two verified copies.
Final canonical content was 117,157,447 bytes.

- Killed a verifier after observing native `pg_restore` copy progress (2,084
  rows). No partial receipt was published; restart reused the same export and
  attempt. Graceful verifier cancellation also published no success receipt.
- Killed an exporter after observing its committed job and partial native dump.
  Restart retained the interrupted job and blocked a new export, including
  after explicit fixture schedule advancement; no attempt refund occurred.
- Reproduced the narrow retirement cutpoint with a durable SQL marker and one
  missing old manifest. This was not an actual kill at that instruction.
- At 100,000 bindings, admission still refused more history. The logical storage
  reservation boundary was 805,175,296 bytes; one byte more was refused. Sparse
  files tested accounting, while a separate 16 MiB tmpfs tested actual
  insufficient free space, not full-host disk exhaustion.

Completed capacity workers peaked at 132,980,736 bytes for the coordinator and
490,741,760 bytes for the verifier. Complete exports took 6.6–13.5 seconds and
successful restores 16.0–19.2 seconds including fixture startup/observation.
Completed workers reported zero OOM, memory-limit or PID-limit events. Deliberate
kills returned exit 137 with `OOMKilled=false`; no final peak is claimed for
those killed workers. Capacity cleanup was verified and provider calls were zero.

The oversized shape contained 322,656,128 canonical bytes. Direct scanning
refused it with `gateway_archive_size_limit`; automatic export failed safely,
kept the existing verified copy/receipt, consumed one attempt and remained on
cooldown after restart. No new partial archive directory appeared. The refusing
coordinator peaked at 48,988,160 bytes and completed in 11.8 seconds. This is
refusal evidence, not successful restoration of an oversized archive. It made
zero provider calls and verified owned-resource cleanup.

Graceful exporter cancellation passed after real partial dump output was
observed. The single job retained attempt 1, recorded cancellation and remained
on cooldown after restart. Source fingerprints stayed identical; peak memory
was 58,445,824 bytes. Provider calls were zero and cleanup was verified.

All three extended cases passed against the same immutable image. The observer
ran inside each worker's limits: coordinator 256 MiB/half CPU/32 PIDs, verifier
1.5 GiB/one CPU/64 PIDs and 1 GiB tmpfs. Docker settings and kernel cgroup v1
limits matched. The synthetic source used 2 GiB/two CPUs; workers had no network
or swap, and the verifier received no source credentials, source socket or
Docker socket. Only exact labelled test resources were removed.

These are synthetic Linux/AMD64 results, not production load estimates. ARM64,
cgroup v2, full repository test/coverage suites, every crash cutpoint, disk
exhaustion during an active write, a full 256 MiB restore and upgrade from a
published release were not exercised. No normal application backup restore is
claimed from these gateway-only restores.

## Local application replacement

Retained `data/backups/gateway-cleanup-evidence-before-20261016.dump`
(76,269,439 bytes), SHA-256
`48EA9F20460E4BF7D82E17D60647DF7EF33C15BAF1083B916B688F708997BD74`.
`pg_restore --list` succeeded with 1,933 lines; the application backup was not
restored. The previous healthy image
`sha256:25785b687c292d339b51fcc21fcca89907911e6207326f687ac4cd22d6549e23`
is protected by rollback tag
`classifarr-local-rollback:1d67a49c2ea87ff202da5b912efbe532f61257eb87e78f602d2e45471398f5c8`.

Pre-replacement read-only SQL confirmed the two optional gateway/archive
namespaces were absent. Evaluation settings were `when_idle`, zero daily
calls/tokens/reserved calls, revision 2 and next check
`2026-10-09 16:50:11.617278-04`.

Replaced only local `classifarr` with the tested image using
`--no-build --no-deps --pull never --force-recreate --wait`. It became healthy
with zero restarts and no OOM. UID/GID 1000, read-only root, no-new-privileges and
the 2 GiB limit remained intact. Health and UI returned 200; unauthenticated
gateway-history access returned 401. Read-only SQL confirmed both optional
namespaces remain absent and the exact evaluation settings/timestamp above are
unchanged. One post-start observation was 335.6 MiB and 1.33% CPU; it is not a
peak-load benchmark. No optional worker, gateway routing or AI evaluation was
activated. Unrelated local containers were not replaced.

## Boundaries and next recommendation

Every receipt still has `purgeAuthorized: false`. Unraid, Plex and shared Ollama
are unchanged. No inference request or real history purge is part of this work.

Next: retention-aware archive generations and durable pins so deleted records
remain recoverable for the proposed 30-day window within the 1 GiB budget. Only
then connect bounded transactional cleanup, fresh eligibility checks and compact
audit summaries. Capacity shortage must pause cleanup rather than silently
shorten recovery retention. Neither that 30-day promise nor the proposed
pressure-driven live deletion policy is delivered by this prerequisite.

GitHub MCP enumeration on 2026-10-16 returned no open Classifarr PRs, including
the final selection check. No closed PR was substituted and no PR was merged.
