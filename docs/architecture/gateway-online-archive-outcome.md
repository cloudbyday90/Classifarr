# Automatic gateway archive outcome

2026-10-16. Main branch; no release or production activation.

## Delivered

Implemented optional online archive coordination and a separate restore verifier.
The agreed grill-me decisions define automatic first/daily-if-changed/capacity
checks, two retained verified copies, a 1 GiB file budget, and continued inference.
The recovery-change workflow drove durable UUIDv7 jobs, separate retry accounting,
conservative interruption handling, and real database/container verification.

Small ESM modules separate scheduling, jobs, consistent source snapshots, bounded
content fingerprints, files, verification and rotation. New optional maintenance
tables use native PostgreSQL UUIDv7. Their explicit standalone migration does not
create gateway tables during normal application startup. Existing offline CLI
behavior is preserved. No new dependency, client API or administration button.

The [design](gateway-online-archive-design.md) records official October 2026
sources, alternatives, pros/cons and the recommended stack. The separate
[operations document](gateway-online-archive-operations.md) describes restricted
roles, deployment boundaries, limits and failure states. The optional Compose
template contains two workers; it is not included in the normal application
deployment. Source export and restore deliberately have different credentials,
mounts and responsibilities. The verifier has no source socket or network.

## Verification

- Gateway unit tests: 16 suites, 380 tests passed.
- Real PostgreSQL/HTTP integration: 11 suites, 235 tests passed, including six new
  tests for concurrent online snapshots, read-only transactions, cancellation,
  exclusive coordination, native UUIDv7, restart-persistent attempts/cooldowns,
  interrupted-export refusal and complete/prefix content fingerprints.
- Existing host application-pilot runner: three tests passed.
- Backend typecheck, test/security lint, both knip modes, static-import and ESM
  mock-shape checks, reviewed inventory ownership gate, copyright, npm CLI flags,
  Markdown, whitespace and staged secret checks passed.
- The optional Compose template passed `docker compose config --quiet` with
  synthetic paths and the tested immutable image. It disables the inherited app
  HTTP healthcheck and enables an init/reaper; neither worker serves HTTP.

The first SQL test run exposed an incorrect fixture-relative schema path; that
test harness was corrected and all affected tests rerun successfully. The
ownership gate identified the verifier's indirect schema query and catalog-based
FK alteration. Reviewed the complete private-cluster caller/query chain and
updated only that source entry plus the existing isolated-work review rationale.
No ownership-gate limit or legacy classification was relaxed.

Full repository backend/frontend test suites, global coverage ratchet, ARM64,
near-capacity full restores and abrupt termination during a large online export
were not exercised. New export interruption was tested as durable SQL state;
receipt-publication interruption was reproduced as the write/link/unlink boundary.
These are not claims of exhaustive crash-cutpoint coverage or production load.

## Packaged image evidence

Built normal local Compose with `--no-cache --require-provenance` from clean source
`3d1c54965ed7bcb973cee1934d373549ce92b97a`. Immutable image:
`sha256:57376ac50641dcc49e9673e1b63f97814d4e905321a0e9af5d9a0897f2e3e632`.
The revision label matched. Later fixture/document/optional-template changes do
not change the packaged runtime. Frontend production build also succeeded.

All three packaged rehearsals passed against that image:

1. New online archive rehearsal: source export while inference ownership remains
   held; restricted database roles; matching durable receipts across worker
   restarts; three verified archives rotated to two; all seven tables populated,
   including cyclic admission/recovery references; unchanged live history and
   lifetime attempts. Wrong receipt hashes and corrupted archives were refused.
   Incomplete files counted against storage limits, operator-owned files remained
   untouched, and interrupted receipt publication recovered without overwriting.
   The verifier ran non-root with no network, read-only root/input, no source
   credentials/socket, bounded scratch/memory/CPU/PIDs and no Docker socket.
2. Existing network-none gateway rehearsal: credential lifecycle, streaming,
   provider identity, request history, abrupt inference termination, offline
   recovery, original archive formats and retention review remained passing.
   Its main scenario reported 19 synthetic calls; separate scenario counts are
   distinct. No live provider was used.
3. Existing internal-network application rehearsal: TLS, direct-provider refusal,
   declared request identity, normal application startup, unavailable gateway and
   same-image replacement passed. Exactly two synthetic provider attempts.

The online rehearsal made zero provider requests. Its coordinator executed inside
the bounded synthetic source container; this does not certify the optional
256 MiB coordinator deployment limit under a large ledger. The verifier's
separate 1.5 GiB/one-CPU sandbox was exercised. Fixture clock advancement made
daily jobs due without refunding inference attempts; a real day did not elapse.
All runners verified cleanup of their exact owned resources. Synthetic archive
files and test databases were removed with those disposable resources; no real
history or operator archive was removed.

## Local application replacement

Before replacement, created the retained application backup
`data/backups/gateway-online-archive-before-20261016.dump`, SHA-256
`3310D3214E541185185B3ED71E0599F22BBAD12335023202B1E8F50789F598F5`.
`pg_restore --list` succeeded with 1,933 lines; this application backup was not
restored. The baseline was healthy, with zero restarts/OOM. Both optional schemas
were absent and evaluation configuration remained `when_idle`, zero daily calls,
tokens and reserved calls, revision 2, next check `2026-10-09 16:50:11.617278-04`.

The prior image remains protected by rollback tag
`classifarr-local-rollback:ffdf6e97d182988d64b750e36896907e57097980e1b9734c5fa4a05bd43d18a9`,
pointing to `sha256:ac44c3f7143e1c67363ab4a4f31f4e97af81df046302ce200554ac22217fa95c`.
Replaced only the local `classifarr` service with the tested image using
`--no-build --no-deps --pull never --force-recreate --wait`. It became healthy
with zero restarts and no OOM. UID/GID 1000, read-only root, no-new-privileges and
the 2 GiB memory limit remained in place. Health and UI returned 200; unauthenticated
gateway-history access returned 401. Read-only SQL confirmed both optional schemas
remain absent and the exact evaluation configuration/timestamp are unchanged.
One post-start observation was 415.2 MiB and 0.91% CPU; this is not a peak-load
benchmark. No optional archive service, gateway or shared-provider routing was
enabled in the normal application.

## Remaining boundary and next item

No live database history deletion, provider recovery, automatic release, Unraid
change or shared Ollama change is included. Missing or uncertain verification
pauses archival rather than assuming success. The first snapshot gives one
verified copy; a second changed-history snapshot establishes two retained copies.
Local copies are not off-host disaster-recovery backups.

Next: qualify near-capacity export/restore and abrupt worker failure, then design
bounded receipt-backed history cleanup with fresh transactional eligibility and
archive pins. Physical database disk reclamation is separate from row-capacity
relief. Do not enable purge from a checksum, age or expired lease alone.

Two GitHub MCP queries on 2026-10-16 returned no open PRs. No closed PR was
substituted and no PR was merged.
