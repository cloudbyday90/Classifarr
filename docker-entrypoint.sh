#!/bin/sh
set -e

# Generate password on first run if not exists
if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "AUTO_GENERATE" ]; then
    export POSTGRES_PASSWORD=$(node -e "
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 32; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log(password);
    ")
    echo "Generated secure database password"
    
    # Save to persistent config
    mkdir -p /app/data
    echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" > /app/data/.db_password
fi

# Load saved password if exists
if [ -f /app/data/.db_password ]; then
    export $(cat /app/data/.db_password | xargs)
fi

exec "$@"
