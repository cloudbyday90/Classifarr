# Episode review context outcome

Work date: 2026-10-11. Starting main revision:
`ed3e6936b8f4142288029540c928ac724b489ad9`. All seven workflows for that exact
starting revision passed. This is development work, not a release or an Unraid
deployment. See the [design, research and tradeoffs](episode-review-context-design.md).

## Findings and implementation

Fresh bounded, read-only local checks still found the two previously checked
single-candidate gaps: 155/156 episodes covered for one series and 135/136 for
the other. The first source title is generic, while a named catalog special is
available at a different position. The second source title names a reunion, but
the proposed catalog season ends one episode earlier and has no specials season.
Netflix describes that reunion as a separate publication. Follow-up bounded TMDb
searches for its exact title and 2026 returned one movie and no TV series. Typed
movie details confirmed ID `1649932`, title `Love Is Blind: The Reunion`, release
date `2026-03-11`, runtime 92 minutes and IMDb ID `tt40428328`. This is a catalog
candidate, not verification of the local file. A movie ID cannot be substituted
for a TV episode ID in the current contract. Neither check approved a mapping,
refreshed Plex metadata or changed Unraid. The operator explicitly asked to leave
the Miraculous episode unresolved until they verify its contents.

Added optional source-title context to human episode mapping reviews. A small ESM
projection module retains bounded display text, separate from structural source
identity. Existing source-page reads supply the titles only when requested for
human preview/approval. Ordinary captures do not retain them. Only requested rows
are returned; no opaque source keys, filenames or raw provider payloads are added.

The review displays source and typed catalog target together, escapes markup,
marks unavailable source titles explicitly and warns that titles are not identity
proof. The context is bound into human-review fingerprints and rechecked before
approval. Changed displayed context requires a fresh confirmation. Legacy scope
fingerprints, saved structural layout digests, sync admission and backfill remain
unchanged. No migration, automated real-item approval, new retry or relaxed guard.

## Independent random PR trial

Fresh enumeration found open #555 and #556; the random selection again chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact server declaration
change locally: `@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
The final trial manifest range and lock entries matched that patch. Initial
lock generation had scripts disabled; reviewed `npm ci` and full tree checks
passed. Candidate registry metadata declared no lifecycle scripts or peers.
All-dependency npm audit reported zero advisories across 725 dependencies; this
does not establish general dependency safety.

Server typecheck reproduced the Discord/Undici FormData/File incompatibility.
Tooling passed 39/40, with the Node 24 major-alignment guard rejecting Node 26
declarations. Restored the exact original manifest/lockfile and reinstalled;
both workspace typechecks and all 40 tooling checks then passed. No PR merge,
dependency change, type cast or relaxed guard remains. Fresh outdated metadata
also identified Zod 4.6.6; keep that separate from this identity change.

## Verification

- Initial regression reproduced eight missing-context failures, with 54 tests
  passing, before implementation.
- Expanded backend regression: 319 tests in 14 suites passed. Focused coverage:
  147 tests in six suites passed, 98.68% statements/lines, 93.82% branches and
  100% functions across the four selected production modules. The new projection
  module has 100% in all four metrics.
- Frontend: 72 tests in two files passed. Scoped changed-file coverage: 96.49%
  statements, 96.20% branches, 90.90% functions and 100% lines. These are scoped
  reports, not a new full-workspace coverage or ratchet claim.
- Isolated PostgreSQL: 35 recovery tests passed, including stale title rejection
  without an approval write, complete owned materialization, repeat sync and
  revocation. The final run, including the exact stale-evidence error-code
  assertion, passed all 35 tests again (6.581 seconds).
- Chromium: all three scenarios passed (36.6 seconds), covering keyboard-only
  consent, escaped source titles, 320/390-pixel reflow and unresolved-count
  preservation. Visually inspected the narrow review panel. Unrelated dashboard
  endpoints intentionally lack synthetic fixture data; their unavailable messages
  are not production failures.
- Full lint, both workspace typechecks, copyright, unchanged ownership gate,
  normal/production dependency analysis, ESM and all four policy-language gates
  passed. Markdown checked 2,108 files with zero errors. The staged patch secret
  scan found no leaks. No security/coverage baseline was refreshed or weakened.

## Local image and handoff

- Clean implementation commit: `0f54301434d0a4436b3cb80a81c82fe4d5800e14`.
- Built `docker-compose.yml` plus the existing local tag override with
  `--no-cache --require-provenance`; local AVX2, Node 24.21.0.
- Exact new local image ID:
  `sha256:4999c8fa38542a7accac10c1e0dfd3621d86fe12d395433ac3ba55c8dcc57ed4`.
  Its OCI revision matches the clean implementation commit. This is local
  Linux/amd64 evidence, not signed or published multi-platform provenance.
- Retained previous image
  `sha256:2007e15f7349b09569303ab68321fc11c941a05698387ff3d6bb7efb41714dd0`
  under `classifarr:pre-memory-8d63358a-b6f9-4c36-aa60-c2798955c8cd`.
- Retained 75,429,243-byte custom-format database backup at
  `.tmp/pre-memory-fingerprint-8d63358a-b6f9-4c36-aa60-c2798955c8cd.dump`;
  checksum copy verification and archive listing passed. No restore performed.
- Replaced only local Classifarr using `--no-build --pull never --no-deps`.
  Started `2026-10-11T17:50:39.035296582Z`, healthy, database connected, zero
  restarts, no OOM flag; same 2-GiB cap, read-only root and user `1000:1000`.

The post-build schema runner completed successfully against the exact new image
in an isolated, network-disabled, fresh-data fixture. The dump includes migrations
through `20261010_220000_source_catalog_mappings.sql` and seed data from 22
data-only migrations. `database/schema/current.sql` is unchanged. Fresh-install
checks found no invented pending work, images or unresolved identities; the owned
fixture container and data directory were removed and their absence verified.
No live database was used for schema generation. The final handoff is
documentation-only, and final-commit CI must be checked independently from the
starting green revision.

## Read-only rebuilt-image evaluation

At `2026-10-11T17:51:16.953Z`, the actual rebuilt service preview returned source
title `Episode 27` beside catalog title `Action`, with 155 source-ID matches and
one human proposal. Reference: `cb3b7554-2c25-4122-bfa1-d515e9970386`.
Database writes were disabled for the probe. `canApply`, `persisted` and backfill
eligibility remained false. No identity approval was asserted or saved.

Before/after: seven approved/materialized mappings, zero human-episode approvals,
four unresolved items, ten active/covered libraries. A separate database-only
consumer check preserved these counts, counted 6,832 classifications once and
reported consistent 6,810 pending image embeddings. A ten-item batch took 5 ms;
this single observation is not a benchmark. No startup WARN/ERROR rows appeared
in the brief observation window. Early container memory was 567.4 MiB / 2 GiB;
this is not a memory-soak result or a claimed memory fix. Plex, Unraid and shared
Ollama were unchanged.

## Recommendation stack

1. Use source and typed target context to guide review. Benefit: fewer blind
   coordinate-only decisions. Limitation: titles may be generic, stale or wrong.
2. Verify actual episode identity and explicitly approve only supported mappings;
   let complete owned sync/backfill apply them. Benefit: preserves grouping and
   provenance. Cost: human review remains necessary for missing provider IDs.
3. Next design an explicit, reviewed cross-media exception for source TV episodes
   cataloged as standalone movies, including downstream document typing and
   backfill. The reunion candidate demonstrates this gap, but does not authorize
   a real mapping. Keep remaining grouped seasons unresolved until verified.
   No arbitrary substitute ID or cross-type coercion.
4. Review Zod 4.6.6 as the next small dependency batch. Keep Node 24 declarations
   until an intentional, separately tested runtime migration.
