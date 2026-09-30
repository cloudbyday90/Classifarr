# One-shot restore maintenance outcome

Date: 2026-09-30. Design: [configuration restore maintenance](restore-maintenance-design.md).

## Delivered

- An explicit ESM command and small input/execution modules for configuration
  restore, using the existing exclusive session and durable verification protocol.
- Existing encrypted and plaintext backup compatibility, sanitized status output,
  bounded input/query/process lifetimes and no automatic retry or orphan API key.
- Pure backup cipher functions shared with the HTTP path; no application-secret
  initialization for headless maintenance. Parser errors no longer enter crypto logs.
- Sequential restore verification on the pinned PostgreSQL session, eliminating
  overlapping-query deprecation warnings and queries still running after failure.
- Real encrypted-restore and interruption/recovery probes added to the existing
  disposable separate-identity Docker drill. No live data mounts or provider calls.

## Validation

Completed checks:

- All 47,717 backend tests across 1,571 suites, with coverage.
- All 5,795 frontend tests across 411 suites, with coverage.
- Coverage ratchet passes without regressions: backend statements 90.16% and
  branches 85.14%; frontend statements 86.11% and branches 78.76%.
- 71 real PostgreSQL integration tests across six restore/admission/schema suites.
- Separate-identity Docker drill: all five core checks; fresh and repeated schema
  maintenance, encrypted merge/replace, wrong password, active-worker exclusion,
  killed transaction/quarantine, explicit retry, unknown-owner refusal, index
  rebuild, clean restart and runtime readmission. Existing non-root and custom UID
  2345 supervisor lifecycle tests also pass, including the unchanged 10-second
  host-stop timeout and forced-kill recovery.
- Existing HTTP restore recovery drill: all six checks, including authentication,
  killed-owner rollback, quarantine, explicit retry and normal-mode restore denial.
  Its returned API key also authenticates after the normal runtime restarts.
- Type checks, lint, dependency checks, copyright, ownership drift review and
  product-language/release-maintenance gates pass. Existing unresolved writer
  classifications remain unresolved; drift review is not runtime ownership proof.

The final embedded core run took 15,236 ms with 91,764 KiB maximum orchestrator
RSS. This excludes whole-container/PostgreSQL peak and is not production sizing.
The two Docker launchers cleaned their own temporary containers, images and
volumes. Live Classifarr and its persistent data were not touched.

The first container runs exposed two real dependencies: unnecessary API-key secret
initialization and concurrent verification queries on a pinned client. Both were
fixed rather than suppressing the warnings. A synthetic legacy-gate fixture was
also corrected to satisfy the database's in-progress token/timestamp constraints.

## Scope and remaining work

Production OS/SQL identities are unchanged. The command is not yet wired into
the normal UI or embedded supervisor. This is a tested prerequisite, not a claim
that the whole production privilege boundary is complete. The existing HTTP
restore workflow remains available with its original credentials and safeguards.

No open GitHub PR was available when checked, so none was selected, applied,
closed or merged. No release, tag, live-container rebuild or restart was performed.

Next: implement the embedded provisioning/handoff contract described in the
design, with explicit handling of saved non-root Unraid/Compose constraints.
