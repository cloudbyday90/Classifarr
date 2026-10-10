# Source layout preview outcome

## Implemented — 2026-10-10

The existing diagnostic CLI now accepts `--scope-preview`. Small ESM modules
capture bounded episode membership, normalize Plex/Jellyfin/Emby responses,
compare typed catalog season structure and discard observed source/configuration
drift. No mapping, source metadata, inventory, ownership or retry state is changed.
Every report explicitly says `canApply: false`, `verification: layout_only` and
`orderVerified: false`. This is live structural evidence, not a completed mapping
UI, identity approval or proof of whole-series possession.

The recovery-change skill drove bounded reads, failure/cancellation tests and the
separation between diagnostic evidence and authority to recover. The dependency
skill kept the unrelated PR trial isolated. See the separate
[design, verified sources, tradeoffs and next stack](source-catalog-preview-design.md).

## Current unresolved items

Unraid was inspected read-only and its diagnostic list refreshed at 11:06:18
Eastern on 2026-10-10: twelve unresolved items, ten source-review and two waiting
for retry. All ten active libraries have complete recent captures. No Retry,
Dismiss, scan, source rematch or recovery action was taken. The legacy failed
classification remains untouched. Local's previous eleven-observation result
must not be substituted for production evidence.

Plex artwork/descriptions do not answer the independent catalog-scope question.
The new preview reports numbering differences, subsets and equal counts without
interpreting any of them as identity. It preserves source grouping and all IDs.
Live rebuilt-image results are recorded below after validation completes.

## Independent PR #556

Applied the exact reviewed head `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`:
server `@types/node` 24.19.2 → 26.6.4, `undici-types` 7.24.6 → 8.9.0.
Registry integrity matched; neither package declared install scripts. Both
scripts-disabled and reviewed installs passed, the full dependency tree was
valid, and npm audit reported zero advisories including development dependencies.

The server typecheck reproduced Discord/Undici `BodyInit`/`FormData` incompatibility.
The Node 24 baseline rejected Node 26 declarations (39/40 tooling checks passed).
Reverted the exact manifest and lockfile edits, reinstalled the original graph,
and verified server typechecking plus all 40 tooling checks. No dependency change
is retained and the PR remains unmerged. Express 5.3.0 and Knip 6.41.0 remain
separate future batches; Node 26 declarations are not a Node 24 update.

## Verification so far

- 300 focused tests passed across thirteen suites, including existing replay,
  mapping-plan, adapter and ownership contracts.
- Twenty real PostgreSQL tests passed across two suites. Preview-specific cases
  verify read-only isolation, no transaction during HTTP, unchanged observations,
  incomplete capture exclusion and rejection after credentials/enablement drift.
- Real compressed HTTP fixtures verify adapter normalization, wrong membership,
  pagination rejection, combined-episode refusal, redirect refusal, decoded byte
  limits and cancellation that closes the socket without another request.
- Initial scoped coverage: 100% statements/functions/lines, 95.27% branches across
  four new modules (73 tests); subsequent tests add deadline and multi-library cases.
- Server typecheck, scoped lint, ESM checks, Markdown lint and CI preflight passed.
  One initial lint failure in a test Promise executor was fixed without changing
  assertions. Full backend verification is recorded once it finishes.

The ownership gate correctly required re-review of both edited adapter sources.
Reviewed complete adapters and the new delegated read path: no database write,
refresh/scan or routing operation was added. Updated only their source digests;
analysis classifications, ingestion checks and unresolved writer debt are unchanged.

## Local image and schema evaluation

Pending the no-cache local build, health check and isolated post-build schema dump.
No release, production deployment or shared Plex/Ollama modification is authorized
or performed in this round. Final verification will replace this pending record.

## Next recommendation

Establish independent episode identity and order evidence, then add authenticated
mapping review with source/configuration revisions and expiry. Durable scoped
edges, revocation and scope-aware consumers must land together before guarded
backfill. A numbering/count match alone must never select one conflicting ID,
claim whole-series ownership, replay a failed task or silently split source groups.
