# Embedded PostgreSQL Alpine 3.24 Runtime Decision

## Outcome

Classifarr upgrades its Node runtime base from Alpine 3.23 to Alpine 3.24.
It retains the embedded PostgreSQL design: PostgreSQL 18 is the running
database, PostgreSQL 17 remains in the image only to support automatic
in-place `pg_upgrade`, and pgvector is built from a pinned source release for
both major versions.

This combines the base-image update with a persisted pgvector extension
upgrade. PostgreSQL remains on major version 18; the bundled PostgreSQL 17
binaries exist only to make persisted 17-to-18 cluster upgrades self-contained.

## Current Runtime Contract

- Base image: `node:24.18.1-alpine3.24`.
- PostgreSQL runtime: Alpine `postgresql18` 18.4.
- Upgrade compatibility: Alpine `postgresql17` 17.10 remains installed for
  `pg_upgrade`.
- Vector extension: source-built pgvector 0.8.6 for PostgreSQL 17 and 18,
  with generic, AVX, and AVX2 PostgreSQL 18 binaries.
- Persistent database location: `/app/data/postgres`.

The image must not use Alpine's `postgresql-pgvector` package for this path:
Alpine 3.24 supplies 0.8.1, which would downgrade the required 0.8.6 extension
and does not provide the project-specific dual-major, multi-CPU build.

## Persisted pgvector Upgrade

The image verifies the SHA-256 digest of the upstream pgvector 0.8.6 source
archive before compiling it for both PostgreSQL majors. The database migration
`20260808_140000_upgrade_pgvector_to_0_8_6.sql` then performs
`ALTER EXTENSION vector UPDATE TO '0.8.6'` only when the extension is already
installed. This is transactional: if PostgreSQL cannot find the expected
extension upgrade chain, startup fails before application services can use a
partially updated database.

Fresh installations load `database/schema/current.sql` and mark historical
migrations applied in the same transaction. The schema generator therefore
adds the same explicit pgvector normalization after `CREATE EXTENSION vector`.
That prevents a snapshot generated against an older extension from silently
remaining old on a new installation.

The migration never creates `vector` on an existing installation where it is
absent. That preserves the optional-extension behavior and avoids changing an
operator's schema unexpectedly. PostgreSQL extension upgrades are forward-only
for this deployment path; take a normal database backup before replacing an
existing production image.

## Evidence And Options

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Stay on Alpine 3.23 | Already verified and supported until November 2027 | Shorter support window and misses the current maintained branch | Do not choose |
| Move to Alpine 3.24, retain embedded database build | Current supported Alpine branch through June 2028; retains existing data, automatic PostgreSQL 17-to-18 upgrades, and CPU-safe pgvector variants | Requires no-cache image build and database upgrade smoke coverage | Adopt |
| Replace the embedded database with `pgvector/pgvector` | Removes the custom pgvector compile from a database image | Changes deployment and persistence architecture; official image is one PostgreSQL major per image and cannot replace the existing dual-major upgrade path | Defer to a dedicated architecture project |
| Use Alpine `postgresql-pgvector` | Uses a distribution package | Alpine 3.24 supplies 0.8.1, would downgrade the extension, and cannot provide the dual-major CPU-aware build | Reject |
| Source-build pgvector 0.8.6 and migrate installed extensions | Uses the current upstream release, verifies the source archive, preserves the dual-major upgrade path, and makes the persistent upgrade explicit | Requires an image rebuild, snapshot refresh, and a real database upgrade test | Adopt |
| Replace the embedded database with `pgvector/pgvector` | Removes the custom pgvector compile from a database image | Changes deployment and persistence architecture; official image is one PostgreSQL major per image and cannot replace the existing dual-major upgrade path | Defer to a dedicated architecture project |

## Security And Reliability Constraints

1. Pin the Node and Alpine major/minor tag in the Dockerfile. Do not use
   mutable `alpine` or `latest` tags.
2. Continue compiling pgvector with portable generic flags and retain the
   guarded AVX/AVX2 selection. The upstream project documents that native CPU
   compilation can cause `Illegal instruction` failures on another host.
3. Build pgvector for both PostgreSQL 17 and 18. `pg_upgrade` verifies
   extension binary compatibility before changing persisted data.
4. Validate the image with a no-cache build and the PostgreSQL startup smoke
   test, including the PostgreSQL 17-to-18 upgrade path. Do not test against
   or mutate an operator's mounted `./data` directory.
5. Treat every pgvector update as a database migration. First verify that the
   new extension works with both server versions, checksum the source archive,
   then use and verify `ALTER EXTENSION vector UPDATE` on a representative
   persisted database and in the schema snapshot.

## Source Review

- [Alpine release branches](https://www.alpinelinux.org/releases/) identifies
  Alpine 3.24 as the current stable branch and lists support through June 2028;
  3.23 remains supported but is older.
- [Official PostgreSQL Docker image](https://hub.docker.com/_/postgres?tab=tags)
  publishes PostgreSQL 18.4 and PostgreSQL 17.10 Alpine 3.24 tags.
- [pgvector release and installation guidance](https://github.com/pgvector/pgvector)
  publishes 0.8.6, supports PostgreSQL 13+, documents portable `OPTFLAGS=""`
  builds, and documents explicit extension upgrades.
- [PostgreSQL ALTER EXTENSION](https://www.postgresql.org/docs/current/sql-alterextension.html)
  defines the server-supported extension update operation used by the migration.

## Verification Required

The implementation is accepted only after all of the following pass:

```bash
docker build --no-cache --build-arg PGVECTOR_BUILD=multi -t classifarr:pgvector-0.8.6-validation .
IMAGE_NAME=classifarr:pgvector-0.8.6-validation npm run db:dump-schema:container
IMAGE_NAME=classifarr:pgvector-0.8.6-validation npm run db:check-schema:container
IMAGE_NAME=classifarr:pgvector-0.8.6-validation npm run docker:smoke:pgss
docker compose config --quiet
```

The smoke test must show PostgreSQL 18 startup and a successful PostgreSQL
17-to-18 upgrade seeded with pgvector 0.8.2, with the upgraded PostgreSQL 18
cluster reporting pgvector 0.8.6 and retaining `pg_stat_statements` runtime
files.
