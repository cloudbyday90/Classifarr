#!/bin/sh
set -e

# ===========================================
# Classifarr Docker Entrypoint
# All-in-One with Embedded PostgreSQL
# ===========================================

DATA_DIR="/app/data"
PG_DATA="$DATA_DIR/postgres"
PG_RUN="/run/postgresql"
VERSION_FILE="$DATA_DIR/app_version"

# Default values for PUID/PGID/UMASK
PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-022}
IS_ROOT="false"
if [ "$(id -u)" -eq 0 ]; then
    IS_ROOT="true"
fi

echo "Starting Classifarr with embedded PostgreSQL..."
echo "Node.js version: $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "PUID: $PUID"
echo "PGID: $PGID"
echo "UMASK: $UMASK"
echo "Running as UID: $(id -u) (root: $IS_ROOT)"

# Set umask
umask "$UMASK"

# Create or modify the classifarr group/user (root only)
if [ "$IS_ROOT" = "true" ]; then
    # Create or modify the classifarr group
    if ! getent group classifarr >/dev/null; then
        # Check if a group with target GID already exists
        EXISTING_GROUP=$(getent group "$PGID" | cut -d: -f1)
        if [ -n "$EXISTING_GROUP" ]; then
            echo "GID $PGID already used by group '$EXISTING_GROUP', will use that group"
            # Create classifarr user that will be added to the existing group later
        else
            echo "Creating classifarr group with GID $PGID..."
            addgroup -g "$PGID" classifarr
        fi
    else
        # Modify existing classifarr group if GID differs
        CURRENT_GID=$(getent group classifarr | cut -d: -f3)
        if [ "$CURRENT_GID" != "$PGID" ]; then
            # Check if target GID is already in use
            EXISTING_GROUP=$(getent group "$PGID" | cut -d: -f1)
            if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "classifarr" ]; then
                echo "GID $PGID already used by group '$EXISTING_GROUP', will use that group"
                # Delete classifarr group since we'll use the existing one
                delgroup classifarr 2>/dev/null || true
            else
                echo "Modifying classifarr group GID from $CURRENT_GID to $PGID..."
                groupmod -g "$PGID" classifarr 2>/dev/null || echo "Could not modify GID, continuing..."
            fi
        fi
    fi

    # Determine which group to use for classifarr user
    TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
    if [ -z "$TARGET_GROUP" ]; then
        TARGET_GROUP="classifarr"
    fi
    echo "Using group: $TARGET_GROUP (GID: $PGID)"

    # Create or modify the classifarr user
    if ! id classifarr >/dev/null 2>&1; then
        echo "Creating classifarr user with UID $PUID in group $TARGET_GROUP..."
        adduser -u "$PUID" -G "$TARGET_GROUP" -s /bin/sh -D classifarr
    else
        # Modify existing user if UID differs
        CURRENT_UID=$(id -u classifarr)
        if [ "$CURRENT_UID" != "$PUID" ]; then
            echo "Modifying classifarr user UID from $CURRENT_UID to $PUID..."
            usermod -u "$PUID" classifarr 2>/dev/null || echo "Could not modify UID, continuing..."
        fi
        # Ensure user's primary group is correct
        CURRENT_PRIMARY_GID=$(id -g classifarr)
        if [ "$CURRENT_PRIMARY_GID" != "$PGID" ]; then
            echo "Setting $TARGET_GROUP as primary group for classifarr user..."
            usermod -g "$TARGET_GROUP" classifarr 2>/dev/null || echo "Could not modify group, continuing..."
        fi
    fi
else
    echo "Running as non-root: skipping user/group updates and ownership fixes."
fi

# Ensure directories exist
mkdir -p "$PG_DATA" "$PG_RUN" "$DATA_DIR/logs"

# Determine app version for upgrade-aware one-time tasks
APP_VERSION="unknown"
if command -v node >/dev/null 2>&1; then
    APP_VERSION=$(node -p "require('/app/package.json').version" 2>/dev/null || echo "unknown")
fi
PREVIOUS_VERSION=""
if [ -f "$VERSION_FILE" ]; then
    PREVIOUS_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "")
fi
UPGRADE_FROM_0405="false"
if [ -n "$PREVIOUS_VERSION" ] && [ "$APP_VERSION" != "$PREVIOUS_VERSION" ]; then
    case "$PREVIOUS_VERSION" in
        0.40.5-alpha|0.40.5a-alpha)
            UPGRADE_FROM_0405="true"
            echo "Detected upgrade from $PREVIOUS_VERSION to $APP_VERSION"
            ;;
    esac
fi

EXISTING_DB="false"
if [ -f "$PG_DATA/PG_VERSION" ]; then
    EXISTING_DB="true"
fi

# Fix ownership of data directories (root only)
if [ "$IS_ROOT" = "true" ]; then
    echo "Setting ownership of $DATA_DIR to $PUID:$PGID..."
    chown -R "$PUID:$PGID" "$DATA_DIR" "$PG_RUN"
fi

run_as_classifarr() {
    if [ "$IS_ROOT" = "true" ]; then
        su-exec classifarr "$@"
    else
        "$@"
    fi
}

# Detect AVX support (used to avoid pgvector crashes on older CPUs)
HAS_AVX="false"
HAS_AVX2="false"
if grep -m1 -qw avx /proc/cpuinfo; then
    HAS_AVX="true"
fi
if grep -m1 -qw avx2 /proc/cpuinfo; then
    HAS_AVX2="true"
fi

echo "CPU AVX support: $HAS_AVX (AVX2: $HAS_AVX2)"

# Select pgvector binary variant BEFORE starting PostgreSQL.
# The image layer containing $PKGLIBDIR is read-only (overlayfs lower layer),
# so we cannot overwrite vector.so in-place. Instead we stage the desired
# variant into a writable directory and prepend it to dynamic_library_path
# so PostgreSQL picks it up before the image-layer default.
PG18_CONFIG="/usr/libexec/postgresql18/pg_config"
if [ -x "$PG18_CONFIG" ]; then
    PKGLIBDIR="$($PG18_CONFIG --pkglibdir)"
else
    PKGLIBDIR="/usr/lib/postgresql18/lib"
fi
PGVECTOR_STAGING="/run/postgresql/pgvector"

DESIRED_VARIANT="generic"
if [ "$HAS_AVX2" = "true" ] && [ -f "$PKGLIBDIR/vector_avx2.so" ]; then
    DESIRED_VARIANT="avx2"
elif [ "$HAS_AVX" = "true" ] && [ -f "$PKGLIBDIR/vector_avx.so" ]; then
    DESIRED_VARIANT="avx"
elif [ -f "$PKGLIBDIR/vector_generic.so" ]; then
    DESIRED_VARIANT="generic"
elif [ -f "$PKGLIBDIR/vector_avx.so" ]; then
    DESIRED_VARIANT="avx"
elif [ -f "$PKGLIBDIR/vector_avx2.so" ]; then
    DESIRED_VARIANT="avx2"
fi

ACTIVE_VARIANT="$DESIRED_VARIANT"
if [ -f "$PKGLIBDIR/vector_${DESIRED_VARIANT}.so" ]; then
    mkdir -p "$PGVECTOR_STAGING"
    if cp "$PKGLIBDIR/vector_${DESIRED_VARIANT}.so" "$PGVECTOR_STAGING/vector.so" 2>/dev/null; then
        export CLASSIFARR_PGVECTOR_VARIANT_SELECTED="$DESIRED_VARIANT"
        echo "pgvector selected: $DESIRED_VARIANT (staged to $PGVECTOR_STAGING)"
    else
        export CLASSIFARR_PGVECTOR_VARIANT_SELECTED="generic"
        ACTIVE_VARIANT="generic"
        echo "WARN: Unable to stage pgvector $DESIRED_VARIANT variant; falling back to generic"
    fi
else
    export CLASSIFARR_PGVECTOR_VARIANT_SELECTED="generic"
    ACTIVE_VARIANT="generic"
    echo "WARN: pgvector variant binaries not found in $PKGLIBDIR"
fi

if [ "$ACTIVE_VARIANT" = "avx2" ] && [ "$HAS_AVX2" != "true" ]; then
    echo "WARN: AVX2 not detected but AVX2 pgvector binary is selected. RAG queries may crash PostgreSQL."
fi

if [ "$ACTIVE_VARIANT" = "avx" ] && [ "$HAS_AVX" != "true" ]; then
    echo "WARN: AVX not detected but AVX pgvector binary is selected. RAG queries may crash PostgreSQL."
fi

# Initialize PostgreSQL if needed
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    run_as_classifarr initdb -D "$PG_DATA" --auth=trust --encoding=UTF8
    
    # Configure PostgreSQL to listen on localhost only
    echo "listen_addresses = 'localhost'" >> "$PG_DATA/postgresql.conf"
    echo "unix_socket_directories = '/run/postgresql'" >> "$PG_DATA/postgresql.conf"

    # Enable pg_stat_statements for query profiling (available via postgresql18-contrib)
    echo "" >> "$PG_DATA/postgresql.conf"
    echo "# Query statistics (required by pg_stat_statements extension)" >> "$PG_DATA/postgresql.conf"
    echo "shared_preload_libraries = 'pg_stat_statements'" >> "$PG_DATA/postgresql.conf"
    echo "pg_stat_statements.track = all" >> "$PG_DATA/postgresql.conf"
    echo "pg_stat_statements.max = 10000" >> "$PG_DATA/postgresql.conf"
    if [ -f "$PGVECTOR_STAGING/vector.so" ]; then
        echo "dynamic_library_path = '$PGVECTOR_STAGING, \$libdir'" >> "$PG_DATA/postgresql.conf"
    fi

    # Start PostgreSQL temporarily to create database
    run_as_classifarr pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    until run_as_classifarr pg_isready -q; do sleep 1; done
    
    # Create database
    echo "Creating classifarr database..."
    run_as_classifarr createdb classifarr
    
    # Run init script - prefer schema snapshot for speed (13x faster than running all migrations)
    if [ -f /app/database/schema/current.sql ]; then
        echo "Loading schema snapshot (fresh install fast-path)..."
        if run_as_classifarr psql -d classifarr --set ON_ERROR_STOP=1 -f /app/database/schema/current.sql; then
            echo "Schema snapshot loaded successfully!"
        else
            echo "WARN: Schema snapshot failed, falling back to init.sql (legacy path)..."
            run_as_classifarr psql -d classifarr -f /app/database/init.sql
            echo "Database initialized via init.sql (fallback)."
        fi
    elif [ -f /app/database/init.sql ]; then
        echo "Schema snapshot not found, falling back to init.sql (legacy path)..."
        run_as_classifarr psql -d classifarr -f /app/database/init.sql
        echo "Database initialized via init.sql."
    else
        echo "WARN: No database initialization file found. Database may be empty."
    fi
    
    echo "PostgreSQL initialized successfully!"
else
    # SAFEGUARD: Check PostgreSQL version compatibility
    DATA_PG_VERSION=$(cat "$PG_DATA/PG_VERSION")
    # Use PG18-specific pg_config to get installed version
    PG18_CONFIG="/usr/libexec/postgresql18/pg_config"
    INSTALLED_PG_VERSION=$($PG18_CONFIG --version | sed 's/PostgreSQL //' | cut -d. -f1)
    
    if [ "$DATA_PG_VERSION" != "$INSTALLED_PG_VERSION" ]; then
        PG17_CONFIG="/usr/libexec/postgresql17/pg_config"
        PG17_BIN_DIR="/usr/libexec/postgresql17"
        PG18_BIN_DIR="/usr/libexec/postgresql18"

        # Check if we can auto-migrate from the old version
        PG17_VERSION=""
        if [ -x "$PG17_CONFIG" ]; then
            PG17_VERSION=$($PG17_CONFIG --version | sed 's/PostgreSQL //' | cut -d. -f1)
        fi

        if [ "$DATA_PG_VERSION" = "17" ] && [ "$PG17_VERSION" = "17" ]; then
            echo "=============================================================="
            echo "Auto-upgrading PostgreSQL 17 -> 18 (pg_upgrade)"
            echo "This is a one-time operation. Your data will be preserved."
            echo "=============================================================="

            PG_OLD_DATA="$PG_DATA"
            PG_NEW_DATA="${PG_DATA}_pg18_new"
            UPGRADE_LOG="$DATA_DIR/pg_upgrade_$(date +%Y%m%dT%H%M%S).log"

            # Clean up any failed previous attempt
            if [ -d "$PG_NEW_DATA" ]; then
                echo "Cleaning up previous failed migration attempt..."
                rm -rf "$PG_NEW_DATA"
            fi

            # 1. Initialize a new PG18 cluster
            echo "Initializing new PostgreSQL 18 cluster..."
            run_as_classifarr initdb -D "$PG_NEW_DATA" --auth=trust --encoding=UTF8 --no-data-checksums

            # 2. Copy key config settings from old cluster to new
            for SETTING in listen_addresses unix_socket_directories shared_preload_libraries pg_stat_statements.track pg_stat_statements.max dynamic_library_path; do
                OLD_VAL=$(grep -E "^[[:space:]]*${SETTING}[[:space:]]*=" "$PG_OLD_DATA/postgresql.conf" 2>/dev/null | head -1 || true)
                if [ -n "$OLD_VAL" ]; then
                    echo "$OLD_VAL" >> "$PG_NEW_DATA/postgresql.conf"
                fi
            done

            # 3. Run pg_upgrade (--link for speed, no data copy)
            # pg_upgrade writes working files to CWD, so use a temp directory
            UPGRADE_WORKDIR="$DATA_DIR/pg_upgrade_work"
            mkdir -p "$UPGRADE_WORKDIR"
            echo "Running pg_upgrade --link..."
            UPGRADE_RC=0
            cd "$UPGRADE_WORKDIR"
            run_as_classifarr pg_upgrade \
                --old-bindir "$PG17_BIN_DIR" \
                --new-bindir "$PG18_BIN_DIR" \
                --old-datadir "$PG_OLD_DATA" \
                --new-datadir "$PG_NEW_DATA" \
                --socketdir "$PG_RUN" \
                --link \
                --verbose \
                > "$UPGRADE_LOG" 2>&1 || UPGRADE_RC=$?
            cd /app

            cat "$UPGRADE_LOG"

            if [ "$UPGRADE_RC" -ne 0 ]; then
                echo "=============================================================="
                echo "ERROR: pg_upgrade failed (exit code $UPGRADE_RC)"
                echo "Your original PG17 data is untouched at: $PG_OLD_DATA"
                echo "See upgrade log: $UPGRADE_LOG"
                echo ""
                echo "Options:"
                echo "1. Review the log and fix any issues, then restart Classifarr"
                echo "2. Restore from backup if needed"
                echo "=============================================================="
                rm -rf "$PG_NEW_DATA"
                exit 1
            fi

            # 4. Swap: move old data aside, rename new data into place
            echo "Swapping data directories..."
            mv "$PG_OLD_DATA" "${PG_OLD_DATA}_pg17_backup"
            mv "$PG_NEW_DATA" "$PG_OLD_DATA"

            # 5. Run generated update scripts if pg_upgrade created any
            if [ -f "$PG_OLD_DATA/update_extensions.sql" ]; then
                echo "Running extension update scripts..."
                # We'll run these after starting PG18 below
                touch "$PG_OLD_DATA/.classifarr_run_extension_updates"
            fi

            echo "=============================================================="
            echo "PostgreSQL 17 -> 18 upgrade completed successfully!"
            echo "Old PG17 data backed up to: ${PG_OLD_DATA}_pg17_backup"
            echo "You can safely delete the backup after verifying everything works."
            echo "=============================================================="

            # Refresh DATA_PG_VERSION since we just upgraded
            DATA_PG_VERSION=$(cat "$PG_DATA/PG_VERSION")
        else
            echo "=============================================================="
            echo "ERROR: PostgreSQL version mismatch detected!"
            echo "Data directory version: $DATA_PG_VERSION"
            echo "Installed PostgreSQL:   $INSTALLED_PG_VERSION"
            echo ""
            echo "To prevent data corruption, Classifarr will NOT start."
            echo ""
            echo "Options:"
            echo "1. Use a Classifarr image with PostgreSQL $DATA_PG_VERSION"
            echo "2. Backup and migrate your data to PostgreSQL $INSTALLED_PG_VERSION"
            echo "=============================================================="
            exit 1
        fi
    fi
    
    # One-time: enable data checksums on existing clusters that were created
    # without them (PG17 initdb defaulted to no checksums; PG18 defaults to
    # enabled).  This ensures the data dir is in compliance before a future
    # migration.  Requires the cluster to be stopped — safe because we
    # haven't started it yet at this point.
    CHECKSUM_MARKER="$PG_DATA/.classifarr_checksums_enabled"
    if [ ! -f "$CHECKSUM_MARKER" ]; then
        if command -v pg_checksums >/dev/null 2>&1; then
            CHECKSUM_STATUS=$(pg_checksums -D "$PG_DATA" --check 2>&1) || true
            case "$CHECKSUM_STATUS" in
                *"checksums are disabled"*|*"not enabled"*)
                    echo "Enabling data checksums on existing PostgreSQL cluster (one-time)..."
                    if pg_checksums -D "$PG_DATA" --enable; then
                        echo "Data checksums enabled successfully."
                        touch "$CHECKSUM_MARKER"
                    else
                        echo "WARN: Failed to enable data checksums. Continuing without them."
                    fi
                    ;;
                *"checksums are enabled"*)
                    echo "Data checksums already enabled."
                    touch "$CHECKSUM_MARKER"
                    ;;
                *)
                    echo "INFO: Could not determine checksum status, skipping enablement."
                    touch "$CHECKSUM_MARKER"
                    ;;
            esac
        else
            echo "INFO: pg_checksums not available, skipping checksum enablement."
            touch "$CHECKSUM_MARKER"
        fi
    fi

    # Ensure pg_stat_statements is configured (idempotent — must be done BEFORE pg_ctl
    # start so the library is loaded from the very first connection, no restart needed).
    if ! grep -q "pg_stat_statements" "$PG_DATA/postgresql.conf" 2>/dev/null; then
        # Check if there is already a shared_preload_libraries line (without pg_stat_statements).
        # If so, merge pg_stat_statements in rather than appending a second line — PostgreSQL
        # only honours the last occurrence, so a duplicate line would silently drop other libs.
        if grep -qE "^[[:space:]]*shared_preload_libraries[[:space:]]*=" "$PG_DATA/postgresql.conf" 2>/dev/null; then
            echo "Merging pg_stat_statements into existing shared_preload_libraries..."
            # Strip trailing quote(s), append ,pg_stat_statements, re-close the quote.
            sed -i -E "s|^([[:space:]]*shared_preload_libraries[[:space:]]*=[[:space:]]*')(.*)'|\1\2,pg_stat_statements'|" "$PG_DATA/postgresql.conf"
        else
            echo "Adding pg_stat_statements to PostgreSQL configuration..."
            printf '\n# Query statistics (required by pg_stat_statements extension)\n' >> "$PG_DATA/postgresql.conf"
            echo "shared_preload_libraries = 'pg_stat_statements'" >> "$PG_DATA/postgresql.conf"
        fi
        echo "pg_stat_statements.track = all" >> "$PG_DATA/postgresql.conf"
        echo "pg_stat_statements.max = 10000" >> "$PG_DATA/postgresql.conf"
    fi

    # Ensure pgvector staging path is in dynamic_library_path so the
    # selected AVX variant (if any) takes precedence over the image-layer default.
    if [ -f "$PGVECTOR_STAGING/vector.so" ]; then
        if ! grep -qF "dynamic_library_path" "$PG_DATA/postgresql.conf" 2>/dev/null; then
            echo "dynamic_library_path = '$PGVECTOR_STAGING, \$libdir'" >> "$PG_DATA/postgresql.conf"
        elif ! grep -qF "$PGVECTOR_STAGING" "$PG_DATA/postgresql.conf" 2>/dev/null; then
            sed -i -E "s|^([[:space:]]*dynamic_library_path[[:space:]]*=[[:space:]]*')(.*)'|\1$PGVECTOR_STAGING, \2'|" "$PG_DATA/postgresql.conf"
        fi
    fi

    # Start existing PostgreSQL
    echo "Starting existing PostgreSQL database (version $DATA_PG_VERSION)..."
    # Remove stale PID file that may have been left behind by an unclean container stop
    rm -f "$PG_DATA/postmaster.pid"
    run_as_classifarr pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    until run_as_classifarr pg_isready -q; do sleep 1; done
fi

# Set environment for local PostgreSQL connection
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=classifarr
export POSTGRES_USER=classifarr
export POSTGRES_PASSWORD=""

echo "PostgreSQL is ready!"

# One-time restart on upgrade from 0.40.5-alpha to ensure pgvector selection is applied cleanly
if [ "$UPGRADE_FROM_0405" = "true" ]; then
    echo "Running one-time PostgreSQL restart for pgvector compatibility..."
    run_as_classifarr pg_ctl -D "$PG_DATA" -m fast stop
    run_as_classifarr pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    echo "Waiting for PostgreSQL to restart..."
    until run_as_classifarr pg_isready -q; do sleep 1; done
fi

echo "$APP_VERSION" > "$VERSION_FILE" 2>/dev/null || true

# -----------------------------------------------------------------------
# Auto-configure Node.js heap cap from the container's cgroup memory limit.
# Only activates when --max-old-space-size is NOT already present in
# NODE_OPTIONS (e.g. set via docker-compose environment or the host).
#
# Strategy: set the heap cap to 75% of the container memory limit so that
# Node's GC can work before the kernel OOM-killer fires.
# Minimum useful cap is 256 MB; values below that are silently ignored.
#
# Supports cgroup v2  (/sys/fs/cgroup/memory.max)
#     and cgroup v1  (/sys/fs/cgroup/memory/memory.limit_in_bytes).
# -----------------------------------------------------------------------
if ! echo "${NODE_OPTIONS:-}" | grep -q 'max-old-space-size'; then
    CGROUP_LIMIT_BYTES=""

    # cgroup v2 – "max" means no limit; only use a numeric value
    if [ -r /sys/fs/cgroup/memory.max ]; then
        _RAW=$(cat /sys/fs/cgroup/memory.max 2>/dev/null || true)
        case "$_RAW" in
            ''|max|unlimited) ;;
            *) CGROUP_LIMIT_BYTES="$_RAW" ;;
        esac
    fi

    # cgroup v1 – kernel reports INT64_MAX (~9.2e18) when unconstrained;
    # reject any value at or above that sentinel.
    if [ -z "$CGROUP_LIMIT_BYTES" ] && [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
        _RAW=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || true)
        if [ -n "$_RAW" ] && awk -v val="$_RAW" 'BEGIN { exit !(val < 9223372036854775807) }' 2>/dev/null; then
            CGROUP_LIMIT_BYTES="$_RAW"
        fi
    fi

    if [ -n "$CGROUP_LIMIT_BYTES" ]; then
        # Use awk to avoid sh integer overflow on large cgroup byte counts.
        HEAP_MB=$(awk "BEGIN { v = int($CGROUP_LIMIT_BYTES / 1048576 * 0.75); print (v < 256 ? 0 : v) }" 2>/dev/null || echo 0)
        LIMIT_MB=$(awk "BEGIN { print int($CGROUP_LIMIT_BYTES / 1048576) }" 2>/dev/null || echo 0)
        if [ "$HEAP_MB" -gt 0 ] 2>/dev/null; then
            echo "Auto-configuring Node.js heap cap: ${HEAP_MB}MB (75% of ${LIMIT_MB}MB container memory limit)"
            export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=${HEAP_MB}"
        fi
    else
        echo "WARN: No container memory limit detected and --max-old-space-size is not set."
        echo "WARN: Node.js will auto-size its heap (typically up to ~4 GB), which may exhaust host RAM on"
        echo "WARN: systems with limited memory. Set 'deploy.resources.limits.memory' in docker-compose"
        echo "WARN: or pass NODE_OPTIONS=--max-old-space-size=<MB> to cap the heap explicitly."
    fi
fi
echo "Node.js heap options: ${NODE_OPTIONS:-(none set)}"

if [ "$IS_ROOT" = "true" ]; then
    echo "Starting Classifarr server as user classifarr (UID: $PUID, GID: $PGID)..."
    exec su-exec classifarr node src/index.mjs
else
    echo "Starting Classifarr server as current user (UID: $(id -u), GID: $(id -g))..."
    exec node src/index.mjs
fi
