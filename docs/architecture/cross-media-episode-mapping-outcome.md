# Cross-media episode mapping outcome

Date: 2026-10-11. Main development; no release, tag, PR merge or live approval.

## Delivered boundary

Implemented the [design](cross-media-episode-mapping-design.md): a source TV episode
can carry an explicit, administrator-reviewed TMDb movie exception under complete
season scope. Movie and TV episode IDs remain separate namespaces, even when their
numbers coincide. Fresh typed details and displayed context bind the approval.
Both confirmations are required; approval requests never automatically retry.

Owned sync preserves TV placement and the source grouping. It stores the movie as
a typed review-only reference without a synopsis, not as a TV episode or scalar
parent. The TV corpus filters it before projection. An all-movie group contributes
no TV description, including no fallback source synopsis. No movie-library
membership, file movement, provider write or automatic identity inference occurs.

Existing complete-coverage, ownership, stale-evidence, revocation, resource and
cooldown safeguards remain. No schema migration or new scheduler is needed.
Miraculous remains unresolved pending the operator's episode verification.

## Verification before image rebuild

- Regression-first run: 10 failures and 8 passes before implementation.
- Expanded backend regression: 370 tests in 17 suites passed.
- Targeted coverage run: 477 tests in 25 suites passed. Across the five selected
  services: 94.61% statements/lines, 96.82% branches, 93.10% functions. The mapping
  validator and catalog-evidence service each reached 100% in every metric.
- Isolated PostgreSQL recovery: 41 tests passed, including explicit consent,
  typed namespace collisions, complete materialization, repeat sync, revocation,
  stale/failed evidence and SQL exclusion of movie-only groups.
- Initial client mapping run: 40 tests passed; a further typed-context regression
  was added for missing, wrong-type and same-number movie/TV catalog works.
- Initial browser run: three passed, including the new movie case; the legacy
  case timed out in initial navigation. The four-worker rerun timed out in all
  four initial navigations, before assertions. No timeout or assertion was weakened.
- All four browser scenarios then passed with one worker (43.6 seconds), including
  keyboard consent, narrow-screen reflow, escaped titles and unchanged unresolved
  counts. Full root lint passed without warnings; both workspace typechecks passed.
- Concurrent full-coverage attempts were stopped when the Windows host had about
  0.8 GB free RAM; a one-worker client attempt also stalled and was stopped. These
  incomplete runs are not counted as passes. A bounded retry is tracked separately.

The ownership gate correctly rejected a changed source fingerprint. Manually
reviewed the corpus SELECT's two filters: typed season documents only and no
fallback row when a scoped mapping has no learning documents. No write, caller
coordination or lock changed. Updated only that file's digest, retaining the same
analysis digest and unresolved `analysis_debt` classification; this is reviewed
drift, not proof that every inventory path has ownership enforcement.

## Random PR trial and dependencies

Fresh open-PR enumeration contained #555 and #556. Randomly selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`, and applied its client declaration change
locally: `@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.

Reviewed registry metadata and the two-package lock diff before normal install.
Candidate installation, dependency tree, all-dependency audit (zero reported
vulnerabilities) and client typecheck passed. Toolchain checks passed 39/40: the
Node-major guard rejected declarations for Node 26 with deployed Node 24.21.0.
Restored manifests and lockfile exactly, reinstalled supported dependencies and
passed 40/40 toolchain checks plus client typecheck. No dependency change retained.

Fresh client outdated inventory also listed Playwright 1.64.0, Vue plugin 6.0.10,
Vue Router 5.4.0, vue-tsc 3.3.13 and TypeScript 7.0.2. These are follow-up candidates,
not inferred vulnerabilities or authorization to combine unrelated upgrades.

## Recommendation stack

1. Keep typed, explicitly reviewed movie exceptions separate from TV learning.
   Benefit: preserves grouping without corrupting evidence. Cost: actual human
   identity verification is still necessary.
2. Verify the local reunion file against the proposed movie before approving it.
   Then let normal owned sync/backfill apply the complete scope. A matching title
   or provider search result is not proof of the file's content.
3. Keep unresolved grouped items visible until every episode is accounted for;
   do not lower coverage or memory safeguards to clear the dashboard count.
4. Next tooling batch: research and test the Vue plugin/vue-tsc patches separately
   from a Node-major or TypeScript-major migration.

## Local image and read-only evaluation

The no-cache Compose build passed from clean implementation commit
`20e465134d4cd95b60245e15339e0c567d1a7c7c`. Local Docker image ID:
`sha256:e12dd548c0208b55ea31ec9808985b6f996db38e9084fb7714bf018df5a23801`.
Its OCI revision matches that commit; this is not a published multi-platform
registry verification. The build's frontend production compilation passed.

Before replacing local Compose, retained a checksum-verified, readable 75,469,343-byte
database archive and tagged the exact previous image for rollback. Replacement
used `--no-build --pull never --no-deps --force-recreate --wait`. The actual running
image matches the build, health reports database connected, and the container has
zero restarts and no OOM kill. User 1000:1000, read-only root and 2 GiB cap remain.

Ran the schema dumper against that exact image in a fresh, network-isolated,
resource-bounded container, not local appdata. Snapshot is unchanged through
`20261010_220000_source_catalog_mappings.sql`, including 22 seed migrations. Fresh
consumer checks found zero invented pending work, images or unresolved identities.
Confirmed the owned temporary container and data directory were removed.

Local read-only consumer checks found four unresolved items across ten active,
covered libraries, 6,832 classification rows and 6,810 pending image embeddings.
No metadata issue was hidden to reduce those counts.
At the subsequent health check, Docker reported 611 MiB of the unchanged 2 GiB
limit. Since startup, the error ledger contained one optional comparison-context
warning with status/reason `invalidated`, still unresolved, and no ERROR entries.
This observation is not a memory soak or proof that optional comparison recovered.

The cross-media hypothesis preview covered all 136 episodes of the reunion's
source group: 135 source-declared matches plus one proposed movie exception,
with zero excluded episodes. Source title was “Reunion”; typed catalog title was
“Love Is Blind: The Reunion”. Reference: `196e8fce-2547-433a-b5ab-f710c889a16c`.
This checks the complete proposal, **not the actual file's identity**.

The database connection enforced read-only transactions. Before/after ledgers
remained seven approved/materialized mappings, zero human episode exceptions and
four unresolved items. No approvals, provider writes, Unraid changes or Plex
changes. The first private probe stopped at source selection because title case
differed; correcting that diagnostic selection enabled the preview without
changing any product identity rules.

## Validation limits and handoff

The two-worker full client coverage attempt also ran slowly and reported an
existing CSRF source-scan test timeout (13.16 seconds). It was stopped rather than
weakening the test deadline. Full local coverage and the cross-workspace coverage
ratchet are therefore not certified by this work; do not reuse older reports.
Targeted tests and CI results are separate evidence.

Final restored-dependency client check passed all 52 tests across the mapping,
named API leaf and unchanged CSRF source-scan suites (7.85 seconds). The CSRF
assertion and deadline were unchanged. Root lint, both workspace typechecks,
dependency/production knip, copyright, reviewed ownership drift, ESM import/mock
checks, 40 tooling tests and Markdown lint passed. No security, ownership or
coverage baseline was lowered.

Implementation was pushed to main. Its
[CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/38167486136) was still
running during local image evaluation; Gitleaks, copyright, OSV, Trivy, CodeQL and
resource regression passed for that exact SHA. Follow-up documentation does not
change image contents.
This document does not certify a release or Unraid deployment.
