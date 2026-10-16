# Gateway archive recovery protection — outcome

## Implementation and evidence

2026-10-16. Implemented the approved
[protection design](gateway-archive-protection-design.md) on `main`, without a
branch, release, dependency change or PR merge. Research, alternatives and the
recommended ESM/PostgreSQL 18/native UUIDv7 stack are recorded in that design.

Optional archive schema v2 adds immutable UUIDv7 recovery groups and transactional
job fences. A unique bounded capacity slot prevents concurrent transactions from
exceeding 1,000 groups; it is not the record identity. The explicit upgrade and
fresh schema are equivalent and preserve existing attempts and receipts.

At pressure, matching candidate pages can obtain two separately restored copies
within the existing revision attempt budget. SQL protection precedes private,
durable file-marker publication; restart finishes incomplete publication. Ready
holds with missing markers fail closed. Markers also block old retirement code
when database metadata is stale. Protected history survives rolling rotation.
The storage budget remains 1 GiB, with existing replacement headroom.

No live-history deletion, expiry, public API or administrator control was added.
The approved minimum is 30 days **after confirmed deletion**. Until that durable
completion event exists, holds remain indefinite; elapsed archive age cannot
release them. `purgeAuthorized` remains false everywhere.

## Host verification

- Gateway unit tests: **391 passed, 17 suites**.
- Gateway PostgreSQL integration tests: **261 passed, 13 suites**. After adding
  the database-enforced capacity slot, all **8 protection integration tests**
  passed again.
- Concurrency checks exercised protection-first and retirement-first races,
  including a stale REPEATABLE READ transaction. Neither can bypass the job fence.
- Fresh/upgrade equivalence, running-coordinator and in-flight-retirement upgrade
  refusal, immutable evidence, UUIDv7, schema readiness, legacy handling and
  preserved attempts/cooldowns passed.
- Typecheck, test lint, security lint, both Knip checks, static-import and ESM mock
  checks, copyright, npm CLI flags, Markdown and inventory ownership gates passed.
  No ownership/security baseline was refreshed. Staged secret scanning passed.

## Exact-image checks

No-cache Compose build from clean runtime source
`470bdae2aeac551a6e8841296e794132e5648f92` produced:

`sha256:2f3501424ff99df9b88cccc2b9c6272f788792c2babd635263cc49ba47722d0b`

The basic Linux/AMD64 rehearsal passed against that immutable image. It retained
legacy v3/v4 restore/rotation tests, then exercised seven generations, SQL-first
protection, first-marker hard-link interruption, absent second-marker recovery,
restricted-role refusals, missing/tampered marker refusal, stale metadata refusal
and an interrupted unprotected retirement. Two historical protected files and
two current rolling files remained. All 109 synthetic bindings remained; there
were zero provider calls. Exact labelled test resources were removed and cleanup
was verified. Narrow filesystem cutpoints were reconstructed, not actual
kill-at-instruction tests. Scheduling timestamps were advanced only before holds
became immutable, without resetting attempts or inference counters.

The extended capacity case passed with 100,000 bindings and 117,157,377 canonical
bytes across all seven history tables. Three independently restored dumps were
67,587,332 / 67,587,805 / 67,588,280 bytes. The first two remained protected when
the third became current. A real restore kill and cancellation kept the same
pending archive and attempt; re-verification completed. A real export kill after
observed partial output left attempt 1 interrupted across restarts, with source
fingerprints unchanged. The 805,175,296-byte storage reservation boundary passed;
one extra byte and insufficient actual free space were both refused.

Completed capacity coordinators peaked at 130,809,856 bytes and verifiers at
491,552,768 bytes. Successful exports took 7.4–10.1 seconds and successful
restores 14.2–26.2 seconds including fixture observation. No completed worker had
OOM, memory-limit or PID-limit events. Deliberate kills had exit 137 and
`OOMKilled=false`; no final peak is claimed for killed workers. Provider calls
were zero and labelled-resource cleanup was verified.

The oversized shape contained 322,656,529 canonical bytes. Direct scanning and
the automatic exporter refused it safely, preserved the prior verified copy,
consumed attempt 1 and honored cooldown after restart. The refusing coordinator
peaked at 48,885,760 bytes and completed in 12.0 seconds. No new partial archive
directory appeared. This is bounded refusal evidence, not successful restoration
of oversized data. Provider calls were zero and cleanup was verified.

Graceful exporter cancellation after observed partial output retained attempt 1,
persisted its cooldown, and preserved source fingerprints across restart. Peak
coordinator memory was 51,208,192 bytes; no OOM or PID-limit event occurred.

The unchanged-pressure case independently restored two 99,998-binding exports.
Both used the same revision, with attempts exactly `[1, 2]`; one ready protection
group fenced both jobs. A later assessment created no third job. Source
fingerprints remained identical. Coordinator peak was 127,262,720 bytes and
verifier peak 491,921,408 bytes. Successful exports took 7.7–8.5 seconds and
restores 13.9–16.0 seconds, including fixture observation.

All four extended cases passed on the same immutable image, with zero provider
calls and verified cleanup. Workers retained their limits: coordinator 256 MiB,
half CPU and 32 PIDs; verifier 1.5 GiB, one CPU, 64 PIDs and 1 GiB tmpfs. Docker
settings and kernel cgroup v1 limits matched. The source used 2 GiB/two CPUs;
workers had no network or swap. The verifier received no source credentials,
source socket or Docker socket. The observer shared each worker's limits.

## Backup and deployment boundary

Retained `data/backups/gateway-archive-protection-before-20261016.dump`,
76,253,712 bytes, SHA-256
`412BE8F1A06DE29AE5F63B2CFEB9EE23E3F6BD263DE12134CA777877D8ADFA79`.
`pg_restore --list` succeeded with 1,933 lines; this application backup was not
restored. The previous healthy image is protected by rollback tag
`classifarr-local-rollback:f62b600893bd1a64ee9cefffbe01eea12e0e106275f70b7e5b3f0900d79b0477`.

Pre-replacement SQL confirmed both optional namespaces were absent. Evaluation
settings were `when_idle`, zero daily calls/tokens/reserved calls, revision 2,
next check `2026-10-09 16:50:11.617278-04`.

Replaced only local `classifarr` using the tested image and
`--no-build --no-deps --pull never --force-recreate --wait`. It became healthy
with zero restarts and no OOM. UID/GID 1000, read-only root, no-new-privileges and
the 2 GiB limit remained intact. Health and UI returned 200; unauthenticated
gateway-history access returned 401. SQL confirmed the optional namespaces remain
absent and the exact evaluation settings/timestamp above are unchanged. One
post-start observation was 421.4 MiB and 7.40% CPU, not a peak-load benchmark.
No gateway, archive worker, AI evaluation or production change was activated.
The unrelated local Harmoniarr container remained running and was not replaced.

The follow-up documentation commit does not alter the tested runtime source.

## Limitations and next recommendation

These are synthetic local checks, not Unraid load evidence or a published-release
upgrade. The normal application backup restore, ARM64, cgroup v2, full repository
coverage, every possible crash cutpoint, disk exhaustion during publication and
the passage of 30 real days were not exercised. This is not off-host disaster
recovery. Unraid, Plex and shared Ollama remain unchanged.

Next: bounded transactional cleanup with fresh candidate-row checks and atomic
deletion-completion receipts. Those receipts must start the minimum 30-day
recovery clock before any later expiry mechanism can release protected files.
Insufficient capacity must pause cleanup, not shorten recovery retention.

GitHub MCP returned no open Classifarr PRs on 2026-10-16. No closed PR was
substituted and no PR was merged.
