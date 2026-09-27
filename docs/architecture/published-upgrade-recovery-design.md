# Published-image upgrade and recovery acceptance

## Decision

Extend the disposable recovery tests with a published-image boundary. Start the
real `v0.48.4-beta` image, create synthetic movie/TV configuration and export it,
then replace that image with the local candidate while retaining only the new
project's data volume. Exercise the actual shell entrypoint and bundled database.

The baseline is pinned to the release's published digest and source revision,
not `latest` or a locally rebuilt approximation. GitHub CLI provenance verification
must pass before the baseline runs. Failure is not downgraded to a warning.

## Research, checked 2026-09-27

- [Published release](https://github.com/cloudbyday90/Classifarr/releases/tag/v0.48.4-beta),
  discovered through GitHub MCP: source `a0e417fd714919bb4ca30e20f9cd2380136ca74e`,
  GHCR digest `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- [Docker Compose trust model](https://docs.docker.com/compose/trust-model/): review
  the complete Compose boundary and pin remote image inputs to immutable digests.
- [GitHub artifact verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations):
  require the expected repository, signer workflow and source revision, not merely
  the existence of an attestation. Provenance is not proof of application safety.
- [PostgreSQL upgrade guidance](https://www.postgresql.org/docs/18/pgupgrade.html):
  use trusted source data and synthetic upgrade tests. A same-major image upgrade
  must not be described as evidence of a PostgreSQL major-version migration.
- [PostgreSQL advisory-lock functions](https://www.postgresql.org/docs/18/functions-admin.html)
  support nonblocking exclusive ownership; session locks require balanced release.
  [INSERT conflict handling](https://www.postgresql.org/docs/18/sql-insert.html)
  supports preserving existing gate rows with `ON CONFLICT DO NOTHING`.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  explicit textual outcomes are preferable to color-only signals. This CLI emits
  named checks and bounded JSON; no UI or WCAG-conformance claim is introduced.

## Safety and architecture

The host runner owns a fresh random Compose project, checks for collisions, uses
fixed argument arrays without a shell, and never accepts arbitrary targets. The
Compose file has an internal network, no published ports, no host mounts and no
Docker socket. Application processes run as UID 1000 with dropped capabilities.
Both image generations use their own unmodified entrypoints. The candidate is
built from this checkout and its local image ID is recorded; it is not described
as a published or attested candidate.

Test-only fixture/probe modules verify an explicit disposable-run marker and the
expected container paths before accessing the database. A synthetic admin password
and backup stay in the disposable volume, never in output or committed artifacts.
No real library data, API keys, media paths, AI calls or routing changes are needed.
The fixed seed helper is streamed to the release's Node process through stdin:
Docker rejects `compose cp` with a read-only root filesystem, even for `/tmp`.
Failure diagnostics are bounded, local-only files under the ignored `.tmp/`;
the final JSON receipt excludes child logs and fixture credentials.

## Upgrade defect found and repair

The published schema-only snapshot includes the restore-gate table but omits
the `startup_ready` singleton originally inserted alongside its DDL. Its migration
ledger marks that original migration applied. The newer admission guard therefore
rejects this otherwise unused gate before ordinary migrations can repair it.

A data-only, snapshot-required migration now includes the seed in fresh snapshots.
For older missing gates, a small admission bootstrap applies only that fixed seed
migration on the existing pinned session, before normal service construction.
It requires the migration/receipt tables, a pending seed migration and exclusive
maintenance ownership. Seed and ledger commit atomically. The SQL uses conflict
preservation and refuses initialization when restore verification receipts exist.
Admission rereads the gate afterward; migration completion alone is insufficient.

Existing non-ready gates never enter this repair. Deleting a gate after the seed
migration has run remains a fail-closed condition, not an automatic reset. Unknown
or damaged historical state still requires explicit maintenance. This repair is
not a generic authorization to reconstruct missing operational records.

The scenario progresses through release startup/export → candidate migration →
restore-mode interruption → rejected normal startup → explicit retry/verification
→ movie/TV recovery-to-profile canary → controlled normal restart. The interruption
is synchronized by a real PostgreSQL lock wait and kills the entire disposable
application container, including its bundled database. No production fault hook
or arbitrary sleep is needed.

The handoff uses synthetic source/provider adapters with real production sync,
identity recovery, queue/enrichment persistence and revision-verified profile
publication. It is a deterministic service canary, not a live-provider integration,
scheduler timing test, AI quality benchmark or routing authorization. Music source
items must be ignored. All timing adjustments apply only to synthetic retry rows.

## Options and final stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Schema-only rehearsal | Fast and good migration diagnostics | Misses image entrypoint and persisted-volume compatibility | Keep |
| Published digest to candidate | Tests actual shipped baseline and container restart | Registry/auth/build cost; finite fixtures and host architecture | Add now |
| Live installation restore | Real data shape | Unnecessary data-loss and operational risk | Reject for development |
| Full external workflow platform | Broader orchestration features | New infrastructure and failure modes for one bounded drill | Defer |

Recommended stack: unit contracts → PostgreSQL regressions → candidate recovery
drill → published-image upgrade/recovery matrix. Keep the two drills separate:
the fast candidate drill diagnoses restore changes; the published-image test adds
installation compatibility. Do not relax failure gates to make either pass.

## Acceptance

Require verified baseline provenance, healthy release startup, a real release
export, newly applied candidate migrations, rollback after container death,
fail-closed normal startup, verified explicit retry, movie/TV enriched current
profiles, music exclusion and no classification-routing tasks. Record the exact
baseline digest, candidate image ID, database major versions and named outcomes.
Cleanup failure must fail the command. Abrupt host/Docker termination can leave
scratch resources; cleanup must always target the exact generated project.

See the separate [execution outcome](published-upgrade-recovery-outcome.md).
