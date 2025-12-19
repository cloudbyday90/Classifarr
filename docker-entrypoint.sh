#!/bin/sh
set -e

# Check for database password
PASSWORD_FILE="/app/data/postgres_password"

if [ ! -f "$PASSWORD_FILE" ]; then
    echo "ERROR: Database password file not found at $PASSWORD_FILE"
    echo "Please run the setup script first: ./setup.sh"
    echo "Or if using docker compose, the postgres container should have created it."
    exit 1
fi

echo "Using database password from $PASSWORD_FILE"
PASSWORD=$(cat "$PASSWORD_FILE")

# Export password for application use
export POSTGRES_PASSWORD="$PASSWORD"

# Start the application
exec node src/index.js
