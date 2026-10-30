# Automatic destination review summary outcome

Date: 2026-10-30. Status: full scope agreed; implemented and verified.
See the separate [design, research and tradeoffs](automatic-purpose-evaluation-design.md).

The user confirmed an independent automatic purpose summary job with bounded
aggregate storage and saved-status presentation in the existing administrator
Evaluation progress area. They clarified that this preference covers every
operator workflow: no required manual CLI triggers, clear processes and a quiet
UI. Item-level private data remains outside this first automatic surface.

The verified foundation was committed and pushed on main as
`2f39f56798bb79a86883baec55feae53123b9218`. It includes immutable policy-context
reading and standing operator-workflow guidance. That delivery passed 1,898 backend
suites / 61,519 tests, one existing skip, eighteen real PostgreSQL tests and the
unchanged coverage ratchet. This automatic job/UI is a subsequent verified change.

Read-only investigation found reusable automatic worker, admission, thread,
checkpoint, status and UI patterns. The existing inventory audit has a different
denominator and a 16-KiB aggregate contract; private case JSON must not be saved
or exposed through it. Zero retained choices do not establish producer readiness.

## Implemented process

The scheduler automatically starts the independent destination review summary
after its startup grace and refreshes on the existing cooldown/backoff pattern.
Existing ownership, resource admission, idle checks and joined worker cancellation
are reused. The new checkpoint stores only a validated aggregate and operational
scheduling metadata. An administrator-only no-store status GET reads saved state;
opening the view never starts evaluation or reads item evidence.

Shared input/eligibility and frozen reference projection preserve the three
comparison meanings, action/source cohorts, first-item holdouts and original
proof availability. A closed 16-KiB report reconciles all counts and admits no
IDs, names, raw snapshots or source hashes. Missing source tables and absent
retained choices remain different states; no producer readiness is inferred.
The checkpoint is excluded from portable configuration exports and cleared in
the existing restore transaction. Failures clear counts and retain bounded retry
state. Routing and learning receive no additional authority.

The existing administrator Evaluation progress area now has one quiet summary
row, with native expandable details. It uses plain labels, polite status updates,
keyboard focus, mobile stacked counts, nonpersistent polling, access-loss clearing,
pause handling and monotonic fifteen-minute expiry. No operator CLI step, new
page, settings wizard, trigger button or repeated notification is required.

## Verification

Focused final backend checks passed six suites / 97 tests; adjacent scheduler,
restore and route checks passed seventeen suites / 169 tests. Client API/component
checks passed two files / 24 tests. Real PostgreSQL checks passed three suites /
19 tests covering publication, cooldown/restart, competing owners, stale writes,
bounded backoff, restore rollback/reset, no source mutations, denied writes and
cancellation. Coherent reads preserve evidence across concurrent cascade deletion.
Retained feedback receipts survive History deletion and correctly become gaps;
the tests do not equate that state with an empty retained-source window.

The Chromium workflow passed keyboard expansion, default collapsed state,
390-pixel layout, pause/access loss, no local-storage persistence and zero write
requests. Desktop/mobile screenshots were inspected. A temporary sidebar
transition was allowed to settle before mobile bounds/screenshots; narrow-screen
comparison rows stack for readability.

An isolated, network-disabled PostgreSQL 18 container applied the migration and
generated the authoritative fresh schema. A second database reproduced that dump
exactly. The local harness now waits for final TCP readiness, avoiding PostgreSQL's
temporary Unix-socket initialization server. The owned container was removed.

Default private aggregate/case JSON and error output matched main in 1,024 byte
comparisons. Types, lint, both Knip modes, static imports, ESM mock shapes,
migration naming, copyright, Markdown, four policy gates and reviewed ownership
checks passed. Only affected SQL paths were reviewed; existing restore writer
debt remains unresolved. Full backend coverage passed 1,902 suites / 61,695 tests,
with one existing skipped test: 89.21% statements/lines, 86.59% branches and 90.73%
functions. Fresh client coverage passed 482 files / 7,498 tests: 87.90% statements,
82.04% branches, 87.67% functions and 89.57% lines. The combined ratchet passed
without changing its baseline. Production client build and final types passed.
Unreleased is updated.

## Delivery and next item

No open PRs or stale Dependabot PRs were available during the GitHub MCP inventory.
Dependency manifests and locks are unchanged. The existing low-severity advisory
follow-up remains separate. Delivery stays on main, with no release, deployment,
live data mutation, provider call, historical backfill or routing/learning change.

After a separately authorized deployment, let the automatic summary accumulate
new explicit-choice evidence and use it to prioritize a real routing defect.
If per-item explanation is needed, integrate it into the existing History review
with a separately agreed private evidence boundary. Keep the operator process
automatic and the UI compact; do not add another dashboard or require CLI work.
