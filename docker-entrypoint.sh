#!/bin/sh
set -e

# Auto-generate secure password on first run
PASSWORD_FILE="/app/data/postgres_password"

if [ ! -f "$PASSWORD_FILE" ]; then
    echo "Generating secure database password..."
    # Generate 32-character random password
    PASSWORD=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
    echo "$PASSWORD" > "$PASSWORD_FILE"
    chmod 600 "$PASSWORD_FILE"
    echo "Password generated and saved to $PASSWORD_FILE"
else
    echo "Using existing database password from $PASSWORD_FILE"
    PASSWORD=$(cat "$PASSWORD_FILE")
fi

# Export password for application use
export POSTGRES_PASSWORD="$PASSWORD"

# Start the application
exec node src/index.js
