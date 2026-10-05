# Protected maintenance handoff outcome

Date: 2026-10-05. Base: `1cdbf9aaa501486e4c1280621307fb6c9932feea`.
See the [design, sources and tradeoffs](selected-maintenance-handoff-design.md).

## Implemented

Added modular ESM contracts, launcher and one-shot worker for schema and restore
maintenance against the fixed selected database. The worker validates actual
separate OS accounts and a constructed environment before database/service imports.
It refuses dotenv configuration, inherited credentials and arbitrary targets.
Restore input stays on bounded stdin; child output is bounded and discarded.

The selected startup fixture now uses this launcher instead of its ad-hoc schema
command, with a supervisor deadline that accommodates the schema worker's bound.
Schema CLI refusal preserves the typed unfinished-restore result after cleanup.
Normal startup still requires success. Existing SQL locks, quarantine, migration
checks, source preservation and child join ordering are unchanged.

Added real-image checks for peer-identity refusal, busy schema/restore admission,
invalid encrypted input, killed restore quarantine, schema refusal and verified
merge/replace followed by selected startup. Synthetic blocker sessions are labelled
and explicitly terminated in the disposable database, since disconnecting a client
does not necessarily end a running server query immediately.

This increment **does not activate production conversion or unattended legacy
ingestion recovery**. It adds the reusable protected maintenance handoff, not the
remaining runtime dispatcher, custom-path support or complete ingestion fences.
Saved forced-non-root templates remain on their current compatible path. No schema,
API, deployment template, dependency or version change; no release.

## Verification

The preceding [CI run 37253720051](https://github.com/cloudbyday90/Classifarr/actions/runs/37253720051)
passed for the base revision, including database tests, fresh/published upgrade,
build/tests and release readout. Publication jobs were skipped. That is baseline
evidence, not CI evidence for this new change.

Final focused run: four suites, 149 tests passed. Full backend unit run: 1,686
suites passed, 52,022 tests passed and one skipped, in 300.382 seconds. The existing
Linux directory-fsync unit is skipped on Windows; real Linux filesystem checks
remain required in the image drill. Server lint/typecheck, CI
preflight, ESM static import/mock checks and Markdown lint passed. The changed
ownership entries were individually reviewed, not blanket-refreshed. Current gate:
19 owned, 276 separately coordinated, 502 unresolved; production-compatible false.
Fingerprint: `36993d7c1dedd05a23eb47678e156fc150ec7cce700effd8c6e847bde8671819`.
The recovery and release-evidence skills guided bounded processes, isolated image
tests and the explicit limit on what this change proves.

The requested random open PR was locally applied and rejected by the unchanged
Node-major compatibility gate. See [PR 555 outcome](node-types-pr-555-outcome.md).
No PR was merged and no rejected dependency update remains in the tree.

Image, schema and local replacement results will be recorded after
execution; this initial record does not claim those checks have completed.

The first exact-image drill rejected the protected worker before database access:
the packaged `su-exec` changes HOME to the target passwd entry even for a numeric
UID. A disposable no-network probe reproduced `/tmp` becoming
`/var/lib/postgresql`. Corrected the constructed environment to the packaged
PostgreSQL account home and added a regression test; the exact-environment guard
was not relaxed. That failed rehearsal cleaned up its project and volumes. The
local application was not replaced with that unverified image.

## Next item

Wire the protected runtime and restore-mode dispatcher, including custom writable
paths and bounded PostgreSQL diagnostics. Then finish database-enforced ingestion
writer admission before enabling unattended ownership recovery. Do not clear the
Movies warning or fabricate an owner merely because this worker passes its tests.
