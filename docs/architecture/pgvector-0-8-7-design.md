# pgvector 0.8.7 security update

## Decision

Upgrade the packaged native extension and existing database catalogs together.
Keep PostgreSQL 18, the PostgreSQL 17 upgrade bridge, existing storage mounts,
and application retrieval behavior unchanged. No release is created here.

Research checked on 2 October 2026. The maintainer reports that pgvector 0.8.6
and earlier allow an index-creating database user to write beyond allocated
memory during IVFFlat index creation (CVE-2026-103484). The fix is 0.8.7.
This is distinct from the earlier 32-bit-only fix in 0.8.6.
[Maintainer advisory](https://github.com/pgvector/pgvector/issues/1036).

## Security boundary

The affected boundary is SQL index data entering native extension code, not
the HTTP request parser. The upstream patch validates dimensions at index
entry points and bounds center accumulation for vector, halfvec and bit
values. It also hardens HNSW entry points.
[Upstream fix](https://github.com/pgvector/pgvector/commit/ee00d39ab30c2a7cf9510abf9288c624d91db156).

Classifarr currently creates HNSW indexes, uses parameterized embedding writes,
and validates dimensions and finite float32 values. No application IVFFlat DDL
path was identified. Those facts do not eliminate the native vulnerability:
the default embedded application/database identity retains index-creation
authority. This update does not claim or introduce full privilege separation.

## Implementation

- Pin source version 0.8.7 and SHA-256
  `cac0b10c360f05b2d521200105ba3697e773d4cd3731f5a915a7e37ebe0bea85`.
  The downloaded tag resolved to commit
  `f37c13f68b57d2c3472b2214fbcff699d6d34876`. The checksum pins the reviewed
  archive; it is not a claim of an upstream signature.
- Compile that same source for PostgreSQL 17 and 18. Preserve generic, AVX and
  AVX2 choices on x86_64. On ARM64, `multi` means generic only; explicit AVX
  requests fail before compilation. Preserve portable `OPTFLAGS=""`.
  [Upstream installation and portability guidance](https://www.pgxn.org/dist/vector/0.8.7/).
- Add `20261002_120000_upgrade_pgvector_to_0_8_7.sql`. Existing extensions below
  the target update transactionally. Absent extensions stay absent; numeric
  newer versions are not downgraded. Missing update files and insufficient
  privileges remain errors, so the migration ledger cannot record false success.
- Add a forward-only guard to the historical 0.8.6 migration. Its filename and
  prior applied ledger entries stay intact. This narrow change is necessary for
  legacy initialization that creates the image's default extension before
  replaying historical migrations.
- Update the fresh schema, generator, current test images and restore drill.
  The pinned release rehearsals load historical extension SQL from the old
  image into a disposable new-image container. This preserves the unchanged
  release snapshot rather than rewriting its extension statements.

PostgreSQL requires the extension's update scripts and ownership for
`ALTER EXTENSION UPDATE`. Installing new files and updating the per-database
catalog are separate operations.
[PostgreSQL extension update documentation](https://www.postgresql.org/docs/current/sql-alterextension.html).

## Options and tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Binary update only | Small image change | Leaves catalog and fresh/replay contracts inconsistent | Reject |
| Patched binary plus forward migrations | Covers new and persisted installations without changing templates | Requires image rollout, backup and upgrade validation | Adopt |
| Remove IVFFlat or rely on HNSW usage | Reduces one application path | Does not replace the upstream fix or protect database index creators | Reject as remediation |
| Full database role separation now | Reduces privileges after compromise | Changes startup/maintenance compatibility and needs its own rollout | Separate follow-up |

## Deployment and recovery

1. Back up the database and retain the previous image identity.
2. Deploy an image built with this patch; keep existing data mounts and settings.
   A source commit alone does not update a running container.
3. Let normal startup migrations finish. Confirm the image provenance and
   `SELECT extversion FROM pg_extension WHERE extname = 'vector';`.
   Catalog version alone does not prove which native binary is loaded.
4. For external PostgreSQL, install the matching patched native files, restart
   PostgreSQL to discard previously loaded libraries, then apply the migration
   with extension-owner privileges. Do not suppress a failed upgrade.
5. If rollback is required, restore the pre-upgrade backup using a compatible
   image. Do not force a downgrade or assume that replacing only the image is
   sufficient.

No media moves, re-embedding, automatic index rebuild, new service, new volume,
or Compose/Unraid template edit is required by this change. Existing indexes
are tested across the upgrade; no claim is made about repairing pre-existing
index corruption.

W3C guidance applies to the operator instructions here: short steps, clear
headings and descriptive links. No UI behavior changes or WCAG-conformance
claim are part of this native dependency update.
[W3C writing guidance](https://www.w3.org/WAI/tips/writing/).

## Recommended order

1. Ship this tested pgvector fix through the normal image release process.
2. Update Node/npm/Alpine in a separate tested runtime change; npm also supplies npx.
3. Continue staged database privilege separation and recovery acceptance testing.

See the [validation outcome](pgvector-0-8-7-outcome.md).
