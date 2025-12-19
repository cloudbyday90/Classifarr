#!/bin/sh
set -e

# ===========================================
# Classifarr Docker Entrypoint
# ===========================================

echo "Starting Classifarr..."
echo "Node.js version: $(node --version)"
echo "Environment: ${NODE_ENV:-development}"

# Check for database password
PASSWORD_FILE="/app/data/postgres_password"

if [ ! -f "$PASSWORD_FILE" ]; then
    echo "ERROR: Database password file not found at $PASSWORD_FILE"
    echo "Please run the setup script first: ./setup.sh"
    echo "Or ensure the password file exists in the mounted volume."
    exit 1
fi

echo "Loading database credentials..."
PASSWORD=$(cat "$PASSWORD_FILE")

# Export password for application use
export POSTGRES_PASSWORD="$PASSWORD"

# Wait for postgres to be ready (if POSTGRES_HOST is set)
if [ -n "$POSTGRES_HOST" ]; then
    echo "Waiting for PostgreSQL at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}" 2>/dev/null; then
            echo "PostgreSQL is ready!"
            break
        fi
        
        attempt=$((attempt + 1))
        echo "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo "WARNING: Could not confirm PostgreSQL connection, proceeding anyway..."
    fi
fi

echo "Starting Classifarr server..."
exec node src/index.js
