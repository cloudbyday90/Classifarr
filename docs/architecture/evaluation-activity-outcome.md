# Evaluation activity outcome

Date: 2026-10-09. See [design, sources and tradeoffs](evaluation-activity-design.md).

## Delivered behavior

The Command Center now separates the latest saved deterministic policy pass,
retained comparison coverage and checked AI-capture configuration. A synthetic
regression reproduces the diagnosed case: 300 policy cases, zero completed
comparisons from 260 candidates, 73 unsupported selections and two missing AI
responses, with capture disabled. These are test fixtures, not a fresh claim about
the current Unraid database. Import/vector readiness and comparison eligibility
are different checks.

The existing administrator GET returns a bounded v4 aggregate from a read-only,
repeatable-read transaction. No migration, provider call, vector load, worker
launch or quota reset was added. Counts from stale/invalid policy snapshots are
withheld. Legacy responses remain readable without invented activity status.
Unraid settings, live policies, ownership and memory safeguards are unchanged.

## Verification

- Final focused server service/route checks: 57 tests passed. The current activity
  module has 100% statement/line/function and 98.07% branch coverage in a separate
  targeted coverage run; this did not overwrite full-workspace reports.
- Isolated PostgreSQL integration: nine tests passed, including aggregate reads
  with independent counts, previous-day reservations, no writes and stale state.
- Frontend coverage: 446 files / 6,453 tests passed. Final copy-only wording was
  also checked by the 31 component regressions and Chromium rerun.
- Desktop/narrow-screen Chromium: passed keyboard pause/resume, fresh polling,
  disclosure, layout bounds, no writes and access-loss clearing. Screenshots were
  inspected locally. Initial `runFor` consumed the 30-second test timeout replaying
  unrelated dashboard timers; use documented
  [Playwright `fastForward`](https://playwright.dev/docs/api/class-clock#clock-fast-forward)
  for the five-minute polling interval. Assertions and timeout are unchanged;
  unit tests still advance each scheduled polling interval.
- Lint, both workspace type checks, development/production dependency analysis,
  copyright checks and all 40 dependency-tooling tests passed.
- The ownership review initially detected the changed history repository. After
  reviewing the complete module and its reader, only its source digest was
  refreshed; unresolved analysis debt remains unresolved. The gate then passed.

The initial full backend coverage run completed 1,756 suites: 54,465 tests passed,
one ownership-digest test failed before the reviewed update, and one Linux-only
test was skipped on Windows. The corrected ownership test passed in the 87-test
focused rerun. Full-workspace coverage was 89.74% server lines / 85.84% branches
and 88.80% client lines / 80.46% branches; the existing ratchet passed. The final
full unit rerun passed all 1,756 suites / 54,475 tests in 386.259 seconds, with
the one Windows platform skip exercised separately in Linux below. No threshold
was lowered. Full-workspace coverage preceded the final deferral readout; the
separate current-module coverage and full final unit rerun cover that addition.

## Local image and database checks

The final no-cache Compose build used clean source
`160866da90427fb92006e3bfe7fa0852b1cbbfa4` and produced local image
`sha256:2dfea96131e577315d09b91cc68c0a77f410ef46703441b4bda9e7c9b7054a0f`.
The existing `docker-compose.yml` and local `.tmp/compose-concurrent.yml` override
were retained, including mounts and the 2-GiB memory limit. Replaced only the local
Classifarr container; Unraid and the unrelated local service were untouched.

- Healthy after replacement, zero recorded OOM events/restarts at the check;
  health HTTP 200 and unauthenticated evaluation HTTP 401.
- The packaged v4 reader was exercised against local appdata using an explicitly
  read-only PostgreSQL session and a rolled-back read transaction. At 09:55 UTC
  it separately reported a saved `cache_incomplete` policy result, disabled
  capture with zero reservations, and a historical revision with 300 unsupported
  comparisons. These local observations are not the earlier Unraid diagnosis,
  nor a claim that all evaluation work is now supported.
- An earlier local check found the scheduler's stored `failed/busy` outcome.
  Added allowlisted reason-specific guidance and regression cases; operator text
  describes the last attempt, not an inferred live worker state. No scheduler
  cooldown, retry, admission, inference or import setting was changed.
- After the final rebuild, `check-schema-snapshot-container.mjs --dump` completed
  against an isolated fresh database from that image. All migrations through
  `20261005_180000_ingestion_compatibility_fence.sql` and 22 seed migrations were
  included; `database/schema/current.sql` has zero diff. The owned temporary
  container/data were cleaned up and no schema-check container remains.
- The Windows-skipped Linux directory-fsync behavior passed using the image's
  production functions in a non-root, read-only, no-network container with no
  appdata mount: complete exclusive copy, unchanged source and overwrite refusal.
- Static ESM-import and test-mock-shape checks passed. No release, image push,
  live recovery, provider-budget change or prolonged resource-soak claim.

## PR trial and recommendation

Randomly selected open [PR 555](https://github.com/cloudbyday90/Classifarr/pull/555)
was applied locally, tested and rejected by the existing Node-major gate:
8/8 baseline, 7/8 candidate, 8/8 restored. No merge or package installation.
See the [separate trial outcome](node-types-pr-555-outcome.md).

Keep the existing PostgreSQL snapshots, small ESM projection, protected GET,
strict client normalization and focused Vue components. This explains activity
without broadening execution authority, at the cost of explicitly labeling
different snapshot scopes. The recovery skill kept diagnosis separate from live
repair; the dependency skill prevented retaining an incompatible PR trial.

Next: design independent evaluation support for inferred-only policies, without
reusing training-derived purpose as independent evidence. Only then consider an
explicitly approved AI-capture budget for supported cache misses. This change does
not claim that unsupported comparisons now complete or that a release is ready.
