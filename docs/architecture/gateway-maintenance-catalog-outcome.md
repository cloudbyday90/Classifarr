# Gateway maintenance-catalog recovery — outcome

## Status

2026-10-16: first implementation increment adds a test-only scheduling model and
private checked input for the existing optional restore verifier. Full catalog
capture/restoration and live catalog-aware scheduling remain pending. This is not
a completed maintenance-catalog backup/restore feature.

See the [design and risk review](gateway-maintenance-catalog-design.md) for official
sources, observed code paths, recommendations, tradeoffs and acceptance tests.

## Findings established

Read-only inspection of baseline `fa6f3231ebbb52299e309408678ba79647edf2c6`
confirmed that current inference archives omit the three maintenance tables.
Additional implementation risks were identified: catalog self-reference,
maintenance-only scheduling changes, live restore guards, nonportable transaction
identity, external artifact dependencies, mutable input handoff and aggregate
byte limits. These are code/design findings, not reproduced production failures.

Selected methods are lightweight FMEA/fault-tree review, executable state-model
testing, deterministic crash-boundary tests, real isolated restoration,
dependency-aware retention and durable idempotent reconciliation. Research came
from PostgreSQL, NASA, Amazon, Google SRE, restic, pgBackRest, Linux man-pages and
the RFC Editor. The design labels project-specific conclusions separately.

The important refinement is separating exact database restoration, referenced-file
availability and authorization to resume. Verification cannot grant the last one.
Two same-host copies remain a common failure domain; no off-host recovery is claimed.

## Earlier research-only verification

Markdown validation passed for 2,264 files with no errors; `git diff --check`
passed. Only documentation validation applies to this research update. No runtime tests,
model checking, fault injection, database queries, no-cache rebuild or deployment
were performed for it. The earlier cleanup rehearsal results do not validate the
new catalog design. Implementation will need the checks listed in the design.

In that earlier research-only commit, no runtime source, dependency, database, container or provider was changed. No
production activation, expiry, live restore, branch, PR merge or release occurred.
Unraid, Plex and shared Ollama were untouched. A fresh GitHub MCP check on
2026-10-16 found no open Classifarr PRs; no closed PR was substituted.

## First implementation increment

The model keeps snapshot coverage separate from retry identity. It exercises
maintenance-only changes, capture after admission, immutable historical views,
duplicate/reordered receipts, cancellation, restart, unknown publication and
exhausted budgets. It exposes the conservative consequence that catalog-only
refreshes share the existing inference revision's three-attempt budget. It does
not invent a new persisted generation format or reset policy hashes.

The verifier now copies checked dump bytes into private scratch, validates that
copy, closes its writers and gives native `pg_restore` only the private path.
It refuses insufficient scratch, changed bytes, invalid permissions and
cancellation. The trusted-host boundary and restricted restore role remain.

Initial host checks: 435 gateway unit tests in 20 suites passed, including 40 new
model/input tests. The model includes 1,620 production-scheduler comparisons and
8,192 deterministic event attempts, not exhaustive state exploration. The first
wider run lacked OpenSSL in PATH; rerunning with the existing explicit binary
passed. The PostgreSQL regression run passed 272 tests across 14 suites. Those
existing SQL/role/transport tests are regression evidence, not evidence that the
new abstract model has been persisted or that maintenance catalogs now restore.

Typecheck, test/security lint (after removing one unnecessary suppression), both
Knip modes, copyright, Markdown, static imports, ESM mock-shape and npm-flag checks
passed. The inventory ownership gate detected the changed verifier source. Its
single source digest was updated after reviewing the full diff: SQL and the
analysis digest are unchanged, connections still target the private socket, and
no live database, cleanup authority or provider access was added. The recheck
passed; no other ownership entry was refreshed. Full coverage/ratchet is not run
for this scoped increment.

Fresh GitHub MCP enumeration found no open Classifarr PRs. No closed PR was
substituted. No dependency upgrade or new table is included. Existing native
UUIDv7 storage conventions remain unchanged; test identifiers are synthetic UUIDv7.

## Rebuilt image evidence

No-cache local Compose build succeeded from clean source
`8b390dd6c8f5b3bf1d1347c53f90b32d3580ebfa`. The resulting immutable image is
`sha256:540ab15d78144886c3db3b5c894c7f1a798f4e5fe0760ce0d43d33a46e67487c`;
its source label matches that commit. Test-harness-only commit
`b8c2dd60b4f9d48990500e96133cf0020c75d0ce` adds a real small-scratch refusal check;
it changes no image build inputs. Later outcome documentation also leaves the
tested runtime unchanged. This is a local Docker image ID, not a published
registry digest or signed provenance claim.

The ordinary seven-generation image rehearsal passed, then passed again with
the final test harness. Its new real Linux
file test confirmed exact copied bytes, a distinct inode, mode 0400, refusal of
ordinary writes to the copy, unchanged private bytes after shared-path replacement,
and refusal of changed source data, public permissions, symlinks, hard links and
cancellation. A real 16 MiB scratch mount refused staging before any input directory
was created. Existing native restoration, v3/v4 compatibility, inventory tamper,
receipt publication recovery, protected-copy retention, interrupted retirement
and rotation checks passed. Synthetic live history remained unchanged, no provider
calls were made, and the runner verified removal of its generated resources.

All five capacity/interruption qualification scenarios passed for this image:

- Capacity: 100,000 synthetic bindings; concurrent admission during a paused
  export; native restore killed after observing 6,252 rows; interrupted export;
  preserved attempt 1/cooldown on cancellation; and quota/free-space refusals.
  The native restore command was checked to use the private staged input path.
- Oversize: 322,656,591 canonical bytes refused, with the previous verified
  archive retained and cooldown enforced.
- Cancellation: the consumed attempt and cooldown remained; no extra archive.
- Protection: two verified copies retained using attempts 1 and 2, with inference
  history unchanged.
- Cleanup: 200 synthetic bindings deleted through the bounded cleanup path;
  80,100 lifetime attempts preserved; archiving/rotation continued and four
  archives remained, including protected copies. This was isolated fixture data,
  not local appdata.

Every scenario reported zero provider calls and verified fixture cleanup. No
completed measured worker reported OOM, memory-limit or PID-limit events. Peak
verifier memory was 566,448,128 bytes (about 540 MiB) against its 1,536 MiB limit;
peak archiver memory was 130,875,392 bytes (about 125 MiB) against 256 MiB. The
private copy did not require larger configured limits for these fixtures.

These are Linux/amd64, local Docker/cgroup-v1 process-interruption checks. Fixture
clock changes do not prove real daily/30-day time elapsed; process kills do not
prove host power-loss durability. ARM64, cgroup-v2, off-host disaster recovery,
published-release upgrades, full catalog restoration and remote CI are not
established. Frontend tests and full-repository coverage/ratchet were not run;
the unchanged frontend compiled during the no-cache build.

Local Compose replacement completed using the exact tested image, with no rebuild,
pull or dependency-service replacement. Classifarr became healthy; `/health` and
`/` returned 200 and unauthenticated `/api/settings/ollama/gateway-history` returned
401. The container retained UID/GID 1000, a read-only root, no-new-privileges and
the 2 GiB memory limit; it had zero restarts and no OOM indication. One post-start
sample was 523.6 MiB, not a peak/soak claim.

Read-only checks found no optional gateway/archive/cleanup schemas in the ordinary
application database. Its capture-budget settings remained `when_idle`, zero daily
calls/tokens/reservations, revision 2 and the existing next-check timestamp.
Harmoniarr's container ID and start time were unchanged. Unraid, Plex and shared
Ollama were not changed; no optional gateway worker was enabled by this deployment.

Retained local backup:
`data/backups/gateway-catalog-foundation-before-20261016.dump`, 76,253,071 bytes,
mode 0600, SHA-256
`C3F559BD3400B050C034623B14C1CB14611E39F62AB94B610FB83D01FC4F2C21`.
`pg_restore --list` succeeded with 1,933 lines. This ordinary application backup
was catalog-checked, not restored. The prior running image remains protected by
`classifarr-local-rollback:58e99b45f1f2e3762d7d15205bef8d75000d72252ff720319b5545993d4c998f`.

The implementation stays on `main`, with high-level changes under Unreleased.
No release, tag, PR merge or dependency update is part of this work. A final
GitHub MCP enumeration still found no open PR to select.

## Next

Follow-up: the [capture and isolated-restore outcome](gateway-maintenance-catalog-capture-outcome.md)
records the second increment. The following was the recommendation at this first
checkpoint.

Implement bounded, same-snapshot catalog capture and exact restoration, including
the explicit reader-role contract, relationship checks and artifact dependency
inventory. Only then persist and integrate the modeled scheduling distinction;
post-capture rotation must not invalidate a recovery set. Keep expiry and
restored-worker activation disabled. No additional user approval is needed for
the already agreed scope; a broader recovery/hosting policy would need a new decision.
