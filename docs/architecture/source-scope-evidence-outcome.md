# Fresh source scope evidence outcome

## Scope — 2026-10-10

Implemented [the design](source-scope-evidence-design.md) in separate ESM modules
for the private target query, catalog transport, typed comparison and orchestration.
The existing administrator draft now offers an explicit fresh-evidence check,
with a separate Vue component, composable and centrally tested API function.

Checks reread source and catalog evidence, reject observed drift and return a
bounded exclusion list and reference. They do not save mappings, select a parent
ID, reset imports, clear warnings, start backfill or change memory safeguards.
No schema, deployment configuration or release version changed. The recovery
skill kept advisory evidence separate from recovery and activation authority.

## The unresolved items

Unraid's read-only list refreshed at **15:09:45 Eastern** still showed twelve
items: ten needing source review and two waiting for automatic retry. Nine of
the source-review entries reported insufficient independent evidence; one
reported a title/year mismatch. All ten active libraries had complete scans.

The separate local database at **19:10:44 UTC** showed eleven: nine needing
source review and two waiting for retry, also with ten complete library scans.
The rebuilt local UI reproduced this breakdown. These are unresolved identity
checks, not missing posters/descriptions or incomplete imports. The different
databases and retained recovery results must not be treated as one shared state.

A bounded Plex read of one local flagged series returned a single TMDb series
declaration and 96 episodes across four seasons. In the rebuilt browser:

- The whole-series proposal matched **96 of 96** episode memberships, with zero
  exclusions. Its retained parent TVDB conflict and disabled backfill remained.
- An explicit partial proposal mapped only season one: **24 of 96** matched;
  the other **72** were individually listed as `No season mapping proposed`.
- Editing cleared the result. A later fresh check returned the fixed
  source/catalog-changed message rather than retaining a success result.

This is evidence that metadata exists and episode membership can agree despite
a parent-provider conflict. It is not proof that every conflicting parent ID is
wrong, that all twelve items have the same cause, or that a mapping is approved.
No Unraid, Plex or Ollama settings, mappings or provider data were changed.

## Independent PR trial

Fresh MCP enumeration found two open PRs, #555 and #556. Random selection chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Applied its exact Node-types 26.6.4 /
undici-types 8.9.0 manifest and lockfile changes locally. Registry integrity and
installer metadata were inspected. Client type checks passed, and npm audit
reported zero advisories including development dependencies. The tooling suite
passed 39 of 40 checks: Node 26 declarations failed the Node 24 alignment guard.

Restored the exact original manifest/lockfile. Normal installation, all forty
tooling checks, zero-advisory audit and the dependency tree then passed. No PR
was merged and no candidate dependency changes were retained. The dependency
skill required a reversible trial, not an implicit runtime migration.

The official [DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md),
discovered and opened through MCP on 2026-10-10, associates declaration versions
with the represented library. Keep the deployed Node 24 types until a separately
tested runtime migration justifies changing that contract.

## Verification

Focused backend checks passed nine suites and **34,064 tests**, including the
repository-wide code-health assertions. Isolated PostgreSQL checks passed
**14 tests**: stored evidence, credential drift, actor demotion, observation
preservation, matching page selection, concurrent admission, actual session loss
and subsequent lock reacquisition. HTTP fixtures exercised real compressed reads,
oversized responses, redirect refusal and stalled-body cancellation.

The full frontend coverage run passed **451 files and 6,611 tests**, with no skips,
plus its separate test-project configuration check. Both workspace type checks,
server/client lint, preflight, ESM import/mock checks and all four policy gates
passed. Only the explicitly reviewed lock-key source fingerprint changed in the
ownership baseline; no writer authority or unresolved classification changed.

The first broad backend attempt caught the missing same-line SQL-safety annotation
for fixed imported fragments. Caller values were already parameterized. The
annotation was corrected following the existing repository convention, the
focused code-health suite passed, and the broad attempt was stopped and restarted.
The restarted full backend coverage run passed **1,780 suites and 55,654 tests**
in 945.62 seconds. Its single Windows skip is the Linux directory-fsync test;
the equivalent real-filesystem fixture passed separately in the exact Linux
image described below. Backend statement/branch coverage is **89.75% / 86.04%**;
frontend statement/branch coverage is **87.08% / 80.62%**. The combined fresh
coverage ratchet passed without changing thresholds. Markdown lint checked
**2,082 files with zero errors**; diff whitespace and secret checks also passed.

Browser checks covered the actual read-only whole-series and partial-season
flows, detailed exclusions, invalidation on edit and a changed-evidence refusal.
The existing desktop viewport had no horizontal overflow. Live attempts to click
Cancel finished or refused stale evidence before the control could be clicked;
browser cancellation is therefore not claimed. Component tests prove signal
cancellation/late-result discard, and real HTTP fixtures prove disconnection.
This is not a full accessibility audit or a mobile-browser test.

## Exact local image and schema

No-cache Compose build used clean runtime revision
`584fea0b3037e458fefbed87dd890ff41a3b468e`. The inspected local Docker image ID is
`sha256:7f5653aa1a3fd54831aad4da605e045b0a7611da12a3b10359ded15efc9b4907`.
Final outcome documentation is a separate commit. These are local-image checks,
not published multi-platform release evidence.

Before replacement, retained a readable, checksum-verified **76,842,794-byte**
database archive and rollback tag for prior image
`sha256:6ae2fac647130b23633887c1e419399d50da1311e23ad7b862613f9a25859038`.
Archive readability is not a restore rehearsal. Only local Classifarr was replaced,
starting at `2026-10-10T19:17:34.705173048Z`: healthy, HTTP 200, zero restarts,
no OOM, user `1000:1000`, read-only root, no-new-privileges and unchanged 2 GiB
limit. The early startup-window warning/error query returned no rows.

The exact-image Linux directory-fsync/exclusive-copy fixture passed under
non-root, read-only, network-disabled, CPU/memory/PID-bounded conditions.
Container `classifarr-scope-evidence-fsync-ae0b12db-439d-459e-987f-507123a66876`
was removed and its absence checked.

After the rebuild, the isolated fresh-database schema dump passed through
`20261010_140000_classification_metadata_failure_context.sql`, including 22
data-only migration seeds. It used the exact image above, no external network,
1 GiB memory, two CPUs and 256 PIDs. The tracked schema is unchanged. The runner
reported cleanup of container
`classifarr-schema-check-3333ea14-6ecf-42a7-90ce-0a014688c2a1` and its generated
data directory; both absences were independently checked. No live appdata
was used for schema generation. The image-evidence skill kept this evidence
separate from release, production recovery and sustained memory-soak claims.

## Recommendation stack

1. Keep the fresh read-only review. It preserves source grouping and explains
   actual exclusions; its cost is bounded provider reads and occasional stale
   evidence refusals. The [design](source-scope-evidence-design.md#official-research)
   records the official TMDb, OWASP and W3C sources and alternatives.
2. **Next: audit and implement scope-aware downstream consumers** before adding
   mapping persistence or activation. Metadata, classification, comparison and
   backfill must honor the same whole-work/season scope and exclusions instead
   of collapsing a grouped show to one scalar parent ID.
   Start with `inventoryDescriptionCorpus.mjs` and
   `liveInventoryDescriptionRepository.mjs`: their catalog identity/history
   fallback paths use `(media_type, tmdb_id)`. Then cover the same scalar join in
   `embeddingServiceQueries.mjs` and identity preparation in
   `mediaSyncItemPersistence.mjs`. These are audit entry points, not a complete
   consumer inventory. Preserve ordinary source-based retrieval throughout.
3. Then add explicit confirmation with fresh revalidation, durable provenance,
   revocation and bounded release backfill. This takes more work than choosing
   the first catalog ID, but avoids applying one series' metadata to another.
   Matching numbering or membership alone remains insufficient approval.
4. Keep Node runtime/types aligned; review compatible dependency/tooling updates
   separately. No release, version bump, PR merge or production recovery here.
