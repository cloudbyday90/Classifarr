# Bounded gateway cleanup — outcome

## Status

Implementation and local verification completed on main, 2026-10-16. No production
activation, branch, release or PR merge. The approved scope, research, alternatives
and stack are in the [design](gateway-bounded-cleanup-design.md); explicit optional
installation is described in [operations](gateway-bounded-cleanup-operations.md).

The cleanup extension adds native UUIDv7 operations, narrowly granted routines,
fresh transactional row checks, durable attempt/cooldown accounting, and separate
post-commit confirmation. A new constrained worker shares maintenance exclusion
with the archiver, without taking the lifetime inference lock. All recovery holds
remain indefinite because expiry is not implemented. Newer recovery pairs share
the original exact-batch retry budget.

Archive continuation retains the existing manifest and exact-prefix verification:
all pre-deletion verified copies must be protected, and the current pair must
cover the exact batch. Post-deletion copies establish a new rolling set; protected
historical copies remain. No ordinary application schema migration is introduced.

## Verification

Host checks: 412 gateway unit tests across 19 suites passed; the broader gateway
PostgreSQL run passed 193 tests across 13 suites. All 11 cleanup integration tests
also passed separately. These include
real restricted-login checks, rollback, committed-but-unconfirmed recovery,
preserved retry budgets across replacement pairs, lifecycle/row drift refusal,
maintenance exclusion and actual inference claim/completion after deletion.
The routines force synchronous commit even if the session default is disabled.

Typecheck, test/security lint, both Knip modes, copyright, inventory ownership,
Markdown, static-import, ESM mock-shape and npm-flag checks passed. No security or
ownership baseline was refreshed. The four implementation commits also passed
a combined secret scan. Full repository coverage and its ratchet were not run.
Early SQL testing found an administrator-session role-switch test was insufficient;
the test now connects with a real restricted login. A Windows unit-test invocation
also required the existing explicit OpenSSL path; it did not identify a code bug.

## Image evidence

No-cache local Compose image:
`sha256:79edebbc8115b81c5a4eb2c9d86e58806bf47b9b08cb310b6b783bde0e47f16d`.
Its verified source label is `32936118f906e60cd4c2d35e3c1b9f5b1360eadb`.
The focused `--cleanup` rehearsal passed against this image. It used the packaged
SQL, repositories and actual worker in isolated Linux containers, with synthetic
history, no external network and zero provider calls.

It refused a tampered marker before admitting work, then removed exactly 100 old
terminal bindings and their completions after fixture repair. Repeating the worker
left the receipt unchanged. Native restores and ordinary archive rotation continued
after deletion while the original pair remained protected. After new inference
claims and a second protected pair, the worker refused the five-minute cadence;
the fixture then advanced only `last_attempt_at`, never attempts, completion or
confirmation times. A reconstructed committed-but-unconfirmed second transaction
was confirmed on worker restart, without repeating deletion. This is a reconstructed
cutpoint, not a process kill at that exact boundary. Final resident count was
79,900; lifetime attempts advanced to 80,100; two batches deleted 200 synthetic
bindings and four protected archives remained. Test resources were removed and
their removal verified.

The fixture also moves archive scheduling timestamps by 25 hours; it does not
prove a real daily interval, five-minute interval or 30-day recovery period elapsed.
SQL tests separately cover restart attempts, rollback, role restrictions, source
drift and competing inference. The full image qualification passed all five cases:
near-capacity history, oversized history, cancellation, protected paired copies
and cleanup. Each case verified removal of its labelled test resources. The
ordinary seven-generation archive regression also passed: mixed v3/v4 rotation,
inventory tamper and legacy receipt refusal, interrupted receipt publication,
corruption refusal, protected-copy retention and interrupted retirement. Its
synthetic live history stayed unchanged, with zero provider calls and verified
resource cleanup.

The capacity case admitted inference during an observed export, killed an active
restore and later an active exporter, and retained safe pending/interrupted states.
The oversize case exercised 322,655,611 canonical bytes and preserved the existing
verified archive after export refusal. Cancellation retained the consumed attempt
and enforced cooldown. Storage checks refused both one byte over the logical
reservation boundary and genuinely insufficient free space on a small tmpfs.

Largest reported kernel memory peaks among completed qualification workers:

| Worker | Observed peak | Configured limit | Completed metric records |
| --- | ---: | ---: | ---: |
| Archiver | 120.44 MiB | 256 MiB | 29 |
| Isolated verifier | 468.34 MiB | 1,536 MiB | 12 |
| Cleanup | 35.95 MiB | 256 MiB | 5 |

No reported OOM, memory-limit or PID-limit event occurred. Cleanup's longest
observed complete worker run was 4,660 ms, including file verification and setup,
not just one SQL statement. Docker and cgroup v1 checks verified no swap, half a
CPU/32 PIDs for archiver and cleanup, and one CPU/64 PIDs for the verifier. Workers
used UID/GID 1000, read-only roots, dropped capabilities and no network. The
verifier had no source socket, configuration mount or credentials. Source fixture
containers were capped at 2 GiB/two CPUs; their peak use was not measured here.
Optional cleanup Compose validation passed with synthetic paths; it started no
service. These measurements are local synthetic evidence, not Unraid load tests.

## Problems caught before deployment

The first one-second SQL budget passed host checks but repeatedly cancelled the
real image's cold transaction with SQLSTATE 57014. No deletion committed. A bounded
fixture diagnostic rolled back every write and captured nested plan/trigger timing:
one replay took about 895 ms; another about 533 ms, including a first DELETE guard
around 184 ms and foreign-key checks. JIT availability was false. These are local
observations, not universal performance guarantees or a demonstrated I/O root cause.
The worker now allows three seconds per SQL statement and five seconds for the
client response, retaining 100 ms lock waits/NOWAIT checks and the 100-row cap.
Sanitized errors distinguish server cancellation, contention and permission failure.
No global database settings or production diagnostics were changed.

One subsequent no-cache build failed because Docker could not resolve
`codeload.github.com`. Retrying succeeded without changing the pinned pgvector
version, checksum or image provenance rules.

## Backup and deployment boundary

Retained `data/backups/gateway-bounded-cleanup-before-20261016.dump`, 76,253,069 bytes,
SHA-256 `BDFA7E0C81FB184C57129FF47C53298F0501359BE162171F865BC2C249F2998F`.
`pg_restore --list` succeeded with 1,933 lines; this ordinary application backup
was not restored. The previous healthy image is protected by rollback tag
`classifarr-local-rollback:fa3f830a366a1f0b21eb9eb04c126631901fb368b1dadbdc783b345b6e524670`.

Pre-replacement SQL found no `ollama_gateway`, `gateway_archive` or `gateway_cleanup`
namespace. Evaluation settings remained `when_idle`, zero daily calls/tokens and
reserved calls, revision 2, next check `2026-10-09 16:50:11.617278-04`.

Replaced only local `classifarr` with the tested immutable image, using
`--no-build --no-deps --pull never --force-recreate --wait`. It became healthy with
zero restarts and no OOM. Health and UI returned 200; unauthenticated
`/api/settings/ollama/gateway-history` returned 401. UID/GID 1000, read-only root,
no-new-privileges and the 2 GiB memory limit remained intact. Post-replacement SQL
confirmed all three optional namespaces remain absent and the exact evaluation
settings/timestamp above are unchanged. No gateway, archive worker, cleanup worker
or AI evaluation was activated. The unrelated Harmoniarr container retained its
original ID/start time and stayed healthy. Unraid, Plex and shared Ollama were not
modified. The final documentation commit changes no tested runtime files.

GitHub MCP returned no open Classifarr pull requests on 2026-10-16. No closed PR was
substituted. Unraid, Plex and shared Ollama remain untouched.

## Next boundary

Back up and verify restoration of the complete maintenance catalog, then implement
protection expiry using confirmed deletion plus the minimum 30-day window. The
current 1 GiB storage cap can safely pause cleanup after only a few full-copy
batches; this is not a sustained high-throughput compaction claim.

These tests do not establish a published-release upgrade, off-host disaster
recovery, ARM64/cgroup v2 behavior, every crash cutpoint, a real 30-day retention
period, or sustained production latency. The ordinary application backup was
catalog-checked, not restored. Protected recovery copies never expire in this
increment; cleanup is not enabled outside explicitly isolated fixtures.
