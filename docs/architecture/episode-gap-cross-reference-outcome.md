# Episode gap cross-reference outcome

## Scope — 2026-10-10

Implemented [the design](episode-gap-cross-reference-design.md) as two small ESM
services behind `--episode-cross-references` in the existing read-only replay CLI.
Source capture, catalog comparison and selection rechecks remain shared. No new
database relations, background jobs, provider writes or mapping activation.
The recovery-change skill required bounded reads and explicit invalidation tests.

Unraid's read-only list refreshed at 12:55:39 Eastern still showed 12 unresolved
items: ten needing source review and two waiting for automatic retry. All ten
active libraries had recent complete captures; no ownership issue was reported.
Descriptive metadata in Plex does not settle conflicting external identifiers.
No source edits, retry actions or production deployment were performed.

## Random open PR trial

Fresh MCP enumeration returned two open PRs, #555 and #556. Random selection chose
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact server manifest and
lockfile diff locally: Node types 24.19.2 → 26.6.4, undici-types 7.24.6 → 8.9.0.

The script-disabled install and npm audit passed with zero reported advisories.
Type checking failed in `discordDeliveryWriter.mjs`: Discord's Undici `BodyInit`
and `FormData` types are incompatible with the proposed declarations. The tooling
suite had 39 passes and one runtime-major alignment failure. A direct test-file
invocation initially lacked npm's required runner environment; rerunning through
the documented `npm run test:tooling:dependencies` produced that meaningful result.

Restored the exact original manifest/lockfile and performed the reviewed normal
install. Type checking and all forty tooling tests then passed, with zero npm
advisories. No dependency changes or weakened type/runtime checks were retained;
the PR remains unmerged. The dependency-update skill kept this trial separate
from runtime migration and required before/after verification.

## Verification and local image

Focused unit/real-HTTP run: seven suites, 221 tests passed. A separate scoped run
covered both new services with 43 tests and 100% statement, branch, function and
line coverage. Those tests overlap the focused run. Isolated PostgreSQL: two
suites, 25 tests passed, including retained observation preservation and actual
configuration drift. Preflight, ESM import/mock-shape checks, four policy gates
and Markdown lint (2,078 files) passed without baseline changes.

Full server/client checks, exact-image no-cache rebuild, diagnostic findings and
isolated schema regeneration are pending; final results will replace this paragraph.

## Recommendation stack

1. Retain bounded exact-ID diagnosis. It is reproducible and non-mutating, but
   TMDb's cross-reference index can be incomplete and is not independent IMDb/TVDB
   verification. Keep descriptive metadata and identity assurance distinct.
2. Review the observed gap categories alongside parent-series conflicts before
   designing revision-bound, explicitly scoped mappings. Preserve Plex grouping
   across all libraries; do not infer whole-series consent from matching episodes.
3. Implement scope-aware consumers before activating mappings, then use the
   existing guarded backfill. No reset, memory-policy change or release here.
