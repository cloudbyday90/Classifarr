# UnRaid Installation Guide

Classifarr can be easily installed on UnRaid through the Community Applications store or manually using the provided template.

## Method 1: Community Applications (Recommended)

1. Open the **UnRaid WebUI**
2. Navigate to the **Apps** tab
3. Search for **"Classifarr"**
4. Click **Install**
5. Configure the settings:
   - **Port**: Default is `21324` (change if needed)
   - **App Data Path**: Default is `/mnt/user/appdata/classifarr`
6. Click **Apply** to start the container

## Method 2: Manual Template Installation

If Classifarr is not yet available in Community Applications:

1. Open the **UnRaid WebUI**
2. Navigate to the **Docker** tab
3. Click **Add Container**
4. At the bottom, toggle **Advanced View**
5. Set **Template repositories** to include:
   ```
   https://raw.githubusercontent.com/cloudbyday90/Classifarr/main/unraid/classifarr.xml
   ```
6. Click **Save** and then **Add Container** again
7. Select **Classifarr** from the template list
8. Configure and apply

## Initial Setup

After installation:

1. Access Classifarr at `http://your-unraid-ip:21324`
2. Complete the first-run setup wizard:
   - Create your admin account
   - Configure TMDB API key
   - (Optional) Configure Ollama AI for intelligent classification
   - (Optional) Configure Discord bot for notifications

## Configuration

### Required Configuration

- **TMDB API Key**: Required for media metadata
  - Get one at: https://www.themoviedb.org/settings/api

### Optional Configuration

- **Discord Bot**: For classification notifications and corrections
- **Ollama AI**: For intelligent AI-based classification
- **Media Server**: Plex, Jellyfin, or Emby for library syncing

### Environment Variables (Optional)

You can add these environment variables in the UnRaid template:

| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_API_KEY` | TMDB API key | - |
| `DISCORD_BOT_TOKEN` | Discord bot token | - |
| `DISCORD_CHANNEL_ID` | Discord channel ID | - |
| `OLLAMA_HOST` | Ollama host | `host.docker.internal` |
| `OLLAMA_PORT` | Ollama port | `11434` |
| `OLLAMA_MODEL` | Ollama model | `qwen3:14b` |

## Connecting to Other *arr Apps

Classifarr works alongside your existing *arr stack:

1. In Classifarr, go to **Libraries** and map each library to Radarr/Sonarr
2. In Overseerr/Jellyseerr, configure webhook:
   - URL: `http://your-unraid-ip:21324/api/webhook/overseerr`
   - Enable "Media Requested" notifications

## Database Security

Classifarr automatically generates a secure PostgreSQL password on first run:
- Password is stored in `/mnt/user/appdata/classifarr/app_data`
- No manual password configuration needed
- Password persists across container updates

## Updating

To update Classifarr:

1. Go to the **Docker** tab
2. Click **Check for Updates**
3. If an update is available, click **Update**
4. Your data and configuration are preserved

## Troubleshooting

### Container Won't Start

- Check the Docker logs in UnRaid
- Ensure port 21324 is not in use by another container
- Verify the appdata path has correct permissions

### Can't Access Web Interface

- Verify the container is running
- Check if the port mapping is correct
- Try accessing via IP instead of hostname

### Database Connection Issues

- Stop and remove the container
- Delete `/mnt/user/appdata/classifarr/db_data` (this will reset the database)
- Reinstall the container

## Support

- GitHub Issues: https://github.com/cloudbyday90/Classifarr/issues
- UnRaid Forums: Search for "Classifarr"

## Docker Images

Classifarr is available from multiple registries:

- **GitHub Container Registry**: `ghcr.io/cloudbyday90/classifarr:latest`
- **Docker Hub**: `cloudbyday90/classifarr:latest` (when published)

The UnRaid template defaults to GitHub Container Registry.
