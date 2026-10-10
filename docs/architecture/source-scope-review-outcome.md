# Source scope draft review outcome

## Scope — 2026-10-10

Implemented [the design](source-scope-review-design.md) as a small ESM service,
an authenticated POST and a separate Vue form/composable. Operators can describe
one movie/series or explicit TV season mappings without changing source grouping.
The server checks the current stored-source revision and administrator session;
it returns a structural result, not an identity approval or activation receipt.

No mapping is persisted. Parent conflicts remain unresolved and all proposed
content stays excluded from mapping-backed backfill. There are no new tables,
provider calls, scheduling changes, memory-policy changes or production recovery.
The recovery-change skill kept this review boundary separate from repair authority.

## The unresolved items

Unraid's read-only list refreshed at 13:54:07 Eastern still showed twelve items:
ten needing source review and two waiting for retry, with complete captures for
all ten active libraries. No ownership problem appeared in that check. Plex
posters and descriptions do not resolve competing catalog identifiers; this
change does not claim to repair those twelve records.

After the local rebuild, an in-progress scheduled scan temporarily reduced the
detail view to nine items across nine complete libraries, while the previous
overview still showed eleven. This was incomplete coverage, not two repairs.
The read-only database check at `2026-10-10T18:06:26.151Z`, after scan completion,
returned eleven items across all ten libraries: nine source-review cases and two
retry-wait cases. All eleven had a stored-source revision. Local and Unraid are
separate databases; their counts must not be combined or treated as equivalent.

The preceding [episode investigation](episode-gap-cross-reference-outcome.md)
remains relevant: episode matches do not settle parent-series conflicts, and
missing external IDs must remain explicit exclusions. No Plex metadata edits,
retry/dismiss actions, Unraid deployment or shared Ollama changes were performed.

## Independent PR trial

Fresh GitHub MCP enumeration returned two open PRs, #555 and #556. Random selection
chose [PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Applied its exact client manifest and
lockfile diff locally: Node types 24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0.

Registry integrity matched and neither updated package declared an installer.
The script-disabled installation, reviewed normal installation, both client
type checks, dependency-tree validation and full npm audit passed; npm reported
zero advisories including development dependencies. The tooling suite passed
39 tests but rejected the Node 26 types against this project's Node 24 runtime.

Restored the exact original manifest and lockfile. The normal installation,
client type checks, zero-advisory audit and all forty tooling checks then passed.
No dependency changes or weakened runtime-alignment gate were retained. The PR
remains unmerged. The dependency-update skill required this separate, reversible
trial rather than an implicit runtime migration.

The official [DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md),
retrieved through MCP on 2026-10-10, ties declaration major/minor versions to the
represented library rather than treating the highest declaration version as a
universal upgrade. Keep Node 24 declarations until a separately tested runtime
migration justifies changing that contract.

## Verification

Focused backend checks passed five suites and 117 tests. A separate overlapping
coverage run exercised the new review service at 100% statement, branch, function
and line coverage. Isolated PostgreSQL checks passed two suites and 23 tests,
including observation preservation, configuration drift and actor demotion.
Focused frontend checks passed three files and 25 tests.

Both workspace type checks, full server/client lint, preflight, ESM import/mock
checks and all four policy gates passed. The read-only change to
`sourceIdentityIssues.mjs` required explicit review of its ownership-analysis
fingerprint. Only that source digest changed; its analysis digest and unresolved
`analysis_debt` status did not. No writer compatibility was granted. An earlier
full backend attempt encountered the old fingerprint and was stopped; the final
full run was restarted against the reviewed, committed tree.

The full frontend run passed 450 files and 6,570 tests with no skips, plus its
test-project configuration check. The restarted backend CI run passed 1,777
suites and 55,543 tests in 999.6 seconds. One Linux-only directory-fsync test was
skipped on Windows; the exact-image fixture below exercised that behavior.
The combined coverage ratchet passed with both fresh full reports. No assertion,
timeout, memory safeguard or coverage threshold was relaxed. Markdown lint passed
2,080 files, and scanning the complete change against origin/main found no secrets.

The rebuilt local browser exercised a deliberately synthetic partial draft:
one of three declared source seasons mapped. The response explicitly stated
that nothing was saved or approved and the parent conflict remained. Editing
cleared the result; keyboard dismissal closed the disclosure. Visible labels,
focus and result presentation were checked at the existing desktop viewport,
with no horizontal document overflow. This is not a full accessibility audit or
a verified real-world mapping. No mobile-browser result is claimed.

## Exact local image and schema

No-cache Compose build used clean runtime revision
`818c080cb13d09eeeb346bbcc291c1533dcd0237`. The actual local Docker image ID is
`sha256:6ae2fac647130b23633887c1e419399d50da1311e23ad7b862613f9a25859038`.
Final outcome documentation is a separate commit; this is not a published
multi-platform release or registry-verification claim.

Before replacement, retained a checksum-verified, readable 76,837,568-byte local
database backup and rollback tag for image
`sha256:823c954b1819dc4a6d380774983baf61767bf6a7546379f2ef1ce1d5ef6af7fd`.
Readability is not a restore rehearsal. Only local Classifarr was replaced,
starting at `2026-10-10T18:01:38.683523519Z`: healthy, HTTP 200, zero restarts,
no OOM, user `1000:1000`, read-only root, no-new-privileges and unchanged 2 GiB
limit. Early usage was 489.7 MiB; this is not sustained memory evidence. The
read-only startup-window error-log query returned no rows.

The exact-image Linux directory-fsync/exclusive-copy fixture passed with
networking disabled and bounded non-root resources. The disposable container
`classifarr-scope-fsync-fd357140-ad2a-487a-995a-3fd8a211e4c6` was removed and its
absence checked. An initial attempt used BuildKit's configuration digest rather
than Docker's runnable image ID and failed before container creation. Repeating
with the inspected image ID above passed; the unsuccessful attempt is not counted
as a passed check.

The post-build schema dump used a separate fresh database in that exact image,
through `20261010_140000_classification_metadata_failure_context.sql`, with 22
data-only migration seeds. The tracked schema is unchanged. Disposable container
`classifarr-schema-check-ab283153-6d35-4d00-bda6-cd286b2a692e` and its generated
data directory were removed; both absences were independently checked. No live
appdata was used to generate the schema. Image-rehearsal guidance kept artifact
evidence distinct from release, restore and memory-soak claims.

## Recommendation stack

1. Keep the unsaved structural review: it preserves grouping and rejects stale
   stored evidence, but does not establish that a proposed catalog ID is correct.
2. Next, attach fresh typed episode/catalog evidence and explicit unresolved
   exclusions to an authenticated review. Reuse the existing bounded read-only
   diagnostic services; do not infer parent identity from matching numbering.
3. Implement scope-aware downstream consumers before activation, then add an
   explicitly confirmed, revision-bound mapping and guarded release backfill.
   This takes more work than choosing one scalar ID, but avoids silently applying
   the wrong catalog metadata to a grouped show. Remain library-agnostic.
4. Keep the current Node runtime/types alignment. Trial smaller compatible
   dependency updates separately; do not accept PR #555 solely because its type
   checks pass. No release, version bump or PR merge in this round.
