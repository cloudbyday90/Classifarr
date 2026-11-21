# Synthetic replay dependency boundary outcome

November 21, 2026 Eastern. Implementation of the approved
[design and tradeoffs](synthetic-replay-dependency-boundary-design.md).

The viability values and weak evidence rules live in an import-free module.
Fixture validation, calibration, runtime diagnostics and decision projection
share that definition. Existing imports from diagnostics still work. The
offline runner now reaches the same ranking and decision projection logic
without loading native scoring or the runtime logger.

The actual PR command exited 1 with `ERR_MODULE_NOT_FOUND` for `pino` in the
isolated baseline export. It exited 0 on the candidate under Node 24.22.1. The
eight matching fixtures and entire JSON report matched the installed baseline
byte for byte. The new test runs the same CLI in a bounded subprocess whose
resolver rejects package imports. The existing PR job retains its read-only
permissions and runs the command from a checkout without package installation.
Actionlint verified the workflow syntax.

The focused suites passed 87 tests, including the cold runner regression and
the existing diagnostics, calibration and ranking checks. Four isolated
PostgreSQL suites passed 51 native declaration, preflight and routing-replay
tests. Fresh server coverage passed 64,107 tests with one existing skip. The
joint coverage ratchet passed using the hash-verified client report. Lint,
type checks, CI preflight and the policy and ESM gates passed.

The PR-only job is exercised locally by its exact command and checkout
conditions. Observe the next applicable hosted PR run before making the job a
required check.
