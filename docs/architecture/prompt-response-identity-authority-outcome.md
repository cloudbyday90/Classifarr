# Exact History identity and write authority for prompts outcome

November 23, 2026 Eastern. See the
[design](prompt-response-identity-authority-design.md) for the caller audit,
tradeoffs, and sources.

## Delivered behavior

The prompt detail and response routes use the shared exact History ID
validator. The client adapter checks the same range before transport. Both
paths admit positive canonical decimal IDs through `9223372036854775807`.
Safe response IDs remain numbers, and larger response IDs stay as strings.

An authenticated user can still read the prompt list, batch, and detail. The
response POST now requires the administrator role before parsing a History
ID or starting the response transaction. This applies to responses without
pattern actions because those responses still complete a History decision.
Clients using ordinary sessions for writes now receive `403`.

The existing pending-only transaction still controls pattern approval,
feedback, learning statistics, and the source receipt. The native intent
and destination guards, distinct-upsert count, and repeat-submission conflict
remain in effect. The independent Command Center pending-answer contract
continues to serve the active product workflow.

## Verification

The real prompt router uses the existing authentication and role middleware
in isolated PostgreSQL tests. Cases cover list, batch, and detail with an
ordinary session, early refusal of unauthorized writes, and exact writes
and receipts beside adjacent BIGINT rows. The existing suite also covers
concurrency, rollback, approved-pattern upserts, native intent, and replay
conflicts. Unit tests verify invalid IDs fail before database or HTTP
transport work and confirm the exact URL and response shapes.

All 163 focused server tests and 68 isolated PostgreSQL tests passed. The
fresh client coverage run passed 7,619 tests in 490 files. The production
build and the 8 production and 20 regular Chromium tests passed, along with
13 client configuration checks. All three npm audits reported zero findings.
An unchanged Discord transport fixture failed during the first parallel
coverage run and passed all eight checks on its isolated rerun.

The full server rerun passed 64,424 tests across 1,957 suites. It skipped one
Linux-only filesystem case on Windows. Server statement coverage was 89.36%
and client statement coverage was 88.00%. The coverage ratchet, lint, type
checks, Markdown, ESM checks, and CI preflight and policy gates passed. Two
preflight symlink fixtures skipped on Windows. GitHub listed no open PRs
eligible for local adoption or Dependabot rebasing.

## Next recommended item

Audit suggestion application through both `POST /api/suggestions/:id/apply`
and `POST /api/feedback/suggestions/:id/apply`. Trace bundled consumers and
confirm the role and action checks are consistent across both wrappers before
changing their shared pattern mutation. Keep suggestion reads in their
existing workflow during that review.
