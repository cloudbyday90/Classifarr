# Classifarr for UnRaid

UnRaid Community Applications template for easy installation of Classifarr.

## Installation

### Via Community Applications (Recommended)

1. Open UnRaid WebUI
2. Go to **Apps** tab
3. Search for "Classifarr"
4. Click **Install**
5. Configure settings (defaults should work for most users)
6. Click **Apply**

### Manual Installation

1. Go to **Docker** tab in UnRaid
2. Click **Add Container**
3. Set the following:
   - **Name**: Classifarr
   - **Repository**: `ghcr.io/cloudbyday90/classifarr:latest`
   - **Network Type**: Bridge
   - **WebUI**: `http://[IP]:[PORT:21324]`
   - **Port**: 21324 (host) → 21324 (container)
   - **Path**: `/mnt/user/appdata/classifarr` (host) → `/app/data` (container)
4. Click **Apply**

## Configuration

### First-Time Setup

1. Access the WebUI at `http://[UNRAID-IP]:21324`
2. Complete the initial account setup
3. Follow the setup wizard to configure:
   - TMDB API key
   - Ollama AI service
   - Radarr/Sonarr connections
   - Discord bot (optional)
   - Media server (Plex/Jellyfin/Emby)

### Data Persistence

All application data is stored in `/mnt/user/appdata/classifarr/` including:
- PostgreSQL database files
- Auto-generated secure database password (`postgres_password`)
- Configuration settings
- Classification history

**Important**: Never delete the `postgres_password` file. It contains the auto-generated secure password for the database.

## Database Security

Classifarr automatically generates a secure random password for the PostgreSQL database on first run. This password is stored in `/app/data/postgres_password` (mapped to your appdata directory).

- Password is automatically generated if it doesn't exist
- Uses cryptographically secure random generation
- Never share or expose this password
- Backup this file along with your database

## Updating

### Via Community Applications

1. Go to **Apps** tab
2. Click **Check for Updates**
3. Click **Update** next to Classifarr if available
4. Wait for the update to complete

### Manual Update

1. Go to **Docker** tab
2. Click on the Classifarr container
3. Click **Force Update**
4. Wait for the new image to download and restart

## Troubleshooting

### Container Won't Start

- Check logs: Click on the container icon → **Logs**
- Verify port 21324 is not in use by another container
- Ensure appdata directory has correct permissions

### Cannot Access WebUI

- Verify the container is running
- Check port mapping is correct (21324)
- Try accessing via: `http://[UNRAID-IP]:21324`
- Check UnRaid firewall settings

### Database Connection Issues

- Verify the `postgres_password` file exists in your appdata directory
- Check container logs for database errors
- Ensure sufficient disk space is available

## Support

- **GitHub Issues**: https://github.com/cloudbyday90/Classifarr/issues
- **GitHub Discussions**: https://github.com/cloudbyday90/Classifarr/discussions
- **Documentation**: https://github.com/cloudbyday90/Classifarr

## UnRaid Specific Notes

- Compatible with UnRaid 6.9+
- Runs on bridge network by default
- Uses host path for data persistence
- PostgreSQL runs inside the container (no external database required)
- Auto-generates secure database credentials on first run

## Links

- **Docker Repository**: https://github.com/cloudbyday90/Classifarr/pkgs/container/classifarr
- **Docker Hub**: https://hub.docker.com/r/cloudbyday90/classifarr
- **Source Code**: https://github.com/cloudbyday90/Classifarr
