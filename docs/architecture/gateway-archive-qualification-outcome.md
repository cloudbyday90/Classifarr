# Gateway archive qualification outcome

2026-10-16. Local synthetic work on main; no release or production activation.

## Delivered and defect found

Extended the existing archive rehearsal with bounded near-capacity export,
isolated restore, actual worker interruption, cancellation and storage-refusal
scenarios. The approved grill-me scope kept resource limits unchanged; the
recovery-change workflow required observed subprocess boundaries and durable
state checks rather than inferring a crash from a timestamp.

The exercise exposed a real scheduling defect. Unordered PostgreSQL count rows
changed the source fingerprint despite identical history. An export could then
report source drift, and a later assessment could bypass the failed revision's
cooldown. A regression test reproduced the different hashes before the fix.

The new ESM revision helper fixes key order and recognizes only exact legacy
permutations of the same inputs. Existing job rows, receipts, timestamps and
attempts remain unchanged. Canonical and proven legacy aliases share cooldowns
and the three-attempt budget. Both the scheduler and SQL admission preserve the
greater of consumed rows and persisted attempt ordinal. No new table, dependency,
administration function, provider request or live-history deletion was added.

See the separate [design and research](gateway-archive-qualification-design.md)
for official sources, alternatives and the recommended stack, and the
[operations guide](gateway-online-archive-operations.md) for the repeatable command.

## Host verification

- Gateway unit tests: 369 passed in 16 suites.
- Real PostgreSQL gateway integration tests: 237 passed in 11 suites.
- Existing application-pilot runner: three tests passed.
- Backend typecheck, test/security lint, both knip modes, reviewed inventory
  ownership gate, static-import and ESM mock-shape checks, copyright, npm CLI
  flags, Markdown, syntax, whitespace and staged secret checks passed.

Regression coverage includes reordered database results, existing legacy
cooldowns after reconnect, combined legacy/canonical attempts, SQL rejection
beyond three, unchanged verified/retired revisions and genuinely changed inputs.
The integration fixture advances retry timestamps explicitly; it does not claim
that the real cooldown elapsed or reset inference attempts.

Early local runs needed the existing Scoop OpenSSL path for TLS fixtures; reruns
with `OPENSSL_BIN` passed. A new fixture initially used a nonexistent admission
column for its change assertion; it now uses the real ledger completion method.
Other harness corrections included explicit SQL integer casts, support for this
host's cgroup v1 counters, inspecting exit state before reading final logs, and
using `/bin/kill` rather than adding a Node process to the 32-PID worker. None
increased production limits. No security/ownership baseline was relaxed.

## Packaged qualification

Built local Compose with `--no-cache --require-provenance` from clean source
`3c3572997ee874faf84b585e5760a6fbb53e59b0`. Image:
`sha256:25785b687c292d339b51fcc21fcca89907911e6207326f687ac4cd22d6549e23`.
The revision label matched and the frontend production build succeeded. Later
documentation does not change this packaged runtime. A successful baseline
capacity run was not treated as qualification of the candidate.

The candidate capacity case passed with 99,998 initial bindings, concurrent real
ledger admissions reaching 100,000, and matching completion receipts. All seven
tables were populated, including cyclic admission/recovery references. The three
dumps were 67,587,756, 67,588,229 and 67,588,703 bytes. Final canonical content
was 117,157,800 bytes. Source fingerprints and lifetime attempts were unchanged
across worker failures except for explicitly declared fixture admissions.

- Snapshot captured 99,998 bindings while live fixture admission advanced to
  99,999. The snapshot and restored content matched.
- Killed a verifier after native `pg_restore` reported 8,857 copied rows. No
  partial success receipt appeared; a fresh verifier reused the same archive
  and export attempt. Graceful verifier cancellation also published no receipt.
- Three verified generations rotated to two. The narrow retirement cutpoint
  was reproduced with a durable SQL marker and one missing old manifest;
  this was not a real kill at that exact instruction.
- Killed the exporter only after observing its committed job, native `pg_dump`
  and partial output. Restart marked that same attempt interrupted and refused
  another export even after fixture scheduling timestamps were advanced.
- At 100,000 bindings, the existing admission limit remained effective.
- Logical managed storage of 805,175,296 bytes passed replacement reservation;
  one additional byte failed. Sparse files tested accounting, not host disk
  exhaustion. A separate 16 MiB tmpfs tested actual insufficient free space.

Completed capacity workers peaked at 132,452,352 bytes for the coordinator and
490,975,232 bytes for the verifier. Complete export runs took 6.7–12.9
seconds and successful restore runs 16.9–20.5 seconds, including fixture startup
and observation overhead. Both actual Docker settings and kernel cgroup v1
limits matched the approved caps; completed workers reported zero OOM,
memory-limit or PID-limit events. Deliberately killed containers had exit 137
and `OOMKilled=false`; no final peak sample is claimed for those killed workers.

The oversized shape contained 322,656,069 canonical bytes. Direct content scanning
refused it with `gateway_archive_size_limit`; automatic export failed safely,
kept the existing verified copy/receipt, consumed one attempt and remained on
cooldown after restart. No new partial archive directory was created. That
coordinator peaked at 48,451,584 bytes and completed refusal in 10.7 seconds.
This is refusal evidence, not a successful restore of the oversized shape.

Graceful exporter cancellation passed after observing real partial dump output.
The one job retained attempt 1, recorded `cancelled`, and remained on cooldown
after restart; source fingerprints stayed identical. Peak was 57,028,608 bytes.
All three extended cases made zero provider calls and verified cleanup of their
exact owned containers, volumes and disposable databases. No real history or
operator archive was removed.

The observer ran inside each worker's production limits. Source fixtures used
2 GiB/two CPUs with no network or swap. Coordinator limits stayed 256 MiB/half a
CPU/32 PIDs; verifier limits stayed 1.5 GiB/one CPU/64 PIDs with 1 GiB tmpfs.
The verifier received no source credentials, source socket or Docker socket.

The existing basic online archive rehearsal also passed against the same image:
restricted source roles, reconstructed receipt-publication crash, three verified
generations rotated to two, mismatched/corrupt archive refusal, unchanged live
history, zero provider calls and verified owned-resource cleanup.

These are synthetic Linux/AMD64 cgroup v1 results, not production load estimates.
ARM64, cgroup v2, full repository test/coverage suites, every crash cutpoint,
disk exhaustion during an active write, a full 256 MiB restore and upgrade from a
published release were not exercised. Legacy retry compatibility was tested in
real PostgreSQL across reconnects, not by upgrading a published worker image.

## Local application replacement

Created and retained `data/backups/gateway-archive-qualification-before-20261016.dump`
(76,273,191 bytes), SHA-256
`844FC602F821A7548A6AA7A476DB575CA9B452ED24F9A09BCDDD62D5C68A36DB`.
`pg_restore --list` succeeded with 1,933 lines. This application backup was not
restored; the isolated restores above concern gateway archives only.

Pre-replacement application was healthy with no OOM or restart. Its image
`sha256:57376ac50641dcc49e9673e1b63f97814d4e905321a0e9af5d9a0897f2e3e632`
is protected by rollback tag
`classifarr-local-rollback:eb91e99d82098ff895a4b031a8faf62bcbb01a7ce6d5a26f109f4178afbeb893`.
Both optional namespaces were absent. Evaluation configuration was `when_idle`,
zero daily calls/tokens/reserved calls, revision 2 and next check
`2026-10-09 16:50:11.617278-04`.

Replaced only local `classifarr` using the tested image and
`--no-build --no-deps --pull never --force-recreate --wait`. It became healthy
with zero restarts and no OOM. UID/GID 1000, read-only root, no-new-privileges and
the 2 GiB limit remained intact. Health and UI returned 200; unauthenticated
gateway-history access returned 401. Read-only SQL confirmed both optional
namespaces remain absent and the exact evaluation settings/timestamp above are
unchanged. One post-start observation was 704.7 MiB and 0.72% CPU; it is not a
peak-load benchmark. No optional worker or gateway routing was activated.

## Boundaries and next recommendation

Normal Compose does not enable the optional gateway/archive schemas or services.
Unraid, Plex and shared Ollama remain outside this work. Archive receipt success
still has `purgeAuthorized: false`; uncertain export termination remains blocked.

Retain Node ESM, PostgreSQL 18/native UUIDv7, online read-only snapshots and an
isolated restore verifier. Next: design bounded receipt-backed history cleanup
with fresh transactional eligibility and durable archive pins. Automatic purge
must not be enabled from age, a checksum or an expired lease alone. Row-capacity
relief and physical database disk reclamation are different operations.

GitHub MCP enumeration on 2026-10-16 returned no open Classifarr PRs, including
the final selection check. No closed PR was substituted and no PR was merged.
