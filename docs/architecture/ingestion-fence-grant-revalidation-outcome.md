# Ingestion fence: grant revalidation outcome

Date: 2026-10-04. Branch: `main`. No release or production cutover.
See the [design and official research](ingestion-fence-grant-revalidation-design.md).

## Result

The disposable authenticated-role gateway now refuses observed authority drift
before admission, an item write or completion. Its private SQL assertion checks
the real authenticated login, registered role attributes/membership, effective
table/column/routine/schema privileges, private-state access and legacy sessions.
It clears cached activity before inspecting sessions and requires READ COMMITTED.
It does not silently repair grants, terminate writers or claim legacy ownership.

The implementation remains in `server/src/scripts/ingestionWriterFence`, behind
the existing test-environment and disposable-suite-database admission checks.
There is no new migration, runtime hook, service, timer, UI or deployment option.
No W3C-facing behavior changed. The ESM installer loads one additional fixed SQL
module inside its existing atomic installation/revocation transaction.

## Verification

- Red regression: restoring writer UPDATE access allowed the old candidate to
  retire a legacy marker. The new authority check rejects this before mutation.
- Second red regression: activity cached earlier in a READ COMMITTED transaction
  hid a reopened legacy session. Clearing that snapshot makes the write refuse.
- Real PostgreSQL 18 integration: **154 tests, 5 suites passed, no skips**. This
  includes 38 new authority cases, 25 existing writer-fence cases and existing
  legacy reconciliation, library recovery and recovery-progress suites.
- Focused unit tests: **180 tests, 11 suites passed, no skips**. Ordinary runtime
  environments still refuse the prototype before issuing SQL.
- Full backend ESLint, backend typecheck, both Knip dependency checks, Markdown lint,
  copyright, static ESM-import, migration and schema-integrity checks passed.
- Ownership review explicitly covers the new fixed assertion and changed
  installer/lifecycle files. The gate passes with **501 unresolved entries**
  unchanged; `productionCompatible` remains false. Passing means no unreviewed
  drift, not that production writers are all fenced.

Tests used independent authenticated clients in disposable suite databases,
synthetic libraries and generated roles. Fixture teardown closes clients, drains
only its generated identities and removes those roles. The first test draft also
exposed duplicate synthetic URLs and teardown ordering; both fixture defects were
corrected before the complete green runs. Local checks used Node 24.21.0.

## Image and local evaluation

- Tested code commit: `2210b3604ac2191a480bc4b87817a30e025ddfdd`.
- No-cache local build succeeded with that `VCS_REF`; the client production build
  and npm installations succeeded with no dependency warnings. Build-time npm
  audit reported zero vulnerabilities; this is not a replacement for remote OSV.
- Local image ID:
  `sha256:a2ae9fc4466a87521205097afd3af934c1105cf741be923274f3793156cbfe79`.
  This is a locally built image, not published multi-platform release evidence.
- The image passed all ten owned PostgreSQL startup-smoke checks: delayed startup,
  foreign-owner refusal, committed-data crash recovery, verified worker PID reuse,
  foreign PID refusal, native signal retention, timeout, cancellation, invalid
  configuration and entrypoint TERM/INT forwarding. Its disposable container was
  removed after the run.
- After the build, `dump-schema` used this image's PostgreSQL 18.6 in a disposable,
  network-isolated database. It loaded the committed schema, dumped it, loaded
  the result into a second empty database and dumped again: **zero drift** from
  the committed snapshot. No application database was used for generation; the
  owned fixture was removed. No schema artifact change was needed.
- Only the local `classifarr` Compose service was recreated, preserving its data
  and media mounts. Container `b67cfcc0bbed` started at
  `2026-10-04T19:05:59.635744985Z`, healthy with zero restarts/OOM events. It runs
  Node 24.21.0, PostgreSQL 18.6 and pgvector 0.8.7. The packaged authority SQL hash
  matches the reviewed source, and the prototype schema is absent from appdata.
- After the normal startup cycle, all eight owned imports were complete and
  updated during this start. Two `legacy_owner_unknown` warnings remained; no
  ERROR entries were recorded for this container in that observation window.
  Existing running markers remain library 4: two, library 5: six, with no invented
  `library_ingestion_state` rows for either library.
- Resource samples: startup CPU reached 49.94%; the later sample was 0.55% CPU,
  388.3 MiB of the existing 2 GiB limit and 38 PIDs. This short observation does
  not certify sustained capacity. Compose still has no explicit CPU/PID limit;
  no resource settings were changed in this round.

Unraid and unrelated local containers were untouched. The following documentation
commit only records this evidence; it does not change the tested image's code.
Prior-source CI run `37224995307` succeeded, but it is not evidence for this new
commit. Current-source remote CI must be checked independently after push.

## PR and remaining work

Saved GitHub CLI authentication returned **zero open pull requests** on
2026-10-04. No PR was selected, merged or represented as open.

This work does **not** resolve today's `legacy_owner_unknown` warnings. Local
Docker and Unraid have separate databases; sharing Plex does not make one
installation the owner of the other's import. A rebuild cannot establish which
historical writer created an unowned local running marker.

Next: complete the protected production identity/maintenance handoff and remaining
writer adapters, then rehearse an actual old-image upgrade and restore. The
application must lose bypass access before automatic legacy retirement is safe.
Retain reviewed recovery in the meantime; do not fabricate ownership or use age
as evidence. Recovery completion remains full import plus metadata, not optional AI.

The guard is a fail-closed drift check, not containment of a trusted administrator
who can change grants or replace functions concurrently. It covers the candidate's
fixed boundary, not arbitrary extensions or unported production writers. Its
benefit is refusing an invalid boundary; the cost is per-call catalog inspection
and manual review of unexpected grant changes. Production throughput remains to
be measured when the complete gateway is integrated.
