# Background routing checks: outcome

Date: 2026-10-03. Implements the
[background-check design](manual-routing-background-design.md).

## Delivered

History now has an admin-only, per-item background-check control. Opening it
reads local state only; enabling it permits at most three provider reads. A
shared session lock coordinates manual and background checks. Admission spends
the automatic budget and saves a cooldown before HTTP, so crashes, restarts,
and off/on toggles cannot erase those limits.

The new ESM state, coordinator and scheduler modules reuse the existing checker.
No add, move, delete, AI call, historical enrollment, or original routing-status
rewrite was added. Provider reads accept cancellation and retain the existing
10-second deadline, 2 MiB response limit and redirect rejection. Quiet polling
does not emit routine start/finish logs; actual checks and eligibility stops do.

The migration is additive and repeatable. The regenerated fresh-install snapshot
was loaded into a separate PostgreSQL database and compared with a new dump.
It enrolls zero records. Existing Docker/Unraid templates need no changes.

## Verification

- Full backend: **1,640 suites passed; 50,260 tests passed**, one Linux-only skip
  on Windows. The Linux filesystem suite ran separately: **5 passed, zero skipped**.
- Full frontend: **418 files, 5,946 tests passed**. Final focused routing UI/API
  tests were rerun after copy/status refinements: **34 passed**.
- Real PostgreSQL routing integration: **33 tests passed** across three suites.
  Covered restart, two service instances competing for the same lock, shared
  manual/automatic cooldown, exhausted budgets, disabling during a read,
  interrupted admission, configuration/intent drift, and history preservation.
- Real HTTP reconciliation/cancellation and provider unit checks: **131 passed**.
  Final scheduler/coordinator checks: **74 passed**. Cancellation aborts actual
  Radarr and Sonarr GETs without a follow-up request or provider write.
- Lint, type checks, dependency/copyright/ownership preflight, ESM checks,
  Markdown lint, migration checks, client build and whitespace checks passed.
- Coverage ratchet passed: backend lines **90.05%**, branches **85.48%**;
  frontend lines **88.15%**, branches **79.00%**. Final small log/copy changes also
  received focused reruns; no coverage baseline or test gate was weakened.

The database tests found conflicting inferred SQL parameter types in admission.
Explicit casts fixed the issue. The concurrency test now fails immediately if
admission exits before reaching its synthetic provider, instead of waiting for
the test timeout. The complete integration rerun passed afterward.

Only disposable test databases and local synthetic HTTP providers were used.
The temporary schema container was removed. No live library, provider, ownership,
or recovery state was changed; no Compose rebuild or release was performed.

## PR and CI review

GitHub MCP search and the saved GitHub CLI login both returned **zero open
Classifarr PRs** on 2026-10-03. There was no random PR to implement, and none was
merged or closed. The preceding commit's seven CI workflows all passed.

## Recommendation and limits

Keep this stack: explicit opt-in → durable admission → shared lock → bounded
read → guarded observation → review when unresolved. The benefit is predictable
unattended checking without provider writes. The cost is slower confirmation,
one occupied database connection during each read, and a small persisted state
table. A lock-session partition is not an absolute cross-system fencing guarantee;
the operation remains read-only and cancellation-aware.

Next: classify provider failures and add provider-scoped cooldowns. Invalid
credentials or configuration should stop immediately, while temporary outages
should pause all affected checks without spending every item's budget. Keep
automatic add replay out of scope until a separate durable routing-command
contract establishes authorization, idempotency and recovery semantics.
