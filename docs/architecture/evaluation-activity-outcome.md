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

- Focused server service/route checks: 48 tests passed.
- Isolated PostgreSQL integration: nine tests passed, including aggregate reads
  with independent counts, previous-day reservations, no writes and stale state.
- Frontend coverage: 446 files / 6,444 tests passed.
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

Full backend coverage and the requested local no-cache image rebuild, health
evaluation and authoritative schema dump are recorded below when complete.

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
