# PostgreSQL Version Compatibility Guide

## Overview

Classifarr uses **embedded PostgreSQL 18** (Alpine package `postgresql18`) for data storage. All data is stored in a single volume at `/app/data/postgres/`.

## CPU Compatibility (AVX / non-AVX)

The pgvector extension can be compiled with AVX optimizations. On older CPUs without AVX support, vector similarity queries can crash PostgreSQL with `Illegal instruction`.

Classifarr now ships a **multi-variant pgvector build** by default and prefers the best option at startup:

- **AVX2 available** → uses the AVX2-optimized pgvector binary.
- **AVX available** → uses the AVX-optimized pgvector binary.
- **No AVX** → uses the generic (non-AVX) pgvector binary.

On writable images, startup can swap `vector.so` to match the detected CPU. On read-only runtimes, Classifarr keeps the already-installed `vector.so` and reports that active variant instead. The default `multi` build installs the generic binary as the safe fallback, so read-only environments remain compatible even when they cannot switch to AVX or AVX2 at runtime.

For local source builds in this repo, use the smart compose wrapper so the image is built for the host CPU before the read-only container starts:

```bash
npm run docker:smart:up
```

The wrapper detects host CPU support and sets `PGVECTOR_BUILD` to one of:

- `avx2` when AVX2 is available
- `avx` when AVX is available but AVX2 is not
- `generic` when no AVX support is detected
- `multi` when detection is unavailable and a portable fallback is safer

### Build Options

```
# Default: build both variants (auto-select at runtime)
docker build --build-arg PGVECTOR_BUILD=multi -t classifarr:latest .

# Force non-AVX only (best practice for portability: OPTFLAGS="")
docker build --build-arg PGVECTOR_BUILD=generic --build-arg PGVECTOR_GENERIC_OPTFLAGS="" -t classifarr:generic .

# Force AVX only (conservative AVX flags)
docker build --build-arg PGVECTOR_BUILD=avx --build-arg PGVECTOR_AVX_OPTFLAGS="-mavx" -t classifarr:avx .

# Force AVX2 only
docker build --build-arg PGVECTOR_BUILD=avx2 --build-arg PGVECTOR_AVX2_OPTFLAGS="-mavx2" -t classifarr:avx2 .
```

## Version Compatibility

PostgreSQL data directories are **version-specific**. A data directory created with PostgreSQL version X can **only** be opened by PostgreSQL version X.

**Important**: Attempting to open a PostgreSQL 18 data directory with PostgreSQL 17 (or vice versa) will result in startup failure to prevent data corruption.

## Current Version

- **Installed PostgreSQL**: 18 (from Alpine `postgresql18` package)
- **Data Directory**: `/app/data/postgres/`
- **Version File**: `/app/data/postgres/PG_VERSION`

## Version Mismatch Error

If you see this error on container startup:

```
==============================================================
ERROR: PostgreSQL version mismatch detected!
Data directory version: 18
Installed PostgreSQL:   18

To prevent data corruption, Classifarr will NOT start.

Options:
1. Use a Classifarr image with PostgreSQL 18
2. Backup and migrate your data to PostgreSQL 17
==============================================================
```

This means your data directory was created with a different PostgreSQL version than what's installed in the container. Current Classifarr images also include an automatic **17 → 18** upgrade path for existing embedded clusters.

## How to Check Your Data Directory Version

```bash
docker exec classifarr cat /app/data/postgres/PG_VERSION
```

## Resolution Options

### Option 1: Use Compatible Classifarr Image

Switch to a Classifarr Docker image that uses the same PostgreSQL version as your data directory.

For example, if your data is PostgreSQL 17:
- Use a Classifarr image that still carries PostgreSQL 17 support, or
- Start the current image and allow the built-in `pg_upgrade` path to migrate the cluster to PostgreSQL 18

### Option 2: Backup and Migrate Data

If you want to migrate data manually into the current Classifarr image (PostgreSQL 18), use the standard dump/restore flow:

#### Step 1: Backup Your Data

```bash
# Using the old container with matching PG version
docker exec classifarr pg_dump -U classifarr classifarr > classifarr_backup.sql
```

#### Step 2: Stop and Remove Old Container

```bash
docker-compose down
```

#### Step 3: Rename or Move Old Data Directory

```bash
# Assuming your data is at /path/to/data
mv /path/to/data/postgres /path/to/data/postgres.old
```

#### Step 4: Start New Container

This will initialize a new PostgreSQL 18 data directory:

```bash
docker-compose up -d
```

#### Step 5: Restore Your Data

```bash
# Wait for PostgreSQL to be ready
docker exec classifarr pg_isready -q

# Restore the backup
cat classifarr_backup.sql | docker exec -i classifarr psql -U classifarr -d classifarr
```

#### Step 6: Verify Data

Check that your data was restored correctly through the Classifarr web interface.

#### Step 7: Clean Up

Once verified, you can remove the old data directory:

```bash
rm -rf /path/to/data/postgres.old
```

### Option 3: Start Fresh

If you don't need to preserve your data:

```bash
# Stop container
docker-compose down

# Remove data directory
rm -rf /path/to/data/postgres

# Start container (will initialize fresh database)
docker-compose up -d
```

## Preventing Version Mismatches

### Pin Your Docker Image Tag

Instead of using `latest`, pin to a specific version:

```yaml
# docker-compose.yml
services:
  classifarr:
    image: cloudbyday90/classifarr:v0.38.0  # Pin to specific version
```

### Use Named Volumes

Docker named volumes make it easier to manage data:

```yaml
services:
  classifarr:
    volumes:
      - classifarr-data:/app/data

volumes:
  classifarr-data:
```

### Regular Backups

Schedule regular backups of your PostgreSQL database:

```bash
# Add to cron
0 2 * * * docker exec classifarr pg_dump -U classifarr classifarr | gzip > /backups/classifarr_$(date +\%Y\%m\%d).sql.gz
```

## Troubleshooting

### Check PostgreSQL Version in Container

```bash
docker exec classifarr psql --version
```

### View PostgreSQL Logs

```bash
docker exec classifarr cat /app/data/postgres.log
```

### Inspect the Most Recent Startup Failure

```bash
docker exec classifarr sh -lc 'tail -n 200 /app/data/postgres.log'
```

Look for the first `FATAL:` or `PANIC:` line. That line is usually the real root cause, while `pg_ctl: could not start server` is only the wrapper error.

If the first failure line looks like this:

```text
FATAL: could not access file "pg_stat_statements": No such file or directory
```

the real issue is not cluster initialization. PostgreSQL finished `initdb`, then refused to start because `shared_preload_libraries` referenced `pg_stat_statements` while the runtime library was missing from the image. Classifarr now treats `pg_stat_statements` as optional observability:

- Fresh installs continue to boot even if the extension runtime is temporarily unavailable.
- Existing data directories have stale `pg_stat_statements` preload lines stripped automatically so PostgreSQL can start.
- If a later image restore makes the extension available again, startup preflight will install it automatically.

You can confirm the current status from inside the container:

```bash
docker exec classifarr psql -U classifarr -d classifarr -c "SHOW shared_preload_libraries"
docker exec classifarr psql -U classifarr -d classifarr -c "SELECT name, installed_version FROM pg_available_extensions WHERE name = 'pg_stat_statements'"
docker exec classifarr psql -U classifarr -d classifarr -c "SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'"
```

### Included Config Files During PG17 -> 18 Upgrade

PostgreSQL supports `include`, `include_if_exists`, and `include_dir` inside `postgresql.conf`. Those files remain part of the supported configuration surface for Classifarr because they can live under the persisted cluster directory in `/app/data/postgres/`.

Classifarr's upgrade/startup boundary is intentionally narrow:

- Classifarr **does** auto-normalize its managed settings in `postgresql.conf` and `postgresql.auto.conf`.
- Classifarr **does not** rewrite arbitrary included config trees during PG17 -> 18 upgrade.
- If startup diagnostics report included config files, review those files manually for old path-format assumptions such as malformed `dynamic_library_path` or stale `shared_preload_libraries` entries.

That policy is deliberate. PostgreSQL's own `pg_upgrade` guidance treats included config files as part of the administrator-managed configuration set that may need review and adjustment in the new cluster, rather than something tooling should rewrite blindly.

### Unraid Storage Guidance

If you run Classifarr on Unraid:

- Keep the `appdata` share on a cache or named pool for Docker workloads when possible.
- Stop Docker before moving `/mnt/user/appdata/classifarr` between pools, disks, or share layouts.
- After any move, confirm the files are still owned by the container UID/GID you run with, typically `99:100`.

### Manual PostgreSQL Start (Debug)

```bash
docker exec -it classifarr sh
su-exec classifarr pg_ctl -D /app/data/postgres start
```

## Support

If you encounter issues during migration:
1. Check existing GitHub issues: https://github.com/cloudbyday90/Classifarr/issues
2. Create a new issue with:
   - Your PostgreSQL versions (old and new)
   - Error messages
   - Steps you've tried

## Additional Resources

- [PostgreSQL Upgrade Documentation](https://www.postgresql.org/docs/current/upgrading.html)
- [pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore Documentation](https://www.postgresql.org/docs/current/app-pgrestore.html)
