# Catalog consumer boundary outcome

## Result — 2026-10-10

Implemented the first concrete repair from the
[consumer audit](catalog-consumer-boundary-design.md): one classification now
contributes one embedding count/work item even when inventory contains the same
catalog title in multiple libraries. Statistics, pending selection and poster
resolution share a small ESM module with typed, active-source eligibility,
retained-conflict exclusion, bounded poster formats and deterministic ordering.
History artwork takes precedence; text-only work needs no inventory join.

The real PostgreSQL tests also exposed different treatment of non-breaking spaces
by PostgreSQL and JavaScript. A shared literal expression with explicit character
ranges now keeps their decisions aligned, including controls, Unicode whitespace
and percent-encoded paths. Existing downstream transport security is unchanged.

This is not complete season-mapping support. No mapping was activated, identity
rewritten, import reset, retry budget changed or backfill manually started.
Memory safeguards, routing authority, schema and release version are unchanged.
The recovery skill kept advisory scope evidence separate from write authority.

## The unresolved items

The Unraid browser refreshed at **15:42:01 Eastern** showed twelve items: ten
requiring source review and two waiting for automatic retry. Nine review entries
reported insufficient independent identity evidence; one reported a title/year
mismatch. All ten active libraries had complete source scans. This is not an
empty-metadata or incomplete-import diagnosis.

The separate local database at **19:59:00 UTC** showed eleven items: nine needing
source review and two waiting for retry, with all ten active libraries covered.
The deployments share Plex, not a database or recovery ledger. Do not combine
their counts or treat all twelve cases as having the same cause.

The [previous fresh-evidence check](source-scope-evidence-outcome.md#the-unresolved-items)
showed that one flagged series could have 96/96 matching episode memberships
while retaining an unresolved parent-provider conflict. That prior result was
not rerun for every item here. Artwork, descriptions and numbering agreement
alone do not approve a catalog identity or a whole-series/season relationship.
Unraid, shared Plex and shared Ollama remained read-only in this round.

## Local query evidence

Before replacement, **6,830** classification records became **6,834** rows through
the old inventory join. Four history records had multiple inventory matches.
The existing read-only query reported **6,812** image-eligible pending entries
and zero pending text entries; no image work was enabled to obtain those counts.

The new SQL's read-only execution plan returned **6,808** eligible classifications.
It used the existing `idx_media_items_tmdb` index for 22 fallback lookups, with
about **172 ms execution / 30 ms planning** on this local dataset. Most rows had
direct history artwork. This is a single local observation, not a general scale
benchmark, a memory-soak result or grounds for changing indexes/resource limits.

At **20:20:49 UTC**, the rebuilt image reported **6,808** image-eligible entries
through statistics, the pending count and the breakdown; text pending remained
zero. The selected ten-row batch had ten unique classification IDs and took
about 9 ms. History remained 6,830 rows; the old join still produced 6,834, so the
four-entry difference is a query correction, not deletion. Unresolved counts
remained eleven (nine source-review / two retry-wait), with ten covered libraries.
The probe used a read-only, repeatable-read transaction, bounded statements and
aggregate-only output, with no provider calls or writes.

## Independent PR trial

Fresh MCP enumeration found two open PRs, #555 and #556. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Applied its exact client manifest and
lockfile changes: Node declarations 24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0.
Registry integrity and lifecycle metadata were reviewed, followed by both
script-disabled and normal clean installation under the existing install policy.

Client type checks and dependency-tree checks passed; npm audit reported zero
advisories including development dependencies. The tooling suite passed 39/40:
Node 26 declarations failed the project's Node 24 alignment guard. Restored the
exact original manifest/lockfile, reinstalled, and passed all 40 tooling checks,
the dependency tree and zero-advisory audit. No PR was merged or candidate
dependency retained. The dependency skill required a reversible, validated trial.

Keeping declarations aligned with the deployed runtime avoids suggesting APIs
that the runtime may not provide. The tradeoff is deferring this major update;
a runtime migration needs its own compatibility work. Official research and
alternative designs are linked in the design document, retrieved through MCP
on 2026-10-10.

## Verification

- Final focused unit checks: **64 tests**, two suites.
- Isolated PostgreSQL checks: **35 tests**, two suites, including existing image
  retrieval. They cover duplicate memberships, retained conflicts without writes,
  inactive/mismatched memberships, typed IDs, precedence, stable ordering and
  SQL/JavaScript poster-format agreement.
- Full backend coverage: **1,781 suites / 55,697 passed**, one Windows-only
  directory-fsync skip, in **852.686 seconds**. Linux verification is recorded below.
- Full frontend: **451 files / 6,611 tests**, no skips, plus the separate test
  configuration check. Both workspace type checks passed.
- Fresh combined coverage ratchet passed without baseline changes: backend
  statements/branches **89.75% / 86.05%**, frontend **87.08% / 80.62%**.
- Ownership/dependency preflight, all four policy gates, ESM import/mock-shape
  checks and server/client lint passed. Final server lint and changed-file lint
  reported zero warnings. Markdown lint checked **2,084 files with zero errors**.

Initial fixture failures were corrected by creating the required capture-state
parent and inserting a text vector matching the fixture database's column
dimension; database constraints were not weakened. The Unicode regression then
failed before the shared-format fix and passed afterward. Concurrent broad runs
hit unchanged Knip/Vue lint-setup timeouts; the backend attempt was stopped and
both suites rerun sequentially. Both passed without changing timeouts. The
superseded build was cancelled and replaced by a final no-cache build.

## Exact image, backup and schema

Final no-cache build used clean runtime revision
`a5d78374aeefec8516ae88c33f704c1bff7bf454`. Final evidence documentation is separate
from that runtime commit. The inspected local Docker image ID is
`sha256:389db35af626e882c8f7e4fe6292a92b1f4fa5ac77d4d83e8922fa8c9add8634`.
Only local Classifarr was replaced, starting at
`2026-10-10T20:20:11.743138325Z`: healthy, HTTP 200, zero restarts, no OOM, user
`1000:1000`, read-only root, no-new-privileges and unchanged 2 GiB memory limit.
The early startup-window warning/error query returned no rows.

A **76,848,838-byte** local database archive was retained with matching checksum
and a successful archive-list read. The exact rollback image is
`sha256:7f5653aa1a3fd54831aad4da605e045b0a7611da12a3b10359ded15efc9b4907`.
Archive readability is not a restore rehearsal. No production deployment or
release is part of this work; image evidence must not be presented as published
multi-platform or sustained-soak verification.

The Linux directory-fsync/exclusive-copy fixture passed in that exact image,
non-root and read-only, without network access, limited to 128 MiB, one CPU and
64 PIDs. Container
`classifarr-catalog-consumer-fsync-96f5c581-ca53-4f99-b7b4-b335a6bb5f11`
was removed and its absence verified. This exercises the Windows-skipped case
on Linux; it is not a power-loss durability test.

After rebuilding, the isolated fresh-database schema dump passed through
`20261010_140000_classification_metadata_failure_context.sql`, including 22
data-only migration seeds. The tracked schema is unchanged. A fresh-database
probe confirmed zero pending embeddings, stored images and unresolved identities.
The fixture used the exact image, no external network, 1 GiB memory, two CPUs
and 256 PIDs; no live app-data was mounted. Container
`classifarr-schema-check-220124e2-e483-46ff-81e2-bc27bc0e4663` and its generated
data directory were removed; both absences were independently checked.
The image-evidence skill kept these checks tied to the exact local artifact.

## Recommendation stack

1. Keep the shared eligibility/cardinality repair. It corrects counts and work
   admission across libraries; the cost is an additional correlated read for
   history without usable artwork, covered by real SQL tests.
2. **Next: implement typed scope projections in description and learning
   consumers**, starting with `inventoryDescriptionCorpus.mjs` and
   `liveInventoryDescriptionRepository.mjs`. Carry scope through text, cache/model
   keys, holdouts and evaluation; never collapse a partial season to a parent
   series synopsis. Preserve ordinary source retrieval.
3. Then add durable explicit mapping approval, fresh revalidation, revocation
   and bounded release backfill. This takes longer than ignoring conflicting IDs,
   but preserves source grouping without applying another work's metadata.
4. Keep Node 24 runtime/types aligned. Review compatible dependency updates
   independently. No release or PR merge in this round.
