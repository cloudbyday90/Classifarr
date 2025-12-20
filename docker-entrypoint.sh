#!/bin/sh
set -e

# ===========================================
# Classifarr Docker Entrypoint
# All-in-One with Embedded PostgreSQL
# ===========================================

DATA_DIR="/app/data"
PG_DATA="$DATA_DIR/postgres"
PG_RUN="/run/postgresql"

echo "Starting Classifarr with embedded PostgreSQL..."
echo "Node.js version: $(node --version)"
echo "Environment: ${NODE_ENV:-development}"

# Ensure directories exist
mkdir -p "$PG_DATA" "$PG_RUN"

# Initialize PostgreSQL if needed
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    initdb -D "$PG_DATA" --auth=trust --encoding=UTF8
    
    # Configure PostgreSQL to listen on localhost only
    echo "listen_addresses = 'localhost'" >> "$PG_DATA/postgresql.conf"
    echo "unix_socket_directories = '/run/postgresql'" >> "$PG_DATA/postgresql.conf"
    
    # Start PostgreSQL temporarily to create database
    pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    until pg_isready -q; do sleep 1; done
    
    # Create database
    echo "Creating classifarr database..."
    createdb classifarr
    
    # Run init script
    if [ -f /app/database/init.sql ]; then
        echo "Running database initialization..."
        psql -d classifarr -f /app/database/init.sql
    fi
    
    echo "PostgreSQL initialized successfully!"
else
    # Start existing PostgreSQL
    echo "Starting existing PostgreSQL database..."
    pg_ctl -D "$PG_DATA" -l "$DATA_DIR/postgres.log" start
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to start..."
    until pg_isready -q; do sleep 1; done
fi

# Set environment for local PostgreSQL connection
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=classifarr
export POSTGRES_USER=classifarr
export POSTGRES_PASSWORD=""

echo "PostgreSQL is ready!"
echo "Starting Classifarr server..."
exec node src/index.js
