# Stale-classification handoff outcome

## Implemented — 2026-10-10

The daily stale-decision scheduler now uses a bounded transactional repository.
Queue admission and the history transition either both commit or neither does.
New tasks retain the originating history reference; history keeps the task ID
and admission receipt. Existing metadata, identities and retry budgets survive.
This does not repair or retry the legacy Unraid failed task or activate catalog
mappings. No release, production database mutation or shared-provider change.

The recovery skill drove the bounded transaction, separate provenance/authority
contract and real database failure tests. The dependency skill kept the PR trial
separate and preserved the runtime-major gate. See the
[design, tradeoffs and verified sources](stale-classification-handoff-design.md).

## Current source-ID findings

- Local read-only cross-reference replay reference:
  `8cd9afc9-b94b-48c4-806c-fd0eca040a18`. Eleven current observations inspected:
  ten agreeing candidates with missing external mappings; one without a typed
  match. 31 external-ID lookups: 19 matches, 12 missing mappings. The diagnostic
  output contains aggregate evidence, not titles, credentials or provider bodies.
- Unraid Command Center inspected read-only at 10:14:35 Eastern on 2026-10-10:
  **12 unresolved items**, ten source-review and two retry-waiting. All ten active
  libraries have recent complete captures. Its existing generic classification
  error remains present. No Retry, Dismiss, sync or recovery action was used.
- Plex descriptions/artwork are not the failing prerequisite. Catalog scope and
  independent identifier agreement remain unresolved. Local results must not be
  substituted for Unraid evidence. The deployed UI still uses older guidance.

## PR #555 trial

Applied the exact reviewed two-package client declaration change locally. `npm ci`
and both Vue typechecks passed. `npm ls --all` passed and the full npm audit
reported zero advisories on 2026-10-10. The Node-runtime baseline failed one of
eight tests because Node 26 declarations do not match deployed Node 24.
Reverted both manifest/lockfile edits and reinstalled the original graph; all
40 dependency-tooling checks passed. No PR was merged and no dependency changes
are retained. Current client outdated results also list Playwright 1.64.0,
Vite Vue plugin 6.0.10 and Vue Router 5.4.0 as future scoped reviews, not automatic
upgrade approvals; TypeScript 7 remains a separate major-version review.

## Verification

Focused checks passed: 50 unit tests across maintenance, scheduler and typed
metadata failures; 27 PostgreSQL tests across handoff, progress and retry services,
including 13 handoff cases. Both changed runtime modules have 100% statement,
branch, function and line coverage in the focused report. Server lint/typecheck,
ESM checks, Markdown lint and CI preflight passed. The staged secret scan found
no leaks.

The full client run had 448 passing files and one setup failure: the unchanged
Vue event lint fixture exceeded its existing ten-second `beforeAll` deadline
while backend tests were also running. 6,522 tests passed and 21 were skipped by
that failed setup. An unchanged, no-coverage rerun of both lint-contract files
passed all 25 tests in 3.23 seconds. No deadline, assertion or configuration was
relaxed. This is not recorded as a clean full-suite run or a fresh coverage-ratchet
pass.

The full backend CI command passed all 1,770 suites: 55,209 tests passed and one
platform-specific test was skipped (1,068.844 seconds). The candidate-image Linux
filesystem check and final build/evaluation are recorded below when complete.

The ownership inventory initially rejected the newly extracted SQL module.
Reviewed its complete constant statement and added only that source to a scoped
`atomic_classification_handoff` review. Existing unresolved writer debt and all
other security baselines remain unchanged.

## Next recommendation

Implement fresh source-layout capture and typed catalog-scope preview for explicit
grouped-work mappings, then durable administrator review and scope-aware consumers.
Do not clear these warnings by dropping IDs, matching on title alone, changing
Plex grouping or weakening completeness/memory safeguards. Failed-task identity
repair remains a separate, task-version-bound workflow; legacy history links must
not be invented from title similarity.
