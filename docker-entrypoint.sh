#!/bin/sh
set -e

# Create data directory if it doesn't exist
mkdir -p /app/data

# Generate password on first run if not exists
if [ ! -f /app/data/.db_password ]; then
    echo "Generating secure database password..."
    POSTGRES_PASSWORD=$(node -e "
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 32; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log(password);
    ")
    echo "$POSTGRES_PASSWORD" > /app/data/.db_password
    echo "Secure database password generated and saved"
fi

# Load saved password
export POSTGRES_PASSWORD=$(cat /app/data/.db_password)

exec "$@"
