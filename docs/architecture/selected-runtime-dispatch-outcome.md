# Protected runtime dispatch outcome

Date: 2026-10-05. Base: `0c16d7f2f4b9e653efc9964e4d7efc28b1051602`.
See [design, official sources and tradeoffs](selected-runtime-dispatch-design.md).

## Implemented

Added a shell-free application launcher and pre-import identity/environment guard,
using the real application startup with restricted peer-auth credentials. Replaced
the selected-startup database-probe adapter with the actual application in the
isolated rehearsal. Normal mode performs schema maintenance first. Restore-only
mode cannot start the application or online maintenance brokers, waits for its
one-shot operation, and joins database shutdown. Cancellation is failure for
restore-only mode, without changing normal container shutdown semantics.

The real-image fixture now checks HTTP health, unauthenticated refusal, admin
setup/login, authenticated identity, actual runtime exclusion of maintenance,
pool bounds, restore-only completion and return to normal startup. It keeps the
selected-database lease and the existing immutable-source checks.

This does not activate production conversion, a privileged restore web server or
unattended legacy ownership recovery. The internal composition is default-layout
only; custom runtime settings and the restore HTTP handoff remain prerequisites
for the production dispatcher. Existing Compose/Unraid templates are unchanged.
No schema or version change; Unreleased updated; no release.

## Verification

The preceding [CI run 37288286129](https://github.com/cloudbyday90/Classifarr/actions/runs/37288286129)
passed for the base revision, including database tests, build/tests and installation
rehearsals. Publication jobs were skipped. It is not CI evidence for this increment.

Focused tests passed before image testing. Server lint/typecheck, copyright,
ownership review, both knip modes and ESM static-import/mock-shape checks passed.
Nine changed/new ownership entries were individually reviewed; the obsolete
fixture adapter entry was removed. Gate counts remain 19 owned, 279 separately
coordinated and 502 unresolved, with production compatibility false. Fingerprint:
`044640ca6cf5b17d8a871a45b487591c9695dcdd0824635b51e9a902a58d468f`.

The recovery and release-evidence skills kept cancellation, real SQL admission,
disposable image checks and production-activation limits explicit. Final full-test,
image, schema-dump and local replacement results will be added after execution.

Random [PR 556](node-types-pr-556-outcome.md) was applied and tested locally, then
removed after its Node-major compatibility failure. All 30 dependency/tooling
tests passed afterward; no PR was merged.

## Next item

Validate custom runtime configuration (including existing encryption-key and data
paths), add a restricted restore HTTP handoff, and connect the production
dispatcher. Finish database-enforced ingestion writer isolation before enabling
unattended legacy recovery. A healthy local rebuild does not resolve unknown
Movies ownership or authorize an age-based reset.
