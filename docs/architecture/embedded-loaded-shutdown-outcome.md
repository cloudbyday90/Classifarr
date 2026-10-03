# Loaded Container Shutdown Results

## Outcome

All four image-level cases passed. Responsive applications completed their
blocked HTTP request and stopped PostgreSQL cleanly. A frozen application needed
crash recovery under the 10-second host deadline; with 60 seconds, the supervisor
terminated the application and shut down PostgreSQL cleanly. Neither forced
case was reported as a successful application shutdown.

| Scenario | Docker deadline | Observed stop | Exit | Database before restart |
| --- | --- | --- | --- | --- |
| Responsive app, assessment in flight | 10 s | 3.000 s | 0 | Shut down cleanly |
| Responsive app, assessment in flight | 60 s | 3.304 s | 0 | Shut down cleanly |
| Frozen app, assessment in flight | 10 s | 10.209 s | 137 | In production; recovered on restart |
| Frozen app, assessment in flight | 60 s | 16.307 s | 1 | Shut down cleanly |

These are local observations, not timing guarantees. Every case preserved the
committed sentinel, discarded the uncommitted sentinel, left maintenance attempt
count at zero, restarted healthy and finished with a clean second stop. Clean
cases required both application and worker completion before the database-stop
receipt. The host-killed case could not claim a clean stop.

The image was `classifarr:pg-lifecycle-check`, pinned throughout the final run to
`sha256:dad3d9081842bd1e3bf9865f33ad38292e2f1517acc4277fc8a674d9bcec23a1`.
It contains the preceding committed runtime implementation. This change modifies
no runtime service; the final rehearsal fixtures are mounted read-only beside
that implementation. A first complete run also passed; the final run additionally
verified the injected processes actually entered their stopped state and pinned
the same image across all cases. A disabled synthetic user distinguishes a
successful setup-status database read from that route's error fallback; a 200
response alone is not sufficient.

## Implementation and checks

- Added separate ESM modules for Docker resource ownership, evidence assertions
  and guarded fixtures. The real entrypoint, Tini, HTTP route, cron handler,
  supervisor, broker and worker remain in use.
- Added `test:local:embedded-shutdown-drill` and a bounded CI step against the
  image already built by the database job.
- Added positive and negative regression tests for evidence, host exits, ordering,
  OOM distinction, image consistency, collision refusal and cleanup failures.
- Focused backend regression: 268 tests in 17 suites passed, including 26 new
  harness tests. Tooling regression: all 28 tests passed.
- Repository lint, backend/frontend type checks, copyright, both backend Knip
  modes, static ownership review and ESM import/mock-shape checks passed.
- Markdown lint checked 1,777 files with zero errors; syntax and diff whitespace
  checks also passed.
- No production code or client API changed. The full backend/frontend coverage
  suites were not rerun for this test-only addition; no coverage threshold or
  assertion was lowered. CI retains its existing full checks.

The first two fixture attempts exposed an incorrect assumed response wrapper
and a relative-versus-absolute supervisor argv match. The fixture was corrected
to use the actual contracts, and failures now include their phase. These were
test-harness mistakes, not evidence of a new production shutdown defect.

All generated containers and synthetic volumes were removed after the runs.
Their disposable data is intentionally discarded and reproducible. Live
Classifarr, its data, deployment settings and other containers were not changed.
No image release, version bump, migration or template edit is included.

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs.
There was no PR to randomly select or implement, and none was merged.

## Recommendation and next work

Adopt the layered test stack in the [design](embedded-loaded-shutdown-design.md):
unit tests, real-image shutdown, offline state verification, then restart checks.
Its benefit is evidence across the real process boundary; its cost is additional
Docker/CI runtime and Linux-only execution. Keep 60 seconds as the recommended
host stop window while retaining explicit recovery checks for unchanged legacy
templates. The research and alternatives are recorded separately in the design.

Next: **in-flight queue claim recovery across shutdown and restart**. Exercise
the real queue worker and claim tokens with interrupted metadata/classification
tasks, checking claim release or expiry, safe replay and rejection of stale
acknowledgements. The current HTTP/assessment rehearsal does not prove that
contract and does not test an admitted VACUUM. Native ARM64 and the same-image
loaded release soak also remain release acceptance work.
