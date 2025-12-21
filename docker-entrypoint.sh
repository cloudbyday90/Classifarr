#!/bin/sh
set -e

# ===========================================
# Classifarr Docker Entrypoint
# All-in-One with Embedded PostgreSQL
# ===========================================

DATA_DIR="/app/data"
PG_DATA="$DATA_DIR/postgres"
PG_RUN="/run/postgresql"

# Default values for PUID/PGID/UMASK
PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-022}

echo "Starting Classifarr with embedded PostgreSQL..."
echo "Node.js version: $(node --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "PUID: $PUID"
echo "PGID: $PGID"
echo "UMASK: $UMASK"

# Set umask
umask "$UMASK"

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

# Ensure directories exist
mkdir -p "$PG_DATA" "$PG_RUN"

# Fix ownership of data directories
echo "Setting ownership of $DATA_DIR to $PUID:$PGID..."
chown -R "$PUID:$PGID" "$DATA_DIR" "$PG_RUN"

# Initialize PostgreSQL if needed
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    su-exec classifarr initdb -D "$PG_DATA" --auth=trust --encoding=UTF8
    
    # Configure PostgreSQL to listen on localhost only
    echo "listen_addresses = 'localhost'" >> "$PG_DATA/postgresql.conf"
    echo "unix_socket_directories = '/run/postgresql'" >> "$PG_DATA/postgresql.conf"
    
    # Start PostgreSQL temporarily to create database
    su-exec classifarr pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    until su-exec classifarr pg_isready -q; do sleep 1; done
    
    # Create database
    echo "Creating classifarr database..."
    su-exec classifarr createdb classifarr
    
    # Run init script
    if [ -f /app/database/init.sql ]; then
        echo "Running database initialization..."
        su-exec classifarr psql -d classifarr -f /app/database/init.sql
    fi
    
    echo "PostgreSQL initialized successfully!"
else
    # Start existing PostgreSQL
    echo "Starting existing PostgreSQL database..."
    su-exec classifarr pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    until su-exec classifarr pg_isready -q; do sleep 1; done
fi

# Set environment for local PostgreSQL connection
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=classifarr
export POSTGRES_USER=classifarr
export POSTGRES_PASSWORD=""

echo "PostgreSQL is ready!"
echo "Starting Classifarr server as user classifarr (UID: $PUID, GID: $PGID)..."
exec su-exec classifarr node src/index.js
