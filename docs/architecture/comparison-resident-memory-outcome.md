# Comparison resident-memory outcome

Date: 2026-10-06. Design: [resident-memory attribution](comparison-resident-memory-design.md).

## Implementation and scope

The isolated study now separates self/PostgreSQL/other process RSS and PSS,
allowlisted cgroup memory types and V8 committed heap. Reads are bounded,
read-only and phase-scoped; concurrent marks share an observation without losing
their labels. Missing or raced measurements remain explicit. Saved traces also
retain streamed-verification markers and metadata weak-reference counts.

Production services, admission thresholds, cache lifetimes, refresh schedules,
database schema and deployment configuration are unchanged. No release is created.

## Validation status

The focused run passes 13 suites / 394 tests, including malformed counters,
partial reads, PID churn, denied/foreign processes, deadlines, sanitization and
concurrent observer shutdown. Backend lint, typecheck, both dependency checks,
host trace-module lint, copyright, ESM/static-import checks and Markdown pass.
The runtime-major gate passes all eight tests after reverting the PR trial.
Pinned Node 24.21.0 supports the selected main/worker V8 statistics.

A counterfactual using the old trace collector drops streamed verification,
metadata references and committed-heap fields; the new collector preserves them.
The full backend suite is in progress. The no-cache image, unchanged complete-catalog
study, local recreation and independent schema dump/check have not yet completed.
Results will be recorded before completion; no resident-allocation cause is claimed yet.

Before replacement, the local database was backed up to a private ignored archive
and its checksum/archive readability verified; the old image was tagged for rollback.
A read-only check found `cached_vectors_incomplete` at `snapshot_read` at
22:35:46.144 UTC and automatic recovery at 22:38:20.359 UTC. That event is distinct
from the earlier memory-pressure deferrals; current catalog readiness was `ready`.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact manifest/lockfile
diff: Node declarations 24.19.1 to 26.6.4, undici-types 7.24.6 to 8.9.0.
The unchanged runtime-major test failed exactly on the client Node-26 declaration.
Reverted only the trial diff before installation; no retained dependency update
and no PR merge. Registry metadata confirms the proposed undici-types range.

## Next decision

Keep safeguards unchanged. Use the completed attribution trace to choose between
V8 committed-space, native-allocation or PostgreSQL/cache investigation. A gap
between RSS and used heap alone is not evidence of a leak or an allocator defect.
