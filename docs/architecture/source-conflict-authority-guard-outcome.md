# Source-conflict authority guard outcome

Date: 2026-09-07. See the separate
[design and alternatives](source-conflict-authority-guard-design.md).

## Result

Fresh unresolved source conflicts now block automatic authority only for the
matching `(library_id, media_server_id, external_id)` inventory item. Existing
rows and source observations remain intact for diagnostics and explicit review.
A valid source capture clears the observation and restores normal automatic
eligibility; incomplete capture does not quietly do so.

The shared ESM predicate is used by existing-media lookup and
awaiting-decision reconciliation. Queue refill excludes conflicted items;
metadata-enrichment preflight completes them as skipped with
`current_source_identity_conflict` before provider calls. TMDb identity,
provider-rating and metadata writes all repeat the predicate, so a conflict that
arrives during provider work rejects the late write. Direct inventory-TMDb
enrichment also refuses a payload marked from the database preflight.

The implementation does not create a replacement identity, revoke historical
data, add an operator task, alter semantic routing, change the public API or
add a database migration. All runtime values are bound; the SQL helper accepts
only a validated fixed placeholder.

## Validation

Focused backend tests passed **171 tests across eight suites**. They cover the
shared SQL shape, safe placeholder rejection, existing-media and reconciliation
queries, queue refill, preflight, provider suppression, and all guarded TMDb
write paths. PostgreSQL integration passed the full conflict lifecycle:
conflict capture blocks existing-media lookup, awaiting-decision reconciliation
and a late identity write; a later valid capture clears the conflict and allows
lookup and reconciliation again.

The complete backend coverage suite and repository coverage ratchet passed.
Targeted PostgreSQL integration suites passed for source observations,
source-guarded enrichment writes and inventory TMDb observations. Server and
client type checks, server lint and production dependency checks, ESM static
import and mock-shape checks, Markdown lint, whitespace checks and an
authoritative fresh-schema comparison passed. The schema remains at migration
`20260907_210000_add_unresolved_source_observations.sql`; no schema change was
needed for this consumer guard.

Before the runtime rebuild, a local custom-format PostgreSQL backup was copied
from the running container, checksum-verified and checked with `pg_restore
--list`. It is 44,573,618 bytes and the prior image remains tagged for local
rollback. The backup is ignored and contains no committed data.

Compose rebuilt with `--no-cache --require-provenance` and recreated from clean
source `5b04a66020a2ee69a976d8abf1fa2a163ced1250`. The health endpoint returned
healthy and the image revision label matches that commit. The running database
contained 19 fresh conflicts, all 19 of which still overlap a retained inventory
row with a TMDb ID. A no-provider runtime probe chose one without exposing its
identity and verified preflight blocked, existing-media lookup did not return
the conflicted row, reconciliation updated zero fixture records, the late
identity write affected zero rows, and inventory-TMDb enrichment did not start.
The post-start log check found no error, fatal or unhandled entries.

## Release-range and pull-request review

The local range from `v0.48.4-beta` to this implementation contains 1,514
changed files with 122,732 additions and 5,159 deletions. It covers the recent
policy/review infrastructure alongside HTTP response limits, cancellation,
embedding validation, media-sync diagnostics, unresolved source observations
and TMDb failure handling. This change is the bounded consumer repair indicated
by the latter two items. Its diff from the pre-task `origin/main` contains only
the 22 source-conflict guard, tests, changelog, README and design files.

GitHub MCP returned an empty open-pull-request list both before and after the
work. There was therefore no random open PR to implement locally, and no closed
or unrelated change was substituted or merged.

## Next item

Run one real 24–32-case cohort with independently supplied labels, then use the
existing readiness and frozen-study preflight to measure the semantic error
profile. Only if the documented threshold is satisfied should semantic
counter-evidence be added as an ambiguous-item-to-review signal. It must remain
advisory and must not route media automatically.
