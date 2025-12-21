# Classifarr for UnRaid

UnRaid Community Applications template for easy installation of Classifarr.

## Features

- 🤖 AI-powered media classification for the *arr ecosystem
- 📦 Single self-contained container with embedded PostgreSQL
- 🔄 Multi-Radarr and Multi-Sonarr support
- 💬 Discord notifications with interactive correction buttons
- 🎯 Confidence-based routing with decision trees
- 📺 Media server scanning (Plex/Emby/Jellyfin)

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

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | `99` | User ID for file permissions (UnRaid's `nobody` user) |
| `PGID` | `100` | Group ID for file permissions (UnRaid's `users` group) |
| `UMASK` | `022` | File creation mask |
| `TZ` | `America/New_York` | Container timezone |
| `NODE_ENV` | `production` | Application environment |

### PUID/PGID Explained

These settings ensure files created by the container have the correct permissions on your UnRaid system:

- **PUID=99**: Runs as the `nobody` user (default for UnRaid containers)
- **PGID=100**: Uses the `users` group

If you need different permissions, you can find your user/group IDs:
```bash
# SSH into UnRaid and run:
id username
# Output: uid=1000(username) gid=100(users) ...
```

### Volume Mappings

| Container Path | Host Path | Purpose |
|---------------|-----------|---------|
| `/app/data` | `/mnt/user/appdata/classifarr` | All application data including database |

**Important**: The data directory contains:
- PostgreSQL database files
- Configuration settings
- Classification history
- Learning patterns

### First-Time Setup

1. Access the WebUI at `http://[UNRAID-IP]:21324`
2. Create your admin account in the setup wizard
3. Configure your services:
   - TMDB API key (required, free from themoviedb.org)
   - Ollama instance (optional, for AI classification)
   - Radarr/Sonarr connections
   - Discord bot (optional)
   - Media server (Plex/Jellyfin/Emby)

## Updating

### Via Community Applications

1. Go to **Apps** tab
2. Click **Check for Updates**
3. Click **Update** next to Classifarr if available

### Manual Update

1. Go to **Docker** tab
2. Click on the Classifarr container
3. Click **Force Update**
4. Wait for the new image to download

### Via Command Line

```bash
docker pull ghcr.io/cloudbyday90/classifarr:latest
docker stop classifarr
docker rm classifarr
# Then recreate using docker-compose or the template
```

## Troubleshooting

### Container Won't Start

1. Check logs: Click container icon → **Logs**
2. Verify port 21324 is not in use:
   ```bash
   docker ps | grep 21324
   ```
3. Ensure appdata directory exists:
   ```bash
   ls -la /mnt/user/appdata/classifarr
   ```

### Permission Issues

If you see permission errors in logs:

1. Verify PUID/PGID settings match your needs
2. Fix ownership manually:
   ```bash
   chown -R 99:100 /mnt/user/appdata/classifarr
   ```

### Cannot Access WebUI

- Verify container is running: **Docker** tab → check status
- Try accessing directly: `http://[UNRAID-IP]:21324`
- Check UnRaid firewall settings
- Verify no reverse proxy issues

### Database Connection Issues

- Check container logs for PostgreSQL errors
- Verify the data directory has sufficient disk space
- Ensure the volume is mounted correctly

### API Connection Issues (Radarr/Sonarr)

- Verify URLs include the protocol (http:// or https://)
- Check API keys are correct
- Ensure containers can communicate (same Docker network)
- For custom networks, use container names instead of IPs

## Network Configuration

### Bridge Mode (Default)

The default bridge mode works for most users. Containers communicate via Docker's internal networking.

### Host Mode

For advanced users who need the container to share the host's network:

1. Edit container settings
2. Change Network Type to `host`
3. Remove explicit port mappings

### Custom Docker Networks

If your *arr containers are on a custom network:

1. Create the network if needed:
   ```bash
   docker network create arr-network
   ```
2. Edit Classifarr container
3. Add `--network=arr-network` to Extra Parameters
4. Use container names for API URLs (e.g., `http://radarr:7878`)

## Backup & Restore

### Backup

1. Stop the Classifarr container
2. Copy the appdata directory:
   ```bash
   cp -r /mnt/user/appdata/classifarr /mnt/user/backups/classifarr-$(date +%Y%m%d)
   ```
3. Restart the container

### Restore

1. Stop the Classifarr container
2. Replace the appdata directory with backup:
   ```bash
   rm -rf /mnt/user/appdata/classifarr
   cp -r /mnt/user/backups/classifarr-YYYYMMDD /mnt/user/appdata/classifarr
   chown -R 99:100 /mnt/user/appdata/classifarr
   ```
3. Restart the container

## Support

- **GitHub Issues**: https://github.com/cloudbyday90/Classifarr/issues
- **GitHub Discussions**: https://github.com/cloudbyday90/Classifarr/discussions
- **Documentation**: https://github.com/cloudbyday90/Classifarr

## UnRaid Specific Notes

- Compatible with UnRaid 6.9+ and 7.0+
- Uses bridge network by default
- PostgreSQL runs inside the container (no external database required)
- All data stored in single appdata directory for easy backup
- Supports User Scripts plugin for automation

## Links

- **Docker Repository**: https://github.com/cloudbyday90/Classifarr/pkgs/container/classifarr
- **Source Code**: https://github.com/cloudbyday90/Classifarr
- **Wiki**: https://github.com/cloudbyday90/Classifarr/wiki
