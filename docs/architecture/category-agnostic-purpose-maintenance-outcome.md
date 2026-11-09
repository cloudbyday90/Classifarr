# Category-agnostic purpose maintenance outcome

Date: 2026-11-08 Eastern. Status: implemented and locally verified under the
confirmed first-batch agreement. No release or deployment.
See the separate [design, research and alternatives](category-agnostic-purpose-maintenance-design.md).

## Delivered correction

Next-version creation now receives review_behavior from the active intent row
already locked inside the native change transaction. The existing persistence
leaf serializes it with its unchanged null/default handling. This is a single
server-owned value propagation change; it adds no category branch, browser
default, SQL statement or configuration field.

Every non-review native change uses this same boundary: purpose, hard limits,
avoid rules, helpful hints and routing-target changes. An explicit admitted
review command still replaces the JSON with its prior meaning. No implicit
partial-key merge or new default selection is introduced.

The existing purpose form still submits only the intended purpose command and
expected revision. Saved matching mode, thresholds and source-trust settings
are preserved server-side rather than being copied into hidden client inputs.
Actor/admin admission, revision fencing, transactions, receipts, exact replay,
rule provenance and routing-target paths remain unchanged. No historical
repair, provider call, schema, endpoint, job, CLI trigger or new UI is added.

## Before/after proof

Regressions were added before the runtime correction. The original writer
failed six unit cases and four real PostgreSQL cases while fifteen existing/
default unit controls and the original PostgreSQL purpose-write control passed.
The new revision stored an empty review object instead of the nondefault saved
settings. These are recorded failing executions, not a hypothetical code review.

The corrected writer passes those controls. Four real database cases retain
best_match, average, weighted_average and require_all configurations, with
automatic/confirmation thresholds 95/90 and all source-trust flags false.
The stored JSON remains equal and the real loaded policy projection retains
the same values instead of falling back to the parent policy.

Additional PostgreSQL lifecycle controls verify:

- All four other non-review command kinds retain the same stored JSON.
- Explicit review replacement still wins, including when a purpose change
  accompanies it; keys are not silently merged back from the old version.
- A receipt-write failure rolls back the revision and leaves the original
  settings and receipt count unchanged.
- Two real competing transactions establish an observed PostgreSQL blocking
  dependency. A stale purpose writer cannot overwrite the winning review
  revision; the next valid revision copies that winner's settings.
- A deliberately lost acknowledgement after a real commit retains the settings.
  A later explicit review revision remains active when the old exact request
  recovers its original receipt; replay creates neither another revision nor
  another receipt.

The existing failure result is preserved for an uncertain COMMIT reply. Its
name is not proof that a commit rolled back; the test observes actual stored
state and exact-receipt recovery. No uncertain operation is automatically
reissued by this change. All database fixtures are synthetic and disposable.

Final verification passes:

- Focused server contracts: 23 suites / 119 tests.
- Production-factory PostgreSQL controls: three suites / 16 tests.
- Fresh full backend CI/coverage: 1,929 suites / 62,558 passed tests and one
  existing skip, in 779.68 seconds. The final three source/test input hashes
  remained unchanged through that run.
- Fresh client purpose UI, composable and API controls: three files / 37 tests.
  Existing complete client coverage (484 files / 7,537 tests) is reused after
  verifying all 1,229 recorded source, installed-graph and report hashes.
- Coverage ratchet: server statements/lines 89.28%, branches 86.68%, functions
  90.81%; client statements 87.93%, lines 89.60%, branches 82.16%, functions
  87.72%. All ratcheted categories pass without changing a baseline.
- All eight CI preflight jobs, full lint, server/client typechecks, four policy
  gates, ESM import/mock-shape gates and Markdown lint pass. Ownership
  classifications and review limits remain unchanged.
- Root/server/client installed package trees validate. Fresh full audits find
  zero root/client findings and five existing low server affected-package
  nodes in the CNA-rejected deepmerge advisory chain; no moderate, high or
  critical workspace finding is reported. The existing exact server-local
  OSV triage still expires November 16 UTC; no scanner policy is changed.

The separate npm-bundled ip-address remediation requirement before another
release remains open. Workspace audits do not establish image remediation.
These are local receipts for this batch, not a claim about its future remote
run or production behavior.

## Category-agnostic scope and limits

The correction is independent of display names, destination categories and
configured term values. Existing stable IDs, typed purpose rules and explicit
matching semantics remain the common model. It fixes a reproduced settings
loss; it does not establish the cause of a particular historical classification.

The whole platform is not yet category-agnostic. The design inventories the
remaining Family-specific classify prompt, retained legacy genre heuristics,
signal/operator compatibility gaps, and individual/bulk draft-review gaps.
Valid metadata/provider adapters are separate from destination-name authority.
No category-specific template, weight or wizard is added as a workaround.

## PR, maintenance and delivery

Fresh uniform selection chose open PR 581 again. Its exact head, two-file patch
and published 3.3.14 integrity match the previously demonstrated failing compiler.
Retain exact 3.3.13; neither a new candidate install nor new passing candidate
evidence is claimed. The [compiler outcome](client-compiler-pr-581-outcome.md)
records this intake. PR 580's server ESLint update is already adopted. At the
delivery recheck both PRs remain open and mergeable at their original heads;
UNSTABLE check status is not a branch conflict. Neither requires an applicable
stale-branch rebase. No PR is merged or closed and no dependency is changed.

The implementation stays on main. Separate design/outcome records and the
Unreleased note accompany the code. Scoped local maintenance revalidates the
recent inventory against the pinned Docker daemon: 444 image/tag records,
three protected services and four worktree paths remain unchanged. Current
evidence and recovery assets are preserved; no additional verified stale
artifact is selected and no file or image is removed in this pass.

The parent commit 2f880af6f has its own fully green applicable CI/CD pipeline
42553285208, including database and acceptance jobs. That receipt does not
substitute for this change's pipeline. Commit/push and the exact new source's
remote status are delivery checks reported separately after publication to
main; neither authorizes a release or deployment.

## Next recommendation stack

1. Preserve saved review behavior across unrelated native edits for every library.
2. Align each accepted signal/operator combination with the actual scorer and
   explanation semantics, including generic media scope.
3. Replace category/name-specific AI prompt instructions with a shared declared
   purpose and constraint boundary, retaining existing route authority.
4. Make explicit review consistent across individual and bulk purpose drafts
   through existing surfaces, including stale-safe advisory results.
5. Evaluate remaining source correlation/calibration with suitable prospective
   evidence rather than category-specific weights or automatic declarations.
