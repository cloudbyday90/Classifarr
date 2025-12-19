#!/bin/sh
# Setup script for Classifarr - generates secure password before first run

set -e

echo "=== Classifarr Initial Setup ==="
echo ""

# Determine data directory based on platform
if [ -d "/mnt/user/appdata" ]; then
    # UnRaid
    DATA_DIR="/mnt/user/appdata/classifarr/data"
    echo "Detected UnRaid system"
elif [ -d "/volume1/docker" ]; then
    # Synology
    DATA_DIR="/volume1/docker/classifarr/data"
    echo "Detected Synology system"
else
    # Standard Docker / Linux
    DATA_DIR="./data"
    echo "Using standard Docker configuration"
fi

PASSWORD_FILE="$DATA_DIR/postgres_password"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Generate password if it doesn't exist
if [ ! -f "$PASSWORD_FILE" ]; then
    echo ""
    echo "Generating secure PostgreSQL password..."
    
    # Generate 32-character random password with mixed characters
    if command -v openssl >/dev/null 2>&1; then
        # Prefer openssl if available - use full character set
        PASSWORD=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9!@#$%^&*(),.?:{}|<>' | head -c 32)
    else
        # Fallback to /dev/urandom - use full character set
        PASSWORD=$(tr -dc 'A-Za-z0-9!@#$%^&*(),.?:{}|<>' < /dev/urandom | head -c 32)
    fi
    
    echo "$PASSWORD" > "$PASSWORD_FILE"
    chmod 600 "$PASSWORD_FILE"
    
    echo "✓ Secure password generated and saved to: $PASSWORD_FILE"
    echo ""
    echo "IMPORTANT: Keep this file secure. It contains your database password."
else
    echo ""
    echo "✓ Found existing password file: $PASSWORD_FILE"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now start Classifarr with:"
echo "  docker compose up -d"
echo ""
