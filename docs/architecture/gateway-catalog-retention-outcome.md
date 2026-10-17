# Gateway catalog retention — outcome

Date: 2026-10-17. See the [design](gateway-catalog-retention-design.md).

## Implemented boundary

An optional, separately installed PostgreSQL registry stores catalog recovery-set
identities and immutable file dependencies using native UUIDv7. Registration binds
a real root bundle, a distinct isolated-verifier result and a rederived bounded
inventory. It does not turn that result into an inference receipt or live cleanup
authorization. Root history does not become another root's file dependency.

Three active sets bound replacement: two retained copies plus one replacement.
Both surviving sets must pass file/dependency checks before an older root can be
retired. Fixed-file deletion preserves dependency pins until the final retired
write. Shared dependencies remain pinned by other roots. SQL guards also protect
referenced archive records and immutable index rows. Partial registration rolls
back; uncertain retirement remains pinned. No attempt or cooldown is reset.

The internal capture seam supports separate catalog/inference directories while
counting their managed bytes together. The old coordinator refuses new work when
registered catalog roots require integration it does not yet support. There is
no new timer, HTTP action, configuration switch or automatic schema migration.
The registry itself is local retention bookkeeping, not part of the older v5
snapshot and not an off-host backup.

## Verification checkpoint

470 gateway unit tests passed. The first broad unit invocation omitted the local
OpenSSL path and failed TLS-fixture setup; rerunning with the existing configured
OpenSSL binary passed without changing application behavior. The final SQL pass
passed 296 gateway tests across 16 suites, including 13 new registry tests.
Tests cover UUIDv7, duplicate registration, immutable indexes, shared and final
pins, reconnect/lock refusal, catalog-ancestry refusal, atomic rollback,
cancellation and the legacy-coordinator integration gate.

Typecheck, both Knip modes, test/security lint, Markdown, copyright, static-import,
ESM mock-shape and npm CLI checks passed. The ownership gate passed without a
baseline refresh; its pre-existing `productionCompatible: false` and unresolved
inventory paths remain, not waived.

The initial no-cache image passed the existing online archive rehearsal and the
new retention extension. Three actual v5 captures passed native isolated restore
before registration. The extension tested separate-directory combined capacity,
invalid verification refusal, idempotent registration, cancellation, damaged
replacement refusal and resumed fixed-file retirement. Two retained copies and
their shared dependencies survived; three historical root rows and attempts
1/2/3 remained. Generated containers, volumes and scratch were cleaned up and
cleanup checked by the runner.

The byte-accounting case used 600 MiB and 300 MiB sparse synthetic files; it is
not a large-dump throughput measurement. The retirement fixture explicitly wrote
retiring and removed its manifest before a new process resumed. That is a staged
crash boundary, not a host-power-loss or mid-unlink process-kill experiment.
Between native captures, the fixture explicitly cancelled its previous exporting
job and admitted the next consumed attempt without waiting for scheduler delays.
This proves no budget reset, not automatic completion or elapsed cooldowns.

The finalized source `7da29def1230fcee0d475f8155c85d6f8d4427c7` was rebuilt with
`--no-cache --require-provenance --protect-running-image`. The local Linux/amd64
image ID is
`sha256:6b07d740c0ea62532772fa6c80d7890b342f52fe4798e2ecceb9f18b8a0fbc3e`.
It is a local Docker image identity, not a signed registry publication. The entire
ordinary online archive/catalog/retention rehearsal passed again against this
exact image, including verified test-resource cleanup. The documentation follow-up
changes no packaged application input.

The focused legacy `--cleanup` qualification also passed against this final image
and verified resource cleanup. It exercised synthetic deletion of 200 bindings,
continued rotation with four retained inference archives, preserved 80,100
consumed admission attempts and made zero provider calls. This checks the shared
file-handling regression, not activation of catalog scheduling. Observed worker
peaks were 116,924,416 bytes for archiving, 510,230,528 bytes for verification and
40,263,680 bytes for cleanup, with no recorded OOM or PID-limit events. Only this
qualification scenario was rerun, not the complete five-scenario matrix.

Local Compose replaced only `classifarr` using that exact image, without pulling
or rebuilding during replacement. Container
`3c62327fc048e0a8bb6111f80750ea79e67c07cf3fcdc98736561961fa8a3459`
is healthy, with no OOM kill or restart. `/health` and `/` returned 200; the
unauthenticated gateway-history endpoint returned 401. UID/GID 1000:1000,
read-only root filesystem, no-new-privileges and the 2 GiB memory limit remain.
One post-start sample was 520 MiB; this is not a peak measurement.

The normal application database still has none of the optional gateway schemas,
including `gateway_catalog`. Its capture budget remains `when_idle`, zero daily
calls/tokens and reservations, revision 2, with the unchanged next-check time.
The unrelated Harmoniarr container ID and start time match the pre-replacement
baseline. No live registry or automatic catalog work was enabled by this test.

The retained ordinary application backup is
`data/backups/catalog-retention-before-20261017-1934.dump`, 76,238,683 bytes,
mode 0600, SHA-256
`79B4C17B2BED3F0EFC9FAF0597C31D39766A18CFC17F5B365CD152172128B596`.
`pg_restore --list` succeeded with 1,933 lines; this ordinary application backup
was catalog-checked, not restored. The previous image remains protected by
`classifarr-local-rollback:8abda82182bf0af96f8c5389583f0472b19c0c80ded1e4e1929ba42815d8d12a`.

This does not establish maximum-size catalog/index throughput, ARM64 behavior,
host power-loss durability, off-host recovery or a published-release upgrade.
Full-repository coverage/ratchet and frontend tests were not run; the unchanged
frontend compiled in both no-cache images. Remote CI was not evaluated.

## Remaining integration

Independent catalog admission must replace v5's verification-only exporting-job
seam, preserve combined original retry budgets, and integrate the initial/daily/
capacity schedule with both storage directories. No live scheduler is enabled by
this increment. Protection expiry, restored-worker activation and production
deployment remain outside scope. Unraid, Plex and shared Ollama are untouched.

A fresh GitHub MCP enumeration found no open PR to select. No PR is substituted
or merged, and no release/tag is planned.
