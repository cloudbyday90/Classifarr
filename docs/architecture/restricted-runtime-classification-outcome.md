# Restricted-runtime classification outcome

Date: 2026-10-04. Scope and official-source rationale are in the separate
[design](restricted-runtime-classification-design.md). No release or production
identity cutover is part of this change.

## Implemented

- The existing isolated drill now boots the real normal application under the
  restricted peer-authenticated `cf_runtime` login and classifies synthetic movie
  and TV source-library records in that process. It verifies exact persisted
  destination, method, confidence, completion and non-routing state.
- Separate bounded read-only observers compare the same IDs and decisions after
  database dump/restore and a clean database/application restart. They never
  reissue classification. Missing, duplicate or incorrect results fail the drill.
- The launcher accepts an immutable local image ID, requires a retained caller
  tag, collision-checks its random project, uses only owned image aliases and
  verifies that cleanup actually removed its resources. Existing source-build
  mode remains available. Production permissions and Compose templates are unchanged.

## Validation

- 233 focused unit tests across nine suites passed; 23 isolated PostgreSQL
  integration tests across two suites passed. These are scoped checks, not a
  claim that every repository test ran.
- Backend ESLint, TypeScript and Knip checks passed. The two changed host scripts
  also passed ESLint. Migration naming, schema integrity, static-import,
  copyright and Markdown checks passed.
- Ownership drift check passed: 19 owned, 246 separately coordinated and 501
  unresolved paths. Only the six affected rehearsal boundary entries were
  reviewed; no unresolved path was promoted. `productionCompatible` remains false.
- Two current GitHub CLI enumerations returned no open PRs. No PR was available
  for random local implementation, and no closed PR was substituted or merged.

The first no-cache image was built from `b13750db0fc4ba25991265fbe9526300ee4c31e9`:
`sha256:bc2342eefee2f953eaeec4441385944a170f519a93c39b79f03a882f1346af5f`.
The first launch refused an unsupported `compose run --no-build` option before
creating any container; owned aliases were cleaned up. The launcher correction
uses the documented opt-in build behavior and `--pull never`, with a regression
assertion forbidding both build flags. The subsequent complete image drill passed.

All nine restricted-boundary phases passed, including classification, denied
schema/role/file access, restore exclusion/quarantine, separate maintenance,
queue admission/budget refusal, real image-index rebuild, preserved restored
classification, clean restart and legacy identity-copy/crash recovery. Existing
packaged-entrypoint profiles passed for UID 1000, custom UID 2345 and Unraid-style
UID 99, including compatible queue/index workers and ten-second host shutdowns.
Node loss, PostgreSQL loss and deliberate forced-kill/WAL recovery were checked.
The forced kill was correctly nonzero, not described as a clean stop.

Queue pressure/cooldown fixtures deliberately age synthetic observations; they
do not prove real cooldown elapsed. These profiles run on local Docker Linux,
not on physical Unraid or Synology hardware. The classification fixture invokes
the real service in the normal process, not the public classification HTTP route.
Optional provider/embedding calls and external routing are not covered.

## Final image and local evaluation

The final no-cache build uses runtime commit
`5fee8889e7fe9eabd282e48d1c988e340dbd95ff`, with the matching OCI revision label:
`sha256:af01f8fbb16b5ab47b40b53209c9f9d76aaa85d55fec3943be30ca1f5f91ee4a`.
This is a local Docker image ID, not a registry manifest or signed provenance.
The client production build and both zero-vulnerability npm audits passed again.
All nine restricted-boundary phases passed again on this image.

After rebuilding, the existing `dump-schema` implementation used this image's
PostgreSQL 18 in a separate network-disabled, bounded scratch container. The
current committed schema loaded, dumped, loaded into a second fresh database
and dumped with zero drift. The scratch container was removed; no application
data was used and `database/schema/current.sql` did not change.

All three packaged-entrypoint profiles passed again on the final image, including
their queue/index workers, stop/restart checks and UID expectations. The final
drill reported passed with cleanup passed; its containers, six volumes and four
aliases were removed, and the original caller image remained available.

Only local Compose service `classifarr` was recreated, preserving its existing
mounts. Container `aecaef91faad0da8e4ecb813999a59d0bfbfe377123aaa878057771066a4c63f`
started at `2026-10-04T20:38:21.941744004Z` on the final image. `/health` returned
200/connected and unauthenticated library access returned 401. Node 24.21.0,
PostgreSQL 18.6 and pgvector 0.8.7 were verified. Startup maintenance completed
before supervision, and no startup maintenance child remained.

Initial samples ranged from 85.20% CPU during startup to 0.59% afterward, with
353.6–407.3 MiB memory of the existing 2 GiB limit (about 20% at the latter sample).
There were no container restarts or OOM kills. Existing Compose CPU and PID caps
remain unset. This short observation does not establish sustained-load capacity
or absence of leaks; PostgreSQL workers and one application process remained.

The previous local image was retained before either rebuild as
`classifarr-local-rollback:before-restricted-classification`, pointing to
`sha256:af594e9f437ae85a465e5ba1a5d9b10270d60f1d2ab60a86129b818853e0caf4`.
Retaining it is not a tested previous-image rollback. Unrelated containers and
the live Unraid installation were not changed.

After the first background cycle, all eight owned ingestion states were complete
and had been updated during this start. No ERROR entries were recorded for this
container. Two existing `legacy_owner_unknown` warnings remained: library 4 kept
its two old running markers and library 5 kept six. Neither library acquired an
invented ingestion-owner row. Sharing Plex with Unraid does not share database
ownership; the installations use separate databases. This rehearsal does not
resolve or suppress those warnings.

Remote CI is separate and not yet verified for this revision. Passing local
checks does not claim green remote CI. The outcome-only commit records evidence
without changing the runtime source tested in the final image.

## Recommendation stack

1. Keep the extended restricted-runtime drill. It proves useful writes and
   maintenance separation; its cost is a longer disposable-image test.
2. Next add authenticated request/policy routing under restricted identity.
   This closes the remaining normal-workflow gap; it requires bounded synthetic
   provider fixtures and denial-path assertions, not live *arr operations.
3. Only then propose production identity migration with supported-template and
   rollback evidence. It offers stronger isolation but cannot be inferred from
   this ordinary-DML fixture. Keep reviewed, fenced legacy-ingestion recovery.

The recovery and release-evidence skills kept disposable evidence separate from
local deployment and Unraid, and prevented a passing fixture from authorizing
production ownership takeover or privilege changes.
