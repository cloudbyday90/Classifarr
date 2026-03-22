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

# Initialize PostgreSQL if needed
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    run_as_classifarr initdb -D "$PG_DATA" --auth=trust --encoding=UTF8
    
    # Configure PostgreSQL to listen on localhost only
    echo "listen_addresses = 'localhost'" >> "$PG_DATA/postgresql.conf"
    echo "unix_socket_directories = '/run/postgresql'" >> "$PG_DATA/postgresql.conf"

    # Enable pg_stat_statements for query profiling (available via postgresql17-contrib)
    echo "" >> "$PG_DATA/postgresql.conf"
    echo "# Query statistics (required by pg_stat_statements extension)" >> "$PG_DATA/postgresql.conf"
    echo "shared_preload_libraries = 'pg_stat_statements'" >> "$PG_DATA/postgresql.conf"
    echo "pg_stat_statements.track = all" >> "$PG_DATA/postgresql.conf"
    echo "pg_stat_statements.max = 10000" >> "$PG_DATA/postgresql.conf"

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
    # Use PG17-specific pg_config to get installed version
    PG17_CONFIG="/usr/libexec/postgresql17/pg_config"
    INSTALLED_PG_VERSION=$($PG17_CONFIG --version | sed 's/PostgreSQL //' | cut -d. -f1)
    
    if [ "$DATA_PG_VERSION" != "$INSTALLED_PG_VERSION" ]; then
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

    # Start existing PostgreSQL
    echo "Starting existing PostgreSQL database (version $DATA_PG_VERSION)..."
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

# Select pgvector binary variant (generic by default, avx/avx2 if supported)
PG17_CONFIG="/usr/libexec/postgresql17/pg_config"
if [ -x "$PG17_CONFIG" ]; then
    PKGLIBDIR="$($PG17_CONFIG --pkglibdir)"
else
    PKGLIBDIR="/usr/lib/postgresql17/lib"
fi

SELECTED_VARIANT="generic"
if [ "$HAS_AVX2" = "true" ] && [ -f "$PKGLIBDIR/vector_avx2.so" ]; then
    SELECTED_VARIANT="avx2"
elif [ "$HAS_AVX" = "true" ] && [ -f "$PKGLIBDIR/vector_avx.so" ]; then
    SELECTED_VARIANT="avx"
elif [ -f "$PKGLIBDIR/vector_generic.so" ]; then
    SELECTED_VARIANT="generic"
elif [ -f "$PKGLIBDIR/vector_avx.so" ]; then
    SELECTED_VARIANT="avx"
elif [ -f "$PKGLIBDIR/vector_avx2.so" ]; then
    SELECTED_VARIANT="avx2"
fi

if [ -f "$PKGLIBDIR/vector_${SELECTED_VARIANT}.so" ]; then
    if [ "$IS_ROOT" = "true" ] || [ -w "$PKGLIBDIR/vector.so" ]; then
        cp -f "$PKGLIBDIR/vector_${SELECTED_VARIANT}.so" "$PKGLIBDIR/vector.so" || \
            echo "WARN: Unable to update pgvector binary (insufficient permissions)"
    else
        echo "WARN: Cannot update pgvector binary without root; using existing vector.so"
    fi
    export CLASSIFARR_PGVECTOR_VARIANT_SELECTED="$SELECTED_VARIANT"
    echo "pgvector selected: $SELECTED_VARIANT"
else
    echo "WARN: pgvector variant binaries not found in $PKGLIBDIR"
fi

if [ "$SELECTED_VARIANT" = "avx" ] && [ "$HAS_AVX" != "true" ]; then
    echo "WARN: AVX not detected but AVX pgvector binary is selected. RAG queries may crash PostgreSQL."
fi

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
    exec su-exec classifarr node src/index.js
else
    echo "Starting Classifarr server as current user (UID: $(id -u), GID: $(id -g))..."
    exec node src/index.js
fi
