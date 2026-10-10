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
platform-specific test was skipped (1,068.844 seconds). That Linux directory-fsync
case was exercised separately with the actual candidate-image module: complete
exclusive copy, identical digest, unchanged source and `EEXIST` on a repeat copy
all passed. The disposable probe was non-root, network-isolated, read-only outside
an 8 MiB tmpfs, limited to 128 MiB memory, and removed after completion.

The ownership inventory initially rejected the newly extracted SQL module.
Reviewed its complete constant statement and added only that source to a scoped
`atomic_classification_handoff` review. Existing unresolved writer debt and all
other security baselines remain unchanged.

## Local image and schema evaluation

- Built local Compose **without cache**, with clean source provenance at
  `77de5cc548d75d82e74e87fc420f64db218f8ee6`.
- Inspected Docker image ID:
  `sha256:e10eab954d311ccbae48befe177c931ed41023ea1865c59817ab557e0b33235f`.
  This is local image evidence, not a published multi-platform release receipt.
- Recreated only the local Classifarr service. Healthy, `/health` HTTP 200,
  zero restarts, no OOM, UID/GID 1000:1000, read-only root and unchanged 2 GiB cap.
  Startup memory observed at 337.6 MiB; this is not a sustained memory-soak result.
- Read-only before/after checks: 43 pending histories, four awaiting decisions,
  zero new handoff receipts. The scheduled operation was not manually invoked on
  local or production data. A pre-rebuild 76,799,099-byte backup was checksum
  verified and its archive listing read; the previous exact image was retained.
  This was backup verification, not a restore rehearsal.
- Post-rebuild replay reference `035e0076-b016-43dc-8d10-4dc8e6606995` returned the
  same eleven observations and provider breakdown. No unresolved ID was cleared.
- Ran `node scripts/check-schema-snapshot-container.mjs --dump` **after rebuilding**,
  pinned to the inspected image. The isolated fresh-database dump passed and its
  container/data directory were cleaned up. The generated snapshot has no semantic
  or tracked-file change; no schema migration was introduced.
- This final evidence update changes documentation only. The tested runtime is
  the source revision above. Unraid and the shared Plex/Ollama services were not
  modified; no PR merge, branch creation, tag or release was performed.

## Next recommendation

Implement fresh source-layout capture and typed catalog-scope preview for explicit
grouped-work mappings, then durable administrator review and scope-aware consumers.
Do not clear these warnings by dropping IDs, matching on title alone, changing
Plex grouping or weakening completeness/memory safeguards. Failed-task identity
repair remains a separate, task-version-bound workflow; legacy history links must
not be invented from title similarity.
