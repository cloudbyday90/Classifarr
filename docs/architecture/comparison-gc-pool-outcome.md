# Comparison GC page-pool outcome

Date: 2026-10-06 local / October 7 UTC.
Design: [page-pool attribution](comparison-gc-pool-design.md).

## Implementation and initial checks

The isolated catalog study can now opt into bounded major-GC tracing. Numeric
source tokens and phase brackets preserve attribution without storing native
addresses, process IDs, arbitrary causes or provider payloads. Missing or malformed
requested telemetry prevents an accepted study receipt. Production GC behavior,
worker lifetimes, memory admission and recovery safeguards are unchanged.

Focused parser, launcher, trace and study tests: 122 passed. Server lint/typecheck,
both dependency checks, copyright, static-import, ESM mock-shape and Markdown checks
passed. Host-script lint has no errors; its seven warnings concern bounded generated
artifact paths, including the existing saves. The first full suite passed 53,715
tests but flagged the two changed launchers' ownership-review digests (one failure,
one Linux-only skip). Reviewed their unchanged database targets/cleanup and the
new diagnostic-only flag/parser boundary, then updated only those review hashes
and rationale. The ownership suite then passed all 39 tests. A full rerun follows.

A non-root, read-only, no-network probe of the pinned image emitted 47 valid major
collections from two source tokens, with a maximum 44 MiB local pool. The host
parser accepted all events without persisting raw identities. This verifies the
actual runtime format and worker-event handling, not the catalog retention cause.
Rebuilt-image study, local health and schema results follow after measurement.

## Random PR trial

Random selection from the current open PRs chose [#555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest/lockfile
diff locally: client Node typings 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0.
The existing runtime-major policy failed as expected (7 passed, 1 failed): Node 26
declarations do not match the pinned Node 24 runtime. Reverted only that trial;
the unchanged gate then passed all 8 tests. No dependency installation, retained
dependency change, PR merge or gate weakening.

## Remaining validation

No-cache rebuild and same-catalog image measurement are pending. Do not interpret
this implementation or the small format probe as proof of the retained-memory
mechanism. No allocator/runtime tuning is selected without that evidence.
