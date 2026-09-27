# Published-image upgrade and recovery outcome

## Result — 2026-09-27

Passed the isolated published-release → local-candidate recovery scenario.
The test found and fixed a real upgrade blocker: the published schema-only
snapshot omitted the initial restore-admission singleton. See the separate
[design, research and tradeoffs](published-upgrade-recovery-design.md).

| Evidence | Result |
| --- | --- |
| Published baseline | `v0.48.4-beta`; verified GitHub attestation, expected workflow and source revision |
| Baseline digest | `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f` |
| Baseline source | `a0e417fd714919bb4ca30e20f9cd2380136ca74e` |
| Tested candidate image | `sha256:468f812b008e123170b1443f38cf3e2a2dd3b4024644897e2cdd6e46820d6f0b` |
| Database versions | PostgreSQL `180006` on both sides; not a major-version migration |
| Applied migration count | 222 → 286 |
| Interruption | Whole disposable container killed after a verified PostgreSQL restore lock wait |
| Recovery | Configuration rollback, refused unverified startup, explicit verified retry, normal restart |
| Learning handoff | Movie and TV repaired, enriched and current; music excluded; zero routing tasks |
| Cleanup | Test containers, network, volume and candidate image removed |

The candidate image identifies the tested working tree, not a published or
attested build. The drill's private backup/password were discarded with its
scratch volume. Its bounded result is in `.tmp/published-upgrade-drill-final.log`
for this local run; that file is intentionally not committed.

## Validation

- Full backend suite: **43,885 tests across 1,474 suites passed**.
- Focused real-database regressions: **90 tests across 9 suites passed**.
- Backend coverage: **90.29% lines, 84.49% branches**; coverage ratchet passed.
- Server/client type checks, server security/test lint, migration/snapshot
  integrity, ESM static-import and copyright checks passed. Security lint retains
  one pre-existing warning in `captureOperatorCorrectionFrozenPolicy.mjs`.
- Production-image builds include the frontend build; no UI/API contract changed.
- GitHub MCP was checked twice: **no open PRs available**. No PR was selected,
  merged, closed or replaced with a previously closed change.

The append-only restore evidence guard remains enabled in tests. Historical
receipts are tested in their own disposable database rather than deleting or
disabling their protection. Missing modern gates, existing maintenance gates
and competing runtime ownership remain fail-closed.

## Practical lessons

Stream the fixed fixture to the released Node process: Docker refuses copying
files into read-only containers. Keep source-item identities server-scoped even
when movie and TV provider IDs have the same number. Let the existing restore
refresh finish before scheduling the newer inventory revision; the canary uses
bounded planner/worker ticks rather than writing acknowledgements directly.

An expired environment GitHub token shadowed the valid CLI keyring login locally.
Verification succeeded using that existing login in a child environment without
the stale override. The runner does not disable attestation or silently fall back
to unverified images.

## Recommendation stack and next item

Keep unit contracts, real PostgreSQL regressions, the candidate recovery drill,
and this pinned published-image drill. This adds startup compatibility evidence
without a new orchestration platform, cloud dependency or release.

**Next: automate a fresh-install and published-upgrade acceptance matrix before
release publication**, including an inventory of required operational seed rows.
Require named seed/admission, restore-interruption and recovery-to-learning checks,
and retain bounded machine-readable evidence. This addresses the demonstrated
snapshot omission and reduces repeated manual validation.

This is one Linux x64 published baseline with synthetic movie/TV fixtures. It
does not establish arbitrary historical-version compatibility, ARM support,
PostgreSQL major upgrades, live-provider recovery, AI accuracy or safe automatic
routing. The local deployment rebuild is a separate operator-requested action;
the drill never accesses that installation's data.

## Requested local deployment

After committing and pushing implementation `a93a1e34`, rebuilt the existing
local Compose service with `--no-cache --require-provenance`. Its image revision
matches that commit. A separate fresh-install container started healthy with
286 migrations and `ready / startup_ready`; the authoritative schema comparison
passed and its scratch volume/network/container were removed.

The existing local installation then restarted on image
`sha256:901765f7594b683f56b3fc06de017cf6fbcb1c746aea7dd5f7e724982f5249d9`.
Health and readiness both returned HTTP 200. Its migration count moved from
273 to 286 while preserving `ready / restore_verified`. Both existing bind mounts
were unchanged; no routing settings were edited and no release was created.

Rollback assets retained locally:

- Previous image: `classifarr-local-rollback:pre-a93a1e34`.
- PostgreSQL custom archive: `data/backups/pre-a93a1e34-20260927.dump`, created
  before migration, with mode 0600 and archive table-of-contents validation.
  This live-data archive is not committed and was not restore-tested; it is not
  a replacement for a complete persistent-data backup strategy.
