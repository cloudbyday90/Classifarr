# Source-pair worker profile budget outcome

November 24, 2026. See the [design and recommendations](source-pair-profile-budget-transport-design.md).

The learned-profile cap is reachable within the normal parent limits.
A synthetic 4,500-description fixture with 32 distinct genre terms per
description reproduced the overflow inside the real worker. A second fixture
used multiple library memberships to reproduce the same limit. Both used the
normal corpus, metadata projection, evidence transport and fitting path.

The automatic worker now sends one fixed code for the privately identified
feature overflow. The parent requires the exact own-field shape and
completed vector transfer before recreating the budget reason. The same
`evidence_budget` reason can now describe a verified child overflow at
the `evaluation` stage. The transport carries no raw cause or input.

An initial real-worker test exposed that cloned records can arrive with
another realm's prototype. The validator now checks the plain record
structure and value descriptor across realms. A spoofed message, wrong
budget mark, premature or mixed reply cannot supply the reason. Capture
and quality study retain their existing error behavior.

## Verification

- All 151 focused tests and 32 isolated PostgreSQL tests passed. The
  real worker's feature limit records `evidence_budget` at `evaluation`
  with cooldown and no evaluation report, history or sweep publication.
- Root, server and client npm audits returned zero advisories. Lint,
  type checking, CI preflight, and the policy and import gates passed.
- The full backend run passed 64,727 tests across 1,958 suites, with one
  test skipped. The coverage ratchet passed with unchanged client inputs
  and verified client coverage report hashes.

## Local Compose rebuild

Docker Desktop built `classifarr:archive-binding` with `--no-cache` from
clean revision `935ebed7ae9380149131cd2002c0d3655a1f821e`. The resulting
`linux/amd64` image ID was
`sha256:4263454258f113d77f63f2203bce079b15f9d0d956586470dbbbee9edd8a415f`.
The same image started in a disposable container with networking disabled
and bounded resources. Its fresh schema matched the checked-in snapshot.
The test container and its temporary data were removed.

Before replacement, the previous image was retained under
`classifarr:pre-profile-budget-20261124-082543`. A private PostgreSQL
custom-format archive passed archive listing, full decompression, and
checksum recording. The archive was kept with the local backups. A restore
into another database was outside this verification.

Compose recreated only the local Classifarr service. The running image ID,
mounts, non-root user, read-only root, and 2 GiB memory limit were verified.
The first probe arrived before the listener opened. Docker reported healthy
about 10 seconds after startup. The loopback health endpoint, app shell,
and compiled JavaScript each returned HTTP 200. Node reported 24.22.3.

PostgreSQL upgraded from 18.6 to 18.7 and retained pgvector 0.8.7. Startup
applied 13 existing migrations. The resulting database accounted for all
343 tracked SQL migrations, 10 libraries, and 6,880 History rows. After 161
seconds of observation the service was healthy with zero restarts.
Five slow-query warnings were observed, with the longest completing in
2.43 seconds. No application errors were observed in that window.

## Next recommended item

Review the exact revision's release checks and startup evidence before
release preparation. Continue UUIDv7 work after the release sequence.
