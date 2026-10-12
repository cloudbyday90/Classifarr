# Frontend static-contract phase diagnostics outcome

Date: 2026-10-12. Baseline: main `26b8a92a248d46b5bb3acf79511a03660654e632`.
No release, runtime version change or production deployment.

## Implemented

Added an opt-in ESM recorder to the real ESLint configuration hooks and CSRF
source scan. It pairs bounded start/end records by correlation ID and reports
monotonic wall time, process CPU deltas and phase call/failure counts. Repeated
reads/matches are aggregated; source text, paths, exception contents and
environment values are not recorded. The disabled path takes no measurements
and produces no output. Original assertions, source selection, exclusions,
regexes, project order, worker limits and deadlines are unchanged.
The CI client-test step opts in; ordinary local invocations remain quiet by
default. A regression check guards the CI opt-in and unchanged test command.

This improves evidence collection; it is **not a timeout fix**. An operation
reported as returned is not a passing Vitest verdict. A timed-out hook can finish
later, and an unfinished/killed operation may leave only its start record.

## PR trial

Fresh enumeration returned two open candidates. Random index 1 selected
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Its exact server manifest/lock
patch was applied locally: Node declarations 26.6.4 and undici-types 8.9.0.
No new package paths or lifecycle installers were introduced.

Strict clean installation, dependency tree and full audit passed (zero known
advisories). Server typechecking failed at `discordDeliveryWriter.mjs`: newer
fetch/FormData declarations are incompatible with Discord's declarations. The
runtime-major policy also failed (40 of 41 tooling tests passed). Restoring the
exact PR patch and reinstalling returned server typechecking and all 41 tooling
tests to passing. Node declarations remain 24.19.2 / undici-types 7.24.6.
No remote PR state changed, no compatibility guard was weakened, and no PR
dependency changes are retained.

## Validation and investigation

Eight deterministic recorder tests passed, covering enabled/disabled behavior,
aggregation, bounded fields, paired IDs, pending operations, return values,
original exceptions/rejections and output failures. All 12 runner/config
acceptance tests passed, including a failing profiled assertion and a synthetic
50 ms hook timeout that correctly exits nonzero with no false completion record.
The short deadline is confined to the disposable fixture, not repository tests.

The first subprocess diagnostic assertions could not see console output because
the fixture used only Vitest's JSON reporter. Adding the standard reporter
alongside JSON exposed the records while retaining the machine-readable verdict;
no runtime failure was suppressed to repair that test harness.
Both rejection scenarios also pass with CI's `--silent=passed-only` behavior,
so failed-test records remain visible without globally enabling passed-test logs.

The complete diagnostic run passed **458 files / 6,890 tests**, with no skips or
failures, in 344.56 seconds, using two workers and the normal project order.
The private log is `.tmp/test-phase-full-diagnostic.log`; the CSRF record ID is
`1ed37903-c88a-4411-9cf3-8ee707d31789`. Observed phases:

| Scope / phase | Wall time | Process user + system CPU |
| --- | ---: | ---: |
| Vue event ESLint configuration | 617.0 ms | 609 ms |
| General ESLint configuration | 510.2 ms | 515 ms |
| CSRF complete operation | 179.4 ms | 140 ms |
| CSRF file collection | 6.8 ms | 15 ms |
| CSRF reads (584 calls) | 149.9 ms | 125 ms |
| CSRF matching (581 non-allowlisted files) | 7.3 ms | 0 ms reported |
| CSRF assertion | 1.1 ms | 0 ms reported |

Nested phases are included in the complete operation, not additive to it.
CPU counters are process-wide and platform-dependent, not disk-wait counters.
This run does not reproduce the earlier 7–10 second source scan or 18-second
setup. No CPU, memory, disk, antivirus or scheduling root cause is claimed.

The diagnostics-disabled combined run also passed **458 files / 6,890 tests**,
with no skips or failures, in 321.22 seconds using two workers. These sequential
observations are not a controlled performance benchmark or evidence of a timeout
repair. CI retains its existing four-worker application configuration; the local
two-worker measurements must not be presented as that CI run.

Final local client coverage: statements 87.33%, branches 81.07%, functions 87.04%,
lines 89.08%. The backend source and dependency files are unchanged after the PR
trial. Its existing report (October 12, 05:59:50 Eastern) has SHA-256
`4b39222137f36440d2543be344ca920c38d820e245c0bd7b247ed73afc87d244`;
this batch does not claim a fresh backend suite run.

Client lint, both Vue typecheck scopes, production build and all eight isolated
Chromium route/asset/history checks passed. The coverage ratchet passed without
baseline edits, using the final client report and the unchanged backend report
identified above. Markdown checks passed for 2,127 files; copyright checks
passed for 1,591 files. The new CI contract regex initially failed ESLint's
literal-space style rule; the equivalent counted-space regex passed lint and
the complete 12-case runner/config acceptance rerun.

## Local image verification

The no-cache build, local replacement and isolated schema dump will use the clean
implementation commit. Their exact source/image and results will be recorded in
a follow-up documentation commit before push. No intermittent timeout fix is
claimed, and these checks do not constitute a production deployment or release.

## Next decision

Use a captured slow phase, not a passing rerun, to choose the next fix. If wall
time rises without corresponding CPU, inspect host/process scheduling and I/O;
if CPU rises, profile the relevant worker stack. Neither pattern alone proves
a particular external cause. Keep production memory safeguards unchanged.
