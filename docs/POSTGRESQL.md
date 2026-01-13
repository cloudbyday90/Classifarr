# PostgreSQL Version Compatibility Guide

## Overview

Classifarr uses **embedded PostgreSQL 17** (Alpine package `postgresql17`) for data storage. All data is stored in a single volume at `/app/data/postgres/`.

## Version Compatibility

PostgreSQL data directories are **version-specific**. A data directory created with PostgreSQL version X can **only** be opened by PostgreSQL version X.

**Important**: Attempting to open a PostgreSQL 18 data directory with PostgreSQL 17 (or vice versa) will result in startup failure to prevent data corruption.

## Current Version

- **Installed PostgreSQL**: 17 (from Alpine `postgresql17` package)
- **Data Directory**: `/app/data/postgres/`
- **Version File**: `/app/data/postgres/PG_VERSION`

## Version Mismatch Error

If you see this error on container startup:

```
==============================================================
ERROR: PostgreSQL version mismatch detected!
Data directory version: 18
Installed PostgreSQL:   17

To prevent data corruption, Classifarr will NOT start.

Options:
1. Use a Classifarr image with PostgreSQL 18
2. Backup and migrate your data to PostgreSQL 17
==============================================================
```

This means your data directory was created with a different PostgreSQL version than what's installed in the container.

## How to Check Your Data Directory Version

```bash
docker exec classifarr cat /app/data/postgres/PG_VERSION
```

## Resolution Options

### Option 1: Use Compatible Classifarr Image

Switch to a Classifarr Docker image that uses the same PostgreSQL version as your data directory.

For example, if your data is PostgreSQL 18:
- Look for a Classifarr image tagged with PostgreSQL 18 support
- Update your `docker-compose.yml` to use that image tag

### Option 2: Backup and Migrate Data

If you want to use the current Classifarr image (PostgreSQL 17), you need to migrate your data:

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

This will initialize a new PostgreSQL 17 data directory:

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
