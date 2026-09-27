# Dedicated restore mode: outcome

Date: 2026-09-27. Scope: configuration restore isolation and controlled restart.

## Delivered

- The ESM entrypoint selects normal or restore startup before loading normal
  services. Normal startup requires shared admission and a ready existing restore
  gate before importing worker-capable services or running startup repairs.
- Restore startup loads a small allowlisted HTTP application, existing-account
  authentication, and configuration recovery. It does not load normal queue,
  scheduler, Discord, backfill or AI provider services. The backup path now uses
  the existing database-only learning-pattern adapter without changing its SQL.
- Exclusive admission belongs to the pinned restore session. It rejects
  cooperating normal instances before restore writes; normal startup refuses an
  active restore. Normal admission loss invokes the entrypoint's fail-stop handler.
- Interrupted or unverified restores keep normal startup blocked. A verified
  restore stays in maintenance until an explicit normal restart. No automatic
  retry, normal-routing resume, checkpoint promotion, or gate deletion is added.
- The isolated `/restore` page explains mode and restart requirements, retains
  preview/confirmation, and disables import when capability loading fails.
  Normal mode keeps backup management but rejects import. Status text is announced
  without moving focus; restore fields have associated labels and the disabled
  action references its visible explanation.

The existing restore verification checks native-policy/schema integrity; it does
not prove every subsystem or external destination is healthy. Admission is
cooperative, not network-partition-proof distributed fencing. Operators still stop
all normal instances and external writers. Restore mode requires an initialized,
compatible database and an existing administrator. See the separate
[design, procedure, official sources, and tradeoffs](restore-maintenance-mode-design.md).

## Validation

The targeted database suite passed 77 tests across six disposable PostgreSQL
suites. New cases cover multiple normal owners, exclusive restoration, interrupted
verification blocking startup, and connection-loss signaling. Termination targets
only a session created in the disposable suite database, never the live application.

Backend tests cover strict mode validation, admission ordering, lock cleanup,
non-ready gates, pool capacity, isolated imports, read-only startup preflight,
shutdown timeout, HTTP allowlisting, administrator authorization and CSRF.
Frontend tests cover maintenance navigation, suppressed normal polling, the named
API endpoint, unavailable capabilities, disabled actions, and restart guidance.

The focused backend run passed 197 tests across 17 suites. The final complete
backend rerun passed 43,791 tests across 1,470 suites: line coverage is 90.42%,
branch coverage is 84.49%, and the runtime-admission module has 100% line/branch
coverage. The first full run caught an entrypoint responsibility violation;
fail-stop process termination was moved into `index.mjs`, and the complete rerun
passed without weakening that code-health check.

Frontend regression passed 5,426 tests across 387 files; line coverage is 87.70%
and branch coverage is 78.07%. The frontend production build, server/client type
checks, client lint, dependency checks (normal and production), ESM import/mock
checks, copyright and new-document Markdown checks passed. Server lint has no
errors and retains the pre-existing non-literal-filename warning in
`captureOperatorCorrectionFrozenPolicy.mjs`.

The existing production naming gate still reports 49 references; no naming or
coverage baseline is relaxed. Product-language, delivery-term and runtime/release
maintenance audits pass. The coverage ratchet passes against the current backend
and frontend reports. Changed Markdown documents pass repository rules, the new
design/outcome documents pass strict Markdown checks, and `git diff --check` passes.

No application database restore, live container rebuild, routing-setting change,
new dependency, schema migration, tag or release is part of this change.

## Pull-request selection

GitHub MCP searches at the start and during validation returned zero open PRs for
`cloudbyday90/Classifarr`. No random candidate exists. No closed PR was substituted
and no PR was merged.

## Next item and recommendation stack

Build a disposable container recovery rehearsal from a supported release image:
backup, stop normal workers, restore in dedicated mode, interrupt an attempt,
explicitly retry, verify, and restart normally. Assert readiness and movie/TV
recovery-to-learning behavior without enabling new routing or music processing.
Publish a compact pass/fail evidence report rather than another dashboard counter.

The stack is dedicated restart-based maintenance, cooperative database admission,
pinned restore transactions, durable verification, controlled normal restart, then
the end-to-end recovery rehearsal. It costs downtime and one normal pool connection
but has a smaller, testable boundary than online pause/drain. Online restoration
should wait until every writer and detached task participates in stronger fencing.
