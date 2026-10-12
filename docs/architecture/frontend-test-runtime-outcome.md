# Frontend test runtime outcome

Date: 2026-10-12. Baseline: clean main
`f7ac1675e3651b7537614ff3341728456ce8a324`. No release or production deployment.

## Investigation and demonstrated defect

The earlier combined-run timeout remains **unisolated**, not proven fixed.
The original 5.0.3 full suite passed with temporary timing instrumentation:
457 files, 6,881 tests, 352.22 seconds. In that run, the CSRF contract scanned
584 files in 504.6 ms: collection 7.3 ms, reads 480.2 ms, matching 6.9 ms,
assertion 0.8 ms, with 141 ms process CPU. Remaining scan time includes path and
loop work. This does not explain the previously observed 7–10 second scan or
18-second ESLint setup; the failing instance was not captured with these probes.
No regular-expression, application-memory or Windows-protection cause is claimed.

A second diagnostic full run on 5.0.4 forced the CSRF contract to run first. It
passed all 457 files / 6,881 tests in 357.94 seconds; the scan took 77.3 ms
(55.8 ms reads, 6.4 ms matching, 1.1 ms assertion, 78 ms process CPU). This run
used a temporary config/sequencer and is not the final normal-config acceptance.
An earlier attempt supplied a class-valued sequencer as a CLI string; Vitest
correctly exited 1 before running tests. That invalid diagnostic invocation is
not counted as a passing test run. Temporary instrumentation was then removed
exactly; the shipped CSRF contract remains unchanged.

Three synthetic real-CLI regressions independently reproduced a different defect
on 5.0.3: a missing location file, unsupported location range and unknown Git
comparison revision returned exit code **0**, even though the requested checks
could not run. All three reject correctly after the exact, matched 5.0.4 update.
The upstream cause is explicit: location-error branches returned before assigning
a failing process exit code, and Git subprocess failures were not required to
throw. The upstream patch sets the exit code before those branches and propagates
failed Git commands. These cases protect filtered invocations; normal full runs
were not using invalid filters.
The package update repairs a demonstrated false-success path; it is not being
presented as a measured repair of the intermittent timeout.

## Package review and PR trial

The retained package change is development-only: Vitest and coverage-v8 5.0.4,
plus 11 related lock entries. No package paths were added or removed, no new
lifecycle installers appeared, and no production dependency, runtime version or
security override changed. Strict clean installation and the complete npm tree
passed. The full client audit, including development dependencies, reported zero
known advisories on October 12; that is not proof of absence of vulnerabilities.

The fresh random selection was [PR #558](https://github.com/cloudbyday90/Classifarr/pull/558),
head `e8a7ee2e490e5437375aa3a4628943657fa1783e`, from the two open candidates
#558/#556. Its exact client manifest/lock patch was applied locally. Strict
installation, dependency tree, full audit and both Vue typecheck scopes passed;
the existing tooling guard rejected Node 26 declarations against Node 24 runtime.
The PR patch was restored, not merged, and the guard was not relaxed. Node
declarations remain 24.19.2 and undici-types 7.24.6. No remote PR state changed.

## Validation

- Exact runner/provider manifest, lockfile and installed-version alignment.
- Resolved project configuration, complete test inventory and unchanged deadlines.
- Real passing/failing CLI assertions; covered and uncovered function reporting.
- Warm module-cache invalidation after changing fixture application code.
- Setup timeout propagation without executing the dependent test.
- Nonzero exits for invalid locations and missing Git revisions.

All **9** runner/configuration acceptance cases passed. Final normal-configuration
coverage run, after removing all instrumentation: **457 files / 6,881 tests passed**,
zero skips/failures, 439.92 seconds with two workers. No speed improvement is
claimed from these differently ordered/instrumented runs.

Additional checks passed:

- Client lint, API typechecking and checked-component typechecking.
- 41 dependency/toolchain policy tests after restoring PR #558.
- Production build and all 8 isolated Chromium route/asset/history checks.
- Markdown: 2,125 documents, zero errors; copyright check; whitespace check.
- Coverage ratchet without baseline edits. Client statements 87.29%, branches
  81.06%, functions 87.03%, lines 89.05%.

Backend code/dependencies are unchanged. The ratchet used the existing backend
report from the immediately preceding validated source, generated October 12 at
05:59:50 Eastern (statements/lines 89.71%, branches 86.14%, functions 91.14%).
Its SHA-256 is `4b39222137f36440d2543be344ca920c38d820e245c0bd7b247ed73afc87d244`.
This is **not a fresh backend test run** for this tooling batch.

## Local image verification

Host validation is complete. The requested no-cache build, local replacement and
isolated schema dump will use the clean implementation commit and be recorded in
a follow-up documentation commit before push. No production deployment is planned.

## Next bounded item

Capture a failing combined run with phase/CPU timings before proposing another
timeout fix. Preserve default deadlines, isolation and full coverage. A repeated
pass alone must not close the incident. Separately, the optional season-mapping
corpus and matched refresh-cycle study remain follow-up performance work; no
mapping approval or runtime memory-safeguard change is justified by this batch.
