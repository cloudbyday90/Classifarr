# Gateway scheduling rehearsal binding — outcome

Date: 2026-10-19. See the [approved design and research](gateway-scheduling-binding-design.md).

## Delivered

Both scheduling and controlled-rotation rehearsals now verify their complete
three-file committed closure before setup, use sealed read-only fixture storage
and reject changed helper files, invalid manifests and cross-profile actions.
Generated configuration/state remains separate. Original packaged worker and
verifier entrypoints, action order, repeated quiet/drain checks and every rotation
cycle remain intact. Strict verifier JSON and stopped/non-OOM state replace the
substring check. Exact commands, named mounts, source exclusion, permissions,
tmpfs and resource limits are inspected; the source now explicitly has no extra
swap allowance. Cleanup includes the stager/input volume and source recheck,
tries all owned actions and cannot report success after a cleanup failure.

The recovery-change workflow preserved retry/cooldown/history invariants; the
release-evidence workflow required the exact source/image and real restore proof.
No production optimization, optional-service activation, schema/table, admin
function, live-history purge or provider operation was added. Existing PostgreSQL
UUIDv7 identities are unchanged. All authored JavaScript is modular ESM.

## Exact subject and native evidence

Implementation: `ee233c0169c6fda54b52c8a2e201d0db9bed9e09`, clean checkout when built
and exercised. No-cache local image ID:
`sha256:ec72454bae0b3cdfc3f2729ecfaf0639f690d5c56228ef011f5af03367656c53`,
Linux/amd64, matching OCI source revision. These are local integrity/identity
checks, not signed provenance, a published registry digest or multi-platform proof.
The following documentation-only commit is not a different tested image.

- `--catalog-scheduling` passed real native exports/restores, initial/second
  captures, delayed verification, registration-before-acknowledgment recovery,
  unchanged-history checks and two-generation dependency handoff. Historical rows
  stayed present; obsolete files disappeared only after two replacements and pin
  release. Exact catalog attempts remained `[2,3,2,3]`.
- `--rotation-study` passed all three cycles on the same image with a separate
  fresh database. Final state: seven inference jobs/attempts/bindings, eight
  catalog jobs, eight historical roots, two retained and six retired roots.
  Catalog attempts stayed `[2,3,2,3,2,3,2,3]`; no cleanup-operation row was created.
  Prior canonical history remained exact except the declared inference-status
  transition. Obsolete files and pins retired only through the existing rules.
- Both modes observed actual wrong-manifest refusal before setup and real
  UID-1000 append/create refusal in the fixture mount. The separate verifiers
  remained fixture-free, source-free, network-none and within inspected limits.
- Regression input-manifest SHA-256:
  `24a3547b3e108d614b4cb8ba90e949a9d1fc0945ee525d76467e070a42106234`.
  Rotation input-manifest SHA-256:
  `cf7d29b766529b5f3016c3f8ead7accde62a4e3403856a88a0a291d618147416`.
- Each run verified cleanup. Independent label scans afterward found no rehearsal
  containers/volumes or schema-check containers; input-staging and disposable
  database directories were absent. The separate unit container and regenerable
  Git-archive bundle were also removed. No caller image, backup or unrelated
  workload was removed.

## Tests and dependency batch

- Preflight passed copyright, inventory ownership, both backend Knip modes and
  gateway tooling: 102 tests, 101 passed, one Windows symlink-creation skip.
  No ownership/security baseline was refreshed.
- A separate restricted Node-only Linux container ran the 62 selected binding,
  adapter and rotation tests from a read-only committed Git archive: 62 passed,
  zero skips. This includes actual symlink refusal and the full 32 KiB argument
  launch. Its archive was extracted into bounded scratch, never over application
  source/dependencies. This unit run is distinct from production-entrypoint native
  rehearsals above.
- Five affected backend contract suites passed 36,367 tests. Lint, server/client
  type checks, all four policy gates and ESM import/mock-shape checks passed.
- Full client configuration/coverage run passed: 476 test files, 7,369 tests.
  Coverage: statements 87.79%, branches 81.84%, functions 87.50%, lines 89.47%.
  Production build and all eight Chromium production-policy browser checks passed.
  Backend full coverage was not regenerated; no combined coverage-ratchet claim.
- Dependency tooling passed 43 tests. Strict client `npm ci`, `npm ls --all` and
  full client audit passed, with zero reported vulnerabilities on 2026-10-19.
  This audit includes development dependencies, not a guarantee of safety.
- Randomly selected [PR #564](https://github.com/cloudbyday90/Classifarr/pull/564)
  was OPEN at local implementation, head
  `576f55df191e3e85194ed548bce215639ab93e1a`. Its exact five direct versions and
  lockfile were implemented locally; no merge. Lock Git blob:
  `8305fc5538514f9eed3792ca613409865803f687`. Reviewed transitive changes include
  DOM selector 10.0.3 and Undici 8.12.2 under jsdom, plus coupled Vitest and
  Playwright packages. npm's initial lock generation selected additional newer
  transitive versions; the immutable reviewed PR lock was retained instead.
  No new installer authorization, security override or runtime dependency change.
- Final Markdown checks passed across 2,300 files with zero errors; redacted
  secret checks passed for the implementation. Hosted CI after push is separate
  from the exact local image proof above.

## Local Compose evaluation and recoverability

Only normal local Classifarr was refreshed, with no build/pull during replacement.
Container `e03e1a272a03eb716520d108eaadea812fbfc84184a1d448cbc194085e8df401`
started at `2026-10-19T21:19:56.772409085Z`, became healthy on the exact image,
and reported no OOM kill. Read-only root and 2 GiB limit remain. `/health`,
`/api/system/health/ready` and `/` returned HTTP 200. Node remains 24.21.0 and
PostgreSQL 18.6. The existing Harmoniarr walkthrough container ID/start time stayed
unchanged and healthy; unrelated transient tests on the shared Docker host were
not operated on and provide no evidence for this change.

Optional gateway schemas remain absent in the ordinary application DB. Capture
guard before/after: revision 2, daily calls/tokens and reservations all zero,
`next_check_at=2026-10-09 16:50:11.617278-04` unchanged.

Private pre-refresh backup: `data/backups/gateway-scheduling-ready-20261019.dump`,
76,234,245 bytes, container-reported mode `0600`, SHA-256
`2492552062d0bdceba6d6f684a39a37d94d6599bbce2055c504715f66fb03119`.
`pg_restore --list` passed; the real application backup was not fully restored.
Previous image
`sha256:977d3c3191930c8cdff65c295016e87cac61c028c0a23ac31e4c27288b58fd57`
remains protected under
`classifarr-local-rollback:bbfbb31672c052064f8bb124e9f1d97c57e0aa67a73c25c3f47797efe1a4815f`.
Earlier images/backups remain. No Unraid/Plex/shared-Ollama changes, release,
Git tag, version bump or PR merge were performed.

## Limits and next recommendation

These are controlled `--once` scheduling observations with real dumps/restores,
not elapsed daily/cooldown or natural-cadence evidence. The registration cut is
not an observed power-loss test. The 2 GiB synthetic source harness does not prove
headroom at deployed worker limits. No new memory/performance gain is claimed,
and prior partial memory evidence remains partial. Host/daemon compromise and
off-host recovery are outside this local proof. Abrupt host loss/schema-helper
signal exit can still bypass outer volume cleanup; interrupted runs cannot pass.

Next measure the repeated read-only validations within a single archive pass,
then prototype reuse of only a confirmed duplicate within the same frozen view.
Require equivalent refusal under tampering, changed files, rotation, cancellation
and restart before reducing production checks. Avoid cross-run caching or weaker
restore requirements. Separately, review the already available PostCSS 8.5.31
source-map correction as a small follow-up, without conflating it with PR #564.
