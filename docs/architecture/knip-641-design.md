# Dependency analysis refresh — design

## Scope and evidence, 2026-10-11

The next bounded tooling batch updates server-only Knip 6.40.0 to exactly 6.41.0
in the manifest and lockfile. Node 24.21.0, npm 12.2.0, declaration major versions,
runtime dependencies, lifecycle permissions, ownership and memory limits stay put.
No migration, release, provider mutation or new recovery scheduler is needed.

The identity follow-up is observational: the normal 06:00 Eastern library sync
applied all seven explicitly approved mappings. At 10:01:13 UTC the local count
was four unresolved, with seven current materialization receipts. Those four
remain incomplete; parent artwork is not episode identity evidence. This is not
a fresh Unraid result. Do not add another recovery path to solve a wait that has
already completed correctly.

## Official research

Discovered and opened through connected MCP services on 2026-10-11:

- [Knip 6.41 release](https://github.com/webpro-nl/knip/releases/tag/knip%406.41.0)
  changes nested ignore handling, resolver-cache reset, optional binary recognition
  and shell parsing. These affect analysis correctness, not application routing.
- [Knip production mode](https://knip.dev/features/production-mode) distinguishes
  shipped code from tests and development dependencies. Retain both existing modes.
- [Knip CLI cache](https://knip.dev/reference/cli) documents metadata-based caching.
  Check uncached results as well as the repository's cached commands; a stale cache
  must not mask a regression.
- [DefinitelyTyped versioning](https://github.com/Definitelytyped/DefinitelyTyped)
  aligns declaration major/minor versions with the represented library. Newer
  Node declarations do not establish support for a newer Node runtime.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  takes a series and season identity. Preserve exact membership evidence rather
  than treating a parent's metadata as proof for every episode.

Registry metadata confirms Knip supports the pinned Node runtime. Review lockfile
changes, native optional packages, engines and install hooks after script-disabled
resolution. Keep the existing smol-toml override and strict install policy.

## Tradeoffs and recommendation stack

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Bounded Knip minor update | Current dependency analysis fixes | Analysis or native-tool regressions | Accept only after cold and cached checks |
| Keep 6.40 indefinitely | No immediate tooling change | Miss correctness fixes | Fallback if validation fails |
| Bundle runtime and client major upgrades | Fewer batches | Poor failure attribution | Defer |
| Clear remaining identities from artwork/title | Smaller counter | Incorrect whole-work/season authority | Reject |

First verify the saved mappings, then trial the selected PR independently, restore
any rejected changes, and validate Knip. Next investigate the four remaining
episode-evidence gaps with explicit consent before modifying shared Plex metadata.
Client Playwright and Vue tooling should be separate compatibility batches.

## Random open PR trial and acceptance

A fresh query found two open PRs (#555 and #556). A random draw selected
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Apply its exact server Node-types
26.6.4 / undici-types 8.9.0 diff locally, run policy-controlled installs, full audit,
dependency-tree, typecheck and alignment tests, and restore it if incompatible.
Do not merge, relax assertions or move the Node runtime to make it pass.

For Knip, compare development and production dependency analyses before and after,
without cache and with the existing cached commands. Run lint, typechecks,
toolchain/install-policy and repository static gates. Inspect the complete lockfile
diff for unrelated changes. This dev-only batch does not require replaying the
entire runtime unit/database matrix; report that limitation explicitly.

Before the requested no-cache local Compose replacement, retain a verified database
backup and rollback image. Evaluate the exact new image, run the isolated fresh
schema dump afterward, and verify seven materialized mappings persist. No appdata
test fixtures, production writes or changes to provider budgets are allowed.
Keep observed outcomes in a separate document and consolidate Unreleased tooling
notes. Commit and push on main only after validation; no version bump or release.
