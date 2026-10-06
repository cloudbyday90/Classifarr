# Client lint-contract scheduling outcome

Recorded 2026-10-05; see the [design](client-lint-test-scheduling-design.md).
This records scoped test-tooling verification, not release publication.

## Baseline

- Local Windows, Node 24.21.0, npm 12.2.0, Vitest/coverage-v8 5.0.3.
- The full release run on `4bfe6de` failed the 10-second ESLint setup hook:
  441 files passed, 21 checks did not execute. Prior candidates had the same
  failure; it was not introduced by the approved dependency updates.
- The unchanged focused lint pair passed all 25 checks with coverage in 1.31s.
- An unchanged diagnostic full rerun passed 442 files / 6,399 tests in 221.13s.
  That intermittency is consistent with setup contention; it does not identify
  a particular operating-system, antivirus or ESLint defect.

## Implementation checks

The real resolved configuration includes all 442 original files exactly once.
Both projects inherit the Vue plugin, alias and setup file. The lint project
uses one isolated Node worker; the application project retains four workers
and jsdom by default. Existing per-file Node annotations remain effective.
Default 5-second test and 10-second hook timeouts, V8 coverage and the coverage
ratchet are unchanged. No original lint assertion or config loader was edited.

An initial groups-0/1 experiment passed the full suite but ran lint last because
of Vitest's special default sequential bucket. Final configuration uses groups
1 and 2. `test:config` verifies inventory and resolved settings before full
client CI tests through the existing cross-platform runner; neither failure
can produce a successful CI exit.

A redundant nested Vitest run inside the new configuration test passed warm
but exceeded that wrapper's ten-second budget after a clean install. It was
removed rather than given a longer timeout: configuration validation does not
need to rerun application tests inside another runner. Actual ordering is
checked using the full-suite report, not inferred from configuration alone.
After another clean `npm ci`, the final configuration-only check passed in
1.14s and both original lint suites passed under their unchanged deadlines.

The final full run with file-shuffle seed `490` and V8 coverage passed all
442 files / 6,399 tests, with no failures or skips, in 241.39s. Its JSON report
preserves the pre-change file inventory exactly. Both lint files finished
before any application test file began. Coverage remains 86.76% statements,
79.64% branches, 86.28% functions and 88.62% lines, matching the baseline.
This is not a claimed speed improvement: the purpose is predictable scheduling.

Source lint, Markdown lint, copyright and version-alignment checks passed.
All three npm audits returned zero findings. No dependency lock entries changed.
The remaining full release command, clean-commit CI and image rehearsals must
still be rerun; these scoped results do not substitute for those gates.

## Limits and next work

No runtime service, dependency version, deployment setting, scanner exception
or live database changed. The old-source soak was intentionally stopped and
its owned Docker resources cleaned before editing; it is not passing evidence
for this fix. Continue the release runbook against the new clean commit.

Keep any future test-throughput optimization separate. This change prevents
in-suite overlap during lint initialization; it does not guarantee deadlines
under arbitrary host starvation or certify every future tooling release.
