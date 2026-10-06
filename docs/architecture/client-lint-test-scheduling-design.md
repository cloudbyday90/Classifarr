# Client lint-contract scheduling

## Problem and evidence

The Windows release run on `4bfe6de` timed out in the ten-second `beforeAll`
of `vueEventLintContract.test.js` while ESLint loaded the real workspace
configuration. Its 21 assertions never ran; the other 441 files passed.
The unchanged lint suites pass together with V8 coverage in 1.31 seconds.
Earlier full runs exhibited the same setup failure before the dependency patch.
This is consistent with intermittent full-suite setup contention, not evidence of a broken
Vue rule or a KaTeX/TOML regression. The precise operating-system bottleneck
has not been isolated, so a passing retry alone is not considered a fix.
An unchanged diagnostic full rerun also passed all 6,399 tests in 442 files;
this confirms intermittency rather than establishing remediation.

## Decision

Run the two ESLint contract files in a small sequential Vitest project before
the application project. Use an explicit scheduling group so their real config
and plugin initialization cannot overlap the application's worker startup,
Vue compiler subprocesses or component tests. Keep the application pool at
four workers. Both groups retain fresh-process isolation, the same assertions,
default test/hook deadlines and one combined V8 coverage report.

Use groups **1 and 2**, not 0 and 1. In installed Vitest 5.0.3, an isolated
single-worker group with order zero enters the default sequential bucket and
runs last. The configuration regression check requires the nonzero order and
resolved worker bounds; full-suite JSON timestamps verify actual ordering.

The two groups must partition the existing test inventory exactly once. New
application tests remain included automatically. Browser tests remain in the
separate Playwright workflow. No mock replaces ESLint, its config discovery,
the Vue plugin, or real lint diagnostics.

## Alternatives

| Option | Benefit | Cost / reason not selected |
| --- | --- | --- |
| Ordered lint-only project | Prevents overlapping harness work without changing assertions | Adds a small scheduling contract and a serial phase |
| Serialize every frontend test | Simple resource bound | Unnecessary loss of application-test parallelism |
| Increase hook deadlines or retry failures | Small edit | Masks the symptom and weakens the existing gate |
| Disable isolation or coverage | Reduces startup work | Changes what the release tests establish |
| Preload a replacement lint configuration | Avoids lazy loading | Stops checking the real configuration-discovery path |

## Verification

Check the resolved Vitest project inventory, worker bounds, isolation, default
deadlines and inherited aliases/setup/plugin configuration. Run all lint
assertions, then the full frontend suite with coverage and the repository
coverage ratchet against a fresh backend report. Test a shuffled full run too;
assert that lint-group end times precede application-group start times. Keep
measured outcomes separate from this design and rerun release evidence after
the source commit changes. This is test tooling only; no application or
deployment behavior changes.

## Official guidance

Reviewed 2026-10-05:

- [Vitest profiling](https://main.vitest.dev/guide/profiling-test-performance)
  distinguishes environment, import and test execution costs.
- [Sequential project scheduling](https://vitest.dev/guide/recipes/parallel-sequential)
  documents `fileParallelism` and `sequence.groupOrder`; limiting one project's
  workers alone does not prevent overlap with other projects.
- [Vitest projects](https://vitest.dev/guide/projects) documents inherited
  configuration and process-wide coverage across projects.

Recommended stack: isolated forks, an ordered single-worker lint project,
the existing four-worker application project, unchanged deadlines, combined
coverage and fresh release checks. Do not disable host protection or change
global Node/npm installations to speed up tests.
