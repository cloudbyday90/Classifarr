# Classifarr for Unraid

Unraid installation guidance and the project-maintained Classifarr template.
The currently listed Community Applications app uses a separately maintained
template. See [submission and maintenance](SUBMISSION.md) before proposing a
catalog change; pushing this repository does not update that listing.

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
     - pgvector auto-selects AVX when supported, otherwise uses the generic build
   - **Network Type**: Bridge
   - **WebUI**: `http://[IP]:[PORT:21324]`
   - **Port**: 21324 (host) → 21324 (container)
   - **Path**: `/mnt/user/appdata/classifarr` (host) → `/app/data` (container)
     - Keep the `appdata` share on a cache or named pool for Docker workloads when possible
     - Avoid moving live container data between `/mnt/user/...` and `/mnt/disk...` paths while Docker is running
   - **Extra Parameters** (Advanced View): `--add-host=host.docker.internal:host-gateway`
   - **Post Arguments**: leave empty so the image's normal startup command runs
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
| `/data/media` | Your media root, for example `/mnt/user/media` | Optional file verification and moves |
| `/data/movies` | Your movie folder | Alternative to a unified media mount |
| `/data/tv` | Your TV folder | Alternative to a unified media mount |

Keep your existing appdata path. It is not a media folder. Choose either a
unified media mount or separate movie/TV mounts; you do not need all three.
Leave unused paths blank. File moves need read/write access; API-only routing
does not need a media mount. Match Radarr/Sonarr container paths where possible,
or configure Classifarr's path mappings for the different paths.

The project XML includes these optional fields. If your saved CA template does
not show them yet, use **Add another Path, Port, Variable, Label or Device** to
add a Path with your existing host folder, the matching container path, and
read/write access. Do not replace the appdata mapping.

#### Docker Compose media access

The regular `docker-compose.yml` already has appdata and a media placeholder.
For `docker-compose.unraid.yml`, media access is an opt-in overlay. Set the
existing folder in your Compose `.env` file (adjust this example):

```dotenv
CLASSIFARR_MEDIA_PATH=/mnt/user/media
```

Then validate and start with both files:

```bash
docker compose -f docker-compose.unraid.yml -f docker-compose.unraid.media.yml config --quiet
docker compose -f docker-compose.unraid.yml -f docker-compose.unraid.media.yml up -d
```

The overlay keeps `/app/data` and adds `/data/media`. It requires an explicit
host path and will not create a missing directory. Use the same two files for
later updates. Existing installs that do not need file access can keep using
the base file alone. Review paths and back up appdata before applying changes.

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

### Check older saved templates once

**Symptom:** the container exits immediately and its log mentions `tini` failing
to execute `--add-host=host.docker.internal:host-gateway`.

An older Classifarr template put that Docker option in **Post Arguments**.
That field replaces the image's startup command; it is not a Docker-options
field. An image update cannot repair this saved host-side setting.

1. In **Docker → Classifarr → Edit**, enable **Advanced View**. Record your
   existing settings privately before editing.
2. If **Post Arguments** contains the exact flag
   `--add-host=host.docker.internal:host-gateway`, move only that flag to
   **Extra Parameters**. Do not duplicate it if already present there.
3. Preserve your repository, appdata/media paths, ports, PUID/PGID and other
   settings. The stock template has no Post Arguments. If another custom
   command remains there, review its purpose instead of deleting it blindly.
4. Apply the edit, then check startup and WebUI availability. Do not delete
   appdata or reinstall into an empty directory to fix this error.

If the flag is already in Extra Parameters and Post Arguments is empty, no
correction is needed. The separately maintained CA template inspected on
2026-10-02 does not contain this bad Post Arguments value; do not assume every
CA installation is affected. The fixed repository XML does not prove your saved
template has changed. Unraid stores user templates separately and restores
their saved settings through Previous Apps. See [Community Applications](https://docs.unraid.net/community-applications/)
and [Docker command semantics](https://docs.docker.com/engine/containers/run/).

### Image-contained lifecycle changes (unreleased)

The embedded lifecycle supervisor ships inside the image. Updating to an image
that includes it enables ordered application/database shutdown with your existing
valid template, paths and PUID/PGID. No new template setting or Docker socket
mount is required. The older Post Arguments error above must be corrected
before the application can start. This change has not created a release.

An image update cannot raise Unraid's container stop timeout. Its documented
default is ten seconds; unchanged ten-second stops are covered by disposable
standard/custom-UID tests, not a guarantee for every busy database. If the host
force-stops containers, Unraid documents optional timeout headroom in Settings →
Docker (Advanced). See [official shutdown guidance](https://docs.unraid.net/unraid-os/troubleshooting/common-issues/unclean-shutdowns/)
and our [design and limits](../docs/architecture/embedded-supervisor-design.md).
We never modify host settings or weaken PostgreSQL durability automatically.

### Via Community Applications

1. Record the installed image/version and save a consistent backup (see below).
2. In **Apps**, check the Action Center for Classifarr updates.
3. Choose **Actions → Update** when available, preserving the saved settings.
4. Check the WebUI, logs and the acceptance checklist below.

### Manual Update

1. Go to **Docker** tab
2. Click on the Classifarr container
3. Click **Force Update**
4. Wait for the new image to download

Use Unraid's saved-template update flow for routine updates. Do not remove the
container and reconstruct its command from memory. Merely pulling an image or
restarting a container does not apply a changed template.

### Saved-installation acceptance checklist

Record the Unraid/Community Applications versions, old/new image IDs and pass,
fail or not-applicable for each check. Keep secrets and private paths out of
shared evidence. A Docker Desktop profile using IDs 99/100 is not this test.
Preserve the values already saved on your installation, including any appdata
path ending in `/classifarr/data` and IDs 1000/1000 from the external CA template.
Do not replace them with this repository's defaults during an update.

| Check | Expected result / next step |
| --- | --- |
| Startup and settings | Container stays healthy; saved connections, paths, libraries and routing settings remain unchanged. A fresh install offers setup. |
| Ingestion and recovery | Movie/TV import and metadata backfill progress to completion; existing inventory is preserved until a complete scan. Optional AI jobs do not hold recovery open. |
| Waiting or blocked work | Unconfigured/disabled services stay inactive. Unknown historical writers require review, not automatic takeover. Resolve the stated prerequisite before retrying. |
| Media scope | Music is ignored, not classified or routed. |
| Operator controls | Use keyboard navigation to review status and recovery; the reason and next action are readable without relying on color alone. |
| Stop and restart | Stop through Unraid, restart, and verify health and saved settings; investigate a forced stop or new error rather than declaring success. |

Do not deliberately crash an active library to test recovery. Use an isolated
copy for failure injection. Check recent logs for new errors; old retained
reports alone do not prove the updated container is still failing.

## Troubleshooting

### Container Won't Start

1. Check logs: Click container icon → **Logs**
   - If `tini` cannot execute `--add-host=...`, follow **Check older saved templates once** above.
2. Verify port 21324 is not in use:
   ```bash
   docker ps | grep 21324
   ```
3. Ensure appdata directory exists:
   ```bash
   ls -la /mnt/user/appdata/classifarr
   ```
4. If startup stops at `pg_ctl: could not start server`, inspect the embedded PostgreSQL log:
   ```bash
   docker exec classifarr sh -lc 'tail -n 200 /app/data/postgres.log'
   ```
5. If the first `FATAL` line mentions `pg_stat_statements`, the issue is a preload/runtime mismatch rather than a broken database:
   ```text
   FATAL: could not access file "pg_stat_statements": No such file or directory
   ```
   Recent images degrade gracefully by disabling query profiling automatically, but older containers may still have a stale preload line in `postgresql.conf`.
6. Confirm the `appdata` share is still pool-backed for Docker performance:
   - Unraid 6.12+: Shares → `appdata` → Primary Storage should point to your cache or named pool
   - If `appdata` has spilled onto the array, stop Docker first and move it back with the Mover or `rsync`

### Permission Issues

If you see permission errors in logs:

1. Identify the exact failing path and operation in the logs. Confirm the
   appdata mount, free space, and configured PUID/PGID before changing anything.
2. Preserve existing data and ownership in a consistent backup. Do not apply
   recursive `chown` or world-writable permissions to the entire appdata share.
3. Correct only the verified mount/identity mismatch, with all writers stopped
   if a data repair is required. Keep PostgreSQL ownership requirements intact;
   do not assume every historical installation has the same identity layout.

Unraid recommends avoiding unnecessary permission changes on default shares.
See [official share guidance](https://docs.unraid.net/unraid-os/using-unraid-to/manage-storage/shares/).

### Cannot Access WebUI

- Verify container is running: **Docker** tab → check status
- Try accessing directly: `http://[UNRAID-IP]:21324`
- Check UnRaid firewall settings
- Verify no reverse proxy issues

### Database Connection Issues

- Check container logs for PostgreSQL errors
- Check `/app/data/postgres.log` inside the container for the first `FATAL` or `PANIC` line
- Verify the data directory has sufficient disk space
- Ensure the volume is mounted correctly
- If startup fails immediately after `initdb`, check whether `SHOW shared_preload_libraries` still references `pg_stat_statements` while the image cannot load that library
- If you see `Illegal instruction` crashes during RAG similarity queries, ensure you are on a recent image (auto-selects generic pgvector on non-AVX CPUs)
- If you recently changed `appdata` storage, fully stop Docker before moving Classifarr data between pools or disk shares

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

1. Record the image ID/version and save the container template privately.
2. Stop Classifarr cleanly and verify every other writer to its appdata is
   stopped. A live directory copy is not a consistent database backup.
3. Use a trusted backup tool to copy the complete, verified host directory
   mapped to `/app/data` to a new backup destination, preserving ownership and
   permissions. Keep the source intact and confirm the backup is readable.
4. Restart Classifarr and verify health. Test restores against an isolated copy,
   not your only production data directory.

Treat backups as secrets: they contain configuration and database contents.
The application's JSON configuration export is useful, but is **not** a full
database/appdata backup.

### Restore

For a complete appdata restore:

1. Confirm backup completeness and a compatible image/database version. Do not
   point an older image at a database already upgraded by a newer image.
2. Stop Classifarr and every other writer. Preserve the current appdata and
   template separately so the restore can be reversed; do not erase them.
3. Restore into a separate verified directory, preserving the backup's
   ownership and permissions. Validate it in isolation before changing the
   saved appdata mapping. Do not let two containers share writable appdata or
   let a test copy contact production integrations.
4. Apply the reviewed mapping and compatible image in Unraid. Check startup,
   settings, inventory and recovery before retiring the old copy.

For a JSON configuration restore, follow the distinct
[restore-maintenance procedure](../docs/architecture/restore-maintenance-mode-design.md).
It requires compatible initialized data and an existing administrator; it is
not a substitute for full database recovery. Leave normal workers stopped until
restore verification passes and normal mode is explicitly restored.

## Support

- **GitHub Issues**: https://github.com/cloudbyday90/Classifarr/issues
- **GitHub Discussions**: https://github.com/cloudbyday90/Classifarr/discussions
- **Documentation**: https://github.com/cloudbyday90/Classifarr

## UnRaid Specific Notes

- The current Community Applications plugin declares Unraid 6.12.0 as its
  minimum. That plugin requirement is not certification of Classifarr on every
  Unraid version; record the actual tested host version in acceptance evidence.
  See the [official plugin manifest](https://github.com/unraid/community.applications/blob/master/plugins/community.applications.plg).
- Uses bridge network by default
- PostgreSQL runs inside the container (no external database required)
- All data stored in single appdata directory for easy backup
- Supports User Scripts plugin for automation

The single project-maintained XML is `unraid/classifarr.xml`. The stale
`templates/classifarr.xml` duplicate was removed; its embedded TemplateURL
already pointed to the retained canonical file. Direct-file consumers should
use the canonical path. The removed copy remains recoverable in Git history.

## Links

- **Docker Repository**: https://github.com/cloudbyday90/Classifarr/pkgs/container/classifarr
- **Source Code**: https://github.com/cloudbyday90/Classifarr
- **Wiki**: https://github.com/cloudbyday90/Classifarr/wiki
